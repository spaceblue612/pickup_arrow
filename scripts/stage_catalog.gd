class_name StageCatalog
extends RefCounted

const DEPENDENCY_TARGETING := preload("res://scripts/dependency_targeting.gd")

const GRID_SIZE := Vector2i(9, 9)
const SNAPSHOT_PATH := "res://data/stage_balance.json"
const SUPPORTED_SCHEMA_VERSION := 2
const GENERATION_MODES := ["fixed", "random"]
const CARDINAL_DIRECTIONS := ["UP", "DOWN", "LEFT", "RIGHT"]
const MIN_ARROW_LENGTH := 1
const MAX_GRID_SIDE := 999
const MAX_BOARD_CELL_COUNT := 10000
const PLAYABLE_MASK_SYMBOL := "."
const BLOCKED_MASK_SYMBOL := "#"

static var _profiles_by_id: Dictionary = {}
static var _stage_ids := PackedStringArray()
static var _snapshot_metadata: Dictionary = {}
static var _snapshot_loaded := false
static var _snapshot_error := ""


static func reload_snapshot(snapshot_path: String = SNAPSHOT_PATH) -> Dictionary:
	var preserve_loaded_snapshot := _snapshot_loaded and _snapshot_error.is_empty() \
			and not _profiles_by_id.is_empty()
	var file := FileAccess.open(snapshot_path, FileAccess.READ)
	if file == null:
		return _snapshot_failure(
			"Balance snapshot could not be opened: %s" % snapshot_path,
			preserve_loaded_snapshot
		)
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not (parsed is Dictionary):
		return _snapshot_failure("Balance snapshot root must be an object", preserve_loaded_snapshot)
	var snapshot: Dictionary = parsed
	var validation_error := _validate_snapshot(snapshot)
	if not validation_error.is_empty():
		return _snapshot_failure(validation_error, preserve_loaded_snapshot)

	var next_profiles_by_id: Dictionary = {}
	var next_stage_ids := PackedStringArray()
	for profile_value: Variant in snapshot["profiles"]:
		var profile: Dictionary = _normalize_profile(profile_value)
		next_profiles_by_id[profile["stage_id"]] = profile
		next_stage_ids.append(profile["stage_id"])
	var next_metadata := {
		"schema_version": snapshot["schema_version"],
		"source_revision": snapshot["source_revision"],
		"content_hash": snapshot["content_hash"],
		"stage_count": next_stage_ids.size(),
	}
	_profiles_by_id = next_profiles_by_id
	_stage_ids = next_stage_ids
	_snapshot_metadata = next_metadata
	_snapshot_loaded = true
	_snapshot_error = ""
	return {
		"is_valid": true,
		"error": "",
		"metadata": _snapshot_metadata.duplicate(true),
	}


static func get_stage_ids() -> PackedStringArray:
	_ensure_snapshot_loaded()
	return _stage_ids.duplicate()


static func get_stage_profile(stage_id: String) -> Dictionary:
	_ensure_snapshot_loaded()
	if not _snapshot_error.is_empty():
		push_error(_snapshot_error)
		return {}
	if not _profiles_by_id.has(stage_id):
		push_error("Unknown stage ID: %s" % stage_id)
		return {}
	return _profiles_by_id[stage_id].duplicate(true)


static func get_snapshot_metadata() -> Dictionary:
	_ensure_snapshot_loaded()
	return _snapshot_metadata.duplicate(true)


static func get_stage(stage_id: String) -> Dictionary:
	var config := get_stage_profile(stage_id)
	if config.is_empty():
		return {}
	return build_stage_from_profile(config, config["seed"], get_snapshot_metadata())


