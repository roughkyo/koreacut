import { clone, id, snapToFrame, splitClip } from "./model";
import type { Clip, Keyframe, Project, TextStyle } from "./types";

export const TEXT_MOTIONS = ["none", "fade", "slide-up", "zoom"] as const;
export type TextMotion = (typeof TEXT_MOTIONS)[number];
export interface SubtitleAnimation {
  entrance: TextMotion;
  exit: TextMotion;
  inDuration: number;
  outDuration: number;
  distance: number;
  hold?: "still" | "pulse";
  pulseAmount?: number;
}
export type SubtitleStyleValues = Pick<
  TextStyle,
  | "fontSize"
  | "color"
  | "background"
  | "bold"
  | "align"
  | "stroke"
  | "strokeWidth"
>;
export const SUBTITLE_STYLE_FIELDS = [
  "fontSize",
  "color",
  "background",
  "bold",
  "align",
  "stroke",
  "strokeWidth",
] as const;

/** Bake editable ordinary keys; preview, export, trim and persistence need no new renderer. */
export function subtitleAnimation(
  clip: Clip,
  options: SubtitleAnimation,
  fps: number,
): Clip {
  if (
    !TEXT_MOTIONS.includes(options.entrance) ||
    !TEXT_MOTIONS.includes(options.exit)
  )
    throw new Error("지원되지 않는 텍스트 애니메이션");
  for (const value of [options.inDuration, options.outDuration])
    if (!Number.isFinite(value) || value < 0 || value > 60)
      throw new Error("입력/종료 시간은 0~60초여야 합니다.");
  if (
    !Number.isFinite(options.distance) ||
    options.distance < 0 ||
    options.distance > 10000
  )
    throw new Error("슬라이딩 거리는 0~10000이어야 합니다. 픽셀");
  const hold = options.hold ?? "still",
    pulseAmount = options.pulseAmount ?? 0.08;
  if (
    !["still", "pulse"].includes(hold) ||
    !Number.isFinite(pulseAmount) ||
    pulseAmount < 0 ||
    pulseAmount > 0.5
  )
    throw new Error("체재 애니메이션 또는 호흡 진폭이 유효하지 않습니다(0~50%)");
  const enter =
    options.entrance === "none" ? 0 : snapToFrame(options.inDuration, fps);
  const exit =
    options.exit === "none" ? 0 : snapToFrame(options.outDuration, fps);
  if (
    (options.entrance !== "none" && enter < 1 / fps - 1e-9) ||
    (options.exit !== "none" && exit < 1 / fps - 1e-9)
  )
    throw new Error("활성화된 애니메이션에는 최소 1프레임이 필요합니다.");
  if ((enter || exit) && enter + exit > clip.duration - 1 / fps + 1e-9)
    throw new Error(
      `자막 "${clip.text?.text.slice(0, 20)}"가 너무 짧습니다: 진입 및 퇴장 후 최소 1프레임의 체류가 남아 있어야 하며 수정된 자막이 없습니다.`,
    );
  const holdEnd = clip.duration - exit,
    midpoint = snapToFrame((enter + holdEnd) / 2, fps);
  if (
    hold === "pulse" &&
    (holdEnd - enter < 2 / fps - 1e-9 ||
      midpoint <= enter ||
      midpoint >= holdEnd)
  )
    throw new Error("호흡 애니메이션에는 최소 2프레임의 체류가 필요하며 수정이 이루어지지 않았습니다. 자막");
  const result = clone(clip);
  result.fadeIn = result.fadeOut = 0;
  delete result.videoFadeWindow;
  result.keyframes = result.keyframes.filter(
    (k) => !["y", "scale", "opacity"].includes(k.property),
  );
  if (
    options.entrance === "none" &&
    options.exit === "none" &&
    hold === "still"
  )
    return result;
  for (const property of ["y", "scale", "opacity"] as const) {
    const base = clip.transform[property];
    const endpoint = (motion: TextMotion, incoming: boolean) =>
      property === "opacity"
        ? motion === "none"
          ? base
          : 0
        : property === "scale"
          ? base * (motion === "zoom" ? 0.8 : 1)
          : base +
            (motion === "slide-up"
              ? (incoming ? 1 : -1) * options.distance
              : 0);
    const points: [number, number, Keyframe["easing"]][] = [
      [0, endpoint(options.entrance, true), "linear"],
    ];
    if (enter) points.push([enter, base, "easeOut"]);
    const pulse = hold === "pulse" && property === "scale";
    if (pulse) points.push([midpoint, base * (1 + pulseAmount), "easeInOut"]);
    if (exit) points.push([holdEnd, base, pulse ? "easeInOut" : "linear"]);
    points.push([
      clip.duration,
      endpoint(options.exit, false),
      pulse && !exit ? "easeInOut" : "easeIn",
    ]);
    result.keyframes.push(
      ...points.map(([time, value, easing]) => ({
        id: id(),
        time,
        value,
        easing,
        property,
      })),
    );
  }
  return result;
}

