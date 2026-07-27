extends SceneTree

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_stage_definitions()
	_test_invalid_definitions()
	_finish()


func _test_stage_definitions() -> void:
	for stage_id: String in STAGE_CATALOG.STAGE_IDS:
		var stage_definition: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		_expect(not stage_definition.is_empty(), "%s loads" % stage_id)
		if stage_definition.is_empty():
			continue
		_expect(stage_definition.get("grid_size") == Vector2i(9, 9), "%s uses a 9x9 grid" % stage_id)
		var profile: Dictionary = stage_definition["generation_profile"]
		var metrics: Dictionary = stage_definition["generation_metrics"]
		var dependency_analysis: Dictionary = stage_definition["dependency_analysis"]
		var dependency_target: Dictionary = stage_definition["dependency_target"]
		var targeting_metrics: Dictionary = stage_definition["dependency_targeting_metrics"]
		_expect(
			stage_definition["arrows"].size() >= profile["primary_arrow_count"],
			"%s includes every primary arrow" % stage_id
		)
		_expect(
			absf(metrics["actual_empty_ratio"] - profile["target_empty_ratio"]) <= 1.0 / 81.0,
			"%s reaches its target empty ratio" % stage_id
		)
		for arrow_data: Dictionary in stage_definition["arrows"]:
			if arrow_data["placement_role"] == "primary":
				_expect(
					arrow_data["cells"].size() >= profile["min_length"] \
							and arrow_data["cells"].size() <= profile["max_length"],
					"%s primary arrows use the stage length level" % stage_id
				)
			else:
				_expect(
					arrow_data["cells"].size() <= profile["filler_max_length"],
					"%s filler arrows stay within the short length limit" % stage_id
				)
		var validation := STAGE_CATALOG.validate_stage(stage_definition)
		_expect(validation["is_valid"], "%s validates" % stage_id)
		_expect(
			stage_definition["solution_order"].size() == stage_definition["arrows"].size(),
			"%s has a full solution" % stage_id
		)
		_expect(
			dependency_analysis["node_count"] == stage_definition["arrows"].size(),
			"%s dependency analysis includes every arrow" % stage_id
		)
		_expect(
			dependency_analysis["has_complete_solution"],
			"%s dependency analysis confirms a full solution" % stage_id
		)
		_expect(
			dependency_analysis["dependency_depth"] >= dependency_target["min_dependency_depth"] \
				and dependency_analysis["dependency_depth"] <= dependency_target["max_dependency_depth"],
			"%s dependency depth is within its target" % stage_id
		)
		_expect(
			dependency_analysis["initial_extractable_ratio"] \
					>= dependency_target["min_initial_extractable_ratio"] \
				and dependency_analysis["initial_extractable_ratio"] \
					<= dependency_target["max_initial_extractable_ratio"],
			"%s initial extractable ratio is within its target" % stage_id
		)
		_expect(
			dependency_analysis["forced_state_ratio"] >= dependency_target["min_forced_state_ratio"] \
				and dependency_analysis["forced_state_ratio"] <= dependency_target["max_forced_state_ratio"],
			"%s forced-state ratio is within its target" % stage_id
		)
		_expect(
			targeting_metrics["has_selected_candidate"],
			"%s exposes a selected dependency candidate" % stage_id
		)


func _test_invalid_definitions() -> void:
	var duplicate_body_cell := {
		"id": "INVALID-DUPLICATE-BODY-CELL",
		"grid_size": Vector2i(9, 9),
		"arrows": [
			{
				"id": "A",
				"head_cell": Vector2i(2, 2),
				"cells": [Vector2i(2, 2), Vector2i(2, 3), Vector2i(2, 2)],
				"direction": "UP",
			},
		],
	}
	_expect(not STAGE_CATALOG.validate_stage(duplicate_body_cell)["is_valid"], "Duplicate body cells are rejected")

	var disconnected_body := {
		"id": "INVALID-DISCONNECTED-BODY",
		"grid_size": Vector2i(9, 9),
		"arrows": [
			{
				"id": "A",
				"head_cell": Vector2i(2, 2),
				"cells": [Vector2i(2, 2), Vector2i(4, 2)],
				"direction": "RIGHT",
			},
		],
	}
	_expect(not STAGE_CATALOG.validate_stage(disconnected_body)["is_valid"], "Disconnected body cells are rejected")

	var overlapping_bodies := {
		"id": "INVALID-OVERLAP",
		"grid_size": Vector2i(9, 9),
		"arrows": [
			{
				"id": "A",
				"head_cell": Vector2i(2, 2),
				"cells": [Vector2i(2, 2), Vector2i(3, 2)],
				"direction": "LEFT",
			},
			{
				"id": "B",
				"head_cell": Vector2i(3, 2),
				"cells": [Vector2i(3, 2)],
				"direction": "RIGHT",
			},
		],
	}
	_expect(not STAGE_CATALOG.validate_stage(overlapping_bodies)["is_valid"], "Overlapping arrow bodies are rejected")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Stage catalog tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
