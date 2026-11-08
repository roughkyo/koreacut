import { localizeBuiltinTemplate, TEMPLATE_NAMES } from "./templateLabels";
import { useLanguageStore } from "../i18n";
import { localizeMessage } from "../i18n/messages";
import { useUITranslation } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  defaultTemplate,
  instantiateTemplate,
  replaceTemplateSlots,
  type ProjectTemplate,
  type TemplateReplacements,
  type TemplateSummary,
} from "../core/projectTemplates";
import { TEMPLATE_EXAMPLES } from "../core/templateExamples";
import { projectDuration } from "../core/model";
import type { Project } from "../core/types";
import { useEditorStore } from "../editor/store";
import "./TemplateDialog.css";

function coverFrame() {
  const source = document.querySelector<HTMLCanvasElement>(
    ".player-panel canvas",
  );
  if (!source?.width) return "";
  const c = document.createElement("canvas");
  c.width = 480;
  c.height = 270;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#101015";
  ctx.fillRect(0, 0, 480, 270);
  const scale = Math.min(480 / source.width, 270 / source.height),
    w = source.width * scale,
    h = source.height * scale;
  ctx.drawImage(source, (480 - w) / 2, (270 - h) / 2, w, h);
  return c.toDataURL("image/png");
}
export default function TemplateDialog({
  onClose,
  onCreate,
}: {
  onClose(): void;
  onCreate(base: Project, replaced: Project): boolean;
}) {
  const ui = useUITranslation();
  const [draft, setDraft] = useState(() =>
    defaultTemplate(useEditorStore.getState().project, coverFrame()),
  );
  const [enabled, setEnabled] = useState(() => draft.slots.map((s) => s.id));
  const [tab, setTab] = useState<"library" | "save">("library"),
    [entries, setEntries] = useState<TemplateSummary[]>([]);
  const [selected, setSelected] = useState<ProjectTemplate | null>(null),
    [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<TemplateReplacements>({
      media: {},
      text: {},
    }),
    [name, setName] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [progress, setProgress] = useState<{
      progress: number;
      message: string;
    } | null>(null);
  const job = useRef<string | null>(null),
    alive = useRef(true),
    cancelled = useRef(false);
  const refresh = async () => {
    const list = await window.editorAPI!.listTemplates();
    if (alive.current) setEntries(list);
  };
  useEffect(() => {
    alive.current = true;
    void refresh().catch((e) => {
      if (alive.current) setError(String(e));
    });
    const off = window.editorAPI?.onTemplateProgress((e) => {
      if (e.jobId === job.current) setProgress(e);
    });
    return () => {
      alive.current = false;
      off?.();
      if (job.current) void window.editorAPI?.cancelTemplate(job.current);
    };
  }, []);
  const run = async (fn: (jobId: string) => Promise<void>) => {
    if (job.current) return;
    job.current = crypto.randomUUID();
    cancelled.current = false;
    setBusy(true);
    setError("");
    setNotice("");
    setProgress(null);
    try {
      await fn(job.current);
    } catch (e) {
      if (alive.current)
        setError(
          String(e).replace(
            /^Error: Error invoking remote method '[^']+': (?:Error: )?/,
            "",
          ),
        );
    } finally {
      job.current = null;
      if (alive.current) setBusy(false);
    }
  };
  const load = (id: string, builtin = false) =>
    void run(async () => {
      const t = localizeBuiltinTemplate(
        instantiateTemplate(await window.editorAPI!.loadTemplate(id, builtin)),
        builtin ? id : undefined,
        useLanguageStore.getState().language,
      );
      if (!alive.current || cancelled.current) return;
      setSelected(t);
      setSelectedId(builtin ? "" : id);
      setName(t.project.name);
      setValues({ media: {}, text: {} });
    });
  const save = () =>
    void run(async (jobId) => {
      await window.editorAPI!.saveTemplate(jobId, {
        ...draft,
        slots: draft.slots.filter((s) => enabled.includes(s.id)),
      });
      if (!alive.current || cancelled.current) return;
      await refresh();
      setTab("library");
      setNotice(ui("템플릿이 로컬 라이브러리에 저장되었으며 원본 프로젝트는 변경되지 않은 상태로 유지됩니다.", "Template saved to the local library. The original project is unchanged."));
    });
  const replace = (slotId: string) =>
    void run(async () => {
      const assets = await window.editorAPI!.importMedia();
      if (!alive.current || cancelled.current || !assets.length) return;
      if (assets.length !== 1)
        throw new Error(ui("각 자리 표시자에 대해 하나의 자료를 선택하십시오. 계속해서 다른 자리 표시자를 선택할 수 있습니다.", "Choose one asset per slot. You can then choose assets for the other slots."));
      setValues((v) => ({ ...v, media: { ...v.media, [slotId]: assets[0] } }));
    });
  let candidate: Project | null = null,
    preflight = "";
  if (selected)
    try {
      candidate = replaceTemplateSlots(selected, values);
      candidate.name = name.trim();
      if (!candidate.name || candidate.name.length > 120)
        throw new Error(ui("프로젝트 이름은 1-120자여야 합니다.", "Project names must contain 1–120 characters."));
    } catch (e) {
      preflight = String(e).replace(/^Error: /, "");
    }
  const create = () => {
    if (!selected || !candidate || preflight) return;
    const base = { ...selected.project, name: name.trim() };
    if (onCreate(base, candidate)) onClose();
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal modal-wide template-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={ui("프로젝트 템플릿", "Project templates")}
      >
        <header>
          <h2>{ui("프로젝트 템플릿", "Project templates")}</h2>
          <button disabled={busy} aria-label={ui("프로젝트 템플릿 닫기", "Close project templates")} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <nav className="template-toolbar">
            <button
              disabled={busy}
              className={tab === "library" ? "active" : ""}
              onClick={() => setTab("library")}
            >
              {ui("템플릿 라이브러리", "Template library")}
            </button>
            <button
              disabled={busy}
              className={tab === "save" ? "active" : ""}
              onClick={() => setTab("save")}
            >
              {ui("현재 프로젝트를 템플릿으로 저장", "Save current project as template")}
            </button>
          </nav>
          {tab === "save" ? (
            <fieldset disabled={busy}>
              <label>
                {ui("템플릿 이름", "Template name")}
                <input
                  aria-label={ui("템플릿 이름", "Template name")}
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              {draft.cover && (
                <img
                  className="template-cover"
                  src={draft.cover}
                  alt={ui("현재 플레이헤드 템플릿 커버", "Template cover from current playhead")}
                />
              )}
              <p className="muted small">
                {ui("커버는 패널이 열릴 때 플레이어 화면을 차지합니다. 타임라인에 사용된 미디어의 사본만 수집됩니다. 글꼴 파일은 포함되지 않습니다. 교체 가능한 아이템을 체크하고 이름을 지정하고, 고정 디자인으로 유지하려면 해당 아이템의 체크를 해제하세요(최대 200개 아이템).", "The cover uses the player frame when this panel opens. Only media used on the timeline is copied; fonts are excluded. Select and name replaceable slots. Unchecked content remains fixed (up to 200 slots).")}
              </p>
              {draft.slots.map((s) => (
                <div className="template-slot" key={s.id}>
                  <input
                    type="checkbox"
                    aria-label={ui(`자리 표시자 활성화 ${s.label}`, `Enable slot ${s.label}`)}
                    checked={enabled.includes(s.id)}
                    onChange={(e) =>
                      setEnabled(
                        e.target.checked
                          ? [...enabled, s.id]
                          : enabled.filter((k) => k !== s.id),
                      )
                    }
                  />
                  <span>{s.kind === "media" ? ui("미디어", "Media") : ui("카피 라이팅", "Text")}</span>
                  <input
                    aria-label={ui(`자리 표시자 이름 ${s.label}`, `Slot name ${s.label}`)}
                    maxLength={120}
                    value={s.label}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        slots: draft.slots.map((old) =>
                          old.id === s.id
                            ? { ...s, label: e.target.value }
                            : old,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </fieldset>
          ) : (
            <>
              <div className="template-toolbar">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async (id) => {
                      if (await window.editorAPI!.importTemplate(id)) {
                        await refresh();
                        if (alive.current && !cancelled.current)
                          setNotice(ui("템플릿 패키지가 로컬 라이브러리에 복사되었습니다.", "Template package copied to the local library"));
                      }
                    })
                  }
                >
                  {ui("템플릿 패키지 가져오기...", "Import template package…")}
                </button>
                <span className="muted small">
                  {ui("로컬 템플릿 · 미디어가 패키지와 함께 저장됩니다. · 인터넷에 연결할 필요가 없습니다.", "Local templates · Media included · No internet required")}
                </span>
              </div>
              <div className="template-cards">
                {TEMPLATE_EXAMPLES.map((t) => (
                  <button
                    disabled={busy}
                    key={t.id}
                    onClick={() => load(t.id, true)}
                  >
                    <img
                      src={`./template-previews/${t.id}.png`}
                      alt={ui("원본 샘플 표지", "Original example cover")}
                    />
                    <strong>{ui(t.name, TEMPLATE_NAMES[t.id])}</strong>
                    <small>{ui(t.description, {
                      promo: "A 12-second landscape promo with three scenes and titles. Replace the media with product footage.",
                      talk: "A 12-second talking-head layout with three subtitles and a corner label. Replace the main scene with your footage.",
                      gallery: "A 12-second photo story with three scenes and captions, with independently editable zoom animations.",
                    }[t.id])}</small>
                    <small>{ui("원본 예 · 자유롭게 편집 가능", "Original example · Fully editable")}</small>
                  </button>
                ))}
                {entries.map((t) => (
                  <button disabled={busy} key={t.id} onClick={() => load(t.id)}>
                    {t.cover && <img src={t.cover} alt={ui("저장된 템플릿 표지", "Saved template cover")} />}
                    <strong>{t.name}</strong>
                    <small>{ui(`${t.slots} 자리 표시자 · 기본 템플릿`, `${t.slots} slots · Local template`)}</small>
                  </button>
                ))}
              </div>
              {selected && (
                <fieldset disabled={busy} className="template-replacements">
                  <legend>{selected.name}</legend>
                  <label>
                    {ui("새 프로젝트 이름", "New project name")}
                    <input
                      aria-label={ui("템플릿 새 프로젝트 이름", "Template project name")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={120}
                    />
                  </label>
                  <p>
                    {selected.project.width} × {selected.project.height} ·{" "}
                    {ui(`${projectDuration(selected.project).toFixed(2)} 초 · ${selected.slots.length} 자리 표시자`, `${projectDuration(selected.project).toFixed(2)} seconds · ${selected.slots.length} slots`)}
                  </p>
                  <p className="muted small">
                    {ui("교체는 타임라인, 소스 인 포인트, 속도, 자르기 및 애니메이션을 유지합니다. 새 비디오/오디오의 길이가 충분하지 않으면 전체 작업 배치가 거부됩니다. 화면은 비례에 맞게 조정되며 비율이 다른 경우 가장자리가 남을 수 있습니다. 원본 자료와 사본은 기본적으로 유지됩니다. 새 프로젝트에서 실행 취소를 한 번만 하면 현재 대체 항목 배치를 복원할 수 있습니다.", "Replacements preserve the timeline, source in points, speed, crop and animation. If new video or audio is too short, the entire operation is rejected. Pictures fit proportionally and may have borders. Original media and text are kept by default. Undo once in the new project to revert this batch.")}
                  </p>
                  {selected.slots.map((s) => (
                    <div key={s.id} className="template-replacement">
                      {s.label}
                      {s.kind === "text" ? (
                        <textarea
                          aria-label={ui(`카피라이팅 교체 ${s.label}`, `Replace text ${s.label}`)}
                          value={
                            values.text[s.id] ??
                            selected.project.clips.find(
                              (c) => c.id === s.targetId,
                            )!.text!.text
                          }
                          onChange={(e) =>
                            setValues({
                              ...values,
                              text: { ...values.text, [s.id]: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <div>
                          <span>
                            {values.media[s.id]?.name ??
                              selected.project.assets.find(
                                (a) => a.id === s.targetId,
                              )!.name}
                          </span>
                          <button onClick={() => replace(s.id)}>
                            {ui("대체 자료 선택", "Choose replacement asset")}
                          </button>
                          {values.media[s.id] && (
                            <button
                              onClick={() => {
                                const media = { ...values.media };
                                delete media[s.id];
                                setValues({ ...values, media });
                              }}
                            >
                              {ui("원본 자료 복원", "Restore original asset")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedId && (
                    <button
                      onClick={() =>
                        void run(async (id) => {
                          const file = await window.editorAPI!.exportTemplate(
                            id,
                            selectedId,
                          );
                          if (file && alive.current && !cancelled.current) {
                            setNotice(
                              ui(`템플릿 패키지가 내보내졌습니다:${file.split(/[\\/]/).pop()}`, `Template package exported: ${file.split(/[\\/]/).pop()}`),
                            );
                            await window.editorAPI!.revealPath(file);
                          }
                        })
                      }
                    >
                      {ui("원본 템플릿 패키지 내보내기...", "Export original template package…")}
                    </button>
                  )}
                  {!selectedId && (
                    <p className="muted small">
                      {ui("원본 예 새 프로젝트를 생성한 후 로컬 템플릿 라이브러리에 저장하고 내보낼 수 있습니다.", "Create a project from an original example, then save it to the local template library to export it.")}
                    </p>
                  )}
                </fieldset>
              )}
            </>
          )}
          {progress && (
            <div className="export-progress">
              <p>{localizeMessage(progress.message) }</p>
              <progress value={progress.progress} max={1} />
            </div>
          )}
          {(error || preflight) && (
            <p role="alert" className="inline-warning">
              {localizeMessage(error || preflight) }
            </p>
          )}
          {notice && <p role="status">{localizeMessage(notice) }</p>}
        </div>
        <footer>
          {busy ? (
            <button
              onClick={() => {
                cancelled.current = true;
                if (job.current)
                  void window.editorAPI?.cancelTemplate(job.current);
              }}
            >
              {ui("작업 취소", "Cancel operation")}
            </button>
          ) : (
            <>
              <button onClick={onClose}>{ui("닫기", "Close")}</button>
              {tab === "save" ? (
                <button className="primary" onClick={save}>
                  {ui("템플릿 및 미디어 사본 저장", "Save template and media copies")}
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={!candidate || !!preflight}
                  onClick={create}
                >
                  {ui("새 독립 프로젝트 생성 및 교체 적용", "Create independent project with replacements")}
                </button>
              )}
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
