class_name PickupArrowGame
extends Node2D

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const BOARD_VIEWPORT := preload("res://scripts/board_viewport.gd")
const MAP_GENERATION_CONTROLLER := preload("res://scripts/map_generation_controller.gd")

const BACKGROUND_COLOR := Color("182033")
const BOARD_COLOR := Color("263451")
const GRID_COLOR := Color("435577")
const ARROW_COLOR := Color("79c8ff")
const EXTRACTING_COLOR := Color("ffd166")
const BLOCKED_COLOR := Color("ff6b6b")
const TEXT_COLOR := Color("eef4ff")
const WHEEL_ZOOM_FACTOR := 1.15
const HOME_LIST_ITEM_HEIGHT := 120.0
const HOME_LIST_ITEM_GAP := 14.0
const HOME_LIST_BOTTOM_MARGIN := 64.0
const HOME_LIST_WHEEL_STEP := 88.0

enum FlowState {
	HOME,
	GENERATING,
	PLAYING,
}

signal stage_load_completed(stage_id: String, runtime_seed: int)
signal stage_load_failed(stage_id: String, code: String)

@export_range(100.0, 4000.0, 50.0) var extraction_speed_pixels_per_second := 1600.0
@export_range(4.0, 96.0, 1.0) var drag_threshold_pixels := 12.0
@export var read_only_preview := false
@export var developer_checks_enabled := OS.is_debug_build()

var board_state = BOARD_STATE.new()
var board_view = BOARD_VIEWPORT.new()
var blocked_arrow_id := ""
var blocked_feedback_remaining := 0.0
var extracting_arrow_id := ""
var extraction_progress_cells := 0.0
var status_message := ""
var _blocked_cell_set: Dictionary = {}
var flow_state := FlowState.HOME
var retry_stage_id := ""
var home_error_message := ""
var generation_wait_ratio := 0.0
var generation_elapsed_seconds := 0.0
var generation_stage_id := ""
var last_runtime_seed := -1
var generation_controller: Node
var active_stage_definition: Dictionary = {}
var _active_touches: Dictionary = {}
var home_stage_summaries: Dictionary = {}
var home_list_scroll_offset := 0.0
var home_list_pointer_active := false
var home_list_pointer_start := Vector2.ZERO
var home_list_scroll_start := 0.0
var home_list_dragged := false


func _ready() -> void:
	_ensure_generation_controller()
	if STAGE_CATALOG.get_stage_ids().is_empty():
		show_home("Balance snapshot failed to load")
	else:
		_warm_home_stage_summaries()
		show_home()


func initialize_game() -> Dictionary:
	var stage_ids := STAGE_CATALOG.get_stage_ids()
	if stage_ids.is_empty():
		status_message = "Balance snapshot failed to load"
		return {"event": "load_failed"}
	var result: Dictionary = load_stage(stage_ids[0])
	status_message = "Tap an arrow to pull it out"
	return result


func show_home(error_message: String = "", failed_stage_id: String = "") -> void:
	flow_state = FlowState.HOME
	home_error_message = error_message
	retry_stage_id = failed_stage_id
	generation_stage_id = ""
	generation_wait_ratio = 0.0
	generation_elapsed_seconds = 0.0
	home_list_scroll_offset = 0.0
	home_list_pointer_active = false
	home_list_dragged = false
	board_view.cancel_pointer()
	board_view.end_pinch()
	_active_touches.clear()
	queue_redraw()


func start_game() -> Dictionary:
	var stage_ids := STAGE_CATALOG.get_stage_ids()
	if stage_ids.is_empty():
		show_home("Balance snapshot failed to load")
		return {"event": "load_failed"}
	var stage_id := retry_stage_id if not retry_stage_id.is_empty() else stage_ids[0]
	return start_stage(stage_id)


func start_stage(stage_id: String) -> Dictionary:
	if STAGE_CATALOG.get_stage_profile(stage_id).is_empty():
		return {"event": "load_failed"}
	home_error_message = ""
	retry_stage_id = ""
	return request_stage(stage_id)


func request_stage(
	stage_id: String,
	runtime_seed_override: int = -1,
	timeout_seconds: float = MAP_GENERATION_CONTROLLER.DEFAULT_TIMEOUT_SECONDS
) -> Dictionary:
	var profile := STAGE_CATALOG.get_stage_profile(stage_id)
	if profile.is_empty():
		show_home("Map generation problem. Please try again.", stage_id)
		return {"event": "load_failed"}
	if profile["generation_mode"] == "fixed" and runtime_seed_override < 0:
		var fixed_result := load_stage(stage_id)
		if fixed_result["event"] != "stage_loaded":
			show_home("Stage settings could not generate a playable map.", stage_id)
			stage_load_failed.emit(stage_id, "generation_failed")
		return fixed_result

	_ensure_generation_controller()
	flow_state = FlowState.GENERATING
	generation_stage_id = stage_id
	generation_wait_ratio = 0.0
	generation_elapsed_seconds = 0.0
	status_message = "Generating map..."
	var request: Dictionary = generation_controller.request_stage(
		stage_id,
		runtime_seed_override,
		timeout_seconds
	)
	last_runtime_seed = int(request["runtime_seed"])
	queue_redraw()
	return {
		"event": "generation_requested" if request["error"].is_empty() else "load_failed",
		"request": request,
	}


