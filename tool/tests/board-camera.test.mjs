import test from "node:test";
import assert from "node:assert/strict";
import {
  fitCamera,
  preserveCamera,
  cameraViewBox,
} from "../src/board-camera.mjs";
const viewport = { left: 200, top: 150, width: 900, height: 600 };
const board = [480, 360];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const screen = (camera, rect, point) => [
  rect.left + (point[0] - camera.x) * camera.scale * camera.zoom,
  rect.top + (point[1] - camera.y) * camera.scale * camera.zoom,
];
test("explicit fit centers the complete board at a pixel scale", () => {
  const camera = fitCamera(viewport, board);
  near(camera.scale, 600 / 360);
  assert.deepEqual(screen(camera, viewport, [240, 180]), [650, 450]);
  assert.equal(camera.zoom, 1);
});
test("surrounding panel size changes never alter scale or board screen coordinates", () => {
  const camera = fitCamera(viewport, board);
  const next = { ...viewport, width: 750, height: 450 };
  const resized = preserveCamera(camera, viewport, next);
  assert.equal(resized, camera);
  assert.deepEqual(
    screen(resized, next, [100, 100]),
    screen(camera, viewport, [100, 100]),
  );
  const box = cameraViewBox(resized, next);
  near(next.width / box[2], camera.scale);
  near(next.height / box[3], camera.scale);
});
test("moving the viewport for any message preserves the physical board origin", () => {
  const camera = fitCamera(viewport, board),
    next = { ...viewport, left: 250, top: 270, height: 480 };
  const moved = preserveCamera(camera, viewport, next);
  const before = screen(camera, viewport, [100, 100]),
    after = screen(moved, next, [100, 100]);
  before.forEach((n, i) => near(n, after[i]));
  assert.equal(moved.scale, camera.scale);
  assert.equal(moved.zoom, camera.zoom);
});
test("layout changes preserve a manually zoomed and panned camera and return without drift", () => {
  const camera = { ...fitCamera(viewport, board), x: 70, y: 40, zoom: 2.25 };
  const next = {
    ...viewport,
    top: viewport.top + 83,
    height: viewport.height - 83,
  };
  const moved = preserveCamera(camera, viewport, next),
    restored = preserveCamera(moved, next, viewport);
  near(restored.x, camera.x);
  near(restored.y, camera.y);
  assert.equal(restored.zoom, camera.zoom);
  assert.equal(restored.scale, camera.scale);
  const box = cameraViewBox(moved, next);
  near(next.width / box[2], camera.scale * camera.zoom);
});
test("resizing only refits when the user explicitly asks", () => {
  const camera = fitCamera(viewport, board),
    small = { ...viewport, width: 500, height: 400 };
  assert.equal(preserveCamera(camera, viewport, small).scale, camera.scale);
  assert.notEqual(fitCamera(small, board).scale, camera.scale);
});
