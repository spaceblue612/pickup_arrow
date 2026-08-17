class_name GenerationQuality
extends RefCounted

const REQUIRED_TARGET_FIELDS := [
	"distribution_grid_size",
	"center_region_ratio",
	"min_center_occupancy_ratio_from_global",
	"min_bin_occupancy_ratio_from_global",
	"long_arrow_min_length",
	"min_long_cell_ratio",
	"bent_arrow_min_length",
	"min_bent_arrow_ratio",
	"complex_arrow_min_length",
	"complex_arrow_min_turns",
	"min_complex_arrow_ratio",
	"min_direction_count",
]


static func measure(
	arrows: Array,
	grid_size: Vector2i,
	blocked_cells: Array,
	target: Dictionary
) -> Dictionary:
	var target_error := validate_target(target, grid_size)
	if not target_error.is_empty():
		return {"error": target_error, "matches_target": false, "violations": [target_error]}
	var blocked_set: Dictionary = {}
	for blocked_cell: Vector2i in blocked_cells:
		blocked_set[blocked_cell] = true
	var occupied_set: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		for cell: Vector2i in arrow_data["cells"]:
			occupied_set[cell] = true

	var playable_count := grid_size.x * grid_size.y - blocked_set.size()
	var global_occupancy_ratio := float(occupied_set.size()) / float(maxi(playable_count, 1))
	var center_counts := _center_counts(
		occupied_set,
		blocked_set,
		grid_size,
		float(target["center_region_ratio"])
	)
	var center_occupancy_ratio := float(center_counts["occupied"]) \
			/ float(maxi(center_counts["playable"], 1))
	var bin_metrics := _bin_metrics(
		occupied_set,
		blocked_set,
		grid_size,
		int(target["distribution_grid_size"])
	)
	var arrow_metrics := _arrow_metrics(arrows, target)
	var violations := PackedStringArray()
	if center_occupancy_ratio + 0.000001 \
			< global_occupancy_ratio * float(target["min_center_occupancy_ratio_from_global"]):
		violations.append("center_occupancy")
	if float(bin_metrics["minimum_ratio"]) + 0.000001 \
			< global_occupancy_ratio * float(target["min_bin_occupancy_ratio_from_global"]):
		violations.append("bin_occupancy")
	if float(arrow_metrics["long_cell_ratio"]) + 0.000001 < float(target["min_long_cell_ratio"]):
		violations.append("long_cell_ratio")
	if float(arrow_metrics["bent_arrow_ratio"]) + 0.000001 < float(target["min_bent_arrow_ratio"]):
		violations.append("bent_arrow_ratio")
	if float(arrow_metrics["complex_arrow_ratio"]) + 0.000001 < float(target["min_complex_arrow_ratio"]):
		violations.append("complex_arrow_ratio")
	if int(arrow_metrics["direction_count"]) < int(target["min_direction_count"]):
		violations.append("direction_count")
	return {
		"error": "",
		"matches_target": violations.is_empty(),
		"violations": violations,
		"global_occupancy_ratio": global_occupancy_ratio,
		"center_occupancy_ratio": center_occupancy_ratio,
		"minimum_bin_occupancy_ratio": bin_metrics["minimum_ratio"],
		"bin_occupancy_ratios": bin_metrics["ratios"],
		"long_cell_ratio": arrow_metrics["long_cell_ratio"],
		"bent_arrow_ratio": arrow_metrics["bent_arrow_ratio"],
		"complex_arrow_ratio": arrow_metrics["complex_arrow_ratio"],
		"direction_count": arrow_metrics["direction_count"],
	}


static func validate_target(target: Dictionary, grid_size: Vector2i) -> String:
	for field: String in REQUIRED_TARGET_FIELDS:
		if not target.has(field):
			return "Missing shape target field: %s" % field
	if grid_size.x <= 0 or grid_size.y <= 0:
		return "Shape target requires a positive grid size"
	return ""


