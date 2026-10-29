export function editorNotice({ error = "", warning = "", message = "" }) {
  const kind = error ? "error" : warning ? "warning" : "info";
  const detail =
    error || warning || message || "화살표를 선택하거나 드래그하여 편집하세요.";
  const compact = detail.replace(/\s+/gu, " ").trim();
  const characters = Array.from(compact);
  const summary =
    characters.length > 160 ? characters.slice(0, 159).join("") + "…" : compact;
  return { kind, summary, detail };
}