static func build_stage_from_profile(
	config: Dictionary,
	generation_seed: int,
	snapshot_metadata: Dictionary = {}
) -> Dictionary:
	var stage_id: String = config.get("stage_id", "")
	if stage_id.is_empty():
		push_error("Stage profile requires stage_id")
		return {}
	var board_definition := normalize_board_config(config)
	if not board_definition["error"].is_empty():
		push_error("Invalid board definition %s: %s" % [stage_id, board_definition["error"]])
		return {}

	var grid_size: Vector2i = board_definition["grid_size"]
	var blocked_cells: Array[Vector2i] = []
	for blocked_cell: Vector2i in board_definition["blocked_cells"]:
		blocked_cells.append(blocked_cell)
	var generation: Dictionary = DEPENDENCY_TARGETING.select(
		generation_seed,
		grid_size,
		config["primary_arrow_count"],
		config["min_length"],
		config["max_length"],
		config["target_empty_ratio"],
		config["filler_max_length"],
		config["dependency_target"],
		config["max_candidate_attempts"],
		blocked_cells
	)
	if not generation["error"].is_empty():
		push_error("Stage generation failed for %s: %s" % [stage_id, generation["error"]])
		return {}

	var stage_definition := {
		"id": stage_id,
		"grid_size": grid_size,
		"blocked_cells": blocked_cells.duplicate(),
		"arrows": generation["arrows"],
		"solution_order": generation["solution_order"],
		"generation_profile": config.duplicate(true),
		"generation_mode": config["generation_mode"],
		"runtime_seed": generation_seed,
		"generation_metrics": generation["generation_metrics"],
		"dependency_analysis": generation["dependency_analysis"],
		"dependency_target": config["dependency_target"].duplicate(true),
		"dependency_targeting_metrics": generation["dependency_targeting_metrics"],
		"expected_difficulty_level": config["expected_difficulty_level"],
		"stage_order": config["stage_order"],
		"snapshot_metadata": snapshot_metadata.duplicate(true),
	}
	var validation := validate_stage(stage_definition)
	if not validation["is_valid"]:
		push_error("Invalid stage definition %s: %s" % [stage_id, ", ".join(validation["errors"])])
		return {}
	return stage_definition


static func _ensure_snapshot_loaded() -> void:
	if not _snapshot_loaded:
		reload_snapshot()


static func _snapshot_failure(error: String, preserve_loaded_snapshot: bool = false) -> Dictionary:
	if not preserve_loaded_snapshot:
		_profiles_by_id.clear()
		_stage_ids.clear()
		_snapshot_metadata.clear()
		_snapshot_loaded = true
		_snapshot_error = error
	if not preserve_loaded_snapshot:
		push_error(error)
	return {
		"is_valid": false,
		"error": error,
		"metadata": {},
	}


static func _validate_snapshot(snapshot: Dictionary) -> String:
	if snapshot.get("schema_version") != SUPPORTED_SCHEMA_VERSION:
		return "Balance snapshot schema_version must be %d" % SUPPORTED_SCHEMA_VERSION
	if not (snapshot.get("source_revision") is String) or snapshot["source_revision"].is_empty():
		return "Balance snapshot source_revision must be a non-empty string"
	if not (snapshot.get("content_hash") is String) or snapshot["content_hash"].length() != 64:
		return "Balance snapshot content_hash must be a SHA-256 hex string"
	if not (snapshot.get("profiles") is Array) or snapshot["profiles"].is_empty():
		return "Balance snapshot profiles must be a non-empty array"
	var expected_hash := _content_hash(snapshot["schema_version"], snapshot["profiles"])
	if snapshot["content_hash"] != expected_hash:
		return "Balance snapshot content_hash does not match canonical content"

	var seen_ids: Dictionary = {}
	var seen_orders: Dictionary = {}
	var previous_order := 0
	var previous_id := ""
	for profile_index: int in snapshot["profiles"].size():
		var profile_value: Variant = snapshot["profiles"][profile_index]
		if not (profile_value is Dictionary):
			return "Balance profile %d must be an object" % profile_index
		var profile: Dictionary = profile_value
		var profile_error := _validate_profile(profile)
		if not profile_error.is_empty():
			return "Balance profile %d: %s" % [profile_index, profile_error]
		var stage_id: String = profile["stage_id"]
		var stage_order := int(profile["stage_order"])
		if seen_ids.has(stage_id):
			return "Duplicate stage_id: %s" % stage_id
		if seen_orders.has(stage_order):
			return "Duplicate stage_order: %d" % stage_order
		if stage_order < previous_order or (stage_order == previous_order and stage_id < previous_id):
			return "Balance profiles must be sorted by stage_order and stage_id"
		seen_ids[stage_id] = true
		seen_orders[stage_order] = true
		previous_order = stage_order
		previous_id = stage_id
	return ""


