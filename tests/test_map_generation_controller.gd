extends SceneTree

const CONTROLLER := preload("res://scripts/map_generation_controller.gd")
const GAME := preload("res://scripts/main.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()
var _completed_stage: Dictionary = {}
var _failed_code := ""
var _progress_events := 0
var _candidate_progress := {}


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_fixed_generation_is_stable()
	await _test_controller_random_and_cancellation()
	await _test_actual_random_stage_game_flow()
	_finish()


func _test_fixed_generation_is_stable() -> void:
	var profile := STAGE_CATALOG.get_stage_profile("STAGE-001")
	var first := STAGE_CATALOG.build_stage_from_profile(profile, profile["seed"])
	var second := STAGE_CATALOG.build_stage_from_profile(profile, profile["seed"])
	_expect(first["arrows"] == second["arrows"], "Fixed profile produces the same map")
	_expect(first["generation_mode"] == "fixed", "Fixed stage exposes its generation mode")


func _test_controller_random_and_cancellation() -> void:
	var controller = CONTROLLER.new()
	root.add_child(controller)
	controller.progress_changed.connect(func(_id: int, _ratio: float, _elapsed: float) -> void:
		_progress_events += 1
	)
	controller.candidate_progress_changed.connect(func(_id: int, progress: Dictionary) -> void:
		_candidate_progress = progress
	)
	controller.generation_completed.connect(func(_id: int, stage: Dictionary) -> void:
		_completed_stage = stage
	)
	controller.generation_failed.connect(func(_id: int, _stage_id: String, code: String) -> void:
		_failed_code = code
	)

	var request: Dictionary = controller.request_stage("STAGE-004", 4004)
	_expect(request["error"].is_empty(), "Random generation request starts")
	_expect(controller.state == CONTROLLER.State.GENERATING, "Generation starts asynchronously")
	await _wait_for_controller(controller)
	_expect(_failed_code.is_empty(), "Known random seed generates successfully")
	_expect(not _completed_stage.is_empty(), "Controller returns a complete stage")
	if not _completed_stage.is_empty():
		_expect(_completed_stage["runtime_seed"] == 4004, "Controller applies the requested runtime seed")
		_expect(STAGE_CATALOG.validate_stage(_completed_stage)["is_valid"], "Random result validates")
	_expect(_progress_events > 0, "Main loop receives generation progress while the worker runs")
	_expect(
		_candidate_progress.get("candidate_total") \
			== STAGE_CATALOG.get_stage_profile("STAGE-004")["max_candidate_attempts"],
		"Generation progress exposes the configured candidate target"
	)
	_expect(
		int(_candidate_progress.get("active_candidate", 0)) >= 1,
		"Generation progress exposes the active candidate"
	)

	_completed_stage = {}
	_failed_code = ""
	controller.request_stage("STAGE-004", 4004)
	var cancelled: Dictionary = controller.cancel_active_request()
	_expect(cancelled["cancelled"], "An active generation request can be cancelled")
	_expect(controller.state == CONTROLLER.State.IDLE, "Cancellation returns the controller to idle")
	await _wait_for_jobs(controller)
	_expect(_completed_stage.is_empty(), "A cancelled worker result is not applied")
	controller.free()


func _test_actual_random_stage_game_flow() -> void:
	var game = GAME.new()
	root.add_child(game)
	await process_frame
	_expect(game.flow_state == GAME.FlowState.HOME, "Runtime opens on the home state")
	game.home_summary_loader.stop_loading()
	await _wait_for_home_summary_loader(game)
	_test_stage_list_scroll_range(game)
	_test_stage_list_metrics(game)
	var first_start := game.start_game()
	_expect(
		first_start["event"] in ["stage_loaded", "generation_requested"],
		"Home starts a fixed stage from its prepared result or asynchronously"
	)
	if game.flow_state == GAME.FlowState.GENERATING:
		await _wait_for_game(game)
	_expect(game.board_state.active_stage_id == "STAGE-001", "First stage is playable")

	game.load_stage("STAGE-003")
	game.board_state.phase = BOARD_STATE.Phase.CLEARED
	var transition: Dictionary = game.advance_after_clear()
	_expect(transition["event"] == "generation_requested", "STAGE-003 advances through random generation")
	await _wait_for_game(game)
	_expect(game.board_state.active_stage_id == "STAGE-004", "Actual game progression loads random STAGE-004")
	_expect(game.active_stage_definition.get("generation_mode") == "random", "Runtime stage is marked random")
	var first_seed: int = game.last_runtime_seed

	game.show_home()
	for stage_id: String in ["STAGE-001", "STAGE-004"]:
		var button := game._home_stage_button_rect(stage_id, game._viewport_size())
		_expect(button.size.x > 0.0, "Home lists %s as a selectable stage" % stage_id)
		game._handle_home_input(_mouse_release_at(button.get_center()))
		if game.flow_state == GAME.FlowState.GENERATING:
			await _wait_for_game(game)
		_expect(game.board_state.active_stage_id == stage_id, "Home opens %s directly" % stage_id)
		game.show_home()

	game._handle_home_input(_mouse_release_at(
		game._home_stage_button_rect("STAGE-004", game._viewport_size()).get_center()
	))
	_expect(
		game.flow_state == GAME.FlowState.GENERATING,
		"Stage list starts STAGE-004 directly"
	)
	await _wait_for_game(game)
	_expect(game.last_runtime_seed != first_seed, "Stage list direct entry uses a fresh runtime seed")
	var direct_seed: int = game.last_runtime_seed

	game._unhandled_input(_mouse_release_at(
		game._developer_home_button_rect(game._viewport_size()).get_center()
	))
	_expect(game.flow_state == GAME.FlowState.HOME, "Developer home button returns to home")
	game._handle_home_input(_mouse_release_at(
		game._home_stage_button_rect("STAGE-004", game._viewport_size()).get_center()
	))
	await _wait_for_game(game)
	_expect(game.last_runtime_seed != direct_seed, "Stage list re-entry uses another fresh runtime seed")

	game.request_stage("STAGE-004", 4004)
	_expect(game.flow_state == GAME.FlowState.GENERATING, "Generation waits without the default timeout")
	game._unhandled_input(_mouse_release_at(
		game._generation_cancel_button_rect(game._viewport_size()).get_center()
	))
	_expect(game.flow_state == GAME.FlowState.HOME, "Cancel returns the game to home")
	_expect(game.retry_stage_id.is_empty(), "Cancel does not create a failed-stage retry")
	_expect(game.home_error_message.is_empty(), "Cancel does not show a generation failure")
	await _wait_for_jobs(game.generation_controller)
	game.free()


func _test_stage_list_scroll_range(game) -> void:
	var viewport: Vector2 = game._viewport_size()
	var list_rect: Rect2 = game._home_list_rect(viewport)
	var scroll_max: float = game._home_list_scroll_max(viewport, 20)
	_expect(list_rect.size.x == viewport.x - 48.0, "Stage list uses a wide viewport area")
	_expect(scroll_max > 0.0, "Long stage lists have a scrollable range")
	_expect(
		is_equal_approx(game._clamp_home_list_scroll(-40.0, viewport, 20), 0.0),
		"Stage list scroll does not pass the first entry"
	)
	_expect(
		is_equal_approx(game._clamp_home_list_scroll(scroll_max + 40.0, viewport, 20), scroll_max),
		"Stage list scroll does not pass the final entry"
	)


func _test_stage_list_metrics(game) -> void:
	for stage_id: String in ["STAGE-001", "STAGE-004"]:
		var profile: Dictionary = STAGE_CATALOG.get_stage_profile(stage_id)
		var summary: Dictionary = game.get_home_stage_summary(stage_id)
		_expect(profile.has("grid_size"), "%s stage card has a board size" % stage_id)
		_expect(profile.has("target_empty_ratio"), "%s stage card has a target empty ratio" % stage_id)
		_expect(
			game._generation_mode_label(profile["generation_mode"]) in ["고정", "랜덤"],
			"%s stage card has a Korean generation mode label" % stage_id
		)
		if not summary.is_empty():
			_expect(summary.has("actual_empty_ratio"), "%s prepared actual empty ratio" % stage_id)
			_expect(summary.has("initial_extractable_ratio"), "%s prepared initial extractable ratio" % stage_id)


func _wait_for_controller(controller) -> void:
	for _frame: int in 600:
		if controller.state != CONTROLLER.State.GENERATING:
			return
		await process_frame
	_expect(false, "Generation controller completes within the test budget")


func _wait_for_game(game) -> void:
	for _frame: int in 600:
		if game.flow_state != GAME.FlowState.GENERATING:
			return
		await process_frame
	_expect(false, "Game generation completes within the test budget")


func _wait_for_home_summary_loader(game) -> void:
	for _frame: int in 600:
		if not game.home_summary_loader.is_loading():
			return
		await process_frame
	_expect(false, "Home summary loader stops within the test budget")


func _wait_for_jobs(controller) -> void:
	for _frame: int in 600:
		if controller._jobs.is_empty():
			return
		await process_frame
	_expect(false, "Expired worker finishes without applying its result")


func _mouse_release_at(position: Vector2) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.position = position
	event.pressed = false
	return event


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Map generation controller tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
