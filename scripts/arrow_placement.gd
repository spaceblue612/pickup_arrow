class_name ArrowPlacement
extends RefCounted

const PATH_RULE := preload("res://scripts/path_rule.gd")

const DIRECTIONS := ["UP", "DOWN", "LEFT", "RIGHT"]
const STEP_VECTORS := [
	Vector2i.UP,
	Vector2i.DOWN,
	Vector2i.LEFT,
	Vector2i.RIGHT,
]
const MAX_BOARD_ATTEMPTS := 240
const MAX_ARROW_ATTEMPTS := 160
const NO_FILL_TARGET := -1.0
const MAX_GRID_SIDE := 999
const MAX_BOARD_CELL_COUNT := 10000


static func generate(
	seed_value: int,
	grid_size: Vector2i,
	arrow_count: int,
	min_length: int = 1,
	max_length: int = 20,
	target_empty_ratio: float = NO_FILL_TARGET,
	filler_max_length: int = 3,
	blocked_cells: Array = [],
	preferred_dependency_depth: int = 0,
	construction_target: Dictionary = {}
) -> Dictionary:
	if grid_size.x <= 0 or grid_size.y <= 0:
		return _result([], PackedStringArray(), "Grid size must be positive")
	if grid_size.x > MAX_GRID_SIDE or grid_size.y > MAX_GRID_SIDE:
		return _result([], PackedStringArray(), "Grid side exceeds maximum %d" % MAX_GRID_SIDE)
	if grid_size.x * grid_size.y > MAX_BOARD_CELL_COUNT:
		return _result(
			[],
			PackedStringArray(),
			"Grid cell count exceeds maximum %d" % MAX_BOARD_CELL_COUNT
		)
	if arrow_count <= 0:
		return _result([], PackedStringArray(), "Arrow count must be positive")
	var blocked_result := _build_blocked_set(blocked_cells, grid_size)
	if not blocked_result["error"].is_empty():
		return _result([], PackedStringArray(), blocked_result["error"])
	var blocked_set: Dictionary = blocked_result["blocked_set"]
	var board_capacity := grid_size.x * grid_size.y - blocked_set.size()
	if board_capacity <= 0:
		return _result([], PackedStringArray(), "At least one playable cell is required")
	if min_length < 1 or max_length > board_capacity or min_length > max_length:
		return _result([], PackedStringArray(), "Length range must fit within the board")
	if arrow_count > board_capacity:
		return _result([], PackedStringArray(), "Arrow count exceeds board capacity")
	var uses_fill_target := target_empty_ratio != NO_FILL_TARGET
	if uses_fill_target \
			and (target_empty_ratio < 0.0 or target_empty_ratio > 1.0):
		return _result([], PackedStringArray(), "Target empty ratio must be within 0..1")
	if uses_fill_target \
			and (filler_max_length < 1 or filler_max_length > board_capacity):
		return _result([], PackedStringArray(), "Filler length must fit within the board")

	var target_occupied_cells := board_capacity
	if uses_fill_target:
		target_occupied_cells = clampi(
			roundi(float(board_capacity) * (1.0 - target_empty_ratio)),
			0,
			board_capacity
		)
		if target_occupied_cells < arrow_count * min_length:
			return _result(
				[],
				PackedStringArray(),
				"Target fill is too small for the primary arrow minimum lengths"
			)

	var filler_heavy := uses_fill_target \
			and target_occupied_cells > arrow_count * max_length * 2
	var dense_fill := uses_fill_target \
			and target_occupied_cells >= roundi(float(board_capacity) * 0.58)
	if dense_fill:
		var dense_result := _generate_dense_solvable_board(
			seed_value,
			grid_size,
			arrow_count,
			min_length,
			max_length,
			target_empty_ratio,
			filler_max_length,
			blocked_set,
			board_capacity,
			target_occupied_cells,
			construction_target
		)
		if not dense_result.is_empty():
			return dense_result
	if filler_heavy:
		var reverse_safe_result := _generate_board_attempts(
			seed_value, grid_size, arrow_count, min_length, max_length,
				target_empty_ratio, filler_max_length, blocked_set, board_capacity,
				target_occupied_cells, uses_fill_target, true,
				preferred_dependency_depth, not construction_target.is_empty()
		)
		if not reverse_safe_result.is_empty():
			return reverse_safe_result

	var standard_result := _generate_board_attempts(
		seed_value, grid_size, arrow_count, min_length, max_length,
			target_empty_ratio, filler_max_length, blocked_set, board_capacity,
			target_occupied_cells, uses_fill_target, false,
			preferred_dependency_depth, not construction_target.is_empty()
	)
	if not standard_result.is_empty():
		return standard_result

	if not filler_heavy:
		var reverse_safe_fallback := _generate_board_attempts(
			seed_value, grid_size, arrow_count, min_length, max_length,
				target_empty_ratio, filler_max_length, blocked_set, board_capacity,
				target_occupied_cells, uses_fill_target, true,
				preferred_dependency_depth, not construction_target.is_empty()
		)
		if not reverse_safe_fallback.is_empty():
			return reverse_safe_fallback

	return _result([], PackedStringArray(), "Could not generate a solvable board")


