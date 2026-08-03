class_name DependencyTargeting
extends RefCounted

const ARROW_PLACEMENT := preload("res://scripts/arrow_placement.gd")
const DEPENDENCY_ANALYZER := preload("res://scripts/dependency_analyzer.gd")

const CANDIDATE_SEED_STEP := 1000003
const REQUIRED_TARGET_FIELDS := [
	"min_dependency_depth",
	"max_dependency_depth",
	"min_initial_extractable_ratio",
	"max_initial_extractable_ratio",
	"min_forced_state_ratio",
	"max_forced_state_ratio",
]


static func select(
	base_seed: int,
	grid_size: Vector2i,
	arrow_count: int,
	min_length: int,
	max_length: int,
	target_empty_ratio: float,
	filler_max_length: int,
	dependency_target: Dictionary,
	max_candidate_attempts: int,
	blocked_cells: Array = []
) -> Dictionary:
	var target_error := _validate_dependency_target(dependency_target)
	if not target_error.is_empty():
		return _result(
			[],
			PackedStringArray(),
			{},
			{},
			_targeting_metrics(
				base_seed,
				0,
				0,
				max_candidate_attempts,
				dependency_target,
				false
			),
			target_error
		)
	if max_candidate_attempts <= 0:
		return _result(
			[],
			PackedStringArray(),
			{},
			{},
			_targeting_metrics(
				base_seed,
				0,
				0,
				max_candidate_attempts,
				dependency_target,
				false
			),
			"Maximum candidate attempts must be positive"
		)

	var best_candidate: Dictionary = {}
	var generation_failure_count := 0
	var analysis_failure_count := 0
	for candidate_index: int in max_candidate_attempts:
		var candidate_seed := base_seed + candidate_index * CANDIDATE_SEED_STEP
		var generation: Dictionary = ARROW_PLACEMENT.generate(
			candidate_seed,
			grid_size,
			arrow_count,
			min_length,
			max_length,
			target_empty_ratio,
			filler_max_length,
			blocked_cells,
			dependency_target["min_dependency_depth"]
		)
		if not generation["error"].is_empty():
			generation_failure_count += 1
			continue

		var dependency_analysis: Dictionary = DEPENDENCY_ANALYZER.analyze(
			generation["arrows"],
			grid_size
		)
		if not dependency_analysis["error"].is_empty():
			analysis_failure_count += 1
			continue
		if not _has_complete_solution(generation, dependency_analysis):
			analysis_failure_count += 1
			continue
		var score := target_score(dependency_analysis, dependency_target)
		var candidate := {
			"seed": candidate_seed,
			"index": candidate_index,
			"generation": generation,
			"analysis": dependency_analysis,
			"score": score,
		}
		if best_candidate.is_empty() or _score_is_better(score, best_candidate["score"]):
			best_candidate = candidate
		if matches_target(dependency_analysis, dependency_target):
			return _selected_result(
				base_seed, candidate, candidate_index + 1, max_candidate_attempts,
				dependency_target, false, generation_failure_count, analysis_failure_count
			)

	if not best_candidate.is_empty():
		return _selected_result(
			base_seed, best_candidate, max_candidate_attempts, max_candidate_attempts,
			dependency_target, true, generation_failure_count, analysis_failure_count
		)

	return _result(
		[],
		PackedStringArray(),
		{},
		{},
		_targeting_metrics(
			base_seed,
			0,
			max_candidate_attempts,
			max_candidate_attempts,
			dependency_target,
			false
		),
		"Could not generate a completely solvable board"
	)


static func matches_target(dependency_analysis: Dictionary, dependency_target: Dictionary) -> bool:
	if not _validate_dependency_target(dependency_target).is_empty():
		return false
	for field: String in ["dependency_depth", "initial_extractable_ratio"]:
		if not dependency_analysis.has(field):
			return false
	return dependency_analysis["dependency_depth"] \
			>= dependency_target["min_dependency_depth"] \
		and dependency_analysis["dependency_depth"] \
			<= dependency_target["max_dependency_depth"] \
		and dependency_analysis["initial_extractable_ratio"] \
			>= dependency_target["min_initial_extractable_ratio"] \
		and dependency_analysis["initial_extractable_ratio"] \
			<= dependency_target["max_initial_extractable_ratio"]


