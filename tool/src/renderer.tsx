import { nextRegionName, repairRegions } from "./region-names.mjs";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { summarizeCells, summarizePlacement } from "./board-metrics.mjs";
import { TEXT_SIZE } from "./text-size.mjs";
import { BoardEditor } from "./BoardEditor";
import { EditorNotice } from "./EditorNotice";
import { PlacementSettings, PlacementTable } from "./PlacementControls";
import type { PlacementInputs, LengthRules } from "./PlacementControls";
import { editorNotice } from "./editor-notice.mjs";
import { directionFromCells, translateCells } from "./arrow-geometry.mjs";
import type {
  Cell,
  BoardMode,
  BoardEdit,
  Direction,
  Stage,
  Draft,
  PlacementSettingsSnapshot,
  Library,
  Recovery,
  Settings,
  Analysis,
  Response,
  Result,
} from "./types";
import "./style.css";

const clone = <T,>(value: T): T => structuredClone(value);
const key = (c: Cell) => c.join(",");
const blank = (id: string, stage?: Stage): Draft => ({
  stage: stage
    ? { ...clone(stage), id }
    : { id, grid_size: [12, 9], arrows: [], blocked_cells: [] },
  regions: [],
  targets: {},
  roles: {},
});
const unwrap = <T,>(r: Result<T>): T => {
  if (!r.ok) throw Error(r.error);
  return r.value;
};
const uuid = () => crypto.randomUUID();
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
type Mode = BoardMode;