static func _generate_dense_solvable_board(
	seed_value: int,
	grid_size: Vector2i,
	arrow_count: int,
	min_length: int,
	max_length: int,
	target_empty_ratio: float,
	filler_max_length: int,
	blocked_set: Dictionary,
	board_capacity: int,
	target_occupied_cells: int,
	construction_target: Dictionary
) -> Dictionary:
	for board_attempt: int in MAX_BOARD_ATTEMPTS:
		var random := RandomNumberGenerator.new()
		random.seed = seed_value + board_attempt * 104729
		var remaining_cells := _select_dense_occupied_cells(
			grid_size,
			blocked_set,
			target_occupied_cells,
			random
		)
		if remaining_cells.size() != target_occupied_cells:
			continue
		var arrows: Array = []
		var placement_failed := false
		var turn_probability := 0.25
		if target_empty_ratio < 0.20:
			var size_factor := clampf(
				(float(maxi(grid_size.x, grid_size.y)) - 36.0) / 24.0,
				0.0,
				1.0
			)
			turn_probability = lerpf(0.15, 0.06, size_factor)
		for arrow_index: int in arrow_count:
			var remaining_primary_count := arrow_count - arrow_index - 1
			var placement_max_length: int = mini(
				max_length,
				remaining_cells.size() - remaining_primary_count * min_length
			)
			if placement_max_length < min_length:
				placement_failed = true
				break
			var primary_data := _peel_dense_arrow(
				arrow_index,
				grid_size,
				min_length,
				placement_max_length,
				remaining_cells,
				random,
				"primary",
				turn_probability
			)
			if primary_data.is_empty():
				placement_failed = true
				break
			arrows.append(primary_data)
			for cell: Vector2i in primary_data["cells"]:
				remaining_cells.erase(cell)
		if placement_failed:
			continue

		while not remaining_cells.is_empty():
			var filler_data := _peel_dense_arrow(
				arrows.size(),
				grid_size,
				1,
				mini(filler_max_length, remaining_cells.size()),
				remaining_cells,
				random,
				"filler",
				turn_probability
			)
			if filler_data.is_empty():
				placement_failed = true
				break
			arrows.append(filler_data)
			for cell: Vector2i in filler_data["cells"]:
				remaining_cells.erase(cell)
		if placement_failed:
			continue

		var maximum_initial_ratio := 1.0
		if construction_target.has("max_initial_extractable_ratio"):
			maximum_initial_ratio = maxf(
				0.0,
				float(construction_target["max_initial_extractable_ratio"]) - 0.08
			)
		var reassigned_arrows := _assign_peel_wave_directions(
			arrows,
			grid_size,
			random,
			maximum_initial_ratio
		)
		if reassigned_arrows.is_empty():
			continue
		arrows = reassigned_arrows
		var solution_order := find_solution_order(arrows, grid_size)
		if solution_order.size() == arrows.size() \
				and (arrows.size() == 1 or _has_blocked_arrow(arrows, grid_size)):
			return _result(
				arrows,
				solution_order,
				"",
				_build_metrics(
					board_capacity,
					target_occupied_cells,
					arrow_count,
					arrows.size() - arrow_count,
					target_empty_ratio
				)
			)
	return {}


static func _select_dense_occupied_cells(
	grid_size: Vector2i,
	blocked_cells: Dictionary,
	target_occupied_cells: int,
	random: RandomNumberGenerator
) -> Dictionary:
	var ranked_cells: Array[Dictionary] = []
	for y: int in range(1, grid_size.y + 1):
		for x: int in range(1, grid_size.x + 1):
			var cell := Vector2i(x, y)
			if not blocked_cells.has(cell):
				var edge_distance := mini(
					mini(x - 1, grid_size.x - x),
					mini(y - 1, grid_size.y - y)
				)
				ranked_cells.append({
					"cell": cell,
					"score": edge_distance * 4 + random.randi_range(0, 3),
				})
	ranked_cells.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		if left["score"] != right["score"]:
			return left["score"] < right["score"]
		var left_cell: Vector2i = left["cell"]
		var right_cell: Vector2i = right["cell"]
		return left_cell.y < right_cell.y \
				or (left_cell.y == right_cell.y and left_cell.x < right_cell.x)
	)
	var selected_cells: Dictionary = {}
	for index: int in mini(target_occupied_cells, ranked_cells.size()):
		selected_cells[ranked_cells[index]["cell"]] = true
	return selected_cells


