import { EASINGS, easingProgress } from "./easing";
import type {
  Clip,
  MediaAsset,
  Project,
  TrackKind,
  Track,
  Keyframe,
  FadeWindow,
} from "./types";
import {
  DEFAULT_TRANSFORM,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TEXT,
} from "./defaults";
export const id = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);
export const snapToFrame = (time: number, fps: number) =>
  Math.round(time * fps) / fps;
export const projectDuration = (project: Project): number =>
  project.clips.reduce(
    (end, clip) => Math.max(end, clip.start + clip.duration),
    0,
  );
export function createProject(name = "제목 없는 프로젝트"): Project {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: id(),
    name,
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#101015",
    assets: [],
    tracks: [
      createTrack("text", "텍스트"),
      createTrack("video", "비디오 1"),
      createTrack("audio", "오디오 1"),
    ],
    clips: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function createTrack(kind: TrackKind, name?: string): Track {
  return {
    id: id(),
    kind,
    name:
      name ??
      { video: "영상", image: "화면", audio: "오디오", text: "텍스트" }[kind],
    muted: false,
    hidden: false,
    locked: false,
  };
}
export function createClip(
  asset: MediaAsset | undefined,
  trackId: string,
  start: number,
  fps: number,
): Clip {
  return {
    id: id(),
    trackId,
    assetId: asset?.id,
    name: asset?.name ?? "기본 텍스트",
    start: snapToFrame(Math.max(0, start), fps),
    duration:
      asset?.kind === "image" || !asset ? 5 : Math.max(1 / fps, asset.duration),
    sourceIn: 0,
    speed: 1,
    volume: 1,
    muted: false,
    transform: { ...DEFAULT_TRANSFORM },
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    text: !asset ? { ...DEFAULT_TEXT } : undefined,
    fadeIn: 0,
    fadeOut: 0,
    audioFadeIn: 0,
    audioFadeOut: 0,
    keyframes: [],
  };
}
/** Fade time is in clip-local timeline seconds; cut windows preserve the original envelope. */
export function fadeWindow(clip: Clip, kind: "video" | "audio"): FadeWindow {
  return kind === "video"
    ? (clip.videoFadeWindow ?? {
        offset: 0,
        duration: clip.duration,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
      })
    : (clip.audioFadeWindow ?? {
        offset: 0,
        duration: clip.duration,
        fadeIn: clip.audioFadeIn,
        fadeOut: clip.audioFadeOut,
      });
}
export function evaluateFade(
  clip: Clip,
  time: number,
  kind: "video" | "audio",
): number {
  const window = fadeWindow(clip, kind),
    local = window.offset + time;
  const incoming =
    window.fadeIn > 0 ? Math.max(0, Math.min(1, local / window.fadeIn)) : 1;
  const outgoing =
    window.fadeOut > 0
      ? Math.max(0, Math.min(1, (window.duration - local) / window.fadeOut))
      : 1;
  return incoming * outgoing;
}
function preserveFades(original: Clip, next: Clip, offset: number): void {
  for (const kind of ["video", "audio"] as const) {
    const window = fadeWindow(original, kind);
    if (window.fadeIn > 0 || window.fadeOut > 0)
      next[kind === "video" ? "videoFadeWindow" : "audioFadeWindow"] = {
        ...window,
        offset: window.offset + offset,
      };
  }
}
export function splitClip(
  project: Project,
  clipId: string,
  time: number,
): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (
    !Number.isFinite(time) ||
    !clip ||
    project.tracks.find((t) => t.id === clip.trackId)?.locked
  )
    return project;
  const at = snapToFrame(time, project.fps),
    leftDuration = at - clip.start;
  if (
    leftDuration < 1 / project.fps - 1e-9 ||
    clip.duration - leftDuration < 1 / project.fps - 1e-9
  )
    return project;
  const right: Clip = {
    ...clone(clip),
    id: id(),
    start: at,
    duration: clip.duration - leftDuration,
    sourceIn: clip.sourceIn + leftDuration * clip.speed,
    fadeIn: 0,
    audioFadeIn: 0,
    keyframes: sliceKeyframes(clip, leftDuration, clip.duration),
  };
  const left = {
    ...clip,
    duration: leftDuration,
    fadeOut: 0,
    audioFadeOut: 0,
    keyframes: sliceKeyframes(clip, 0, leftDuration),
  };
  preserveFades(clip, left, 0);
  preserveFades(clip, right, leftDuration);
  for (const field of [
    "fadeIn",
    "fadeOut",
    "audioFadeIn",
    "audioFadeOut",
  ] as const) {
    left[field] = Math.min(left[field], left.duration);
    right[field] = Math.min(right[field], right.duration);
  }
  return {
    ...project,
    clips: project.clips.flatMap((c) =>
      c.id === clipId ? [left, right] : [c],
    ),
  };
}
export function trimClip(
  project: Project,
  clipId: string,
  edge: "start" | "end",
  time: number,
): Project {
  const original = project.clips.find((c) => c.id === clipId);
  if (
    !Number.isFinite(time) ||
    !original ||
    project.tracks.find((t) => t.id === original.trackId)?.locked
  )
    return project;
  const clip = clone(original),
    asset = project.assets.find((a) => a.id === clip.assetId);
  const min = 1 / project.fps,
    at = snapToFrame(time, project.fps);
  if (edge === "start") {
    const lower =
      asset && asset.kind !== "image"
        ? Math.max(0, clip.start - clip.sourceIn / clip.speed)
        : 0;
    const next = Math.max(
      lower,
      Math.min(at, clip.start + clip.duration - min),
    );
    const delta = next - clip.start;
    clip.sourceIn = Math.max(0, clip.sourceIn + delta * clip.speed);
    clip.duration -= delta;
    clip.start = next;
    clip.keyframes = sliceKeyframes(original, delta, original.duration);
  } else {
    const max =
      asset && asset.kind !== "image"
        ? clip.start + (asset.duration - clip.sourceIn) / clip.speed
        : Infinity;
    clip.duration = Math.max(min, Math.min(at, max) - clip.start);
    clip.keyframes = sliceKeyframes(original, 0, clip.duration);
  }
  preserveFades(original, clip, clip.start - original.start);
  for (const field of [
    "fadeIn",
    "fadeOut",
    "audioFadeIn",
    "audioFadeOut",
  ] as const)
    clip[field] = Math.min(clip[field], clip.duration);
  if (clip.start === original.start && clip.duration === original.duration)
    return project;
  return {
    ...project,
    clips: project.clips.map((c) => (c.id === clipId ? clip : c)),
  };
}
export function changeClipSpeed(
  project: Project,
  clipId: string,
  speed: number,
): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (
    !clip ||
    project.tracks.find((t) => t.id === clip.trackId)?.locked ||
    !Number.isFinite(speed) ||
    speed < 0.1 ||
    speed > 8 ||
    speed === clip.speed
  )
    return project;
  const ratio = clip.speed / speed;
  const next = {
    ...clip,
    speed,
    duration: clip.duration * ratio,
    keyframes: clip.keyframes.map((k) => ({ ...k, time: k.time * ratio })),
    fadeIn: clip.fadeIn * ratio,
    fadeOut: clip.fadeOut * ratio,
    audioFadeIn: clip.audioFadeIn * ratio,
    audioFadeOut: clip.audioFadeOut * ratio,
  };
  for (const field of ["videoFadeWindow", "audioFadeWindow"] as const)
    if (clip[field]) {
      const w = clip[field]!;
      next[field] = {
        offset: w.offset * ratio,
        duration: w.duration * ratio,
        fadeIn: w.fadeIn * ratio,
        fadeOut: w.fadeOut * ratio,
      };
    }
  return {
    ...project,
    clips: project.clips.map((c) => (c.id === clipId ? next : c)),
  };
}

