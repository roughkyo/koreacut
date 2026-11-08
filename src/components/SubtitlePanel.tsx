import { localizeMessage } from "../i18n/messages";
import { useUITranslation } from "../i18n";
import {
  SubtitleAnimationForm,
  SubtitleStyleForm,
} from "./SubtitleBatchOptions";
import type {
  SubtitleAnimation,
  SubtitleStyleValues,
} from "../core/subtitleWorkflow";
import { DEFAULT_TEXT } from "../core/defaults";
import { useTranslation } from "../i18n/useTranslation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FolderOpen,
  LockKeyhole,
  Search,
  Subtitles,
} from "lucide-react";
import { useEditorStore } from "../editor/store";
import { clone } from "../core/model";
import {
  applySubtitleEdit,
  prepareSubtitleEdit,
  type SubtitleEdit,
  type SubtitleEditPlan,
} from "../core/subtitleEdits";
import type { Clip, Project } from "../core/types";
import "./SubtitlePanel.css";

interface Props {
  onSpeech: (mode: "asr" | "tts") => void;
  onImport: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
}
interface CueDraft {
  project: Project;
  id: string;
  text: string;
  start: string;
  end: string;
}
const seconds = (value: number) => Number(value.toFixed(6)).toString();
const timeLabel = (value: number) =>
  `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toFixed(2).padStart(5, "0")}`;