static func _peel_dense_arrow(
	arrow_index: int,
	grid_size: Vector2i,
	min_length: int,
	max_length: int,
	remaining_cells: Dictionary,
	random: RandomNumberGenerator,
	placement_role: String,
	turn_probability: float
) -> Dictionary:
	var candidates := _dense_peel_candidates(remaining_cells, grid_size, random)
	if candidates.is_empty():
		return {}
	for attempt: int in mini(MAX_ARROW_ATTEMPTS, candidates.size()):
		var candidate: Dictionary = candidates[attempt]
		var head_cell: Vector2i = candidate["head_cell"]
		var direction: String = candidate["direction"]
		var length := random.randi_range(min_length, max_length)
		if placement_role == "filler" and max_length >= 2:
			length = maxi(1, max_length - attempt / maxi(candidates.size() / 3, 1))
		var cells := _build_body_from_remaining_avoiding_exit(
			head_cell,
			length,
			remaining_cells,
			random,
			direction,
			grid_size,
			turn_probability
		)
		if cells.size() != length:
			continue
		return {
			"id": _arrow_id(arrow_index),
			"head_cell": head_cell,
			"direction": direction,
			"cells": cells,
			"placement_role": placement_role,
			"construction_role": "dense_solution_peel",
		}
	if min_length > 1:
		return {}
	var fallback: Dictionary = candidates[0]
	return {
		"id": _arrow_id(arrow_index),
		"head_cell": fallback["head_cell"],
		"direction": fallback["direction"],
		"cells": [fallback["head_cell"]],
		"placement_role": placement_role,
		"construction_role": "dense_solution_peel",
	}


static func _dense_peel_candidates(
	remaining_cells: Dictionary,
	grid_size: Vector2i,
	random: RandomNumberGenerator
) -> Array[Dictionary]:
	var row_minimums: Dictionary = {}
	var row_maximums: Dictionary = {}
	var column_minimums: Dictionary = {}
	var column_maximums: Dictionary = {}
	for cell_value: Variant in remaining_cells:
		var cell: Vector2i = cell_value
		if not row_minimums.has(cell.y):
			row_minimums[cell.y] = cell.x
			row_maximums[cell.y] = cell.x
		else:
			row_minimums[cell.y] = mini(int(row_minimums[cell.y]), cell.x)
			row_maximums[cell.y] = maxi(int(row_maximums[cell.y]), cell.x)
		if not column_minimums.has(cell.x):
			column_minimums[cell.x] = cell.y
			column_maximums[cell.x] = cell.y
		else:
			column_minimums[cell.x] = mini(int(column_minimums[cell.x]), cell.y)
			column_maximums[cell.x] = maxi(int(column_maximums[cell.x]), cell.y)
	var candidates: Array[Dictionary] = []
	for cell_value: Variant in remaining_cells:
		var cell: Vector2i = cell_value
		if cell.x == int(row_minimums[cell.y]):
			candidates.append({
				"head_cell": cell,
				"direction": "LEFT",
				"edge_distance": cell.x - 1,
			})
		if cell.x == int(row_maximums[cell.y]):
			candidates.append({
				"head_cell": cell,
				"direction": "RIGHT",
				"edge_distance": grid_size.x - cell.x,
			})
		if cell.y == int(column_minimums[cell.x]):
			candidates.append({
				"head_cell": cell,
				"direction": "UP",
				"edge_distance": cell.y - 1,
			})
		if cell.y == int(column_maximums[cell.x]):
			candidates.append({
				"head_cell": cell,
				"direction": "DOWN",
				"edge_distance": grid_size.y - cell.y,
			})
	for index: int in range(candidates.size() - 1, 0, -1):
		var swap_index := random.randi_range(0, index)
		var temporary := candidates[index]
		candidates[index] = candidates[swap_index]
		candidates[swap_index] = temporary
	candidates.sort_custom(func(left: Dictionary, right: Dictionary) -> bool:
		return left["edge_distance"] < right["edge_distance"]
	)
	return candidates


static func _build_body_from_remaining_avoiding_exit(
	head_cell: Vector2i,
	length: int,
	remaining_cells: Dictionary,
	random: RandomNumberGenerator,
	direction: String,
	grid_size: Vector2i,
	turn_probability: float
) -> Array[Vector2i]:
	var cells: Array[Vector2i] = [head_cell]
	var body_cells := {head_cell: true}
	var exit_step: Vector2i = PATH_RULE.DIRECTION_VECTORS[direction]
	while cells.size() < length:
		var candidates: Array[Vector2i] = []
		var inward_candidates: Array[Vector2i] = []
		var turn_candidates: Array[Vector2i] = []
		for step: Vector2i in STEP_VECTORS:
			var candidate: Vector2i = cells.back() + step
			if not remaining_cells.has(candidate) or body_cells.has(candidate):
				continue
			var offset := candidate - head_cell
			var lies_on_exit_ray := (exit_step.x != 0 \
					and offset.y == 0 and offset.x * exit_step.x > 0) \
				or (exit_step.y != 0 \
					and offset.x == 0 and offset.y * exit_step.y > 0)
			if not lies_on_exit_ray:
				candidates.append(candidate)
				if step == -exit_step:
					inward_candidates.append(candidate)
				elif step != exit_step:
					turn_candidates.append(candidate)
		if candidates.is_empty():
			return []
		var preferred_candidates := candidates
		if cells.size() == 2 and length == 3 \
				and not turn_candidates.is_empty() \
				and random.randf() < turn_probability:
			var best_turn_distance := -1
			var best_turn_candidates: Array[Vector2i] = []
			for turn_candidate: Vector2i in turn_candidates:
				var turn_distance := mini(
					mini(turn_candidate.x - 1, grid_size.x - turn_candidate.x),
					mini(turn_candidate.y - 1, grid_size.y - turn_candidate.y)
				)
				if turn_distance > best_turn_distance:
					best_turn_distance = turn_distance
					best_turn_candidates.clear()
					best_turn_candidates.append(turn_candidate)
				elif turn_distance == best_turn_distance:
					best_turn_candidates.append(turn_candidate)
			preferred_candidates = best_turn_candidates
		elif not inward_candidates.is_empty():
			preferred_candidates = inward_candidates
		var next_cell: Vector2i = preferred_candidates[
			random.randi_range(0, preferred_candidates.size() - 1)
		]
		cells.append(next_cell)
		body_cells[next_cell] = true
	return cells


