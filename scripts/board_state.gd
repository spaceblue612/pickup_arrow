class_name BoardState
extends RefCounted

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const PATH_RULE := preload("res://scripts/path_rule.gd")

enum Phase {
	LOADING,
	READY,
	EXTRACTING,
	CLEARED,
	PROTOTYPE_COMPLETE,
}

signal state_changed(state: Dictionary)
signal extraction_requested(arrow_id: String)
signal blocked_feedback_requested(arrow_id: String, blocking_arrow_ids: PackedStringArray)
signal stage_cleared(stage_id: String)
signal next_stage_requested(stage_id: String)
signal prototype_completed()

var active_stage_id := ""
var remaining_arrows: Array = []
var phase := Phase.LOADING
var pending_extraction_arrow_id := ""
var _grid_size := Vector2i.ZERO


func load_stage(stage_id: String) -> Dictionary:
	var stage_definition: Dictionary = STAGE_CATALOG.get_stage(stage_id)
	if stage_definition.is_empty():
		return _result("load_failed")

	active_stage_id = stage_id
	remaining_arrows = stage_definition["arrows"].duplicate(true)
	_grid_size = stage_definition["grid_size"]
	pending_extraction_arrow_id = ""
	phase = Phase.READY
	_emit_state_changed()
	return _result("stage_loaded")


func select_arrow(arrow_id: String) -> Dictionary:
	if phase != Phase.READY:
		return _result("input_ignored")

	var path_result: Dictionary = PATH_RULE.evaluate(arrow_id, remaining_arrows, _grid_size)
	if not path_result["error"].is_empty():
		return _result("selection_invalid", path_result)
	if not path_result["is_extractable"]:
		blocked_feedback_requested.emit(arrow_id, path_result["blocking_arrow_ids"])
		return _result("blocked", path_result)

	pending_extraction_arrow_id = arrow_id
	phase = Phase.EXTRACTING
	extraction_requested.emit(arrow_id)
	_emit_state_changed()
	return _result("extraction_requested", path_result)


func complete_extraction() -> Dictionary:
	if phase != Phase.EXTRACTING:
		return _result("completion_ignored")

	_remove_arrow(pending_extraction_arrow_id)
	pending_extraction_arrow_id = ""
	if remaining_arrows.is_empty():
		phase = Phase.CLEARED
		stage_cleared.emit(active_stage_id)
		_emit_state_changed()
		return _result("stage_cleared")

	phase = Phase.READY
	_emit_state_changed()
	return _result("extraction_completed")


func advance_after_clear() -> Dictionary:
	if phase != Phase.CLEARED:
		return _result("advance_ignored")

	var current_index := STAGE_CATALOG.STAGE_IDS.find(active_stage_id)
	if current_index < 0 or current_index == STAGE_CATALOG.STAGE_IDS.size() - 1:
		phase = Phase.PROTOTYPE_COMPLETE
		prototype_completed.emit()
		_emit_state_changed()
		return _result("prototype_complete")

	var next_stage_id: String = STAGE_CATALOG.STAGE_IDS[current_index + 1]
	next_stage_requested.emit(next_stage_id)
	return load_stage(next_stage_id)


func get_state() -> Dictionary:
	return {
		"active_stage_id": active_stage_id,
		"remaining_arrow_ids": get_remaining_arrow_ids(),
		"phase": phase,
		"pending_extraction_arrow_id": pending_extraction_arrow_id,
	}


func get_remaining_arrow_ids() -> PackedStringArray:
	var arrow_ids := PackedStringArray()
	for arrow_data: Dictionary in remaining_arrows:
		arrow_ids.append(arrow_data["id"])
	return arrow_ids


func _remove_arrow(arrow_id: String) -> void:
	for index: int in remaining_arrows.size():
		if remaining_arrows[index]["id"] == arrow_id:
			remaining_arrows.remove_at(index)
			return


func _emit_state_changed() -> void:
	state_changed.emit(get_state())


func _result(event: String, path_result: Dictionary = {}) -> Dictionary:
	return {
		"event": event,
		"state": get_state(),
		"path_result": path_result,
	}
