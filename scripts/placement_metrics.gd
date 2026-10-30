class_name PlacementMetrics
extends RefCounted

const DEPENDENCY_ANALYZER := preload("res://scripts/dependency_analyzer.gd")


# Arrows are validated runtime data. Each shared edge is visited once.
static func measure(arrows: Array, grid_size: Vector2i) -> Dictionary:
	if arrows.is_empty():
		return {
			"arrow_count": 0, "occupied_tiles": 0, "contact_count": 0,
			"turn_count": 0, "turn_ratio": 0.0, "blocked_count": 0,
			"blocker_count": 0, "blocked_ratio": 0.0, "blocker_ratio": 0.0,
			"solvable": true, "error": "",
		}
	var analysis: Dictionary = DEPENDENCY_ANALYZER.analyze(arrows, grid_size)
	if not analysis["error"].is_empty():
		return {"error": analysis["error"]}
	var occupied: Dictionary = {}
	var turns := 0
	for arrow: Dictionary in arrows:
		var cells: Array = arrow["cells"]
		for cell: Vector2i in cells:
			occupied[cell] = arrow["id"]
		for index: int in range(1, cells.size() - 1):
			if cells[index] - cells[index - 1] != cells[index + 1] - cells[index]:
				turns += 1
	var contacts := 0
	for cell: Vector2i in occupied:
		for offset: Vector2i in [Vector2i.RIGHT, Vector2i.DOWN]:
			var neighbor: Vector2i = cell + offset
			if occupied.has(neighbor) and occupied[neighbor] != occupied[cell]:
				contacts += 1
	var blocked := 0
	var blockers := 0
	for arrow: Dictionary in arrows:
		var id: String = arrow["id"]
		if not analysis["blockers_by_arrow"][id].is_empty():
			blocked += 1
		for dependent_id: String in analysis["dependents_by_arrow"][id]:
			if dependent_id != id:
				blockers += 1
				break
	return {
		"arrow_count": arrows.size(), "occupied_tiles": occupied.size(),
		"contact_count": contacts, "turn_count": turns,
		"turn_ratio": float(turns) / float(occupied.size()) if not occupied.is_empty() else 0.0,
		"blocked_count": blocked, "blocker_count": blockers,
		"blocked_ratio": float(blocked) / float(arrows.size()),
		"blocker_ratio": float(blockers) / float(arrows.size()),
		"solvable": analysis["has_complete_solution"], "error": "",
	}
