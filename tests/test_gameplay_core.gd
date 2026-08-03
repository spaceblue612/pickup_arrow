extends SceneTree

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_path_rule()
	_test_board_state_transitions()
	_test_valid_solution_orders()
	_finish()


func _test_path_rule() -> void:
	var bent_arrows := [
		{
			"id": "A",
			"head_cell": Vector2i(2, 2),
			"cells": [Vector2i(2, 2), Vector2i(2, 3), Vector2i(3, 3)],
			"direction": "RIGHT",
		},
		{
			"id": "B",
			"head_cell": Vector2i(5, 3),
			"cells": [Vector2i(5, 3)],
			"direction": "UP",
		},
	]
	var side_clear: Dictionary = PATH_RULE.evaluate("A", bent_arrows, Vector2i(9, 9))
	_expect(
		side_clear["is_extractable"],
		"Arrow outside the head ray does not block snake extraction"
	)
	_expect(PATH_RULE.evaluate("B", bent_arrows, Vector2i(9, 9))["is_extractable"], "B can move in its head direction")

	var head_ray_blocker := {
		"id": "C",
		"head_cell": Vector2i(5, 2),
		"cells": [Vector2i(5, 2)],
		"direction": "UP",
	}
	var blocked: Dictionary = PATH_RULE.evaluate(
		"A",
		[bent_arrows[0], bent_arrows[1], head_ray_blocker],
		Vector2i(9, 9)
	)
	_expect(not blocked["is_extractable"], "Arrow on the head ray blocks snake extraction")
	_expect(
		blocked["blocking_arrow_ids"] == PackedStringArray(["C"]),
		"Only the head-ray arrow is reported as a blocker"
	)
	_expect(
		PATH_RULE.evaluate("A", [bent_arrows[0]], Vector2i(9, 9))["is_extractable"],
		"A moves when its head ray is clear"
	)

	var self_blocking_arrow := {
		"id": "SELF",
		"head_cell": Vector2i(2, 2),
		"cells": [
			Vector2i(2, 2),
			Vector2i(2, 3),
			Vector2i(3, 3),
			Vector2i(3, 2),
		],
		"direction": "RIGHT",
	}
	var self_blocked: Dictionary = PATH_RULE.evaluate(
		"SELF",
		[self_blocking_arrow],
		Vector2i(9, 9)
	)
	_expect(not self_blocked["is_extractable"], "Own body in front of the head blocks movement")
	_expect(
		self_blocked["blocking_arrow_ids"] == PackedStringArray(["SELF"]),
		"Self-blocking reports the selected arrow ID"
	)


func _test_board_state_transitions() -> void:
	var board = BOARD_STATE.new()
	board.load_stage("STAGE-001")
	var stage_one: Dictionary = STAGE_CATALOG.get_stage("STAGE-001")
	var initial_ids := board.get_remaining_arrow_ids()
	var blocked_arrow_id := _find_blocked_arrow_id(board.remaining_arrows)
	_expect(not blocked_arrow_id.is_empty(), "Generated stage includes a blocked arrow")
	var blocked: Dictionary = board.select_arrow(blocked_arrow_id)
	_expect(blocked["event"] == "blocked", "Blocked selection emits blocked event")
	_expect(board.phase == BOARD_STATE.Phase.READY, "Blocked selection preserves READY phase")
	_expect(board.get_remaining_arrow_ids() == initial_ids, "Blocked selection preserves arrows")

	var first_solution_id: String = stage_one["solution_order"][0]
	var extracting: Dictionary = board.select_arrow(first_solution_id)
	_expect(extracting["event"] == "extraction_requested", "Clear selection requests extraction")
	_expect(board.phase == BOARD_STATE.Phase.EXTRACTING, "Clear selection enters EXTRACTING phase")
	_expect(board.select_arrow(initial_ids[0])["event"] == "input_ignored", "Input is locked during extraction")
	_expect(board.complete_extraction()["event"] == "extraction_completed", "Animation completion removes selected arrow")
	_expect(board.phase == BOARD_STATE.Phase.READY, "Non-final extraction returns to READY phase")
	_expect(not board.get_remaining_arrow_ids().has(first_solution_id), "Completed extraction removes the full arrow")


func _test_valid_solution_orders() -> void:
	var board = BOARD_STATE.new()
	var stage_ids := STAGE_CATALOG.get_stage_ids()
	for stage_id: String in stage_ids:
		var stage_definition: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		var solution_order: PackedStringArray = stage_definition["solution_order"]
		_expect(board.load_stage(stage_id)["event"] == "stage_loaded", "%s loads for solution test" % stage_id)
		for arrow_id: String in solution_order:
			_expect(board.select_arrow(arrow_id)["event"] == "extraction_requested", "%s selects %s" % [stage_id, arrow_id])
			var completion: Dictionary = board.complete_extraction()
			if arrow_id == solution_order[-1]:
				_expect(completion["event"] == "stage_cleared", "%s clears after its final arrow" % stage_id)
			else:
				_expect(completion["event"] == "extraction_completed", "%s continues after %s" % [stage_id, arrow_id])

		if stage_id == stage_ids[-1]:
			_expect(board.advance_after_clear()["event"] == "prototype_complete", "Final stage reaches prototype complete")
		else:
			var next_stage_index := stage_ids.find(stage_id) + 1
			var expected_next_stage: String = stage_ids[next_stage_index]
			_expect(board.advance_after_clear()["event"] == "stage_loaded", "%s advances" % stage_id)
			_expect(board.active_stage_id == expected_next_stage, "%s advances to its immediate next stage" % stage_id)


func _find_blocked_arrow_id(arrows: Array) -> String:
	for arrow_data: Dictionary in arrows:
		if not PATH_RULE.evaluate(arrow_data["id"], arrows, STAGE_CATALOG.GRID_SIZE)["is_extractable"]:
			return arrow_data["id"]
	return ""


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Gameplay core tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