func load_stage(stage_id: String) -> Dictionary:
	var stage_definition := STAGE_CATALOG.get_stage(stage_id)
	if stage_definition.is_empty():
		return {"event": "load_failed"}
	var result: Dictionary = board_state.load_stage_definition(stage_definition)
	if result["event"] == "stage_loaded":
		active_stage_definition = stage_definition.duplicate(true)
		_cache_home_stage_summary(stage_definition)
		flow_state = FlowState.PLAYING
		last_runtime_seed = int(STAGE_CATALOG.get_stage_profile(stage_id)["seed"])
		_configure_board_view()
		stage_load_completed.emit(stage_id, last_runtime_seed)
	queue_redraw()
	return result


func select_arrow_id(arrow_id: String) -> Dictionary:
	var result: Dictionary = board_state.select_arrow(arrow_id)
	match result["event"]:
		"blocked":
			blocked_arrow_id = arrow_id
			blocked_feedback_remaining = 0.28
			status_message = "That arrow is blocked"
			queue_redraw()
		"extraction_requested":
			extracting_arrow_id = arrow_id
			status_message = ""
			board_view.cancel_pointer()
			if is_inside_tree():
				_start_extraction_animation(arrow_id)
			queue_redraw()
	return result


func complete_active_extraction() -> Dictionary:
	var result: Dictionary = board_state.complete_extraction()
	extracting_arrow_id = ""
	extraction_progress_cells = 0.0
	queue_redraw()
	if result["event"] == "stage_cleared":
		status_message = "Stage clear!"
		if is_inside_tree():
			var clear_delay := create_tween()
			clear_delay.tween_interval(0.55)
			clear_delay.tween_callback(advance_after_clear)
	return result


func advance_after_clear() -> Dictionary:
	var stage_ids := STAGE_CATALOG.get_stage_ids()
	var current_index := stage_ids.find(board_state.active_stage_id)
	if current_index >= 0 and current_index < stage_ids.size() - 1:
		var next_stage_id: String = stage_ids[current_index + 1]
		var next_profile := STAGE_CATALOG.get_stage_profile(next_stage_id)
		if next_profile.get("generation_mode") == "random":
			return request_stage(next_stage_id)
	var result: Dictionary = board_state.advance_after_clear()
	if result["event"] == "stage_loaded":
		flow_state = FlowState.PLAYING
		_configure_board_view()
		status_message = "Stage %d" % (STAGE_CATALOG.get_stage_ids().find(board_state.active_stage_id) + 1)
	elif result["event"] == "prototype_complete":
		status_message = "All prototype stages cleared!"
	queue_redraw()
	return result


func get_arrow_screen_position(arrow_id: String) -> Vector2:
	_ensure_board_view_configuration()
	for arrow_data: Dictionary in board_state.remaining_arrows:
		if arrow_data["id"] == arrow_id:
			return _cell_to_position(arrow_data["head_cell"])
	return Vector2.INF


func get_arrow_screen_positions(arrow_id: String) -> PackedVector2Array:
	_ensure_board_view_configuration()
	var positions := PackedVector2Array()
	var arrow_data := _get_remaining_arrow(arrow_id)
	if arrow_data.is_empty():
		return positions
	for cell: Vector2i in arrow_data["cells"]:
		positions.append(_cell_to_position(cell))
	return positions


func get_arrow_id_at_position(position: Vector2) -> String:
	if board_state.phase != BOARD_STATE.Phase.READY:
		return ""
	_ensure_board_view_configuration()
	var selected_cell := board_view.screen_to_cell(position)
	if selected_cell == Vector2i.ZERO:
		return ""
	for arrow_data: Dictionary in board_state.remaining_arrows:
		for cell: Vector2i in arrow_data["cells"]:
			if cell == selected_cell:
				return arrow_data["id"]
	return ""