static func _shuffle_cells(cells: Array[Vector2i], random: RandomNumberGenerator) -> void:
	for index: int in range(cells.size() - 1, 0, -1):
		var swap_index := random.randi_range(0, index)
		var temporary := cells[index]
		cells[index] = cells[swap_index]
		cells[swap_index] = temporary


static func _generate_board_attempts(
	seed_value: int,
	grid_size: Vector2i,
	arrow_count: int,
	min_length: int,
	max_length: int,
	target_empty_ratio: float,
	filler_max_length: int,
	blocked_set: Dictionary,
	board_capacity: int,
	target_occupied_cells: int,
	uses_fill_target: bool,
	require_reverse_safe: bool,
	preferred_dependency_depth: int,
	reassign_directions: bool
) -> Dictionary:
	for board_attempt: int in MAX_BOARD_ATTEMPTS:
		var random := RandomNumberGenerator.new()
		random.seed = seed_value + board_attempt * 104729
		var arrows: Array = []
		var occupied_cells: Dictionary = {}
		var placement_failed := false
		var dependency_backbone: Dictionary = {}
		if uses_fill_target \
				and preferred_dependency_depth >= 2 \
				and target_occupied_cells - preferred_dependency_depth \
					>= arrow_count * min_length:
			dependency_backbone = _find_dependency_backbone(
				preferred_dependency_depth,
				grid_size,
				blocked_set,
				random
			)
		var placement_blocked_set: Dictionary = blocked_set.duplicate()
		var placement_target_occupied_cells := target_occupied_cells
		if not dependency_backbone.is_empty():
			for cell: Vector2i in dependency_backbone["cells"]:
				placement_blocked_set[cell] = true
			placement_target_occupied_cells -= dependency_backbone["cells"].size()

		for arrow_index: int in arrow_count:
			var placement_max_length := max_length
			if uses_fill_target:
				var remaining_primary_count := arrow_count - arrow_index - 1
				var reserved_primary_cells := remaining_primary_count * min_length
				placement_max_length = mini(
					placement_max_length,
					placement_target_occupied_cells \
						- occupied_cells.size() - reserved_primary_cells
				)
			if placement_max_length < min_length:
				placement_failed = true
				break
			var arrow_data := _place_arrow(
				arrow_index,
				grid_size,
				min_length,
				placement_max_length,
				occupied_cells,
				placement_blocked_set,
				random,
				"primary",
				require_reverse_safe
			)
			if arrow_data.is_empty():
				placement_failed = true
				break
			arrows.append(arrow_data)
			for cell: Vector2i in arrow_data["cells"]:
				occupied_cells[cell] = arrow_data["id"]

		while not placement_failed \
				and uses_fill_target \
				and occupied_cells.size() < placement_target_occupied_cells:
			var remaining_target_cells := (
				placement_target_occupied_cells - occupied_cells.size()
			)
			var filler_data := _place_arrow(
				arrows.size(),
				grid_size,
				1,
				mini(filler_max_length, remaining_target_cells),
				occupied_cells,
				placement_blocked_set,
				random,
				"filler",
				require_reverse_safe
			)
			if filler_data.is_empty():
				placement_failed = true
				break
			arrows.append(filler_data)
			for cell: Vector2i in filler_data["cells"]:
				occupied_cells[cell] = filler_data["id"]

		if placement_failed:
			continue
		if not dependency_backbone.is_empty():
			for cell: Vector2i in dependency_backbone["cells"]:
				var arrow_id := _arrow_id(arrows.size())
				arrows.append({
					"id": arrow_id,
					"head_cell": cell,
					"direction": dependency_backbone["direction"],
					"cells": [cell],
					"placement_role": "filler",
					"construction_role": "dependency_backbone",
				})
				occupied_cells[cell] = arrow_id
		if require_reverse_safe and reassign_directions:
			var reassigned_arrows := _assign_peel_wave_directions(
				arrows,
				grid_size,
				random
			)
			if reassigned_arrows.is_empty():
				continue
			arrows = reassigned_arrows

		var solution_order := find_solution_order(arrows, grid_size)
		if solution_order.size() == arrows.size() \
				and (arrows.size() == 1 or _has_blocked_arrow(arrows, grid_size)):
			return _result(
				arrows,
				solution_order,
				"",
				_build_metrics(
					board_capacity,
					occupied_cells.size(),
					arrow_count,
					arrows.size() - arrow_count,
					target_empty_ratio,
					dependency_backbone.get("cells", []).size()
				)
			)

	return {}


