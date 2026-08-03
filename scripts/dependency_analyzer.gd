class_name DependencyAnalyzer
extends RefCounted

const PATH_RULE := preload("res://scripts/path_rule.gd")


static func analyze(arrows: Array, grid_size: Vector2i) -> Dictionary:
	var result := _empty_result()
	var input_error := _validate_input(arrows, grid_size)
	if not input_error.is_empty():
		result["error"] = input_error
		return result

	var arrow_ids := PackedStringArray()
	var blockers_by_arrow: Dictionary = {}
	var dependents_by_arrow: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		var arrow_id: String = arrow_data["id"]
		arrow_ids.append(arrow_id)
		blockers_by_arrow[arrow_id] = PackedStringArray()
		dependents_by_arrow[arrow_id] = PackedStringArray()

	var edge_count := 0
	var arrows_by_cell := _arrows_by_cell(arrows)
	for arrow_id: String in arrow_ids:
		var selected_arrow := _find_arrow(arrow_id, arrows)
		for blocker_id: String in _blocking_arrow_ids(selected_arrow, arrows_by_cell, grid_size):
			if not dependents_by_arrow.has(blocker_id):
				result["error"] = "Path rule returned an unknown blocker: %s" % blocker_id
				return result
			var blockers: PackedStringArray = blockers_by_arrow[arrow_id]
			blockers.append(blocker_id)
			blockers_by_arrow[arrow_id] = blockers
			var dependents: PackedStringArray = dependents_by_arrow[blocker_id]
			dependents.append(arrow_id)
			dependents_by_arrow[blocker_id] = dependents
			edge_count += 1

	var topology: Dictionary = _analyze_topology(
		arrow_ids,
		blockers_by_arrow,
		dependents_by_arrow
	)
	var simulation: Dictionary = _simulate_solution(arrows, grid_size)
	var choice_counts: PackedInt32Array = simulation["choice_counts"]
	var initial_extractable_count := 0
	if not choice_counts.is_empty():
		initial_extractable_count = choice_counts[0]

	result["node_count"] = arrows.size()
	result["edge_count"] = edge_count
	result["blockers_by_arrow"] = blockers_by_arrow
	result["dependents_by_arrow"] = dependents_by_arrow
	result["dependency_depth"] = topology["dependency_depth"]
	result["is_acyclic"] = topology["is_acyclic"]
	result["initial_extractable_count"] = initial_extractable_count
	result["initial_extractable_ratio"] = float(initial_extractable_count) / float(arrows.size())
	result["forced_state_count"] = simulation["forced_state_count"]
	result["forced_state_ratio"] = simulation["forced_state_ratio"]
	result["average_choice_count"] = simulation["average_choice_count"]
	result["choice_counts"] = choice_counts
	result["has_complete_solution"] = simulation["has_complete_solution"]
	result["solution_order"] = simulation["solution_order"]
	return result


static func _analyze_topology(
	arrow_ids: PackedStringArray,
	blockers_by_arrow: Dictionary,
	dependents_by_arrow: Dictionary
) -> Dictionary:
	var in_degrees: Dictionary = {}
	var depths: Dictionary = {}
	var ready := PackedStringArray()
	for arrow_id: String in arrow_ids:
		var blockers: PackedStringArray = blockers_by_arrow[arrow_id]
		in_degrees[arrow_id] = blockers.size()
		depths[arrow_id] = 1
		if blockers.is_empty():
			ready.append(arrow_id)

	var processed_count := 0
	var ready_index := 0
	var dependency_depth := 0
	while ready_index < ready.size():
		var arrow_id: String = ready[ready_index]
		ready_index += 1
		processed_count += 1
		dependency_depth = maxi(dependency_depth, depths[arrow_id])
		var dependents: PackedStringArray = dependents_by_arrow[arrow_id]
		for dependent_id: String in dependents:
			depths[dependent_id] = maxi(depths[dependent_id], depths[arrow_id] + 1)
			in_degrees[dependent_id] -= 1
			if in_degrees[dependent_id] == 0:
				ready.append(dependent_id)

	var is_acyclic := processed_count == arrow_ids.size()
	return {
		"is_acyclic": is_acyclic,
		"dependency_depth": dependency_depth if is_acyclic else 0,
	}