/** Each destination key owns the interpolation for the interval ending at it. */
function orderedKeys(clip: Clip, property: Keyframe["property"]): Keyframe[] {
  const keys = clip.keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time);
  return keys.filter(
    (k, i) => i === keys.length - 1 || keys[i + 1].time !== k.time,
  );
}
/** Remap an interval of a smoothstep curve without changing its values or shape. */
function sliceKeyframes(clip: Clip, from: number, to: number): Keyframe[] {
  const result: Keyframe[] = [];
  for (const property of [
    "x",
    "y",
    "scale",
    "rotation",
    "opacity",
    "volume",
  ] as const) {
    const keys = orderedKeys(clip, property);
    if (!keys.length) continue;
    const times = [
      ...new Set([
        from,
        ...keys.filter((k) => k.time > from && k.time < to).map((k) => k.time),
        to,
      ]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) {
      const at = times[i],
        evaluated = evaluateKeyframes(clip, at);
      const value =
        property === "volume"
          ? evaluated.volume
          : evaluated.transform[property];
      const key: Keyframe = {
        id: id(),
        time: at - from,
        property,
        value,
        easing: "linear",
      };
      if (i > 0) {
        const previous = times[i - 1],
          midpoint = (previous + at) / 2;
        const rightIndex = keys.findIndex((k) => k.time > midpoint);
        if (rightIndex > 0) {
          const left = keys[rightIndex - 1],
            right = keys[rightIndex];
          key.easing = right.easing;
          if (right.easing !== "linear") {
            const window = right.easingWindow ?? { start: 0, end: 1 },
              span = right.time - left.time;
            const start =
              window.start +
              ((window.end - window.start) * (previous - left.time)) / span;
            const end =
              window.start +
              ((window.end - window.start) * (at - left.time)) / span;
            if (start > 0 || end < 1)
              key.easingWindow = {
                start: Math.max(0, start),
                end: Math.min(1, end),
              };
          }
        }
      }
      result.push(key);
    }
  }
  return result;
}
export function evaluateKeyframes(clip: Clip, time: number): Clip {
  const result = { ...clip, transform: { ...clip.transform } };
  for (const property of [
    "x",
    "y",
    "scale",
    "rotation",
    "opacity",
    "volume",
  ] as const) {
    const keys = orderedKeys(clip, property);
    if (!keys.length) continue;
    let value = keys[0].value;
    if (time >= keys[keys.length - 1].time) value = keys[keys.length - 1].value;
    else
      for (let i = 0; i < keys.length - 1; i++)
        if (time >= keys[i].time && time <= keys[i + 1].time) {
          let ratio =
            (time - keys[i].time) / (keys[i + 1].time - keys[i].time || 1);
          ratio = easingProgress(keys[i + 1], ratio);
          value = keys[i].value + (keys[i + 1].value - keys[i].value) * ratio;
          break;
        }
    if (property === "volume") result.volume = value;
    else result.transform[property] = value;
  }
  return result;
}
export function formatTime(time: number, fps = 30) {
  const frames = Math.max(0, Math.round(time * fps));
  const f = frames % fps,
    seconds = Math.floor(frames / fps);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
    f,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
/** Validate external project data without numeric coercion or defaulting missing fields. */
export function validateProject(input: unknown): Project {
  const fail = (name: string): never => {
    throw new Error(`프로젝트 ${name} 유효하지 않음`);
  };
  const object = (value: unknown, name: string): Record<string, unknown> => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      fail(name);
    return value as Record<string, unknown>;
  };
  const str = (
    value: unknown,
    name: string,
    max = 4096,
    empty = false,
  ): string => {
    if (
      typeof value !== "string" ||
      value.length > max ||
      (!empty && !value.length) ||
      value.includes("\0")
    )
      fail(name);
    return value as string;
  };
  const num = (
    value: unknown,
    name: string,
    low = -1e9,
    high = 1e9,
  ): number => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < low ||
      value > high
    )
      fail(name);
    return value as number;
  };
  const bool = (value: unknown, name: string): void => {
    if (typeof value !== "boolean") fail(name);
  };
  const list = (value: unknown, name: string, max: number): unknown[] => {
    if (!Array.isArray(value) || value.length > max) fail(name);
    return value as unknown[];
  };
  const choice = (
    value: unknown,
    choices: readonly string[],
    name: string,
  ): void => {
    if (typeof value !== "string" || !choices.includes(value)) fail(name);
  };
  const color = (value: unknown, name: string): void => {
    str(value, name, 32);
    if (
      !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value as string) &&
      !/^(black|white|red|green|blue|transparent)$/i.test(value as string)
    )
      fail(name);
  };
  const p = object(input, "콘텐츠");
  if (p.version !== 1) fail("버전(버전 1만 지원됨)");
  str(p.id, "ID", 256);
  str(p.name, "이름", 4096, true);
  for (const field of ["width", "height"] as const)
    if (!Number.isInteger(num(p[field], field, 16, 7680))) fail(field);
  if (![24, 25, 30, 50, 60].includes(num(p.fps, "프레임 속도"))) fail("프레임 속도");
  color(p.background, "배경 색상");
  for (const field of ["createdAt", "updatedAt"] as const)
    if (!Number.isFinite(Date.parse(str(p[field], field, 64)))) fail(field);
  const rawAssets = list(p.assets, "자료 목록", 10000),
    rawTracks = list(p.tracks, "트랙 목록", 1000),
    rawClips = list(p.clips, "클립 목록", 10000);
  const ids = new Set<string>();
  const recordId = (item: Record<string, unknown>, label: string) => {
    const value = str(item.id, `${label} ID`, 256);
    if (ids.has(value)) fail("중복 ID");
    ids.add(value);
    return value;
  };
  const assets = new Map<string, Record<string, unknown>>(),
    tracks = new Map<string, Record<string, unknown>>();
  for (const raw of rawAssets) {
    const a = object(raw, "미디어");
    assets.set(recordId(a, "미디어"), a);
    str(a.name, "소재 이름", 4096, true);
    str(a.path, "소재 경로", 32768);
    str(a.url, "소재 URL", 32768);
    choice(a.kind, ["video", "audio", "image"], "자료 유형");
    num(a.duration, "소재 지속 시간", 0, 86400 * 8);
    for (const field of ["width", "height"] as const)
      num(a[field], `재료 ${field}`, 0, 100000);
    num(a.fps, "소재 프레임 속도", 0, 1000);
    bool(a.hasAudio, "소재 오디오 마크");
    if (a.missing !== undefined) bool(a.missing, "소재 누락 마크");
    if (a.thumbnail !== undefined) str(a.thumbnail, "소재 썸네일", 32768);
    if (a.previewUrl !== undefined) str(a.previewUrl, "소재 미리보기 URL", 32768);
    if (a.previewError !== undefined)
      str(a.previewError, "소재 미리보기 오류", 4096, true);
    if (a.waveform !== undefined)
      for (const v of list(a.waveform, "오디오 파형", 100000))
        num(v, "오디오 파형 값", 0, 1);
  }
  for (const raw of rawTracks) {
    const t = object(raw, "트랙");
    tracks.set(recordId(t, "트랙"), t);
    str(t.name, "트랙 이름", 4096, true);
    choice(t.kind, ["video", "audio", "image", "text"], "트랙 유형");
    for (const field of ["muted", "hidden", "locked"] as const)
      bool(t[field], `트랙 ${field}`);
  }
  for (const raw of rawClips) {
    const c = object(raw, "조각");
    recordId(c, "조각");
    str(c.name, "조각 이름", 4096, true);
    if (c.linkId !== undefined) str(c.linkId, "사운드 연결 ID", 256);
    const track = tracks.get(str(c.trackId, "조각 트랙 ID", 256));
    if (!track) fail("클립 트랙 참조");
    const asset =
      c.assetId === undefined
        ? undefined
        : assets.get(str(c.assetId, "클립 자료 ID", 256));
    if (c.assetId !== undefined && !asset) fail("클립 자료 참조");
    const start = num(c.start, "클립 시작 지점", 0, 86400),
      duration = num(c.duration, "클립 지속 시간", Number.MIN_VALUE, 86400),
      sourceIn = num(c.sourceIn, "소스 자료 시작 지점", 0, 86400 * 8),
      speed = num(c.speed, "속도", 0.1, 8);
    if (start + duration > 86400) fail("타임라인 지속 시간(최대 24시간)");
    num(c.volume, "볼륨", 0, 4);
    bool(c.muted, "클립 음소거");
    for (const field of [
      "fadeIn",
      "fadeOut",
      "audioFadeIn",
      "audioFadeOut",
    ] as const)
      num(c[field], field, 0, duration);
    for (const field of ["videoFadeWindow", "audioFadeWindow"] as const)
      if (c[field] !== undefined) {
        const w = object(c[field], field);
        num(w.offset, `${field} 오프셋`, -86400 * 80, 86400 * 80);
        const full = num(
          w.duration,
          `${field} 원본 지속 시간`,
          Number.MIN_VALUE,
          86400 * 80,
        );
        num(w.fadeIn, `${field} 페이드 인`, 0, full);
        num(w.fadeOut, `${field} 페이드 아웃`, 0, full);
      }
    const transform = object(c.transform, "변형");
    for (const field of ["x", "y", "rotation"] as const)
      num(transform[field], field);
    num(transform.scale, "크기 조절", 0.000001, 10);
    num(transform.opacity, "투명도", 0, 1);
    bool(transform.flipX, "수평 뒤집기");
    bool(transform.flipY, "수직 뒤집기");
    if (c.crop !== undefined) {
      const crop = object(c.crop, "자르기");
      const x = num(crop.x, "자르기 X", 0, 1),
        y = num(crop.y, "자르기 Y", 0, 1),
        width = num(crop.width, "자르기 너비", 0.01, 1),
        height = num(crop.height, "자르기 높이", 0.01, 1);
      if (x + width > 1 + 1e-9 || y + height > 1 + 1e-9) fail("재료 이상 자르기");
    }
    if (c.chromaKey !== undefined) {
      const chroma = object(c.chromaKey, "크로마 키");
      bool(chroma.enabled, "크로마 키 스위치");
      str(chroma.color, "키 색상", 9);
      if (!/^#[\da-f]{6}$/i.test(chroma.color as string)) fail("키 색상");
      num(chroma.similarity, "키 유사성", 0.01, 1);
      num(chroma.blend, "키 전환", 0, 1);
    }
    if (c.mask !== undefined) {
      const mask = object(c.mask, "모양 마스크");
      choice(mask.shape, ["rectangle", "ellipse"], "마스크 모양");
      num(mask.width, "마스크 너비", 0.01, 1);
      num(mask.height, "마스크 높이", 0.01, 1);
      num(mask.feather, "마스크 페더", 0, 0.5);
      bool(mask.invert, "마스크 반전");
    }
    const adjustments = object(c.adjustments, "색상 조정");
    num(adjustments.brightness, "밝기", -1, 1);
    num(adjustments.contrast, "대비", 0, 3);
    num(adjustments.saturation, "채도", 0, 3);
    num(adjustments.temperature, "색온도", -1, 1);
    num(adjustments.blur, "흐림", 0, 100);
    if (c.text !== undefined) {
      if (asset || track!.kind !== "text") fail("텍스트 클립 참조");
      const text = object(c.text, "텍스트 스타일");
      str(text.text, "텍스트 내용", 20000, true);
      num(text.fontSize, "글꼴 크기", 1, 1000);
      str(text.fontFamily, "글꼴", 256);
      color(text.color, "텍스트 색상");
      color(text.background, "텍스트 배경");
      color(text.stroke, "텍스트 획");
      num(text.strokeWidth, "획 너비", 0, 100);
      choice(text.align, ["left", "center", "right"], "텍스트 정렬");
      bool(text.bold, "굵게");
    } else {
      if (
        !asset ||
        track!.kind === "text" ||
        !(
          track!.kind === asset.kind ||
          (track!.kind === "video" && asset.kind === "image")
        )
      )
        fail("클립 트랙 및 자료 유형");
      if (
        asset!.kind !== "image" &&
        sourceIn + duration * speed > (asset!.duration as number) + 0.08
      )
        fail("소스 자료 지속 시간을 초과하는 클립");
    }
    const keyIds = new Set<string>();
    for (const rawKey of list(c.keyframes, "키프레임 목록", 400)) {
      const k = object(rawKey, "키프레임"),
        keyId = str(k.id, "키프레임 ID", 256);
      if (keyIds.has(keyId)) fail("반복 키프레임 ID");
      keyIds.add(keyId);
      if (k.easingWindow !== undefined) {
        const w = object(k.easingWindow, "키프레임 보간 창");
        num(w.start, "보간 창 시작 지점", 0, 1);
        num(w.end, "보간 창 끝 지점", 0, 1);
        if (
          (w.start as number) >= (w.end as number) ||
          k.easing === "linear"
        )
          fail("키프레임 보간 창");
      }
      num(k.time, "키프레임 시간", 0, duration);
      choice(
        k.property,
        ["x", "y", "scale", "rotation", "opacity", "volume"],
        "키프레임 속성",
      );
      choice(k.easing, [...EASINGS], "키프레임 보간");
      const low =
        k.property === "scale"
          ? 0.000001
          : ["opacity", "volume"].includes(k.property as string)
            ? 0
            : -1e9;
      const high =
        k.property === "scale"
          ? 10
          : k.property === "opacity"
            ? 1
            : k.property === "volume"
              ? 4
              : 1e9;
      num(k.value, "키프레임 값", low, high);
    }
  }
  // Return a detached value so a caller cannot mutate an already validated project through its input.
  return structuredClone(input) as Project;
}