static func _assign_peel_wave_directions(
	arrows: Array,
	grid_size: Vector2i,
	random: RandomNumberGenerator,
	maximum_initial_ratio: float = 1.0
) -> Array:
	var remaining: Array = arrows.duplicate(true)
	var all_arrows_by_cell := _arrows_by_cell(arrows)
	var assignments: Dictionary = {}
	var assigned_depths: Dictionary = {}
	var maximum_initial_count := arrows.size()
	if maximum_initial_ratio < 1.0:
		maximum_initial_count = maxi(
			1,
			floori(float(arrows.size()) * maximum_initial_ratio)
		)
	var initial_assignment_count := 0
	var wave_index := 0
	while not remaining.is_empty():
		var occupied_cells := _arrows_by_cell(remaining)
		var wave_assignments: Array[Dictionary] = []
		for arrow_data: Dictionary in remaining:
			var orientation_options: Array[Dictionary] = []
			var forward_cells: Array[Vector2i] = []
			for cell: Vector2i in arrow_data["cells"]:
				forward_cells.append(cell)
			var reverse_cells: Array[Vector2i] = forward_cells.duplicate()
			reverse_cells.reverse()
			for oriented_cells: Array[Vector2i] in [forward_cells, reverse_cells]:
				var head_cell: Vector2i = oriented_cells[0]
				for direction: String in _available_directions(
					head_cell,
					oriented_cells,
					grid_size,
					occupied_cells
				):
					var option_depth := _assigned_direction_depth(
						head_cell,
						direction,
						grid_size,
						all_arrows_by_cell,
						assigned_depths
					)
					orientation_options.append({
						"head_cell": head_cell,
						"cells": oriented_cells,
						"direction": direction,
						"dependency_depth": option_depth,
					})
			if orientation_options.is_empty():
				continue
			if wave_index > 0 and initial_assignment_count >= maximum_initial_count:
				var blocked_options: Array[Dictionary] = []
				for option: Dictionary in orientation_options:
					if int(option["dependency_depth"]) > 1:
						blocked_options.append(option)
				if not blocked_options.is_empty():
					orientation_options = blocked_options
			var minimum_option_depth := 2147483647
			for option: Dictionary in orientation_options:
				minimum_option_depth = mini(
					minimum_option_depth,
					int(option["dependency_depth"])
				)
			var best_options: Array[Dictionary] = []
			for option: Dictionary in orientation_options:
				if int(option["dependency_depth"]) == minimum_option_depth:
					best_options.append(option)
			var selected: Dictionary = best_options[
				random.randi_range(0, best_options.size() - 1)
			]
			selected["id"] = arrow_data["id"]
			selected["wave_index"] = wave_index
			wave_assignments.append(selected)
		if wave_assignments.is_empty():
			return []
		if wave_index == 0 and maximum_initial_ratio < 1.0:
			if wave_assignments.size() > maximum_initial_count:
				_shuffle_dictionaries(wave_assignments, random)
				wave_assignments.resize(maximum_initial_count)
		var wave_ids: Dictionary = {}
		for assignment: Dictionary in wave_assignments:
			assignments[assignment["id"]] = assignment
			assigned_depths[assignment["id"]] = assignment["dependency_depth"]
			if int(assignment["dependency_depth"]) == 1:
				initial_assignment_count += 1
			wave_ids[assignment["id"]] = true
		for arrow_index: int in range(remaining.size() - 1, -1, -1):
			if wave_ids.has(remaining[arrow_index]["id"]):
				remaining.remove_at(arrow_index)
		wave_index += 1

	var result: Array = []
	for arrow_data: Dictionary in arrows:
		var assignment: Dictionary = assignments[arrow_data["id"]]
		var reassigned: Dictionary = arrow_data.duplicate(true)
		reassigned["head_cell"] = assignment["head_cell"]
		reassigned["cells"] = assignment["cells"]
		reassigned["direction"] = assignment["direction"]
		reassigned["construction_wave"] = assignment["wave_index"]
		result.append(reassigned)
	return result


static func _shuffle_dictionaries(
	values: Array[Dictionary],
	random: RandomNumberGenerator
) -> void:
	for index: int in range(values.size() - 1, 0, -1):
		var swap_index := random.randi_range(0, index)
		var temporary: Dictionary = values[index]
		values[index] = values[swap_index]
		values[swap_index] = temporary