func _unhandled_input(event: InputEvent) -> void:
	if flow_state == FlowState.HOME:
		if not read_only_preview:
			_handle_home_input(event)
		return
	if flow_state == FlowState.GENERATING:
		return
	if not read_only_preview \
			and developer_checks_enabled and _is_pointer_release_in_rect(
		event,
		_developer_home_button_rect(_viewport_size())
	):
		show_home()
		return
	if board_state.phase != BOARD_STATE.Phase.READY:
		board_view.cancel_pointer()
		board_view.end_pinch()
		_active_touches.clear()
		return
	_ensure_board_view_configuration()
	if event is InputEventScreenTouch:
		_handle_screen_touch(event)
	elif event is InputEventScreenDrag:
		_handle_screen_drag(event)
	elif event is InputEventMouseButton \
			and (event.button_index == MOUSE_BUTTON_WHEEL_UP \
				or event.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		if event.pressed and board_view.play_rect.has_point(event.position):
			var factor := WHEEL_ZOOM_FACTOR \
					if event.button_index == MOUSE_BUTTON_WHEEL_UP \
					else 1.0 / WHEEL_ZOOM_FACTOR
			if board_view.zoom_by_factor(factor, event.position):
				queue_redraw()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			board_view.begin_pointer(event.position)
		else:
			_finish_pointer(event.position)
	elif event is InputEventMouseMotion \
			and (event.button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		if board_view.update_pointer(event.position):
			queue_redraw()


func _handle_screen_touch(event: InputEventScreenTouch) -> void:
	if event.pressed:
		_active_touches[event.index] = event.position
		if _active_touches.size() == 1:
			board_view.begin_pointer(event.position)
		elif _active_touches.size() == 2:
			var positions := _first_two_touch_positions()
			if board_view.begin_pinch(positions[0], positions[1]):
				queue_redraw()
		return
	var was_pinching: bool = board_view.pinch_active
	_active_touches.erase(event.index)
	if was_pinching:
		board_view.end_pinch()
		board_view.cancel_pointer()
		queue_redraw()
	else:
		_finish_pointer(event.position)


func _handle_screen_drag(event: InputEventScreenDrag) -> void:
	_active_touches[event.index] = event.position
	if _active_touches.size() >= 2:
		var positions := _first_two_touch_positions()
		if not board_view.pinch_active:
			board_view.begin_pinch(positions[0], positions[1])
		if board_view.update_pinch(positions[0], positions[1]):
			queue_redraw()
	elif not board_view.pinch_active and board_view.update_pointer(event.position):
		queue_redraw()


func _first_two_touch_positions() -> Array[Vector2]:
	var touch_ids: Array = _active_touches.keys()
	touch_ids.sort()
	return [
		_active_touches[touch_ids[0]],
		_active_touches[touch_ids[1]],
	]


func _process(delta: float) -> void:
	if flow_state == FlowState.GENERATING:
		queue_redraw()
	if not extracting_arrow_id.is_empty():
		queue_redraw()
	if blocked_feedback_remaining <= 0.0:
		return
	blocked_feedback_remaining = maxf(0.0, blocked_feedback_remaining - delta)
	if blocked_feedback_remaining == 0.0:
		blocked_arrow_id = ""
	queue_redraw()


func _draw() -> void:
	var viewport_dimensions := _viewport_size()
	draw_rect(Rect2(Vector2.ZERO, viewport_dimensions), BACKGROUND_COLOR)
	if flow_state == FlowState.HOME:
		_draw_home(viewport_dimensions)
		return
	if flow_state == FlowState.GENERATING:
		_draw_generation_wait(viewport_dimensions)
		return
	_ensure_board_view_configuration()
	_draw_header(viewport_dimensions)
	_draw_board()
	if board_state.phase == BOARD_STATE.Phase.PROTOTYPE_COMPLETE:
		_draw_completion(viewport_dimensions)


func _draw_home(viewport_dimensions: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var center_x := viewport_dimensions.x * 0.5
	draw_string(font, Vector2(center_x - 200.0, 150.0), "STAGE LIST", HORIZONTAL_ALIGNMENT_CENTER, 400.0, 38, TEXT_COLOR)
	draw_string(font, Vector2(center_x - 220.0, 194.0), "Choose a stage to play", HORIZONTAL_ALIGNMENT_CENTER, 440.0, 21, Color("a9b8d6"))
	if not home_error_message.is_empty():
		draw_multiline_string(
			font,
			Vector2(center_x - 240.0, 242.0),
			home_error_message,
			HORIZONTAL_ALIGNMENT_CENTER,
			480.0,
			22,
			-1,
			Color("ffb4a9")
		)
	var list_rect := _home_list_rect(viewport_dimensions)
	draw_rect(list_rect, Color("121a2a"), true)
	for stage_id: String in STAGE_CATALOG.get_stage_ids():
		var button := _home_stage_button_rect(stage_id, viewport_dimensions)
		var visible_button := button.intersection(list_rect)
		if not visible_button.has_area():
			continue
		var profile := STAGE_CATALOG.get_stage_profile(stage_id)
		var summary := get_home_stage_summary(stage_id)
		var grid_size: Vector2i = profile["grid_size"]
		var generation_mode_label := _generation_mode_label(profile["generation_mode"])
		var actual_empty_label := "-" if summary.is_empty() else _percent_label(summary["actual_empty_ratio"])
		var initial_extractable_label := "-" if summary.is_empty() else _percent_label(summary["initial_extractable_ratio"])
		draw_rect(visible_button, BOARD_COLOR, true)
		if visible_button == button:
			draw_rect(button, ARROW_COLOR, false, 2.0)
		var title_position := button.position + Vector2(24.0, 31.0)
		if list_rect.has_point(title_position):
			draw_string(
				font,
				title_position,
				"%s · %s" % [stage_id, generation_mode_label],
				HORIZONTAL_ALIGNMENT_LEFT,
				button.size.x - 160.0,
				25,
				TEXT_COLOR
			)
		var metrics_position := button.position + Vector2(24.0, 64.0)
		if list_rect.has_point(metrics_position):
			draw_string(
				font,
				metrics_position,
				"크기 %d×%d · 목표 %s · 실제 %s" % [
					grid_size.x,
					grid_size.y,
					_percent_label(profile["target_empty_ratio"]),
					actual_empty_label,
				],
				HORIZONTAL_ALIGNMENT_LEFT,
				button.size.x - 48.0,
				16,
				Color("a9b8d6")
			)
		var initial_position := button.position + Vector2(24.0, 94.0)
		if list_rect.has_point(initial_position):
			draw_string(
				font,
				initial_position,
				"초기 가능 %s" % initial_extractable_label,
				HORIZONTAL_ALIGNMENT_LEFT,
				button.size.x - 48.0,
				16,
				Color("a9b8d6")
			)
	_draw_home_list_scroll_indicator(list_rect, viewport_dimensions)


func _draw_generation_wait(viewport_dimensions: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var center_x := viewport_dimensions.x * 0.5
	draw_string(font, Vector2(center_x - 220.0, 260.0), "GENERATING %s" % generation_stage_id, HORIZONTAL_ALIGNMENT_CENTER, 440.0, 28, TEXT_COLOR)
	var track := Rect2(Vector2(center_x - 230.0, 330.0), Vector2(460.0, 30.0))
	draw_rect(track, BOARD_COLOR, true)
	draw_rect(Rect2(track.position, Vector2(track.size.x * generation_wait_ratio, track.size.y)), ARROW_COLOR, true)
	draw_string(font, Vector2(center_x - 220.0, 410.0), "%.1f / 10.0 sec" % generation_elapsed_seconds, HORIZONTAL_ALIGNMENT_CENTER, 440.0, 22, TEXT_COLOR)


func _handle_home_input(event: InputEvent) -> void:
	var viewport_dimensions := _viewport_size()
	if event is InputEventScreenTouch:
		if event.pressed:
			_begin_home_list_pointer(event.position, viewport_dimensions)
		else:
			_finish_home_list_pointer(event.position, viewport_dimensions)
	elif event is InputEventScreenDrag:
		_update_home_list_pointer(event.position, viewport_dimensions)
	elif event is InputEventMouseButton \
			and (event.button_index == MOUSE_BUTTON_WHEEL_UP \
				or event.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		if event.pressed and _home_list_rect(viewport_dimensions).has_point(event.position):
			var direction := -1.0 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0
			_scroll_home_list(direction * HOME_LIST_WHEEL_STEP, viewport_dimensions)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_begin_home_list_pointer(event.position, viewport_dimensions)
		else:
			_finish_home_list_pointer(event.position, viewport_dimensions)
	elif event is InputEventMouseMotion \
			and (event.button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		_update_home_list_pointer(event.position, viewport_dimensions)


func _begin_home_list_pointer(position: Vector2, viewport_dimensions: Vector2) -> void:
	if not _home_list_rect(viewport_dimensions).has_point(position):
		return
	home_list_pointer_active = true
	home_list_pointer_start = position
	home_list_scroll_start = home_list_scroll_offset
	home_list_dragged = false


func _update_home_list_pointer(position: Vector2, viewport_dimensions: Vector2) -> void:
	if not home_list_pointer_active:
		return
	var drag_distance := home_list_pointer_start.y - position.y
	if absf(drag_distance) < drag_threshold_pixels and not home_list_dragged:
		return
	home_list_dragged = true
	home_list_scroll_offset = _clamp_home_list_scroll(
		home_list_scroll_start + drag_distance,
		viewport_dimensions
	)
	queue_redraw()


func _finish_home_list_pointer(position: Vector2, viewport_dimensions: Vector2) -> void:
	var can_select := not home_list_pointer_active or not home_list_dragged
	home_list_pointer_active = false
	home_list_dragged = false
	if not can_select or not _home_list_rect(viewport_dimensions).has_point(position):
		return
	for stage_id: String in STAGE_CATALOG.get_stage_ids():
		if _home_stage_button_rect(stage_id, viewport_dimensions).has_point(position):
			start_stage(stage_id)
			return


func _scroll_home_list(delta: float, viewport_dimensions: Vector2) -> void:
	var next_offset := _clamp_home_list_scroll(home_list_scroll_offset + delta, viewport_dimensions)
	if is_equal_approx(home_list_scroll_offset, next_offset):
		return
	home_list_scroll_offset = next_offset
	queue_redraw()


func _home_stage_button_rect(stage_id: String, viewport_dimensions: Vector2) -> Rect2:
	var stage_index := STAGE_CATALOG.get_stage_ids().find(stage_id)
	if stage_index < 0:
		return Rect2()
	var width := minf(560.0, viewport_dimensions.x - 48.0)
	var list_rect := _home_list_rect(viewport_dimensions)
	return Rect2(
		Vector2(
			viewport_dimensions.x * 0.5 - width * 0.5,
			list_rect.position.y + float(stage_index) * (HOME_LIST_ITEM_HEIGHT + HOME_LIST_ITEM_GAP) - home_list_scroll_offset
		),
		Vector2(width, HOME_LIST_ITEM_HEIGHT)
	)


func _home_list_rect(viewport_dimensions: Vector2) -> Rect2:
	var start_y := 330.0 if not home_error_message.is_empty() else 250.0
	return Rect2(
		Vector2(24.0, start_y),
		Vector2(viewport_dimensions.x - 48.0, maxf(0.0, viewport_dimensions.y - start_y - HOME_LIST_BOTTOM_MARGIN))
	)


func _home_list_content_height(stage_count: int) -> float:
	if stage_count <= 0:
		return 0.0
	return float(stage_count) * (HOME_LIST_ITEM_HEIGHT + HOME_LIST_ITEM_GAP) - HOME_LIST_ITEM_GAP


func _home_list_scroll_max(viewport_dimensions: Vector2, stage_count: int = -1) -> float:
	var resolved_stage_count := STAGE_CATALOG.get_stage_ids().size() if stage_count < 0 else stage_count
	return maxf(0.0, _home_list_content_height(resolved_stage_count) - _home_list_rect(viewport_dimensions).size.y)


func _clamp_home_list_scroll(
	requested_offset: float,
	viewport_dimensions: Vector2,
	stage_count: int = -1
) -> float:
	return clampf(requested_offset, 0.0, _home_list_scroll_max(viewport_dimensions, stage_count))


func _draw_home_list_scroll_indicator(list_rect: Rect2, viewport_dimensions: Vector2) -> void:
	var content_height := _home_list_content_height(STAGE_CATALOG.get_stage_ids().size())
	if content_height <= list_rect.size.y:
		return
	var track := Rect2(Vector2(viewport_dimensions.x - 34.0, list_rect.position.y + 12.0), Vector2(5.0, list_rect.size.y - 24.0))
	var thumb_height := maxf(48.0, track.size.y * list_rect.size.y / content_height)
	var max_scroll := _home_list_scroll_max(viewport_dimensions)
	var thumb_y := track.position.y + (track.size.y - thumb_height) * home_list_scroll_offset / max_scroll
	draw_rect(track, Color("435577"), true)
	draw_rect(Rect2(Vector2(track.position.x, thumb_y), Vector2(track.size.x, thumb_height)), ARROW_COLOR, true)


func _warm_home_stage_summaries() -> void:
	for stage_id: String in STAGE_CATALOG.get_stage_ids():
		get_home_stage_summary(stage_id)


func get_home_stage_summary(stage_id: String) -> Dictionary:
	if home_stage_summaries.has(stage_id):
		return home_stage_summaries[stage_id].duplicate()
	var stage_definition := STAGE_CATALOG.get_stage(stage_id)
	if stage_definition.is_empty():
		return {}
	_cache_home_stage_summary(stage_definition)
	return home_stage_summaries.get(stage_id, {}).duplicate()


func _cache_home_stage_summary(stage_definition: Dictionary) -> void:
	var stage_id: String = stage_definition.get("id", "")
	if stage_id.is_empty():
		return
	var generation_metrics: Dictionary = stage_definition.get("generation_metrics", {})
	var dependency_analysis: Dictionary = stage_definition.get("dependency_analysis", {})
	if not generation_metrics.has("actual_empty_ratio") \
			or not dependency_analysis.has("initial_extractable_ratio"):
		return
	home_stage_summaries[stage_id] = {
		"actual_empty_ratio": float(generation_metrics["actual_empty_ratio"]),
		"initial_extractable_ratio": float(dependency_analysis["initial_extractable_ratio"]),
	}


func _percent_label(ratio: float) -> String:
	var percentage := ratio * 100.0
	if is_equal_approx(percentage, roundf(percentage)):
		return "%d%%" % roundi(percentage)
	return "%.1f%%" % percentage


func _generation_mode_label(generation_mode: String) -> String:
	return "랜덤" if generation_mode == "random" else "고정"


func _developer_home_button_rect(viewport_dimensions: Vector2) -> Rect2:
	return Rect2(Vector2(viewport_dimensions.x - 190.0, 38.0), Vector2(150.0, 54.0))


func _is_pointer_release_in_rect(event: InputEvent, rect: Rect2) -> bool:
	if event is InputEventScreenTouch and not event.pressed:
		return rect.has_point(event.position)
	if event is InputEventMouseButton \
			and event.button_index == MOUSE_BUTTON_LEFT \
			and not event.pressed:
		return rect.has_point(event.position)
	return false


func _finish_pointer(position: Vector2) -> void:
	var result := board_view.end_pointer(position)
	if result["is_tap"] and not read_only_preview:
		_try_select_at_position(result["position"])
	queue_redraw()


func _try_select_at_position(position: Vector2) -> void:
	var arrow_id := get_arrow_id_at_position(position)
	if not arrow_id.is_empty():
		select_arrow_id(arrow_id)


func _start_extraction_animation(arrow_id: String) -> void:
	extraction_progress_cells = 0.0
	var motion := get_extraction_motion(arrow_id)
	if motion.is_empty():
		return
	var animation := create_tween()
	animation.set_trans(Tween.TRANS_LINEAR)
	animation.tween_property(
		self,
		"extraction_progress_cells",
		motion["target_progress_cells"],
		motion["duration"]
	)
	animation.tween_callback(complete_active_extraction)


func get_extraction_motion(arrow_id: String) -> Dictionary:
	var arrow_data := _get_remaining_arrow(arrow_id)
	if arrow_data.is_empty():
		return {}
	var direction_vector: Vector2i = PATH_RULE.DIRECTION_VECTORS[arrow_data["direction"]]
	var head_exit_distance := _head_exit_distance(arrow_data, direction_vector)
	var target_progress_cells := head_exit_distance / _cell_size() \
			+ float(arrow_data["cells"].size() - 1)
	var travel_distance := target_progress_cells * _cell_size()
	return {
		"target_progress_cells": target_progress_cells,
		"distance": travel_distance,
		"duration": travel_distance / maxf(extraction_speed_pixels_per_second, 1.0),
	}


func _head_exit_distance(arrow_data: Dictionary, direction: Vector2i) -> float:
	var head_cell: Vector2i = arrow_data["head_cell"]
	var exit_distance_cells := 0.0
	if direction == Vector2i.RIGHT:
		exit_distance_cells = float(board_state.grid_size.x - head_cell.x + 1)
	elif direction == Vector2i.LEFT:
		exit_distance_cells = float(head_cell.x)
	elif direction == Vector2i.DOWN:
		exit_distance_cells = float(board_state.grid_size.y - head_cell.y + 1)
	else:
		exit_distance_cells = float(head_cell.y)
	return exit_distance_cells * _cell_size()


func get_extraction_grid_positions(
	arrow_data: Dictionary,
	progress_cells: float
) -> PackedVector2Array:
	var positions := PackedVector2Array()
	for body_index: int in arrow_data["cells"].size():
		positions.append(_route_grid_position(arrow_data, progress_cells - float(body_index)))
	return positions


func get_extraction_body_grid_path(
	arrow_data: Dictionary,
	progress_cells: float
) -> PackedVector2Array:
	var cells: Array = arrow_data["cells"]
	var path := PackedVector2Array([_route_grid_position(arrow_data, progress_cells)])
	if cells.size() == 1:
		return path

	var tail_route_distance := progress_cells - float(cells.size() - 1)
	var vertex_distance := floori(progress_cells)
	if is_equal_approx(float(vertex_distance), progress_cells):
		vertex_distance -= 1
	while float(vertex_distance) > tail_route_distance:
		path.append(_route_grid_position(arrow_data, float(vertex_distance)))
		vertex_distance -= 1
	var tail_position := _route_grid_position(arrow_data, tail_route_distance)
	if not path[-1].is_equal_approx(tail_position):
		path.append(tail_position)
	return path


func _route_grid_position(arrow_data: Dictionary, route_distance: float) -> Vector2:
	var head_cell := Vector2(arrow_data["head_cell"])
	if route_distance >= 0.0:
		var direction_vector: Vector2i = PATH_RULE.DIRECTION_VECTORS[arrow_data["direction"]]
		return head_cell + Vector2(direction_vector) * route_distance

	var cells: Array = arrow_data["cells"]
	var trail_distance := clampf(-route_distance, 0.0, float(cells.size() - 1))
	var from_index := floori(trail_distance)
	var to_index := mini(from_index + 1, cells.size() - 1)
	var segment_progress := trail_distance - float(from_index)
	return Vector2(cells[from_index]).lerp(Vector2(cells[to_index]), segment_progress)


func _draw_header(viewport_dimensions: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var stage_ids := STAGE_CATALOG.get_stage_ids()
	var stage_number := stage_ids.find(board_state.active_stage_id) + 1
	var title := "PICKUP ARROW"
	var stage_label := "STAGE %d / %d" % [stage_number, stage_ids.size()]
	draw_string(font, Vector2(42.0, 70.0), title, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 34, TEXT_COLOR)
	draw_string(font, Vector2(42.0, 112.0), stage_label, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 20, Color("a9b8d6"))
	if developer_checks_enabled:
		var developer_home_button := _developer_home_button_rect(viewport_dimensions)
		draw_rect(developer_home_button, BOARD_COLOR, true)
		draw_rect(developer_home_button, ARROW_COLOR, false, 2.0)
		draw_string(
			font,
			developer_home_button.position + Vector2(0.0, 36.0),
			"TEST HOME",
			HORIZONTAL_ALIGNMENT_CENTER,
			developer_home_button.size.x,
			18,
			TEXT_COLOR
		)
		if active_stage_definition.get("generation_mode") == "random":
			draw_string(
				font,
				Vector2(42.0, 142.0),
				"RUNTIME SEED %d" % last_runtime_seed,
				HORIZONTAL_ALIGNMENT_LEFT,
				-1.0,
				17,
				Color("a9b8d6")
			)
	if not status_message.is_empty():
		draw_string(font, Vector2(42.0, viewport_dimensions.y - 60.0), status_message, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 24, TEXT_COLOR)


func _draw_board() -> void:
	var bounds := board_view.visible_cell_bounds()
	if bounds["count"] <= 0:
		return
	for y: int in range(bounds["min"].y, bounds["max"].y + 1):
		for x: int in range(bounds["min"].x, bounds["max"].x + 1):
			var cell := Vector2i(x, y)
			if _blocked_cell_set.has(cell):
				continue
			var visible_rect := board_view.cell_screen_rect(cell).intersection(board_view.play_rect)
			if not visible_rect.has_area():
				continue
			draw_rect(visible_rect, BOARD_COLOR)
			draw_rect(visible_rect, GRID_COLOR, false, 2.0)

	for arrow_data: Dictionary in board_state.remaining_arrows:
		var arrow_id: String = arrow_data["id"]
		var color := ARROW_COLOR
		var draw_offset := Vector2.ZERO
		var extraction_progress := 0.0
		if arrow_id == extracting_arrow_id:
			extraction_progress = extraction_progress_cells
			color = EXTRACTING_COLOR
		elif arrow_id == blocked_arrow_id:
			draw_offset.x = sin(blocked_feedback_remaining * 90.0) * 10.0
			color = BLOCKED_COLOR
		if _arrow_is_visible(arrow_data, extraction_progress):
			_draw_arrow(arrow_data, color, draw_offset, extraction_progress)


func _arrow_is_visible(arrow_data: Dictionary, extraction_progress: float) -> bool:
	var expanded_play_rect: Rect2 = board_view.play_rect.grow(_cell_size())
	for grid_position: Vector2 in get_extraction_grid_positions(arrow_data, extraction_progress):
		if expanded_play_rect.has_point(_grid_position_to_screen(grid_position)):
			return true
	return false


func _draw_arrow(
	arrow_data: Dictionary,
	color: Color,
	offset: Vector2,
	extraction_progress: float = 0.0
) -> void:
	var direction_vector: Vector2i = PATH_RULE.DIRECTION_VECTORS[arrow_data["direction"]]
	var direction := Vector2(direction_vector.x, direction_vector.y)
	var normal := Vector2(-direction.y, direction.x)
	var arrow_size := _cell_size() * 0.64
	var line_width := maxf(8.0, arrow_size * 0.16)
	var grid_positions := get_extraction_grid_positions(arrow_data, extraction_progress)
	var body_grid_path := get_extraction_body_grid_path(arrow_data, extraction_progress)

	if grid_positions.size() == 1:
		var center := _grid_position_to_screen(grid_positions[0]) + offset
		_draw_clipped_line(
			center - direction * arrow_size * 0.36,
			center,
			color,
			line_width
		)
	else:
		for index: int in range(body_grid_path.size() - 1):
			var from_position := _grid_position_to_screen(body_grid_path[index]) + offset
			var to_position := _grid_position_to_screen(body_grid_path[index + 1]) + offset
			_draw_clipped_line(from_position, to_position, color, line_width)
		for grid_position: Vector2 in grid_positions:
			_draw_clipped_circle(
				_grid_position_to_screen(grid_position) + offset,
				line_width * 0.5,
				color
			)

	var head_position := _grid_position_to_screen(grid_positions[0]) + offset
	var tip := head_position + direction * arrow_size * 0.42
	var head_base := tip - direction * arrow_size * 0.30
	_draw_clipped_line(head_position, head_base, color, line_width)
	_draw_clipped_polygon(
		PackedVector2Array([
			tip,
			head_base + normal * arrow_size * 0.24,
			head_base - normal * arrow_size * 0.24,
		]),
		color
	)


func _draw_clipped_line(
	from_position: Vector2,
	to_position: Vector2,
	color: Color,
	line_width: float
) -> void:
	var center_clip_rect: Rect2 = board_view.play_rect.grow(-line_width * 0.5)
	var clipped_segment := _clip_segment_to_rect(
		from_position,
		to_position,
		center_clip_rect
	)
	if clipped_segment.size() == 2:
		draw_line(clipped_segment[0], clipped_segment[1], color, line_width, true)


func _draw_clipped_circle(center: Vector2, radius: float, color: Color) -> void:
	if board_view.play_rect.grow(-radius).has_point(center):
		draw_circle(center, radius, color)
		return
	var circle_points := PackedVector2Array()
	for point_index: int in 20:
		var angle := TAU * float(point_index) / 20.0
		circle_points.append(center + Vector2(cos(angle), sin(angle)) * radius)
	_draw_clipped_polygon(circle_points, color)


func _draw_clipped_polygon(points: PackedVector2Array, color: Color) -> void:
	for clipped_polygon: PackedVector2Array in _clip_polygon_to_play_rect(points):
		if clipped_polygon.size() >= 3:
			draw_colored_polygon(clipped_polygon, color)


func _clip_polygon_to_play_rect(points: PackedVector2Array) -> Array[PackedVector2Array]:
	if points.size() < 3:
		return []
	var clip_rect: Rect2 = board_view.play_rect
	var bounds := Rect2(points[0], Vector2.ZERO)
	for point: Vector2 in points:
		bounds = bounds.expand(point)
	if clip_rect.encloses(bounds):
		return [points]
	var clip_polygon := PackedVector2Array([
		clip_rect.position,
		Vector2(clip_rect.end.x, clip_rect.position.y),
		clip_rect.end,
		Vector2(clip_rect.position.x, clip_rect.end.y),
	])
	return Geometry2D.intersect_polygons(points, clip_polygon)


func _clip_segment_to_rect(
	from_position: Vector2,
	to_position: Vector2,
	clip_rect: Rect2
) -> PackedVector2Array:
	if not clip_rect.has_area():
		return PackedVector2Array()
	var delta: Vector2 = to_position - from_position
	var minimum_t := 0.0
	var maximum_t := 1.0
	var p_values: Array[float] = [-delta.x, delta.x, -delta.y, delta.y]
	var q_values: Array[float] = [
		from_position.x - clip_rect.position.x,
		clip_rect.end.x - from_position.x,
		from_position.y - clip_rect.position.y,
		clip_rect.end.y - from_position.y,
	]
	for index: int in 4:
		var p: float = p_values[index]
		var q: float = q_values[index]
		if is_zero_approx(p):
			if q < 0.0:
				return PackedVector2Array()
			continue
		var ratio: float = q / p
		if p < 0.0:
			minimum_t = maxf(minimum_t, ratio)
		else:
			maximum_t = minf(maximum_t, ratio)
		if minimum_t > maximum_t:
			return PackedVector2Array()
	return PackedVector2Array([
		from_position + delta * minimum_t,
		from_position + delta * maximum_t,
	])


func _draw_completion(viewport_dimensions: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var panel := Rect2(viewport_dimensions * Vector2(0.10, 0.37), viewport_dimensions * Vector2(0.80, 0.24))
	draw_style_box(_completion_style_box(), panel)
	draw_string(font, panel.position + Vector2(42.0, 74.0), "PROTOTYPE COMPLETE", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 31, TEXT_COLOR)
	draw_string(font, panel.position + Vector2(42.0, 120.0), "All synced stages are clear.", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 20, Color("c9d6ef"))


func _board_rect() -> Rect2:
	_ensure_board_view_configuration()
	return board_view.play_rect


func _cell_size() -> float:
	_ensure_board_view_configuration()
	return board_view.cell_size


func _cell_to_position(cell: Vector2i) -> Vector2:
	return _grid_position_to_screen(Vector2(cell))


func _grid_position_to_screen(grid_position: Vector2) -> Vector2:
	_ensure_board_view_configuration()
	return board_view.grid_to_screen(grid_position)


func _get_remaining_arrow(arrow_id: String) -> Dictionary:
	for arrow_data: Dictionary in board_state.remaining_arrows:
		if arrow_data["id"] == arrow_id:
			return arrow_data
	return {}


func _configure_board_view() -> void:
	var active_grid_size: Vector2i = board_state.grid_size
	if active_grid_size == Vector2i.ZERO:
		active_grid_size = STAGE_CATALOG.GRID_SIZE
	board_view.drag_threshold_pixels = drag_threshold_pixels
	board_view.configure(active_grid_size, _viewport_size())
	_rebuild_blocked_cell_set()


func _ensure_board_view_configuration() -> void:
	var active_grid_size: Vector2i = board_state.grid_size
	if active_grid_size == Vector2i.ZERO:
		active_grid_size = STAGE_CATALOG.GRID_SIZE
	var active_viewport_size := _viewport_size()
	if not board_view.matches_configuration(active_grid_size, active_viewport_size):
		_configure_board_view()
	board_view.drag_threshold_pixels = drag_threshold_pixels


func _rebuild_blocked_cell_set() -> void:
	_blocked_cell_set.clear()
	for cell: Vector2i in board_state.blocked_cells:
		_blocked_cell_set[cell] = true


func _ensure_generation_controller() -> void:
	if is_instance_valid(generation_controller):
		return
	generation_controller = MAP_GENERATION_CONTROLLER.new()
	add_child(generation_controller)
	generation_controller.progress_changed.connect(_on_generation_progress)
	generation_controller.generation_completed.connect(_on_generation_completed)
	generation_controller.generation_failed.connect(_on_generation_failed)


func _on_generation_progress(request_id: int, wait_ratio: float, elapsed_seconds: float) -> void:
	if not is_instance_valid(generation_controller) \
			or request_id != generation_controller.active_request_id:
		return
	generation_wait_ratio = wait_ratio
	generation_elapsed_seconds = elapsed_seconds
	queue_redraw()


func _on_generation_completed(_request_id: int, stage_definition: Dictionary) -> void:
	var result := board_state.load_stage_definition(stage_definition)
	if result["event"] != "stage_loaded":
		_on_generation_failed(0, stage_definition.get("id", generation_stage_id), "invalid_result")
		return
	flow_state = FlowState.PLAYING
	active_stage_definition = stage_definition.duplicate(true)
	_cache_home_stage_summary(stage_definition)
	last_runtime_seed = int(stage_definition["runtime_seed"])
	generation_stage_id = ""
	_configure_board_view()
	status_message = "Tap an arrow to pull it out"
	stage_load_completed.emit(board_state.active_stage_id, last_runtime_seed)
	queue_redraw()


func _on_generation_failed(_request_id: int, stage_id: String, code: String) -> void:
	var message := "Map generation took too long. Please try again."
	if code != "timeout":
		message = "Map generation problem. Please try again."
	show_home(message, stage_id)
	stage_load_failed.emit(stage_id, code)


func _viewport_size() -> Vector2:
	if not is_inside_tree():
		return Vector2(720.0, 1280.0)
	var current_viewport_size := get_viewport_rect().size
	if current_viewport_size.x <= 0.0 or current_viewport_size.y <= 0.0:
		return Vector2(720.0, 1280.0)
	return current_viewport_size


func _completion_style_box() -> StyleBoxFlat:
	var style_box := StyleBoxFlat.new()
	style_box.bg_color = Color("30456d")
	style_box.corner_radius_top_left = 24
	style_box.corner_radius_top_right = 24
	style_box.corner_radius_bottom_left = 24
	style_box.corner_radius_bottom_right = 24
	return style_box
