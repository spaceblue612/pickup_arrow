class_name PickupArrowGame
extends Node2D

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")

const BACKGROUND_COLOR := Color("182033")
const BOARD_COLOR := Color("263451")
const GRID_COLOR := Color("435577")
const ARROW_COLOR := Color("79c8ff")
const EXTRACTING_COLOR := Color("ffd166")
const BLOCKED_COLOR := Color("ff6b6b")
const TEXT_COLOR := Color("eef4ff")

@export_range(100.0, 4000.0, 50.0) var extraction_speed_pixels_per_second := 1600.0

var board_state = BOARD_STATE.new()
var blocked_arrow_id := ""
var blocked_feedback_remaining := 0.0
var extracting_arrow_id := ""
var extraction_progress_cells := 0.0
var status_message := ""


func _ready() -> void:
	initialize_game()


func initialize_game() -> Dictionary:
	var result: Dictionary = board_state.load_stage(STAGE_CATALOG.STAGE_IDS[0])
	status_message = "Tap an arrow to pull it out"
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
	var result: Dictionary = board_state.advance_after_clear()
	if result["event"] == "stage_loaded":
		status_message = "Stage %d" % (STAGE_CATALOG.STAGE_IDS.find(board_state.active_stage_id) + 1)
	elif result["event"] == "prototype_complete":
		status_message = "All prototype stages cleared!"
	queue_redraw()
	return result


func get_arrow_screen_position(arrow_id: String) -> Vector2:
	for arrow_data: Dictionary in board_state.remaining_arrows:
		if arrow_data["id"] == arrow_id:
			return _cell_to_position(arrow_data["head_cell"])
	return Vector2.INF