static func _assigned_direction_depth(
	head_cell: Vector2i,
	direction: String,
	grid_size: Vector2i,
	all_arrows_by_cell: Dictionary,
	assigned_depths: Dictionary
) -> int:
	var dependency_depth := 1
	var seen_blockers: Dictionary = {}
	var path_cell: Vector2i = head_cell + PATH_RULE.DIRECTION_VECTORS[direction]
	while _is_cell_in_bounds(path_cell, grid_size):
		if all_arrows_by_cell.has(path_cell):
			var blocker_id: String = all_arrows_by_cell[path_cell]
			if not seen_blockers.has(blocker_id) and assigned_depths.has(blocker_id):
				dependency_depth = maxi(
					dependency_depth,
					int(assigned_depths[blocker_id]) + 1
				)
				seen_blockers[blocker_id] = true
		path_cell += PATH_RULE.DIRECTION_VECTORS[direction]
	return dependency_depth


static func _find_dependency_backbone(
	preferred_depth: int,
	grid_size: Vector2i,
	blocked_cells: Dictionary,
	random: RandomNumberGenerator
) -> Dictionary:
	var candidates: Array[Dictionary] = []
	if preferred_depth <= grid_size.x:
		for y: int in range(1, grid_size.y + 1):
			_append_backbone_candidate(
				candidates,
				Vector2i(1, y),
				Vector2i.RIGHT,
				preferred_depth,
				"LEFT",
				blocked_cells
			)
			_append_backbone_candidate(
				candidates,
				Vector2i(grid_size.x, y),
				Vector2i.LEFT,
				preferred_depth,
				"RIGHT",
				blocked_cells
			)
	if preferred_depth <= grid_size.y:
		for x: int in range(1, grid_size.x + 1):
			_append_backbone_candidate(
				candidates,
				Vector2i(x, 1),
				Vector2i.DOWN,
				preferred_depth,
				"UP",
				blocked_cells
			)
			_append_backbone_candidate(
				candidates,
				Vector2i(x, grid_size.y),
				Vector2i.UP,
				preferred_depth,
				"DOWN",
				blocked_cells
			)
	if candidates.is_empty():
		return {}
	return candidates[random.randi_range(0, candidates.size() - 1)]


static func _append_backbone_candidate(
	candidates: Array[Dictionary],
	edge_cell: Vector2i,
	inward_step: Vector2i,
	preferred_depth: int,
	direction: String,
	blocked_cells: Dictionary
) -> void:
	var cells: Array[Vector2i] = []
	for offset: int in preferred_depth:
		var cell := edge_cell + inward_step * offset
		if blocked_cells.has(cell):
			return
		cells.append(cell)
	candidates.append({"cells": cells, "direction": direction})


static func find_solution_order(arrows: Array, grid_size: Vector2i) -> PackedStringArray:
	var arrows_by_cell := _arrows_by_cell(arrows)
	var arrow_ids := PackedStringArray()
	var in_degrees: Dictionary = {}
	var dependents_by_arrow: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		var arrow_id: String = arrow_data["id"]
		arrow_ids.append(arrow_id)
		in_degrees[arrow_id] = 0
		dependents_by_arrow[arrow_id] = PackedStringArray()
	for arrow_data: Dictionary in arrows:
		var arrow_id: String = arrow_data["id"]
		var seen_blockers: Dictionary = {}
		var direction: Vector2i = PATH_RULE.DIRECTION_VECTORS[arrow_data["direction"]]
		var path_cell: Vector2i = arrow_data["head_cell"] + direction
		while _is_cell_in_bounds(path_cell, grid_size):
			if arrows_by_cell.has(path_cell):
				var blocker_id: String = arrows_by_cell[path_cell]
				if blocker_id != arrow_id and not seen_blockers.has(blocker_id):
					seen_blockers[blocker_id] = true
					in_degrees[arrow_id] = int(in_degrees[arrow_id]) + 1
					var dependents: PackedStringArray = dependents_by_arrow[blocker_id]
					dependents.append(arrow_id)
					dependents_by_arrow[blocker_id] = dependents
			path_cell += direction

	var solution_order := PackedStringArray()
	var processed: Dictionary = {}
	while solution_order.size() < arrow_ids.size():
		var selected_id := ""
		for arrow_id: String in arrow_ids:
			if not processed.has(arrow_id) and int(in_degrees[arrow_id]) == 0:
				selected_id = arrow_id
				break
		if selected_id.is_empty():
			return PackedStringArray()
		processed[selected_id] = true
		solution_order.append(selected_id)
		for dependent_id: String in dependents_by_arrow[selected_id]:
			in_degrees[dependent_id] = int(in_degrees[dependent_id]) - 1
	return solution_order


static func _has_blocked_arrow(arrows: Array, grid_size: Vector2i) -> bool:
	var arrows_by_cell := _arrows_by_cell(arrows)
	for arrow_data: Dictionary in arrows:
		if not _arrow_path_is_clear(arrow_data, arrows_by_cell, grid_size):
			return true
	return false


static func _arrows_by_cell(arrows: Array) -> Dictionary:
	var arrows_by_cell: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		for cell: Vector2i in arrow_data["cells"]:
			arrows_by_cell[cell] = arrow_data["id"]
	return arrows_by_cell


