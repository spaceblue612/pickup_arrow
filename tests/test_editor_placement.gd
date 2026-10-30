extends SceneTree

const REQUEST := preload("res://scripts/bridge/core_request.gd")


func _init() -> void:
	var stage := {"id": "STAGE-TEST", "grid_size": [8, 8], "blocked_cells": [[1, 1]], "arrows": [{"id": "existing", "head_cell": [8, 1], "cells": [[8, 1], [7, 1]], "direction": "RIGHT"}]}
	var original := stage.duplicate(true)
	var cells: Array = []
	for y: int in range(1, 9):
		for x: int in range(1, 9):
			cells.append([x, y])
	var result: Dictionary = REQUEST.handle_request({"protocol_version": 1, "request_id": "test", "operation": "editor_placement", "stage_contract": "authoring_v1", "stage": stage, "placement": {"cells": cells, "stage1": 30, "fill": 50, "min_length": 2, "max_length": 3, "seed": 42}})
	assert(result["exit_code"] == 0)
	var response: Dictionary = result["response"]
	assert(response["validation"]["valid"])
	var placement: Dictionary = response["placement"]
	assert(placement["error"] == "")
	assert(placement["primary_added"] > 0 and placement["filler_added"] > 0)
	assert(placement["stage"]["arrows"][0] == original["arrows"][0])
	assert(stage == original)
	assert(placement["final"]["solvable"])
	assert(placement["groups"]["existing"] == "existing")
	var primary_count := 0
	var filler_count := 0
	for phase: String in placement["groups"].values():
		if phase == "primary":
			primary_count += 1
		elif phase == "filler":
			filler_count += 1
	assert(primary_count == placement["primary"]["arrow_count"])
	assert(filler_count > 0)
	assert(placement["groups"].size() == placement["stage"]["arrows"].size())
	var generated_script := preload("res://scripts/editor_placement.gd")
	var runtime := preload("res://scripts/bridge/stage_json_codec.gd").decode_stage(stage)["stage"] as Dictionary
	var target: Array = []
	for cell: Array in cells:
		target.append(Vector2i(cell[0], cell[1]))
	var constrained: Dictionary = generated_script.generate(runtime, target, 30, 0, 2, 3, 42, {"rules": [{"length": 5, "amount": 2, "unit": "count"}], "bends": 0})
	assert(constrained["error"] == "")
	var count := 0
	for arrow: Dictionary in constrained["stage"]["arrows"]:
		if arrow["id"] != "existing" and arrow["cells"].size() == 5:
			count += 1
	assert(count == 2)
	print("Editor placement tests passed")
	quit(0)
