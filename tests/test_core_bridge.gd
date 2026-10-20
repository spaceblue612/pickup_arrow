extends SceneTree

const CORE := preload("res://scripts/bridge/core_request.gd")
const CODEC := preload("res://scripts/bridge/stage_json_codec.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")
const ANALYZER := preload("res://scripts/dependency_analyzer.gd")
const PLACEMENT := preload("res://scripts/arrow_placement.gd")
const CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_round_trip()
	_test_rule_agreement()
	_test_generated_solution_replay()
	_test_request_errors()
	_finish()


func _arrow(id: String, cell: Vector2i, direction: String) -> Dictionary:
	return {"id": id, "head_cell": cell, "cells": [cell], "direction": direction}


func _stage(arrows: Array) -> Dictionary:
	return {"id": "STAGE-BRIDGE", "grid_size": Vector2i(6, 6), "blocked_cells": [], "arrows": arrows}


func _request(stage: Dictionary, operation: String = "validate_stage", arrow_id: String = "") -> Dictionary:
	return {
		"protocol_version": 1, "request_id": "회귀-001", "operation": operation,
		"stage": CODEC.encode_stage(stage), "arrow_id": arrow_id,
	}


func _test_round_trip() -> void:
	var stage := _stage([{
		"id": "굴곡-A", "head_cell": Vector2i(3, 2), "direction": "RIGHT",
		"cells": [Vector2i(3, 2), Vector2i(2, 2), Vector2i(2, 3)],
	}])
	stage["blocked_cells"] = [Vector2i(6, 6)]
	var serialized: Variant = JSON.parse_string(JSON.stringify(CODEC.encode_stage(stage)))
	var decoded := CODEC.decode_stage(serialized)
	_expect(decoded["errors"].is_empty(), "JSON coordinate arrays decode")
	_expect(decoded["stage"] == stage, "JSON round trip preserves coordinates, order, IDs and masks")
	var malformed: Array = [null, 12, "bad", [], [1], [1, 2, 3], [1.5, 2], [true, 2], [1e30, 2]]
	for value: Variant in malformed:
		var request := _request(stage)
		request["stage"]["arrows"][0]["cells"] = [value, [2, 2]]
		var result := CORE.handle_request(request)
		_expect(result["exit_code"] == 0 and not result["response"]["validation"]["valid"], "Malformed coordinates are validation failures")


func _assert_action_agreement(stage: Dictionary) -> void:
	var analysis: Dictionary = ANALYZER.analyze(stage["arrows"], stage["grid_size"])
	var indexed: Dictionary = PATH_RULE.index_cells(stage["arrows"])
	for arrow: Dictionary in stage["arrows"]:
		var id: String = arrow["id"]
		var direct: Dictionary = PATH_RULE.evaluate(id, stage["arrows"], stage["grid_size"])
		_expect(direct["blocking_arrow_ids"] == PATH_RULE.blocking_arrow_ids(arrow, indexed, stage["grid_size"]), "Indexed and gameplay paths agree")
		_expect(direct["blocking_arrow_ids"] == analysis["blockers_by_arrow"][id], "Dependency analysis uses gameplay blockers")
		var board := BOARD_STATE.new()
		_expect(board.load_stage_definition(stage)["event"] == "stage_loaded", "Fixture is a valid runtime stage")
		var selection: Dictionary = board.select_arrow(id)
		var event: String = selection["event"]
		if event == "extraction_requested":
			event = board.complete_extraction()["event"]
		var result := CORE.handle_request(_request(stage, "apply_action", id))
		_expect(result["exit_code"] == 0 and result["response"]["validation"]["valid"], "Bridge accepts valid fixture")
		if not result["response"].has("action"):
			continue
		var action: Dictionary = result["response"]["action"]
		_expect(action["event"] == event, "Bridge event matches BoardState")
		_expect(action["path_result"] == CODEC.to_json_value(selection["path_result"]), "Bridge blockers match BoardState")
		_expect(action["state"] == CODEC.to_json_value(board.get_state()), "Bridge final state matches BoardState")
		_expect(action["stage"]["arrows"].size() == board.remaining_arrows.size(), "Bridge returns remaining geometry")