static func _arrow_path_is_clear(
	arrow_data: Dictionary,
	arrows_by_cell: Dictionary,
	grid_size: Vector2i
) -> bool:
	var direction: Vector2i = PATH_RULE.DIRECTION_VECTORS[arrow_data["direction"]]
	var path_cell: Vector2i = arrow_data["head_cell"] + direction
	while _is_cell_in_bounds(path_cell, grid_size):
		if arrows_by_cell.has(path_cell):
			return false
		path_cell += direction
	return true


static func _place_arrow(
	arrow_index: int,
	grid_size: Vector2i,
	min_length: int,
	max_length: int,
	occupied_cells: Dictionary,
	blocked_cells: Dictionary,
	random: RandomNumberGenerator,
	placement_role: String,
	require_clear_existing_path: bool = false
) -> Dictionary:
	if require_clear_existing_path:
		var path_occupied_cells := occupied_cells.duplicate()
		for blocked_cell: Variant in blocked_cells:
			path_occupied_cells[blocked_cell] = true
		var frontier_candidates := _frontier_head_candidates(
			grid_size,
			occupied_cells,
			blocked_cells,
			path_occupied_cells,
			random
		)
		for candidate: Dictionary in frontier_candidates:
			var length := max_length if placement_role == "filler" \
					else random.randi_range(min_length, max_length)
			var head_cell: Vector2i = candidate["head_cell"]
			var cells := _build_body(
				head_cell,
				length,
				grid_size,
				occupied_cells,
				blocked_cells,
				random
			)
			if cells.size() != length:
				continue
			var available_directions := _available_directions(
				head_cell,
				cells,
				grid_size,
				path_occupied_cells
			)
			if not available_directions.has(candidate["direction"]):
				continue
			return {
				"id": _arrow_id(arrow_index),
				"head_cell": head_cell,
				"direction": candidate["direction"],
				"cells": cells,
				"placement_role": placement_role,
				"construction_role": "frontier_reverse_safe",
			}
		return {}

	for _attempt: int in MAX_ARROW_ATTEMPTS:
		var length := random.randi_range(min_length, max_length)
		if length > grid_size.x * grid_size.y - occupied_cells.size():
			continue
		var head_cell := Vector2i(
			random.randi_range(1, grid_size.x),
			random.randi_range(1, grid_size.y)
		)
		if occupied_cells.has(head_cell) or blocked_cells.has(head_cell):
			continue
		var cells := _build_body(
			head_cell,
			length,
			grid_size,
			occupied_cells,
			blocked_cells,
			random
		)
		if cells.size() != length:
			continue
		var available_directions := _available_directions(
			head_cell,
			cells,
			grid_size,
			occupied_cells if require_clear_existing_path else {}
		)
		if available_directions.is_empty():
			continue
		return {
			"id": _arrow_id(arrow_index),
			"head_cell": head_cell,
			"direction": available_directions[
				random.randi_range(0, available_directions.size() - 1)
			],
			"cells": cells,
			"placement_role": placement_role,
		}
	return {}


static func _frontier_head_candidates(
	grid_size: Vector2i,
	occupied_cells: Dictionary,
	blocked_cells: Dictionary,
	path_occupied_cells: Dictionary,
	random: RandomNumberGenerator
) -> Array[Dictionary]:
	var candidates: Array[Dictionary] = []
	var best_centrality := -1
	var row_minimums: Dictionary = {}
	var row_maximums: Dictionary = {}
	var column_minimums: Dictionary = {}
	var column_maximums: Dictionary = {}
	for occupied_value: Variant in path_occupied_cells:
		var occupied_cell: Vector2i = occupied_value
		if not row_minimums.has(occupied_cell.y):
			row_minimums[occupied_cell.y] = occupied_cell.x
			row_maximums[occupied_cell.y] = occupied_cell.x
		else:
			row_minimums[occupied_cell.y] = mini(
				int(row_minimums[occupied_cell.y]),
				occupied_cell.x
			)
			row_maximums[occupied_cell.y] = maxi(
				int(row_maximums[occupied_cell.y]),
				occupied_cell.x
			)
		if not column_minimums.has(occupied_cell.x):
			column_minimums[occupied_cell.x] = occupied_cell.y
			column_maximums[occupied_cell.x] = occupied_cell.y
		else:
			column_minimums[occupied_cell.x] = mini(
				int(column_minimums[occupied_cell.x]),
				occupied_cell.y
			)
			column_maximums[occupied_cell.x] = maxi(
				int(column_maximums[occupied_cell.x]),
				occupied_cell.y
			)
	for y: int in range(1, grid_size.y + 1):
		for x: int in range(1, grid_size.x + 1):
			var head_cell := Vector2i(x, y)
			if occupied_cells.has(head_cell) or blocked_cells.has(head_cell):
				continue
			var directions: Array[String] = []
			if not row_minimums.has(y) or x < int(row_minimums[y]):
				directions.append("LEFT")
			if not row_maximums.has(y) or x > int(row_maximums[y]):
				directions.append("RIGHT")
			if not column_minimums.has(x) or y < int(column_minimums[x]):
				directions.append("UP")
			if not column_maximums.has(x) or y > int(column_maximums[x]):
				directions.append("DOWN")
			if directions.is_empty():
				continue
			var centrality := mini(
				mini(x - 1, grid_size.x - x),
				mini(y - 1, grid_size.y - y)
			)
			if centrality > best_centrality:
				best_centrality = centrality
			for direction: String in directions:
				candidates.append({
					"head_cell": head_cell,
					"direction": direction,
					"centrality": centrality,
				})
	var preferred_candidates: Array[Dictionary] = []
	var centrality_window := 5
	for candidate: Dictionary in candidates:
		if int(candidate["centrality"]) >= best_centrality - centrality_window:
			preferred_candidates.append(candidate)
	for index: int in range(preferred_candidates.size() - 1, 0, -1):
		var swap_index := random.randi_range(0, index)
		var temporary := preferred_candidates[index]
		preferred_candidates[index] = preferred_candidates[swap_index]
		preferred_candidates[swap_index] = temporary
	if preferred_candidates.size() > MAX_ARROW_ATTEMPTS:
		preferred_candidates.resize(MAX_ARROW_ATTEMPTS)
	return preferred_candidates


