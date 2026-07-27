extends SceneTree

const DEPENDENCY_ANALYZER := preload("res://scripts/dependency_analyzer.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_three_arrow_chain()
	_test_self_cycle()
	_test_generated_stages_are_deterministic_and_solvable()
	_finish()


func _test_three_arrow_chain() -> void:
	var arrows := [
		{
			"id": "A",
			"head_cell": Vector2i(3, 1),
			"cells": [Vector2i(3, 1)],
			"direction": "UP",
		},
		{
			"id": "B",
			"head_cell": Vector2i(1, 1),
			"cells": [
				Vector2i(1, 1),
				Vector2i(1, 2),
				Vector2i(2, 2),
				Vector2i(2, 3),
			],
			"direction": "RIGHT",
		},
		{
			"id": "C",
			"head_cell": Vector2i(1, 3),
			"cells": [Vector2i(1, 3)],
			"direction": "RIGHT",
		},
	]
	var analysis: Dictionary = DEPENDENCY_ANALYZER.analyze(arrows, Vector2i(5, 5))

	_expect(analysis["error"].is_empty(), "Chain analysis succeeds")
	_expect(analysis["node_count"] == 3, "Chain has three nodes")
	_expect(analysis["edge_count"] == 2, "Chain has two edges")
	_expect(analysis["blockers_by_arrow"]["A"] == PackedStringArray(), "A has no blocker")
	_expect(analysis["blockers_by_arrow"]["B"] == PackedStringArray(["A"]), "A blocks B")
	_expect(analysis["blockers_by_arrow"]["C"] == PackedStringArray(["B"]), "B blocks C")
	_expect(analysis["dependents_by_arrow"]["A"] == PackedStringArray(["B"]), "A precedes B")
	_expect(analysis["dependents_by_arrow"]["B"] == PackedStringArray(["C"]), "B precedes C")
	_expect(analysis["dependency_depth"] == 3, "Chain dependency depth is three")
	_expect(analysis["is_acyclic"], "Chain is acyclic")
	_expect(analysis["initial_extractable_count"] == 1, "Only A is initially extractable")
	_expect(
		is_equal_approx(analysis["initial_extractable_ratio"], 1.0 / 3.0),
		"Initial extractable ratio is one third"
	)
	_expect(analysis["forced_state_count"] == 3, "Every chain state is forced")
	_expect(is_equal_approx(analysis["forced_state_ratio"], 1.0), "Forced-state ratio is one")
	_expect(is_equal_approx(analysis["average_choice_count"], 1.0), "Average choice count is one")
	_expect(analysis["has_complete_solution"], "Chain has a complete solution")
	_expect(
		analysis["solution_order"] == PackedStringArray(["A", "B", "C"]),
		"Chain solution order is deterministic"
	)


func _test_self_cycle() -> void:
	var arrows := [
		{
			"id": "A",
			"head_cell": Vector2i(2, 2),
			"cells": [
				Vector2i(2, 2),
				Vector2i(2, 3),
				Vector2i(3, 3),
				Vector2i(3, 2),
			],
			"direction": "RIGHT",
		},
	]
	var analysis: Dictionary = DEPENDENCY_ANALYZER.analyze(arrows, Vector2i(5, 5))

	_expect(analysis["edge_count"] == 1, "Self-block creates one edge")
	_expect(analysis["blockers_by_arrow"]["A"] == PackedStringArray(["A"]), "Self blocker is preserved")
	_expect(not analysis["is_acyclic"], "Self-block graph is cyclic")
	_expect(analysis["dependency_depth"] == 0, "Cyclic graph has no dependency depth")
	_expect(not analysis["has_complete_solution"], "Self-block graph has no complete solution")
	_expect(analysis["initial_extractable_count"] == 0, "Self-block graph has no initial move")


func _test_generated_stages_are_deterministic_and_solvable() -> void:
	for stage_id: String in STAGE_CATALOG.STAGE_IDS:
		var first_stage: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		var second_stage: Dictionary = STAGE_CATALOG.get_stage(stage_id)
		var first_analysis: Dictionary = first_stage["dependency_analysis"]
		var second_analysis: Dictionary = second_stage["dependency_analysis"]

		_expect(first_analysis == second_analysis, "%s analysis is deterministic" % stage_id)
		_expect(first_analysis["is_acyclic"], "%s dependency graph is acyclic" % stage_id)
		_expect(first_analysis["has_complete_solution"], "%s analysis finds a full solution" % stage_id)
		_expect(
			first_analysis["solution_order"].size() == first_stage["arrows"].size(),
			"%s analysis removes every arrow" % stage_id
		)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Dependency analyzer tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
