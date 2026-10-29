// Pixel scale belongs to the camera, not to the surrounding layout.
export function fitCamera(viewport, board) {
  const scale = Math.min(viewport.width / board[0], viewport.height / board[1]);
  return {
    x: (board[0] - viewport.width / scale) / 2,
    y: (board[1] - viewport.height / scale) / 2,
    zoom: 1,
    scale,
  };
}

export function preserveCamera(camera, previous, next) {
  const dx = next.left - previous.left,
    dy = next.top - previous.top;
  if (!dx && !dy) return camera;
  const scale = camera.scale * camera.zoom;
  return { ...camera, x: camera.x + dx / scale, y: camera.y + dy / scale };
}

export function cameraViewBox(camera, viewport) {
  const scale = camera.scale * camera.zoom;
  return [camera.x, camera.y, viewport.width / scale, viewport.height / scale];
}
