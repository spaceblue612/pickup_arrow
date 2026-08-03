extends SceneTree

const ARROW_PLACEMENT := preload("res://scripts/arrow_placement.gd")
const DEPENDENCY_ANALYZER := preload("res://scripts/dependency_analyzer.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	_test_length_twenty()
	_test_level_length_above_twenty()
	_test_deterministic_solvable_board()
	_test_target_empty_ratio_with_fillers()
	_test_filler_heavy_large_board()
	_test_dense_solvable_board()
	_test_constructive_dependency_backbone()
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


func _test_filler_heavy_large_board() -> void:
	var first: Dictionary = ARROW_PLACEMENT.generate(
		1001, Vector2i(16, 16), 3, 1, 6, 0.70, 3
	)
	var second: Dictionary = ARROW_PLACEMENT.generate(
		1001, Vector2i(16, 16), 3, 1, 6, 0.70, 3
	)
	_expect(first["error"].is_empty(), "Filler-heavy 16x16 generation succeeds")
	if not first["error"].is_empty():
		return
	_expect(first["arrows"] == second["arrows"], "Filler-heavy generation stays deterministic")
	_expect(
		first["solution_order"].size() == first["arrows"].size(),
		"Filler-heavy generation keeps a complete solution"
	)
	_expect(
		absf(first["metrics"]["actual_empty_ratio"] - 0.70) <= 1.0 / 256.0,
		"Filler-heavy generation reaches its target empty ratio"
	)


func _test_dense_solvable_board() -> void:
	var started_msec := Time.get_ticks_msec()
	var first: Dictionary = ARROW_PLACEMENT.generate(
		4004, Vector2i(16, 16), 5, 5, 14, 0.10, 3, [], 4
	)
	var elapsed_msec := Time.get_ticks_msec() - started_msec
	var second: Dictionary = ARROW_PLACEMENT.generate(
		4004, Vector2i(16, 16), 5, 5, 14, 0.10, 3, [], 4
	)
	_expect(first["error"].is_empty(), "Dense 90-percent occupancy generation succeeds")
	if not first["error"].is_empty():
		return
	_expect(first["arrows"] == second["arrows"], "Dense generation remains deterministic")
	_expect(
		first["solution_order"].size() == first["arrows"].size(),
		"Dense generation keeps a complete solution"
	)
	_expect(
		absf(first["metrics"]["actual_empty_ratio"] - 0.10) <= 1.0 / 256.0,
		"Dense generation reaches the 0.10 empty ratio"
	)
	var single_cell_fillers := 0
	var multi_cell_fillers := 0
	var filler_directions: Dictionary = {}
	var filler_lengths: Dictionary = {}
	var bent_filler_count := 0
	for arrow_data: Dictionary in first["arrows"]:
		if arrow_data["placement_role"] != "filler":
			continue
		filler_directions[arrow_data["direction"]] = true
		filler_lengths[arrow_data["cells"].size()] = true
		if arrow_data["cells"].size() == 1:
			single_cell_fillers += 1
		else:
			multi_cell_fillers += 1
		if _arrow_is_bent(arrow_data):
			bent_filler_count += 1
	_expect(
		multi_cell_fillers > single_cell_fillers,
		"Dense generation favors multi-cell filler arrows"
	)
	_expect(filler_directions.size() >= 3, "Dense generation varies filler directions")
	_expect(filler_lengths.size() >= 2, "Dense generation varies filler lengths")
	_expect(bent_filler_count > 0, "Dense generation includes bent filler arrows")
	_expect(elapsed_msec < 10000, "Dense generation completes within the runtime budget")


func _test_constructive_dependency_backbone() -> void:
	var preferred_depth := 5
	var result: Dictionary = ARROW_PLACEMENT.generate(
		8181, Vector2i(9, 9), 3, 2, 5, 0.50, 3, [], preferred_depth
	)
	_expect(result["error"].is_empty(), "Constructive dependency generation succeeds")
	if not result["error"].is_empty():
		return
	var analysis: Dictionary = DEPENDENCY_ANALYZER.analyze(result["arrows"], Vector2i(9, 9))
	_expect(analysis["has_complete_solution"], "Constructed dependency board is completely solvable")
	_expect(
		analysis["dependency_depth"] >= preferred_depth,
		"Constructed dependency backbone reaches the preferred depth"
	)
	_expect(
		result["metrics"]["dependency_backbone_depth"] == preferred_depth,
		"Generation metrics expose the constructed backbone depth"
	)


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


func _arrow_is_bent(arrow_data: Dictionary) -> bool:
	var cells: Array = arrow_data["cells"]
	if cells.size() < 3:
		return false
	var first_step: Vector2i = cells[1] - cells[0]
	for index: int in range(2, cells.size()):
		if cells[index] - cells[index - 1] != first_step:
			return true
	return false


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
