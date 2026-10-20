extends RefCounted

const VALIDATOR := preload("res://scripts/stage_validator.gd")
const CODEC := preload("res://scripts/bridge/stage_json_codec.gd")


static func reshape(stage: Dictionary, arrow_id: String, raw_cells: Array, minimum_length: int) -> Dictionary:
	var candidate := CODEC.encode_stage(stage)
	var index := -1
	for i: int in candidate["arrows"].size():
		if candidate["arrows"][i]["id"] == arrow_id:
			index = i
			break
	if index < 0:
		return _result(false, stage, ["Arrow not found"])
	var arrow: Dictionary = candidate["arrows"][index]
	arrow["cells"] = raw_cells
	arrow["head_cell"] = raw_cells[0]
	var decoded := CODEC.decode_stage(candidate)
	if not decoded["errors"].is_empty():
		return _result(false, stage, decoded["errors"])
	var changed: Dictionary = decoded["stage"]
	arrow = changed["arrows"][index]
	var cells: Array = arrow["cells"]
	# The direction is derived, never independently chosen by the editor.
	arrow["direction"] = "INVALID"
	if cells.size() >= 2:
		var vector: Vector2i = cells[0] - cells[1]
		for direction: String in VALIDATOR.DIRECTION_VECTORS:
			if VALIDATOR.DIRECTION_VECTORS[direction] == vector:
				arrow["direction"] = direction
				break
	var validation := VALIDATOR.validate_stage(changed, minimum_length)
	if not validation["is_valid"]:
		return _result(false, stage, validation["errors"])
	return _result(true, changed, [])


static func _result(accepted: bool, stage: Dictionary, errors: Variant) -> Dictionary:
	return {"accepted": accepted, "event": "arrow_reshaped" if accepted else "reshape_blocked", "errors": errors, "stage": CODEC.encode_stage(stage)}
