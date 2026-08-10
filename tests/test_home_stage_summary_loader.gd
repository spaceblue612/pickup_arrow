extends SceneTree

const GAME := preload("res://scripts/main.gd")
const LOADER := preload("res://scripts/home_stage_summary_loader.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()
var _summary := {}
var _progress := PackedInt32Array()


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	await _test_home_is_available_before_summary_work()
	await _test_summary_loader_reports_progress_and_result()
	_finish()


func _test_home_is_available_before_summary_work() -> void:
	var game = GAME.new()
	root.add_child(game)
	_expect(game.flow_state == GAME.FlowState.HOME, "Home is shown before summary work starts")
	_expect(game.get_home_stage_summary("STAGE-001").is_empty(), "Home does not build a summary synchronously")
	await process_frame
	_expect(game.home_summary_total_count == STAGE_CATALOG.get_stage_ids().size(), "Home exposes the total summary count")
	_expect(game._is_home_summary_loading(), "Home starts summary loading asynchronously")
	game.home_summary_loader.stop_loading()
	await _wait_for_loader(game.home_summary_loader)
	game.free()


func _test_summary_loader_reports_progress_and_result() -> void:
	var loader = LOADER.new()
	root.add_child(loader)
	loader.progress_changed.connect(func(completed: int, total: int) -> void:
		_progress.append(completed)
		_progress.append(total)
	)
	loader.summary_ready.connect(func(_stage_id: String, stage_definition: Dictionary) -> void:
		_summary = stage_definition
	)
	loader.start(PackedStringArray(["STAGE-001"]))
	await _wait_for_loader(loader)
	_expect(_progress.size() >= 4, "Summary loader emits initial and completed progress")
	_expect(_progress[0] == 0 and _progress[1] == 1, "Summary loader starts at zero progress")
	_expect(_progress[-2] == 1 and _progress[-1] == 1, "Summary loader reports completed progress")
	_expect(not _summary.is_empty(), "Summary loader returns a generated stage")
	if not _summary.is_empty():
		_expect(_summary["id"] == "STAGE-001", "Summary loader keeps the requested stage ID")
	loader.free()


func _wait_for_loader(loader) -> void:
	for _frame: int in 600:
		if not loader.is_loading():
			return
		await process_frame
	_expect(false, "Summary loader finishes within the test budget")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Home stage summary loader tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
