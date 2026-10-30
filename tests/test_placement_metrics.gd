extends SceneTree

const METRICS := preload("res://scripts/placement_metrics.gd")


func _init() -> void:
	var arrows := [
		{"id": "A", "head_cell": Vector2i(2, 1), "direction": "UP", "cells": [Vector2i(2, 1), Vector2i(2, 2), Vector2i(3, 2)]},
		{"id": "B", "head_cell": Vector2i(1, 1), "direction": "RIGHT", "cells": [Vector2i(1, 1), Vector2i(1, 2)]},
		{"id": "C", "head_cell": Vector2i(1, 3), "direction": "UP", "cells": [Vector2i(1, 3), Vector2i(1, 4)]},
	]
	var result: Dictionary = METRICS.measure(arrows, Vector2i(5, 5))
	assert(result["error"] == "")
	assert(result["occupied_tiles"] == 7)
	assert(result["contact_count"] == 3)
	assert(result["turn_count"] == 1)
	assert(is_equal_approx(result["turn_ratio"], 1.0 / 7.0))
	assert(result["blocked_count"] == 2)
	assert(result["blocker_count"] == 2)
	assert(result["solvable"])
	assert(METRICS.measure([], Vector2i(5, 5))["contact_count"] == 0)
	# A self-blocked arrow is blocked, but does not block another arrow.
	var self_blocked := [{"id": "S", "head_cell": Vector2i(2, 2), "direction": "RIGHT", "cells": [Vector2i(2, 2), Vector2i(1, 2), Vector2i(1, 1), Vector2i(2, 1), Vector2i(3, 1), Vector2i(3, 2)]}]
	var self_result: Dictionary = METRICS.measure(self_blocked, Vector2i(5, 5))
	assert(self_result["blocked_count"] == 1)
	assert(self_result["blocker_count"] == 0)
	assert(not self_result["solvable"])
	print("placement metrics passed")
	quit(0)
