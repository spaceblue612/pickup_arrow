class_name HomeStageSummaryLoader
extends Node

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

signal progress_changed(completed_count: int, total_count: int)
signal summary_ready(stage_id: String, stage_definition: Dictionary)
signal summary_failed(stage_id: String)
signal loading_finished()

var _pending_stage_ids: Array[String] = []
var _active_thread: Thread
var _active_stage_id := ""
var _total_count := 0
var _completed_count := 0
var _is_loading := false
var _stop_requested := false


func start(stage_ids: PackedStringArray) -> void:
	if _is_loading:
		return
	_pending_stage_ids.clear()
	for stage_id: String in stage_ids:
		_pending_stage_ids.append(stage_id)
	_total_count = _pending_stage_ids.size()
	_completed_count = 0
	_stop_requested = false
	_is_loading = _total_count > 0
	progress_changed.emit(_completed_count, _total_count)
	_start_next()


func stop_loading() -> void:
	_stop_requested = true
	_pending_stage_ids.clear()
	if _active_thread == null:
		_finish_loading()


func is_loading() -> bool:
	return _is_loading


func _process(_delta: float) -> void:
	if _active_thread == null or _active_thread.is_alive():
		return
	var stage_id := _active_stage_id
	var stage_definition: Variant = _active_thread.wait_to_finish()
	_active_thread = null
	_active_stage_id = ""
	_completed_count += 1
	if stage_definition is Dictionary and not stage_definition.is_empty():
		summary_ready.emit(stage_id, stage_definition)
	else:
		summary_failed.emit(stage_id)
	progress_changed.emit(_completed_count, _total_count)
	if _stop_requested:
		_finish_loading()
		return
	_start_next()


func _start_next() -> void:
	if _stop_requested or _pending_stage_ids.is_empty():
		_finish_loading()
		return
	_active_stage_id = _pending_stage_ids.pop_front()
	var profile := STAGE_CATALOG.get_stage_profile(_active_stage_id)
	if profile.is_empty():
		_completed_count += 1
		summary_failed.emit(_active_stage_id)
		progress_changed.emit(_completed_count, _total_count)
		_active_stage_id = ""
		call_deferred("_start_next")
		return
	_active_thread = Thread.new()
	var start_error := _active_thread.start(_build_stage.bind(
		profile.duplicate(true),
		int(profile["seed"]),
		STAGE_CATALOG.get_snapshot_metadata()
	))
	if start_error != OK:
		_active_thread = null
		_completed_count += 1
		summary_failed.emit(_active_stage_id)
		progress_changed.emit(_completed_count, _total_count)
		_active_stage_id = ""
		call_deferred("_start_next")
		return
	set_process(true)


func _finish_loading() -> void:
	if not _is_loading:
		return
	_is_loading = false
	set_process(false)
	loading_finished.emit()


func _build_stage(profile: Dictionary, generation_seed: int, metadata: Dictionary) -> Dictionary:
	return STAGE_CATALOG.build_stage_from_profile(profile, generation_seed, metadata)


func _exit_tree() -> void:
	stop_loading()
	if _active_thread != null and _active_thread.is_started():
		_active_thread.wait_to_finish()
