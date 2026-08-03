extends SceneTree

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_balance_snapshot()
	_test_dynamic_snapshot_stage_registration()
	_test_stage_definitions()
	_test_invalid_definitions()
	_finish()



func _test_balance_snapshot() -> void:
	var result := STAGE_CATALOG.reload_snapshot()
	_expect(result["is_valid"], "Committed balance snapshot validates")
	_expect(STAGE_CATALOG.get_stage_ids() == PackedStringArray(["STAGE-001", "STAGE-002", "STAGE-003", "STAGE-004"]), "Snapshot order owns stage progression")
	_expect(STAGE_CATALOG.get_snapshot_metadata()["content_hash"].length() == 64, "Snapshot exposes its content hash")
	var profile := STAGE_CATALOG.get_stage_profile("STAGE-002")
	_expect(profile["seed"] == 2002, "Stage profile values load from the snapshot")
	profile["seed"] = 1
	_expect(STAGE_CATALOG.get_stage_profile("STAGE-002")["seed"] == 2002, "Returned profiles cannot mutate the catalog")
	var failed_reload := STAGE_CATALOG.reload_snapshot("/tmp/pickup-arrow-missing-snapshot.json")
	_expect(not failed_reload["is_valid"], "A failed reload reports an error")
	_expect(STAGE_CATALOG.get_stage_ids() == PackedStringArray(["STAGE-001", "STAGE-002", "STAGE-003", "STAGE-004"]), "A failed reload preserves the last-known-good catalog")


func _test_dynamic_snapshot_stage_registration() -> void:
	var source := FileAccess.open(STAGE_CATALOG.SNAPSHOT_PATH, FileAccess.READ)
	var snapshot: Dictionary = JSON.parse_string(source.get_as_text())
	var new_profile: Dictionary = snapshot["profiles"][0].duplicate(true)
	new_profile["stage_id"] = "STAGE-005"
	new_profile["stage_order"] = 5
	new_profile["expected_difficulty_level"] = 42
	snapshot["profiles"].append(new_profile)
	snapshot["source_revision"] = "fixture-new-row"
	snapshot["content_hash"] = STAGE_CATALOG._content_hash(snapshot["schema_version"], snapshot["profiles"])
	var fixture_path := "/tmp/pickup-arrow-stage-balance-fixture.json"
	var fixture := FileAccess.open(fixture_path, FileAccess.WRITE)
	fixture.store_string(JSON.stringify(snapshot))
	fixture.close()
	var result := STAGE_CATALOG.reload_snapshot(fixture_path)
	_expect(result["is_valid"], "A normalized snapshot with a new row validates")
	_expect(STAGE_CATALOG.get_stage_ids()[-1] == "STAGE-005", "A new profile extends dynamic progression")
	var generated := STAGE_CATALOG.get_stage("STAGE-005")
	_expect(not generated.is_empty(), "A new profile creates a generated stage")
	_expect(
		generated["grid_size"] == Vector2i(new_profile["grid_size"][0], new_profile["grid_size"][1]),
		"A new profile uses its configured full rectangular board"
	)
	_expect(generated["expected_difficulty_level"] == 42, "A new profile exposes its expected difficulty")
	DirAccess.remove_absolute(fixture_path)
	_expect(STAGE_CATALOG.reload_snapshot()["is_valid"], "Catalog returns to the committed snapshot after fixture validation")


func _test_stage_definitions() -> void:
	for stage_id: String in STAGE_CATALOG.get_stage_ids():
		var stage_definition: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		_expect(not stage_definition.is_empty(), "%s loads" % stage_id)
		if stage_definition.is_empty():
			continue
		var profile: Dictionary = stage_definition["generation_profile"]
		var expected_grid_size := Vector2i(profile["grid_size"][0], profile["grid_size"][1])
		_expect(
			stage_definition.get("grid_size") == expected_grid_size,
			"%s uses its configured grid" % stage_id
		)
		var metrics: Dictionary = stage_definition["generation_metrics"]
		var dependency_analysis: Dictionary = stage_definition["dependency_analysis"]
		var dependency_target: Dictionary = stage_definition["dependency_target"]
		var targeting_metrics: Dictionary = stage_definition["dependency_targeting_metrics"]
		_expect(stage_definition["stage_order"] == profile["stage_order"], "%s exposes its snapshot order" % stage_id)
		_expect(stage_definition["expected_difficulty_level"] == null, "%s remains uncalibrated" % stage_id)
		_expect(
			stage_definition["arrows"].size() >= profile["primary_arrow_count"],
			"%s includes every primary arrow" % stage_id
		)
		_expect(
			absf(metrics["actual_empty_ratio"] - profile["target_empty_ratio"]) \
					<= 1.0 / float(expected_grid_size.x * expected_grid_size.y),
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
			targeting_metrics["target_match"] \
				== DEPENDENCY_TARGETING.matches_target(dependency_analysis, dependency_target),
			"%s target-match status reflects depth and initial-choice targets" % stage_id
		)
		_expect(
			dependency_analysis["forced_state_ratio"] >= 0.0 \
				and dependency_analysis["forced_state_ratio"] <= 1.0,
			"%s forced-state ratio remains an observed metric" % stage_id
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
