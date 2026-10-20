extends SceneTree

const VALIDATOR := preload("res://scripts/stage_validator.gd")
const CATALOG := preload("res://scripts/stage_catalog.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_malformed_stage_data()
	_test_generation_target_is_separate()
	_finish()


func _stage() -> Dictionary:
	return {
		"id": "STAGE-TEST",
		"grid_size": Vector2i(5, 5),
		"arrows": [{
			"id": "A", "head_cell": Vector2i(2, 2),
			"cells": [Vector2i(2, 2), Vector2i(1, 2)], "direction": "RIGHT",
		}],
	}


func _test_malformed_stage_data() -> void:
	_expect(VALIDATOR.validate_stage(_stage())["is_valid"], "Normal runtime stage validates")
	var invalid_stages: Array = [{}, {"id": "A"}, {"id": null, "grid_size": [], "arrows": []}]
	for bad_id: Variant in [null, 12, [], {}, "", "  "]:
		var stage := _stage()
		stage["id"] = bad_id
		invalid_stages.append(stage)
	for bad_cells: Variant in [
		null, 12, [], [null, Vector2i(1, 2)], [Vector2i(2, 2), "bad", Vector2i(1, 2)],
		[Vector2i(2, 2), Vector2i(2, 2)], [Vector2i(2, 2), Vector2i(4, 2)],
	]:
		var stage := _stage()
		stage["arrows"][0]["cells"] = bad_cells
		invalid_stages.append(stage)
	for field: String in ["head_cell", "direction", "id"]:
		for bad_value: Variant in [null, [], {}, 42]:
			var stage := _stage()
			stage["arrows"][0][field] = bad_value
			invalid_stages.append(stage)
	var outside := _stage()
	outside["arrows"][0]["cells"][1] = Vector2i(0, 2)
	invalid_stages.append(outside)
	var malformed_arrow := _stage()
	malformed_arrow["arrows"][0] = {"id": [], "head_cell": null, "cells": [null], "direction": []}
	invalid_stages.append(malformed_arrow)
	var overlap := _stage()
	overlap["arrows"].append(overlap["arrows"][0].duplicate(true))
	invalid_stages.append(overlap)
	var masked := _stage()
	masked["blocked_cells"] = [Vector2i(2, 2)]
	invalid_stages.append(masked)
	var duplicate_mask := _stage()
	duplicate_mask["blocked_cells"] = [Vector2i(5, 5), Vector2i(5, 5)]
	invalid_stages.append(duplicate_mask)
	for stage: Dictionary in invalid_stages:
		_expect(not VALIDATOR.validate_stage(stage)["is_valid"], "Malformed data returns validation errors")
		_expect(not CATALOG.validate_stage(stage)["is_valid"], "Compatibility validation safely rejects malformed data")


func _test_generation_target_is_separate() -> void:
	var stage := _stage()
	var profile: Dictionary = CATALOG.get_stage_profile("STAGE-001")
	var shape: Dictionary = profile["shape_target"]
	shape["min_direction_count"] = 4
	stage["generation_profile"] = profile
	_expect(VALIDATOR.validate_stage(stage)["is_valid"], "Runtime validity ignores generation targets")
	_expect(not CATALOG.validate_stage(stage)["is_valid"], "Catalog compatibility still enforces shape targets")
	var board := BOARD_STATE.new()
	_expect(board.load_stage_definition(stage)["event"] == "stage_loaded", "Playable data can load despite an unmet generation target")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Stage validator tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
