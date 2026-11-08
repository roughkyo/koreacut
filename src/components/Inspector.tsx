import { useUITranslation } from "../i18n";
import KeyframeCurveEditor from "./KeyframeCurveEditor";
import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  Image,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Type,
  Volume2,
  WandSparkles,
} from "lucide-react";
import type { Clip, Keyframe, Project } from "../core/types";
import { DEFAULT_TRANSFORM, DEFAULT_ADJUSTMENTS } from "../core/defaults";
import { evaluateKeyframes, formatTime, id } from "../core/model";
import VisualTools from "./VisualTools";
import "./Inspector.css";
import { useEditorStore } from "../editor/store";
interface Props {
  project: Project;
  clip?: Clip;
  playhead: number;
  onUpdate: (patch: Partial<Clip>) => void;
  onProjectUpdate: (patch: Partial<Project>) => void;
}
function NumberField({
  label,
  value,
  min = -100000,
  max = 100000,
  step = 1,
  onChange,
  suffix,
  diamond,
  range = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
  diamond?: () => void;
  range?: boolean;
}) {
  const ui = useUITranslation();
  return (
    <label className="property-row">
      <span>{label}</span>
      {range && (
        <input
          className="property-range"
          aria-label={ui(`${label}슬라이더`, `${label} slider`)}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={() => useEditorStore.getState().beginTransaction()}
          onPointerUp={() => useEditorStore.getState().endTransaction()}
          onPointerCancel={() => useEditorStore.getState().endTransaction()}
          onKeyDown={() => useEditorStore.getState().beginTransaction()}
          onKeyUp={() => useEditorStore.getState().endTransaction()}
          onBlur={() => useEditorStore.getState().endTransaction()}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
      <div className="numeric-field">
        <input
          aria-label={label}
          type="number"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          onFocus={() => useEditorStore.getState().beginTransaction()}
          onBlur={() => useEditorStore.getState().endTransaction()}
          onChange={(e) => {
            if (e.target.value === "") return;
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
          }}
        />
        {suffix && <span>{suffix}</span>}
      </div>
      {diamond && (
        <button
          className="diamond-btn"
          title={ui(`추가 ${label} 키프레임`, `Add ${label} keyframe`)}
          onClick={(e) => {
            e.preventDefault();
            diamond();
          }}
        >
          <Diamond size={12} />
        </button>
      )}
    </label>
  );
}
function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider-property">
      <div>
        <label>{label}</label>
        <span>{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => useEditorStore.getState().beginTransaction()}
        onPointerUp={() => useEditorStore.getState().endTransaction()}
        onPointerCancel={() => useEditorStore.getState().endTransaction()}
        onKeyDown={() => useEditorStore.getState().beginTransaction()}
        onKeyUp={() => useEditorStore.getState().endTransaction()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
export default function Inspector({
  project,
  clip,
  playhead,
  onUpdate,
  onProjectUpdate,
}: Props) {
  const ui = useUITranslation();
  const [tab, setTab] = useState("화면"),
    [fonts, setFonts] = useState<string[]>([
      "Noto Sans SC",
      "sans-serif",
      "PingFang SC",
      "Arial",
      "Georgia",
    ]);
  useEffect(() => {
    void window.editorAPI
      ?.getFontFamilies()
      .then((fonts) => setFonts(fonts))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setTab(
      clip?.text
        ? "텍스트"
        : project.assets.find((a) => a.id === clip?.assetId)?.kind === "audio"
          ? "오디오"
          : "화면",
    );
  }, [clip?.id, !!clip?.text]);
  if (!clip)
    return (
      <aside className="inspector panel">
        <div className="panel-heading">
          <span>{ui("프로젝트 매개변수", "Project properties")}</span>
          <SlidersHorizontal size={16} />
        </div>
        <div className="inspector-content">
          <h3>{ui("캔버스 설정", "Canvas settings")}</h3>
          <label className="stacked-label">
            {ui("프로젝트 이름", "Project name")}<input
              value={project.name}
              onFocus={() => useEditorStore.getState().beginTransaction()}
              onBlur={() => useEditorStore.getState().endTransaction()}
              onChange={(e) => onProjectUpdate({ name: e.target.value })}
            />
          </label>
          <label className="property-row">
            <span>{ui("종횡비", "Aspect ratio")}</span>
            <select
              aria-label={ui("종횡비", "Aspect ratio")}
              value={`${project.width}:${project.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split(":").map(Number);
                onProjectUpdate({ width, height });
              }}
            >
              {![
                "1920:1080",
                "1080:1920",
                "1080:1080",
                "1440:1080",
                "2560:1440",
                "3840:2160",
              ].includes(`${project.width}:${project.height}`) && (
                <option value={`${project.width}:${project.height}`}>
                  {ui("사용자 정의", "Custom")}</option>
              )}
              <option value="1920:1080">{ui("16:9 · 가로", "16:9 · Landscape")}</option>
              <option value="1080:1920">{ui("9:16 · 세로", "9:16 · Portrait")}</option>
              <option value="1080:1080">{ui("1:1 · 정사각형", "1:1 · Square")}</option>
              <option value="1440:1080">{ui("4:3 · 클래식", "4:3 · Classic")}</option>
              <option value="2560:1440">16:9 · 2K</option>
              <option value="3840:2160">16:9 · 4K</option>
            </select>
          </label>
          <NumberField
            label={ui("너비", "Width")}
            value={project.width}
            min={16}
            max={7680}
            step={2}
            suffix="px"
            onChange={(width) => onProjectUpdate({ width })}
          />
          <NumberField
            label={ui("높이", "Height")}
            value={project.height}
            min={16}
            max={7680}
            step={2}
            suffix="px"
            onChange={(height) => onProjectUpdate({ height })}
          />
          <label className="property-row">
            <span>{ui("프레임 속도", "Frame rate")}</span>
            <select
              aria-label={ui("프레임 속도", "Frame rate")}
              value={project.fps}
              onChange={(e) => onProjectUpdate({ fps: Number(e.target.value) })}
            >
              {[24, 25, 30, 50, 60].map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </select>
          </label>
          <label className="property-row">
            <span>{ui("배경 색상", "Background color")}</span>
            <input
              aria-label={ui("배경 색상", "Background color")}
              type="color"
              value={project.background}
              onChange={(e) => onProjectUpdate({ background: e.target.value })}
            />
            <code>{project.background}</code>
          </label>
          <div className="inspector-guide">
            <Image size={30} />
            <p>{ui("타임라인 클립 선택", "Select a timeline clip")}</p>
            <span>{ui("여기에서 그림, 오디오, 텍스트 및 애니메이션 조정", "Adjust picture, audio, text and animation here")}</span>
          </div>
          <div className="offline-note">
            <span className="status-dot" />
            {ui("재료는 로컬 컴퓨터에 유지되며 프로젝트는 완전히 오프라인입니다.", "Media stays on your device. Projects are entirely offline.")}</div>
        </div>
      </aside>
    );
  const track = project.tracks.find((t) => t.id === clip.trackId)!,
    asset = project.assets.find((a) => a.id === clip.assetId);
  const local = Math.max(0, Math.min(clip.duration, playhead - clip.start)),
    evaluated = evaluateKeyframes(clip, local),
    locked = track.locked;
  const key = (property: Keyframe["property"], value: number) => {
    const at = Math.min(
      clip.duration,
      Math.round(local * project.fps) / project.fps,
    );
    const existing = clip.keyframes.find(
      (k) =>
        k.property === property && Math.abs(k.time - at) < 0.5 / project.fps,
    );
    onUpdate({
      keyframes: existing
        ? clip.keyframes.filter((k) => k.id !== existing.id)
        : [
            ...clip.keyframes,
            { id: id(), property, time: at, value, easing: "linear" },
          ],
    });
  };
  const animate = (property: Keyframe["property"], value: number) => {
    if (clip.keyframes.some((k) => k.property === property)) {
      const at = Math.min(
          clip.duration,
          Math.round(local * project.fps) / project.fps,
        ),
        existing = clip.keyframes.find(
          (k) =>
            k.property === property &&
            Math.abs(k.time - at) < 0.5 / project.fps,
        );
      onUpdate({
        keyframes: existing
          ? clip.keyframes.map((k) =>
              k.id === existing.id ? { ...k, value } : k,
            )
          : [
              ...clip.keyframes,
              { id: id(), property, time: at, value, easing: "linear" },
            ],
      });
    } else if (property === "volume") onUpdate({ volume: value });
    else onUpdate({ transform: { ...clip.transform, [property]: value } });
  };
  const visual = asset?.kind !== "audio";
  const pictureTabs = ["화면", "자르기", "키", "마스크"];
  const pictureActive = pictureTabs.includes(tab);
  const tabs = clip.text
    ? ["텍스트", "화면", "애니메이션", "속도"]
    : visual
      ? ["화면", "오디오", "속도", "애니메이션", "색상 보정"]
      : ["오디오", "속도", "애니메이션"];
  const tabLabel = (value: string) =>
    ui(value === "속도" ? "다양한 속도" : value === "색상 보정" ? "조정" : value,
      ({ "화면": "Picture", "자르기": "Crop", "키": "Chroma key", "마스크": "Mask", "텍스트": "Text", "애니메이션": "Animation", "속도": "Speed", "오디오": "Audio", "색상 보정": "Adjust" } as Record<string, string>)[value] ?? value);
  return (
    <aside className="inspector panel">
      <div className="inspector-tabs">
        <nav className="inspector-main-tabs" aria-label={ui("클립 속성", "Clip properties")}>
          {tabs.map((t) => (
            <button
              key={t}
              aria-label={ui(t, tabLabel(t))}
              aria-pressed={tab === t || (t === "화면" && pictureActive)}
              className={tab === t || (t === "화면" && pictureActive) ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </nav>
        {visual && !clip.text && (
          <nav className="inspector-picture-tabs" aria-label={ui("그림 도구", "Picture tools")} hidden={!pictureActive}>
            {pictureTabs.map((t) => (
              <button
                key={t}
                aria-label={t === "화면" ? ui("기본 그림", "Basic picture") : tabLabel(t)}
                aria-pressed={tab === t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "화면" ? ui("기본", "Basic") : tabLabel(t)}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="inspector-content">
        <div className="clip-info">
          <strong>{clip.name}</strong>
          <span>
            {track.name} · {formatTime(clip.duration, project.fps)}
          </span>
        </div>
        {locked && (
          <div className="inline-warning">{ui("트랙이 잠겨 있으며 잠금 해제 후 편집 가능", "Track locked. Unlock it to edit.")}</div>
        )}
        <fieldset disabled={locked}>
          {["자르기", "키", "마스크"].includes(tab) && (
            <VisualTools
              mode={
                tab === "자르기" ? "crop" : tab === "키" ? "chroma" : "mask"
              }
              clip={clip}
              asset={asset}
              onUpdate={onUpdate}
              locked={locked}
            />
          )}
          {tab === "화면" && (
            <>
              <div className="section-title">
                <h3>{ui("위치 크기", "Position and size")}</h3>
                <button
                  title={ui("변형 재설정", "Reset transform")}
                  onClick={() =>
                    onUpdate({
                      transform: { ...DEFAULT_TRANSFORM },
                      keyframes: clip.keyframes.filter(
                        (k) => k.property === "volume",
                      ),
                    })
                  }
                >
                  <RotateCcw size={13} />
                </button>
              </div>
              <NumberField
                label={ui("크기 조절", "Scale")}
                range
                value={evaluated.transform.scale * 100}
                min={1}
                max={1000}
                suffix="%"
                onChange={(v) => animate("scale", v / 100)}
                diamond={() => key("scale", evaluated.transform.scale)}
              />
              <div className="position-fields">
              <NumberField
                label={ui("위치 X", "Position X")}
                value={evaluated.transform.x}
                onChange={(v) => animate("x", v)}
                diamond={() => key("x", evaluated.transform.x)}
              />
              <NumberField
                label={ui("위치 Y", "Position Y")}
                value={evaluated.transform.y}
                onChange={(v) => animate("y", v)}
                diamond={() => key("y", evaluated.transform.y)}
              />
              </div>
              <NumberField
                label={ui("회전", "Rotation")}
                value={evaluated.transform.rotation}
                min={-3600}
                max={3600}
                suffix="°"
                onChange={(v) => animate("rotation", v)}
                diamond={() => key("rotation", evaluated.transform.rotation)}
              />
              <NumberField
                label={ui("불투명도", "Opacity")}
                value={evaluated.transform.opacity * 100}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => animate("opacity", v / 100)}
                diamond={() => key("opacity", evaluated.transform.opacity)}
              />
              <div className="property-row">
                <span>{ui("뒤집기", "Flip")}</span>
                <div className="segmented">
                  <button
                    className={clip.transform.flipX ? "active" : ""}
                    title={ui("수평 뒤집기", "Flip horizontal")}
                    onClick={() =>
                      onUpdate({
                        transform: {
                          ...clip.transform,
                          flipX: !clip.transform.flipX,
                        },
                      })
                    }
                  >
                    <FlipHorizontal2 size={17} />
                  </button>
                  <button
                    className={clip.transform.flipY ? "active" : ""}
                    title={ui("수직 뒤집기", "Flip vertical")}
                    onClick={() =>
                      onUpdate({
                        transform: {
                          ...clip.transform,
                          flipY: !clip.transform.flipY,
                        },
                      })
                    }
                  >
                    <FlipVertical2 size={17} />
                  </button>
                </div>
              </div>
              <h3>{ui("페이드 인 및 아웃", "Video fades")}</h3>
              <NumberField
                label={ui("페이드 인", "Video fade in")}
                value={clip.fadeIn}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(fadeIn) => onUpdate({ fadeIn })}
              />
              <NumberField
                label={ui("영상 페이드", "Video fade out")}
                value={clip.fadeOut}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(fadeOut) => onUpdate({ fadeOut })}
              />
            </>
          )}
          {tab === "오디오" && (
            <>
              <h3>{ui("볼륨", "Volume")}</h3>
              <NumberField
                label={ui("볼륨", "Volume")}
                value={evaluated.volume * 100}
                min={0}
                max={400}
                suffix="%"
                onChange={(v) => animate("volume", v / 100)}
                diamond={() => key("volume", evaluated.volume)}
              />
              <label className="toggle-property">
                <span>{ui("클립 음소거", "Mute clip")}</span>
                <input
                  aria-label={ui("클립 음소거", "Mute clip")}
                  type="checkbox"
                  checked={clip.muted}
                  onChange={(e) => onUpdate({ muted: e.target.checked })}
                />
              </label>
              <h3>{ui("사운드 페이드 인", "Audio fades")}</h3>
              <NumberField
                label={ui("사운드 페이드 인", "Audio fade in")}
                value={clip.audioFadeIn}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(audioFadeIn) => onUpdate({ audioFadeIn })}
              />
              <NumberField
                label={ui("사운드 페이드 아웃", "Audio fade out")}
                value={clip.audioFadeOut}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(audioFadeOut) => onUpdate({ audioFadeOut })}
              />
              {!asset?.hasAudio && (
                <p className="muted">{ui("이 영상에는 오디오 스트림이 없습니다.", "This media has no audio stream.")}</p>
              )}
            </>
          )}
          {tab === "색상 보정" && (
            <>
              <div className="section-title">
                <h3>{ui("기본 조정", "Basic adjustments")}</h3>
                <button
                  title={ui("색상 보정 재설정", "Reset color adjustments")}
                  onClick={() =>
                    onUpdate({ adjustments: { ...DEFAULT_ADJUSTMENTS } })
                  }
                >
                  <RotateCcw size={13} />
                </button>
              </div>
              <Slider
                label={ui("밝기", "Brightness")}
                value={clip.adjustments.brightness}
                min={-1}
                max={1}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, brightness: v },
                  })
                }
              />
              <Slider
                label={ui("대비", "Contrast")}
                value={clip.adjustments.contrast}
                min={0}
                max={3}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, contrast: v },
                  })
                }
              />
              <Slider
                label={ui("채도", "Saturation")}
                value={clip.adjustments.saturation}
                min={0}
                max={3}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, saturation: v },
                  })
                }
              />
              <Slider
                label={ui("색온도", "Temperature")}
                value={clip.adjustments.temperature}
                min={-1}
                max={1}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, temperature: v },
                  })
                }
              />
              <Slider
                label={ui("흐림", "Blur")}
                value={clip.adjustments.blur}
                min={0}
                max={100}
                step={1}
                onChange={(v) =>
                  onUpdate({ adjustments: { ...clip.adjustments, blur: v } })
                }
              />
              <p className="field-hint">
                {ui("미리보기 및 내보내기는 동일한 RGB \n 조정 모델을 사용하므로 인코딩 및 색상 변환은 약간의 차이가 발생할 수 있습니다.", "Preview and export use the same RGB adjustment model. Encoding and color conversion may cause slight differences.")}</p>
            </>
          )}
          {tab === "텍스트" && clip.text && (
            <>
              <h3>{ui("텍스트 내용", "Text content")}</h3>
              <textarea
                aria-label={ui("텍스트 내용", "Text content")}
                value={clip.text.text}
                rows={4}
                onFocus={() => useEditorStore.getState().beginTransaction()}
                onBlur={() => useEditorStore.getState().endTransaction()}
                onChange={(e) =>
                  onUpdate({
                    name: e.target.value.slice(0, 30) || ui("텍스트", "Text"),
                    text: { ...clip.text!, text: e.target.value },
                  })
                }
              />
              <label className="property-row">
                <span>{ui("글꼴", "Font")}</span>
                <select
                  aria-label={ui("글꼴", "Font")}
                  value={clip.text.fontFamily}
                  onChange={(e) =>
                    onUpdate({
                      text: { ...clip.text!, fontFamily: e.target.value },
                    })
                  }
                >
                  <option value="sans-serif">{ui("시스템 기본값", "System default")}</option>
                  {fonts
                    .filter((f) => f !== "sans-serif")
                    .map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                </select>
              </label>
              <NumberField
                label={ui("글꼴 크기", "Font size")}
                value={clip.text.fontSize}
                min={1}
                max={1000}
                suffix="px"
                onChange={(fontSize) =>
                  onUpdate({ text: { ...clip.text!, fontSize } })
                }
              />
              <label className="property-row">
                <span>{ui("텍스트 색상", "Text color")}</span>
                <input
                  aria-label={ui("텍스트 색상", "Text color")}
                  type="color"
                  value={clip.text.color}
                  onChange={(e) =>
                    onUpdate({ text: { ...clip.text!, color: e.target.value } })
                  }
                />
                <button
                  className={clip.text.bold ? "active" : ""}
                  title={ui("굵게", "Bold")}
                  onClick={() =>
                    onUpdate({
                      text: { ...clip.text!, bold: !clip.text!.bold },
                    })
                  }
                >
                  <b>B</b>
                </button>
              </label>
              <div className="property-row">
                <span>{ui("정렬", "Alignment")}</span>
                <div className="segmented">
                  {(["left", "center", "right"] as const).map((align, i) => (
                    <button
                      key={align}
                      title={[ui("왼쪽 정렬", "Align left"), ui("가운데", "Center"), ui("오른쪽 정렬", "Align right")][i]}
                      className={clip.text!.align === align ? "active" : ""}
                      onClick={() =>
                        onUpdate({ text: { ...clip.text!, align } })
                      }
                    >
                      {i === 0 ? (
                        <AlignLeft size={16} />
                      ) : i === 1 ? (
                        <AlignCenter size={16} />
                      ) : (
                        <AlignRight size={16} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <h3>{ui("획 및 배경", "Outline and background")}</h3>
              <label className="property-row">
                <span>{ui("획 색상", "Outline color")}</span>
                <input
                  aria-label={ui("획 색상", "Outline color")}
                  type="color"
                  value={clip.text.stroke}
                  onChange={(e) =>
                    onUpdate({
                      text: { ...clip.text!, stroke: e.target.value },
                    })
                  }
                />
              </label>
              <NumberField
                label={ui("획 너비", "Outline width")}
                value={clip.text.strokeWidth}
                min={0}
                max={100}
                onChange={(strokeWidth) =>
                  onUpdate({ text: { ...clip.text!, strokeWidth } })
                }
              />
              <label className="toggle-property">
                <span>{ui("텍스트 배경", "Text background")}</span>
                <input
                  type="checkbox"
                  aria-label={ui("텍스트 배경", "Text background")}
                  checked={clip.text.background !== "transparent"}
                  onChange={(e) =>
                    onUpdate({
                      text: {
                        ...clip.text!,
                        background: e.target.checked
                          ? "#15151c"
                          : "transparent",
                      },
                    })
                  }
                />
              </label>
              {clip.text.background !== "transparent" && (
                <input
                  type="color"
                  aria-label={ui("텍스트 배경색", "Text background color")}
                  value={clip.text.background}
                  onChange={(e) =>
                    onUpdate({
                      text: { ...clip.text!, background: e.target.value },
                    })
                  }
                />
              )}
            </>
          )}
          {tab === "속도" && (
            <>
              <h3>{ui("일반 가변 속도", "Constant speed")}</h3>
              <NumberField
                label={ui("재생 속도", "Playback speed")}
                value={clip.speed}
                min={0.1}
                max={8}
                step={0.1}
                suffix="×"
                onChange={(speed) => onUpdate({ speed })}
              />
              <div className="speed-presets">
                {[0.25, 0.5, 1, 1.5, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    className={clip.speed === speed ? "active" : ""}
                    onClick={() => onUpdate({ speed })}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
              <p className="field-hint">
                {ui("가변 속도를 변경하면 소스 자료 범위가 유지되고 클립 지속 시간이 조정됩니다. 오디오는 피치를 유지합니다.", "Changing speed preserves the source range and adjusts clip duration. Audio pitch is preserved.")}</p>
              <h3>{ui("시간 범위", "Time range")}</h3>
              <NumberField
                label={ui("시작 시간", "Start time")}
                value={clip.start}
                min={0}
                step={1 / project.fps}
                suffix="s"
                onChange={(start) => onUpdate({ start })}
              />
              <NumberField
                label={ui("소스 소재 입력 지점", "Source in point")}
                value={clip.sourceIn}
                min={0}
                max={Math.max(
                  0,
                  (asset?.duration ?? 0) - clip.duration * clip.speed,
                )}
                step={1 / project.fps}
                suffix="s"
                onChange={(sourceIn) => onUpdate({ sourceIn })}
              />
              <p className="muted small">
                {ui("타임라인에서 클립의 양쪽을 드래그하여 입력 및 출력 지점을 자릅니다.", "Drag either edge of a timeline clip to trim its in and out points.")}</p>
            </>
          )}
          {tab === "애니메이션" && (
            <>
              <KeyframeCurveEditor
                key={clip.id}
                project={project}
                clip={clip}
                playhead={playhead}
                visual={visual}
                onUpdate={onUpdate}
              />
              <h3>{ui("키프레임 목록", "Keyframe list")}</h3>
              <p className="field-hint">
                {ui("재생헤드를 대상 시간으로 이동하고 속성 옆에 있는 ◇\n을 클릭하여 키프레임을 추가합니다. 이 속성을 이후에 조정하면 현재 시간이 기록됩니다.", "Move the playhead to the desired time and click ◇ beside a property to add a keyframe. Subsequent edits to that property are recorded at the current time.")}</p>
              <div className="keyframe-add">
                {(["x", "y", "scale", "rotation", "opacity", "volume"] as const)
                  .filter((property) => visual || property === "volume")
                  .map((property) => (
                    <button
                      key={property}
                      onClick={() =>
                        key(
                          property,
                          property === "volume"
                            ? evaluated.volume
                            : evaluated.transform[property],
                        )
                      }
                    >
                      <Diamond size={11} />
                      {
                        {
                          x: ui("위치 X", "Position X"),
                          y: ui("위치 Y", "Position Y"),
                          scale: ui("크기 조절", "Scale"),
                          rotation: ui("회전", "Rotation"),
                          opacity: ui("투명도", "Opacity"),
                          volume: ui("볼륨", "Volume"),
                        }[property]
                      }
                    </button>
                  ))}
              </div>
              {!clip.keyframes.length && (
                <div className="quiet-empty">{ui("아직 키프레임 없음", "No keyframes yet")}</div>
              )}
              {[...clip.keyframes]
                .sort((a, b) => a.time - b.time)
                .map((k) => (
                  <div key={k.id} className="keyframe-row">
                    <button
                      className="keyframe-time"
                      onClick={() =>
                        useEditorStore.getState().seek(clip.start + k.time)
                      }
                    >
                      {formatTime(k.time, project.fps)}
                    </button>
                    <span>{k.property}</span>
                    <input
                      aria-label={ui(`키프레임 ${k.property} 값`, `${k.property} keyframe value`)}
                      type="number"
                      step={0.01}
                      value={k.value}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (
                          Number.isFinite(value) &&
                          !(
                            k.property === "opacity" &&
                            (value < 0 || value > 1)
                          ) &&
                          !(
                            k.property === "scale" &&
                            (value <= 0 || value > 10)
                          ) &&
                          !(k.property === "volume" && (value < 0 || value > 4))
                        )
                          onUpdate({
                            keyframes: clip.keyframes.map((key) =>
                              key.id === k.id ? { ...key, value } : key,
                            ),
                          });
                      }}
                    />
                    <select
                      aria-label={ui("키프레임 보간", "Keyframe interpolation")}
                      value={k.easing}
                      onChange={(e) =>
                        onUpdate({
                          keyframes: clip.keyframes.map((key) =>
                            key.id === k.id
                              ? {
                                  ...key,
                                  easing: e.target.value as Keyframe["easing"],
                                  easingWindow: undefined,
                                }
                              : key,
                          ),
                        })
                      }
                    >
                      <option value="linear">{ui("선형", "Linear")}</option>
                      <option value="easeIn">{ui("감속", "Ease in")}</option>
                      <option value="easeOut">{ui("감속", "Ease out")}</option>
                      <option value="easeInOut">{ui("간편한 입력 및 축소", "Ease in/out")}</option>
                    </select>
                    <button
                      aria-label={ui("키프레임 삭제", "Delete keyframe")}
                      onClick={() =>
                        onUpdate({
                          keyframes: clip.keyframes.filter(
                            (key) => key.id !== k.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </>
          )}
        </fieldset>
      </div>
    </aside>
  );
}
