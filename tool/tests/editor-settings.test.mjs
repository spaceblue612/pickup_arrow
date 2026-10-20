import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { validSettings } from "../src/editor-settings.mjs";

const previous = {
  godot: "godot",
  project: path.resolve(".."),
  timeoutMs: 30000,
};
test("old preferences gain larger default text without losing core settings", () => {
  assert.deepEqual(validSettings(previous), { ...previous, textSizeOffset: 2 });
  assert.equal("textSizeOffset" in previous, false);
  for (const textSizeOffset of [0, 1, 2, 3, 4, 5, 6])
    assert.equal(
      validSettings({ ...previous, textSizeOffset }).textSizeOffset,
      textSizeOffset,
    );
});
test("invalid preferences cannot change text or core execution settings", () => {
  for (const textSizeOffset of [-1, 7, 1.5, "2", false])
    assert.throws(
      () => validSettings({ ...previous, textSizeOffset }),
      /글자 크기/,
    );
  assert.throws(
    () => validSettings({ ...previous, project: "relative" }),
    /절대 경로/,
  );
  assert.throws(
    () => validSettings({ ...previous, timeoutMs: 0 }),
    /제한 시간/,
  );
  assert.throws(() => validSettings({ ...previous, godot: "" }), /Godot/);
});
