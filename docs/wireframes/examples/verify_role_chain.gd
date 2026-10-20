extends SceneTree

# Documentation example only: game rules come from the shared Godot core.
# godot --headless --path . --script docs/wireframes/examples/verify_role_chain.gd
const CORE := preload("res://scripts/bridge/core_request.gd")
const CODEC := preload("res://scripts/bridge/stage_json_codec.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")
const EXAMPLE_PATH := "res://docs/wireframes/examples/role_chain.json"
const ORDER := ["Z", "H", "G", "A", "B", "C"]
const EXPECTED_AVAILABLE := [["Z"], ["H"], ["G"], ["A", "B", "C"], ["B", "C"], ["C"], []]


func _init() -> void:
	var stage: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(EXAMPLE_PATH))
	var validation := CORE.handle_request(_request("validate_stage", stage))
	if not _expect(validation["response"]["validation"]["valid"], "Example must be valid"):
		return
	var frames: Array = [_frame(stage, "", "initial")]
	for arrow_id: String in ORDER:
		var result := CORE.handle_request(_request("apply_action", stage, arrow_id))
		var response: Dictionary = result["response"]
		if not _expect(result["exit_code"] == 0 and response["validation"]["valid"], "Action must validate"):
			return
		var action: Dictionary = response["action"]
		if not _expect(action["selection_event"] == "extraction_requested", "Removal must be legal: " + arrow_id):
			return
		stage = action["stage"]
		frames.append(_frame(stage, arrow_id, action["event"]))
	for index: int in frames.size():
		if not _expect(frames[index]["available"] == EXPECTED_AVAILABLE[index], "Unexpected availability at step %d" % index):
			return
	if not _expect(frames[2]["regions"]["R2"]["available"] == 0 and frames[3]["regions"]["R2"]["available"] == 3, "Gate must open three R2 arrows"):
		return
	if not _expect(frames.back()["event"] == "stage_cleared", "Trace must clear the stage"):
		return
	print("ROLE_TRACE:" + JSON.stringify({"source": EXAMPLE_PATH, "order": ORDER, "frames": frames}))
	print("Role chain example: validation and 6 legal removals passed; R2 available 0 -> 3.")
	quit(0)


func _frame(stage: Dictionary, removed: String, event: String) -> Dictionary:
	var decoded: Dictionary = CODEC.decode_stage(stage)["stage"]
	var available: Array = []
	var blockers: Dictionary = {}
	var regions := {"R1": {"total": 0, "available": 0}, "R2": {"total": 0, "available": 0}}
	for arrow: Dictionary in decoded["arrows"]:
		var arrow_id: String = arrow["id"]
		var evaluation := PATH_RULE.evaluate(arrow_id, decoded["arrows"], decoded["grid_size"])
		blockers[arrow_id] = Array(evaluation["blocking_arrow_ids"])
		if evaluation["is_extractable"]:
			available.append(arrow_id)
		var head: Vector2i = arrow["head_cell"]
		var region: String = "R1" if Rect2i(1, 1, 10, 3).has_point(head) else "R2"
		assert(region == "R1" or Rect2i(3, 4, 7, 5).has_point(head))
		regions[region]["total"] += 1
		regions[region]["available"] += int(evaluation["is_extractable"])
	return {"stage": stage, "removed": removed, "event": event, "available": available, "blockers": blockers, "regions": regions}


func _request(operation: String, stage: Dictionary, arrow_id: String = "") -> Dictionary:
	return {"protocol_version": 1, "request_id": "role-demo", "operation": operation, "stage": stage, "arrow_id": arrow_id}


func _expect(condition: bool, message: String) -> bool:
	if not condition:
		push_error(message)
		quit(1)
	return condition
