extends SceneTree

const ARROW_PLACEMENT := preload("res://scripts/arrow_placement.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const BOARD_VIEWPORT := preload("res://scripts/board_viewport.gd")
const GAME := preload("res://scripts/main.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()
var _manual_game


func _init() -> void:
	if OS.get_cmdline_user_args().has("--manual"):
		call_deferred("_run_manual_check")
		return
	_test_mask_normalization_and_guards()
	_test_masked_generation_and_validation()
	_test_board_viewport_transform_and_gesture()
	_test_arrow_clipping_geometry()
	_test_runtime_tap_and_drag_routing()
	_finish()


func _run_manual_check() -> void:
	_manual_game = GAME.new()
	root.add_child(_manual_game)
	await process_frame
	_manual_game.board_state.active_stage_id = "STAGE-003"
	_manual_game.board_state.grid_size = Vector2i(20, 12)
	_manual_game.board_state.blocked_cells.clear()
	for y: int in range(1, 13):
		for x: int in range(1, 21):
			if (x <= 3 and y <= 3) \
					or (x >= 18 and y <= 3) \
					or (x <= 3 and y >= 10) \
					or (x >= 18 and y >= 10):
				_manual_game.board_state.blocked_cells.append(Vector2i(x, y))
	_manual_game.board_state.remaining_arrows = [
		{
			"id": "A",
			"head_cell": Vector2i(9, 5),
			"cells": [Vector2i(9, 5), Vector2i(8, 5), Vector2i(8, 6)],
			"direction": "RIGHT",
		},
		{
			"id": "B",
			"head_cell": Vector2i(13, 7),
			"cells": [Vector2i(13, 7), Vector2i(13, 8), Vector2i(14, 8)],
			"direction": "UP",
		},
		{
			"id": "C",
			"head_cell": Vector2i(5, 9),
			"cells": [Vector2i(5, 9), Vector2i(6, 9)],
			"direction": "LEFT",
		},
	]
	_manual_game.board_state.phase = BOARD_STATE.Phase.READY
	_manual_game.status_message = "Manual check: tap arrows or drag anywhere"
	_manual_game._configure_board_view()
	_manual_game.queue_redraw()


func _test_mask_normalization_and_guards() -> void:
	var normalized := STAGE_CATALOG.normalize_board_config({
		"grid_size": Vector2i(4, 3),
		"mask_rows": [".#..", "....", "##.."],
	})
	_expect(normalized["error"].is_empty(), "Valid dot mask normalizes")
	_expect(
		normalized["blocked_cells"] \
				== [Vector2i(2, 1), Vector2i(1, 3), Vector2i(2, 3)],
		"Dot mask uses row-major one-based blocked coordinates"
	)
	_expect(
		STAGE_CATALOG.normalize_board_config({
			"grid_size": Vector2i(3, 2),
			"mask_rows": ["..."],
		})["error"] == "Mask row count must match grid height",
		"Mask row count is validated"
	)
	_expect(
		not STAGE_CATALOG.normalize_board_config({
			"grid_size": Vector2i(2, 2),
			"mask_rows": ["..", ".x"],
		})["error"].is_empty(),
		"Unsupported mask symbols are rejected"
	)
	_expect(
		not STAGE_CATALOG.normalize_board_config({
			"grid_size": Vector2i(2, 2),
			"mask_rows": ["##", "##"],
		})["error"].is_empty(),
		"Fully blocked masks are rejected"
	)
	_expect(STAGE_CATALOG.validate_grid_size(Vector2i(99, 99)).is_empty(), "99x99 passes the resource guard")
	_expect(STAGE_CATALOG.validate_grid_size(Vector2i(999, 10)).is_empty(), "A 999x10 board passes the resource guard")
	_expect(not STAGE_CATALOG.validate_grid_size(Vector2i(1000, 1)).is_empty(), "A side above 999 is rejected")
	_expect(not STAGE_CATALOG.validate_grid_size(Vector2i(101, 100)).is_empty(), "More than 10000 cells are rejected")


func _test_masked_generation_and_validation() -> void:
	var blocked_cells: Array[Vector2i] = [
		Vector2i(1, 1),
		Vector2i(4, 1),
		Vector2i(1, 4),
		Vector2i(4, 4),
	]
	var first := ARROW_PLACEMENT.generate(
		260802,
		Vector2i(4, 4),
		2,
		1,
		3,
		0.50,
		2,
		blocked_cells
	)
	var second := ARROW_PLACEMENT.generate(
		260802,
		Vector2i(4, 4),
		2,
		1,
		3,
		0.50,
		2,
		blocked_cells
	)
	_expect(first["error"].is_empty(), "Masked generation succeeds")
	_expect(first["arrows"] == second["arrows"], "Masked generation is deterministic")
	if not first["error"].is_empty():
		return
	_expect(is_equal_approx(first["metrics"]["actual_empty_ratio"], 0.50), "Empty ratio uses playable capacity")
	for arrow_data: Dictionary in first["arrows"]:
		for cell: Vector2i in arrow_data["cells"]:
			_expect(not blocked_cells.has(cell), "Generated arrows avoid blocked cells")

	var valid_stage := {
		"id": "MASKED",
		"grid_size": Vector2i(4, 4),
		"blocked_cells": blocked_cells,
		"arrows": first["arrows"],
	}
	_expect(STAGE_CATALOG.validate_stage(valid_stage)["is_valid"], "Masked generated stage validates")
	var invalid_stage := valid_stage.duplicate(true)
	invalid_stage["arrows"] = [{
		"id": "BLOCKED",
		"head_cell": Vector2i(1, 1),
		"cells": [Vector2i(1, 1)],
		"direction": "RIGHT",
	}]
	_expect(not STAGE_CATALOG.validate_stage(invalid_stage)["is_valid"], "Arrow occupancy on a blocked cell is rejected")


func _test_board_viewport_transform_and_gesture() -> void:
	var board_view = BOARD_VIEWPORT.new()
	board_view.configure(Vector2i(99, 99), Vector2(720.0, 1280.0))
	_expect(is_equal_approx(board_view.drag_threshold_pixels, 12.0), "Default drag threshold uses the tuned value")
	_expect(
		board_view.play_rect == Rect2(0.0, 150.0, 720.0, 1040.0),
		"Board play area uses the full width and UI-safe vertical space"
	)
	var center_cell := Vector2i(50, 50)
	_expect(
		board_view.screen_to_cell(board_view.grid_to_screen(Vector2(center_cell))) == center_cell,
		"Board transform round-trips a centered large-board cell"
	)
	_expect(board_view.visible_cell_bounds()["count"] <= 180, "Large board returns only a viewport-sized visible range")
	var focus: Vector2 = board_view.play_rect.get_center()
	var focus_grid: Vector2 = (focus - board_view.board_origin) / board_view.cell_size \
			+ Vector2(0.5, 0.5)
	_expect(board_view.zoom_at(2.0, focus), "Board zoom changes at the requested focus")
	_expect(
		board_view.grid_to_screen(focus_grid).is_equal_approx(focus),
		"Board zoom preserves the focused grid position"
	)
	board_view.zoom_at(99.0, focus)
	_expect(is_equal_approx(board_view.zoom, 2.0), "Board zoom clamps to its maximum")
	board_view.zoom_at(0.0, focus)
	_expect(is_equal_approx(board_view.zoom, 0.25), "Board zoom clamps to its minimum")
	board_view.zoom_at(1.0, focus)
	_expect(
		board_view.begin_pinch(focus - Vector2(50.0, 0.0), focus + Vector2(50.0, 0.0)),
		"Two touches begin pinch navigation"
	)
	board_view.update_pinch(focus - Vector2(100.0, 0.0), focus + Vector2(100.0, 0.0))
	_expect(board_view.zoom > 1.0, "Pinch distance changes board zoom")
	board_view.end_pinch()
	_expect(not board_view.pinch_active, "Ending pinch clears the pinch state")

	var pointer_start: Vector2 = board_view.play_rect.get_center()
	_expect(board_view.begin_pointer(pointer_start), "Pointer begins inside the board play area")
	board_view.update_pointer(pointer_start + Vector2(board_view.drag_threshold_pixels * 0.5, 0.0))
	_expect(
		board_view.end_pointer(pointer_start)["is_tap"],
		"Movement below the threshold remains a tap"
	)
	var origin_before_drag: Vector2 = board_view.board_origin
	board_view.begin_pointer(pointer_start)
	board_view.update_pointer(pointer_start + Vector2(board_view.drag_threshold_pixels * 2.0, 0.0))
	_expect(board_view.pointer_state == BOARD_VIEWPORT.PointerState.PANNING, "Threshold crossing enters panning")
	_expect(not board_view.board_origin.is_equal_approx(origin_before_drag), "Panning moves an overflowing board")
	_expect(not board_view.end_pointer(pointer_start)["is_tap"], "A pan release does not emit a tap")

	var elongated_view = BOARD_VIEWPORT.new()
	elongated_view.configure(Vector2i(999, 1), Vector2(720.0, 1280.0))
	var fitted_y: float = elongated_view.board_origin.y
	elongated_view.pan_by(Vector2(0.0, 100.0))
	_expect(is_equal_approx(elongated_view.board_origin.y, fitted_y), "A fitted axis remains centered while panning")


func _test_runtime_tap_and_drag_routing() -> void:
	var game = GAME.new()
	game.initialize_game()
	game.board_state.grid_size = Vector2i(20, 9)
	game.board_state.blocked_cells.clear()
	game.board_state.remaining_arrows = [{
		"id": "GESTURE",
		"head_cell": Vector2i(10, 5),
		"cells": [Vector2i(10, 5)],
		"direction": "RIGHT",
	}]
	game.board_state.phase = BOARD_STATE.Phase.READY
	game._configure_board_view()
	var arrow_position := game.get_arrow_screen_position("GESTURE")
	var origin_before_drag: Vector2 = game.board_view.board_origin
	var press := InputEventScreenTouch.new()
	press.position = arrow_position
	press.pressed = true
	game._unhandled_input(press)
	var drag := InputEventScreenDrag.new()
	drag.position = arrow_position + Vector2(100.0, 0.0)
	game._unhandled_input(drag)
	var drag_release := InputEventScreenTouch.new()
	drag_release.position = drag.position
	drag_release.pressed = false
	game._unhandled_input(drag_release)
	_expect(game.board_state.phase == BOARD_STATE.Phase.READY, "Dragging over an arrow does not select it")
	_expect(not game.board_view.board_origin.is_equal_approx(origin_before_drag), "Runtime drag updates the board origin")

	var moved_arrow_position := game.get_arrow_screen_position("GESTURE")
	var tap_press := InputEventScreenTouch.new()
	tap_press.position = moved_arrow_position
	tap_press.pressed = true
	game._unhandled_input(tap_press)
	var tap_release := InputEventScreenTouch.new()
	tap_release.position = moved_arrow_position
	tap_release.pressed = false
	game._unhandled_input(tap_release)
	_expect(game.board_state.phase == BOARD_STATE.Phase.EXTRACTING, "Short tap selects an arrow after panning")
	game.free()

	var preview_game = GAME.new()
	preview_game.initialize_game()
	preview_game.read_only_preview = true
	preview_game.board_state.grid_size = Vector2i(20, 9)
	preview_game.board_state.remaining_arrows = [{
		"id": "PREVIEW",
		"head_cell": Vector2i(10, 5),
		"cells": [Vector2i(10, 5)],
		"direction": "RIGHT",
	}]
	preview_game.board_state.phase = BOARD_STATE.Phase.READY
	preview_game._configure_board_view()
	var preview_arrow_position := preview_game.get_arrow_screen_position("PREVIEW")
	var wheel := InputEventMouseButton.new()
	wheel.button_index = MOUSE_BUTTON_WHEEL_UP
	wheel.position = preview_arrow_position
	wheel.pressed = true
	preview_game._unhandled_input(wheel)
	_expect(preview_game.board_view.zoom > 1.0, "Read-only preview accepts wheel zoom")
	preview_game._unhandled_input(_mouse_button(preview_arrow_position, true))
	preview_game._unhandled_input(_mouse_button(preview_arrow_position, false))
	_expect(
		preview_game.board_state.phase == BOARD_STATE.Phase.READY,
		"Read-only preview tap does not select an arrow"
	)
	preview_game.board_view.zoom_at(1.0, preview_game.board_view.play_rect.get_center())
	var pinch_center: Vector2 = preview_game.board_view.play_rect.get_center()
	preview_game._unhandled_input(_screen_touch(0, pinch_center - Vector2(40.0, 0.0), true))
	preview_game._unhandled_input(_screen_touch(1, pinch_center + Vector2(40.0, 0.0), true))
	var pinch_drag := InputEventScreenDrag.new()
	pinch_drag.index = 1
	pinch_drag.position = pinch_center + Vector2(120.0, 0.0)
	preview_game._unhandled_input(pinch_drag)
	_expect(preview_game.board_view.zoom > 1.0, "Runtime two-touch drag applies pinch zoom")
	preview_game._unhandled_input(_screen_touch(1, pinch_drag.position, false))
	preview_game._unhandled_input(_screen_touch(0, pinch_center - Vector2(40.0, 0.0), false))
	_expect(
		preview_game.board_state.phase == BOARD_STATE.Phase.READY,
		"Ending runtime pinch does not emit an arrow tap"
	)
	preview_game.free()


func _test_arrow_clipping_geometry() -> void:
	var game = GAME.new()
	game.board_state.grid_size = Vector2i(20, 20)
	game._configure_board_view()
	var clip_rect: Rect2 = game.board_view.play_rect.grow(-5.0)
	var clipped_segment: PackedVector2Array = game._clip_segment_to_rect(
		Vector2(-100.0, clip_rect.get_center().y),
		Vector2(100.0, clip_rect.get_center().y),
		clip_rect
	)
	_expect(clipped_segment.size() == 2, "Arrow line crossing the play area is clipped")
	if clipped_segment.size() == 2:
		_expect(
			is_equal_approx(clipped_segment[0].x, clip_rect.position.x),
			"Clipped arrow line begins at the inset play boundary"
		)
	_expect(
		game._clip_segment_to_rect(Vector2(-20.0, 20.0), Vector2(20.0, 20.0), clip_rect).is_empty(),
		"Arrow line wholly outside the play area is discarded"
	)
	var crossing_head := PackedVector2Array([
		Vector2(100.0, game.board_view.play_rect.position.y - 20.0),
		Vector2(80.0, game.board_view.play_rect.position.y + 30.0),
		Vector2(120.0, game.board_view.play_rect.position.y + 30.0),
	])
	var clipped_heads: Array[PackedVector2Array] = game._clip_polygon_to_play_rect(crossing_head)
	_expect(not clipped_heads.is_empty(), "Arrow head crossing the play area keeps its visible part")
	for polygon: PackedVector2Array in clipped_heads:
		for point: Vector2 in polygon:
			_expect(
				_point_is_inside_or_on_rect(point, game.board_view.play_rect),
				"Clipped arrow head stays inside the play area"
			)
	game.free()


func _mouse_button(position: Vector2, pressed: bool) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.position = position
	event.pressed = pressed
	return event


func _screen_touch(index: int, position: Vector2, pressed: bool) -> InputEventScreenTouch:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = position
	event.pressed = pressed
	return event


func _point_is_inside_or_on_rect(point: Vector2, rect: Rect2) -> bool:
	return point.x >= rect.position.x and point.x <= rect.end.x \
			and point.y >= rect.position.y and point.y <= rect.end.y


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Board foundation tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