func _test_rule_agreement() -> void:
	_assert_action_agreement(_stage([_arrow("LAST", Vector2i(2, 2), "RIGHT")]))
	var blocked := _stage([
		_arrow("A", Vector2i(1, 2), "RIGHT"),
		_arrow("B", Vector2i(3, 2), "UP"),
		_arrow("C", Vector2i(5, 2), "UP"),
	])
	_assert_action_agreement(blocked)
	var mutual := _stage([_arrow("A", Vector2i(2, 2), "RIGHT"), _arrow("B", Vector2i(4, 2), "LEFT")])
	_assert_action_agreement(mutual)
	_expect(PLACEMENT.find_solution_order(mutual["arrows"], mutual["grid_size"]).is_empty(), "Mutual blocking has no solution")
	var self_block := _stage([{
		"id": "SELF", "head_cell": Vector2i(2, 2), "direction": "RIGHT",
		"cells": [Vector2i(2, 2), Vector2i(1, 2), Vector2i(1, 3), Vector2i(2, 3), Vector2i(3, 3), Vector2i(3, 2)],
	}])
	_assert_action_agreement(self_block)
	_expect(PLACEMENT.find_solution_order(self_block["arrows"], self_block["grid_size"]).is_empty(), "Generator does not treat a self-blocked arrow as solvable")
	var mask := _stage([_arrow("A", Vector2i(2, 2), "RIGHT")])
	mask["blocked_cells"] = [Vector2i(3, 2)]
	_assert_action_agreement(mask)
	var response: Dictionary = CORE.handle_request(_request(mask, "apply_action", "A"))["response"]
	_expect(response["action"]["event"] == "stage_cleared", "Placement mask is not a ray obstacle")
	var invalid_id: Dictionary = CORE.handle_request(_request(blocked, "apply_action", "missing"))["response"]
	_expect(invalid_id["action"]["event"] == "selection_invalid", "Unknown arrow is a normal game selection result")


func _test_generated_solution_replay() -> void:
	for stage_id: String in ["STAGE-001", "STAGE-004"]:
		var stage: Dictionary = CATALOG.get_stage(stage_id)
		var decoded := CODEC.decode_stage(CODEC.encode_stage(stage))
		_expect(decoded["errors"].is_empty(), "Generated stage converts to runtime JSON")
		var remaining: Dictionary = decoded["stage"]
		var order: PackedStringArray = PLACEMENT.find_solution_order(stage["arrows"], stage["grid_size"])
		_expect(order.size() == stage["arrows"].size(), "Generated board has a full shared-rule solution")
		for id: String in order:
			var result := CORE.handle_request(_request(remaining, "apply_action", id))
			var response: Dictionary = result["response"]
			_expect(response.has("action"), "Solution action validates")
			if not response.has("action"):
				break
			_expect(response["action"]["selection_event"] == "extraction_requested", "Every solution action is legal")
			remaining = CODEC.decode_stage(response["action"]["stage"])["stage"]
		_expect(remaining["arrows"].is_empty(), "Bridge solution replay clears the board")


func _test_request_errors() -> void:
	for request: Variant in [null, [], {}, {"request_id": 1}]:
		_expect(CORE.handle_request(request)["exit_code"] == 2, "Malformed envelope is a request error")
	var stage := _stage([_arrow("A", Vector2i(2, 2), "RIGHT")])
	for field: String in ["protocol_version", "operation", "stage"]:
		var request := _request(stage)
		request.erase(field)
		_expect(CORE.handle_request(request)["exit_code"] == 2, "Missing envelope field is rejected")
	for version: Variant in [true, 2, "1"]:
		var request := _request(stage)
		request["protocol_version"] = version
		_expect(CORE.handle_request(request)["exit_code"] == 2, "Unsupported version is rejected")
	var invalid_action := _request(stage, "apply_action")
	_expect(CORE.handle_request(invalid_action)["exit_code"] == 2, "Empty action ID is rejected")
	var invalid_stage := _request(stage)
	invalid_stage["stage"]["arrows"][0]["direction"] = "DIAGONAL"
	var result := CORE.handle_request(invalid_stage)
	_expect(result["exit_code"] == 0 and result["response"]["ok"], "Invalid stage is a successfully handled validation")
	_expect(not result["response"]["validation"]["valid"], "Invalid direction is reported")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Core bridge tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