static func _center_counts(
	occupied_set: Dictionary,
	blocked_set: Dictionary,
	grid_size: Vector2i,
	region_ratio: float
) -> Dictionary:
	var region_width := maxi(1, roundi(float(grid_size.x) * region_ratio))
	var region_height := maxi(1, roundi(float(grid_size.y) * region_ratio))
	var start_x := (grid_size.x - region_width) / 2 + 1
	var start_y := (grid_size.y - region_height) / 2 + 1
	var playable := 0
	var occupied := 0
	for y: int in range(start_y, start_y + region_height):
		for x: int in range(start_x, start_x + region_width):
			var cell := Vector2i(x, y)
			if blocked_set.has(cell):
				continue
			playable += 1
			if occupied_set.has(cell):
				occupied += 1
	return {"playable": playable, "occupied": occupied}


static func _bin_metrics(
	occupied_set: Dictionary,
	blocked_set: Dictionary,
	grid_size: Vector2i,
	bin_count: int
) -> Dictionary:
	var playable_counts: Array[int] = []
	var occupied_counts: Array[int] = []
	playable_counts.resize(bin_count * bin_count)
	occupied_counts.resize(bin_count * bin_count)
	for y: int in range(1, grid_size.y + 1):
		for x: int in range(1, grid_size.x + 1):
			var cell := Vector2i(x, y)
			if blocked_set.has(cell):
				continue
			var bin_x := mini(bin_count - 1, (x - 1) * bin_count / grid_size.x)
			var bin_y := mini(bin_count - 1, (y - 1) * bin_count / grid_size.y)
			var bin_index := bin_y * bin_count + bin_x
			playable_counts[bin_index] += 1
			if occupied_set.has(cell):
				occupied_counts[bin_index] += 1
	var ratios := PackedFloat32Array()
	var minimum_ratio := 1.0
	for bin_index: int in playable_counts.size():
		if playable_counts[bin_index] <= 0:
			continue
		var ratio := float(occupied_counts[bin_index]) / float(playable_counts[bin_index])
		ratios.append(ratio)
		minimum_ratio = minf(minimum_ratio, ratio)
	if ratios.is_empty():
		minimum_ratio = 0.0
	return {"minimum_ratio": minimum_ratio, "ratios": ratios}


static func _arrow_metrics(arrows: Array, target: Dictionary) -> Dictionary:
	var occupied_cell_count := 0
	var long_cell_count := 0
	var bent_eligible_count := 0
	var bent_count := 0
	var complex_eligible_count := 0
	var complex_count := 0
	var directions: Dictionary = {}
	for arrow_data: Dictionary in arrows:
		var cells: Array = arrow_data["cells"]
		var length := cells.size()
		occupied_cell_count += length
		directions[arrow_data["direction"]] = true
		if length >= int(target["long_arrow_min_length"]):
			long_cell_count += length
		var turn_count := _turn_count(cells)
		if length >= int(target["bent_arrow_min_length"]):
			bent_eligible_count += 1
			if turn_count >= 1:
				bent_count += 1
		if length >= int(target["complex_arrow_min_length"]):
			complex_eligible_count += 1
			if turn_count >= int(target["complex_arrow_min_turns"]):
				complex_count += 1
	return {
		"long_cell_ratio": float(long_cell_count) / float(maxi(occupied_cell_count, 1)),
		"bent_arrow_ratio": float(bent_count) / float(maxi(bent_eligible_count, 1)),
		"complex_arrow_ratio": float(complex_count) / float(maxi(complex_eligible_count, 1)),
		"direction_count": directions.size(),
	}


static func _turn_count(cells: Array) -> int:
	if cells.size() < 3:
		return 0
	var turns := 0
	var previous_step: Vector2i = cells[1] - cells[0]
	for cell_index: int in range(2, cells.size()):
		var step: Vector2i = cells[cell_index] - cells[cell_index - 1]
		if step != previous_step:
			turns += 1
		previous_step = step
	return turns
