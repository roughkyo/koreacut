import { localizeMessage } from "../i18n/messages";
import { useUITranslation } from "../i18n";
import { useEffect, useRef, useState } from "react";
import type { ExportProgress, Project } from "../core/types";
import { FolderOpen, Package, X } from "lucide-react";
export default function PackageDialog({ project, onClose }: { project: Project; onClose(): void }) {
  const ui = useUITranslation();
  const [progress, setProgress] = useState<ExportProgress | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const job = useRef<string | null>(null);
  const alive = useRef(true), requested = useRef(false);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = window.editorAPI?.onPackageProgress(event => {
    if (!requested.current) return;
    if (job.current && job.current !== event.jobId) return;
    setProgress(event);
    if (["complete", "error", "cancelled"].includes(event.status)) { requested.current = false; setBusy(false); if (event.status === "error") setError(event.message ?? ui("패키징 실패", "Packaging failed")); }
    });
    return () => { alive.current = false; unsubscribe?.(); if (requested.current && job.current) void window.editorAPI?.cancelPackage(job.current); };
  }, []);
  const start = async () => {
    if (!window.editorAPI) { setError(ui("프로젝트 영상을 수집하려면 데스크탑 버전이 필요합니다.", "Collecting project assets requires the desktop app")); return; }
    if (requested.current) return;
    requested.current = true;
    setBusy(true); setError(""); setProgress(null); job.current = null;
    try {
      const result = await window.editorAPI.packageProject(project);
      if (!alive.current) { if (result) void window.editorAPI.cancelPackage(result.jobId); return; }
      if (result) { job.current = result.jobId; setProgress(current => current ?? { jobId: result.jobId, status: "preparing", progress: 0, message: ui("영상 확인 중", "Checking assets") }); }
      else { requested.current = false; setBusy(false); }
    }
    catch (e) { requested.current = false; if (alive.current) { setBusy(false); setError(String(e)); } }
  };
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={ui("프로젝트 영상 수집 중", "Collect project assets")}><header><h2><Package size={18} /> {ui("프로젝트 영상 수집 중", "Collect project assets")}</h2><button aria-label={ui("영상 패키징 닫기", "Close asset packaging")} disabled={busy} onClick={onClose}><X size={18} /></button></header><div className="modal-body"><h3>{project.name}</h3><p>{ui(`프로젝트 및 ${project.assets.length} 원본 영상 항목을 새 폴더에 복사하고 전체 폴더를 이동한 후에도 여전히 편집을 위해 열려 있습니다.`, `Copy the project and ${project.assets.length} original assets to a new folder. Move the whole folder to continue editing elsewhere.`)}</p><p className="muted small">{ui("미디어 라이브러리의 모든 자료가 포함되어 있으며, 공유 파일은 1개만 포함됩니다. 원래 프로젝트와 자산은 그대로 유지됩니다. 미리보기 캐시가 압축되지 않았습니다. 사용자 정의 시스템 글꼴을 대상 컴퓨터에 설치해야 합니다.", "Includes all library assets, copying shared files only once. The original project and assets stay in place; preview caches are excluded. Install custom system fonts on the destination computer.")}</p>{progress && <div className="export-progress"><p>{progress.status === "complete" ? ui("자료 패키지가 완성되었습니다", "Asset package complete") : progress.status === "cancelled" ? ui("압축해제", "Packaging cancelled") : localizeMessage(progress.message ?? "")}</p><progress max={1} value={progress.progress} /><p>{Math.round(progress.progress * 100)}%</p></div>}{error && <p role="alert" className="inline-warning">{localizeMessage(error) }</p>}</div><footer>{busy ? <button disabled={!job.current} onClick={() => { if (job.current) void window.editorAPI?.cancelPackage(job.current); }}>{ui("압축해제", "Cancel packaging")}</button> : progress?.status === "complete" ? <><button onClick={() => void window.editorAPI?.revealPath(progress.path!)}><FolderOpen size={15}/>{ui("자료 패키지 표시", "Show asset package")}</button><button className="primary" onClick={onClose}>{ui("완료", "Done")}</button></> : <><button onClick={onClose}>{ui("취소", "Cancel")}</button><button className="primary" onClick={() => void start()}>{ui("폴더 및 패키지 선택", "Choose folder and collect")}</button></>}</footer></section></div>;
}