static func _validate_profile(profile: Dictionary) -> String:
	var required_fields := [
		"stage_id", "stage_order", "expected_difficulty_level", "grid_size", "seed", "generation_mode",
		"primary_arrow_count", "min_length", "max_length", "target_empty_ratio",
		"filler_max_length", "dependency_target", "max_candidate_attempts",
	]
	for field: String in required_fields:
		if not profile.has(field):
			return "Missing field: %s" % field
	if not (profile["stage_id"] is String) or profile["stage_id"].strip_edges().is_empty():
		return "stage_id must be non-empty text"
	if not _is_integer_number(profile["stage_order"]) or profile["stage_order"] < 1:
		return "stage_order must be an integer >= 1"
	var expected_level: Variant = profile["expected_difficulty_level"]
	if expected_level != null and (not _is_integer_number(expected_level) or expected_level < 1 or expected_level > 100):
		return "expected_difficulty_level must be null or an integer within 1..100"
	if not (profile["grid_size"] is Array) or profile["grid_size"].size() != 2 \
			or not _is_integer_number(profile["grid_size"][0]) or not _is_integer_number(profile["grid_size"][1]):
		return "grid_size must contain two integers"
	var grid_size := Vector2i(profile["grid_size"][0], profile["grid_size"][1])
	var grid_error := validate_grid_size(grid_size)
	if not grid_error.is_empty():
		return grid_error
	for field: String in ["seed", "primary_arrow_count", "min_length", "max_length", "filler_max_length", "max_candidate_attempts"]:
		if not _is_integer_number(profile[field]):
			return "%s must be an integer" % field
	if profile["seed"] < 0 or profile["seed"] > 2147483647:
		return "seed must be within 0..2147483647"
	if not (profile["generation_mode"] is String) or not GENERATION_MODES.has(profile["generation_mode"]):
		return "generation_mode must be fixed or random"
	var cell_count := grid_size.x * grid_size.y
	for field: String in ["primary_arrow_count", "min_length", "max_length", "filler_max_length"]:
		if profile[field] < 1 or profile[field] > cell_count:
			return "%s must be within 1..%d" % [field, cell_count]
	if profile["max_length"] < profile["min_length"]:
		return "max_length must be at least min_length"
	if profile["max_candidate_attempts"] < 1 or profile["max_candidate_attempts"] > 256:
		return "max_candidate_attempts must be within 1..256"
	if not _is_ratio(profile["target_empty_ratio"]):
		return "target_empty_ratio must be within 0..1"
	if not (profile["dependency_target"] is Dictionary):
		return "dependency_target must be an object"
	var target: Dictionary = profile["dependency_target"]
	for field: String in ["min_dependency_depth", "max_dependency_depth"]:
		if not _is_integer_number(target.get(field)):
			return "%s must be an integer" % field
	if target["min_dependency_depth"] < 1 or target["max_dependency_depth"] < target["min_dependency_depth"]:
		return "dependency depth range is invalid"
	for prefix: String in ["initial_extractable_ratio", "forced_state_ratio"]:
		var minimum: Variant = target.get("min_%s" % prefix)
		var maximum: Variant = target.get("max_%s" % prefix)
		if not _is_ratio(minimum) or not _is_ratio(maximum) or maximum < minimum:
			return "%s range is invalid" % prefix
	return ""


static func _normalize_profile(profile_value: Variant) -> Dictionary:
	var profile: Dictionary = profile_value.duplicate(true)
	for field: String in ["stage_order", "seed", "primary_arrow_count", "min_length", "max_length", "filler_max_length", "max_candidate_attempts"]:
		profile[field] = int(profile[field])
	if profile["expected_difficulty_level"] != null:
		profile["expected_difficulty_level"] = int(profile["expected_difficulty_level"])
	profile["grid_size"] = Vector2i(int(profile["grid_size"][0]), int(profile["grid_size"][1]))
	var target: Dictionary = profile["dependency_target"]
	target["min_dependency_depth"] = int(target["min_dependency_depth"])
	target["max_dependency_depth"] = int(target["max_dependency_depth"])
	return profile


static func _is_ratio(value: Variant) -> bool:
	return (value is int or value is float) and value >= 0.0 and value <= 1.0


