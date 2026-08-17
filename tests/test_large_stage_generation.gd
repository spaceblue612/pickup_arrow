extends SceneTree

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")
const GENERATION_QUALITY := preload("res://scripts/generation_quality.gd")

const CASE_IDS := ["STAGE-007", "STAGE-008", "STAGE-009", "STAGE-010"]
const MAX_GENERATION_MSEC := 10000
const ACCEPTANCE_PATH := "res://tests/requirements/map_generation_acceptance.json"

var _failures := PackedStringArray()


func _init() -> void:
	_test_acceptance_contract()
	var snapshot_result := STAGE_CATALOG.reload_snapshot()
	_expect(snapshot_result["is_valid"], "Balance snapshot loads")
	if snapshot_result["is_valid"]:
		var case_ids := CASE_IDS
		var selected_stage := OS.get_environment("PICKUP_ARROW_TEST_STAGE")
		if not selected_stage.is_empty():
			case_ids = [selected_stage]
		for stage_id: String in case_ids:
			_test_large_stage(stage_id)
	_finish()


func _test_acceptance_contract() -> void:
	var file := FileAccess.open(ACCEPTANCE_PATH, FileAccess.READ)
	_expect(file != null, "Map generation acceptance contract exists")
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	_expect(parsed is Dictionary, "Map generation acceptance contract is valid JSON")
	if not (parsed is Dictionary):
		return
	_expect(parsed.get("schema_version") == 1, "Map generation acceptance schema is supported")
	_expect(parsed.get("default_scope") == CASE_IDS, "Map generation acceptance scope stays explicit")
	var requirement_ids: Dictionary = {}
	for requirement: Variant in parsed.get("requirements", []):
		if requirement is Dictionary and requirement.get("id") is String:
			requirement_ids[requirement["id"]] = true
	for required_id: String in [
		"MG-FUNC-001", "MG-FUNC-002", "MG-FUNC-003", "MG-DIFF-001",
		"MG-SEED-001", "MG-MODE-001", "MG-MODE-002", "MG-SPACE-001",
		"MG-SPACE-002", "MG-LENGTH-001", "MG-SHAPE-001", "MG-SHAPE-002",
		"MG-SHAPE-003", "MG-PERF-001", "MG-VISUAL-001",
	]:
		_expect(requirement_ids.has(required_id), "Acceptance contract requires %s" % required_id)


func _test_large_stage(stage_id: String) -> void:
	var profile: Dictionary = STAGE_CATALOG.get_stage_profile(stage_id)
	var attempt_override := OS.get_environment("PICKUP_ARROW_TEST_ATTEMPTS")
	if attempt_override.is_valid_int():
		profile["max_candidate_attempts"] = int(attempt_override)
	var first_started_msec := Time.get_ticks_msec()
	var first: Dictionary = STAGE_CATALOG.build_stage_from_profile(
		profile,
		profile["seed"],
		STAGE_CATALOG.get_snapshot_metadata()
	)
	var first_elapsed_msec := Time.get_ticks_msec() - first_started_msec
	_expect(not first.is_empty(), "%s generation succeeds" % stage_id)
	_expect(
		first_elapsed_msec < MAX_GENERATION_MSEC,
		"%s generates within 10 seconds" % stage_id
	)
	if first.is_empty():
		return

	var second_started_msec := Time.get_ticks_msec()
	var second: Dictionary = STAGE_CATALOG.build_stage_from_profile(
		profile,
		profile["seed"],
		STAGE_CATALOG.get_snapshot_metadata()
	)
	var second_elapsed_msec := Time.get_ticks_msec() - second_started_msec
	_expect(first["arrows"] == second.get("arrows", []), "%s remains deterministic" % stage_id)
	_expect(
		first["solution_order"] == second.get("solution_order", PackedStringArray()),
		"%s keeps a deterministic solution" % stage_id
	)
	_expect(
		DEPENDENCY_TARGETING.matches_target(
			first["dependency_analysis"],
			profile["dependency_target"]
		),
		"%s satisfies dependency targets" % stage_id
	)
	_expect(
		first["dependency_targeting_metrics"]["attempt_count"] \
				<= profile["max_candidate_attempts"],
		"%s stays within its configured candidate budget" % stage_id
	)
	_expect(
		STAGE_CATALOG.validate_stage(first)["is_valid"],
		"%s validates through StageCatalog" % stage_id
	)
	var shape_metrics: Dictionary = GENERATION_QUALITY.measure(
		first["arrows"], first["grid_size"], first["blocked_cells"], profile["shape_target"]
	)
	_expect(
		shape_metrics["matches_target"],
		"%s satisfies every configured shape target: %s" % [stage_id, shape_metrics["violations"]]
	)
	_expect(
		_strip_construction_count(first["arrows"]) == 0,
		"%s does not use exterior strip construction" % stage_id
	)
	_expect(
		shape_metrics["direction_count"] >= profile["shape_target"]["min_direction_count"],
		"%s keeps its configured direction count" % stage_id
	)
	print(
		"%s first=%dms second=%dms arrows=%d depth=%d initial=%.4f center=%.3f bin=%.3f long=%.3f bent=%.3f complex=%.3f"
		% [
			stage_id,
			first_elapsed_msec,
			second_elapsed_msec,
			first["arrows"].size(),
			first["dependency_analysis"]["dependency_depth"],
			first["dependency_analysis"]["initial_extractable_ratio"],
			shape_metrics["center_occupancy_ratio"],
			shape_metrics["minimum_bin_occupancy_ratio"],
			shape_metrics["long_cell_ratio"],
			shape_metrics["bent_arrow_ratio"],
			shape_metrics["complex_arrow_ratio"],
		]
	)


func _strip_construction_count(arrows: Array) -> int:
	var strip_construction_count := 0
	for arrow_data: Dictionary in arrows:
		if "strip" in str(arrow_data.get("construction_role", "")):
			strip_construction_count += 1
	return strip_construction_count


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Large stage generation tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