export function splitSubtitle(
  project: Project,
  clip: Clip,
  at: number,
  offset: number,
): Project {
  if (clip.linkId) throw new Error("먼저 연결을 해제한 다음 자막을 분할하십시오.");
  if (!Number.isFinite(at)) throw new Error("재생 헤드 시간 유효하지 않습니다");
  const time = snapToFrame(at, project.fps);
  if (
    time - clip.start < 1 / project.fps - 1e-9 ||
    clip.start + clip.duration - time < 1 / project.fps - 1e-9
  )
    throw new Error("재생 헤드는 자막 내부에 있어야 하며 양쪽에 최소 한 프레임 이상 있어야 합니다");
  const content = clip.text!.text;
  const boundaries = [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      content,
    ),
  ].map((s) => s.index);
  if (
    !Number.isInteger(offset) ||
    offset <= 0 ||
    offset >= content.length ||
    !boundaries.includes(offset) ||
    !content.slice(0, offset).trim() ||
    !content.slice(offset).trim()
  )
    throw new Error("텍스트 커서를 복사 중간에 위치시키십시오. 결합된 문자나 표현을 열지 마십시오");
  const result = splitClip(project, clip.id, time),
    originalIds = new Set(project.clips.map((c) => c.id));
  const left = result.clips.find((c) => c.id === clip.id)!,
    right = result.clips.find((c) => !originalIds.has(c.id));
  if (!right) throw new Error("이 자막은 분할될 수 없습니다");
  for (const [c, value] of [
    [left, content.slice(0, offset)],
    [right, content.slice(offset)],
  ] as const) {
    c.text = { ...c.text!, text: value };
    c.name = value.slice(0, 4096);
  }
  return result;
}

/** Consecutive list entries merge across gaps/overlaps; the first cue owns appearance. */
export function mergeSubtitles(project: Project, clips: Clip[]): Project {
  if (clips.length < 2) throw new Error("인접한 자막을 2 개 이상 선택하십시오");
  if (clips.some((c) => c.linkId)) throw new Error("먼저 연결을 해제한 후 자막을 병합하세요.");
  const ordered = project.clips
    .filter((c) => c.trackId === clips[0].trackId && c.text)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const ids = new Set(clips.map((c) => c.id)),
    selected = ordered.filter((c) => ids.has(c.id));
  const index = ordered.indexOf(selected[0]);
  if (
    !ordered.slice(index, index + selected.length).every((c) => ids.has(c.id))
  )
    throw new Error("선택한 자막은 현재 트랙 목록에서 연속되어야 하며 선택하지 않은 자막에 걸쳐 있을 수 없습니다.");
  const first = selected[0],
    content = selected.map((c) => c.text!.text).join("\n");
  if (content.length > 20000) throw new Error("병합된 길이가 20,000 단어를 초과합니다.");
  const end = Math.max(...selected.map((c) => c.start + c.duration)),
    duration = end - first.start,
    ratio = duration / first.duration;
  const merged = clone(first);
  merged.duration = duration;
  merged.text!.text = content;
  merged.name = content.slice(0, 4096);
  merged.keyframes = merged.keyframes.map((k) => ({
    ...k,
    time: k.time * ratio,
  }));
  for (const field of [
    "fadeIn",
    "fadeOut",
    "audioFadeIn",
    "audioFadeOut",
  ] as const)
    merged[field] *= ratio;
  for (const field of ["videoFadeWindow", "audioFadeWindow"] as const)
    if (merged[field]) {
      const w = merged[field]!;
      for (const k of ["duration", "offset", "fadeIn", "fadeOut"] as const)
        w[k] *= ratio;
    }
  return {
    ...project,
    clips: project.clips.flatMap((c) =>
      c.id === first.id ? [merged] : ids.has(c.id) ? [] : [c],
    ),
  };
}
