extends SceneTree

const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")

const LARGE_BOARD_CASES := [
	{
		"name": "12x12",
		"seed": 120012,
		"grid_size": Vector2i(12, 12),
		"primary_arrow_count": 12,
		"min_length": 2,
		"max_length": 8,
		"target_empty_ratio": 0.45,
		"filler_max_length": 3,
		"dependency_target": {
			"min_dependency_depth": 9,
			"max_dependency_depth": 10,
			"min_initial_extractable_ratio": 0.20,
			"max_initial_extractable_ratio": 0.30,
			"min_forced_state_ratio": 0.00,
			"max_forced_state_ratio": 0.10,
		},
		"max_candidate_attempts": 8,
		"expected_attempt_count": 3,
		"minimum_node_count": 20,
	},
	{
		"name": "15x15",
		"seed": 150015,
		"grid_size": Vector2i(15, 15),
		"primary_arrow_count": 12,
		"min_length": 2,
		"max_length": 10,
		"target_empty_ratio": 0.50,
		"filler_max_length": 3,
		"dependency_target": {
			"min_dependency_depth": 7,
			"max_dependency_depth": 9,
			"min_initial_extractable_ratio": 0.20,
			"max_initial_extractable_ratio": 0.30,
			"min_forced_state_ratio": 0.08,
			"max_forced_state_ratio": 0.20,
		},
		"max_candidate_attempts": 8,
		"expected_attempt_count": 2,
		"minimum_node_count": 20,
	},
]

var _failures := PackedStringArray()


func _init() -> void:
	for config: Dictionary in LARGE_BOARD_CASES:
		_test_large_board_targeting(config)
	_finish()


func _test_large_board_targeting(config: Dictionary) -> void:
	var first: Dictionary = _select(config)
	var second: Dictionary = _select(config)
	var case_name: String = config["name"]

	_expect(first["error"].is_empty(), "%s targeted generation succeeds" % case_name)
	if not first["error"].is_empty():
		return

	var analysis: Dictionary = first["dependency_analysis"]
	var targeting_metrics: Dictionary = first["dependency_targeting_metrics"]
	var generation_metrics: Dictionary = first["generation_metrics"]
	_expect(
		DEPENDENCY_TARGETING.matches_target(analysis, config["dependency_target"]),
		"%s selected board satisfies every dependency target" % case_name
	)
	_expect(
		targeting_metrics["attempt_count"] == config["expected_attempt_count"],
		"%s rejects preceding out-of-range candidates" % case_name
	)
	_expect(
		targeting_metrics["selected_seed"] == config["seed"] \
			+ (targeting_metrics["attempt_count"] - 1) \
				* DEPENDENCY_TARGETING.CANDIDATE_SEED_STEP,
		"%s selected seed follows the deterministic sequence" % case_name
	)
	_expect(first["arrows"] == second["arrows"], "%s arrows are deterministic" % case_name)
	_expect(
		first["dependency_analysis"] == second["dependency_analysis"],
		"%s dependency analysis is deterministic" % case_name
	)
	_expect(
		first["dependency_targeting_metrics"] == second["dependency_targeting_metrics"],
		"%s targeting metrics are deterministic" % case_name
	)
	_expect(
		analysis["node_count"] == first["arrows"].size() \
			and analysis["node_count"] >= config["minimum_node_count"],
		"%s analyzes every arrow on a larger graph" % case_name
	)
	_expect(analysis["has_complete_solution"], "%s selected board is completely solvable" % case_name)
	_expect(
		first["solution_order"].size() == first["arrows"].size(),
		"%s solution order removes every arrow" % case_name
	)
	_expect(
		absf(generation_metrics["actual_empty_ratio"] - config["target_empty_ratio"]) \
			<= 1.0 / float(config["grid_size"].x * config["grid_size"].y),
		"%s preserves the target empty ratio within one cell" % case_name
	)
	_validate_large_board_cells(first["arrows"], config["grid_size"], case_name)
	print(
		"%s selected_seed=%d attempts=%d nodes=%d depth=%d initial=%.6f forced=%.6f"
		% [
			case_name,
			targeting_metrics["selected_seed"],
			targeting_metrics["attempt_count"],
			analysis["node_count"],
			analysis["dependency_depth"],
			analysis["initial_extractable_ratio"],
			analysis["forced_state_ratio"],
		]
	)


func _validate_large_board_cells(arrows: Array, grid_size: Vector2i, case_name: String) -> void:
	var occupied_cells: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		var cells: Array = arrow_data["cells"]
		_expect(
			not cells.is_empty() and arrow_data["head_cell"] == cells[0],
			"%s arrow head remains the first body cell" % case_name
		)
		for cell_index: int in cells.size():
			var cell: Vector2i = cells[cell_index]
			_expect(
				cell.x >= 1 and cell.x <= grid_size.x \
					and cell.y >= 1 and cell.y <= grid_size.y,
				"%s body cells remain within the enlarged grid" % case_name
			)
			_expect(
				not occupied_cells.has(cell),
				"%s arrow bodies do not overlap" % case_name
			)
			occupied_cells[cell] = arrow_data["id"]
			if cell_index > 0:
				var previous_cell: Vector2i = cells[cell_index - 1]
				_expect(
					absi(cell.x - previous_cell.x) + absi(cell.y - previous_cell.y) == 1,
					"%s arrow bodies stay cardinally connected" % case_name
				)


func _select(config: Dictionary) -> Dictionary:
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


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Large-board dependency targeting tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
