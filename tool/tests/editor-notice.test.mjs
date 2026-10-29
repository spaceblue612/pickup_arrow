import test from "node:test";
import assert from "node:assert/strict";
import { editorNotice } from "../src/editor-notice.mjs";
test("one fixed notice uses error then warning then ordinary status priority", () => {
  assert.equal(
    editorNotice({ error: "오류", warning: "경고", message: "안내" }).kind,
    "error",
  );
  assert.equal(
    editorNotice({ warning: "경고", message: "안내" }).detail,
    "경고",
  );
  assert.equal(editorNotice({ message: "안내" }).kind, "info");
});
test("long multiline errors retain their complete detail without growing the summary", () => {
  const detail = "오류 내역\n" + "아주 긴 오류 문장입니다.\n".repeat(100);
  const notice = editorNotice({ error: detail });
  assert.equal(notice.detail, detail);
  assert.ok(!notice.summary.includes("\n"));
  assert.equal(Array.from(notice.summary).length, 160);
  assert.ok(notice.summary.endsWith("…"));
});
test("short notices normalize only the summary, never the original detail", () => {
  const detail = "첫 오류\n  다음 오류\t설명";
  assert.deepEqual(editorNotice({ error: detail }), {
    kind: "error",
    summary: "첫 오류 다음 오류 설명",
    detail,
  });
});
test("a dismissed error falls back to a warning or the default guide without an empty slot", () => {
  assert.equal(editorNotice({ error: "", warning: "경고" }).kind, "warning");
  assert.ok(editorNotice({}).summary.includes("화살표를 선택하거나"));
});
