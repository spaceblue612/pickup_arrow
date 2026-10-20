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
	var arrows_by_id: Dictionary = {}
	var blockers_by_arrow: Dictionary = {}
	var dependents_by_arrow: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		var arrow_id: String = arrow_data["id"]
		arrow_ids.append(arrow_id)
		arrows_by_id[arrow_id] = arrow_data
		blockers_by_arrow[arrow_id] = PackedStringArray()
		dependents_by_arrow[arrow_id] = PackedStringArray()

	var edge_count := 0
	var arrows_by_cell := PATH_RULE.index_cells(arrows)
	for arrow_id: String in arrow_ids:
		var selected_arrow: Dictionary = arrows_by_id[arrow_id]
		for blocker_id: String in PATH_RULE.blocking_arrow_ids(selected_arrow, arrows_by_cell, grid_size):
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
	var simulation: Dictionary = _simulate_dependency_graph(
		arrow_ids,
		blockers_by_arrow,
		dependents_by_arrow
	)
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


static func _simulate_dependency_graph(
	arrow_ids: PackedStringArray,
	blockers_by_arrow: Dictionary,
	dependents_by_arrow: Dictionary
) -> Dictionary:
	var in_degrees: Dictionary = {}
	var processed: Dictionary = {}
	var ready_count := 0
	for arrow_id: String in arrow_ids:
		var blocker_count: int = blockers_by_arrow[arrow_id].size()
		in_degrees[arrow_id] = blocker_count
		if blocker_count == 0:
			ready_count += 1

	var solution_order := PackedStringArray()
	var choice_counts := PackedInt32Array()
	var forced_state_count := 0
	var total_choice_count := 0

	while solution_order.size() < arrow_ids.size():
		if ready_count == 0:
			break

		choice_counts.append(ready_count)
		total_choice_count += ready_count
		if ready_count == 1:
			forced_state_count += 1

		var selected_id := ""
		for arrow_id: String in arrow_ids:
			if not processed.has(arrow_id) and int(in_degrees[arrow_id]) == 0:
				selected_id = arrow_id
				break
		if selected_id.is_empty():
			break
		processed[selected_id] = true
		ready_count -= 1
		solution_order.append(selected_id)
		for dependent_id: String in dependents_by_arrow[selected_id]:
			in_degrees[dependent_id] = int(in_degrees[dependent_id]) - 1
			if int(in_degrees[dependent_id]) == 0:
				ready_count += 1

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
		"has_complete_solution": solution_order.size() == arrow_ids.size(),
		"solution_order": solution_order,
	}


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
