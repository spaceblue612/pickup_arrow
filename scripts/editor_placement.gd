class_name EditorPlacement
extends RefCounted

const ANALYZER := preload("res://scripts/dependency_analyzer.gd")
const METRICS := preload("res://scripts/placement_metrics.gd")
const VALIDATOR := preload("res://scripts/stage_validator.gd")
const STEPS := [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]
const NAMES := ["UP", "DOWN", "LEFT", "RIGHT"]


static func generate(stage: Dictionary, target_cells: Array, stage1_percent: float, fill_percent: float, min_length: int, max_length: int, seed_value: int, settings: Dictionary = {}) -> Dictionary:
	var grid: Vector2i = stage["grid_size"]
	var target: Dictionary = {}
	for cell: Variant in target_cells:
		if not (cell is Vector2i) or cell.x < 1 or cell.y < 1 or cell.x > grid.x or cell.y > grid.y or target.has(cell):
			return {"error": "생성 영역의 좌표가 잘못되었습니다."}
		target[cell] = true
	if min_length < 2 or max_length < min_length or max_length > 10000 or stage1_percent < 0 or stage1_percent > 100 or fill_percent < 0 or fill_percent > 100:
		return {"error": "생성 비율 또는 길이 범위가 잘못되었습니다."}
	var occupied: Dictionary = {}
	for cell: Vector2i in stage["blocked_cells"]:
		occupied[cell] = true
	for arrow: Dictionary in stage["arrows"]:
		for cell: Vector2i in arrow["cells"]:
			occupied[cell] = true
	var free: Array = []
	for cell: Vector2i in target:
		if not occupied.has(cell):
			free.append(cell)
	if free.is_empty():
		return {"error": "대상에 빈 배치 가능 칸이 없습니다."}
	var result: Dictionary = stage.duplicate(true)
	var initial_count: int = result["arrows"].size()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var primary_target := roundi(free.size() * stage1_percent / 100.0)
	settings = settings.duplicate(true)
	settings["initial_count"] = initial_count
	var primary_added := 0
	var reserved: Dictionary = {}
	for scope: Dictionary in settings.get("scopes", []):
		var scoped_free: Array = []
		for raw: Array in scope.get("cells", []):
			var cell := Vector2i(int(raw[0]), int(raw[1]))
			if target.has(cell) and not reserved.has(cell) and not occupied.has(cell):
				scoped_free.append(cell)
				reserved[cell] = true
		if scoped_free.is_empty():
			continue
		var scoped_settings: Dictionary = scope.get("values", {}).duplicate(true)
		scoped_settings["rules"] = scope.get("rules", [])
		scoped_settings["initial_count"] = result["arrows"].size()
		var scope_goal := roundi(scoped_free.size() * float(scoped_settings.get("stage1", stage1_percent)) / 100.0)
		primary_added += _fill(result, scoped_free, occupied, scope_goal, min_length, max_length, rng, scoped_settings)
	var unreserved: Array = []
	for cell: Vector2i in free:
		if not reserved.has(cell):
			unreserved.append(cell)
	if not unreserved.is_empty():
		primary_added += _fill(result, unreserved, occupied, maxi(0, primary_target - primary_added), min_length, max_length, rng, settings)
	var primary: Array = result["arrows"].slice(initial_count)
	var primary_metrics := METRICS.measure(primary, grid)
	var filler_target := 0
	var filler_added := 0
	var filled_scopes: Dictionary = {}
	for scope: Dictionary in settings.get("scopes", []):
		var scoped_free: Array = []
		for raw: Array in scope.get("cells", []):
			var cell := Vector2i(int(raw[0]), int(raw[1]))
			if target.has(cell) and not filled_scopes.has(cell) and not occupied.has(cell):
				scoped_free.append(cell)
				filled_scopes[cell] = true
		if scoped_free.is_empty():
			continue
		var values: Dictionary = scope.get("values", {})
		var goal := roundi(scoped_free.size() * float(values.get("fill", fill_percent)) / 100.0)
		filler_target += goal
		filler_added += _fill(result, scoped_free, occupied, goal, min_length, max_length, rng, {"uniformity": values.get("uniformity", settings.get("uniformity", 0))})
	var filler_free: Array = []
	for cell: Vector2i in free:
		if not occupied.has(cell) and not filled_scopes.has(cell):
			filler_free.append(cell)
	var rest_goal := roundi(filler_free.size() * fill_percent / 100.0)
	filler_target += rest_goal
	if not filler_free.is_empty():
		filler_added += _fill(result, filler_free, occupied, rest_goal, min_length, max_length, rng, {"uniformity": settings.get("uniformity", 0)})
	if result["arrows"].is_empty():
		return {"error": "화살을 생성하지 못했습니다. 비율 또는 영역을 변경해 주세요."}
	var validation: Dictionary = VALIDATOR.validate_stage(result, VALIDATOR.AUTHORING_MIN_ARROW_LENGTH)
	var final_metrics := METRICS.measure(result["arrows"], grid)
	if not validation["is_valid"] or not final_metrics.get("solvable", false):
		return {"error": "최종 보드가 유효하지 않거나 해결할 수 없습니다."}
	var deviations: Array = []
	for field: String in ["bends", "participation", "blocker"]:
		if settings.has(field):
			var metric: String = {"bends": "turn_ratio", "participation": "blocked_ratio", "blocker": "blocker_ratio"}[field]
			var actual := float(primary_metrics[metric]) * 100.0
			if absf(actual - float(settings[field])) > 5.0:
				deviations.append("%s 요청 %.1f%% / 실제 %.1f%%" % [field, float(settings[field]), actual])
	var lengths: Dictionary = {}
	for arrow: Dictionary in primary:
		var length: int = arrow["cells"].size()
		lengths[length] = int(lengths.get(length, 0)) + 1
	for rule: Dictionary in settings.get("rules", []):
		var length := int(rule["length"])
		var actual := int(lengths.get(length, 0))
		var requested := roundi(float(rule["amount"]) * primary.size() / 100.0) if rule["unit"] == "percent" else int(rule["amount"])
		if actual != requested:
			deviations.append("%d칸 길이 요청 %d개 / 실제 %d개" % [length, requested, actual])
	var groups: Dictionary = {}
	for arrow: Dictionary in stage["arrows"]:
		groups[arrow["id"]] = "existing"
	for arrow: Dictionary in primary:
		groups[arrow["id"]] = "primary"
	for arrow: Dictionary in result["arrows"].slice(initial_count + primary.size()):
		groups[arrow["id"]] = "filler"
	return {"groups": groups, "deviations": deviations, "error": "", "stage": result, "primary": primary_metrics, "final": final_metrics, "primary_target": primary_target, "primary_added": primary_added, "filler_target": filler_target, "filler_added": filler_added}


