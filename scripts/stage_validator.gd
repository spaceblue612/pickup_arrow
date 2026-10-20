class_name StageValidator
extends RefCounted

const PATH_RULE := preload("res://scripts/path_rule.gd")
const DIRECTION_VECTORS := PATH_RULE.DIRECTION_VECTORS
const CARDINAL_DIRECTIONS := ["UP", "DOWN", "LEFT", "RIGHT"]
const MIN_ARROW_LENGTH := 1
const AUTHORING_MIN_ARROW_LENGTH := 2
const MAX_GRID_SIDE := 999
const MAX_BOARD_CELL_COUNT := 10000


static func validate_grid_size(grid_size: Vector2i) -> String:
	if grid_size.x <= 0 or grid_size.y <= 0:
		return "Grid size must be positive"
	if grid_size.x > MAX_GRID_SIDE or grid_size.y > MAX_GRID_SIDE:
		return "Grid side exceeds maximum %d" % MAX_GRID_SIDE
	if grid_size.x * grid_size.y > MAX_BOARD_CELL_COUNT:
		return "Grid cell count exceeds maximum %d" % MAX_BOARD_CELL_COUNT
	return ""


static func validate_stage(stage_definition: Dictionary, minimum_arrow_length: int = MIN_ARROW_LENGTH) -> Dictionary:
	var errors := PackedStringArray()
	if not stage_definition.has("id"):
		errors.append("Stage ID is required")
	if not stage_definition.has("grid_size"):
		errors.append("Grid size is required")
	if not stage_definition.has("arrows"):
		errors.append("Arrows are required")
	if not errors.is_empty():
		return _validation_result(errors)

	if not (stage_definition["id"] is String) or stage_definition["id"].strip_edges().is_empty():
		errors.append("Stage ID must be a non-empty string")

	var grid_size_value: Variant = stage_definition["grid_size"]
	if not (grid_size_value is Vector2i):
		errors.append("Grid size must be a Vector2i")
		return _validation_result(errors)
	var grid_size: Vector2i = grid_size_value
	var grid_error := validate_grid_size(grid_size)
	if not grid_error.is_empty():
		errors.append(grid_error)
		return _validation_result(errors)

	var blocked_value: Variant = stage_definition.get("blocked_cells", [])
	if not (blocked_value is Array):
		errors.append("Blocked cells must be an array")
		return _validation_result(errors)
	var blocked_cells: Array = blocked_value
	var blocked_set: Dictionary = {}
	for blocked_cell: Variant in blocked_cells:
		if not (blocked_cell is Vector2i):
			errors.append("Blocked cell must be a Vector2i")
			continue
		if not _is_cell_in_bounds(blocked_cell, grid_size):
			errors.append("Blocked cell is outside the grid: %s" % blocked_cell)
		if blocked_set.has(blocked_cell):
			errors.append("Duplicate blocked cell: %s" % blocked_cell)
		else:
			blocked_set[blocked_cell] = true
	var playable_cell_count := grid_size.x * grid_size.y - blocked_set.size()
	if playable_cell_count <= 0:
		errors.append("At least one playable cell is required")

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
		if not (arrow_id is String) or arrow_id.strip_edges().is_empty():
			errors.append("Arrow ID must be a non-empty string")
		elif seen_arrow_ids.has(arrow_id):
			errors.append("Duplicate arrow ID: %s" % arrow_id)
		else:
			seen_arrow_ids[arrow_id] = true
		var arrow_label := str(arrow_id)

		if not (cells is Array) \
				or cells.size() < minimum_arrow_length \
				or cells.size() > playable_cell_count:
			errors.append(
				"Arrow %s length must be within %d..%d" % [arrow_label, minimum_arrow_length, playable_cell_count]
			)
			continue
		if not (head_cell is Vector2i) or head_cell != cells[0]:
			errors.append("Arrow %s head_cell must be the first body cell" % arrow_label)

		var own_cells: Dictionary = {}
		for cell_index: int in cells.size():
			var cell: Variant = cells[cell_index]
			if not (cell is Vector2i):
				errors.append("Arrow %s has an invalid body cell" % arrow_label)
				continue
			if not _is_cell_in_bounds(cell, grid_size):
				errors.append("Arrow %s is outside the grid" % arrow_label)
			if blocked_set.has(cell):
				errors.append("Arrow %s occupies a blocked cell: %s" % [arrow_label, cell])
			if own_cells.has(cell):
				errors.append("Arrow %s has a duplicate body cell" % arrow_label)
			else:
				own_cells[cell] = true
			if occupied_cells.has(cell):
				errors.append("Arrow bodies overlap at %s" % cell)
			else:
				occupied_cells[cell] = arrow_id
			if cell_index > 0 and cells[cell_index - 1] is Vector2i:
				var previous_cell: Vector2i = cells[cell_index - 1]
				if absi(cell.x - previous_cell.x) + absi(cell.y - previous_cell.y) != 1:
					errors.append("Arrow %s body cells must be cardinally connected" % arrow_label)

		if not (direction is String) or not CARDINAL_DIRECTIONS.has(direction):
			errors.append("Arrow %s has a non-cardinal direction" % arrow_label)
		elif cells.size() > 1 and head_cell is Vector2i and cells[0] is Vector2i and cells[1] is Vector2i:
			var expected_first_body_cell: Vector2i = head_cell - DIRECTION_VECTORS[direction]
			if cells[1] != expected_first_body_cell:
				errors.append("Arrow %s bends at the arrowhead" % arrow_label)

	return _validation_result(errors)


static func _is_cell_in_bounds(cell: Vector2i, grid_size: Vector2i) -> bool:
	return cell.x >= 1 and cell.x <= grid_size.x and cell.y >= 1 and cell.y <= grid_size.y


static func _validation_result(errors: PackedStringArray) -> Dictionary:
	return {"is_valid": errors.is_empty(), "errors": errors}

