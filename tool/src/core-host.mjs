import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { checkStage } from "./library.mjs";

export class CoreHost {
  constructor() {
    this.child = null;
    this.busy = false;
    this.cancelRequested = false;
  }
  cancel() {
    this.cancelRequested = true;
    if (this.child) this.child.kill();
  }
  async run(request, settings) {
    if (this.busy)
      throw new Error("코어 계산이 진행 중입니다. 완료하거나 취소해 주세요.");
    if (
      ![
        "validate_stage",
        "analyze_stage",
        "apply_action",
        "translate_arrow",
        "reshape_arrow",
      ].includes(request?.operation)
    )
      throw new Error("지원하지 않는 코어 요청입니다.");
    checkStage(request.stage);
    if (
      ["apply_action", "translate_arrow", "reshape_arrow"].includes(
        request.operation,
      ) &&
      (typeof request.arrow_id !== "string" ||
        !request.arrow_id.trim() ||
        request.arrow_id.length > 200)
    )
      throw new Error("화살표 ID 오류");
    if (
      request.stage_contract !== undefined &&
      !["runtime_v1", "authoring_v1"].includes(request.stage_contract)
    )
      throw new Error("지원하지 않는 스테이지 계약입니다.");
    if (
      request.operation === "translate_arrow" &&
      (!Array.isArray(request.offset) ||
        request.offset.length !== 2 ||
        !request.offset.every((n) => Number.isInteger(n) && Math.abs(n) <= 999))
    )
      throw new Error("이동량은 -999~999 사이의 정수 두 개여야 합니다.");
    if (
      request.operation === "reshape_arrow" &&
      (!Array.isArray(request.cells) ||
        request.cells.length < 1 ||
        request.cells.length > 10000 ||
        !request.cells.every(
          (c) =>
            Array.isArray(c) &&
            c.length === 2 &&
            c.every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1000000),
        ))
    )
      throw new Error("변형 좌표는 정수 쌍 1~10000개여야 합니다.");
    this.busy = true;
    this.cancelRequested = false;
    const requestId = randomUUID();
    let directory;
    let timer;
    try {
      directory = await mkdtemp(path.join(tmpdir(), "arrow-core-"));
      const input = path.join(directory, "request.json"),
        output = path.join(directory, "response.json");
      await writeFile(
        input,
        JSON.stringify({
          ...request,
          protocol_version: 1,
          request_id: requestId,
        }),
      );
      if (this.cancelRequested) throw new Error("코어 계산을 취소했습니다.");
      const child = spawn(
        settings.godot,
        [
          "--headless",
          "--log-file",
          path.join(directory, "godot.log"),
          "--path",
          settings.project,
          "--script",
          "res://scripts/bridge/cli_runner.gd",
          "--",
          "--input",
          input,
          "--output",
          output,
        ],
        { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      this.child = child;
      let logs = "";
      let timedOut = false;
      child.stdout.on("data", (b) => {
        logs = (logs + b.toString()).slice(-4000);
      });
      child.stderr.on("data", (b) => {
        logs = (logs + b.toString()).slice(-4000);
      });
      timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, settings.timeoutMs);
      const result = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      if (timedOut)
        throw new Error(
          "코어 계산 시간 제한을 초과했습니다. 보드는 변경하지 않았습니다.",
        );
      if (result.signal) throw new Error("코어 계산을 취소했습니다.");
      if (result.code !== 0)
        throw new Error("Godot 실행 실패 (" + result.code + "): " + logs);
      const response = JSON.parse(await readFile(output, "utf8"));
      if (
        response.protocol_version !== 1 ||
        response.request_id !== requestId ||
        response.ok !== true ||
        typeof response.validation?.valid !== "boolean"
      )
        throw new Error("코어 응답 형식 또는 요청 ID 오류");
      return response;
    } finally {
      clearTimeout(timer);
      this.child = null;
      this.busy = false;
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }
}
