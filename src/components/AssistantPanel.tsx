import { localizeMessage } from "../i18n/messages";
import { useUITranslation } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, RefreshCw, Send, Square, X } from "lucide-react";
import { useEditorStore } from "../editor/store";
import { assistantProjectContext, previewAssistantEdits, type AssistantEditPreview } from "../core/assistantEdits";
import type { AssistantMessage, AssistantProvider, AssistantProviderInfo } from "../core/assistantTypes";
import type { Project } from "../core/types";
import "./AssistantPanel.css";

type Proposal = { preview: AssistantEditPreview; base: string; applied: boolean };
export default function AssistantPanel({ onClose }: { onClose(): void }) {
  const ui = useUITranslation();
  const project = useEditorStore(s => s.project);
  const [provider, setProvider] = useState<AssistantProvider>("codex");
  const [providers, setProviders] = useState<AssistantProviderInfo[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState(""), [error, setError] = useState("");
  const [stream, setStream] = useState(""), [proposal, setProposal] = useState<Proposal | null>(null);
  const active = useRef<{ id: string; project: Project; base: string; history: AssistantMessage[] } | null>(null);
  const generation = useRef(0), lastPrompt = useRef("");
  const history = useRef<AssistantMessage[]>([]), chatEnd = useRef<HTMLDivElement>(null);
  const refresh = async () => {
    try { setProviders(await window.editorAPI!.getAssistantProviders()); }
    catch (e) { setError(String(e)); }
  };
  useEffect(() => { if (window.editorAPI) void refresh(); }, []);
  useEffect(() => {
    const current = ++generation.current;
    const old = active.current; active.current = null;
    if (old) void window.editorAPI?.cancelAssistant(old.id).catch(() => {});
    history.current = []; setMessages([]); setProposal(null); setBusy(false); setStream(""); setError(""); setStatus(""); setLoaded(false);
    void window.editorAPI?.getAssistantHistory(project.id).then(items => {
      if (generation.current === current) { history.current = items; setMessages(items); setLoaded(true); }
    }).catch(e => { if (generation.current === current) { setError(String(e)); setLoaded(true); } });
    return () => { ++generation.current; const request = active.current; active.current = null; if (request) void window.editorAPI?.cancelAssistant(request.id).catch(() => {}); };
  }, [project.id]);
  const persist = (items: AssistantMessage[], projectId: string) => {
    const limited = items.slice(-40).map(m => ({ ...m, content: m.content.slice(0, 6000) }));
    history.current = limited; setMessages(limited);
    void window.editorAPI?.saveAssistantHistory(projectId, limited).catch(e => setError(ui(`대화 저장 실패:${String(e)}`, `Could not save conversation: ${String(e)}`)));
  };
  useEffect(() => window.editorAPI?.onAssistantEvent(event => {
    const request = active.current;
    if (!request || event.requestId !== request.id) return;
    if (event.type === "status") setStatus(event.message);
    if (event.type === "text") setStream(text => text + event.text);
    if (event.type === "complete") {
      persist([...request.history, { role: "assistant", content: event.response.reply }], request.project.id);
      if (event.response.actions.length) {
        try { setProposal({ preview: previewAssistantEdits(request.project, event.response.actions), base: request.base, applied: false }); }
        catch (e) { setError(ui(`제안 확인 실패, 프로젝트가 수정되지 않음:${String(e)}`, `Suggestion validation failed; project unchanged: ${String(e)}`)); }
      }
      active.current = null; setBusy(false); setStream(""); setStatus(ui("답변 완료", "Response complete"));
    }
    if (event.type === "error" || event.type === "cancelled") {
      active.current = null; setBusy(false); setStream(""); setStatus(event.type === "cancelled" ? ui("취소됨", "Cancelled") : "");
      if (event.type === "error") setError(event.message);
    }
  }), []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest" }); }, [messages, stream, status]);
  const send = async (value = prompt) => {
    if (!value.trim() || active.current || !window.editorAPI) return;
    const s = useEditorStore.getState();
    const base = JSON.stringify(s.project), captured: Project = JSON.parse(base);
    const items: AssistantMessage[] = [...history.current, { role: "user", content: value.trim() }];
    const request = { id: crypto.randomUUID(), project: captured, base, history: items };
    active.current = request; lastPrompt.current = value; setBusy(true); setError(""); setProposal(null); setStream(""); setStatus(ui("CLI 연결 중...", "Connecting to CLI…")); setPrompt("");
    const previous = history.current.slice(-20).map(m => ({ ...m, content: m.content.slice(0, 4000) }));
    persist(items, captured.id);
    try { await window.editorAPI.startAssistant({ requestId: request.id, provider, prompt: value.trim(), history: previous, context: assistantProjectContext(captured, s.selectedIds, s.playhead) }); }
    catch (e) { if (active.current?.id === request.id) { active.current = null; setBusy(false); setError(String(e)); setStatus(""); } }
  };
  const currentProvider = providers.find(p => p.id === provider);
  const stale = proposal && JSON.stringify(project) !== proposal.base;
  return <aside className="assistant-panel panel" aria-label={ui("Edit Assistant", "Editing assistant")}>
    <header><strong><MessageSquare size={16} /> {ui("Edit Assistant", "Editing assistant")} </strong><button aria-label={ui("Edit Assistant 닫기", "Close editing assistant")} onClick={onClose}><X size={16} /></button></header>
    <div className="assistant-config">
      <select aria-label={ui("Assistant 백엔드", "Assistant backend")} value={provider} disabled={busy} onChange={e => setProvider(e.target.value as AssistantProvider)}><option value="codex">Codex CLI</option><option value="claude">Claude Code</option></select>
      <button aria-label={ui("Refresh Assistant 상태", "Refresh assistant status")} disabled={busy} onClick={() => void refresh()}><RefreshCw size={14} /></button>
      <button disabled={busy || !window.editorAPI} onClick={() => void window.editorAPI!.chooseAssistantCLI(provider).then(setProviders).catch(e => setError(String(e)))}> {ui("CLI 선택", "Choose CLI")} </button>
    </div>
    <p className="assistant-provider-status">{currentProvider?.available ? ui(`감지됨 ${currentProvider.label} ${currentProvider.version ?? ""}`, `Detected ${currentProvider.label} ${currentProvider.version ?? ""}`) : (currentProvider?.error ? localizeMessage(currentProvider.error) : undefined) ?? ui("네이티브 CLI 감지 중…", "Checking local CLI…")}</p>
    <div className="assistant-chat" aria-live="polite">
      {!messages.length && <div className="assistant-welcome"><MessageSquare size={28} /><h3> {ui("편집 아이디어 말하기", "Describe your edit")} </h3><p> {ui("현재 타임라인을 기준으로 변경 사항을 제안하고 확인 후 적용할 수 있습니다. 텍스트, 자르기, 분할, 속도 변경, 볼륨 및 그림 조정을 지원합니다.", "Get suggestions for the current timeline and review before applying. Supports text, trimming, splitting, speed, volume and picture adjustments.")} </p><button onClick={() => setPrompt(ui("재생 헤드에 3초 동안 지속되는 제목 추가: 스토리는 여기에서 시작됩니다.", "Add a 3-second title at the playhead: The story starts here"))}> {ui("오프닝 제목 추가", "Add an opening title")} </button><button onClick={() => setPrompt(ui("현재 타임라인을 분석하고 3가지 편집 제안을 제공합니다. 아직 수정하지 마세요.", "Analyze the timeline and suggest 3 improvements without making changes"))}> {ui("개선할 수 있는 방법을 확인하세요.", "Suggest improvements")} </button></div>}
      {messages.map((message, i) => <div key={i} className={`assistant-message ${message.role}`}><small>{message.role === "user" ? ui("당신", "You") : ui("어시스턴트", "Assistant")}</small><p>{message.content}</p></div>)}
      {stream && <div className="assistant-message assistant"><small> {ui("어시스턴트", "Assistant")} </small><p>{stream}</p></div>}
      {status && <p className="assistant-status">{localizeMessage(status)}</p>}
      {error && <p className="assistant-error" role="alert">{localizeMessage(error)}</p>}
      {proposal && <div className="assistant-proposal"><strong> {ui("확인할 변경 사항 ·", "Changes to review ·")} {proposal.preview.descriptions.length}  {ui("항목", "changes")} </strong><ol>{proposal.preview.descriptions.map((item, i) => <li key={i}>{localizeMessage(item)}</li>)}</ol><p>{proposal.preview.before.clips} → {proposal.preview.after.clips}  {ui("클립 ·", "clips ·")} {proposal.preview.after.duration.toFixed(2)}  {ui("초", "s")} </p><button className="primary" disabled={proposal.applied || !!stale} onClick={() => {
        if (JSON.stringify(useEditorStore.getState().project) !== proposal.base) { setError(ui("항목이 변경되었습니다. 다시 생성하십시오. 제안", "The project changed. Generate suggestions again.")); return; }
        useEditorStore.getState().commit(proposal.preview.project); setProposal({ ...proposal, applied: true });
      }}>{proposal.applied ? ui("적용됨 · 실행 취소 가능", "Applied · Can be undone") : stale ? ui("항목이 변경되었습니다. 다시 생성하십시오.", "Project changed. Generate again.") : ui(`적용 ${proposal.preview.descriptions.length} 항목이 수정되었습니다.`, `Apply ${proposal.preview.descriptions.length} changes`)}</button></div>}
      <div ref={chatEnd} />
    </div>
    <div className="assistant-compose"><p> {ui("보내면 질문, 대화 및 타임라인 요약이 선택한 CLI 서비스로 전달됩니다. 미디어 파일은 전송되지 않습니다. 먼저 터미널에서 CLI에 로그인하세요.", "Sending shares your prompt, conversation and timeline summary with the selected CLI service, but not media files. Sign in to the CLI in your terminal first.")} </p><textarea aria-label={ui("보조 메시지", "Assistant message")} placeholder={ui("예: 선택한 클립의 볼륨을 절반으로 줄이기", "For example: halve the volume of the selected clip")} maxLength={8000} value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!busy && loaded && currentProvider?.available) void send(); } }} /><div><button disabled={busy || !messages.length} onClick={() => { persist([], project.id); setProposal(null); setError(""); }}> {ui("대화 지우기", "Clear conversation")} </button>{!busy && lastPrompt.current && <button onClick={() => void send(lastPrompt.current)} disabled={!currentProvider?.available}> {ui("다시 시도", "Retry")} </button>}{busy ? <button onClick={() => { const req = active.current; if (req) void window.editorAPI?.cancelAssistant(req.id).catch(e => setError(String(e))); }}><Square size={13} /> {ui("취소", "Cancel")} </button> : <button className="primary" disabled={!loaded || !prompt.trim() || !currentProvider?.available} onClick={() => void send()}><Send size={13} /> {ui("보내기", "Send")} </button>}</div></div>
  </aside>;
}
