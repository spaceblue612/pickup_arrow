class_name CoreRequest
extends RefCounted

const STAGE_VALIDATOR := preload("res://scripts/stage_validator.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const CODEC := preload("res://scripts/bridge/stage_json_codec.gd")
const ANALYZER := preload("res://scripts/dependency_analyzer.gd")
const ARROW_EDIT := preload("res://scripts/bridge/arrow_edit.gd")
const EDITOR_PLACEMENT := preload("res://scripts/editor_placement.gd")
const PROTOCOL_VERSION := 1


static func handle_request(request: Variant) -> Dictionary:
	if not (request is Dictionary):
		return failure("", "invalid_request", "Request must be an object", 2)
	var request_id: Variant = request.get("request_id")
	if not (request_id is String) or request_id.strip_edges().is_empty():
		return failure("", "invalid_request", "request_id must be non-empty text", 2)
	var version: Variant = request.get("protocol_version")
	if not (version is int or version is float) or version != PROTOCOL_VERSION:
		return failure(request_id, "unsupported_version", "protocol_version must be 1", 2)
	var operation: Variant = request.get("operation")
	if not (operation is String) or operation not in ["validate_stage", "apply_action", "analyze_stage", "translate_arrow", "reshape_arrow", "editor_placement"]:
		return failure(request_id, "unsupported_operation", "Unsupported operation", 2)
	if not request.has("stage"):
		return failure(request_id, "invalid_request", "stage is required", 2)
	if operation in ["apply_action", "translate_arrow", "reshape_arrow"] and (
		not (request.get("arrow_id") is String) or request["arrow_id"].strip_edges().is_empty()
	):
		return failure(request_id, "invalid_request", "arrow_id must be non-empty text", 2)
	var contract: Variant = request.get("stage_contract", "runtime_v1")
	if not (contract is String) or contract not in ["runtime_v1", "authoring_v1"]:
		return failure(request_id, "invalid_request", "Unsupported stage_contract", 2)
	var minimum_arrow_length: int = STAGE_VALIDATOR.AUTHORING_MIN_ARROW_LENGTH if contract == "authoring_v1" else STAGE_VALIDATOR.MIN_ARROW_LENGTH
	var offset := Vector2i.ZERO
	if operation == "reshape_arrow" and (not (request.get("cells") is Array) or request["cells"].is_empty() or request["cells"].size() > 10000):
		return failure(request_id, "invalid_request", "cells must contain 1..10000 coordinate pairs", 2)
	if operation == "translate_arrow":
		var raw_offset: Variant = request.get("offset")
		if not (raw_offset is Array) or raw_offset.size() != 2:
			return failure(request_id, "invalid_request", "offset must be [dx, dy]", 2)
		for value: Variant in raw_offset:
			if not (value is int or value is float) or not is_finite(float(value)) or absf(float(value)) > 999 or value != int(value):
				return failure(request_id, "invalid_request", "offset must contain integers within -999..999", 2)
		offset = Vector2i(int(raw_offset[0]), int(raw_offset[1]))

	var decoded := CODEC.decode_stage(request["stage"])
	var errors: PackedStringArray = decoded["errors"]
	var stage: Dictionary = decoded["stage"]
	if errors.is_empty():
		var validation: Dictionary = STAGE_VALIDATOR.validate_stage(stage, minimum_arrow_length)
		errors = validation["errors"]
		if operation == "editor_placement" and stage["arrows"].is_empty():
			errors.erase("At least one arrow is required")
	var response := {
		"protocol_version": PROTOCOL_VERSION,
		"request_id": request_id,
		"ok": true,
		"validation": {"valid": errors.is_empty(), "errors": errors},
	}
	if not errors.is_empty() or operation == "validate_stage":
		return _success(response)
	if operation == "editor_placement":
		var options: Variant = request.get("placement")
		if not (options is Dictionary) or not (options.get("cells") is Array):
			return failure(request_id, "invalid_request", "placement cells are required", 2)
		var cells: Array = []
		for cell: Variant in options["cells"]:
			if not (cell is Array) or cell.size() != 2 or not (cell[0] is int or cell[0] is float) or not (cell[1] is int or cell[1] is float) or cell[0] != int(cell[0]) or cell[1] != int(cell[1]):
				return failure(request_id, "invalid_request", "Invalid placement cell", 2)
			cells.append(Vector2i(int(cell[0]), int(cell[1])))
		for field: String in ["stage1", "fill", "min_length", "max_length", "seed"]:
			if not (options.get(field) is int or options.get(field) is float) or not is_finite(float(options[field])):
				return failure(request_id, "invalid_request", "Invalid placement option: " + field, 2)
		var generated := EDITOR_PLACEMENT.generate(stage, cells, float(options["stage1"]), float(options["fill"]), int(options["min_length"]), int(options["max_length"]), int(options["seed"]), options.get("settings", {}))
		var retries := 0
		while generated.get("error", "") == "" and (not generated.get("deviations", []).is_empty() or generated.get("primary_added", 0) != generated.get("primary_target", 0) or generated.get("filler_added", 0) != generated.get("filler_target", 0)) and retries < 7:
			retries += 1
			print("Placement retry %d: %s" % [retries, str(generated.get("deviations", []))])
			var candidate := EDITOR_PLACEMENT.generate(stage, cells, float(options["stage1"]), float(options["fill"]), int(options["min_length"]), int(options["max_length"]), int(options["seed"]) + retries, options.get("settings", {}))
			if candidate.get("error", "") == "" and candidate.get("deviations", []).size() <= generated.get("deviations", []).size():
				generated = candidate
		generated["attempts"] = retries + 1
		response["placement"] = generated
		return _success(response)
	if operation == "translate_arrow":
		response["edit"] = _translate_arrow(stage, request["arrow_id"], offset, minimum_arrow_length)
		return _success(response)
	if operation == "reshape_arrow":
		response["edit"] = ARROW_EDIT.reshape(stage, request["arrow_id"], request["cells"], minimum_arrow_length)
		return _success(response)
	if operation == "analyze_stage":
		var analysis := ANALYZER.analyze(stage["arrows"], stage["grid_size"])
		if not analysis["error"].is_empty():
			return failure(request_id, "analysis_error", analysis["error"], 1)
		var available := PackedStringArray()
		for arrow: Dictionary in stage["arrows"]:
			if analysis["blockers_by_arrow"][arrow["id"]].is_empty():
				available.append(arrow["id"])
		analysis["available_arrow_ids"] = available
		analysis["solution_status"] = "solved" if analysis["has_complete_solution"] else "unsolvable"
		analysis["path_scope"] = "single_deterministic_path"
		response["analysis"] = analysis
		return _success(response)

	var board := BOARD_STATE.new()
	if board.load_stage_definition(stage)["event"] != "stage_loaded":
		return failure(request_id, "internal_error", "Validated stage could not be loaded", 1)
	var selection: Dictionary = board.select_arrow(request["arrow_id"])
	var event: String = selection["event"]
	if event == "extraction_requested":
		event = board.complete_extraction()["event"]
	response["action"] = {
		"event": event,
		"selection_event": selection["event"],
		"path_result": selection["path_result"],
		"state": board.get_state(),
		"stage": CODEC.encode_stage({
			"id": board.active_stage_id,
			"grid_size": board.grid_size,
			"blocked_cells": board.blocked_cells,
			"arrows": board.remaining_arrows,
		}),
	}
	return _success(response)


static func _translate_arrow(stage: Dictionary, arrow_id: String, offset: Vector2i, minimum_arrow_length: int) -> Dictionary:
	var index := -1
	for i: int in stage["arrows"].size():
		if stage["arrows"][i]["id"] == arrow_id:
			index = i
			break
	if index < 0:
		return {"accepted": false, "event": "arrow_not_found", "errors": ["Arrow not found"], "stage": CODEC.encode_stage(stage)}
	var original: Dictionary = stage["arrows"][index]
	var moved := stage.duplicate(true)
	var applied := Vector2i.ZERO
	# Sweep one cardinal cell at a time, using the same validator as final placement.
	# A drag cannot jump through an occupied or forbidden cell to a clear endpoint.
	while applied != offset:
		var remaining := offset - applied
		if absi(remaining.x) >= absi(remaining.y):
			applied.x += signi(remaining.x)
		else:
			applied.y += signi(remaining.y)
		var arrow: Dictionary = moved["arrows"][index]
		arrow["head_cell"] = original["head_cell"] + applied
		var cells: Array = []
		for cell: Vector2i in original["cells"]:
			cells.append(cell + applied)
		arrow["cells"] = cells
		var validation: Dictionary = STAGE_VALIDATOR.validate_stage(moved, minimum_arrow_length)
		if not validation["is_valid"]:
			return {"accepted": false, "event": "translation_blocked", "errors": validation["errors"], "stage": CODEC.encode_stage(stage)}
	return {"accepted": true, "event": "arrow_translated", "errors": [], "stage": CODEC.encode_stage(moved)}


static func failure(request_id: String, code: String, message: String, exit_code: int) -> Dictionary:
	return {
		"exit_code": exit_code,
		"response": {
			"protocol_version": PROTOCOL_VERSION,
			"request_id": request_id,
			"ok": false,
			"error": {"code": code, "message": message},
		},
	}


static func _success(response: Dictionary) -> Dictionary:
	return {"exit_code": 0, "response": CODEC.to_json_value(response)}