function App() {
  const [library, setLibrary] = useState<Library>({
    schema_version: 1,
    revision: 0,
    stages: [],
  });
  const libraryRef = useRef(library);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef(draft);
  const [candidateId, setCandidateId] = useState<string | null>(null),
    [dirty, setDirty] = useState(false),
    [ready, setReady] = useState(false);
  const [example, setExample] = useState<Stage | null>(null),
    [recovery, setRecovery] = useState<Recovery | null>(null);
  const [recoverySuspended, setRecoverySuspended] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    godot: "godot",
    project: "",
    timeoutMs: 30000,
    textSizeOffset: TEXT_SIZE.default - TEXT_SIZE.base,
  });
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [directory, setDirectory] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [dismissedWarning, setDismissedWarning] = useState("");
  const [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<Mode>("auto"),
    [workspaceMode, setWorkspaceMode] = useState<"arrows" | "regions">("arrows");
  const [selected, setSelected] = useState(""),
    [regionId, setRegionId] = useState(""),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null),
    [validation, setValidation] = useState<string[] | null>(null);
  const [playback, setPlayback] = useState<Stage | null>(null),
    [playFree, setPlayFree] = useState<string[]>([]),
    [step, setStep] = useState(0),
    [view, setView] = useState("work");
  const [links, setLinks] = useState(true);
  const [showArrowIds, setShowArrowIds] = useState(false);
  const [phaseView, setPhaseView] = useState("all");
  const [placementTableOpen, setPlacementTableOpen] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [candidatePreview, setCandidatePreview] = useState<{ id: string; name: string; draft: Draft } | null>(null);
  const [candidateHistoryOpen, setCandidateHistoryOpen] = useState(false);
  // Placement settings belong to each saved draft/version.
  const [placementInputs, setPlacementInputs] = useState<PlacementInputs>({});
  const [lengthRules, setLengthRules] = useState<LengthRules>({});
  const [automaticPlacement, setAutomaticPlacement] = useState(false);
  const [baseLength, setBaseLength] = useState({ min: "", max: "" });
  const history = useRef<Draft[]>([]),
    future = useRef<Draft[]>([]);
  const requestSerial = useRef(0),
    busyRef = useRef(false);
  busyRef.current = busy;
  const [historyTick, setHistoryTick] = useState(0),
    [modal, setModal] = useState<"targets" | "settings" | null>(null);
  const [pending, setPending] = useState<null | (() => void)>(null),
    [versionId, setVersionId] = useState("");
  const recoveryQueue = useRef(Promise.resolve());
  const modalRef = useRef<HTMLDialogElement>(null),
    pendingRef = useRef<HTMLDialogElement>(null),
    recoveryRef = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
  function resetAnalysis() {
    setAnalysis(null);
    setValidation(null);
    setPlayback(null);
    setStep(0);
  }
  function restorePlacementSettings(value: Draft) {
    const saved = value.placementSettings;
    setPlacementInputs(clone(saved?.inputs ?? {}));
    setLengthRules(clone(saved?.lengthRules ?? {}));
    setBaseLength(clone(saved?.baseLength ?? { min: "", max: "" }));
    setAutomaticPlacement(saved?.automaticPlacement ?? false);
  }
  function updatePlacementSettings(change: Partial<PlacementSettingsSnapshot>) {
    if (!draftRef.current || candidatePreview || busyRef.current) return;
    const next = clone(draftRef.current);
    next.placementSettings = clone({ inputs: placementInputs, lengthRules, baseLength, automaticPlacement, ...change });
    commit(next);
  }
  function loadDraft(next: Draft, candidate: string | null, isDirty = false) {
    setPhaseView("all");
    setCandidatePreview(null);
    setPlacementOpen(false);
    setPlacementTableOpen(false);
    setCandidateHistoryOpen(false);
    restorePlacementSettings(next);
    setDismissedWarning("");
    requestSerial.current++;
    if (busyRef.current) void window.arrowEditor.cancel();
    setMode("auto");
    setWorkspaceMode("arrows");
    draftRef.current = clone(next);
    setDraft(draftRef.current);
    setCandidateId(candidate);
    setDirty(isDirty);
    setSelected("");
    setRegionId("");
    setVersionId("");
    history.current = [];
    future.current = [];
    resetAnalysis();
    setHistoryTick((t) => t + 1);
  }
  function commit(next: Draft) {
    if (!draftRef.current) return;
    history.current.push(clone(draftRef.current));
    future.current = [];
    draftRef.current = next;
    setDraft(next);
    restorePlacementSettings(next);
    setDirty(true);
    resetAnalysis();
    setHistoryTick((t) => t + 1);
  }
  function undo(redo = false) {
    const from = redo ? future.current : history.current,
      to = redo ? history.current : future.current;
    if (!from.length || !draftRef.current) return;
    to.push(clone(draftRef.current));
    draftRef.current = from.pop()!;
    setDraft(draftRef.current);
    restorePlacementSettings(draftRef.current);
    setDirty(true);
    resetAnalysis();
    setHistoryTick((t) => t + 1);
  }
  async function persist(next: Library) {
    const saved = unwrap(
      await window.arrowEditor.save(next, libraryRef.current.revision),
    );
    libraryRef.current = saved;
    setLibrary(saved);
    return saved;
  }
  useEffect(() => {
    alive.current = true;
    if (!window.arrowEditor) {
      setError("이 화면은 Electron 앱에서 실행해 주세요: cd tool → npm start");
      return;
    }
    window.arrowEditor
      .bootstrap()
      .then(unwrap)
      .then((b) => {
        if (!alive.current) return;
        libraryRef.current = b.library;
        setLibrary(b.library);
        setSettings(b.settings);
        setDirectory(b.directory);
        setExample(b.example);
        setRecovery(b.recovery);
        const first = b.library.stages.find((s) => !s.archived);
        if (first) {
          const c = first.candidates[0];
          loadDraft(
            c?.versions.at(-1)?.draft ?? blank(first.id),
            c?.id ?? null,
          );
        }
        setReady(true);
      })
      .catch(fail);
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || recovery) return;
    const value =
      dirty && draft
        ? { stageId: draft.stage.id, candidateId, draft: clone(draft) }
        : null;
    // Serialize recovery writes; they never create candidates or versions.
    recoveryQueue.current = recoveryQueue.current
      .catch(() => {})
      .then(() => window.arrowEditor.recover(value))
      .then(unwrap)
      .catch(fail);
  }, [ready, draft, dirty, candidateId, recovery]);
  useEffect(() => {
    if (modal && !modalRef.current?.open) modalRef.current?.showModal();
    if (!modal) modalRef.current?.close();
  }, [modal]);
  useEffect(() => {
    const value =
      modal === "settings"
        ? settingsDraft.textSizeOffset
        : settings.textSizeOffset;
    document.documentElement.style.setProperty(
      "--text-size-offset",
      `${value}px`,
    );
  }, [settings.textSizeOffset, settingsDraft.textSizeOffset, modal]);
  useEffect(() => {
    if (pending && !pendingRef.current?.open) pendingRef.current?.showModal();
    if (!pending) pendingRef.current?.close();
  }, [pending]);
  useEffect(() => {
    if (recovery && !recoverySuspended && !recoveryRef.current?.open)
      recoveryRef.current?.showModal();
    if (!recovery || recoverySuspended) recoveryRef.current?.close();
  }, [recovery, recoverySuspended]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        document.querySelector("dialog[open]") ||
        document.querySelector('.interactive-board[data-editing="true"]') ||
        busyRef.current
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        undo(e.shiftKey);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const entry = library.stages.find((s) => s.id === draft?.stage.id),
    candidate = entry?.candidates.find((c) => c.id === candidateId);
  const board = candidatePreview?.draft.stage ?? playback ?? draft?.stage,
    free = playback ? playFree : (analysis?.available_arrow_ids ?? []),
    selectedArrow = draft?.stage.arrows.find((a) => a.id === selected);
  const controlDraft = candidatePreview?.draft ?? draft;
  const selectedRegion = controlDraft?.regions.find((r) => r.id === regionId);
  function changePlacementOpen(open: boolean) {
    setPlacementOpen(open);

  }
  const placementControls = {
    stats: controlDraft ? summarizePlacement(controlDraft.stage, selectedRegion?.cells, controlDraft.placementGroups) : undefined,
    regions: controlDraft?.regions ?? [],
    selectedId: selectedRegion?.id ?? "",
    inputs: candidatePreview ? candidatePreview.draft.placementSettings?.inputs ?? {} : placementInputs,
    lengthRules: candidatePreview ? candidatePreview.draft.placementSettings?.lengthRules ?? {} : lengthRules,
    setLengthRules: ((value) => updatePlacementSettings({ lengthRules: typeof value === "function" ? value(lengthRules) : value })) as React.Dispatch<React.SetStateAction<LengthRules>>,
    baseLength: candidatePreview ? candidatePreview.draft.placementSettings?.baseLength ?? { min: "", max: "" } : baseLength,
    setBaseLength: ((value) => updatePlacementSettings({ baseLength: typeof value === "function" ? value(baseLength) : value })) as React.Dispatch<React.SetStateAction<{ min: string; max: string }>>,
    automaticPlacement: candidatePreview ? candidatePreview.draft.placementSettings?.automaticPlacement ?? false : automaticPlacement,
    setAutomaticPlacement: (value: boolean) => updatePlacementSettings({ automaticPlacement: value }),
    busy: busy || !draft || Boolean(candidatePreview),
    onGenerate: () => void generatePlacement(),
    onSelect: setRegionId,
    onChange: (id: string, field: keyof PlacementInputs[string], value: number | undefined) =>
      updatePlacementSettings({ inputs: { ...placementInputs, [id]: { ...placementInputs[id], [field]: value } } }),
  };
  async function generatePlacement() {
    if (!draftRef.current || busyRef.current) return;
    const source = clone(draftRef.current);
    const id = selectedRegion?.id ?? "";
    const values = placementInputs[id] ?? {};
    const min = baseLength.min === "" ? 2 : Number(baseLength.min);
    const max = baseLength.max === "" ? 4 : Number(baseLength.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 2 || max < min || max > 10000) {
      setError("기초 길이 범위는 2 이상의 정수이며 최소가 최대보다 작거나 같아야 합니다.");
      return;
    }
    if ((lengthRules[id] ?? []).some(rule => !Number.isInteger(Number(rule.length)) || Number(rule.length) < 2 || !rule.amount || Number(rule.amount) < 0 || (rule.unit === "count" && !Number.isInteger(Number(rule.amount))) || (rule.unit === "percent" && Number(rule.amount) > 100))) {
      setError("길이 규칙의 길이와 수량을 확인해 주세요.");
      return;
    }
    const cells: Cell[] = selectedRegion ? clone(selectedRegion.cells) : Array.from({ length: source.stage.grid_size[0] * source.stage.grid_size[1] }, (_, i) => [i % source.stage.grid_size[0] + 1, Math.floor(i / source.stage.grid_size[0]) + 1]);
    const token = ++requestSerial.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = unwrap(await window.arrowEditor.core({ operation: "editor_placement", stage: source.stage, placement: { cells, stage1: values.stage1 ?? 30, fill: values.fill ?? 70, min_length: min, max_length: max, seed: Math.floor(Math.random() * 2147483647), settings: { ...values, scopes: id ? [] : source.regions.filter(region => Object.keys(placementInputs[region.id] ?? {}).length || (lengthRules[region.id] ?? []).length).map(region => ({ cells: region.cells, values: placementInputs[region.id] ?? {}, rules: (lengthRules[region.id] ?? []).map(rule => ({ length: Number(rule.length), amount: Number(rule.amount), unit: rule.unit })) })), rules: (lengthRules[id] ?? []).map(rule => ({ length: Number(rule.length), amount: Number(rule.amount), unit: rule.unit })) } } }));
      if (token !== requestSerial.current || !same(draftRef.current, source)) return;
      if (!response.validation.valid) throw Error(response.validation.errors.join(" / "));
      const result = response.placement;
      if (!result || result.error) throw Error(result?.error || "생성 결과가 없습니다.");
      const metrics = `1단계 ${result.primary_added}/${result.primary_target}칸 · 접점 ${result.primary.contact_count} · 굴곡 ${(result.primary.turn_ratio * 100).toFixed(1)}% · 막힌 화살 ${result.primary.blocked_count} · 다른 화살 막기 ${((result.primary.blocker_ratio ?? 0) * 100).toFixed(1)}%\n2단계 ${result.filler_added}/${result.filler_target}칸 · 최종 ${result.final.occupied_tiles}칸 · 접점 ${result.final.contact_count} · 막힌 화살 ${result.final.blocked_count}`;
      const deviations = result.deviations ?? [];
      if (automaticPlacement && (deviations.length > 0 || result.primary_added !== result.primary_target || result.filler_added !== result.filler_target)) {
        setError(`조건 미달로 적용하지 않았습니다. ${result.attempts ?? 1}회 재시도\n${metrics}\n${deviations.join("\n")}`);
        return;
      }
      if ((deviations.length > 0 || result.primary_added !== result.primary_target || result.filler_added !== result.filler_target) && !window.confirm(`요청한 칸 수와 실제 결과가 다릅니다.\n${metrics}\n${deviations.join("\n")}\n이 결과를 적용하시겠습니까? 취소하면 다시 생성할 수 있습니다.`)) {
        setMessage("생성 결과를 적용하지 않았습니다. 다시 생성해 주세요.");
        return;
      }
      const changed = clone(source);
      changed.stage = result.stage;
      changed.placementGroups = result.groups;
      setPhaseView("all");
      commit(changed);
      setMessage(`${metrics}\n${deviations.join("\n")}\n시도 ${result.attempts ?? 1}회 · 전체 보드 해결 가능 · 실행 취소 가능`);
    } catch (e) {
      if (token === requestSerial.current) fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const regionArrows =
    selectedRegion && board
      ? board.arrows.filter((a) =>
          selectedRegion.cells.some((c) => key(c) === key(a.head_cell)),
        )
      : [];
  const regionFree = regionArrows.filter((a) => free.includes(a.id)).length;
  const cellStats = board ? summarizeCells(board) : null;
  const legacyShortArrows =
    draft?.stage.arrows.filter((a) => a.cells.length < 2) ?? [];
  const legacyWarning = legacyShortArrows.length
    ? `기존 자료에 1칸 화살 ${legacyShortArrows.length}개가 있습니다 (${legacyShortArrows.map((a) => a.id).join(", ")}). 자동으로 바꾸지 않습니다. 삭제 후 2칸 이상으로 다시 그려야 제작 검증·내보내기를 통과합니다.`
    : "";
  const warningKey = `${draft?.stage.id}:${legacyWarning}`;
  const validationError = validation?.length
    ? `규칙 오류 ${validation.length}개\n${validation.join("\n")}`
    : "";
  const notice = editorNotice({
    error: error || validationError,
    warning: dismissedWarning !== warningKey ? legacyWarning : "",
    message,
  });
  function dismissNotice() {
    if (error) setError("");
    else if (validationError) {
      setValidation(null);
      setMessage("검증 오류 알림을 닫았습니다. 수정 후 다시 검증해 주세요.");
    } else setDismissedWarning(warningKey);
  }
  const chainDepth =
    analysis?.solution_status === "solved"
      ? Math.max(0, analysis.dependency_depth - 1)
      : null;
  function guarded(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  async function save(branch = false) {
    if (!draftRef.current || saving) return false;
    setSaving(true);
    setError("");
    const savedDraft = clone(draftRef.current),
      savedId = savedDraft.stage.id,
      oldCandidate = candidateId;
    try {
      const next = clone(libraryRef.current),
        stage = next.stages.find((s) => s.id === savedId);
      if (!stage) throw Error("스테이지가 없습니다.");
      let c = !branch
        ? stage.candidates.find((c) => c.id === oldCandidate)
        : undefined;
      if (!c) {
        c = {
          id: uuid(),
          name: "후보 " + (Math.max(0, ...stage.candidates.map(item => Number(/^후보 (\d+)$/.exec(item.name)?.[1] ?? 0))) + 1),
          versions: [],
        };
        stage.candidates.push(c);
      }
      c.versions.push({
        id: uuid(),
        at: new Date().toISOString(),
        draft: savedDraft,
      });
      await persist(next);
      if (draftRef.current?.stage.id === savedId) {
        setCandidateId(c.id);
        if (same(draftRef.current, savedDraft)) setDirty(false);
      }
      setMessage(c.name + " · v" + c.versions.length + " 저장 완료");
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function deleteCandidate(id: string | null) {
    if (!id || !draftRef.current || saving || busyRef.current) return;
    const stageId = draftRef.current.stage.id;
    const target = libraryRef.current.stages.find(stage => stage.id === stageId)?.candidates.find(item => item.id === id);
    if (!target || !window.confirm(`${target.name} 후보와 저장 이력 ${target.versions.length}개를 완전히 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    setSaving(true);
    try {
      const next = unwrap(await window.arrowEditor.deleteCandidate(stageId, id, libraryRef.current.revision));
      libraryRef.current = next;
      setLibrary(next);
      const stage = next.stages.find(item => item.id === stageId)!;
      setCandidatePreview(null);
      if (draftRef.current?.stage.id === stageId && candidateId === id && dirty) {
        setCandidateId(null);
      } else if (draftRef.current?.stage.id === stageId && candidateId === id) {
        const replacement = stage.candidates[0];
        loadDraft(replacement?.versions.at(-1)?.draft ?? blank(stageId), replacement?.id ?? null);
        setCandidateHistoryOpen(true);
      }
      setMessage(`${target.name} 후보와 저장 이력을 완전히 삭제했습니다.${dirty && candidateId === id ? " 미저장 작업은 현재 보드에 보존했습니다." : ""}`);
    } catch (e) { fail(e); }
    finally { setSaving(false); }
  }
  async function createStage(source?: Stage) {
    if (saving) return;
    setSaving(true);
    try {
      const next = clone(libraryRef.current),
        number =
          Math.max(0, ...next.stages.map((s) => Number(s.id.slice(6)))) + 1,
        id = "STAGE-" + String(number).padStart(3, "0");
      next.stages.push({ id, archived: false, candidates: [] });
      await persist(next);
      loadDraft(blank(id, source), null, Boolean(source));
      setMessage(
        source
          ? "현재 보드를 새 스테이지로 가져왔습니다. 후보 저장은 별도입니다."
          : "빈 스테이지를 만들었습니다.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  function switchStage(id: string) {
    if (id === draftRef.current?.stage.id) return;
    guarded(() => {
      const e = libraryRef.current.stages.find((s) => s.id === id);
      if (!e) return;
      const c = e.candidates[0];
      loadDraft(c?.versions.at(-1)?.draft ?? blank(id), c?.id ?? null);
    });
  }
  async function reorder(offset: number) {
    if (!entry || saving) return;
    setSaving(true);
    try {
      const next = clone(libraryRef.current),
        index = next.stages.findIndex((s) => s.id === entry.id),
        to = index + offset;
      if (to >= 0 && to < next.stages.length) {
        [next.stages[index], next.stages[to]] = [
          next.stages[to],
          next.stages[index],
        ];
        await persist(next);
      }
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    if (!entry || saving) return;
    setSaving(true);
    try {
      const next = clone(libraryRef.current),
        e = next.stages.find((s) => s.id === entry.id)!;
      e.archived = !e.archived;
      await persist(next);
      setMessage(
        e.archived
          ? "스테이지를 보관했습니다. 데이터와 이력은 유지됩니다."
          : "보관을 해제했습니다.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  async function analyze() {
    if (!draftRef.current || busy) return;
    const stage = clone(draftRef.current.stage);
    const token = ++requestSerial.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = unwrap(
        await window.arrowEditor.core({ operation: "analyze_stage", stage }),
      );
      if (token !== requestSerial.current) return;
      if (!same(draftRef.current?.stage, stage)) {
        setMessage("계산 중 보드가 바뀌어 결과를 적용하지 않았습니다.");
        return;
      }
      setValidation(response.validation.errors);
      setAnalysis(response.analysis ?? null);
      setPlayback(null);
      setStep(0);
      if (response.validation.valid)
        setMessage(
          response.analysis?.solution_status === "solved"
            ? "전체 제거 가능한 경로를 확인했습니다."
            : "진행할 수 없는 막힘 관계가 있습니다.",
        );
    } catch (e) {
      if (token === requestSerial.current) fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function nextStep() {
    if (!draft || !analysis || busy || step >= analysis.solution_order.length)
      return;
    const source = playback ?? draft.stage;
    const original = clone(draft.stage);
    const token = ++requestSerial.current;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = unwrap(
        await window.arrowEditor.core({
          operation: "apply_action",
          stage: source,
          arrow_id: analysis.solution_order[step],
        }),
      );
      if (
        !result.action ||
        !["extraction_completed", "stage_cleared"].includes(result.action.event)
      )
        throw Error("합법적인 제거를 수행하지 못했습니다.");
      const next = result.action.stage;
      if (token !== requestSerial.current) return;
      let available: string[] = [];
      if (next.arrows.length) {
        const result2 = unwrap(
          await window.arrowEditor.core({
            operation: "analyze_stage",
            stage: next,
          }),
        );
        available = result2.analysis?.available_arrow_ids ?? [];
      }
      if (token !== requestSerial.current) return;
      if (!same(draftRef.current?.stage, original)) {
        setMessage("계산 중 원본이 변경되어 재생 결과를 적용하지 않았습니다.");
        return;
      }
      setPlayback(next);
      setPlayFree(available);
      setStep((s) => s + 1);
    } catch (e) {
      if (token === requestSerial.current) fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function cancelCore() {
    requestSerial.current++;
    if (busyRef.current) void window.arrowEditor.cancel().catch(fail);
    setMessage("진행 중인 계산을 취소했습니다. 원본은 유지됩니다.");
  }
  async function applyBoardEdit(edit: BoardEdit): Promise<boolean> {
    if (
      !draftRef.current ||
      busyRef.current ||
      !same(draftRef.current.stage, edit.source)
    )
      return false;
    const source = clone(draftRef.current),
      token = ++requestSerial.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      let stage: Stage,
        id = edit.arrowId ?? "";
      let response: Response;
      const adding = edit.kind === "create" || edit.kind === "duplicate";
      if (adding) {
        let cells = edit.cells;
        if (edit.kind === "duplicate") {
          const original = source.stage.arrows.find(
            (a) => a.id === edit.arrowId,
          );
          if (
            !original ||
            !edit.offset ||
            (edit.offset[0] === 0 && edit.offset[1] === 0)
          )
            return false;
          cells = translateCells(original.cells, edit.offset);
        }
        if (!cells || cells.length < 2) return false;
        do {
          id = "ARROW-" + uuid().slice(0, 8);
        } while (source.stage.arrows.some((a) => a.id === id));
        stage = clone(source.stage);
        stage.arrows.push({
          id,
          cells: clone(cells),
          head_cell: clone(cells[0]),
          direction: directionFromCells(cells),
        });
        response = unwrap(
          await window.arrowEditor.core({ operation: "validate_stage", stage }),
        );
      } else {
        response = unwrap(
          await window.arrowEditor.core({
            operation:
              edit.kind === "translate" ? "translate_arrow" : "reshape_arrow",
            stage: source.stage,
            arrow_id: id,
            offset: edit.offset,
            cells: edit.cells,
          }),
        );
        stage = response.edit?.stage ?? source.stage;
      }
      if (token !== requestSerial.current || !same(draftRef.current, source))
        return false;
      if (!response.validation.valid || (!adding && !response.edit?.accepted)) {
        setError(
          "배치를 적용하지 않았습니다. 충돌·금지 칸·보드 경계·몸체 연결을 확인해 주세요. " +
            (response.edit?.errors ?? response.validation.errors).join(" / "),
        );
        return false;
      }
      const changed = clone(source);
      changed.stage = stage;
      commit(changed);
      setSelected(id);
      setMessage(
        edit.kind === "duplicate"
          ? "화살표를 복제했습니다. 실행 취소로 되돌릴 수 있습니다."
          : "배치를 적용했습니다. 실행 취소로 되돌릴 수 있습니다.",
      );
      return true;
    } catch (e) {
      if (token === requestSerial.current) fail(e);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function addRegion(cells: Cell[]) {
    if (!draftRef.current) return;
    const next = clone(draftRef.current);
    if (
      next.regions.some((r) =>
        r.cells.some((p) => cells.some((c) => key(p) === key(c))),
      )
    ) {
      setError("영역이 겹칩니다. 다른 범위를 선택해 주세요.");
      return;
    }
    const id = "R-" + uuid().slice(0, 6);
    next.regions.push({ id, name: nextRegionName(next.regions), cells });
    commit(next);
    setRegionId(id);
  }
  function editCell(cells: Cell[], mode: "mask" | "add-region" | "remove-region") {
    if (!draftRef.current) return;
    const next = clone(draftRef.current);
    if (mode === "mask") {
      const c = cells[0];
      const i = next.stage.blocked_cells.findIndex((p) => key(p) === key(c));
      if (i < 0) next.stage.blocked_cells.push(c);
      else next.stage.blocked_cells.splice(i, 1);
    } else {
      const region = next.regions.find((r) => r.id === regionId);
      if (!region) { setError("수정할 관리 영역을 먼저 선택해 주세요."); return; }
      if (mode === "add-region" && cells.some((c) => next.regions.some(
        (r) => r.id !== regionId && r.cells.some((p) => key(p) === key(c)),
      ))) { setError("관리 영역은 서로 겹칠 수 없습니다."); return; }
      const selected = new Set(cells.map(key));
      if (mode === "add-region") {
        const existing = new Set(region.cells.map(key));
        region.cells.push(...cells.filter((c) => !existing.has(key(c))));
      } else region.cells = region.cells.filter((c) => !selected.has(key(c)));
      if (JSON.stringify(region.cells) === JSON.stringify(draftRef.current.regions.find((r) => r.id === regionId)?.cells)) return;
    }
    const emptyIds = new Set(next.regions.filter(region => mode === "remove-region" && region.id === regionId && !region.cells.length).map(region => region.id));
    next.regions = next.regions.filter(region => !emptyIds.has(region.id));
    for (const role of Object.values(next.roles)) if (emptyIds.has(role.region)) role.region = "";
    commit(next);
    if (emptyIds.has(regionId)) setRegionId("");
  }
  function deleteArrow(id: string) {
    if (!draftRef.current) return;
    const next = clone(draftRef.current);
    next.stage.arrows = next.stage.arrows.filter((a) => a.id !== id);
    delete next.roles[id];
    commit(next);
    setSelected("");
  }
  function repairRegionList() {
    if (!draftRef.current || busyRef.current || playback || recovery) return;
    const next = clone(draftRef.current);
    next.regions = repairRegions(next.regions);
    const ids = new Set(next.regions.map(region => region.id));
    for (const role of Object.values(next.roles)) if (role.region && !ids.has(role.region)) role.region = "";
    if (same(next, draftRef.current)) return;
    commit(next);
    if (!ids.has(regionId)) setRegionId("");
    setMessage("빈 영역과 중복 이름을 정리했습니다. 실행 취소할 수 있습니다.");
  }
  function deleteRegion() {
    if (!draftRef.current || busyRef.current || playback || recovery) return;
    const region = draftRef.current.regions.find(item => item.id === regionId);
    if (!region) return;
    const next = clone(draftRef.current);
    next.regions = next.regions.filter(item => item.id !== region.id);
    for (const role of Object.values(next.roles)) {
      if (role.region === region.id) role.region = "";
    }
    commit(next);
    setRegionId("");
    setMessage(`${region.name} 영역을 삭제했습니다. 화살은 유지되며 실행 취소할 수 있습니다.`);
  }
  function clearArrows(inRegion: boolean) {
    if (!draftRef.current || busyRef.current || playback || recovery) return;
    const next = clone(draftRef.current);
    const region = next.regions.find(item => item.id === regionId);
    if (inRegion && !region) return;
    const cells = new Set(region?.cells.map(key));
    const removed = next.stage.arrows.filter(arrow => !inRegion || arrow.cells.every(cell => cells.has(key(cell))));
    if (!removed.length) {
      setMessage("삭제할 화살이 없습니다. 영역 삭제는 몸체 전체가 영역 안에 있는 화살만 지웁니다.");
      return;
    }
    const ids = new Set(removed.map(arrow => arrow.id));
    next.stage.arrows = next.stage.arrows.filter(arrow => !ids.has(arrow.id));
    for (const id of ids) {
      delete next.roles[id];
      if (next.placementGroups) delete next.placementGroups[id];
    }
    commit(next);
    setSelected("");
    setMessage(`${inRegion ? region!.name : "전체 보드"}의 화살 ${removed.length}개를 지웠습니다. 실행 취소로 되돌릴 수 있습니다.`);
  }
  function updateTarget(name: string, value: string) {
    if (!draft) return;
    const number = value === "" ? null : Number(value);
    if (
      number !== null &&
      (!Number.isFinite(number) || number < 0 || number > 10000)
    )
      return;
    const next = clone(draft);
    next.targets[name] = number;
    commit(next);
  }
  return (
    <>
      <header className="topbar" inert={Boolean(recovery)}>
        <div className="brand">
          <span className="brand-mark">↗</span>
          <span>
            arrow<span className="brand-light"> / studio</span>
          </span>
        </div>
        <nav className="view-tabs">
          <button
            className={"pill " + (view === "work" ? "selected" : "")}
            onClick={() => setView("work")}
          >
            맵 작업
          </button>
          <button
            className={"pill " + (view === "analysis" ? "selected" : "")}
            onClick={() => { setView("analysis"); setPlacementOpen(false); }}
          >
            흐름 분석
          </button>
        </nav>
        <div className="topbar-right">
          <span className="eyebrow">EDITOR / FIRST WORKING BUILD</span>
          <button
            className="circle"
            onClick={() => {
              setSettingsDraft(clone(settings));
              setError("");
              setModal("settings");
            }}
            aria-label="에디터 환경설정"
          >
            ⚙
          </button>
        </div>
      </header>
      {recovery && recoverySuspended && (
        <div className="recovery-gate" role="alert">
          복구본을 보존한 채 대기 중입니다. 편집 전 복구 여부를 선택해 주세요.
          <button
            className="pill bordered"
            onClick={() => setRecoverySuspended(false)}
          >
            복구 창 열기
          </button>
        </div>
      )}
      <div className="app-shell" inert={Boolean(recovery)}>
        <aside className="stage-sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">LIBRARY</span>
              <h2>스테이지</h2>
            </div>
            <button
              className="circle"
              disabled={!ready || saving}
              onClick={() => guarded(() => void createStage())}
              aria-label="스테이지 추가"
            >
              +
            </button>
          </div>
          <label className="search">
            <input
              placeholder="스테이지 ID 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="list-caption">
            <span>순번 / 고유 ID</span>
            <button onClick={() => setArchived(!archived)}>
              {archived ? "작업 목록" : "보관함"}
            </button>
          </div>
          <ol className="stage-list">
            {library.stages.map(
              (s, index) =>
                s.archived === archived &&
                s.id.includes(query.toUpperCase()) && (
                  <li key={s.id}>
                    <button
                      className={
                        "stage-row " + (entry?.id === s.id ? "current" : "")
                      }
                      onClick={() => switchStage(s.id)}
                      disabled={saving}
                    >
                      <span className="stage-number">
                        {String(index + 1).padStart(3, "0")}
                      </span>
                      <span className="stage-info">
                        <strong>{s.id}</strong>
                        <small>
                          {s.archived
                            ? "보관됨"
                            : s.candidates.length + "개 후보"}
                        </small>
                      </span>
                    </button>
                  </li>
                ),
            )}
          </ol>
          <div className="stage-management">
            <button
              className="pill bordered full"
              disabled={!draft || saving}
              onClick={() =>
                guarded(() => void createStage(draftRef.current?.stage))
              }
            >
              선택 보드로 새 스테이지
            </button>
            <div className="reorder">
              <button
                className="pill soft"
                disabled={!entry || saving}
                onClick={() => void reorder(-1)}
              >
                ↑ 위로
              </button>
              <button
                className="pill soft"
                disabled={!entry || saving}
                onClick={() => void reorder(1)}
              >
                ↓ 아래로
              </button>
            </div>
            <button
              className="pill full"
              disabled={!entry || saving}
              onClick={() => guarded(() => void archive())}
            >
              {entry?.archived ? "보관 해제" : "보관하기"}
            </button>
          </div>
          <div className="sidebar-foot">
            원본 게임은 변경하지 않습니다.
            <br />
            저장 위치: {directory}
          </div>
        </aside>
        <main
          data-core-busy={busy}
          data-analysis={analysis?.solution_status ?? "none"}
          data-playback-step={step}
          data-dirty={dirty}
          data-selected-arrow={selected}
          data-mode={mode}
        >
          <div className="page-heading">
            <div>
              <div className="breadcrumb">
                제작 도구 / {candidate?.name ?? "저장 전 작업"}{" "}
                {dirty ? "· 미저장 변경" : ""}
              </div>
              <div className="title-line">
                <h1>{draft?.stage.id ?? "새로운 연결을 만드세요."}</h1>
                <span className="status-chip">초기 구현</span>
              </div>
            </div>
            <div className="page-actions">
              <button
                className="pill bordered"
                disabled={!draft || saving || Boolean(candidatePreview)}
                onClick={() => void save(true)}
              >
                새 후보로 저장
              </button>
              <button
                className="pill primary"
                data-testid="save"
                disabled={!draft || saving || Boolean(candidatePreview)}
                onClick={() => void save()}
              >
                {saving ? "저장 중…" : "저장 ↗"}
              </button>
            </div>
          </div>
          <EditorNotice notice={notice} onDismiss={dismissNotice} />
          {recovery && (
            <div className="notice">
              미저장 복구본: {recovery.stageId}
              <button
                className="pill bordered"
                onClick={() => {
                  const r = recovery;
                  if (library.stages.some((s) => s.id === r.stageId)) {
                    loadDraft(r.draft, r.candidateId, true);
                    setRecovery(null);
                  } else
                    setError(
                      "복구본의 스테이지가 현재 라이브러리에 없습니다. 원본 복구 파일은 보존합니다.",
                    );
                }}
              >
                복구하기
              </button>
              <button className="pill" onClick={() => setRecovery(null)}>
                복구본 버리기
              </button>
            </div>
          )}
          <div className="quick-actions">
            <button
              data-testid="sample"
              className="pill bordered"
              disabled={!ready || !example || saving}
              onClick={() => guarded(() => void createStage(example!))}
            >
              검증 예제로 시작
            </button>
            <button
              className="pill bordered"
              disabled={!ready || saving}
              onClick={() =>
                guarded(() => {
                  void window.arrowEditor
                    .importStage()
                    .then(unwrap)
                    .then((s) => {
                      if (s) void createStage(s);
                    })
                    .catch(fail);
                })
              }
            >
              보드 JSON 가져오기
            </button>
            <button
              className="pill bordered"
              disabled={!draft || busy}
              onClick={() => {
                if (draft)
                  void window.arrowEditor
                    .exportStage(draft.stage)
                    .then(unwrap)
                    .then((file) => {
                      if (file)
                        setMessage(
                          "검증된 보드 내보내기: " +
                            file +
                            " (게임 자동 반영 아님)",
                        );
                    })
                    .catch(fail);
              }}
            >
              검증 후 JSON 내보내기
            </button>
          </div>
          {!draft ? (
            <section className="empty-state">
              <h2>빈 보드 또는 예제에서 시작하세요.</h2>
              <p>
                화살표를 그려 보고, 후보로 저장한 뒤 실제 게임 코어로 확인할 수
                있습니다.
              </p>
              <button
                className="pill primary"
                disabled={!ready || saving}
                onClick={() => void createStage()}
              >
                빈 스테이지 추가
              </button>
            </section>
          ) : (
            <div className="workspace-grid" data-placement-open={placementOpen}>
              <div className="workspace-left">
                <section className="board-card">
                  <div className="board-heading">
                    <div>
                      <span className="eyebrow">
                        CANVAS / {board?.grid_size.join(" × ")}
                      </span>
                      <h2>
                        {view === "analysis" ? "실제 제거 흐름" : "작업 보드"}
                      </h2>
                    </div>
                    <button
                      className="pill bordered"
                      data-testid="analyze"
                      disabled={busy || Boolean(candidatePreview) || !draft.stage.arrows.length}
                      onClick={() => void analyze()}
                    >
                      {busy ? "계산 중…" : "Godot 검증·분석"}
                    </button>
                  </div>
                  <div className="toolbar" inert={Boolean(candidatePreview)}>
                    <div className="tool-group" aria-label="작업 모드">
                      {([ ["arrows", "화살 배치"], ["regions", "영역 관리"] ] as const).map(([value, label]) => (
                        <button key={value} className={"pill compact " + (!placementOpen && workspaceMode === value ? "selected" : "")}
                          disabled={busy || Boolean(playback)} aria-pressed={!placementOpen && workspaceMode === value}
                          onClick={() => { setPlacementOpen(false); setWorkspaceMode(value); setMode(value === "arrows" ? "auto" : "region"); setMessage(value === "arrows" ? "화살을 편집하세요." : "기존 영역을 클릭하여 선택하거나 빈 곳에서 드래그하여 새 영역을 만드세요."); }}>
                          {label}
                        </button>
                      ))}
                      <button
                        className={"pill compact " + (placementOpen ? "selected" : "")}
                        aria-pressed={placementOpen}
                        aria-controls="placement-settings"
                        disabled={busy || Boolean(playback)}
                        data-testid="placement-open"
                        onClick={() => changePlacementOpen(!placementOpen)}
                      >자동 배치</button>
                    </div>
                    <div className="tool-group">
                      {placementOpen ? <span className="placement-toolbar-note">영역을 클릭해 조절 대상을 선택하세요.</span> : (workspaceMode === "arrows"
                        ? ([ ["auto", "기본 조작"], ["mask", "금지 칸"] ] as const)
                        : ([ ["region", "영역 선택·생성"], ["add-region", "영역 +"], ["remove-region", "영역 −"] ] as const)
                      ).map(([m, label]) => (
                        <button key={m} className={"pill compact " + (mode === m ? "selected" : "")}
                          disabled={busy || Boolean(playback)} onClick={() => { setPlacementOpen(false); setMode(m); }}>{label}</button>
                      ))}
                      {!placementOpen && workspaceMode === "regions" && (draft.regions.some(region => !region.cells.length) || new Set(draft.regions.map(region => region.name)).size < draft.regions.length) && <button className="pill compact" data-testid="repair-regions" disabled={busy || Boolean(playback)} onClick={repairRegionList}>빈 영역·중복 이름 정리</button>}
                      {!placementOpen && workspaceMode === "regions" && <button className="pill compact" data-testid="delete-region" title="선택한 영역 자체만 삭제하고 화살은 유지합니다." disabled={busy || Boolean(playback) || Boolean(recovery) || !selectedRegion} onClick={deleteRegion}>영역 자체 삭제</button>}
                    </div>
                  </div>
                  <div className="editor-tools" inert={Boolean(candidatePreview)}>
                    <button data-testid="clear-board-arrows" disabled={busy || Boolean(playback) || Boolean(recovery) || !draft.stage.arrows.length} onClick={() => clearArrows(false)}>전체 화살 지우기</button>
                    <button data-testid="clear-region-arrows" title="몸체 전체가 선택 영역 안에 있는 화살만 삭제합니다." disabled={busy || Boolean(playback) || Boolean(recovery) || !selectedRegion || !draft.stage.arrows.length} onClick={() => clearArrows(true)}>선택 영역 화살 지우기</button>
                    <button
                      disabled={!history.current.length || busy}
                      onClick={() => undo()}
                    >
                      ↶ 실행 취소
                    </button>
                    <button
                      disabled={!future.current.length || busy}
                      onClick={() => undo(true)}
                    >
                      ↷ 다시 실행
                    </button>
                    <button onClick={() => setLinks(!links)}>
                      {links ? "연결 숨기기" : "연결 보기"}
                    </button>
                    <label><input type="checkbox" aria-label="화살 ID 표시" checked={showArrowIds} onChange={event => setShowArrowIds(event.target.checked)} />화살 ID 표시</label>
                    <span>
                      {historyTick >= 0 && dirty
                        ? "미저장 변경"
                        : "저장된 상태"}
                    </span>
                  </div>
                  {view === "analysis" && (
                    <div className="playback-controls">
                      <button
                        className="pill bordered"
                        disabled={
                          !analysis ||
                          busy ||
                          step >= analysis.solution_order.length
                        }
                        onClick={() => void nextStep()}
                      >
                        다음 화살 제거
                      </button>
                      <button
                        className="pill"
                        onClick={() => {
                          setPlayback(null);
                          setStep(0);
                        }}
                      >
                        원본으로
                      </button>
                      <span>{step}개 제거 / 편집본은 보존됩니다.</span>
                      <button
                        className="pill"
                        disabled={!busy}
                        onClick={() => void window.arrowEditor.cancel()}
                      >
                        계산 취소
                      </button>
                    </div>
                  )}
                  {draft.placementGroups && <div className="board-status" data-testid="placement-phase-controls" aria-label="생성 단계 구분">
                    <div role="group" aria-label="생성 단계 보기">
                      {(["all", "primary", "filler", "existing"] as const).map((phase, index) => <button key={phase} className={"pill compact " + (phaseView === phase ? "selected" : "")} aria-pressed={phaseView === phase} onClick={() => { setPhaseView(phase); setSelected(""); }}>{["전체", "1단계만", "2단계만", "기존 화살만"][index]}</button>)}
                    </div>
                    {(["existing", "primary", "filler"] as const).map((phase, index) => <span key={phase} style={{ color: ["#ffffff", "#ffc466", "#54d7ef"][index] }}>{["기존", "1단계", "2단계"][index]} {board?.arrows.filter(arrow => (draft.placementGroups?.[arrow.id] ?? "existing") === phase).length}개</span>)}
                    <span>전체 보기에서는 단계별 색상으로 구분합니다.</span>
                  </div>}
                  {candidatePreview && <div className="board-status" data-testid="candidate-preview">{candidatePreview.name} · 미리보기</div>}
                  <div className="canvas-wrap">
                    <BoardEditor
                      key={draft.stage.id}
                      stage={board!}
                      placementGroups={candidatePreview ? candidatePreview.draft.placementGroups : draft.placementGroups}
                      phaseView={phaseView}
                      phaseColors={true}
                      regions={candidatePreview?.draft.regions ?? draft.regions}
                      regionId={regionId}
                      selected={selected}
                      mode={mode}
                      analysis={candidatePreview ? null : analysis}
                      free={candidatePreview ? [] : free}
                      links={!candidatePreview && links && (!draft.placementGroups || phaseView === "all")}
                      showArrowIds={showArrowIds}
                      busy={busy}
                      editable={!candidatePreview && !playback && !recovery && !placementOpen && (!draft.placementGroups || phaseView === "all")}
                      regionPickOnly={!candidatePreview && placementOpen}
                      onSelect={setSelected}
                      onMode={(next) => setMode(workspaceMode === "regions" && next === "auto" ? "region" : next)}
                      onEdit={applyBoardEdit}
                      onRegion={addRegion}
                      onSelectRegion={setRegionId}
                      onMoveRegion={(cells) => {
                        if (!draftRef.current) return;
                        const next = clone(draftRef.current);
                        const region = next.regions.find((r) => r.id === regionId);
                        if (!region) return;
                        region.cells = cells;
                        commit(next);
                      }}
                      onCell={editCell}
                      onDelete={deleteArrow}
                      onCancel={cancelCore}
                      onMessage={setMessage}
                    />
                  </div>
                  <div className="board-status">
                    <span>
                      전체 <strong>{board?.arrows.length}</strong>
                    </span>
                    <span>
                      제거 가능{" "}
                      <strong>{analysis ? free.length : "미분석"}</strong>
                    </span>
                    <span>
                      막힘{" "}
                      <strong>
                        {analysis
                          ? board!.arrows.length - free.length
                          : "미분석"}
                      </strong>
                    </span>
                    <span>{playback ? "재생 상태" : "편집 원본"}</span>
                  </div>
                </section>
                {validation && validation.length === 0 && (
                  <section
                    className="validation-panel"
                    data-testid={analysis ? "analysis-ready" : undefined}
                  >
                    <h3>
                      {analysis?.solution_status === "solved"
                        ? "전체 제거 경로 확인"
                        : "해결 불가능한 막힘"}
                    </h3>
                    {analysis && (
                      <p>
                        선택 순서 한 경로의 결과입니다. 반복 압박·커버리지
                        목표의 달성 여부는 아직 판정하지 않습니다.
                      </p>
                    )}
                  </section>
                )}

              </div>
              <aside className="workspace-right" inert={Boolean(candidatePreview)}>
                {placementOpen ? (
                  <PlacementSettings {...placementControls} onClose={() => changePlacementOpen(false)} />
                ) : (
                <>
                <section
                  className="stage-inspector"
                  data-testid="stage-inspector"
                >
                  <div className="section-heading">
                    <h2>현재 스테이지</h2>
                    <span className="muted">
                      {playback ? "재생 중" : "편집 원본"}
                    </span>
                  </div>
                  <div className="stage-identity">
                    <strong>{draft.stage.id}</strong>
                    <span>
                      {candidate?.name ?? "저장 전"}
                      {dirty ? " · 미저장" : ""}
                    </span>
                  </div>
                  <dl className="stage-stats">
                    <div>
                      <dt>화살표</dt>
                      <dd data-testid="arrow-count">
                        {board?.arrows.length}
                        <small>개</small>
                      </dd>
                    </div>
                    <div title="금지 칸을 제외한 보드에서 화살표가 차지한 고유 칸의 비율입니다. 규칙 검증 결과와는 별개입니다.">
                      <dt>배치 점유율</dt>
                      <dd data-testid="cell-coverage">
                        {cellStats?.coverage}
                        <small>%</small>
                      </dd>
                    </div>
                    <div>
                      <dt>관리 영역</dt>
                      <dd>
                        {draft.regions.length}
                        <small>개</small>
                      </dd>
                    </div>
                    <div>
                      <dt>빈 배치 칸</dt>
                      <dd>
                        {cellStats?.empty}
                        <small>/ {cellStats?.usable}</small>
                      </dd>
                    </div>
                  </dl>
                  <p className="count-note">
                    점유 {cellStats?.occupied}칸 · 금지 {cellStats?.blocked}칸
                    {playback ? ` · 원본 ${draft.stage.arrows.length}개` : ""}
                  </p>
                  <div className="coordinate-row grid-size">
                    {draft.stage.grid_size.map((n, i) => (
                      <label key={i}>
                        {i ? "높이" : "너비"}
                        <input
                          type="number"
                          aria-label={i ? "보드 높이" : "보드 너비"}
                          value={n}
                          min="1"
                          max="999"
                          disabled={busy || Boolean(playback)}
                          title="크기를 바꾸면 재검증이 필요합니다. 기존 배치는 자동 보정하지 않습니다."
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (
                              !Number.isInteger(v) ||
                              v < 1 ||
                              v > 999 ||
                              v * draft.stage.grid_size[1 - i] > 10000
                            )
                              return;
                            const next = clone(draft);
                            next.stage.grid_size[i] = v;
                            commit(next);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <section
                    className="intent-overview"
                    data-testid="intent-summary"
                  >
                    <div className="section-heading">
                      <h3>
                        맵 조건 <span className="eyebrow">INTENT</span>
                      </h3>
                      <button
                        className="text-button"
                        data-testid="intent-detail"
                        onClick={() => setModal("targets")}
                      >
                        상세·영역 선택 ↗
                      </button>
                    </div>
                    <dl className="intent-summary">
                      <div title="전체 보드에서 지금 즉시 제거 가능한 화살표 수">
                        <dt>풀이 가능 수</dt>
                        <dd>
                          {analysis
                            ? `${free.length} / ${board?.arrows.length}개`
                            : "미분석"}
                        </dd>
                      </div>
                      <div title="편집 원본의 최장 선행 연결입니다. 반복 압박의 빈도는 아직 계산하지 않습니다.">
                        <dt>
                          연쇄 연결 <small>원본</small>
                        </dt>
                        <dd>
                          {chainDepth === null ? "미분석" : `${chainDepth}회`}
                        </dd>
                      </div>
                      <div title="선택한 관리 영역에 머리가 있는 화살표 중 현재 제거 가능한 수입니다. 관문 제거 전후 효과와는 다릅니다.">
                        <dt>
                          영역 개방{" "}
                          <small>{selectedRegion?.name ?? "미선택"}</small>
                        </dt>
                        <dd>
                          {selectedRegion
                            ? analysis
                              ? `${regionFree} / ${regionArrows.length}개`
                              : "미분석"
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </section>
                <section className="arrow-inspector">
                  <h2 className="inspector-title">선택 항목</h2>
                  {selectedArrow ? (
                    <>
                      <h2>{selectedArrow.id}</h2>
                      <p className="count-note">
                        몸체 포함 {selectedArrow.cells.length}칸 · 머리{" "}
                        {selectedArrow.head_cell.join(", ")}
                      </p>
                      <p data-testid="arrow-direction">
                        머리 방향:{" "}
                        {selectedArrow.cells.length < 2
                          ? "결정 불가 · 2칸 이상 필요"
                          : {
                              UP: "위",
                              DOWN: "아래",
                              LEFT: "왼쪽",
                              RIGHT: "오른쪽",
                            }[directionFromCells(selectedArrow.cells)]}{" "}
                        · 첫 두 칸으로 자동 결정
                      </p>
                      <button
                        className="pill bordered full"
                        disabled={busy || Boolean(playback)}
                        onClick={() => {
                          setMode("auto");
                          setMessage(
                            "직선 몸통 드래그는 전체 이동, 머리·꼬리는 연장·축소, 코너는 간격 조절입니다. 어느 부분에서든 전체 이동하려면 우클릭 → 전체 이동을 사용하세요. Esc 취소",
                          );
                        }}
                      >
                        전체 이동 안내
                      </button>
                      <label>
                        제작 역할 (효과 검증 별도)
                        <select
                          value={draft.roles[selected]?.type ?? ""}
                          onChange={(e) => {
                            const next = clone(draft);
                            next.roles[selected] = {
                              type: e.target.value,
                              region: next.roles[selected]?.region ?? "",
                            };
                            commit(next);
                          }}
                        >
                          {["", "영역 관문", "연쇄 연결", "선택지 억제"].map(
                            (v) => (
                              <option key={v} value={v}>
                                {v || "미지정"}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        영향 영역
                        <select
                          value={draft.roles[selected]?.region ?? ""}
                          onChange={(e) => {
                            const next = clone(draft);
                            next.roles[selected] = {
                              type: next.roles[selected]?.type ?? "",
                              region: e.target.value,
                            };
                            commit(next);
                          }}
                        >
                          <option value="">미지정</option>
                          {draft.regions.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="pill bordered full"
                        onClick={() => {
                          const next = clone(draft);
                          next.stage.arrows = next.stage.arrows.filter(
                            (a) => a.id !== selected,
                          );
                          commit(next);
                          setSelected("");
                        }}
                      >
                        화살표 삭제 (실행 취소 가능)
                      </button>
                    </>
                  ) : (
                    <p>
                      보드에서 화살표를 선택하세요. 직선 몸통은 전체 이동,
                      코너는 간격 조절, 머리·꼬리는 연장·축소입니다.
                    </p>
                  )}
                  {selectedRegion && (
                    <label>
                      선택 영역 이름
                      <input
                        value={selectedRegion.name}
                        onChange={(e) => {
                          const next = clone(draft);
                          next.regions.find((r) => r.id === regionId)!.name =
                            e.target.value;
                          commit(next);
                        }}
                      />
                    </label>
                  )}
                  <p>
                    수정 후 재검증하세요. 기존 배치는 자동 보정하지 않습니다.
                  </p>
                </section>
                </>
                )}
              </aside>
              <div className="workspace-docks">
                <details
                  className="candidates"
                  data-testid="candidate-history"
                  open={candidateHistoryOpen}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    setCandidateHistoryOpen(open);
                    if (!open) setCandidatePreview(null);
                    if (open) setPlacementTableOpen(false);
                  }}
                >
                  <summary>
                    후보와 저장 이력
                    <span>
                      {entry?.candidates.length ?? 0}개 후보 · 현재{" "}
                      {candidate?.versions.length ?? 0}개 버전
                    </span>
                  </summary>
                  <div className="candidate-content">
                    <div className="candidate-grid">
                      {entry?.candidates.map((c) => (
                        <button
                          className={
                            "candidate-card " +
                            ((candidatePreview?.id ?? candidateId) === c.id ? "active" : "")
                          }
                          key={c.id}
                          onClick={() => { setPhaseView("all"); setSelected(""); setCandidatePreview({ id: c.id, name: c.name, draft: clone(c.versions.at(-1)!.draft) }); }}
                          onDoubleClick={() => guarded(() => loadDraft(c.versions.at(-1)!.draft, c.id))}
                        >
                          <strong>{c.name}</strong>
                          <span>
                            v{c.versions.length} · {c.versions.length}개 저장
                            이력
                          </span>
                        </button>
                      ))}
                    </div>
                    {entry && entry.candidates.length > 0 && <div className="version-tools">
                      <button className="pill primary" disabled={!candidatePreview || busy || saving} onClick={() => { if (candidatePreview) guarded(() => loadDraft(candidatePreview.draft, candidatePreview.id)); }}>후보 선택</button>
                      <button className="pill bordered" disabled={busy || saving} onClick={() => void deleteCandidate(candidatePreview?.id ?? candidateId)}>후보 완전 삭제</button>
                      {candidatePreview && <button className="pill" onClick={() => setCandidatePreview(null)}>미리보기 종료</button>}
                    </div>}
                    {!entry?.candidates.length && (
                      <p>‘저장’하면 첫 후보가 만들어집니다.</p>
                    )}
                    {candidate && !candidatePreview && (
                      <div className="version-tools">
                        <select
                          aria-label="저장 버전"
                          value={versionId}
                          onChange={(e) => setVersionId(e.target.value)}
                        >
                          <option value="">복원할 버전 선택</option>
                          {candidate.versions.map((v, i) => (
                            <option value={v.id} key={v.id}>
                              v{i + 1} · {new Date(v.at).toLocaleString()}
                            </option>
                          ))}
                        </select>
                        <button
                          className="pill bordered"
                          disabled={!versionId}
                          onClick={() => {
                            const v = candidate.versions.find(
                              (v) => v.id === versionId,
                            );
                            if (v)
                              guarded(() => {
                                commit(clone(v.draft));
                                setMessage(
                                  "과거 상태를 불러왔습니다. 저장하면 새 버전으로 남습니다.",
                                );
                              });
                          }}
                        >
                          이 버전으로 작업 재개
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              <PlacementTable {...placementControls} open={placementTableOpen} onOpenChange={(open) => { setPlacementTableOpen(open); if (open) setCandidateHistoryOpen(false); }} />
              </div>
            </div>
          )}
          <footer className="preview-footer">
            초기 실제 구현 · 기존 게임/스테이지 자동 변경 없음 · 부분 생성/반복
            제약/게임 반영은 후속 개발
          </footer>
        </main>
      </div>
      <dialog ref={recoveryRef} onCancel={() => setRecoverySuspended(true)}>
        <div className="dialog-header">
          <h2>이전 미저장 작업이 있습니다.</h2>
        </div>
        <div className="padded">
          <p>
            {recovery?.stageId}의 복구본을 먼저 처리해 주세요. 선택 전에는 기존
            복구본을 덮지 않습니다.
          </p>
        </div>
        <div className="dialog-footer">
          <button
            className="pill primary"
            onClick={() => {
              if (!recovery) return;
              if (!library.stages.some((s) => s.id === recovery.stageId)) {
                setError("복구할 스테이지가 없습니다. 원본 파일을 보존합니다.");
                return;
              }
              loadDraft(recovery.draft, recovery.candidateId, true);
              setRecovery(null);
            }}
          >
            복구하고 계속
          </button>
          <button className="pill bordered" onClick={() => setRecovery(null)}>
            복구본을 버리고 계속
          </button>
        </div>
      </dialog>
      <dialog
        ref={modalRef}
        className={modal === "targets" ? "intent-dialog" : ""}
        data-testid="editor-dialog"
        onCancel={() => setModal(null)}
      >
        <div className="dialog-header">
          <h2>{modal === "targets" ? "맵 조건 상세" : "에디터 환경설정"}</h2>
          <button
            className="circle"
            aria-label="상세 창 닫기"
            onClick={() => setModal(null)}
          >
            ×
          </button>
        </div>
        <div className="dialog-form padded">
          {modal === "targets" && draft ? (
            <>
              <div className="detail-metrics">
                <section>
                  <h3>풀이 가능 수</h3>
                  <strong>
                    {analysis
                      ? `${free.length} / ${board?.arrows.length}개`
                      : "미분석"}
                  </strong>
                  <p>
                    현재 보드에서 즉시 제거 가능. 막힘{" "}
                    {analysis
                      ? `${board!.arrows.length - free.length}개`
                      : "미분석"}
                    .
                  </p>
                </section>
                <section>
                  <h3>연쇄 연결</h3>
                  <strong>
                    {chainDepth === null ? "미분석" : `${chainDepth}회`}
                  </strong>
                  <p>
                    편집 원본의 최장 선행 연결입니다. 압박이 다시 발생하는
                    빈도는 아직 판정하지 않습니다.
                  </p>
                </section>
                <section>
                  <h3>영역 개방</h3>
                  <strong>
                    {selectedRegion && analysis
                      ? `${regionFree} / ${regionArrows.length}개`
                      : selectedRegion
                        ? "미분석"
                        : "영역 미선택"}
                  </strong>
                  <p>
                    선택 영역에 머리가 있는 화살표 중 현재 제거 가능. 관문
                    전후의 새 개방량과는 다릅니다.
                  </p>
                </section>
              </div>
              <section className="region-detail">
                <h3>영역별 조회</h3>
                <label>
                  분석 영역 선택
                  <select
                    aria-label="분석 영역 선택"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                  >
                    <option value="">전체 보드 · 영역 미선택</option>
                    {draft.regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  {selectedRegion
                    ? `${selectedRegion.cells.length}칸 · 소속 화살표 ${regionArrows.length}개 · 제거 가능 ${analysis ? regionFree + "개" : "미분석"}`
                    : draft.regions.length
                      ? "영역을 선택하면 요약 수치와 보드 강조가 함께 바뀝니다."
                      : "아직 관리 영역이 없습니다. 보드의 ‘영역’ 도구로 추가할 수 있습니다."}
                </p>
                <button
                  className="pill bordered"
                  disabled={!selectedRegion}
                  onClick={() => {
                    setModal(null);
                    setWorkspaceMode("regions");
                    setMode("region");
                  }}
                >
                  이 영역을 보드에서 보기
                </button>
              </section>
              <fieldset className="target-fields">
                <legend>목표 설정</legend>
                <p>
                  목표는 후보에 저장되는 설정입니다. 현재 측정값이나 달성 판정이
                  아닙니다.
                </p>
                <div className="target-grid">
                  {Object.entries({
                    availableMin: "풀이 가능 수 · 최소",
                    availableMax: "풀이 가능 수 · 최대",
                    chainMin: "최장 선행 연결 · 최소 횟수",
                    openMin: "관문 후 새 개방 · 최소 개수",
                  }).map(([k, label]) => (
                    <label key={k}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        value={draft.targets[k] ?? ""}
                        placeholder="미설정"
                        onChange={(e) => updateTarget(k, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="form-note">
                자동 생성 제약·빈도·커버리지·관문 전후 효과는 아직 연결되지
                않았습니다. 위 값은 통합 난이도 점수가 아닙니다.
              </p>
            </>
          ) : (
            <>
              <section className="appearance-settings">
                <h3>화면과 글자</h3>
                <div className="text-size-setting">
                  <span id="text-size-label">기준 글자 크기</span>
                  <div
                    className="text-size-controls"
                    role="group"
                    aria-labelledby="text-size-label"
                  >
                    <button
                      className="pill bordered"
                      aria-label="글자 1px 줄이기"
                      disabled={
                        preferencesSaving ||
                        settingsDraft.textSizeOffset <=
                          TEXT_SIZE.min - TEXT_SIZE.base
                      }
                      onClick={() =>
                        setSettingsDraft((s) => ({
                          ...s,
                          textSizeOffset: Math.max(
                            TEXT_SIZE.min - TEXT_SIZE.base,
                            s.textSizeOffset - 1,
                          ),
                        }))
                      }
                    >
                      −1px
                    </button>
                    <output aria-live="polite" aria-label="현재 글자 크기">
                      {TEXT_SIZE.base + settingsDraft.textSizeOffset}px
                      {TEXT_SIZE.base + settingsDraft.textSizeOffset ===
                      TEXT_SIZE.default
                        ? " · 기본"
                        : ""}
                    </output>
                    <button
                      className="pill bordered"
                      aria-label="글자 1px 키우기"
                      disabled={
                        preferencesSaving ||
                        settingsDraft.textSizeOffset >=
                          TEXT_SIZE.max - TEXT_SIZE.base
                      }
                      onClick={() =>
                        setSettingsDraft((s) => ({
                          ...s,
                          textSizeOffset: Math.min(
                            TEXT_SIZE.max - TEXT_SIZE.base,
                            s.textSizeOffset + 1,
                          ),
                        }))
                      }
                    >
                      +1px
                    </button>
                    <button
                      className="pill bordered"
                      disabled={
                        preferencesSaving ||
                        TEXT_SIZE.base + settingsDraft.textSizeOffset ===
                          TEXT_SIZE.default
                      }
                      onClick={() =>
                        setSettingsDraft((s) => ({
                          ...s,
                          textSizeOffset: TEXT_SIZE.default - TEXT_SIZE.base,
                        }))
                      }
                    >
                      기본값
                    </button>
                  </div>
                  <p>
                    최소 {TEXT_SIZE.min}px · 기본 {TEXT_SIZE.default}px · 최대{" "}
                    {TEXT_SIZE.max}px
                  </p>
                </div>
                <p>
                  선택 즉시 미리 봅니다. 저장하면 재실행 후에도 유지되고, 저장
                  없이 닫으면 이전 설정으로 돌아갑니다. 보드 좌표와 화면
                  확대율은 바꾸지 않습니다.
                </p>
              </section>
              <details className="core-settings">
                <summary>Godot 연결 설정</summary>
                <p>경로는 이 컴퓨터의 로컬 설정으로만 저장합니다.</p>
                <label>
                  Godot 실행 파일
                  <input
                    value={settingsDraft.godot}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        godot: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Godot 프로젝트 절대 경로
                  <input
                    value={settingsDraft.project}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        project: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  계산 제한 시간 (밀리초)
                  <input
                    type="number"
                    value={settingsDraft.timeoutMs}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        timeoutMs: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </details>
              {error && (
                <p className="settings-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="pill primary"
                disabled={preferencesSaving}
                onClick={async () => {
                  setPreferencesSaving(true);
                  try {
                    const s = unwrap(
                      await window.arrowEditor.settings(settingsDraft),
                    );
                    setSettings(s);
                    setSettingsDraft(s);
                    setModal(null);
                    setMessage("에디터 환경설정을 저장했습니다.");
                  } catch (e) {
                    fail(e);
                  } finally {
                    setPreferencesSaving(false);
                  }
                }}
              >
                {preferencesSaving ? "설정 저장 중…" : "환경설정 저장"}
              </button>
            </>
          )}
        </div>
        <div className="dialog-footer">
          <p>
            {modal === "targets"
              ? "초안의 변경입니다. 후보에 보존하려면 작업 화면에서 저장하세요."
              : ""}
          </p>
          <button className="pill bordered" onClick={() => setModal(null)}>
            작업으로 돌아가기
          </button>
        </div>
      </dialog>
      <dialog ref={pendingRef} onCancel={() => setPending(null)}>
        <div className="dialog-header">
          <h2>미저장 변경이 있습니다.</h2>
        </div>
        <div className="dialog-footer">
          <button
            className="pill primary"
            disabled={saving}
            onClick={() => {
              const action = pending;
              void save().then((ok) => {
                if (ok) {
                  setPending(null);
                  action?.();
                }
              });
            }}
          >
            저장 후 계속
          </button>
          <button
            className="pill bordered"
            disabled={saving}
            onClick={() => {
              const action = pending;
              setPending(null);
              const current = draftRef.current;
              if (current) {
                const stage = libraryRef.current.stages.find(
                  (s) => s.id === current.stage.id,
                );
                const saved = stage?.candidates
                  .find((c) => c.id === candidateId)
                  ?.versions.at(-1)?.draft;
                loadDraft(saved ?? blank(current.stage.id), candidateId);
              }
              action?.();
            }}
          >
            변경 버리고 계속
          </button>
          <button className="pill" onClick={() => setPending(null)}>
            취소
          </button>
        </div>
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
