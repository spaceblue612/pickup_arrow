extends SceneTree

const CONTROLLER := preload("res://scripts/map_generation_controller.gd")
const GAME := preload("res://scripts/main.gd")
const BOARD_STATE := preload("res://scripts/board_state.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()
var _completed_stage: Dictionary = {}
var _failed_code := ""
var _progress_events := 0


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_fixed_generation_is_stable()
	await _test_controller_random_and_timeout()
	await _test_actual_random_stage_game_flow()
	_finish()


func _test_fixed_generation_is_stable() -> void:
	var profile := STAGE_CATALOG.get_stage_profile("STAGE-001")
	var first := STAGE_CATALOG.build_stage_from_profile(profile, profile["seed"])
	var second := STAGE_CATALOG.build_stage_from_profile(profile, profile["seed"])
	_expect(first["arrows"] == second["arrows"], "Fixed profile produces the same map")
	_expect(first["generation_mode"] == "fixed", "Fixed stage exposes its generation mode")


func _test_controller_random_and_timeout() -> void:
	var controller = CONTROLLER.new()
	root.add_child(controller)
	controller.progress_changed.connect(func(_id: int, _ratio: float, _elapsed: float) -> void:
		_progress_events += 1
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

	_completed_stage = {}
	_failed_code = ""
	controller.request_stage("STAGE-004", 4004, 0.0)
	await process_frame
	_expect(_failed_code == "timeout", "Zero time budget expires the request")
	await _wait_for_jobs(controller)
	_expect(_completed_stage.is_empty(), "A stale worker result is not applied after timeout")
	controller.free()


func _test_actual_random_stage_game_flow() -> void:
	var game = GAME.new()
	root.add_child(game)
	await process_frame
	_expect(game.flow_state == GAME.FlowState.HOME, "Runtime opens on the home state")
	_expect(game.start_game()["event"] == "stage_loaded", "Home starts the fixed first stage")
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
	game.developer_checks_enabled = true
	game._handle_home_input(_mouse_release_at(
		game._developer_stage_button_rect(game._viewport_size()).get_center()
	))
	_expect(
		game.flow_state == GAME.FlowState.GENERATING,
		"Developer home button starts STAGE-004 directly"
	)
	await _wait_for_game(game)
	_expect(game.last_runtime_seed != first_seed, "Developer direct entry uses a fresh runtime seed")
	var direct_seed: int = game.last_runtime_seed

	game._unhandled_input(_mouse_release_at(
		game._developer_home_button_rect(game._viewport_size()).get_center()
	))
	_expect(game.flow_state == GAME.FlowState.HOME, "Developer home button returns to home")
	game._handle_home_input(_mouse_release_at(
		game._developer_stage_button_rect(game._viewport_size()).get_center()
	))
	await _wait_for_game(game)
	_expect(game.last_runtime_seed != direct_seed, "Developer re-entry uses another fresh runtime seed")

	game.request_stage("STAGE-004", 4004, 0.0)
	await process_frame
	_expect(game.flow_state == GAME.FlowState.HOME, "Timeout returns the game to home")
	_expect(game.retry_stage_id == "STAGE-004", "Timeout preserves the failed stage for retry")
	_expect(not game.home_error_message.is_empty(), "Timeout shows a retry message")
	game.free()


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
