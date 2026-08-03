class_name BoardViewportModel
extends RefCounted

enum PointerState {
	IDLE,
	PRESSED,
	PANNING,
}

const BASE_GRID_SIDE := 9.0
const DEFAULT_DRAG_THRESHOLD_PIXELS := 12.0
const PLAY_MARGIN_X := 0.0
const PLAY_TOP := 150.0
const PLAY_BOTTOM := 90.0
const MIN_ZOOM := 0.25
const MAX_ZOOM := 2.0

var grid_size := Vector2i.ZERO
var viewport_size := Vector2.ZERO
var play_rect := Rect2()
var base_cell_size := 1.0
var cell_size := 1.0
var zoom := 1.0
var board_origin := Vector2.ZERO
var drag_threshold_pixels := DEFAULT_DRAG_THRESHOLD_PIXELS
var pointer_state := PointerState.IDLE
var _pointer_start := Vector2.ZERO
var _pointer_last := Vector2.ZERO
var pinch_active := false
var _pinch_last_distance := 0.0
var _pinch_last_center := Vector2.ZERO


func configure(new_grid_size: Vector2i, new_viewport_size: Vector2) -> void:
	grid_size = new_grid_size
	viewport_size = new_viewport_size
	var play_width := maxf(1.0, viewport_size.x - PLAY_MARGIN_X * 2.0)
	var play_height := maxf(1.0, viewport_size.y - PLAY_TOP - PLAY_BOTTOM)
	play_rect = Rect2(
		Vector2(PLAY_MARGIN_X, PLAY_TOP),
		Vector2(play_width, play_height)
	)
	zoom = 1.0
	base_cell_size = play_width / BASE_GRID_SIDE
	cell_size = base_cell_size
	board_origin = play_rect.get_center() - board_pixel_size() * 0.5
	_clamp_origin()
	cancel_pointer()
	end_pinch()


func matches_configuration(expected_grid_size: Vector2i, expected_viewport_size: Vector2) -> bool:
	return grid_size == expected_grid_size and viewport_size.is_equal_approx(expected_viewport_size)


func board_pixel_size() -> Vector2:
	return Vector2(grid_size) * cell_size


func grid_to_screen(grid_position: Vector2) -> Vector2:
	return board_origin + (grid_position - Vector2(0.5, 0.5)) * cell_size


func screen_to_cell(screen_position: Vector2) -> Vector2i:
	if not play_rect.has_point(screen_position):
		return Vector2i.ZERO
	var local_position := screen_position - board_origin
	var cell := Vector2i(
		floori(local_position.x / cell_size) + 1,
		floori(local_position.y / cell_size) + 1
	)
	if cell.x < 1 or cell.x > grid_size.x or cell.y < 1 or cell.y > grid_size.y:
		return Vector2i.ZERO
	return cell


func cell_screen_rect(cell: Vector2i) -> Rect2:
	return Rect2(
		board_origin + Vector2(cell - Vector2i.ONE) * cell_size,
		Vector2.ONE * cell_size
	)


func visible_cell_bounds() -> Dictionary:
	if grid_size.x <= 0 or grid_size.y <= 0:
		return {"min": Vector2i.ZERO, "max": Vector2i.ZERO, "count": 0}
	var minimum := Vector2i(
		clampi(floori((play_rect.position.x - board_origin.x) / cell_size) + 1, 1, grid_size.x),
		clampi(floori((play_rect.position.y - board_origin.y) / cell_size) + 1, 1, grid_size.y)
	)
	var maximum := Vector2i(
		clampi(ceili((play_rect.end.x - board_origin.x) / cell_size), 1, grid_size.x),
		clampi(ceili((play_rect.end.y - board_origin.y) / cell_size), 1, grid_size.y)
	)
	minimum -= Vector2i.ONE
	maximum += Vector2i.ONE
	minimum.x = clampi(minimum.x, 1, grid_size.x)
	minimum.y = clampi(minimum.y, 1, grid_size.y)
	maximum.x = clampi(maximum.x, 1, grid_size.x)
	maximum.y = clampi(maximum.y, 1, grid_size.y)
	return {
		"min": minimum,
		"max": maximum,
		"count": (maximum.x - minimum.x + 1) * (maximum.y - minimum.y + 1),
	}


