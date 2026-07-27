extends SceneTree

const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_inclusive_target_boundaries()
	_test_deterministic_selection()
	_test_invalid_and_unreachable_targets()
	_test_stage_targets()
	_finish()


func _test_inclusive_target_boundaries() -> void:
	var target := _target(3, 5, 0.30, 0.60, 0.10, 0.40)
	var minimum_analysis := {
		"dependency_depth": 3,
		"initial_extractable_ratio": 0.30,
		"forced_state_ratio": 0.10,
	}
	var maximum_analysis := {
		"dependency_depth": 5,
		"initial_extractable_ratio": 0.60,
		"forced_state_ratio": 0.40,
	}
	_expect(
		DEPENDENCY_TARGETING.matches_target(minimum_analysis, target),
		"Minimum target bounds are inclusive"
	)
	_expect(
		DEPENDENCY_TARGETING.matches_target(maximum_analysis, target),
		"Maximum target bounds are inclusive"
	)


func _test_deterministic_selection() -> void:
	var config: Dictionary = STAGE_CATALOG.STAGE_CONFIGS["STAGE-002"]
	var first: Dictionary = _select_with_config(config)
	var second: Dictionary = _select_with_config(config)

	_expect(first["error"].is_empty(), "Targeted selection succeeds")
	_expect(first["arrows"] == second["arrows"], "Targeted arrows are deterministic")
	_expect(
		first["dependency_analysis"] == second["dependency_analysis"],
		"Targeted analysis is deterministic"
	)
	_expect(
		first["dependency_targeting_metrics"] == second["dependency_targeting_metrics"],
		"Targeting metrics are deterministic"
	)
	var metrics: Dictionary = first["dependency_targeting_metrics"]
	_expect(metrics["has_selected_candidate"], "Targeting metrics mark a selected candidate")
	_expect(
		metrics["selected_seed"] == config["seed"] \
			+ (metrics["attempt_count"] - 1) * DEPENDENCY_TARGETING.CANDIDATE_SEED_STEP,
		"Selected seed follows the candidate index contract"
	)


func _test_invalid_and_unreachable_targets() -> void:
	var config: Dictionary = STAGE_CATALOG.STAGE_CONFIGS["STAGE-001"]
	var invalid_target: Dictionary = config["dependency_target"].duplicate(true)
	invalid_target["min_initial_extractable_ratio"] = 1.1
	var invalid: Dictionary = DEPENDENCY_TARGETING.select(
		config["seed"],
		STAGE_CATALOG.GRID_SIZE,
		config["primary_arrow_count"],
		config["min_length"],
		config["max_length"],
		config["target_empty_ratio"],
		config["filler_max_length"],
		invalid_target,
		3
	)
	_expect(not invalid["error"].is_empty(), "Invalid target is rejected")
	_expect(
		invalid["dependency_targeting_metrics"]["attempt_count"] == 0,
		"Invalid target fails before candidate generation"
	)

	var unreachable_target := _target(81, 81, 0.0, 1.0, 0.0, 1.0)
	var unreachable: Dictionary = DEPENDENCY_TARGETING.select(
		config["seed"],
		STAGE_CATALOG.GRID_SIZE,
		config["primary_arrow_count"],
		config["min_length"],
		config["max_length"],
		config["target_empty_ratio"],
		config["filler_max_length"],
		unreachable_target,
		3
	)
	_expect(not unreachable["error"].is_empty(), "Unreachable target returns an error")
	_expect(
		unreachable["dependency_targeting_metrics"]["attempt_count"] == 3,
		"Unreachable target checks exactly the candidate limit"
	)
	_expect(
		not unreachable["dependency_targeting_metrics"]["has_selected_candidate"],
		"Unreachable target does not expose an out-of-range candidate"
	)


func _test_stage_targets() -> void:
	for stage_id: String in STAGE_CATALOG.STAGE_IDS:
		var stage: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		var analysis: Dictionary = stage["dependency_analysis"]
		var target: Dictionary = stage["dependency_target"]
		var targeting_metrics: Dictionary = stage["dependency_targeting_metrics"]

		_expect(
			DEPENDENCY_TARGETING.matches_target(analysis, target),
			"%s satisfies every dependency target" % stage_id
		)
		_expect(
			targeting_metrics["dependency_target"] == target,
			"%s exposes the applied dependency target" % stage_id
		)
		_expect(
			targeting_metrics["attempt_count"] >= 1 \
				and targeting_metrics["attempt_count"] <= targeting_metrics["max_candidate_attempts"],
			"%s selects a candidate within the attempt limit" % stage_id
		)
		_expect(
			analysis["has_complete_solution"],
			"%s targeted candidate remains completely solvable" % stage_id
		)


func _select_with_config(config: Dictionary) -> Dictionary:
	return DEPENDENCY_TARGETING.select(
		config["seed"],
		STAGE_CATALOG.GRID_SIZE,
		config["primary_arrow_count"],
		config["min_length"],
		config["max_length"],
		config["target_empty_ratio"],
		config["filler_max_length"],
		config["dependency_target"],
		config["max_candidate_attempts"]
	)


func _target(
	min_depth: int,
	max_depth: int,
	min_initial: float,
	max_initial: float,
	min_forced: float,
	max_forced: float
) -> Dictionary:
	return {
		"min_dependency_depth": min_depth,
		"max_dependency_depth": max_depth,
		"min_initial_extractable_ratio": min_initial,
		"max_initial_extractable_ratio": max_initial,
		"min_forced_state_ratio": min_forced,
		"max_forced_state_ratio": max_forced,
	}


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Dependency targeting tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
