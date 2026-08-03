extends SceneTree

const GAME := preload("res://scripts/main.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var game = GAME.new()
	game.initialize_game()
	_test_touch_hit_and_blocked_feedback(game)
	_test_extraction_motion(game)
	_test_stage_flow(game)
	game.free()
	await _test_runtime_snake_motion()
	_finish()


func _test_touch_hit_and_blocked_feedback(game) -> void:
	var blocked_touch := _find_visible_blocked_touch(game)
	var blocked_arrow_id: String = blocked_touch.get("arrow_id", "")
	var body_position: Vector2 = blocked_touch.get("position", Vector2.ZERO)
	_expect(not blocked_arrow_id.is_empty(), "A blocked arrow has a visible selectable body cell")
	_expect(game.get_arrow_id_at_position(body_position) == blocked_arrow_id, "Touch hit-testing finds a bent body cell")
	_expect(game.get_arrow_id_at_position(Vector2.ZERO).is_empty(), "Touch hit-testing ignores empty space")
	var touch := InputEventScreenTouch.new()
	touch.position = body_position
	touch.pressed = true
	game._unhandled_input(touch)
	var release := InputEventScreenTouch.new()
	release.position = body_position
	release.pressed = false
	game._unhandled_input(release)
	_expect(game.blocked_arrow_id == blocked_arrow_id, "Blocked feedback identifies selected arrow")
	_expect(game.board_state.phase == BOARD_STATE.Phase.READY, "Blocked touch preserves READY phase")


func _test_extraction_motion(game) -> void:
	var solution_order: PackedStringArray = STAGE_CATALOG.get_stage("STAGE-001")["solution_order"]
	var arrow_id: String = solution_order[0]
	game.extraction_speed_pixels_per_second = 1000.0
	var motion: Dictionary = game.get_extraction_motion(arrow_id)
	_expect(not motion.is_empty(), "Extractable arrow has motion parameters")
	_expect(motion["distance"] > 0.0, "Extraction motion travels a positive distance")
	_expect(
		is_equal_approx(motion["duration"], motion["distance"] / 1000.0),
		"Extraction duration uses the configurable constant speed"
	)
	_expect(
		is_equal_approx(
			motion["target_progress_cells"] * game._cell_size(),
			motion["distance"]
		),
		"Extraction progress includes the head exit route and trailing body"
	)

	var bent_arrow := {
		"id": "SNAKE",
		"head_cell": Vector2i(2, 2),
		"cells": [Vector2i(2, 2), Vector2i(2, 3), Vector2i(3, 3)],
		"direction": "RIGHT",
	}
	_expect(
		game.get_extraction_grid_positions(bent_arrow, 1.0) \
				== PackedVector2Array([
					Vector2(3, 2),
					Vector2(2, 2),
					Vector2(2, 3),
				]),
		"Each trailing body segment takes the previous segment position"
	)
	_expect(
		game.get_extraction_grid_positions(bent_arrow, 0.5) \
				== PackedVector2Array([
					Vector2(2.5, 2),
					Vector2(2, 2.5),
					Vector2(2.5, 3),
				]),
		"Trailing segments interpolate continuously along the original path"
	)
	_expect(
		game.get_extraction_body_grid_path(bent_arrow, 0.5) \
				== PackedVector2Array([
					Vector2(2.5, 2),
					Vector2(2, 2),
					Vector2(2, 3),
					Vector2(2.5, 3),
				]),
		"Rendered body path preserves bends instead of translating the shape"
	)


func _test_runtime_snake_motion() -> void:
	var game = GAME.new()
	root.add_child(game)
	await process_frame
	var bent_arrow := {
		"id": "SNAKE",
		"head_cell": Vector2i(2, 2),
		"cells": [Vector2i(2, 2), Vector2i(2, 3), Vector2i(3, 3)],
		"direction": "RIGHT",
	}
	game.board_state.remaining_arrows = [bent_arrow]
	game.board_state.grid_size = Vector2i(9, 9)
	game.board_state.phase = BOARD_STATE.Phase.READY
	game.flow_state = GAME.FlowState.PLAYING
	game.extraction_speed_pixels_per_second = 4000.0
	var motion: Dictionary = game.get_extraction_motion("SNAKE")
	_expect(
		game.select_arrow_id("SNAKE")["event"] == "extraction_requested",
		"Runtime snake arrow starts extraction"
	)
	await create_timer(motion["duration"] * 0.45).timeout
	var mid_progress: float = game.extraction_progress_cells
	_expect(
		mid_progress > 0.0 and mid_progress < motion["target_progress_cells"],
		"Runtime tween advances through an intermediate snake position"
	)
	_expect(
		game.board_state.get_remaining_arrow_ids().has("SNAKE"),
		"Arrow remains until the trailing body exits"
	)
	var mid_positions := game.get_extraction_grid_positions(bent_arrow, mid_progress)
	_expect(
		not (mid_positions[1] - mid_positions[0]).is_equal_approx(Vector2(0, 1)),
		"Runtime body does not preserve a rigid translated shape"
	)
	await create_timer(motion["duration"] * 0.70).timeout
	_expect(
		not game.board_state.get_remaining_arrow_ids().has("SNAKE"),
		"Arrow is removed after the trailing body exits"
	)
	game.free()


func _test_stage_flow(game) -> void:
	var stage_one: Dictionary = STAGE_CATALOG.get_stage("STAGE-001")
	var solution_order: PackedStringArray = stage_one["solution_order"]
	for index: int in solution_order.size():
		var arrow_id: String = solution_order[index]
		_expect(game.select_arrow_id(arrow_id)["event"] == "extraction_requested", "Stage one selects %s" % arrow_id)
		if index == 0:
			_expect(game.select_arrow_id(arrow_id)["event"] == "input_ignored", "Touch input is locked during extraction")
		game.complete_active_extraction()
	_expect(game.board_state.phase == BOARD_STATE.Phase.CLEARED, "Stage one clears")
	_expect(game.advance_after_clear()["event"] == "stage_loaded", "Clear advances to next stage")
	_expect(game.board_state.active_stage_id == "STAGE-002", "Next stage is loaded")


func _find_visible_blocked_touch(game) -> Dictionary:
	var arrows: Array = game.board_state.remaining_arrows
	for arrow_data: Dictionary in arrows:
		var arrow_id: String = arrow_data["id"]
		if PATH_RULE.evaluate(arrow_id, arrows, game.board_state.grid_size)["is_extractable"]:
			continue
		for position: Vector2 in game.get_arrow_screen_positions(arrow_id):
			if game.get_arrow_id_at_position(position) == arrow_id:
				return {"arrow_id": arrow_id, "position": position}
	return {}


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Playable flow tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
