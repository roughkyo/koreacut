import { useUITranslation } from "../i18n";
import type {
  SubtitleAnimation,
  SubtitleStyleValues,
} from "../core/subtitleWorkflow";
const motions = [
  ["none", "없음", "None"],
  ["fade", "페이드 인/아웃", "Fade in / out"],
  ["slide-up", "위로 스와이프 + 페이드 인 및 아웃", "Slide up + fade"],
  ["zoom", "줌 + 페이드 인 및 아웃", "Zoom + fade"],
] as const;
export function SubtitleAnimationForm({
  value,
  onChange,
}: {
  value: SubtitleAnimation;
  onChange(v: SubtitleAnimation): void;
}) {
  const ui = useUITranslation();
  return (
    <div className="subtitle-options">
      {(["entrance", "exit"] as const).map((phase, i) => (
        <label key={phase}>
          {i ? ui("애니메이션 종료", "Exit animation") : ui("입국 애니메이션", "Entrance animation")}
          <select
            aria-label={i ? ui("자막 종료 애니메이션", "Subtitle exit animation") : ui("자막 입력 애니메이션", "Subtitle entrance animation")}
            value={value[phase]}
            onChange={(e) => onChange({ ...value, [phase]: e.target.value })}
          >
            {motions.map(([key, label, english]) => (
              <option key={key} value={key}>
                {ui(label, english)}
              </option>
            ))}
          </select>
        </label>
      ))}
      {(["inDuration", "outDuration"] as const).map((field, i) => (
        <label key={field}>
          {i ? ui("종료 시간", "Exit duration (seconds)") : ui("입력 시간", "Entrance duration (seconds)")}
          <input
            aria-label={i ? ui("자막 종료 시간", "Subtitle exit duration") : ui("자막 입력 시간", "Subtitle entrance duration")}
            type="number"
            min="0"
            max="60"
            step="0.05"
            value={value[field]}
            onChange={(e) =>
              onChange({ ...value, [field]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <label>
        {ui("슬라이딩 거리(항목 픽셀)", "Slide distance (project pixels)")}
        <input
          aria-label={ui("자막 슬라이딩 거리", "Subtitle slide distance")}
          type="number"
          min="0"
          max="10000"
          value={value.distance}
          onChange={(e) =>
            onChange({ ...value, distance: Number(e.target.value) })
          }
        />
      </label>
      <label>
        {ui("스테이 애니메이션", "Hold animation")}
        <select
          aria-label={ui("자막 스테이 애니메이션", "Subtitle hold animation")}
          value={value.hold ?? "still"}
          onChange={(e) =>
            onChange({ ...value, hold: e.target.value as "still" | "pulse" })
          }
        >
          <option value="still">{ui("스틸", "Still")}</option>
          <option value="pulse">{ui("1호흡 스케일링", "Single pulse zoom")}</option>
        </select>
      </label>
      <label>
        {ui("호흡 증폭(%)", "Pulse zoom amount (%)")}
        <input
          aria-label={ui("자막 호흡 범위", "Subtitle pulse amount")}
          type="number"
          min="0"
          max="50"
          step="1"
          disabled={value.hold !== "pulse"}
          value={(value.pulseAmount ?? 0.08) * 100}
          onChange={(e) =>
            onChange({ ...value, pulseAmount: Number(e.target.value) / 100 })
          }
        />
      </label>
      <p className="subtitle-hint">
        {ui("드웰 = 각 자막 길이 − 진입 − 나와서 1프레임 이상 가만히 있고 2프레임 이상 호흡합니다. 앱이 Y/크기/투명도 키프레임 및 페이드를 대체합니다. 위치 X, 회전이 유지됩니다. 결과는 애니메이션 곡선에서 추가로 편집할 수 있습니다. 이 표의 매개변수는 다음 애플리케이션에 사용되며 기존 곡선에서 사전 설정되지 않습니다.", "Hold = subtitle duration − entrance − exit. Still requires at least one frame; pulse requires two. Applying replaces Y, scale and opacity keyframes and visual fades, preserving X and rotation. Continue editing under Animation curves. These settings apply to the next operation; existing curves are not converted back to presets.")}
      </p>
    </div>
  );
}
export function SubtitleStyleForm({
  value,
  onChange,
}: {
  value: SubtitleStyleValues;
  onChange(v: SubtitleStyleValues): void;
}) {
  const ui = useUITranslation();
  return (
    <div className="subtitle-options">
      <label>
        {ui("글꼴 크기", "Font size")}
        <input
          aria-label={ui("자막 글꼴 크기 일괄", "Batch subtitle font size")}
          type="number"
          min="1"
          max="1000"
          value={value.fontSize}
          onChange={(e) =>
            onChange({ ...value, fontSize: Number(e.target.value) })
          }
        />
      </label>
      <label>
        {ui("텍스트 색상", "Text color")}
        <input
          aria-label={ui("자막 색상 일괄", "Batch subtitle color")}
          type="color"
          value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
        />
      </label>
      <label>
        {ui("획 색상", "Outline color")}
        <input
          aria-label={ui("자막 획 색상 일괄", "Batch subtitle outline color")}
          type="color"
          value={value.stroke}
          onChange={(e) => onChange({ ...value, stroke: e.target.value })}
        />
      </label>
      <label>
        {ui("획 너비", "Outline width")}
        <input
          aria-label={ui("자막 획 너비", "Batch subtitle outline width")}
          type="number"
          min="0"
          max="100"
          value={value.strokeWidth}
          onChange={(e) =>
            onChange({ ...value, strokeWidth: Number(e.target.value) })
          }
        />
      </label>
      <label>
        {ui("배경(투명 또는 16진수 색상)", "Background (transparent or hex color)")}
        <input
          aria-label={ui("자막 배경 일괄", "Batch subtitle background")}
          value={value.background}
          onChange={(e) => onChange({ ...value, background: e.target.value })}
        />
      </label>
      <label>
        {ui("정렬", "Alignment")}
        <select
          aria-label={ui("자막 일괄 정렬", "Batch subtitle alignment")}
          value={value.align}
          onChange={(e) =>
            onChange({
              ...value,
              align: e.target.value as SubtitleStyleValues["align"],
            })
          }
        >
          <option value="left">{ui("왼쪽 정렬", "Left")}</option>
          <option value="center">{ui("가운데", "Center")}</option>
          <option value="right">{ui("오른쪽 정렬", "Right")}</option>
        </select>
      </label>
      <label>
        <input
          aria-label={ui("일괄 자막 굵게", "Batch subtitle bold")}
          type="checkbox"
          checked={value.bold}
          onChange={(e) => onChange({ ...value, bold: e.target.checked })}
        />
        {ui("굵게", "Bold")}
      </label>
      <p className="subtitle-hint">
        {ui("위 필드를 적용하고 각 자막의 글꼴, 사본, 위치, 시간 및 애니메이션을 유지합니다. 글꼴을 통일해야 할 경우 \"통합 스타일\" 참조 자막을 사용할 수 있습니다.", "Apply these fields while keeping each subtitle’s font family, text, position, timing and animation. To copy a font family, choose a reference subtitle under Match style.")}
      </p>
    </div>
  );
}
