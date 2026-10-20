extends SceneTree

const CORE := preload("res://scripts/bridge/core_request.gd")
const RUNNER := "res://scripts/bridge/cli_runner.gd"

var _failures := PackedStringArray()
var _directory := ""
var _serial := 0


func _init() -> void:
	var temporary_root := OS.get_environment("TEMP") if OS.get_name() == "Windows" else "/tmp"
	_directory = temporary_root.path_join("pickup-arrow-cli-%d-%d 한글 공백" % [OS.get_process_id(), Time.get_ticks_usec()])
	if DirAccess.make_dir_absolute(_directory) != OK:
		_expect(false, "Isolated test directory can be created")
		_finish()
		return
	_test_real_process_agreement()
	_test_invalid_json_and_requests()
	_test_file_and_argument_errors()
	for file_name: String in DirAccess.get_files_at(_directory):
		DirAccess.remove_absolute(_directory.path_join(file_name))
	DirAccess.remove_absolute(_directory)
	_finish()


func _request() -> Dictionary:
	return {
		"protocol_version": 1, "request_id": "CLI-한글", "operation": "apply_action",
		"arrow_id": "A",
		"stage": {
			"id": "STAGE-CLI", "grid_size": [5, 5], "arrows": [
				{"id": "A", "head_cell": [1, 2], "cells": [[1, 2]], "direction": "RIGHT"},
				{"id": "B", "head_cell": [3, 2], "cells": [[3, 2]], "direction": "UP"},
			],
		},
	}


func _write(path: String, source: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	_expect(file != null, "Fixture file opens")
	if file != null:
		file.store_string(source)
		file.close()


func _execute(arguments: PackedStringArray) -> Dictionary:
	_serial += 1
	var flags := PackedStringArray([
		"--headless", "--log-file", _directory.path_join("engine-%d.log" % _serial),
		"--path", ProjectSettings.globalize_path("res://"), "--script", RUNNER, "--",
	])
	flags.append_array(arguments)
	var output: Array = []
	var code := OS.execute(OS.get_executable_path(), flags, output, true)
	var log := "\n".join(output)
	_expect(not "SCRIPT ERROR:" in log and not "\nERROR:" in log, "CLI finishes without Godot errors: %s" % log)
	return {"exit_code": code, "log": log}


func _invoke(source: String) -> Dictionary:
	var input_path := _directory.path_join("request.json")
	var output_path := _directory.path_join("response-%d.json" % _serial)
	_write(input_path, source)
	var result := _execute(PackedStringArray(["--input", input_path, "--output", output_path]))
	_expect(FileAccess.file_exists(output_path), "CLI writes response JSON")
	var file := FileAccess.open(output_path, FileAccess.READ)
	if file == null:
		return result
	var response: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	_expect(response is Dictionary, "CLI output is standalone JSON")
	result["response"] = response
	return result


func _test_real_process_agreement() -> void:
	var blocked := _request()
	var clear := _request()
	clear["arrow_id"] = "B"
	var final := _request()
	final["stage"]["arrows"].remove_at(1)
	var unknown := _request()
	unknown["arrow_id"] = "MISSING"
	var invalid := _request()
	invalid["stage"]["arrows"][0]["head_cell"] = [1.5, 2]
	for request: Dictionary in [blocked, clear, final, unknown, invalid]:
		var expected := CORE.handle_request(JSON.parse_string(JSON.stringify(request)))
		var actual := _invoke(JSON.stringify(request))
		_expect(actual["exit_code"] == expected["exit_code"], "Real process uses the expected exit code")
		var expected_json: Variant = JSON.parse_string(JSON.stringify(expected["response"]))
		_expect(actual.get("response") == expected_json, "Real CLI and direct core return identical results")
	var validation := _request()
	validation["operation"] = "validate_stage"
	var result := _invoke(JSON.stringify(validation))
	_expect(result["exit_code"] == 0 and result.get("response", {}).get("validation", {}).get("valid", false), "validate_stage works through the process boundary")


func _test_invalid_json_and_requests() -> void:
	for source: String in ["{", "null", "[]", "{}"]:
		var result := _invoke(source)
		_expect(result["exit_code"] == 2, "Invalid JSON or envelope returns exit 2")
		_expect(not result.get("response", {}).get("ok", true), "Request failure has structured error JSON")
	var unknown := _request()
	unknown["operation"] = "not_supported"
	var result := _invoke(JSON.stringify(unknown))
	_expect(result["exit_code"] == 2, "Unknown operation returns exit 2")


func _test_file_and_argument_errors() -> void:
	var input_path := _directory.path_join("request.json")
	var output_path := _directory.path_join("io-response.json")
	var missing := _directory.path_join("does-not-exist")
	var result := _execute(PackedStringArray(["--input", missing, "--output", output_path]))
	_expect(result["exit_code"] == 1, "Missing request returns exit 1")
	var file := FileAccess.open(output_path, FileAccess.READ)
	if file != null:
		var response: Dictionary = JSON.parse_string(file.get_as_text())
		_expect(response["error"]["code"] == "input_io_error", "Input error is represented in JSON")
		file.close()
	_write(input_path, JSON.stringify(_request()))
	result = _execute(PackedStringArray(["--input", input_path, "--output", missing.path_join("response.json")]))
	_expect(result["exit_code"] == 1, "Unwritable response path returns exit 1")
	result = _execute(PackedStringArray(["--input", input_path]))
	_expect(result["exit_code"] == 2, "Missing output argument returns exit 2")
	result = _execute(PackedStringArray(["--input", input_path, "--output", output_path, "--unknown"]))
	_expect(result["exit_code"] == 2, "Unknown option returns exit 2")
	result = _execute(PackedStringArray(["--input", input_path, "--output", output_path, "--input", input_path]))
	_expect(result["exit_code"] == 2, "Duplicate option returns exit 2")
	result = _execute(PackedStringArray(["--input", input_path, "--output", _directory.path_join("./request.json")]))
	_expect(result["exit_code"] == 2, "Input cannot be overwritten as the response")
	file = FileAccess.open(input_path, FileAccess.READ)
	if file != null:
		_expect(file.get_as_text() == JSON.stringify(_request()), "Same-path failure preserves the input")
		file.close()


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Core CLI tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
