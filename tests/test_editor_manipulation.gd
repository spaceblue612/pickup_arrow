extends SceneTree

const CORE := preload("res://scripts/bridge/core_request.gd")
const CODEC := preload("res://scripts/bridge/stage_json_codec.gd")
var _failures := PackedStringArray()


func _init() -> void:
	_test_authoring_contract()
	_test_translation()
	_test_rejected_translation()
	_test_bad_requests()
	if _failures.is_empty():
		print("Editor manipulation: all checks passed")
		quit(0)
	else:
		for message: String in _failures:
			push_error(message)
		quit(1)


func _stage() -> Dictionary:
	return {"id": "STAGE-EDIT", "grid_size": Vector2i(8, 7), "blocked_cells": [], "arrows": [
		{"id": "A", "head_cell": Vector2i(2, 2), "cells": [Vector2i(2, 2), Vector2i(1, 2)], "direction": "RIGHT"},
		{"id": "B", "head_cell": Vector2i(5, 4), "cells": [Vector2i(5, 4), Vector2i(4, 4)], "direction": "RIGHT"},
	]}


func _request(stage: Dictionary, operation: String = "translate_arrow", offset: Variant = [0, 1]) -> Dictionary:
	return {"protocol_version": 1, "request_id": "edit-test", "stage_contract": "authoring_v1", "operation": operation, "stage": CODEC.encode_stage(stage), "arrow_id": "A", "offset": offset}


func _test_authoring_contract() -> void:
	var stage := _stage()
	stage["arrows"][0]["cells"] = [Vector2i(2, 2)]
	var request := _request(stage, "validate_stage")
	_expect(not CORE.handle_request(request)["response"]["validation"]["valid"], "Authoring requires at least two cells")
	request.erase("stage_contract")
	_expect(CORE.handle_request(request)["response"]["validation"]["valid"], "Legacy runtime contract remains readable without data migration")
	stage = _stage()
	stage["arrows"][0]["direction"] = "UP"
	_expect(not CORE.handle_request(_request(stage, "validate_stage"))["response"]["validation"]["valid"], "Head direction must match first two cells")
	stage["arrows"][0]["cells"][1] = Vector2i(1, 1)
	_expect(not CORE.handle_request(_request(stage, "validate_stage"))["response"]["validation"]["valid"], "Diagonal body connection is invalid")
	var example: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://tool/examples/role_chain.json"))
	var result := CORE.handle_request({"protocol_version": 1, "request_id": "example", "stage_contract": "authoring_v1", "operation": "analyze_stage", "stage": example})
	_expect(result["response"]["validation"]["valid"], "Editor example meets two-cell minimum")
	_expect(result["response"]["analysis"]["available_arrow_ids"] == ["Z"], "Updated example preserves dependency chain")


func _test_translation() -> void:
	var stage := _stage()
	var original := stage.duplicate(true)
	var response: Dictionary = CORE.handle_request(_request(stage))["response"]
	_expect(response["edit"]["accepted"], "Unoccupied translation succeeds")
	var moved: Dictionary = CODEC.decode_stage(response["edit"]["stage"])["stage"]
	_expect(moved["arrows"][0]["cells"] == [Vector2i(2, 3), Vector2i(1, 3)], "All body cells move as one group")
	_expect(moved["arrows"][0]["head_cell"] == Vector2i(2, 3), "Head moves with body")
	_expect(moved["arrows"][0]["direction"] == "RIGHT", "Direction follows unchanged shape")
	_expect(moved["arrows"][1] == stage["arrows"][1], "Other arrows remain unchanged")
	_expect(stage == original, "Translation never mutates caller data")
	_expect(CORE.handle_request(_request(stage, "translate_arrow", [1, 0]))["response"]["edit"]["accepted"], "Old cells of moving arrow are not obstacles")


func _test_rejected_translation() -> void:
	var stage := _stage()
	for offset: Array in [[3, 2], [-2, 0], [0, 6]]:
		var edit: Dictionary = CORE.handle_request(_request(stage, "translate_arrow", offset))["response"]["edit"]
		_expect(not edit["accepted"], "Overlaps and boundary crossings are rejected")
		_expect(edit["stage"] == CODEC.encode_stage(stage), "Rejected edit returns original geometry")
	stage["blocked_cells"] = [Vector2i(1, 3)]
	_expect(not CORE.handle_request(_request(stage))["response"]["edit"]["accepted"], "Forbidden cells block movement")
	stage = _stage()
	stage["arrows"][1] = {"id": "B", "head_cell": Vector2i(3, 2), "cells": [Vector2i(3, 2), Vector2i(4, 2)], "direction": "LEFT"}
	_expect(not CORE.handle_request(_request(stage, "translate_arrow", [4, 0]))["response"]["edit"]["accepted"], "Clear destination cannot tunnel through another arrow")


func _test_bad_requests() -> void:
	for offset: Variant in [null, [1], [1.5, 0], [true, 0], [1000, 0], [1e30, 0]]:
		_expect(CORE.handle_request(_request(_stage(), "translate_arrow", offset))["exit_code"] == 2, "Malformed offsets are rejected")
	var request := _request(_stage())
	request["arrow_id"] = "missing"
	_expect(not CORE.handle_request(request)["response"]["edit"]["accepted"], "Missing arrow does not change board")
	request["stage_contract"] = "unknown"
	_expect(CORE.handle_request(request)["exit_code"] == 2, "Unknown contract is rejected")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