static func _simulate_solution(arrows: Array, grid_size: Vector2i) -> Dictionary:
	var remaining: Array = arrows.duplicate(true)
	var arrows_by_cell := _arrows_by_cell(remaining)
	var solution_order := PackedStringArray()
	var choice_counts := PackedInt32Array()
	var forced_state_count := 0
	var total_choice_count := 0

	while not remaining.is_empty():
		var extractable_ids := PackedStringArray()
		for arrow_data: Dictionary in remaining:
			var arrow_id: String = arrow_data["id"]
			if _blocking_arrow_ids(arrow_data, arrows_by_cell, grid_size).is_empty():
				extractable_ids.append(arrow_id)
		if extractable_ids.is_empty():
			break

		choice_counts.append(extractable_ids.size())
		total_choice_count += extractable_ids.size()
		if extractable_ids.size() == 1:
			forced_state_count += 1

		var selected_id: String = extractable_ids[0]
		solution_order.append(selected_id)
		for arrow_index: int in remaining.size():
			if remaining[arrow_index]["id"] == selected_id:
				for cell: Vector2i in remaining[arrow_index]["cells"]:
					arrows_by_cell.erase(cell)
				remaining.remove_at(arrow_index)
				break

	var measured_state_count := choice_counts.size()
	return {
		"choice_counts": choice_counts,
		"forced_state_count": forced_state_count,
		"forced_state_ratio": (
			float(forced_state_count) / float(measured_state_count)
			if measured_state_count > 0
			else 0.0
		),
		"average_choice_count": (
			float(total_choice_count) / float(measured_state_count)
			if measured_state_count > 0
			else 0.0
		),
		"has_complete_solution": remaining.is_empty(),
		"solution_order": solution_order,
	}


static func _arrows_by_cell(arrows: Array) -> Dictionary:
	var arrows_by_cell: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		for cell: Vector2i in arrow_data["cells"]:
			arrows_by_cell[cell] = arrow_data["id"]
	return arrows_by_cell


static func _find_arrow(arrow_id: String, arrows: Array) -> Dictionary:
	for arrow_data: Dictionary in arrows:
		if arrow_data["id"] == arrow_id:
			return arrow_data
	return {}


static func _blocking_arrow_ids(
	arrow_data: Dictionary,
	arrows_by_cell: Dictionary,
	grid_size: Vector2i
) -> PackedStringArray:
	var blocking_ids := PackedStringArray()
	var direction: Vector2i = PATH_RULE.DIRECTION_VECTORS[arrow_data["direction"]]
	var path_cell: Vector2i = arrow_data["head_cell"] + direction
	while path_cell.x >= 1 and path_cell.x <= grid_size.x \
			and path_cell.y >= 1 and path_cell.y <= grid_size.y:
		if arrows_by_cell.has(path_cell):
			var blocker_id: String = arrows_by_cell[path_cell]
			if not blocking_ids.has(blocker_id):
				blocking_ids.append(blocker_id)
		path_cell += direction
	return blocking_ids


static func _validate_input(arrows: Array, grid_size: Vector2i) -> String:
	if grid_size.x <= 0 or grid_size.y <= 0:
		return "Grid size must be positive"
	if arrows.is_empty():
		return "At least one arrow is required"

	var seen_ids: Dictionary = {}
	for arrow_data: Variant in arrows:
		if not (arrow_data is Dictionary):
			return "Arrow data must be a dictionary"
		if not arrow_data.has("id") \
				or not arrow_data.has("head_cell") \
				or not arrow_data.has("cells") \
				or not arrow_data.has("direction"):
			return "Arrow data requires id, head_cell, cells, and direction"
		var arrow_id: Variant = arrow_data["id"]
		if not (arrow_id is String) or arrow_id.is_empty():
			return "Arrow ID must be a non-empty string"
		if seen_ids.has(arrow_id):
			return "Duplicate arrow ID: %s" % arrow_id
		seen_ids[arrow_id] = true
	return ""


static func _empty_result() -> Dictionary:
	return {
		"node_count": 0,
		"edge_count": 0,
		"blockers_by_arrow": {},
		"dependents_by_arrow": {},
		"dependency_depth": 0,
		"is_acyclic": false,
		"initial_extractable_count": 0,
		"initial_extractable_ratio": 0.0,
		"forced_state_count": 0,
		"forced_state_ratio": 0.0,
		"average_choice_count": 0.0,
		"choice_counts": PackedInt32Array(),
		"has_complete_solution": false,
		"solution_order": PackedStringArray(),
		"error": "",
	}
