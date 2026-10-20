extends SceneTree

const CORE_REQUEST := preload("res://scripts/bridge/core_request.gd")


func _init() -> void:
	var arguments := _parse_arguments(OS.get_cmdline_user_args())
	var input_path: String = arguments["input"]
	var output_path: String = arguments["output"]
	var result: Dictionary
	if not input_path.is_empty() and not output_path.is_empty() and _same_path(input_path, output_path):
		# Never overwrite an input file, including when its spelling differs.
		printerr("input and output must refer to different files")
		quit(2)
		return
	if not arguments["error"].is_empty():
		result = CORE_REQUEST.failure("", "invalid_arguments", arguments["error"], 2)
	else:
		result = _read_request(_absolute_path(input_path))
	if output_path.is_empty():
		printerr(JSON.stringify(result["response"]))
		quit(int(result["exit_code"]))
		return
	var output := FileAccess.open(_absolute_path(output_path), FileAccess.WRITE)
	if output == null:
		printerr("Could not open response file: %s (error %d)" % [output_path, FileAccess.get_open_error()])
		quit(1)
		return
	output.store_string(JSON.stringify(result["response"], "\t") + "\n")
	output.flush()
	var write_error := output.get_error()
	output.close()
	if write_error != OK:
		printerr("Could not write response file: %s (error %d)" % [output_path, write_error])
		quit(1)
		return
	quit(int(result["exit_code"]))


func _read_request(input_path: String) -> Dictionary:
	var input := FileAccess.open(input_path, FileAccess.READ)
	if input == null:
		return CORE_REQUEST.failure("", "input_io_error", "Could not open request file", 1)
	var source := input.get_as_text()
	var read_error := input.get_error()
	input.close()
	if read_error != OK:
		return CORE_REQUEST.failure("", "input_io_error", "Could not read request file", 1)
	var json := JSON.new()
	if json.parse(source) != OK:
		return CORE_REQUEST.failure(
			"", "invalid_json",
			"Line %d: %s" % [json.get_error_line(), json.get_error_message()], 2
		)
	return CORE_REQUEST.handle_request(json.data)


func _parse_arguments(arguments: PackedStringArray) -> Dictionary:
	var result := {"input": "", "output": "", "error": ""}
	var index := 0
	while index < arguments.size():
		var flag: String = arguments[index]
		if flag not in ["--input", "--output"]:
			result["error"] = "Unknown argument: %s" % flag
			break
		var key := flag.trim_prefix("--")
		if not result[key].is_empty() or index + 1 >= arguments.size() \
				or arguments[index + 1].is_empty() or arguments[index + 1].begins_with("--"):
			result["error"] = "Expected one path for %s" % flag
			break
		result[key] = arguments[index + 1]
		index += 2
	if result["error"].is_empty() and (result["input"].is_empty() or result["output"].is_empty()):
		result["error"] = "Usage: --input request.json --output response.json"
	return result


func _same_path(first: String, second: String) -> bool:
	return _absolute_path(first) == _absolute_path(second)


func _absolute_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://"):
		return ProjectSettings.globalize_path(path).simplify_path()
	if path.is_absolute_path():
		return path.simplify_path()
	return DirAccess.open(".").get_current_dir().path_join(path).simplify_path()
