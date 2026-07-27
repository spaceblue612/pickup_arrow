class_name StageCatalog
extends RefCounted

const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")

const GRID_SIZE := Vector2i(9, 9)
const STAGE_IDS := ["STAGE-001", "STAGE-002", "STAGE-003"]
const CARDINAL_DIRECTIONS := ["UP", "DOWN", "LEFT", "RIGHT"]
const MIN_ARROW_LENGTH := 1
const MAX_ARROW_LENGTH := GRID_SIZE.x * GRID_SIZE.y

const STAGE_CONFIGS: Dictionary = {
	"STAGE-001": {
		"seed": 1001,
		"primary_arrow_count": 3,
		"min_length": 1,
		"max_length": 6,
		"target_empty_ratio": 0.70,
		"filler_max_length": 3,
		"dependency_target": {
			"min_dependency_depth": 2,
			"max_dependency_depth": 4,
			"min_initial_extractable_ratio": 0.50,
			"max_initial_extractable_ratio": 1.00,
			"min_forced_state_ratio": 0.00,
			"max_forced_state_ratio": 0.25,
		},
		"max_candidate_attempts": 64,
	},
	"STAGE-002": {
		"seed": 2002,
		"primary_arrow_count": 4,
		"min_length": 3,
		"max_length": 10,
		"target_empty_ratio": 0.55,
		"filler_max_length": 3,
		"dependency_target": {
			"min_dependency_depth": 3,
			"max_dependency_depth": 5,
			"min_initial_extractable_ratio": 0.30,
			"max_initial_extractable_ratio": 0.60,
			"min_forced_state_ratio": 0.10,
			"max_forced_state_ratio": 0.40,
		},
		"max_candidate_attempts": 64,
	},
	"STAGE-003": {
		"seed": 3003,
		"primary_arrow_count": 5,
		"min_length": 5,
		"max_length": 14,
		"target_empty_ratio": 0.40,
		"filler_max_length": 3,
		"dependency_target": {
			"min_dependency_depth": 4,
			"max_dependency_depth": 8,
			"min_initial_extractable_ratio": 0.00,
			"max_initial_extractable_ratio": 0.40,
			"min_forced_state_ratio": 0.20,
			"max_forced_state_ratio": 1.00,
		},
		"max_candidate_attempts": 64,
	},
}


static func get_stage(stage_id: String) -> Dictionary:
	if not STAGE_CONFIGS.has(stage_id):
		push_error("Unknown stage ID: %s" % stage_id)
		return {}

	var config: Dictionary = STAGE_CONFIGS[stage_id]
	var generation: Dictionary = DEPENDENCY_TARGETING.select(
		config["seed"],
		GRID_SIZE,
		config["primary_arrow_count"],
		config["min_length"],
		config["max_length"],
		config["target_empty_ratio"],
		config["filler_max_length"],
		config["dependency_target"],
		config["max_candidate_attempts"]
	)
	if not generation["error"].is_empty():
		push_error("Stage generation failed for %s: %s" % [stage_id, generation["error"]])
		return {}

	var stage_definition := {
		"id": stage_id,
		"grid_size": GRID_SIZE,
		"arrows": generation["arrows"],
		"solution_order": generation["solution_order"],
		"generation_profile": config.duplicate(true),
		"generation_metrics": generation["generation_metrics"],
		"dependency_analysis": generation["dependency_analysis"],
		"dependency_target": config["dependency_target"].duplicate(true),
		"dependency_targeting_metrics": generation["dependency_targeting_metrics"],
	}
	var validation := validate_stage(stage_definition)
	if not validation["is_valid"]:
		push_error("Invalid stage definition %s: %s" % [stage_id, ", ".join(validation["errors"])])
		return {}
	return stage_definition


static func validate_stage(stage_definition: Dictionary) -> Dictionary:
	var errors := PackedStringArray()
	if not stage_definition.has("id"):
		errors.append("Stage ID is required")
	if not stage_definition.has("grid_size"):
		errors.append("Grid size is required")
	if not stage_definition.has("arrows"):
		errors.append("Arrows are required")
	if not errors.is_empty():
		return _validation_result(errors)

	var grid_size: Variant = stage_definition["grid_size"]
	if not (grid_size is Vector2i) or grid_size != GRID_SIZE:
		errors.append("Grid size must be %s" % GRID_SIZE)

	var arrows: Variant = stage_definition["arrows"]
	if not (arrows is Array) or arrows.is_empty():
		errors.append("At least one arrow is required")
		return _validation_result(errors)

	var seen_arrow_ids: Dictionary = {}
	var occupied_cells: Dictionary = {}
	for arrow_data: Variant in arrows:
		if not (arrow_data is Dictionary):
			errors.append("Arrow data must be a dictionary")
			continue
		if not arrow_data.has("id") \
				or not arrow_data.has("head_cell") \
				or not arrow_data.has("cells") \
				or not arrow_data.has("direction"):
			errors.append("Arrow data requires id, head_cell, cells, and direction")
			continue

		var arrow_id: Variant = arrow_data["id"]
		var head_cell: Variant = arrow_data["head_cell"]
		var cells: Variant = arrow_data["cells"]
		var direction: Variant = arrow_data["direction"]
		if not (arrow_id is String) or arrow_id.is_empty():
			errors.append("Arrow ID must be a non-empty string")
		elif seen_arrow_ids.has(arrow_id):
			errors.append("Duplicate arrow ID: %s" % arrow_id)
		else:
			seen_arrow_ids[arrow_id] = true

		if not (cells is Array) \
				or cells.size() < MIN_ARROW_LENGTH \
				or cells.size() > MAX_ARROW_LENGTH:
			errors.append(
				"Arrow %s length must be within 1..%d" % [arrow_id, MAX_ARROW_LENGTH]
			)
			continue
		if not (head_cell is Vector2i) or head_cell != cells[0]:
			errors.append("Arrow %s head_cell must be the first body cell" % arrow_id)

		var own_cells: Dictionary = {}
		for cell_index: int in cells.size():
			var cell: Variant = cells[cell_index]
			if not (cell is Vector2i):
				errors.append("Arrow %s has an invalid body cell" % arrow_id)
				continue
			if not _is_cell_in_bounds(cell):
				errors.append("Arrow %s is outside the grid" % arrow_id)
			if own_cells.has(cell):
				errors.append("Arrow %s has a duplicate body cell" % arrow_id)
			else:
				own_cells[cell] = true
			if occupied_cells.has(cell):
				errors.append("Arrow bodies overlap at %s" % cell)
			else:
				occupied_cells[cell] = arrow_id
			if cell_index > 0:
				var previous_cell: Vector2i = cells[cell_index - 1]
				if absi(cell.x - previous_cell.x) + absi(cell.y - previous_cell.y) != 1:
					errors.append("Arrow %s body cells must be cardinally connected" % arrow_id)

		if not (direction is String) or not CARDINAL_DIRECTIONS.has(direction):
			errors.append("Arrow %s has a non-cardinal direction" % arrow_id)

	return _validation_result(errors)


static func _is_cell_in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 1 and cell.x <= GRID_SIZE.x and cell.y >= 1 and cell.y <= GRID_SIZE.y


static func _validation_result(errors: PackedStringArray) -> Dictionary:
	return {
		"is_valid": errors.is_empty(),
		"errors": errors,
	}
