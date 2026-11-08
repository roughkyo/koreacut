import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { version as appVersion } from '../../package.json';
import type { UpdateCheckResult } from '../core/updateTypes';
import { useUITranslation } from '../i18n';
import './UpdateDialog.css';

/** Opened only by an explicit Settings / native menu action. Release notes are text, never HTML. */
export default function UpdateDialog({ onClose, autoCheck = false }: { onClose(): void; autoCheck?: boolean }) {
  const ui = useUITranslation();
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const running = useRef(false), openingRef = useRef(false), alive = useRef(true);
  const dialog = useRef<HTMLElement>(null);
  const available = typeof window.editorAPI?.checkForUpdates === 'function';
  const check = async () => {
    if (!available || running.current) return;
    running.current = true; setBusy(true); setOpenFailed(false);
    try {
      const next = await window.editorAPI!.checkForUpdates();
      if (alive.current) setResult(next);
    } catch {
      if (alive.current) setResult({ currentVersion: appVersion, channel: 'preview', status: 'error', error: 'server' });
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    if (autoCheck) void check();
    return () => { alive.current = false; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
    // autoCheck is an opening gesture, not a polling dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = async (target: 'release' | 'download') => {
    if (openingRef.current || busy) return;
    openingRef.current = true; setOpening(true); setOpenFailed(false);
    try {
      const opened = await window.editorAPI?.openUpdateTarget(target);
      if (alive.current) setOpenFailed(!opened);
    } catch { if (alive.current) setOpenFailed(true); }
    finally { openingRef.current = false; if (alive.current) setOpening(false); }
  };
  const errors: Record<string, string> = {
    offline: ui("GitHub에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도해 주세요.", 'Could not reach GitHub. Check your connection and try again.'),
    timeout: ui("업데이트 시간 초과를 확인하세요. 나중에 다시 시도해 주세요.", 'The update check timed out. Try again later.'),
    'rate-limit': ui("GitHub에서는 일시적으로 요청을 제한하고 있습니다. 나중에 다시 시도해 주세요.", 'GitHub has temporarily limited requests. Please try again later.'),
    'invalid-response': ui("GitHub에서 반환된 업데이트 정보를 확인할 수 없습니다. 열린 다운로드가 없습니다.", 'The release information could not be verified. No download was opened.'),
    'invalid-version': ui("현재 버전을 인식할 수 없어 업데이트 확인이 중지되었습니다.", 'The current version is not recognized. The update check was stopped.'),
    server: ui("업데이트 확인을 완료할 수 없습니다. 나중에 다시 시도해 주세요.", 'Could not complete the update check. Please try again later.'),
  };
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="modal update-dialog" role="dialog" aria-modal="true" aria-label={ui("업데이트 확인", 'Check for Updates')} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header><h2>{ui("업데이트 확인", 'Check for Updates')}</h2><button aria-label={ui("업데이트 창 닫기", 'Close update dialog')} onClick={onClose}><X size={18}/></button></header>
      <div className="modal-body">
        <p><strong>{ui("현재 버전:", 'Current version: ')}{result?.currentVersion ?? appVersion}</strong></p>
        <p>{ui("업데이트 채널: 미리 보기", 'Update channel: Preview')}</p>
        <p className="muted small">{ui("GitHub의 시험판 버전이 포함되어 있습니다. 다운그레이드 없이 현재 버전보다 최신 버전만 제공됩니다.", 'Includes prereleases on GitHub. Only newer versions are offered; never a downgrade.')}</p>
        <div role="status" aria-live="polite">
          {busy ? <p>{ui("GitHub 확인 중...", 'Checking GitHub…')}</p> : result?.status === 'available' ? <p className="update-success">{ui("사용 가능한 새 버전:", 'New version available: ')}{result.release?.version}</p> : result?.status === 'up-to-date' ? <p>{ui("현재 미리 보기 채널에는 이 버전보다 최신 버전이 없습니다.", 'No newer version was found in the Preview channel.')}</p> : null}
        </div>
        {!available && <p role="alert" className="inline-warning">{ui("ReaCut 데스크톱 앱에서 업데이트를 확인하세요. 브라우저 미리보기에서는 이 기능을 지원하지 않습니다.", 'Check for updates in the ReaCut desktop app. This feature is unavailable in the browser preview.')}</p>}
        {!busy && result?.status === 'error' && <p role="alert" className="inline-warning">{errors[result.error ?? 'server'] ?? errors.server}</p>}
        {!busy && result?.status === 'available' && !result.release?.hasDownload && <p className="inline-warning">{ui("이 버전에는 기본 시스템 및 아키텍처에 대한 DMG가 없습니다. 릴리스 페이지를 볼 수 있습니다. 일치하지 않는 설치 패키지를 설치하지 마십시오.", 'No compatible DMG is available for this system and architecture. You can view the release page; do not install an incompatible package.')}</p>}
        {!busy && result?.release && <div className="update-notes"><h3>{ui("릴리스 노트(원본)", 'Release notes (original text)')}</h3><pre>{result.release.notes || ui("이 버전에는 릴리스 노트가 제공되지 않습니다.", 'No release notes were provided.')}</pre></div>}
        {openFailed && <p role="alert" className="inline-warning">{ui("확인된 게시 링크를 열 수 없습니다. 업데이트를 다시 확인하고 다시 시도해 주세요.", 'Could not open the verified release link. Check for updates and try again.')}</p>}
        <p className="muted small">{ui("업데이트 확인을 클릭할 때만 GitHub를 요청합니다. GitHub는 정상적인 네트워크 요청(IP 주소 포함)을 받습니다. 업로드된 프로젝트, 미디어 또는 토큰이 없으며 백그라운드 폴링 또는 원격 측정이 없습니다. 짧은 시간 내에 검사를 반복하면 30초 이내에 결과를 재사용할 수 있습니다.", 'GitHub is contacted only when you request a check and receives an ordinary network request, including your IP address. No projects, media or tokens are uploaded; there is no background polling or telemetry. Repeated checks reuse results for 30 seconds.')}</p>
        <p className="muted small">{ui("링크가 브라우저에서 열립니다. 이 미리보기는 임시로 서명되었으며 Apple에서 공증을 받지 않았습니다. 다운로드 후 애플리케이션을 수동으로 교체하기 전에 프로젝트를 저장하고 ReaCut을 종료하세요. 자동으로 설치되지 않습니다.", 'Links open in your browser. This preview is ad-hoc signed and not Apple-notarized. After downloading, save your project and quit ReaCut before manually replacing the app. Nothing is installed automatically.')}</p>
      </div>
      <footer>
        <button onClick={onClose}>{ui("닫기", 'Close')}</button>
        <button disabled={!available || busy || opening} onClick={() => void check()}>{busy ? ui("확인 중...", 'Checking…') : ui("재확인", 'Check again')}</button>
        {!busy && result?.release && result.status !== 'error' && <button disabled={opening} onClick={() => void open('release')}>{ui("GitHub 릴리스 페이지", 'GitHub release page')}</button>}
        {!busy && result?.status === 'available' && result.release?.hasDownload && <button className="primary" disabled={opening} onClick={() => void open('download')}>{ui("일치하는 DMG 다운로드", 'Download compatible DMG')}</button>}
      </footer>
    </section>
  </div>;
}