export default function SubtitlePanel({ onImport, onExport, onSpeech }: Props) {
  const ui = useUITranslation();
  const { t } = useTranslation();
  const project = useEditorStore((s) => s.project);
  const [trackId, setTrackId] = useState("");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [draft, setDraft] = useState<CueDraft | null>(null);
  const [mode, setMode] = useState<
    "offset" | "replace" | "style" | "styleValues" | "animation"
  >("offset");
  const [styleValues, setStyleValues] = useState<SubtitleStyleValues>(() => ({
    fontSize: DEFAULT_TEXT.fontSize,
    color: DEFAULT_TEXT.color,
    background: DEFAULT_TEXT.background,
    bold: DEFAULT_TEXT.bold,
    align: DEFAULT_TEXT.align,
    stroke: DEFAULT_TEXT.stroke,
    strokeWidth: DEFAULT_TEXT.strokeWidth,
  }));
  const [animation, setAnimation] = useState<SubtitleAnimation>({
    entrance: "fade",
    exit: "fade",
    inDuration: 0.4,
    outDuration: 0.4,
    distance: 48,
  });
  const cueText = useRef<HTMLTextAreaElement>(null);
  const [offset, setOffset] = useState("0");
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [plan, setPlan] = useState<SubtitleEditPlan | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const knownTracks = useRef(new Set(project.tracks.map((t) => t.id)));
  const tracks = project.tracks.filter((t) => t.kind === "text");
  const activeTrack = tracks.find((t) => t.id === trackId);
  const clips = useMemo(
    () =>
      project.clips
        .filter((c) => c.trackId === trackId && c.text)
        .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)),
    [project, trackId],
  );
  const visible = clips.filter((c) =>
    c.text!.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const selected = checked.filter((id) => clips.some((c) => c.id === id));
  const locked = !!activeTrack?.locked;
  const stale = !!plan && plan.base !== JSON.stringify(project);

  useEffect(() => {
    const textTracks = project.tracks.filter((t) => t.kind === "text");
    const preferred =
      textTracks.find((t) => /\u5b57\u5e55|subtitles?|captions?/i.test(t.name)) ?? textTracks[0];
    setTrackId(preferred?.id ?? "");
    setQuery("");
    setChecked([]);
    setDraft(null);
    setPlan(null);
    setError("");
    setNotice("");
  }, [project.id]);
  useEffect(() => {
    if (!project.tracks.some((t) => t.id === trackId && t.kind === "text")) {
      const preferred =
        project.tracks.find(
          (t) => t.kind === "text" && /\u5b57\u5e55|subtitles?|captions?/i.test(t.name),
        ) ?? project.tracks.find((t) => t.kind === "text");
      setTrackId(preferred?.id ?? "");
    }
    // Newly imported cues become selected in the editor; follow their new track.
    const first = project.clips.find(
      (c) => c.id === useEditorStore.getState().selectedIds[0] && c.text,
    );
    if (
      first &&
      first.trackId !== trackId &&
      (!knownTracks.current.has(first.trackId) ||
        !project.clips.some((c) => c.trackId === trackId))
    )
      setTrackId(first.trackId);
    knownTracks.current = new Set(project.tracks.map((t) => t.id));
  }, [project, trackId]);
  useEffect(() => {
    setChecked([]);
    setDraft(null);
    setPlan(null);
    setError("");
    setNotice("");
    setReferenceId("");
  }, [trackId]);
  useEffect(() => {
    if (error) feedback.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  function attempt(action: () => void) {
    setError("");
    setNotice("");
    try {
      action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function fileAction(action: Props["onImport"]) {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function editCue(clip: Clip) {
    useEditorStore.getState().select([clip.id]);
    useEditorStore.getState().seek(clip.start);
    setDraft({
      project: clone(project),
      id: clip.id,
      text: clip.text!.text,
      start: seconds(clip.start),
      end: seconds(clip.start + clip.duration),
    });
    setReferenceId(clip.id);
    setPlan(null);
    setError("");
    setNotice("");
  }
  function saveCue() {
    attempt(() => {
      if (!draft) return;
      if (!draft.start.trim() || !draft.end.trim())
        throw new Error(ui("시작 및 종료 시간을 입력하세요.", "Enter start and end times"));
      const next = prepareSubtitleEdit(draft.project, [draft.id], {
        type: "cue",
        text: draft.text,
        start: Number(draft.start),
        end: Number(draft.end),
      });
      const store = useEditorStore.getState();
      store.commit(applySubtitleEdit(store.project, next));
      setDraft(null);
      setNotice(
        next.changedIds.length ? ui("자막이 저장되었으며 한 번에 취소할 수 있습니다.", "Subtitle saved. Undo once to revert.") : ui("자막이 변경되지 않았습니다.", "Subtitle unchanged"),
      );
    });
  }
  function prepare() {
    attempt(() => {
      let edit: SubtitleEdit;
      if (mode === "offset") {
        if (!offset.trim()) throw new Error(ui("시간 오프셋을 입력하세요.", "Enter a time offset"));
        edit = { type: "offset", seconds: Number(offset) };
      } else if (mode === "replace")
        edit = { type: "replace", find, replacement };
      else if (mode === "style") edit = { type: "style", referenceId };
      else if (mode === "styleValues")
        edit = { type: "styleValues", values: styleValues };
      else edit = { type: "animation", options: animation };
      const next = prepareSubtitleEdit(
        useEditorStore.getState().project,
        selected,
        edit,
      );
      if (!next.changedIds.length) {
        setPlan(null);
        setNotice(ui("수정해야 할 자막이 없습니다.", "No subtitles need changing"));
        return;
      }
      setPlan(next);
    });
  }
  function apply() {
    attempt(() => {
      if (!plan) return;
      const store = useEditorStore.getState();
      store.commit(applySubtitleEdit(store.project, plan));
      const surviving = selected.filter((id) =>
        plan.project.clips.some((c) => c.id === id),
      );
      store.select(surviving);
      setChecked(surviving);
      setNotice(ui(`수정되었습니다. ${plan.changedIds.length} 자막을 한 번에 취소할 수 있습니다.`, `Updated ${plan.changedIds.length} subtitles. Undo once to revert.`));
      setPlan(null);
      setDraft(null);
    });
  }
  function splitCue() {
    attempt(() => {
      if (!draft || !cueText.current) return;
      const store = useEditorStore.getState();
      const next = prepareSubtitleEdit(draft.project, [draft.id], {
        type: "split",
        at: store.playhead,
        offset: cueText.current.selectionStart,
      });
      store.commit(applySubtitleEdit(store.project, next));
      store.select(next.changedIds);
      setChecked(next.changedIds);
      setDraft(null);
      setPlan(null);
      setNotice(ui("자막이 플레이헤드와 텍스트 커서로 분할되어 한 번에 취소할 수 있습니다.", "Subtitle split at the playhead and text cursor. Undo once to revert."));
    });
  }
  function mergeSelection() {
    attempt(() => {
      setPlan(
        prepareSubtitleEdit(useEditorStore.getState().project, selected, {
          type: "merge",
        }),
      );
      setDraft(null);
    });
  }
  function setSelection(ids: string[]) {
    setChecked(ids);
    setPlan(null);
  }
  const draftStale =
    draft && JSON.stringify(draft.project) !== JSON.stringify(project);

  return (
    <section className="subtitle-panel" aria-label={ui("자막 편집기", "Subtitle editor")}>
      <div className="subtitle-heading">
        <h3>{ui("자막 편집", "Edit subtitles")}</h3>
        <span>{ui(`${clips.length} 바`, `${clips.length} subtitles`)}</span>
      </div>
      <div className="subtitle-file-actions">
        <button
          className="small-button"
          disabled={!window.editorAPI}
          onClick={() => onSpeech("asr")}
        >
          {t("speech.asr")}
        </button>
        <button
          className="small-button"
          disabled={!window.editorAPI}
          onClick={() => onSpeech("tts")}
        >
          {t("speech.tts")}
        </button>
        <button
          className="small-button"
          onClick={() => void fileAction(onImport)}
        >
          <FolderOpen size={14} />
          {ui("자막 파일 가져오기", "Import subtitle file")}
        </button>
        <button
          className="small-button"
          onClick={() => void fileAction(onExport)}
          disabled={!project.clips.some((c) => c.text)}
          title={ui("프로젝트의 모든 텍스트 조각을 SRT로 내보내기", "Export all project text clips as SRT")}
        >
          <Download size={14} />
          {ui("모든 SRT 내보내기", "Export all as SRT")}
        </button>
      </div>
      <p className="subtitle-hint">
        {ui("SRT는 텍스트와 시간만 저장하고 스타일이나 애니메이션을 전달하지 않습니다. 애니메이션은 비디오로 내보내야 합니다.", "SRT contains only text and timing, not styles or animation. Export a video to include animation.")}
      </p>
      <label className="subtitle-track-label">
        {ui("텍스트 트랙", "Text track")}
        <select
          aria-label={ui("자막 트랙", "Subtitle track")}
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
        >
          {!tracks.length && <option value="">{ui("텍스트 트랙 없음", "No text tracks")}</option>}
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.locked ? ui(" · 잠김", " · Locked") : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="subtitle-search">
        <Search size={14} />
        <input
          aria-label={ui("자막 검색", "Search subtitles")}
          placeholder={ui("현재 트랙 자막 검색", "Search subtitles in this track")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="subtitle-selection">
        <label>
          <input
            type="checkbox"
            aria-label={ui("검색 결과 선택", "Select search results")}
            disabled={locked || !visible.length}
            checked={
              visible.length > 0 &&
              visible.every((c) => selected.includes(c.id))
            }
            onChange={(e) =>
              setSelection(
                e.target.checked
                  ? [...new Set([...selected, ...visible.map((c) => c.id)])]
                  : selected.filter((id) => !visible.some((c) => c.id === id)),
              )
            }
          />
          {ui("검색 결과 선택", "Select search results")}
        </label>
        <button
          className="subtitle-clear"
          disabled={!selected.length}
          onClick={() => setSelection([])}
        >
          {ui(`지우기(${selected.length})`, `Clear (${selected.length})`)}
        </button>
      </div>
      {locked && (
        <p className="subtitle-hint">
          <LockKeyhole size={13} />
          {ui("이 트랙은 잠겨 있으며 자막 위치를 지정하고 볼 수 있습니다.", "This track is locked. You can still seek to and view subtitles.")}
        </p>
      )}
      <div className="subtitle-cues">
        {!visible.length && (
          <div className="subtitle-empty">
            <Subtitles size={27} />
            <p>
              {clips.length
                ? ui("일치하는 자막이 없습니다.", "No matching subtitles")
                : ui("SRT/WebVTT 가져오기 또는 자막이 있는 텍스트 트랙 선택", "Import SRT / WebVTT, or choose a text track with subtitles")}
            </p>
          </div>
        )}
        {visible.map((clip) => (
          <div
            key={clip.id}
            className={`subtitle-cue ${draft?.id === clip.id ? "active" : ""}`}
            data-cue-id={clip.id}
          >
            <div className="subtitle-cue-line">
              <input
                type="checkbox"
                aria-label={ui(`자막 선택:${clip.text!.text.slice(0, 40)}`, `Select subtitle: ${clip.text!.text.slice(0, 40)}`)}
                checked={selected.includes(clip.id)}
                disabled={locked}
                onChange={(e) =>
                  setSelection(
                    e.target.checked
                      ? [...selected, clip.id]
                      : selected.filter((id) => id !== clip.id),
                  )
                }
              />
              <button
                className="subtitle-cue-content"
                onClick={() => editCue(clip)}
                title={ui("해당 자막을 찾아 수정", "Seek to this subtitle and edit")}
              >
                <span className="subtitle-time">
                  {timeLabel(clip.start)} —{" "}
                  {timeLabel(clip.start + clip.duration)}
                </span>
                <span>{clip.text!.text || ui("(빈 자막)", "(Empty subtitle)")}</span>
              </button>
            </div>
            {draft?.id === clip.id && (
              <div className="subtitle-cue-form">
                <textarea
                  ref={cueText}
                  aria-label={ui("자막 내용", "Subtitle text")}
                  value={draft.text}
                  maxLength={20000}
                  disabled={locked}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
                <div className="subtitle-times">
                  <label>
                    {ui("시작(초)", "Start (seconds)")}
                    <input
                      aria-label={ui("자막 시작 시간", "Subtitle start time")}
                      type="number"
                      min="0"
                      max="86400"
                      step={1 / project.fps}
                      value={draft.start}
                      disabled={locked}
                      onChange={(e) =>
                        setDraft({ ...draft, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {ui("종료(초)", "End (seconds)")}
                    <input
                      aria-label={ui("자막 종료 시간", "Subtitle end time")}
                      type="number"
                      min="0"
                      max="86400"
                      step={1 / project.fps}
                      value={draft.end}
                      disabled={locked}
                      onChange={(e) =>
                        setDraft({ ...draft, end: e.target.value })
                      }
                    />
                  </label>
                </div>
                <p className="subtitle-hint">
                  {ui("분할: 먼저 복사 수정 내용을 저장하고 재생 헤드를 분할 시간으로 이동한 후 텍스트 커서를 문장 위치에 놓습니다.", "To split: save text edits first, move the playhead to the split time, then place the text cursor where the sentence should split.")}
                </p>
                <button
                  className="small-button"
                  disabled={
                    locked ||
                    !!draftStale ||
                    draft.text !== clip.text!.text ||
                    Number(draft.start) !== clip.start ||
                    Math.abs(Number(draft.end) - clip.start - clip.duration) >
                      1e-8
                  }
                  onClick={splitCue}
                >
                  {ui("재생헤드와 텍스트 커서를 분리합니다.", "Split at playhead and text cursor")}
                </button>
                {draftStale && (
                  <p className="subtitle-warning">
                    {ui("항목이 변경되었습니다. 이 자막을 다시 클릭한 후 편집하세요.", "The project changed. Select this subtitle again before editing.")}
                  </p>
                )}
                <div className="subtitle-draft-actions">
                  <button
                    className="small-button"
                    onClick={() => setDraft(null)}
                  >
                    {ui("취소", "Cancel")}
                  </button>
                  <button
                    className="primary small-button"
                    disabled={locked || !!draftStale}
                    onClick={saveCue}
                  >
                    {ui("이 항목 저장", "Save subtitle")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="subtitle-batch">
        <div className="subtitle-heading">
          <h4>{ui("일괄 수정", "Batch edit")}</h4>
          <span>{ui(`선택 ${selected.length} 바`, `${selected.length} selected`)}</span>
        </div>
        <div
          className="subtitle-batch-tabs"
          role="tablist"
          aria-label={ui("자막 일괄 작업", "Subtitle batch actions")}
        >
          {(
            [
              ["offset", ui("시간 오프셋", "Time offset")],
              ["replace", ui("찾기 및 바꾸기", "Find and replace")],
              ["style", ui("균일 스타일", "Match style")],
              ["styleValues", ui("스타일 사용자 정의", "Custom style")],
              ["animation", ui("입력 및 종료", "Entrance and exit")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? "active" : ""}
              onClick={() => {
                setMode(key);
                setPlan(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="small-button"
          disabled={locked || selected.length < 2}
          onClick={mergeSelection}
        >
          {ui("선택한 자막 병합", "Merge selected subtitles")}
        </button>
        <p className="subtitle-hint">
          {ui("연속 선택된 항목 병합, 복사본을 줄 바꿈으로 연결; 첫 번째 시작점부터 마지막 ​​끝점까지 포함합니다(간격/겹침 포함). 첫 번째 스타일이 채택되고 해당 애니메이션이 새 지속 시간으로 늘어납니다.", "Merge consecutive selected subtitles, joining text with line breaks. The result spans the first start to the latest end, including gaps and overlaps. It uses the first subtitle’s style and stretches its animation to the new duration.")}
        </p>
        {mode === "styleValues" && (
          <SubtitleStyleForm
            value={styleValues}
            onChange={(v) => {
              setStyleValues(v);
              setPlan(null);
            }}
          />
        )}
        {mode === "animation" && (
          <SubtitleAnimationForm
            value={animation}
            onChange={(v) => {
              setAnimation(v);
              setPlan(null);
            }}
          />
        )}
        {mode === "offset" && (
          <label className="subtitle-batch-field">
            {ui("오프셋 초(음수 진행)", "Offset in seconds (negative moves earlier)")}
            <input
              aria-label={ui("자막 오프셋 초", "Subtitle offset in seconds")}
              type="number"
              step={1 / project.fps}
              value={offset}
              onChange={(e) => {
                setOffset(e.target.value);
                setPlan(null);
              }}
            />
          </label>
        )}
        {mode === "replace" && (
          <div className="subtitle-replace">
            <input
              aria-label={ui("자막 텍스트 찾기", "Find subtitle text")}
              placeholder={ui("텍스트 찾기(대소문자 구분)", "Find text (case-sensitive)")}
              value={find}
              onChange={(e) => {
                setFind(e.target.value);
                setPlan(null);
              }}
            />
            <input
              aria-label={ui("자막 텍스트 바꾸기", "Replace subtitle text")}
              placeholder={ui("다음으로 바꾸기(비워둘 수 있음)", "Replace with (may be empty)")}
              value={replacement}
              onChange={(e) => {
                setReplacement(e.target.value);
                setPlan(null);
              }}
            />
          </div>
        )}
        {mode === "style" && (
          <>
            <label className="subtitle-batch-field">
              {ui("스타일 참조 자막", "Style reference subtitle")}
              <select
                aria-label={ui("자막 스타일 참조", "Subtitle style reference")}
                value={referenceId}
                onChange={(e) => {
                  setReferenceId(e.target.value);
                  setPlan(null);
                }}
              >
                <option value="">{ui("참조 자막 선택", "Choose reference subtitle")}</option>
                {clips.map((c) => (
                  <option key={c.id} value={c.id}>
                    {timeLabel(c.start)} ·{" "}
                    {c.text!.text.slice(0, 30) || ui("빈 자막", "Empty subtitle")}
                  </option>
                ))}
              </select>
            </label>
            <p className="subtitle-hint">
              {ui("글꼴, 글꼴 크기, 색상, 획 및 정렬 복사; 모든 사본, 위치 및 애니메이션을 유지합니다.", "Copy font family, size, color, outline and alignment. Keep each subtitle’s text, position and animation.")}
            </p>
          </>
        )}
        {plan ? (
          <div className="subtitle-plan">
            <p>
              {stale
                ? ui("항목이 변경되었습니다. 수정사항이 있는지 다시 확인해주세요.", "The project changed. Check the changes again.")
                : ui(`수정 예정 ${plan.changedIds.length} 자막은 한 번에 취소할 수 있습니다.`, `${plan.changedIds.length} subtitles will change. Undo once to revert.`)}
            </p>
            <div>
              <button
                className="small-button"
                onClick={() =>
                  attempt(() => {
                    if (plan)
                      setPlan(
                        prepareSubtitleEdit(
                          useEditorStore.getState().project,
                          selected,
                          plan.edit,
                        ),
                      );
                  })
                }
              >
                {ui("재확인", "Check again")}
              </button>
              <button
                className="primary small-button"
                disabled={stale || locked}
                onClick={apply}
              >
                {ui(`적용 ${plan.changedIds.length} 수정사항`, `Apply ${plan.changedIds.length} changes`)}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="small-button subtitle-check"
            disabled={!selected.length || locked}
            onClick={prepare}
          >
            {ui("확인 및 수정", "Check changes")}
          </button>
        )}
      </div>
      {error && (
        <p ref={feedback} className="subtitle-error" role="alert">
          {localizeMessage(error) }
        </p>
      )}
      {notice && (
        <p className="subtitle-notice" role="status">
          {localizeMessage(notice) }
        </p>
      )}
    </section>
  );
}
