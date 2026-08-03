class_name StageBalancePreview
extends Control

const STAGE_CATALOG := preload("res://scripts/stage_catalog.gd")
const CANDIDATE_SEED_STEP := 1000003
const MAX_CANDIDATE_SEED := 2147483647

@onready var stage_selector: OptionButton = %StageSelector
@onready var sync_button: Button = %SyncButton
@onready var regenerate_button: Button = %RegenerateButton
@onready var metrics_button: Button = %MetricsButton
@onready var status_label: Label = %StatusLabel
@onready var metrics_label: RichTextLabel = %MetricsLabel
@onready var metrics_panel: PanelContainer = %MetricsPanel
@onready var game: PickupArrowGame = %PreviewGame

var _stage_ids := PackedStringArray()
var _pending_stage_id := ""
var _fixed_candidate_seed_by_stage: Dictionary = {}


func _ready() -> void:
	sync_button.pressed.connect(_sync_from_google_sheets)
	regenerate_button.pressed.connect(_regenerate_selected_stage)
	metrics_button.pressed.connect(_toggle_metrics)
	stage_selector.item_selected.connect(_on_stage_selected)
	game.stage_load_completed.connect(_on_game_stage_loaded)
	game.stage_load_failed.connect(_on_game_stage_failed)
	game.read_only_preview = true
	metrics_panel.visible = false
	metrics_button.text = "Show Metrics"
	reload_local_snapshot()


func _toggle_metrics() -> void:
	metrics_panel.visible = not metrics_panel.visible
	metrics_button.text = "Hide Metrics" if metrics_panel.visible else "Show Metrics"


func reload_local_snapshot(preferred_stage_id: String = "") -> bool:
	var result := STAGE_CATALOG.reload_snapshot()
	if not result["is_valid"]:
		status_label.text = "Snapshot error: %s" % result["error"]
		return false
	_stage_ids = STAGE_CATALOG.get_stage_ids()
	stage_selector.clear()
	for stage_id: String in _stage_ids:
		stage_selector.add_item(stage_id)
	var selected_index := _stage_ids.find(preferred_stage_id)
	if selected_index < 0:
		selected_index = 0
	stage_selector.select(selected_index)
	return select_stage_by_id(_stage_ids[selected_index])


func select_stage_by_id(stage_id: String) -> bool:
	var stage_index := _stage_ids.find(stage_id)
	if stage_index < 0:
		status_label.text = "Unknown stage: %s" % stage_id
		return false
	var profile := STAGE_CATALOG.get_stage_profile(stage_id)
	_update_regenerate_label(profile["generation_mode"])
	_pending_stage_id = stage_id
	if profile["generation_mode"] == "random":
		status_label.text = "Generating random preview..."
		var request := game.request_stage(stage_id)
		if request["event"] != "generation_requested":
			_pending_stage_id = ""
			status_label.text = "Generation failed: %s" % stage_id
			return false
		stage_selector.select(stage_index)
		return true
	var result := game.load_stage(stage_id)
	if result["event"] != "stage_loaded":
		_pending_stage_id = ""
		status_label.text = "Generation failed: %s" % stage_id
		return false
	_fixed_candidate_seed_by_stage[stage_id] = int(profile["seed"])
	_complete_stage_selection(stage_id)
	return true


func _on_stage_selected(index: int) -> void:
	if index >= 0 and index < _stage_ids.size():
		select_stage_by_id(_stage_ids[index])


func _regenerate_selected_stage() -> void:
	if stage_selector.selected < 0:
		return
	var stage_id: String = _stage_ids[stage_selector.selected]
	var profile := STAGE_CATALOG.get_stage_profile(stage_id)
	if profile["generation_mode"] == "random":
		select_stage_by_id(stage_id)
		return
	var previous_seed := int(_fixed_candidate_seed_by_stage.get(stage_id, profile["seed"]))
	var candidate_seed := (previous_seed + CANDIDATE_SEED_STEP) % (MAX_CANDIDATE_SEED + 1)
	_fixed_candidate_seed_by_stage[stage_id] = candidate_seed
	_pending_stage_id = stage_id
	status_label.text = "Generating fixed candidate seed %d..." % candidate_seed
	var request := game.request_stage(stage_id, candidate_seed)
	if request["event"] != "generation_requested":
		_pending_stage_id = ""
		status_label.text = "Generation failed: %s" % stage_id


func _on_game_stage_loaded(stage_id: String, _runtime_seed: int) -> void:
	if stage_id == _pending_stage_id:
		_complete_stage_selection(stage_id)


func _on_game_stage_failed(stage_id: String, _code: String) -> void:
	if stage_id == _pending_stage_id:
		_pending_stage_id = ""
		status_label.text = "Generation failed: %s" % stage_id


