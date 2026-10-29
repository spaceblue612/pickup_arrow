export type EditorNoticeData = {
  kind: "error" | "warning" | "info";
  summary: string;
  detail: string;
};
export function editorNotice(input: {
  error?: string;
  warning?: string;
  message?: string;
}): EditorNoticeData;
