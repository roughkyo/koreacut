import { useLibraryLabel } from "./libraryLabels";
import { useUITranslation } from "../i18n";
import { useState } from "react";
import { Plus, Search, Type } from "lucide-react";
import {
  MOTION_PRESETS,
  TEXT_PRESETS,
  TRANSITION_PRESETS,
  type MotionId,
  type TextPreset,
  type TransitionId,
} from "../core/creativePresets";
import PresetPreview from "./PresetPreview";
import "./CreativeLibrary.css";
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  return (
    <label className="creative-search">
      <Search size={14} />
      <input
        aria-label={ui("사전 설정 검색", "Search presets")}
        placeholder={ui("이름이나 목적 검색", "Search names or uses")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Footer() {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  return (
    <footer className="creative-footer"> {ui("직접 작성 · MIT 라이선스 · 오프라인 사용 가능", "Original · MIT licensed · Available offline")} </footer>
  );
}
export function TextLibrary({
  onAdd,
  onBlank,
}: {
  onAdd: (preset: TextPreset) => void;
  onBlank: () => void;
}) {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("모두");
  const presets = TEXT_PRESETS.map(p => ({ ...p, name: label(p.name), style: { ...p.style, text: label(p.style.text ?? "") } })).filter(
    (p) =>
      (category === "모두" || category === p.category) &&
      (p.name + p.style.text)
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  return (
    <section className="creative-library" aria-label={ui("텍스트 템플릿 라이브러리", "Text template library")}>
      <header>
        <strong>
           {ui("텍스트 템플릿", "Text templates")} <small>{TEXT_PRESETS.length}</small>
        </strong>
        <button onClick={onBlank}>
          <Type size={12} />  {ui("텍스트 추가", "Add text")} </button>
      </header>
      <SearchBox value={query} onChange={setQuery} />
      <div className="creative-tabs" role="tablist" aria-label={ui("텍스트 템플릿 카테고리", "Text template categories")}>
        {["모두", "제목", "자막", "마크", "동적"].map((c) => (
          <button
            key={label(c)}
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
          >
            {label(c)}
          </button>
        ))}
      </div>
      <div className="creative-scroll">
        <p className="creative-help">
           {ui("재생헤드 위치에 추가; 콘텐츠, 글꼴, 획 및 애니메이션을 모두 편집할 수 있습니다.", "Add at the playhead. Text, font, outline and animation are editable.")} </p>
        <div className="creative-grid">
          {presets.map((p) => (
            <article className="creative-card" key={p.id} data-preset-id={p.id}>
              <PresetPreview text={p} label={p.name} />
              <div>
                <span>
                  {p.name}
                  <small>{label(p.category)}  {ui("· 편집 가능한 텍스트", "· Editable text")} </small>
                </span>
                <button
                  aria-label={ui(`추가${p.name}템플릿`, `Add ${p.name} template`)}
                  onClick={() => onAdd(p)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!presets.length && (
          <p className="creative-empty"> {ui("일치하는 텍스트 템플릿이 없습니다", "No matching text templates")} </p>
        )}
      </div>
      <Footer />
    </section>
  );
}
export function MotionLibrary({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (motion: MotionId) => void;
}) {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  const [query, setQuery] = useState("");
  const presets = MOTION_PRESETS.map(p => ({ ...p, name: label(p.name), description: label(p.description) })).filter((p) =>
    (p.name + p.description).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} />
      <p className="creative-help">
         {ui("선택한 화면이나 텍스트에 적용됩니다. 해당 속성의 키프레임을 덮어씁니다. 다른 속성은 유지되며 실행 취소할 수 있습니다.", "Apply to selected video or text. Replaces keyframes for affected properties only. Can be undone.")} </p>
      <div className="creative-grid">
        {presets.map((p) => (
          <article className="creative-card" key={p.id} data-preset-id={p.id}>
            <PresetPreview motion={p.id} label={p.name} />
            <div>
              <span title={p.description}>
                {p.name}
                <small> {ui("키프레임 모션 효과", "Keyframe animation")} </small>
              </span>
              <button
                disabled={disabled}
                aria-label={ui(`애플리케이션${p.name}특수 효과`, `Apply ${p.name} effect`)}
                onClick={() => onApply(p.id)}
              >
                <Plus size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!presets.length && <p className="creative-empty"> {ui("일치하는 모션 효과 없음", "No matching animations")} </p>}
    </>
  );
}
export function TransitionLibrary({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (transition: TransitionId, seconds: number) => void;
}) {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("모두"),
    [seconds, setSeconds] = useState(0.5);
  const presets = TRANSITION_PRESETS.map(p => ({ ...p, name: label(p.name), description: label(p.description) })).filter(
    (p) =>
      (category === "모두" || category === p.category) &&
      (p.name + p.description).toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="creative-library" aria-label={ui("전환 재질 라이브러리", "Transition library")}>
      <header>
        <strong>
           {ui("화면 전환", "Transitions")} <small>{TRANSITION_PRESETS.length}</small>
        </strong>
        <span> {ui("로컬 생성", "Generated locally")} </span>
      </header>
      <SearchBox value={query} onChange={setQuery} />
      <div className="creative-tabs" role="tablist" aria-label={ui("전환 분류", "Transition categories")}>
        {["모두", "기본", "카메라 이동", "동적"].map((c) => (
          <button
            key={label(c)}
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
          >
            {label(c)}
          </button>
        ))}
      </div>
      <label className="creative-duration">
         {ui("전환 지속 시간", "Transition duration")} <input
          type="number"
          aria-label={ui("전환 지속 시간", "Transition duration")}
          min={0.05}
          max={5}
          step={0.05}
          value={seconds}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (Number.isFinite(value))
              setSeconds(Math.max(0.05, Math.min(5, value)));
          }}
        />
         {ui("초", "s")} </label>
      <div className="creative-scroll">
        <p className="creative-help">
           {ui("동일한 트랙에서 인접한 장면의 이전 세그먼트를 선택합니다. 지속 시간은 프레임 및 클립 길이에 따라 제한됩니다. \"배경 통과\"를 제외하면 후자 부분이 미리 겹쳐집니다. 카메라 이동은 후속 세그먼트 시작 부분의 해당 키프레임을 대체합니다.", "Select the first of two adjacent clips on the same track. Duration is limited by frames and clip length. Except for Fade through background, the next clip overlaps earlier. Camera motion replaces the next clip’s initial keyframes.")} </p>
        <div className="creative-grid">
          {presets.map((p) => (
            <article className="creative-card" key={p.id} data-preset-id={p.id}>
              <PresetPreview transition={p.id} label={p.name} />
              <div>
                <span title={p.description}>
                  {p.name}
                  <small>
                    {label(p.category)} · {p.description}
                  </small>
                </span>
                <button
                  disabled={disabled}
                  className="transition-apply"
                  aria-label={ui(`애플리케이션${p.name}전환`, `Apply ${p.name} transition`)}
                  onClick={() => onApply(p.id, seconds)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!presets.length && <p className="creative-empty"> {ui("일치하는 전환이 없습니다.", "No matching transitions")} </p>}
      </div>
      <Footer />
    </section>
  );
}
