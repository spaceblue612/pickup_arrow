extends SceneTree

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")

const CASE_IDS := ["STAGE-007", "STAGE-008", "STAGE-009", "STAGE-010"]
const MAX_GENERATION_MSEC := 10000

var _failures := PackedStringArray()


func _init() -> void:
	var snapshot_result := STAGE_CATALOG.reload_snapshot()
	_expect(snapshot_result["is_valid"], "Balance snapshot loads")
	if snapshot_result["is_valid"]:
		for stage_id: String in CASE_IDS:
			_test_large_stage(stage_id)
	_finish()


func _test_large_stage(stage_id: String) -> void:
	var profile: Dictionary = STAGE_CATALOG.get_stage_profile(stage_id)
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
		first["dependency_targeting_metrics"]["attempt_count"] == 1,
		"%s accepts its first constructed candidate" % stage_id
	)
	_expect(
		STAGE_CATALOG.validate_stage(first)["is_valid"],
		"%s validates through StageCatalog" % stage_id
	)
	print(
		"%s first=%dms second=%dms arrows=%d depth=%d initial=%.4f"
		% [
			stage_id,
			first_elapsed_msec,
			second_elapsed_msec,
			first["arrows"].size(),
			first["dependency_analysis"]["dependency_depth"],
			first["dependency_analysis"]["initial_extractable_ratio"],
		]
	)


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
