extends SceneTree

const PREVIEW_SCENE := preload("res://balance_preview.tscn")
const GAME := preload("res://scripts/main.gd")
const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")

var _failures := PackedStringArray()


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var preview = PREVIEW_SCENE.instantiate()
	root.add_child(preview)
	await process_frame
	await process_frame
	_expect(preview.stage_selector.item_count == 4, "Preview lists every snapshot stage")
	_expect(preview.game.read_only_preview, "Preview game ignores player extraction input")
	_expect(not preview.metrics_panel.visible, "Preview metrics are collapsed by default")
	preview._toggle_metrics()
	_expect(preview.metrics_panel.visible, "Preview metrics can be expanded on demand")
	preview._toggle_metrics()
	_expect(not preview.metrics_panel.visible, "Preview metrics can be collapsed again")
	_expect(preview.game.board_state.active_stage_id == "STAGE-001", "Preview opens the first stage")
	_expect(
		preview.metrics_label.text.contains(STAGE_CATALOG.get_snapshot_metadata()["content_hash"]),
		"Preview displays the snapshot hash"
	)
	_expect(preview.metrics_label.text.contains("Observed"), "Preview displays observed metrics")
	_expect(preview.regenerate_button.text == "New Fixed Candidate", "Fixed stage offers a new candidate")
	var first_fixed_seed: int = preview.game.last_runtime_seed
	var first_fixed_arrows: Array = preview.game.active_stage_definition["arrows"].duplicate(true)
	preview._regenerate_selected_stage()
	await _wait_for_random_seed_change(preview, first_fixed_seed)
	_expect(preview.game.last_runtime_seed != first_fixed_seed, "Fixed candidate uses the next base seed")
	_expect(
		preview.game.active_stage_definition["arrows"] != first_fixed_arrows,
		"Fixed candidate shows a different deterministic layout"
	)
	_expect(preview.metrics_label.text.contains("target match:"), "Preview displays soft-target status")
	_expect(preview.metrics_label.text.contains("observed only"), "Preview labels forced-state as observed")
	_expect(preview.select_stage_by_id("STAGE-003"), "Preview selects another generated stage")
	_expect(preview.game.board_state.active_stage_id == "STAGE-003", "Selected stage uses the shared runtime catalog")
	_expect(preview.reload_local_snapshot("STAGE-003"), "Preview reloads the committed local snapshot")
	_expect(preview.game.board_state.active_stage_id == "STAGE-003", "Snapshot reload preserves the selected stage")
	_expect(preview.select_stage_by_id("STAGE-004"), "Preview requests the actual random stage")
	await _wait_for_preview(preview, "STAGE-004")
	var first_random_seed: int = preview.game.last_runtime_seed
	_expect(preview.metrics_label.text.contains("mode: random"), "Preview displays random mode")
	_expect(preview.metrics_label.text.contains("candidate/runtime seed:"), "Preview displays the runtime seed")
	preview._regenerate_selected_stage()
	await _wait_for_random_seed_change(preview, first_random_seed)
	_expect(preview.game.last_runtime_seed != first_random_seed, "Random Regenerate uses a fresh seed")
	preview.free()
	_finish()


func _wait_for_preview(preview, stage_id: String) -> void:
	for _frame: int in 600:
		if preview.game.flow_state != GAME.FlowState.GENERATING \
				and preview.game.board_state.active_stage_id == stage_id:
			return
		await process_frame
	_expect(false, "Preview finishes random generation")


func _wait_for_random_seed_change(preview, previous_seed: int) -> void:
	for _frame: int in 600:
		if preview.game.flow_state != GAME.FlowState.GENERATING \
				and preview.game.last_runtime_seed != previous_seed:
			return
		await process_frame
	_expect(false, "Preview random Regenerate finishes with a fresh seed")


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("Balance preview tests passed")
		quit(0)
		return
	for failure: String in _failures:
		push_error(failure)
	quit(1)
