extends SceneTree

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const GENERATION_QUALITY := preload("res://scripts/generation_quality.gd")

var _failures := PackedStringArray()


func _init() -> void:
	var snapshot_result := STAGE_CATALOG.reload_snapshot()
	_expect(snapshot_result["is_valid"], "Balance snapshot loads")
	if snapshot_result["is_valid"]:
		_test_temporary_stage_profile_tuning()
	_finish()


func _test_temporary_stage_profile_tuning() -> void:
	var baseline_profile := STAGE_CATALOG.get_stage_profile("STAGE-007")
	var baseline := STAGE_CATALOG.build_stage_from_profile(
		baseline_profile,
		baseline_profile["seed"],
		STAGE_CATALOG.get_snapshot_metadata()
	)
	_expect(not baseline.is_empty(), "Baseline STAGE-007 generates")
	if baseline.is_empty():
		return

	var tuned_profile := baseline_profile.duplicate(true)
	tuned_profile["target_empty_ratio"] = 0.50
	tuned_profile["filler_max_length"] = 8
	var tuned_shape: Dictionary = tuned_profile["shape_target"]
	tuned_shape["min_center_occupancy_ratio_from_global"] = 0.65
	tuned_shape["min_bin_occupancy_ratio_from_global"] = 0.50
	tuned_shape["min_long_cell_ratio"] = 0.50
	tuned_shape["min_bent_arrow_ratio"] = 0.35
	tuned_shape["min_complex_arrow_ratio"] = 0.15

	var tuned := STAGE_CATALOG.build_stage_from_profile(
		tuned_profile,
		tuned_profile["seed"],
		STAGE_CATALOG.get_snapshot_metadata()
	)
	_expect(not tuned.is_empty(), "Temporarily tuned STAGE-007 generates")
	if tuned.is_empty():
		return

	var baseline_metrics: Dictionary = baseline["generation_metrics"]
	var tuned_metrics: Dictionary = tuned["generation_metrics"]
	_expect(
		absf(float(baseline_metrics["actual_empty_ratio"]) - 0.40) <= 0.01,
		"Baseline empty ratio follows JSON"
	)
	_expect(
		absf(float(tuned_metrics["actual_empty_ratio"]) - 0.50) <= 0.01,
		"Temporary empty ratio change reaches the generated board"
	)
	_expect(
		baseline["arrows"] != tuned["arrows"],
		"Temporary balance values change the generated layout"
	)
	for arrow_index: int in range(tuned_profile["primary_arrow_count"], tuned["arrows"].size()):
		_expect(
			tuned["arrows"][arrow_index]["cells"].size() <= tuned_profile["filler_max_length"],
			"Temporary filler length limit is enforced"
		)
	var measured: Dictionary = GENERATION_QUALITY.measure(
		tuned["arrows"], tuned["grid_size"], tuned["blocked_cells"], tuned_shape
	)
	_expect(measured["matches_target"], "Temporary shape targets are enforced")
	print(
		"STAGE-007 tuning baseline_empty=%.2f tuned_empty=%.2f baseline_arrows=%d tuned_arrows=%d long=%.3f bent=%.3f complex=%.3f"
		% [
			baseline_metrics["actual_empty_ratio"],
			tuned_metrics["actual_empty_ratio"],
			baseline["arrows"].size(),
			tuned["arrows"].size(),
			measured["long_cell_ratio"],
			measured["bent_arrow_ratio"],
			measured["complex_arrow_ratio"],
		]
	)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Shape balance tuning tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
