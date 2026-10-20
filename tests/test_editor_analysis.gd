extends SceneTree

const CORE := preload("res://scripts/bridge/core_request.gd")
var _failures := PackedStringArray()


func _init() -> void:
	var stage: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://docs/wireframes/examples/role_chain.json"))
	var original := stage.duplicate(true)
	var result := _analyze(stage)
	_expect(result["validation"]["valid"], "Example validates")
	var analysis: Dictionary = result["analysis"]
	_expect(analysis["available_arrow_ids"] == ["Z"], "Only Z is initially removable")
	_expect(analysis["dependency_depth"] == 4, "Existing node-count depth stays compatible")
	_expect(analysis["blockers_by_arrow"]["G"] == ["H"], "Gate blockers use gameplay rule")
	_expect(analysis["solution_status"] == "solved", "Complete solution is identified")
	_expect(analysis["path_scope"] == "single_deterministic_path", "Path statistics are qualified")
	_expect(stage == original, "Analysis does not mutate its input")
	for id: String in ["Z", "H", "G"]:
		var request := _request(stage)
		request["operation"] = "apply_action"
		request["arrow_id"] = id
		var response: Dictionary = CORE.handle_request(request)["response"]
		_expect(response["action"]["selection_event"] == "extraction_requested", "Trace removal is legal")
		stage = response["action"]["stage"]
	_expect(_analyze(stage)["analysis"]["available_arrow_ids"] == ["A", "B", "C"], "Gate opens exactly three arrows")
	var cyclic := {"id": "CYCLE", "grid_size": [5, 5], "blocked_cells": [], "arrows": [
		{"id": "A", "head_cell": [2, 2], "cells": [[2, 2]], "direction": "RIGHT"},
		{"id": "B", "head_cell": [4, 2], "cells": [[4, 2]], "direction": "LEFT"},
	]}
	_expect(_analyze(cyclic)["analysis"]["solution_status"] == "unsolvable", "Cycles are not called solved")
	cyclic["arrows"] = []
	var invalid := _analyze(cyclic)
	_expect(not invalid["validation"]["valid"] and not invalid.has("analysis"), "Empty draft is not a playable board")
	if _failures.is_empty():
		print("Editor analysis: all checks passed")
		quit(0)
	else:
		for message: String in _failures:
			push_error(message)
		quit(1)


func _request(stage: Dictionary) -> Dictionary:
	return {"protocol_version": 1, "request_id": "editor-analysis", "operation": "analyze_stage", "stage": stage}


func _analyze(stage: Dictionary) -> Dictionary:
	return CORE.handle_request(_request(stage))["response"]


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
