class_name StageJsonCodec
extends RefCounted


# Only runtime fields cross this boundary. Profiles and measured metrics are separate data.
static func decode_stage(value: Variant) -> Dictionary:
	var errors := PackedStringArray()
	if not (value is Dictionary):
		return {"stage": {}, "errors": PackedStringArray(["Stage must be an object"])}
	var stage: Dictionary = {}
	for field: String in ["id", "grid_size", "arrows"]:
		if not value.has(field):
			errors.append("Missing stage field: %s" % field)
	stage["id"] = value.get("id")
	stage["grid_size"] = _decode_cell(value.get("grid_size"), "grid_size", errors)
	stage["blocked_cells"] = _decode_cells(value.get("blocked_cells", []), "blocked_cells", errors)
	var arrow_values: Variant = value.get("arrows")
	var arrows: Array = []
	if not (arrow_values is Array):
		errors.append("arrows must be an array")
	else:
		for index: int in arrow_values.size():
			var arrow_value: Variant = arrow_values[index]
			var prefix := "arrows[%d]" % index
			if not (arrow_value is Dictionary):
				errors.append("%s must be an object" % prefix)
				continue
			for field: String in ["id", "head_cell", "cells", "direction"]:
				if not arrow_value.has(field):
					errors.append("Missing %s.%s" % [prefix, field])
			arrows.append({
				"id": arrow_value.get("id"),
				"head_cell": _decode_cell(arrow_value.get("head_cell"), prefix + ".head_cell", errors),
				"cells": _decode_cells(arrow_value.get("cells"), prefix + ".cells", errors),
				"direction": arrow_value.get("direction"),
			})
	stage["arrows"] = arrows
	return {"stage": stage, "errors": errors}


static func encode_stage(stage: Dictionary) -> Dictionary:
	var arrows: Array = []
	for arrow: Dictionary in stage["arrows"]:
		arrows.append({
			"id": arrow["id"],
			"head_cell": arrow["head_cell"],
			"cells": arrow["cells"],
			"direction": arrow["direction"],
		})
	return to_json_value({
		"id": stage["id"],
		"grid_size": stage["grid_size"],
		"blocked_cells": stage.get("blocked_cells", []),
		"arrows": arrows,
	})


static func to_json_value(value: Variant) -> Variant:
	if value is Vector2i:
		return [value.x, value.y]
	if value is Dictionary:
		var result: Dictionary = {}
		for key: Variant in value:
			result[key] = to_json_value(value[key])
		return result
	if value is Array or value is PackedStringArray or value is PackedInt32Array:
		var result: Array = []
		for item: Variant in value:
			result.append(to_json_value(item))
		return result
	return value


static func _decode_cells(value: Variant, field: String, errors: PackedStringArray) -> Array:
	var cells: Array = []
	if not (value is Array):
		errors.append("%s must be an array" % field)
		return cells
	for index: int in value.size():
		cells.append(_decode_cell(value[index], "%s[%d]" % [field, index], errors))
	return cells


static func _decode_cell(value: Variant, field: String, errors: PackedStringArray) -> Vector2i:
	if value is Array and value.size() == 2 and _is_coordinate(value[0]) and _is_coordinate(value[1]):
		return Vector2i(int(value[0]), int(value[1]))
	errors.append("%s must contain two 32-bit integers" % field)
	return Vector2i.ZERO


static func _is_coordinate(value: Variant) -> bool:
	if not (value is int or value is float):
		return false
	return is_finite(float(value)) and value == floor(value) \
		and value >= -2147483648 and value <= 2147483647
