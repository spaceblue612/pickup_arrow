extends SceneTree

const CORE := preload("res://scripts/bridge/core_request.gd")
const CODEC := preload("res://scripts/bridge/stage_json_codec.gd")
var _failures := PackedStringArray()


func _init() -> void:
	var original := _stage()
	for cells: Array in [
		[[6, 2], [6, 3], [5, 3], [5, 4], [5, 5], [5, 6]],
		[[7, 3], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4]],
		[[6, 2], [5, 2], [4, 2], [4, 3], [4, 4], [4, 5]],
		[[6, 2], [6, 3], [6, 4], [6, 5], [7, 5], [8, 5], [9, 5]],
		[[6, 2], [6, 3], [7, 3], [8, 3], [9, 3]],
		[[5, 1], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4]],
		[[6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5]],
	]:
		var response := _request(cells)
		_expect(response["edit"]["accepted"], "Rotation, spacing, and endpoint extension use shared validation")
		_expect(response["edit"]["stage"]["arrows"][0]["cells"] == cells, "Preview geometry survives transport exactly")
		_expect(response["edit"]["stage"]["arrows"][0]["head_cell"] == cells[0], "First cell is always head")
	var head := _request([[5, 1], [6, 1], [6, 2], [6, 3]])
	_expect(head["edit"]["stage"]["arrows"][0]["direction"] == "LEFT", "Core derives direction after head extension")
	for cells: Array in [
		[[1, 1]], [[1, 1], [2, 2]], [[1, 1], [2, 1], [1, 1]],
		[[0, 1], [1, 1]], [[12, 9], [13, 9]], [[1.5, 1], [2, 1]], [[1], [2, 1]],
	]:
		var response := _request(cells)
		_expect(not response["edit"]["accepted"], "Single-cell, diagonal, duplicate, boundary and malformed shapes are rejected")
		_expect(response["edit"]["stage"] == CODEC.encode_stage(original), "Rejected geometry leaves original unchanged")
	var masked := _stage()
	masked["blocked_cells"] = [Vector2i(5, 2)]
	_expect(not _request([[6, 2], [5, 2]], masked)["edit"]["accepted"], "Blocked cells cannot be occupied")
	var occupied := _stage()
	occupied["arrows"].append({"id": "B", "head_cell": Vector2i(3, 2), "cells": [Vector2i(3, 2), Vector2i(2, 2)], "direction": "RIGHT"})
	_expect(not _request([[3, 2], [4, 2]], occupied)["edit"]["accepted"], "Other arrow bodies cannot be overwritten")
	_expect(_stage() == original, "Original input is immutable")
	if _failures.is_empty():
		print("Arrow reshape: all checks passed")
		quit(0)
	else:
		for message: String in _failures:
			push_error(message)
		quit(1)


func _stage() -> Dictionary:
	return {"id": "STAGE-SHAPE", "grid_size": Vector2i(12, 9), "blocked_cells": [], "arrows": [{"id": "A", "head_cell": Vector2i(6, 2), "direction": "UP", "cells": [Vector2i(6, 2), Vector2i(6, 3), Vector2i(6, 4), Vector2i(7, 4), Vector2i(8, 4), Vector2i(9, 4)]}]}


func _request(cells: Array, stage: Dictionary = _stage()) -> Dictionary:
	return CORE.handle_request({"protocol_version": 1, "request_id": "shape-test", "stage_contract": "authoring_v1", "operation": "reshape_arrow", "stage": CODEC.encode_stage(stage), "arrow_id": "A", "cells": cells})["response"]


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