static func _fill(stage: Dictionary, free: Array, occupied: Dictionary, goal: int, min_length: int, max_length: int, rng: RandomNumberGenerator, settings: Dictionary = {}) -> int:
	var added := 0
	var failures := 0
	var ids: Dictionary = {}
	for arrow: Dictionary in stage["arrows"]:
		ids[arrow["id"]] = true
	var planned: Array = []
	var restricted: Dictionary = {}
	for rule: Dictionary in settings.get("rules", []):
		var length := int(rule["length"])
		var amount := int(rule["amount"])
		if rule["unit"] == "percent":
			amount = roundi(float(goal) / ((min_length + max_length) * 0.5) * float(rule["amount"]) / 100.0)
		for existing: Dictionary in stage["arrows"].slice(int(settings.get("initial_count", stage["arrows"].size()))):
			if existing["cells"].size() == length:
				amount -= 1
		restricted[length] = true
		for i: int in maxi(0, mini(amount, 5000)):
			planned.append(length)
	var free_set: Dictionary = {}
	for cell: Vector2i in free:
		free_set[cell] = true
	while added < goal and failures < 600:
		var length := rng.randi_range(min_length, maxi(min_length, mini(max_length, goal - added)))
		if not planned.is_empty():
			length = int(planned[0])
		elif restricted.has(length):
			failures += 1
			continue
		var head: Vector2i = free[rng.randi_range(0, free.size() - 1)]
		if float(settings.get("uniformity", 0)) > rng.randf() * 100.0:
			var best_score := INF
			for sample: int in 12:
				var candidate: Vector2i = free[rng.randi_range(0, free.size() - 1)]
				var score := 0.0
				for cell: Vector2i in occupied:
					if candidate.distance_squared_to(cell) <= 16:
						score += 1.0
				if score < best_score and not occupied.has(candidate):
					best_score = score
					head = candidate
		if occupied.has(head):
			failures += 1
			continue
		var index := rng.randi_range(0, 3)
		var cells: Array = [head]
		var local := {head: true}
		var body: Vector2i = head - STEPS[index]
		if not free_set.has(body) or occupied.has(body):
			failures += 1
			continue
		cells.append(body)
		local[body] = true
		while cells.size() < length:
			var options: Array = []
			for step: Vector2i in STEPS:
				var next: Vector2i = cells.back() + step
				if free_set.has(next) and not occupied.has(next) and not local.has(next):
					options.append(next)
			if options.is_empty():
				break
			var straight: Vector2i = cells.back() + (cells.back() - cells[cells.size() - 2])
			if options.has(straight) and rng.randf() > float(settings.get("bends", 30)) / 100.0:
				options = [straight]
			var next: Vector2i = options[rng.randi_range(0, options.size() - 1)]
			cells.append(next)
			local[next] = true
		if cells.size() != length:
			failures += 1
			continue
		var id := "AUTO-%d" % rng.randi()
		while ids.has(id):
			id = "AUTO-%d" % rng.randi()
		stage["arrows"].append({"id": id, "head_cell": head, "cells": cells, "direction": NAMES[index]})
		var analysis: Dictionary = ANALYZER.analyze(stage["arrows"], stage["grid_size"])
		if not analysis["error"].is_empty() or not analysis["has_complete_solution"]:
			stage["arrows"].pop_back()
			failures += 1
			continue
		var primary: Array = stage["arrows"].slice(int(settings.get("initial_count", stage["arrows"].size() - 1)))
		var measured: Dictionary = METRICS.measure(primary, stage["grid_size"])
		var desired := 0.0
		var measured_value := 0.0
		var controls := 0
		for field: String in ["participation", "blocker"]:
			if settings.has(field):
				controls += 1
				desired += float(settings[field]) / 100.0
				measured_value += float(measured["blocked_ratio" if field == "participation" else "blocker_ratio"])
		if controls > 0 and rng.randf() < absf(desired - measured_value) / controls * 0.8:
			stage["arrows"].pop_back()
			failures += 1
			continue
		if not planned.is_empty():
			planned.pop_front()
		ids[id] = true
		for cell: Vector2i in cells:
			occupied[cell] = true
		added += cells.size()
		failures = 0
	return added
