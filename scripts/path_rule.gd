class_name PathRule
extends RefCounted

const DIRECTION_VECTORS := {
	"UP": Vector2i(0, -1),
	"DOWN": Vector2i(0, 1),
	"LEFT": Vector2i(-1, 0),
	"RIGHT": Vector2i(1, 0),
}


static func evaluate(selected_arrow_id: String, remaining_arrows: Array, grid_size: Vector2i) -> Dictionary:
	var selected_arrow := _find_arrow(selected_arrow_id, remaining_arrows)
	if selected_arrow.is_empty():
		return _result(false, PackedStringArray(), "Selected arrow is not remaining")

	var direction: String = selected_arrow["direction"]
	if not DIRECTION_VECTORS.has(direction):
		return _result(false, PackedStringArray(), "Selected arrow has an invalid direction")

	var arrows_by_cell: Dictionary = {}
	for arrow_data: Dictionary in remaining_arrows:
		if not arrow_data.has("cells") or not (arrow_data["cells"] is Array):
			return _result(false, PackedStringArray(), "Arrow body cells are invalid")
		for occupied_cell: Vector2i in arrow_data["cells"]:
			arrows_by_cell[occupied_cell] = arrow_data["id"]

	var blockers := blocking_arrow_ids(selected_arrow, arrows_by_cell, grid_size)
	return _result(blockers.is_empty(), blockers, "")


# These indexed helpers accept runtime arrow data already checked by StageValidator.
# Callers analyzing an entire board build the occupancy index only once.
static func index_cells(arrows: Array) -> Dictionary:
	var arrows_by_cell: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		for cell: Vector2i in arrow_data["cells"]:
			arrows_by_cell[cell] = arrow_data["id"]
	return arrows_by_cell


static func blocking_arrow_ids(
	arrow_data: Dictionary,
	arrows_by_cell: Dictionary,
	grid_size: Vector2i
) -> PackedStringArray:
	var blocking_ids := PackedStringArray()
	var seen_blockers: Dictionary = {}
	var direction: Vector2i = DIRECTION_VECTORS[arrow_data["direction"]]
	var path_cell: Vector2i = arrow_data["head_cell"] + direction
	while _is_cell_in_bounds(path_cell, grid_size):
		if arrows_by_cell.has(path_cell):
			var blocker_id: String = arrows_by_cell[path_cell]
			if not seen_blockers.has(blocker_id):
				seen_blockers[blocker_id] = true
				blocking_ids.append(blocker_id)
		path_cell += direction
	return blocking_ids


static func _find_arrow(arrow_id: String, arrows: Array) -> Dictionary:
	for arrow_data: Dictionary in arrows:
		if arrow_data["id"] == arrow_id:
			return arrow_data
	return {}


static func _is_cell_in_bounds(cell: Vector2i, grid_size: Vector2i) -> bool:
	return cell.x >= 1 and cell.x <= grid_size.x and cell.y >= 1 and cell.y <= grid_size.y


static func _result(is_extractable: bool, blocking_arrow_ids: PackedStringArray, error: String) -> Dictionary:
	return {
		"is_extractable": is_extractable,
		"blocking_arrow_ids": blocking_arrow_ids,
		"error": error,
	}
