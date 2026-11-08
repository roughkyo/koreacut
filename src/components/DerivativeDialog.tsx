import { localizeMessage } from "../i18n/messages";
import { useUITranslation } from "../i18n";
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { DerivativeProgress, DerivativeRequest } from '../core/types';
import { applyDerivative, derivativePlan } from '../core/derivativeEdits';
import { useEditorStore } from '../editor/store';

export default function DerivativeDialog({ mode, onClose }: { mode: 'reverse' | 'freeze'; onClose(): void }) {
  const ui = useUITranslation();
  const [captured] = useState(() => {
    const s = useEditorStore.getState();
    return { project: s.project, clipId: s.selectedIds[0], time: s.playhead };
  });
  const [audio, setAudio] = useState<'reverse' | 'mute'>('reverse');
  const [duration, setDuration] = useState('2');
  const [progress, setProgress] = useState<DerivativeProgress | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const running = useRef<string | null>(null), alive = useRef(true), cancelled = useRef(false);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = window.editorAPI?.onDerivativeProgress(e => { if (e.jobId === running.current) setProgress(e); });
    return () => { alive.current = false; unsubscribe?.(); if (running.current) void window.editorAPI?.cancelDerivative(running.current); };
  }, []);
  const request: DerivativeRequest = { mode, audio, duration: Number(duration), time: captured.time };
  let preflight = '';
  try { derivativePlan(captured.project, captured.clipId, request); } catch (e) { preflight = (e as Error).message; }
  const start = async () => {
    if (!window.editorAPI || running.current) return;
    const jobId = crypto.randomUUID(); running.current = jobId; cancelled.current = false; setBusy(true); setError('');
    try {
      const asset = await window.editorAPI.deriveMedia(jobId, captured.project, captured.clipId, request);
      if (!alive.current || cancelled.current) return;
      const store = useEditorStore.getState();
      if (store.project !== captured.project) throw new Error(ui("처리 중에 항목이 변경되었습니다. 새로운 편집 내용은 덮어쓰여지지 않습니다. 후처리를 위해 클립을 다시 선택하십시오.", "The project changed during processing. New edits were preserved. Select the clip again to retry."));
      const result = applyDerivative(store.project, captured.clipId, request, asset);
      store.commit(result.project); store.select([result.clipId]); store.seek(mode === 'freeze' ? captured.time : result.project.clips.find(c => c.id === result.clipId)!.start);
      onClose();
    } catch (e) { if (alive.current) setError(String(e).replace(/^Error: Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { running.current = null; if (alive.current) setBusy(false); }
  };
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label={mode === 'reverse' ? ui("비디오 반전", "Reverse video") : ui("정지 프레임 삽입", "Insert freeze frame")}>
    <header><h2>{mode === 'reverse' ? ui("비디오 반전", "Reverse video") : ui("정지 프레임 삽입", "Insert freeze frame")}</h2><button disabled={busy} aria-label={ui("미디어 처리 끄기", "Close media processing")} onClick={onClose}><X size={18}/></button></header>
    <div className="modal-body">
      <p>{captured.project.clips.find(c => c.id === captured.clipId)?.name}</p>
      {mode === 'reverse' ? <><p>{ui("타임라인 길이와 효과를 유지하면서 선택한 클립의 소스 선택을 반전합니다. 관련 오디오 동기화 처리. 현재 속도는 새 재질에 적용되며 속도는 계속 변경될 수 있습니다.", "Reverse the selected source range while preserving timeline duration and effects. Linked audio is processed together. Current speed is baked into the new asset and can be adjusted again.")}</p><label>{ui("사운드 역방향 재생", "Reverse audio")} <select aria-label={ui("사운드 역방향 재생", "Reverse audio")} disabled={busy} value={audio} onChange={e => setAudio(e.target.value as typeof audio)}><option value="reverse">{ui("원래 사운드 함께 역방향 재생", "Reverse original audio")}</option><option value="mute">{ui("원래 사운드 제거", "Remove original audio")}</option></select></label></>
        : <><p>{ui("재생 헤드에 무음 스틸 프레임을 삽입하면 이후 클립이 전체적으로 뒤로 이동됩니다. 현재 변형, 색상 교정 및 자르기가 유지됩니다. 다른 레이어와 페이드는 스틸 프레임에 적용되지 않습니다.", "Insert a silent freeze frame at the playhead and move later clips together. Current transforms, color adjustments and crop are preserved; other layers and fades are not baked into the frame.")}</p><label>{ui("동결 기간(초)", "Freeze duration (seconds)")} <input aria-label={ui("동결 기간(초)", "Freeze duration (seconds)")} type="number" min={1 / captured.project.fps} max="3600" step={1 / captured.project.fps} disabled={busy} value={duration} onChange={e => setDuration(e.target.value)}/></label></>}
      <p className="muted small">{ui("생성된 자료는 로컬 머신에 저장되며 원본 파일은 그대로 유지됩니다. 실행 취소는 다시 실행을 위해 생성된 파일을 유지합니다. 기계 간 사용을 위해 \"프로젝트 자료를 수집\"하십시오.", "Generated assets stay on this computer; originals are unchanged. Undo retains generated files for redo. Use Collect project assets before moving to another computer.")}</p>
      {progress && <div className="export-progress"><p>{localizeMessage(progress.message) }</p><progress max={1} value={progress.progress}/><p>{Math.round(progress.progress * 100)}%</p></div>}
      {(error || preflight) && <p role="alert" className="inline-warning">{localizeMessage(error || preflight) }</p>}
    </div><footer>{busy ? <button onClick={() => { cancelled.current = true; if (running.current) void window.editorAPI?.cancelDerivative(running.current); }}>{ui("처리 취소", "Cancel processing")}</button> : <><button onClick={onClose}>{ui("닫기", "Close")}</button><button className="primary" disabled={!!preflight || !window.editorAPI} onClick={() => void start()}>{mode === 'reverse' ? ui("역방향 재생 생성", "Generate reversed clip") : ui("프리즈 프레임 생성", "Generate freeze frame")}</button></>}</footer>
  </section></div>;
}