static func _build_body(
	head_cell: Vector2i,
	length: int,
	grid_size: Vector2i,
	occupied_cells: Dictionary,
	blocked_cells: Dictionary,
	random: RandomNumberGenerator
) -> Array[Vector2i]:
	var cells: Array[Vector2i] = [head_cell]
	var body_cells := {head_cell: true}

	while cells.size() < length:
		var candidates: Array[Vector2i] = []
		for step: Vector2i in STEP_VECTORS:
			var candidate: Vector2i = cells.back() + step
			if _is_cell_in_bounds(candidate, grid_size) \
					and not occupied_cells.has(candidate) \
					and not blocked_cells.has(candidate) \
					and not body_cells.has(candidate):
				candidates.append(candidate)
		if candidates.is_empty():
			return []
		var next_cell: Vector2i = candidates[random.randi_range(0, candidates.size() - 1)]
		cells.append(next_cell)
		body_cells[next_cell] = true

	return cells


static func _available_directions(
	head_cell: Vector2i,
	cells: Array[Vector2i],
	grid_size: Vector2i,
	existing_occupied_cells: Dictionary = {}
) -> Array[String]:
	var body_cells: Dictionary = {}
	for cell: Vector2i in cells:
		body_cells[cell] = true

	var available: Array[String] = []
	for direction_index: int in DIRECTIONS.size():
		var path_cell: Vector2i = head_cell + STEP_VECTORS[direction_index]
		var path_is_blocked := false
		while _is_cell_in_bounds(path_cell, grid_size):
			if body_cells.has(path_cell) or existing_occupied_cells.has(path_cell):
				path_is_blocked = true
				break
			path_cell += STEP_VECTORS[direction_index]
		if not path_is_blocked:
			available.append(DIRECTIONS[direction_index])
	return available


static func _is_cell_in_bounds(cell: Vector2i, grid_size: Vector2i) -> bool:
	return cell.x >= 1 and cell.x <= grid_size.x and cell.y >= 1 and cell.y <= grid_size.y


static func _build_blocked_set(blocked_cells: Array, grid_size: Vector2i) -> Dictionary:
	var blocked_set: Dictionary = {}
	for cell: Variant in blocked_cells:
		if not (cell is Vector2i):
			return {"blocked_set": {}, "error": "Blocked cell must be a Vector2i"}
		if not _is_cell_in_bounds(cell, grid_size):
			return {"blocked_set": {}, "error": "Blocked cell is outside the grid"}
		if blocked_set.has(cell):
			return {"blocked_set": {}, "error": "Blocked cells must be unique"}
		blocked_set[cell] = true
	return {"blocked_set": blocked_set, "error": ""}


static func _arrow_id(index: int) -> String:
	if index < 26:
		return String.chr(65 + index)
	return "A%d" % (index + 1)


static func _build_metrics(
	board_capacity: int,
	occupied_cell_count: int,
	primary_arrow_count: int,
	filler_arrow_count: int,
	target_empty_ratio: float,
	dependency_backbone_depth: int = 0
) -> Dictionary:
	return {
		"occupied_cell_count": occupied_cell_count,
		"actual_empty_ratio": float(board_capacity - occupied_cell_count) / float(board_capacity),
		"target_empty_ratio": target_empty_ratio,
		"primary_arrow_count": primary_arrow_count,
		"filler_arrow_count": filler_arrow_count,
		"dependency_backbone_depth": dependency_backbone_depth,
	}


static func _result(
	arrows: Array,
	solution_order: PackedStringArray,
	error: String,
	metrics: Dictionary = {}
) -> Dictionary:
	return {
		"arrows": arrows,
		"solution_order": solution_order,
		"error": error,
		"metrics": metrics,
	}