static func target_score(
	dependency_analysis: Dictionary,
	dependency_target: Dictionary
) -> Dictionary:
	var depth_distance := _range_distance(
		float(dependency_analysis["dependency_depth"]),
		float(dependency_target["min_dependency_depth"]),
		float(dependency_target["max_dependency_depth"])
	) / maxf(float(dependency_target["max_dependency_depth"]), 1.0)
	var initial_distance := _range_distance(
		float(dependency_analysis["initial_extractable_ratio"]),
		float(dependency_target["min_initial_extractable_ratio"]),
		float(dependency_target["max_initial_extractable_ratio"])
	)
	var miss_count := int(depth_distance > 0.0) + int(initial_distance > 0.0)
	return {
		"target_miss_count": miss_count,
		"target_distance": depth_distance + initial_distance,
		"dependency_depth_distance": depth_distance,
		"initial_extractable_ratio_distance": initial_distance,
	}


static func _range_distance(value: float, minimum: float, maximum: float) -> float:
	if value < minimum:
		return minimum - value
	if value > maximum:
		return value - maximum
	return 0.0


static func _score_is_better(candidate: Dictionary, current: Dictionary) -> bool:
	if candidate["target_miss_count"] != current["target_miss_count"]:
		return candidate["target_miss_count"] < current["target_miss_count"]
	return candidate["target_distance"] < current["target_distance"]


static func _has_complete_solution(generation: Dictionary, analysis: Dictionary) -> bool:
	var arrows: Array = generation["arrows"]
	return analysis["has_complete_solution"] \
		and generation["solution_order"].size() == arrows.size() \
		and analysis["solution_order"].size() == arrows.size()


static func _selected_result(
	base_seed: int,
	candidate: Dictionary,
	attempt_count: int,
	max_candidate_attempts: int,
	dependency_target: Dictionary,
	fallback_used: bool,
	generation_failure_count: int,
	analysis_failure_count: int
) -> Dictionary:
	var generation: Dictionary = candidate["generation"]
	return _result(
		generation["arrows"],
		generation["solution_order"],
		generation["metrics"],
		candidate["analysis"],
		_targeting_metrics(
			base_seed,
			candidate["seed"],
			attempt_count,
			max_candidate_attempts,
			dependency_target,
			true,
			candidate["index"],
			candidate["score"],
			fallback_used,
			generation_failure_count,
			analysis_failure_count
		),
		""
	)


static func _validate_dependency_target(dependency_target: Dictionary) -> String:
	for field: String in REQUIRED_TARGET_FIELDS:
		if not dependency_target.has(field):
			return "Dependency target requires %s" % field

	var min_depth: Variant = dependency_target["min_dependency_depth"]
	var max_depth: Variant = dependency_target["max_dependency_depth"]
	if not (min_depth is int) or not (max_depth is int):
		return "Dependency depth bounds must be integers"
	if min_depth < 1 or max_depth < min_depth:
		return "Dependency depth bounds are invalid"

	for prefix: String in ["initial_extractable_ratio", "forced_state_ratio"]:
		var minimum: Variant = dependency_target["min_%s" % prefix]
		var maximum: Variant = dependency_target["max_%s" % prefix]
		if not _is_number(minimum) or not _is_number(maximum):
			return "%s bounds must be numeric" % prefix
		if minimum < 0.0 or maximum > 1.0 or maximum < minimum:
			return "%s bounds must be ordered within 0..1" % prefix
	return ""


static func _is_number(value: Variant) -> bool:
	return value is int or value is float


static func _targeting_metrics(
	base_seed: int,
	selected_seed: int,
	attempt_count: int,
	max_candidate_attempts: int,
	dependency_target: Dictionary,
	has_selected_candidate: bool,
	selected_candidate_index: int = -1,
	target_score_value: Dictionary = {},
	fallback_used: bool = false,
	generation_failure_count: int = 0,
	analysis_failure_count: int = 0
) -> Dictionary:
	return {
		"base_seed": base_seed,
		"selected_seed": selected_seed,
		"attempt_count": attempt_count,
		"max_candidate_attempts": max_candidate_attempts,
		"dependency_target": dependency_target.duplicate(true),
		"has_selected_candidate": has_selected_candidate,
		"selected_candidate_index": selected_candidate_index,
		"target_match": has_selected_candidate \
			and int(target_score_value.get("target_miss_count", 1)) == 0,
		"target_score": target_score_value.duplicate(true),
		"fallback_used": fallback_used,
		"generation_failure_count": generation_failure_count,
		"analysis_failure_count": analysis_failure_count,
	}


static func _result(
	arrows: Array,
	solution_order: PackedStringArray,
	generation_metrics: Dictionary,
	dependency_analysis: Dictionary,
	targeting_metrics: Dictionary,
	error: String
) -> Dictionary:
	return {
		"arrows": arrows,
		"solution_order": solution_order,
		"generation_metrics": generation_metrics,
		"dependency_analysis": dependency_analysis,
		"dependency_targeting_metrics": targeting_metrics,
		"error": error,
	}
