import { useEffect, useId, useRef, useState } from "react";
import type { EditorNoticeData } from "./editor-notice.mjs";

export function EditorNotice({
  notice,
  onDismiss,
}: {
  notice: EditorNoticeData;
  onDismiss: () => void;
}) {
  const [details, setDetails] = useState<EditorNoticeData | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const attention = notice.kind !== "info";
  useEffect(() => {
    if (details && !dialog.current?.open) dialog.current?.showModal();
    if (!details) dialog.current?.close();
  }, [details]);
  return (
    <>
      <div
        className={"notice status-notice" + (attention ? " error" : "")}
        role={attention ? "alert" : "status"}
        aria-atomic="true"
        data-testid="editor-status"
        data-kind={notice.kind}
      >
        {attention && (
          <span className="notice-icon" aria-hidden="true">
            ⚠
          </span>
        )}
        <span className="notice-text" title={notice.detail}>
          {notice.summary}
        </span>
        {attention && (
          <div className="notice-actions">
            <button
              type="button"
              data-testid="notice-details"
              onClick={() => setDetails({ ...notice })}
            >
              상세보기
            </button>
            <button
              type="button"
              data-testid="notice-dismiss"
              onClick={onDismiss}
            >
              닫기
            </button>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="notice-dialog"
        data-testid="notice-dialog"
        aria-labelledby={titleId}
        onCancel={() => setDetails(null)}
      >
        <div className="dialog-header">
          <h2 id={titleId}>
            {details?.kind === "error" ? "오류 상세" : "알림 상세"}
          </h2>
          <button
            className="circle"
            aria-label="알림 상세 닫기"
            onClick={() => setDetails(null)}
          >
            ×
          </button>
        </div>
        <div className="notice-detail-body">
          <pre>{details?.detail}</pre>
        </div>
        <div className="dialog-footer">
          <button
            className="pill bordered"
            data-testid="notice-detail-close"
            onClick={() => setDetails(null)}
          >
            닫기
          </button>
        </div>
      </dialog>
    </>
  );
}