static func _is_integer_number(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(value, roundf(value)))


static func _content_hash(schema_version: int, profiles: Array) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(_canonical_json({"schema_version": schema_version, "profiles": profiles}).to_utf8_buffer())
	return context.finish().hex_encode()


static func _canonical_json(value: Variant) -> String:
	if value is Dictionary:
		var keys: Array = value.keys()
		keys.sort()
		var pairs := PackedStringArray()
		for key: Variant in keys:
			pairs.append("%s:%s" % [JSON.stringify(str(key)), _canonical_json(value[key])])
		return "{%s}" % ",".join(pairs)
	if value is Array:
		var items := PackedStringArray()
		for item: Variant in value:
			items.append(_canonical_json(item))
		return "[%s]" % ",".join(items)
	if value is float and is_equal_approx(value, roundf(value)):
		return str(int(value))
	return JSON.stringify(value)


static func normalize_board_config(config: Dictionary) -> Dictionary:
	if not config.has("grid_size") or not (config["grid_size"] is Vector2i):
		return _board_definition_result(Vector2i.ZERO, [], "Grid size must be a Vector2i")
	var grid_size: Vector2i = config["grid_size"]
	var grid_error := validate_grid_size(grid_size)
	if not grid_error.is_empty():
		return _board_definition_result(grid_size, [], grid_error)

	var mask_rows: Variant = config.get("mask_rows", [])
	if not (mask_rows is Array) and not (mask_rows is PackedStringArray):
		return _board_definition_result(grid_size, [], "Mask rows must be an array of strings")
	if mask_rows.is_empty():
		return _board_definition_result(grid_size, [], "")
	if mask_rows.size() != grid_size.y:
		return _board_definition_result(grid_size, [], "Mask row count must match grid height")

	var blocked_cells: Array[Vector2i] = []
	for y_index: int in grid_size.y:
		var row: Variant = mask_rows[y_index]
		if not (row is String):
			return _board_definition_result(grid_size, [], "Mask rows must be strings")
		if row.length() != grid_size.x:
			return _board_definition_result(grid_size, [], "Mask column count must match grid width")
		for x_index: int in grid_size.x:
			var symbol: String = row.substr(x_index, 1)
			if symbol == BLOCKED_MASK_SYMBOL:
				blocked_cells.append(Vector2i(x_index + 1, y_index + 1))
			elif symbol != PLAYABLE_MASK_SYMBOL:
				return _board_definition_result(
					grid_size,
					[],
					"Mask contains an unsupported symbol: %s" % symbol
				)
	if blocked_cells.size() == grid_size.x * grid_size.y:
		return _board_definition_result(grid_size, [], "Mask must contain a playable cell")
	return _board_definition_result(grid_size, blocked_cells, "")


static func validate_grid_size(grid_size: Vector2i) -> String:
	if grid_size.x <= 0 or grid_size.y <= 0:
		return "Grid size must be positive"
	if grid_size.x > MAX_GRID_SIDE or grid_size.y > MAX_GRID_SIDE:
		return "Grid side exceeds maximum %d" % MAX_GRID_SIDE
	if grid_size.x * grid_size.y > MAX_BOARD_CELL_COUNT:
		return "Grid cell count exceeds maximum %d" % MAX_BOARD_CELL_COUNT
	return ""


