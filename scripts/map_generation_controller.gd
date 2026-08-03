class_name MapGenerationController
extends Node

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const DEFAULT_TIMEOUT_SECONDS := 10.0
const MAX_RUNTIME_SEED := 2147483647

enum State {
	IDLE,
	GENERATING,
	COMPLETED,
	FAILED,
	TIMED_OUT,
}

signal progress_changed(request_id: int, wait_ratio: float, elapsed_seconds: float)
signal generation_completed(request_id: int, stage_definition: Dictionary)
signal generation_failed(request_id: int, stage_id: String, code: String)

var state := State.IDLE
var active_request_id := 0
var active_stage_id := ""
var active_runtime_seed := -1
var _request_serial := 0
var _active_started_msec := 0
var _active_timeout_seconds := DEFAULT_TIMEOUT_SECONDS
var _jobs: Array[Dictionary] = []
var _last_random_seed_by_stage: Dictionary = {}
var _rng := RandomNumberGenerator.new()
var _rng_ready := false


func request_stage(
	stage_id: String,
	runtime_seed_override: int = -1,
	timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
) -> Dictionary:
	var profile := STAGE_CATALOG.get_stage_profile(stage_id)
	if profile.is_empty():
		state = State.FAILED
		generation_failed.emit(0, stage_id, "unknown_stage")
		return _request_result(0, stage_id, -1, "unknown_stage")

	_request_serial += 1
	var request_id := _request_serial
	var runtime_seed := runtime_seed_override \
		if runtime_seed_override >= 0 else int(profile["seed"])
	if profile["generation_mode"] == "random":
		runtime_seed = runtime_seed_override if runtime_seed_override >= 0 else _next_random_seed(stage_id)
		_last_random_seed_by_stage[stage_id] = runtime_seed

	active_request_id = request_id
	active_stage_id = stage_id
	active_runtime_seed = runtime_seed
	_active_started_msec = Time.get_ticks_msec()
	_active_timeout_seconds = maxf(timeout_seconds, 0.0)
	state = State.GENERATING

	var thread := Thread.new()
	var start_error := thread.start(_build_stage.bind(
		profile.duplicate(true),
		runtime_seed,
		STAGE_CATALOG.get_snapshot_metadata()
	))
	if start_error != OK:
		state = State.FAILED
		active_request_id = 0
		generation_failed.emit(request_id, stage_id, "worker_start_failed")
		return _request_result(request_id, stage_id, runtime_seed, "worker_start_failed")

	_jobs.append({
		"request_id": request_id,
		"stage_id": stage_id,
		"thread": thread,
	})
	set_process(true)
	return _request_result(request_id, stage_id, runtime_seed, "")


func active_request() -> Dictionary:
	return {
		"request_id": active_request_id,
		"stage_id": active_stage_id,
		"runtime_seed": active_runtime_seed,
		"state": state,
	}


func _process(_delta: float) -> void:
	if active_request_id != 0:
		var elapsed := float(Time.get_ticks_msec() - _active_started_msec) / 1000.0
		var ratio := 1.0 if _active_timeout_seconds <= 0.0 else clampf(
			elapsed / _active_timeout_seconds,
			0.0,
			1.0
		)
		progress_changed.emit(active_request_id, ratio, elapsed)
		if elapsed >= _active_timeout_seconds:
			var expired_request_id := active_request_id
			var expired_stage_id := active_stage_id
			state = State.TIMED_OUT
			active_request_id = 0
			generation_failed.emit(expired_request_id, expired_stage_id, "timeout")

	for job_index: int in range(_jobs.size() - 1, -1, -1):
		var job: Dictionary = _jobs[job_index]
		var thread: Thread = job["thread"]
		if thread.is_alive():
			continue
		var stage_definition: Variant = thread.wait_to_finish()
		_jobs.remove_at(job_index)
		if int(job["request_id"]) != active_request_id:
			continue
		var completed_request_id := active_request_id
		active_request_id = 0
		if not (stage_definition is Dictionary) or stage_definition.is_empty():
			state = State.FAILED
			generation_failed.emit(completed_request_id, job["stage_id"], "generation_failed")
		else:
			state = State.COMPLETED
			generation_completed.emit(completed_request_id, stage_definition)

	if _jobs.is_empty() and active_request_id == 0:
		set_process(false)


func _exit_tree() -> void:
	for job: Dictionary in _jobs:
		var thread: Thread = job["thread"]
		if thread.is_started():
			thread.wait_to_finish()
	_jobs.clear()


func _build_stage(profile: Dictionary, runtime_seed: int, metadata: Dictionary) -> Dictionary:
	return STAGE_CATALOG.build_stage_from_profile(profile, runtime_seed, metadata)


func _next_random_seed(stage_id: String) -> int:
	if not _rng_ready:
		_rng.randomize()
		_rng_ready = true
	var previous := int(_last_random_seed_by_stage.get(stage_id, -1))
	var next_seed := _rng.randi_range(0, MAX_RUNTIME_SEED)
	while next_seed == previous:
		next_seed = _rng.randi_range(0, MAX_RUNTIME_SEED)
	return next_seed


func _request_result(request_id: int, stage_id: String, runtime_seed: int, error: String) -> Dictionary:
	return {
		"request_id": request_id,
		"stage_id": stage_id,
		"runtime_seed": runtime_seed,
		"error": error,
	}
