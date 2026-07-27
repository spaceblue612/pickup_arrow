extends SceneTree

const ARROW_PLACEMENT := preload("res://scripts/arrow_placement.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_length_twenty()
	_test_level_length_above_twenty()
	_test_deterministic_solvable_board()
	_test_target_empty_ratio_with_fillers()
	_test_invalid_arguments()
	_finish()


func _test_length_twenty() -> void:
	var result: Dictionary = ARROW_PLACEMENT.generate(20260726, Vector2i(9, 9), 1, 20, 20)
	_expect(result["error"].is_empty(), "A length-20 bent arrow can be generated")
	_expect(result["arrows"].size() == 1, "Length-20 generation returns one arrow")
	if result["arrows"].size() == 1:
		_expect(result["arrows"][0]["cells"].size() == 20, "Generated arrow has exactly 20 body cells")
		var stage := {
			"id": "GENERATED-20",
			"grid_size": Vector2i(9, 9),
			"arrows": result["arrows"],
		}
		_expect(STAGE_CATALOG.validate_stage(stage)["is_valid"], "Length-20 arrow validates")


func _test_level_length_above_twenty() -> void:
	var result: Dictionary = ARROW_PLACEMENT.generate(20260727, Vector2i(9, 9), 1, 24, 24)
	_expect(result["error"].is_empty(), "A stage level can request a length above 20")
	if result["arrows"].size() == 1:
		_expect(result["arrows"][0]["cells"].size() == 24, "Level length range is applied")


func _test_deterministic_solvable_board() -> void:
	var first: Dictionary = ARROW_PLACEMENT.generate(424242, Vector2i(9, 9), 4, 1, 20)
	var second: Dictionary = ARROW_PLACEMENT.generate(424242, Vector2i(9, 9), 4, 1, 20)
	_expect(first["error"].is_empty(), "Seeded board generation succeeds")
	_expect(first["arrows"] == second["arrows"], "The same seed produces the same arrows")
	_expect(first["solution_order"] == second["solution_order"], "The same seed produces the same solution")
	_expect(first["solution_order"].size() == 4, "Generated board has a complete solution order")
	var stage := {
		"id": "GENERATED-BOARD",
		"grid_size": Vector2i(9, 9),
		"arrows": first["arrows"],
	}
	_expect(STAGE_CATALOG.validate_stage(stage)["is_valid"], "Generated arrows are connected and non-overlapping")


func _test_target_empty_ratio_with_fillers() -> void:
	var target_empty_ratio := 0.65
	var result: Dictionary = ARROW_PLACEMENT.generate(
		424243,
		Vector2i(9, 9),
		3,
		2,
		5,
		target_empty_ratio,
		3
	)
	_expect(result["error"].is_empty(), "Fill-target generation succeeds")
	if not result["error"].is_empty():
		return
	var metrics: Dictionary = result["metrics"]
	_expect(metrics["primary_arrow_count"] == 3, "Primary arrow count is preserved")
	_expect(metrics["filler_arrow_count"] > 0, "Short filler arrows are added")
	_expect(
		absf(metrics["actual_empty_ratio"] - target_empty_ratio) <= 1.0 / 81.0,
		"Actual empty ratio reaches the target within one cell"
	)
	_expect(
		result["solution_order"].size() == result["arrows"].size(),
		"Filled board keeps a complete solution order"
	)
	for arrow_data: Dictionary in result["arrows"]:
		if arrow_data["placement_role"] == "primary":
			_expect(
				arrow_data["cells"].size() >= 2 and arrow_data["cells"].size() <= 5,
				"Primary arrows use the requested level length"
			)
		else:
			_expect(arrow_data["cells"].size() <= 3, "Filler arrows stay short")


func _test_invalid_arguments() -> void:
	_expect(
		ARROW_PLACEMENT.generate(1, Vector2i(1, 1), 1, 1, 1)["error"].is_empty(),
		"Legacy generation without a fill target supports a one-cell board"
	)
	_expect(
		not ARROW_PLACEMENT.generate(1, Vector2i(9, 9), 1, 0, 20)["error"].is_empty(),
		"Length zero is rejected"
	)
	_expect(
		not ARROW_PLACEMENT.generate(1, Vector2i(9, 9), 1, 1, 82)["error"].is_empty(),
		"Length above board capacity is rejected"
	)
	_expect(
		not ARROW_PLACEMENT.generate(1, Vector2i(9, 9), 2, 5, 10, 0.95)["error"].is_empty(),
		"Fill target below primary minimum capacity is rejected"
	)
	_expect(
		not ARROW_PLACEMENT.generate(1, Vector2i(9, 9), 1, 1, 5, 1.1)["error"].is_empty(),
		"Empty ratio above one is rejected"
	)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Arrow placement tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
