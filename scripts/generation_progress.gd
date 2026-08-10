class_name GenerationProgress
extends RefCounted

var _mutex := Mutex.new()
var _active_candidate := 0
var _candidate_total := 0


func begin(candidate_total: int) -> void:
	_mutex.lock()
	_active_candidate = 0
	_candidate_total = candidate_total
	_mutex.unlock()


func begin_candidate(candidate_index: int) -> void:
	_mutex.lock()
	_active_candidate = candidate_index
	_mutex.unlock()


func snapshot() -> Dictionary:
	_mutex.lock()
	var result := {
		"active_candidate": _active_candidate,
		"candidate_total": _candidate_total,
	}
	_mutex.unlock()
	return result