func pan_by(screen_delta: Vector2) -> bool:
	var previous_origin := board_origin
	board_origin += screen_delta
	_clamp_origin()
	return not board_origin.is_equal_approx(previous_origin)


func zoom_at(requested_zoom: float, focus_position: Vector2) -> bool:
	var next_zoom := clampf(requested_zoom, MIN_ZOOM, MAX_ZOOM)
	if is_equal_approx(next_zoom, zoom):
		return false
	var focus := Vector2(
		clampf(focus_position.x, play_rect.position.x, play_rect.end.x),
		clampf(focus_position.y, play_rect.position.y, play_rect.end.y)
	)
	var focus_grid_position := (focus - board_origin) / cell_size + Vector2(0.5, 0.5)
	zoom = next_zoom
	cell_size = base_cell_size * zoom
	board_origin = focus - (focus_grid_position - Vector2(0.5, 0.5)) * cell_size
	_clamp_origin()
	return true


func zoom_by_factor(factor: float, focus_position: Vector2) -> bool:
	if factor <= 0.0:
		return false
	return zoom_at(zoom * factor, focus_position)


func begin_pinch(first_position: Vector2, second_position: Vector2) -> bool:
	var center := (first_position + second_position) * 0.5
	var distance := first_position.distance_to(second_position)
	if distance <= 0.0 or not play_rect.has_point(center):
		return false
	cancel_pointer()
	pinch_active = true
	_pinch_last_distance = distance
	_pinch_last_center = center
	return true


func update_pinch(first_position: Vector2, second_position: Vector2) -> bool:
	if not pinch_active:
		return false
	var center := (first_position + second_position) * 0.5
	var distance := first_position.distance_to(second_position)
	if distance <= 0.0 or _pinch_last_distance <= 0.0:
		return false
	var changed := pan_by(center - _pinch_last_center)
	changed = zoom_by_factor(distance / _pinch_last_distance, center) or changed
	_pinch_last_distance = distance
	_pinch_last_center = center
	return changed


func end_pinch() -> void:
	pinch_active = false
	_pinch_last_distance = 0.0
	_pinch_last_center = Vector2.ZERO


func begin_pointer(screen_position: Vector2) -> bool:
	if pinch_active or not play_rect.has_point(screen_position):
		return false
	pointer_state = PointerState.PRESSED
	_pointer_start = screen_position
	_pointer_last = screen_position
	return true


func update_pointer(screen_position: Vector2) -> bool:
	if pointer_state == PointerState.IDLE:
		return false
	var changed := false
	if pointer_state == PointerState.PRESSED \
			and screen_position.distance_to(_pointer_start) >= drag_threshold_pixels:
		pointer_state = PointerState.PANNING
		changed = pan_by(screen_position - _pointer_start)
	elif pointer_state == PointerState.PANNING:
		changed = pan_by(screen_position - _pointer_last)
	_pointer_last = screen_position
	return changed


func end_pointer(screen_position: Vector2) -> Dictionary:
	if pointer_state == PointerState.IDLE:
		return {"is_tap": false, "position": screen_position}
	update_pointer(screen_position)
	var is_tap := pointer_state == PointerState.PRESSED
	cancel_pointer()
	return {"is_tap": is_tap, "position": screen_position}


func cancel_pointer() -> void:
	pointer_state = PointerState.IDLE
	_pointer_start = Vector2.ZERO
	_pointer_last = Vector2.ZERO


func _clamp_origin() -> void:
	var pixel_size := board_pixel_size()
	var centered_origin := play_rect.get_center() - pixel_size * 0.5
	if pixel_size.x <= play_rect.size.x:
		board_origin.x = centered_origin.x
	else:
		board_origin.x = clampf(
			board_origin.x,
			play_rect.end.x - pixel_size.x,
			play_rect.position.x
		)
	if pixel_size.y <= play_rect.size.y:
		board_origin.y = centered_origin.y
	else:
		board_origin.y = clampf(
			board_origin.y,
			play_rect.end.y - pixel_size.y,
			play_rect.position.y
		)
