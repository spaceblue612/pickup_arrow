import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
} from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, mkdir, stat, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  LibraryStore,
  atomicJson,
  checkStage,
  checkDraft,
} from "./library.mjs";
import { CoreHost } from "./core-host.mjs";
import { validSettings } from "./editor-settings.mjs";
import { TEXT_SIZE } from "./text-size.mjs";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "arrow",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const dist = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const dataArgument = process.argv.find((a) => a.startsWith("--data-dir="));
const smokeArgument = process.argv.find(
  (argument) =>
    argument === "--smoke-test" || argument.startsWith("--smoke-test="),
);
const smoke = smokeArgument !== undefined;
const smokeSelection =
  smokeArgument === "--smoke-test"
    ? "startup"
    : smokeArgument?.slice("--smoke-test=".length);
const directory = dataArgument
  ? path.resolve(dataArgument.slice(11))
  : smoke
    ? await mkdtemp(path.join(tmpdir(), "arrow-editor-smoke-"))
    : path.join(projectRoot, "authoring");
if (smoke) {
  await mkdir(path.join(directory, "electron-profile"), { recursive: true });
  app.setPath("userData", path.join(directory, "electron-profile"));
}
const store = new LibraryStore(directory),
  core = new CoreHost();
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.exit(0);
let window,
  settings,
  closing = false;
const settingsPath = path.join(directory, "settings.json");
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});

function handle(name, operation) {
  ipcMain.handle("editor:" + name, async (event, ...args) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== "arrow://studio/index.html"
    )
      throw new Error("허용되지 않은 요청 출처");
    try {
      return { ok: true, value: await operation(...args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}
async function start() {
  if (smoke) console.log("EDITOR_BOOT: waiting for app");
  await app.whenReady();
  if (smoke) console.log("EDITOR_BOOT: app ready");
  try {
    settings = validSettings(JSON.parse(await readFile(settingsPath, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT")
      console.error("설정 파일을 적용하지 못했습니다:", error.message);
    settings = {
      godot: process.env.ARROW_GODOT || "godot",
      project: projectRoot,
      timeoutMs: 30000,
      textSizeOffset: TEXT_SIZE.default - TEXT_SIZE.base,
    };
  }
  protocol.handle("arrow", (request) => {
    const url = new URL(request.url);
    let file;
    try {
      file = path.resolve(dist, "." + decodeURIComponent(url.pathname));
    } catch {
      return new Response("Invalid path", { status: 400 });
    }
    if (url.hostname !== "studio" || !file.startsWith(dist + path.sep))
      return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({
    width: 1680,
    height: 1080,
    minWidth: 1100,
    minHeight: 740,
    show: !smoke,
    backgroundColor: "#0a0d3a",
    title: "Arrow Studio",
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !smoke,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  handle("bootstrap", async () => {
    const recovery = await store.recovery();
    if (recovery !== null) checkDraft(recovery.draft);
    return {
      library: await store.load(),
      recovery,
      settings,
      directory,
      example: JSON.parse(
        await readFile(
          path.join(projectRoot, "tool/examples/role_chain.json"),
          "utf8",
        ),
      ),
    };
  });
  handle("save", (document, expected) => store.save(document, expected));
  handle("recover", (value) => store.recover(value));
  handle("core", (request) =>
    core.run({ ...request, stage_contract: "authoring_v1" }, settings),
  );
  handle("cancel", () => core.cancel());
  handle("settings", async (value) => {
    const next = validSettings(value);
    await atomicJson(settingsPath, next);
    settings = next;
    return settings;
  });
  handle("import", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "런타임 스테이지 JSON 가져오기 (생성 설정 v3 제외)",
      properties: ["openFile"],
      filters: [{ name: "Stage JSON", extensions: ["json"] }],
    });
    if (result.canceled) return null;
    if ((await stat(result.filePaths[0])).size > 4_000_000)
      throw new Error("가져올 파일이 4MB를 초과합니다.");
    return checkStage(JSON.parse(await readFile(result.filePaths[0], "utf8")));
  });
  handle("export", async (stage) => {
    checkStage(stage);
    const result = await core.run(
      { operation: "analyze_stage", stage, stage_contract: "authoring_v1" },
      settings,
    );
    if (
      !result.validation.valid ||
      result.analysis?.solution_status !== "solved"
    )
      throw new Error(
        "규칙 검사와 클리어 가능성을 통과한 보드만 내보낼 수 있습니다.",
      );
    const target = await dialog.showSaveDialog(window, {
      title: "검증된 보드 JSON 내보내기 (게임 자동 반영 아님)",
      defaultPath: path.join(directory, stage.id + ".json"),
      filters: [{ name: "Stage JSON", extensions: ["json"] }],
    });
    if (target.canceled) return null;
    const resolved = path.resolve(target.filePath);
    if (
      resolved === path.join(projectRoot, "data/stage_balance.json") ||
      resolved.includes(path.sep + ".godot" + path.sep)
    )
      throw new Error("기존 운영 데이터·Godot 캐시에는 내보낼 수 없습니다.");
    await atomicJson(resolved, stage);
    return resolved;
  });
  window.on("close", (event) => {
    if (closing || smoke) return;
    event.preventDefault();
    void (async () => {
      await store.queue;
      const recovery = await store.recovery();
      if (recovery) {
        const answer = await dialog.showMessageBox(window, {
          type: "question",
          title: "미저장 작업",
          message: "미저장 변경은 복구본에 남아 있습니다.",
          detail:
            "후보로 저장하려면 계속 편집을 선택해 저장해 주세요. 복구본을 남기고 닫으면 다음 실행에서 다시 불러올 수 있습니다.",
          buttons: ["계속 편집", "복구본을 남기고 닫기"],
          defaultId: 0,
          cancelId: 0,
        });
        if (answer.response === 0) return;
      }
      core.cancel();
      await store.queue;
      closing = true;
      window.close();
    })().catch((error) =>
      dialog.showErrorBox("종료 전 저장 확인 오류", error.message),
    );
  });
  app.on("before-quit", () => core.cancel());
  app.on("window-all-closed", () => app.quit());
  window.webContents.on("did-fail-load", (_event, code, description) =>
    console.error("EDITOR_LOAD:", code, description),
  );
  if (smoke)
    window.webContents.on("console-message", (_event, details) =>
      console.log("EDITOR_RENDER:", details.message),
    );
  await window.loadURL("arrow://studio/index.html");
  if (smoke) console.log("EDITOR_BOOT: renderer loaded");
  if (smoke) {
    try {
      const { runSmoke } = await import("../tests/electron-smoke.mjs");
      const result = await runSmoke(window, store, directory, smokeSelection);
      console.log("EDITOR_SMOKE:" + JSON.stringify(result));
      closing = true;
      app.quit();
    } catch (error) {
      console.error(error);
      closing = true;
      app.exit(1);
    }
  }
}
if (ownsInstance)
  void start().catch((error) => {
    console.error(error);
    app.exit(1);
  });
