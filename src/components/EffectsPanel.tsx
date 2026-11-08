import { useLibraryLabel } from "./libraryLabels";
import { useUITranslation } from "../i18n";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  Film,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from "lucide-react";
import type { Adjustments, Clip, TrackKind, Project } from "../core/types";
import { DEFAULT_ADJUSTMENTS } from "../core/defaults";
import "./EffectsPanel.css";
import { MotionLibrary } from "./CreativeLibrary";
import { motionPatch } from "../core/creativePresets";
import PresetPreview from "./PresetPreview";

export interface EffectsPanelProps {
  clip?: Clip;
  project?: Pick<Project, "width" | "height">;
  kind?: TrackKind;
  locked?: boolean;
  onApply: (patch: Partial<Clip>) => void;
}
export interface ColorPreset {
  id: string;
  name: string;
  description: string;
  colors: string;
  adjustments: Partial<Adjustments>;
}
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "original",
    name: "원색",
    description: "소재의 자연스러운 색상 복원",
    colors: "#526658,#baac84,#65828d",
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  },
  {
    id: "cinema",
    name: "영화",
    description: "깊은 대비, 낮은 채도 분위기",
    colors: "#243744,#b49868,#406d7a",
    adjustments: {
      brightness: -0.04,
      contrast: 1.22,
      saturation: 0.78,
      temperature: -0.08,
      blur: 0,
    },
  },
  {
    id: "warm",
    name: "따뜻한 태양",
    description: "따뜻하고 밝은, 일상 녹화에 적합",
    colors: "#927b51,#ead092,#c4a570",
    adjustments: {
      brightness: 0.05,
      contrast: 1.05,
      saturation: 1.1,
      temperature: 0.3,
      blur: 0,
    },
  },
  {
    id: "cool",
    name: "차가운 파란색",
    description: "선명하고 차가운 톤, 영상 수준 강조",
    colors: "#2c5367,#86acbc,#55788e",
    adjustments: {
      brightness: 0.015,
      contrast: 1.12,
      saturation: 0.9,
      temperature: -0.35,
      blur: 0,
    },
  },
  {
    id: "mono",
    name: "흑백",
    description: "순수 흑백, 빛과 그림자 디테일 유지",
    colors: "#343839,#bebdb4,#6d7270",
    adjustments: {
      brightness: 0,
      contrast: 1.15,
      saturation: 0,
      temperature: 0,
      blur: 0,
    },
  },
  {
    id: "vintage",
    name: "레트로",
    description: "바래고 따뜻한 필름 느낌",
    colors: "#686a4c,#c5b680,#8c987d",
    adjustments: {
      brightness: 0.045,
      contrast: 0.86,
      saturation: 0.72,
      temperature: 0.22,
      blur: 0,
    },
  },
  {
    id: "vivid",
    name: "선명",
    description: "밝고 채도가 높으며 풍부한 색상 표현",
    colors: "#45836b,#f6cf72,#679baa",
    adjustments: {
      brightness: 0.02,
      contrast: 1.1,
      saturation: 1.45,
      temperature: 0,
      blur: 0,
    },
  },
  {
    id: "soft",
    name: "소프트 포커스",
    description: "부드러운 디테일, 흐릿한 질감 생성",
    colors: "#8d9d9b,#d6c9af,#a4aeb9",
    adjustments: {
      brightness: 0.03,
      contrast: 0.95,
      saturation: 0.9,
      temperature: 0.05,
      blur: 2,
    },
  },
];
export function presetPatch(preset: ColorPreset, clip?: Clip): Partial<Clip> {
  return {
    adjustments: {
      ...DEFAULT_ADJUSTMENTS,
      ...clip?.adjustments,
      ...preset.adjustments,
    },
  };
}
export function fadePatch(
  kind: "visual" | "audio",
  direction: "in" | "out" | "both" | "none",
  seconds: number,
  duration = Infinity,
): Partial<Clip> {
  const value = Math.max(
    0,
    Math.min(seconds, duration / (direction === "both" ? 2 : 1)),
  );
  const incoming = direction === "in" || direction === "both" ? value : 0;
  const outgoing = direction === "out" || direction === "both" ? value : 0;
  return kind === "visual"
    ? { fadeIn: incoming, fadeOut: outgoing }
    : { audioFadeIn: incoming, audioFadeOut: outgoing };
}
export default function EffectsPanel({
  clip,
  project = { width: 1920, height: 1080 },
  kind,
  locked = false,
  onApply,
}: EffectsPanelProps) {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  const [tab, setTab] = useState<"color" | "fade" | "motion">("color");
  const [seconds, setSeconds] = useState(0.5);
  const [query, setQuery] = useState("");
  const active = COLOR_PRESETS.find((p) =>
    Object.entries(p.adjustments).every(
      ([key, value]) =>
        Math.abs(clip?.adjustments[key as keyof Adjustments]! - Number(value)) <
        0.001,
    ),
  );
  const disabled = !clip || locked;
  const colorDisabled = disabled || kind === "audio" || kind === "text";
  return (
    <section className="effects-panel" aria-label={ui("로컬 효과 라이브러리", "Local effects library")}>
      <div className="effects-title">
        <Sparkles size={15} />
        <strong> {ui("효과 사전 설정 · 16", "Effect presets · 16")} </strong>
        <span> {ui("로컬 처리", "Local processing")} </span>
      </div>
      <div className="effects-tabs" role="tablist" aria-label={ui("효과 유형", "Effect types")}>
        <button
          role="tab"
          aria-selected={tab === "color"}
          className={tab === "color" ? "is-active" : ""}
          onClick={() => setTab("color")}
        >
          <SlidersHorizontal size={13} />  {ui("색상 사전 설정", "Color presets")} </button>
        <button
          role="tab"
          aria-selected={tab === "motion"}
          className={tab === "motion" ? "is-active" : ""}
          onClick={() => setTab("motion")}
        >
          <Sparkles size={13} />  {ui("동적 효과", "Motion effects")} </button>
        <button
          role="tab"
          aria-selected={tab === "fade"}
          className={tab === "fade" ? "is-active" : ""}
          onClick={() => setTab("fade")}
        >
          <Waves size={13} />  {ui("페이드", "Fades")} </button>
      </div>
      <div className="effects-content">
        <div className={`effects-selection ${disabled ? "is-empty" : ""}`}>
          <Film size={14} />
          <span>
            {clip
              ? `${clip.name}${locked ? ui(" ·트랙이 잠겼습니다", " · Track locked") : ""}`
              : ui("타임라인에서 먼저 클립을 선택하세요", "Select a clip on the timeline first")}
          </span>
          {clip && <ChevronRight size={12} />}
        </div>
        {tab === "motion" ? (
          <MotionLibrary
            disabled={disabled || kind === "audio"}
            onApply={(motion) => {
              if (clip) onApply(motionPatch(clip, motion, project));
            }}
          />
        ) : tab === "color" ? (
          <>
            <p className="effects-help">
              {kind === "audio"
                ? ui("오디오 클립은 \"페이드\"에서 사운드 변경을 조정할 수 있습니다.", "Use Fades to adjust audio transitions.")
                : kind === "text"
                  ? ui("텍스트 스타일은 오른쪽 속성에서 편집할 수 있습니다. \"페이드 인 및 페이드 아웃\"은 텍스트 표시 변경을 설정할 수 있습니다.", "Edit text style in the properties panel. Use Fades to adjust how text appears and disappears.")
                  : ui("클립에 적용할 프리셋을 선택합니다. 오른쪽에 있는 속성을 계속해서 미세 조정할 수 있습니다.", "Select a preset to apply it. Fine-tune in the properties panel.")}
            </p>
            <label className="creative-search">
              <input
                aria-label={ui("색상 보정 사전 설정 검색", "Search color presets")}
                placeholder={ui("색상 보정 사전 설정 검색", "Search color presets")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="effects-grid">
              {COLOR_PRESETS.map(p => ({ ...p, name: label(p.name), description: label(p.description) })).filter((p) =>
                (p.name + p.description).toLowerCase().includes(query.trim().toLowerCase()),
              ).map((preset) => (
                <article
                  className="creative-card"
                  key={preset.id}
                  data-preset-id={preset.id}
                >
                  <PresetPreview
                    adjustments={preset.adjustments}
                    label={preset.name}
                  />
                  <div>
                    <span>
                      {preset.name}
                      <small>{preset.description}</small>
                    </span>
                    <button
                      disabled={colorDisabled}
                      onClick={() => onApply(presetPatch(preset, clip))}
                      aria-label={ui(`애플리케이션${preset.name}색상 보정`, `Apply ${preset.name} color preset`)}
                      aria-pressed={!!clip && active?.id === preset.id}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="effects-reset"
              disabled={colorDisabled}
              onClick={() =>
                onApply({ adjustments: { ...DEFAULT_ADJUSTMENTS } })
              }
            >
              <RotateCcw size={12} />  {ui("색상 보정 재설정", "Reset color")} </button>
          </>
        ) : (
          <>
            <p className="effects-help">
               {ui("클립 가장자리에 부드러운 변경 사항 추가. 영상과 사운드를 별도로 설정할 수 있습니다.", "Add smooth transitions at clip edges. Set picture and sound independently.")} </p>
            <label className="effects-duration">
              <span> {ui("지속 시간 변경", "Fade duration")} </span>
              <input
                aria-label={ui("페이드 인 및 페이드 아웃 지속 시간", "Fade duration")}
                type="number"
                min="0.05"
                max="10"
                step="0.05"
                value={seconds}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  if (Number.isFinite(n))
                    setSeconds(Math.max(0.05, Math.min(10, n)));
                }}
              />
              <span> {ui("초", "s")} </span>
            </label>
            {(["visual", "audio"] as const)
              .filter((channel) =>
                channel === "visual" ? kind !== "audio" : kind !== "text",
              )
              .map((kind) => (
                <div className="effects-fade-group" key={kind}>
                  <h3>
                    {kind === "visual" ? ui("화면", "Picture") : ui("사운드", "Sound")}
                    <span>
                      {clip
                        ? `${kind === "visual" ? clip.fadeIn.toFixed(2) : clip.audioFadeIn.toFixed(2)}s / ${kind === "visual" ? clip.fadeOut.toFixed(2) : clip.audioFadeOut.toFixed(2)}s`
                        : ui("인/아웃", "In / Out")}
                    </span>
                  </h3>
                  <div className="effects-fade-grid">
                    {(["in", "out", "both"] as const).map((direction) => (
                      <button
                        key={direction}
                        disabled={disabled}
                        onClick={() =>
                          onApply(
                            fadePatch(kind, direction, seconds, clip?.duration),
                          )
                        }
                      >
                        <span
                          className={`effects-fade-shape shape-${direction}`}
                        />
                        <span>
                          {direction === "in"
                            ? ui("페이드 인", "Fade in")
                            : direction === "out"
                              ? ui("페이드 아웃", "Fade out")
                              : ui("페이드", "Fades")}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="effects-reset"
                    disabled={disabled}
                    onClick={() => onApply(fadePatch(kind, "none", 0))}
                  >
                    <RotateCcw size={11} />  {ui("제거", "Remove")} {kind === "visual" ? ui("화면", "Picture") : ui("사운드", "Sound")} {ui("페이드", "Fades")} </button>
                </div>
              ))}
            <p className="effects-note">
               {ui("지속 시간 변경은 클립 길이에 따라 제한됩니다. 동시에 페이드 인 및 페이드 아웃은 클립의 절반을 초과할 수 없습니다.", "Fade duration is limited by clip length. Combined fades each use at most half the clip.")} </p>
          </>
        )}
      </div>
      <div className="effects-footer">
        <Check size={11} />  {ui("미리보기 및 내보내기는 동일한 매개변수를 사용합니다.", "Preview and export use the same settings")} </div>
    </section>
  );
}
