import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreWindowState } from '../src/window-state.mjs';
const area = { x: 0, y: 0, width: 1920, height: 1080 };
test('window position, size, and maximization restore on the same display', () => {
  assert.deepEqual(restoreWindowState({ x: 240, y: 120, width: 1200, height: 800, maximized: true }, [area]), { x: 240, y: 120, width: 1200, height: 800, minWidth: 1100, minHeight: 740, maximized: true });
});
test('secondary monitor and removed monitors remain reachable', () => {
  const saved = { x: -1800, y: 100, width: 1200, height: 800 };
  assert.equal(restoreWindowState(saved, [area, { ...area, x: -1920 }]).x, -1800);
  assert.equal(restoreWindowState(saved, [area]).x, 0);
  const small = restoreWindowState({ x: 9000, y: 9000, width: 3000, height: 2000 }, [{ x: 0, y: 0, width: 1024, height: 600 }]);
  assert.equal(small.width, 1024);
  assert.equal(small.height, 600);
  assert.equal(small.x, 0);
  assert.equal(small.y, 0);
});
test('missing or corrupted preferences use a centered default', () => {
  assert.equal(restoreWindowState(undefined, [area]).x, 120);
  assert.deepEqual(restoreWindowState({ width: 'bad' }, [area]), restoreWindowState(undefined, [area]));
});
