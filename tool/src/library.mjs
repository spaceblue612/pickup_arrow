import {
  readFile,
  writeFile,
  rename,
  mkdir,
  copyFile,
  unlink,
  open,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const emptyLibrary = () => ({
  schema_version: 1,
  revision: 0,
  stages: [],
});
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
export function checkStage(stage) {
  requireValue(
    object(stage) && text(stage.id),
    "스테이지 형식이 올바르지 않습니다.",
  );
  requireValue(
    Array.isArray(stage.grid_size) &&
      stage.grid_size.length === 2 &&
      stage.grid_size.every((n) => Number.isInteger(n) && n > 0 && n <= 999) &&
      stage.grid_size[0] * stage.grid_size[1] <= 10000,
    "보드 크기는 양의 정수, 최대 10,000칸이어야 합니다.",
  );
  const cell = (c) =>
    Array.isArray(c) &&
    c.length === 2 &&
    c.every((n) => Number.isInteger(n) && Math.abs(n) <= 10000);
  requireValue(
    Array.isArray(stage.blocked_cells) &&
      stage.blocked_cells.length <= 10000 &&
      stage.blocked_cells.every(cell),
    "배치 금지 칸 형식 오류",
  );
  requireValue(
    Array.isArray(stage.arrows) && stage.arrows.length <= 10000,
    "화살표 목록 형식 오류",
  );
  let total = 0;
  for (const a of stage.arrows) {
    requireValue(
      object(a) &&
        text(a.id) &&
        cell(a.head_cell) &&
        ["UP", "DOWN", "LEFT", "RIGHT"].includes(a.direction) &&
        Array.isArray(a.cells) &&
        a.cells.length > 0 &&
        a.cells.every(cell),
      "화살표 형식 오류",
    );
    total += a.cells.length;
    requireValue(total <= 50000, "초안의 좌표 수 제한을 초과했습니다.");
  }
  return stage;
}
export function checkDraft(draft) {
  requireValue(object(draft), "초안 형식 오류");
  checkStage(draft.stage);
  requireValue(
    Array.isArray(draft.regions) && draft.regions.length <= 1000,
    "영역 목록 오류",
  );
  for (const r of draft.regions)
    requireValue(
      object(r) &&
        text(r.id) &&
        text(r.name) &&
        Array.isArray(r.cells) &&
        r.cells.length <= 10000 &&
        r.cells.every(
          (c) =>
            Array.isArray(c) && c.length === 2 && c.every(Number.isInteger),
        ),
      "영역 형식 오류",
    );
  requireValue(
    object(draft.targets) && object(draft.roles),
    "맵 조건 형식 오류",
  );
  requireValue(
    JSON.stringify(draft).length <= 4_000_000,
    "초안 크기 제한을 초과했습니다.",
  );
  return draft;
}
export function checkLibrary(library) {
  requireValue(
    object(library) &&
      library.schema_version === 1 &&
      Number.isSafeInteger(library.revision) &&
      library.revision >= 0 &&
      Array.isArray(library.stages) &&
      library.stages.length <= 10000,
    "지원하지 않는 제작 데이터입니다.",
  );
  const ids = new Set();
  for (const s of library.stages) {
    requireValue(
      object(s) &&
        /^STAGE-\d{3,}$/.test(s.id) &&
        !ids.has(s.id) &&
        typeof s.archived === "boolean" &&
        Array.isArray(s.candidates),
      "스테이지 ID 또는 후보 목록 오류",
    );
    ids.add(s.id);
    const candidates = new Set();
    for (const c of s.candidates) {
      requireValue(
        object(c) &&
          text(c.id) &&
          !candidates.has(c.id) &&
          text(c.name) &&
          Array.isArray(c.versions),
        "후보 형식 오류",
      );
      candidates.add(c.id);
      const versions = new Set();
      for (const v of c.versions) {
        requireValue(
          object(v) && text(v.id) && !versions.has(v.id) && text(v.at),
          "버전 형식 오류",
        );
        versions.add(v.id);
        checkDraft(v.draft);
        requireValue(
          v.draft.stage.id === s.id,
          "후보와 스테이지 ID가 다릅니다.",
        );
      }
    }
  }
  requireValue(
    JSON.stringify(library).length <= 32_000_000,
    "제작 데이터가 32MB 제한을 초과했습니다. 백업 후 분리가 필요합니다.",
  );
  return library;
}
async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(
      "파일을 읽을 수 없습니다. 원본은 보존됩니다: " +
        file +
        " · " +
        error.message,
    );
  }
}
export async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const handle = await open(temporary, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await copyFile(file, file + ".bak");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
export class LibraryStore {
  constructor(directory) {
    this.directory = directory;
    this.queue = Promise.resolve();
  }
  async load() {
    return checkLibrary(
      await readJson(path.join(this.directory, "library.json"), emptyLibrary()),
    );
  }
  deleteCandidate(stageId, candidateId, expectedRevision) {
    const operation = this.queue.then(async () => {
      const current = await this.load();
      requireValue(current.revision === expectedRevision, "저장 충돌: 최신 데이터를 다시 열어 주세요.");
      const stage = current.stages.find(item => item.id === stageId);
      requireValue(stage && stage.candidates.some(item => item.id === candidateId), "삭제할 후보가 없습니다.");
      stage.candidates = stage.candidates.filter(item => item.id !== candidateId);
      current.revision += 1;
      checkLibrary(current);
      await atomicJson(path.join(this.directory, "library.json"), current);
      return current;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  save(library, expectedRevision) {
    const operation = this.queue.then(async () => {
      checkLibrary(library);
      const current = await this.load();
      requireValue(
        current.revision === expectedRevision,
        "저장 충돌: 최신 데이터를 다시 열어 주세요. 현재 파일은 변경하지 않았습니다.",
      );
      // Old snapshots are immutable; new versions may only be appended.
      for (const oldStage of current.stages) {
        const stage = library.stages.find((s) => s.id === oldStage.id);
        requireValue(stage, "스테이지 삭제 대신 보관을 사용해 주세요.");
        for (const oldCandidate of oldStage.candidates) {
          const candidate = stage.candidates.find(
            (c) => c.id === oldCandidate.id,
          );
          requireValue(candidate, "저장한 후보 이력은 삭제할 수 없습니다.");
          for (const version of oldCandidate.versions)
            requireValue(
              JSON.stringify(
                candidate.versions.find((v) => v.id === version.id),
              ) === JSON.stringify(version),
              "기존 버전을 수정할 수 없습니다. 새 버전으로 저장해 주세요.",
            );
        }
      }
      const saved = structuredClone(library);
      saved.revision = current.revision + 1;
      await atomicJson(path.join(this.directory, "library.json"), saved);
      return saved;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async recovery() {
    return readJson(path.join(this.directory, "recovery.json"), null);
  }
  recover(value) {
    const operation = this.queue.then(async () => {
      if (value !== null) {
        requireValue(
          object(value) &&
            text(value.stageId) &&
            (value.candidateId === null || text(value.candidateId)),
          "복구본 형식 오류",
        );
        checkDraft(value.draft);
        requireValue(value.stageId === value.draft.stage.id, "복구본 ID 오류");
      }
      await atomicJson(path.join(this.directory, "recovery.json"), value);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
