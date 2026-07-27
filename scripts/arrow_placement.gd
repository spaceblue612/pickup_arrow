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


static func generate(
	seed_value: int,
	grid_size: Vector2i,
	arrow_count: int,
	min_length: int = 1,
	max_length: int = 20,
	target_empty_ratio: float = NO_FILL_TARGET,
	filler_max_length: int = 3
) -> Dictionary:
	if grid_size.x <= 0 or grid_size.y <= 0:
		return _result([], PackedStringArray(), "Grid size must be positive")
	if arrow_count <= 0:
		return _result([], PackedStringArray(), "Arrow count must be positive")
	var board_capacity := grid_size.x * grid_size.y
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

	for board_attempt: int in MAX_BOARD_ATTEMPTS:
		var random := RandomNumberGenerator.new()
		random.seed = seed_value + board_attempt * 104729
		var arrows: Array = []
		var occupied_cells: Dictionary = {}
		var placement_failed := false

		for arrow_index: int in arrow_count:
			var placement_max_length := max_length
			if uses_fill_target:
				var remaining_primary_count := arrow_count - arrow_index - 1
				var reserved_primary_cells := remaining_primary_count * min_length
				placement_max_length = mini(
					placement_max_length,
					target_occupied_cells - occupied_cells.size() - reserved_primary_cells
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
				random,
				"primary"
			)
			if arrow_data.is_empty():
				placement_failed = true
				break
			arrows.append(arrow_data)
			for cell: Vector2i in arrow_data["cells"]:
				occupied_cells[cell] = arrow_data["id"]

		while not placement_failed \
				and uses_fill_target \
				and occupied_cells.size() < target_occupied_cells:
			var remaining_target_cells := target_occupied_cells - occupied_cells.size()
			var filler_data := _place_arrow(
				arrows.size(),
				grid_size,
				1,
				mini(filler_max_length, remaining_target_cells),
				occupied_cells,
				random,
				"filler"
			)
			if filler_data.is_empty():
				placement_failed = true
				break
			arrows.append(filler_data)
			for cell: Vector2i in filler_data["cells"]:
				occupied_cells[cell] = filler_data["id"]

		if placement_failed:
			continue

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
					target_empty_ratio
				)
			)

	return _result([], PackedStringArray(), "Could not generate a solvable board")


static func find_solution_order(arrows: Array, grid_size: Vector2i) -> PackedStringArray:
	var remaining_arrows: Array = arrows.duplicate(true)
	var solution_order := PackedStringArray()

	while not remaining_arrows.is_empty():
		var extractable_index := -1
		for index: int in remaining_arrows.size():
			var arrow_id: String = remaining_arrows[index]["id"]
			if PATH_RULE.evaluate(arrow_id, remaining_arrows, grid_size)["is_extractable"]:
				extractable_index = index
				break
		if extractable_index < 0:
			return PackedStringArray()
		solution_order.append(remaining_arrows[extractable_index]["id"])
		remaining_arrows.remove_at(extractable_index)

	return solution_order


static func _has_blocked_arrow(arrows: Array, grid_size: Vector2i) -> bool:
	for arrow_data: Dictionary in arrows:
		if not PATH_RULE.evaluate(arrow_data["id"], arrows, grid_size)["is_extractable"]:
			return true
	return false


static func _place_arrow(
	arrow_index: int,
	grid_size: Vector2i,
	min_length: int,
	max_length: int,
	occupied_cells: Dictionary,
	random: RandomNumberGenerator,
	placement_role: String
) -> Dictionary:
	for _attempt: int in MAX_ARROW_ATTEMPTS:
		var length := random.randi_range(min_length, max_length)
		if length > grid_size.x * grid_size.y - occupied_cells.size():
			continue
		var head_cell := Vector2i(
			random.randi_range(1, grid_size.x),
			random.randi_range(1, grid_size.y)
		)
		if occupied_cells.has(head_cell):
			continue
		var cells := _build_body(head_cell, length, grid_size, occupied_cells, random)
		if cells.size() != length:
			continue
		var available_directions := _available_directions(head_cell, cells, grid_size)
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


static func _build_body(
	head_cell: Vector2i,
	length: int,
	grid_size: Vector2i,
	occupied_cells: Dictionary,
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
	grid_size: Vector2i
) -> Array[String]:
	var body_cells: Dictionary = {}
	for cell: Vector2i in cells:
		body_cells[cell] = true

	var available: Array[String] = []
	for direction_index: int in DIRECTIONS.size():
		var path_cell: Vector2i = head_cell + STEP_VECTORS[direction_index]
		var has_own_body_ahead := false
		while _is_cell_in_bounds(path_cell, grid_size):
			if body_cells.has(path_cell):
				has_own_body_ahead = true
				break
			path_cell += STEP_VECTORS[direction_index]
		if not has_own_body_ahead:
			available.append(DIRECTIONS[direction_index])
	return available


static func _is_cell_in_bounds(cell: Vector2i, grid_size: Vector2i) -> bool:
	return cell.x >= 1 and cell.x <= grid_size.x and cell.y >= 1 and cell.y <= grid_size.y


static func _arrow_id(index: int) -> String:
	if index < 26:
		return String.chr(65 + index)
	return "A%d" % (index + 1)


static func _build_metrics(
	board_capacity: int,
	occupied_cell_count: int,
	primary_arrow_count: int,
	filler_arrow_count: int,
	target_empty_ratio: float
) -> Dictionary:
	return {
		"occupied_cell_count": occupied_cell_count,
		"actual_empty_ratio": float(board_capacity - occupied_cell_count) / float(board_capacity),
		"target_empty_ratio": target_empty_ratio,
		"primary_arrow_count": primary_arrow_count,
		"filler_arrow_count": filler_arrow_count,
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