func _complete_stage_selection(stage_id: String) -> void:
	_pending_stage_id = ""
	stage_selector.select(_stage_ids.find(stage_id))
	game.status_message = "Read-only balance preview"
	_update_metrics(stage_id)


func _update_regenerate_label(generation_mode: String) -> void:
	regenerate_button.text = "New Fixed Candidate" \
		if generation_mode == "fixed" else "Regenerate Random"


func _sync_from_google_sheets() -> void:
	var preserved_stage_id: String = game.board_state.active_stage_id
	sync_button.disabled = true
	status_label.text = "Syncing from the published Apps Script snapshot..."
	var output: Array = []
	var node_executable := OS.get_environment("PICKUP_ARROW_NODE")
	if node_executable.is_empty():
		node_executable = "node"
	var arguments := PackedStringArray([
		ProjectSettings.globalize_path("res://tools/balance_sheet/cli.mjs"),
		"sync",
		"--output",
		ProjectSettings.globalize_path(STAGE_CATALOG.SNAPSHOT_PATH),
	])
	var exit_code := OS.execute(node_executable, arguments, output, true)
	sync_button.disabled = false
	if exit_code != 0:
		status_label.text = "Sync failed; last-known-good preview kept.\n%s" % "\n".join(output)
		return
	if not reload_local_snapshot(preserved_stage_id):
		status_label.text = "Sync output failed local validation; previous board remains visible."
		return
	status_label.text = "Sync complete. Local snapshot updated."


func _update_metrics(stage_id: String) -> void:
	var profile := STAGE_CATALOG.get_stage_profile(stage_id)
	var stage := game.active_stage_definition
	var metadata := STAGE_CATALOG.get_snapshot_metadata()
	var expected: Variant = profile["expected_difficulty_level"]
	var expected_text := "uncalibrated" if expected == null else str(expected)
	var target: Dictionary = profile["dependency_target"]
	var generation: Dictionary = stage["generation_metrics"]
	var analysis: Dictionary = stage["dependency_analysis"]
	var targeting: Dictionary = stage["dependency_targeting_metrics"]
	metrics_label.text = "\n".join(PackedStringArray([
		"[b]Snapshot[/b]",
		"revision: %s" % metadata["source_revision"],
		"hash: %s" % metadata["content_hash"],
		"stage: %s  order: %d" % [stage_id, profile["stage_order"]],
		"expected difficulty: %s" % expected_text,
		"",
		"[b]Configured[/b]",
		"grid: %d x %d  seed: %d" % [profile["grid_size"].x, profile["grid_size"].y, profile["seed"]],
		"mode: %s  candidate/runtime seed: %d" % [profile["generation_mode"], stage["runtime_seed"]],
		"generation elapsed: %.3f sec" % game.generation_elapsed_seconds,
		"primary arrows: %d  length: %d..%d" % [profile["primary_arrow_count"], profile["min_length"], profile["max_length"]],
		"empty ratio: %.3f  filler max: %d" % [profile["target_empty_ratio"], profile["filler_max_length"]],
		"dependency depth: %d..%d" % [target["min_dependency_depth"], target["max_dependency_depth"]],
		"initial extractable: %.3f..%.3f" % [target["min_initial_extractable_ratio"], target["max_initial_extractable_ratio"]],
		"forced-state reference: %.3f..%.3f (observed only)" % [target["min_forced_state_ratio"], target["max_forced_state_ratio"]],
		"candidate attempts: %d" % profile["max_candidate_attempts"],
		"",
		"[b]Observed[/b]",
		"arrows: %d  filler: %d  occupied: %d" % [analysis["node_count"], generation["filler_arrow_count"], generation["occupied_cell_count"]],
		"actual empty ratio: %.3f" % generation["actual_empty_ratio"],
		"edges: %d  dependency depth: %d" % [analysis["edge_count"], analysis["dependency_depth"]],
		"initial extractable: %d / %.3f" % [analysis["initial_extractable_count"], analysis["initial_extractable_ratio"]],
		"forced states: %d / %.3f" % [analysis["forced_state_count"], analysis["forced_state_ratio"]],
		"average choices: %.3f" % analysis["average_choice_count"],
		"choice counts: %s" % str(analysis["choice_counts"]),
		"attempt: %d  selected seed: %d" % [targeting["attempt_count"], targeting["selected_seed"]],
		"target match: %s  fallback: %s  distance: %.6f" % [
			str(targeting["target_match"]),
			str(targeting["fallback_used"]),
			float(targeting["target_score"]["target_distance"]),
		],
		"complete solution: %s" % str(analysis["has_complete_solution"]),
	]))
	status_label.text = "Loaded %s with seed %d" % [stage_id, stage["runtime_seed"]]