static func validate_stage(stage_definition: Dictionary) -> Dictionary:
	var errors := PackedStringArray()
	if not stage_definition.has("id"):
		errors.append("Stage ID is required")
	if not stage_definition.has("grid_size"):
		errors.append("Grid size is required")
	if not stage_definition.has("arrows"):
		errors.append("Arrows are required")
	if not errors.is_empty():
		return _validation_result(errors)

	var grid_size_value: Variant = stage_definition["grid_size"]
	if not (grid_size_value is Vector2i):
		errors.append("Grid size must be a Vector2i")
		return _validation_result(errors)
	var grid_size: Vector2i = grid_size_value
	var grid_error := validate_grid_size(grid_size)
	if not grid_error.is_empty():
		errors.append(grid_error)
		return _validation_result(errors)

	var blocked_value: Variant = stage_definition.get("blocked_cells", [])
	if not (blocked_value is Array):
		errors.append("Blocked cells must be an array")
		return _validation_result(errors)
	var blocked_cells: Array = blocked_value
	var blocked_set: Dictionary = {}
	for blocked_cell: Variant in blocked_cells:
		if not (blocked_cell is Vector2i):
			errors.append("Blocked cell must be a Vector2i")
			continue
		if not _is_cell_in_bounds(blocked_cell, grid_size):
			errors.append("Blocked cell is outside the grid: %s" % blocked_cell)
		if blocked_set.has(blocked_cell):
			errors.append("Duplicate blocked cell: %s" % blocked_cell)
		else:
			blocked_set[blocked_cell] = true
	var playable_cell_count := grid_size.x * grid_size.y - blocked_set.size()
	if playable_cell_count <= 0:
		errors.append("At least one playable cell is required")

	var arrows: Variant = stage_definition["arrows"]
	if not (arrows is Array) or arrows.is_empty():
		errors.append("At least one arrow is required")
		return _validation_result(errors)

	var seen_arrow_ids: Dictionary = {}
	var occupied_cells: Dictionary = {}
	for arrow_data: Variant in arrows:
		if not (arrow_data is Dictionary):
			errors.append("Arrow data must be a dictionary")
			continue
		if not arrow_data.has("id") \
				or not arrow_data.has("head_cell") \
				or not arrow_data.has("cells") \
				or not arrow_data.has("direction"):
			errors.append("Arrow data requires id, head_cell, cells, and direction")
			continue

		var arrow_id: Variant = arrow_data["id"]
		var head_cell: Variant = arrow_data["head_cell"]
		var cells: Variant = arrow_data["cells"]
		var direction: Variant = arrow_data["direction"]
		if not (arrow_id is String) or arrow_id.is_empty():
			errors.append("Arrow ID must be a non-empty string")
		elif seen_arrow_ids.has(arrow_id):
			errors.append("Duplicate arrow ID: %s" % arrow_id)
		else:
			seen_arrow_ids[arrow_id] = true

		if not (cells is Array) \
				or cells.size() < MIN_ARROW_LENGTH \
				or cells.size() > playable_cell_count:
			errors.append(
				"Arrow %s length must be within 1..%d" % [arrow_id, playable_cell_count]
			)
			continue
		if not (head_cell is Vector2i) or head_cell != cells[0]:
			errors.append("Arrow %s head_cell must be the first body cell" % arrow_id)

		var own_cells: Dictionary = {}
		for cell_index: int in cells.size():
			var cell: Variant = cells[cell_index]
			if not (cell is Vector2i):
				errors.append("Arrow %s has an invalid body cell" % arrow_id)
				continue
			if not _is_cell_in_bounds(cell, grid_size):
				errors.append("Arrow %s is outside the grid" % arrow_id)
			if blocked_set.has(cell):
				errors.append("Arrow %s occupies a blocked cell: %s" % [arrow_id, cell])
			if own_cells.has(cell):
				errors.append("Arrow %s has a duplicate body cell" % arrow_id)
			else:
				own_cells[cell] = true
			if occupied_cells.has(cell):
				errors.append("Arrow bodies overlap at %s" % cell)
			else:
				occupied_cells[cell] = arrow_id
			if cell_index > 0:
				var previous_cell: Vector2i = cells[cell_index - 1]
				if absi(cell.x - previous_cell.x) + absi(cell.y - previous_cell.y) != 1:
					errors.append("Arrow %s body cells must be cardinally connected" % arrow_id)

		if not (direction is String) or not CARDINAL_DIRECTIONS.has(direction):
			errors.append("Arrow %s has a non-cardinal direction" % arrow_id)

	return _validation_result(errors)


static func _is_cell_in_bounds(cell: Vector2i, grid_size: Vector2i) -> bool:
	return cell.x >= 1 and cell.x <= grid_size.x and cell.y >= 1 and cell.y <= grid_size.y


static func _board_definition_result(
	grid_size: Vector2i,
	blocked_cells: Array,
	error: String
) -> Dictionary:
	return {
		"grid_size": grid_size,
		"blocked_cells": blocked_cells,
		"error": error,
	}


static func _validation_result(errors: PackedStringArray) -> Dictionary:
	return {
		"is_valid": errors.is_empty(),
		"errors": errors,
	}