func get_arrow_screen_positions(arrow_id: String) -> PackedVector2Array:
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
	var hit_radius := _cell_size() * 0.42
	for arrow_data: Dictionary in board_state.remaining_arrows:
		for cell: Vector2i in arrow_data["cells"]:
			if position.distance_to(_cell_to_position(cell)) <= hit_radius:
				return arrow_data["id"]
	return ""


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		_try_select_at_position(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		_try_select_at_position(event.position)


func _process(delta: float) -> void:
	if not extracting_arrow_id.is_empty():
		queue_redraw()
	if blocked_feedback_remaining <= 0.0:
		return
	blocked_feedback_remaining = maxf(0.0, blocked_feedback_remaining - delta)
	if blocked_feedback_remaining == 0.0:
		blocked_arrow_id = ""
	queue_redraw()


func _draw() -> void:
	var viewport_size := _viewport_size()
	draw_rect(Rect2(Vector2.ZERO, viewport_size), BACKGROUND_COLOR)
	_draw_header(viewport_size)
	_draw_board()
	if board_state.phase == BOARD_STATE.Phase.PROTOTYPE_COMPLETE:
		_draw_completion(viewport_size)


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
	var head_position := _cell_to_position(arrow_data["head_cell"])
	var viewport_size := _viewport_size()
	var margin := _cell_size()
	if direction == Vector2i.RIGHT:
		return viewport_size.x - head_position.x + margin
	if direction == Vector2i.LEFT:
		return head_position.x + margin
	if direction == Vector2i.DOWN:
		return viewport_size.y - head_position.y + margin
	return head_position.y + margin


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


func _draw_header(viewport_size: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var stage_number := STAGE_CATALOG.STAGE_IDS.find(board_state.active_stage_id) + 1
	var title := "PICKUP ARROW"
	var stage_label := "STAGE %d / %d" % [stage_number, STAGE_CATALOG.STAGE_IDS.size()]
	draw_string(font, Vector2(42.0, 70.0), title, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 34, TEXT_COLOR)
	draw_string(font, Vector2(42.0, 112.0), stage_label, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 20, Color("a9b8d6"))
	if not status_message.is_empty():
		draw_string(font, Vector2(42.0, viewport_size.y - 60.0), status_message, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 24, TEXT_COLOR)


func _draw_board() -> void:
	var board_rect := _board_rect()
	var cell_size := _cell_size()
	draw_style_box(_board_style_box(), board_rect)
	for line_index in range(STAGE_CATALOG.GRID_SIZE.x + 1):
		var x := board_rect.position.x + line_index * cell_size
		draw_line(Vector2(x, board_rect.position.y), Vector2(x, board_rect.end.y), GRID_COLOR, 2.0)
	for line_index in range(STAGE_CATALOG.GRID_SIZE.y + 1):
		var y := board_rect.position.y + line_index * cell_size
		draw_line(Vector2(board_rect.position.x, y), Vector2(board_rect.end.x, y), GRID_COLOR, 2.0)

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
		_draw_arrow(arrow_data, color, draw_offset, extraction_progress)


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
		draw_line(center - direction * arrow_size * 0.36, center, color, line_width, true)
	else:
		for index: int in range(body_grid_path.size() - 1):
			var from_position := _grid_position_to_screen(body_grid_path[index]) + offset
			var to_position := _grid_position_to_screen(body_grid_path[index + 1]) + offset
			draw_line(from_position, to_position, color, line_width, true)
		for grid_position: Vector2 in grid_positions:
			draw_circle(_grid_position_to_screen(grid_position) + offset, line_width * 0.5, color)

	var head_position := _grid_position_to_screen(grid_positions[0]) + offset
	var tip := head_position + direction * arrow_size * 0.42
	var head_base := tip - direction * arrow_size * 0.30
	draw_line(head_position, head_base, color, line_width, true)
	draw_colored_polygon(PackedVector2Array([tip, head_base + normal * arrow_size * 0.24, head_base - normal * arrow_size * 0.24]), color)


func _draw_completion(viewport_size: Vector2) -> void:
	var font := ThemeDB.fallback_font
	var panel := Rect2(viewport_size * Vector2(0.10, 0.37), viewport_size * Vector2(0.80, 0.24))
	draw_style_box(_completion_style_box(), panel)
	draw_string(font, panel.position + Vector2(42.0, 74.0), "PROTOTYPE COMPLETE", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 31, TEXT_COLOR)
	draw_string(font, panel.position + Vector2(42.0, 120.0), "All three stages are clear.", HORIZONTAL_ALIGNMENT_LEFT, -1.0, 20, Color("c9d6ef"))


func _board_rect() -> Rect2:
	var viewport_size := _viewport_size()
	var board_size := minf(viewport_size.x - 64.0, viewport_size.y * 0.66)
	return Rect2(Vector2((viewport_size.x - board_size) * 0.5, viewport_size.y * 0.20), Vector2(board_size, board_size))


func _cell_size() -> float:
	return _board_rect().size.x / STAGE_CATALOG.GRID_SIZE.x


func _cell_to_position(cell: Vector2i) -> Vector2:
	return _grid_position_to_screen(Vector2(cell))


func _grid_position_to_screen(grid_position: Vector2) -> Vector2:
	var board_rect := _board_rect()
	var cell_size := _cell_size()
	return board_rect.position + Vector2(
		(grid_position.x - 0.5) * cell_size,
		(grid_position.y - 0.5) * cell_size
	)


func _get_remaining_arrow(arrow_id: String) -> Dictionary:
	for arrow_data: Dictionary in board_state.remaining_arrows:
		if arrow_data["id"] == arrow_id:
			return arrow_data
	return {}


func _viewport_size() -> Vector2:
	if not is_inside_tree():
		return Vector2(720.0, 1280.0)
	var viewport_size := get_viewport_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return Vector2(720.0, 1280.0)
	return viewport_size


func _board_style_box() -> StyleBoxFlat:
	var style_box := StyleBoxFlat.new()
	style_box.bg_color = BOARD_COLOR
	style_box.corner_radius_top_left = 28
	style_box.corner_radius_top_right = 28
	style_box.corner_radius_bottom_left = 28
	style_box.corner_radius_bottom_right = 28
	return style_box


func _completion_style_box() -> StyleBoxFlat:
	var style_box := StyleBoxFlat.new()
	style_box.bg_color = Color("30456d")
	style_box.corner_radius_top_left = 24
	style_box.corner_radius_top_right = 24
	style_box.corner_radius_bottom_left = 24
	style_box.corner_radius_bottom_right = 24
	return style_box
