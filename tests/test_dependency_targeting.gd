extends SceneTree

const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_inclusive_target_boundaries()
	_test_complete_solution_hard_gate()
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
	var forced_reference_only := maximum_analysis.duplicate(true)
	forced_reference_only["forced_state_ratio"] = 0.0
	_expect(
		DEPENDENCY_TARGETING.matches_target(forced_reference_only, target),
		"Forced-state ratio is observed without rejecting the candidate"
	)


func _test_complete_solution_hard_gate() -> void:
	var generation := {
		"arrows": [{"id": "A"}, {"id": "B"}],
		"solution_order": PackedStringArray(["A"]),
	}
	var analysis := {
		"has_complete_solution": true,
		"solution_order": PackedStringArray(["A", "B"]),
	}
	_expect(
		not DEPENDENCY_TARGETING._has_complete_solution(generation, analysis),
		"Incomplete generator solution order is never a valid candidate"
	)
	generation["solution_order"] = PackedStringArray(["A", "B"])
	analysis["has_complete_solution"] = false
	_expect(
		not DEPENDENCY_TARGETING._has_complete_solution(generation, analysis),
		"Deadlocked analysis is never a valid candidate"
	)
func _test_deterministic_selection() -> void:
	var config: Dictionary = STAGE_CATALOG.get_stage_profile("STAGE-002")
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
			+ metrics["selected_candidate_index"] * DEPENDENCY_TARGETING.CANDIDATE_SEED_STEP,
		"Selected seed follows the candidate index contract"
	)


func _test_invalid_and_unreachable_targets() -> void:
	var config: Dictionary = STAGE_CATALOG.get_stage_profile("STAGE-001")
	var invalid_target: Dictionary = config["dependency_target"].duplicate(true)
	invalid_target["min_initial_extractable_ratio"] = 1.1
	var invalid: Dictionary = DEPENDENCY_TARGETING.select(
		config["seed"],
		config["grid_size"],
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
		config["grid_size"],
		config["primary_arrow_count"],
		config["min_length"],
		config["max_length"],
		config["target_empty_ratio"],
		config["filler_max_length"],
		unreachable_target,
		3
	)
	_expect(unreachable["error"].is_empty(), "Unreachable difficulty target keeps a valid board")
	_expect(
		unreachable["dependency_targeting_metrics"]["attempt_count"] == 3,
		"Unreachable target checks exactly the candidate limit"
	)
	_expect(
		unreachable["dependency_targeting_metrics"]["has_selected_candidate"] \
			and unreachable["dependency_targeting_metrics"]["fallback_used"] \
			and not unreachable["dependency_targeting_metrics"]["target_match"],
		"Unreachable target exposes the closest valid fallback"
	)
	_expect(
		unreachable["solution_order"].size() == unreachable["arrows"].size() \
			and unreachable["dependency_analysis"]["has_complete_solution"],
		"Closest fallback remains completely solvable"
	)


func _test_stage_targets() -> void:
	for stage_id: String in STAGE_CATALOG.get_stage_ids():
		var stage: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		var analysis: Dictionary = stage["dependency_analysis"]
		var target: Dictionary = stage["dependency_target"]
		var targeting_metrics: Dictionary = stage["dependency_targeting_metrics"]

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
		_expect(
			stage["solution_order"].size() == stage["arrows"].size(),
			"%s selected candidate exposes a full solution order" % stage_id
		)
		_expect(
			targeting_metrics["target_score"].has("target_distance"),
			"%s exposes its soft-target score" % stage_id
		)


func _select_with_config(config: Dictionary) -> Dictionary:
	return DEPENDENCY_TARGETING.select(
		config["seed"],
		config["grid_size"],
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
