import { linkedIds } from "./timelineEdits";
/** Original, offline editing recipes. MIT; no third-party templates or media. */
import type { Clip, Keyframe, Project, TextStyle } from "./types";
import {
  createClip,
  createTrack,
  evaluateKeyframes,
  id,
  snapToFrame,
} from "./model";

export interface TextPreset {
  id: string;
  name: string;
  category: "제목" | "자막" | "마크" | "동적";
  style: Partial<TextStyle> & { text: string };
  y?: number;
  motion?: "rise" | "pop" | "fade";
}
export const TEXT_PRESETS: readonly TextPreset[] = [
  {
    id: "classic",
    name: "클래식 제목",
    category: "제목",
    style: { text: "영감이 그림이 되자", fontSize: 80 },
  },
  {
    id: "chapter",
    name: "챕터 제목",
    category: "제목",
    style: {
      text: "CHAPTER 01\n나의 이야기",
      fontSize: 66,
      color: "#ffd69a",
      strokeWidth: 0,
    },
  },
  {
    id: "cinema",
    name: "영화 제목",
    category: "제목",
    style: {
      text: "On the road\nA JOURNEY",
      fontSize: 90,
      color: "#fff0d5",
      strokeWidth: 0,
    },
  },
  {
    id: "editorial",
    name: "미니멀리스트 마스트헤드",
    category: "제목",
    style: {
      text: "생활 관찰\nVOL. 01",
      fontSize: 70,
      bold: false,
      strokeWidth: 0,
    },
  },
  {
    id: "subtitle",
    name: "자막 하단 스트립",
    category: "자막",
    y: 0.36,
    style: {
      text: "모든 프레임은 기록할 가치가 있습니다",
      fontSize: 52,
      bold: false,
      background: "#11151c",
      strokeWidth: 0,
    },
  },
  {
    id: "outline",
    name: "획 지우기",
    category: "자막",
    y: 0.36,
    style: { text: "평범한 하루에 작은 빛을 더하세요", fontSize: 54, strokeWidth: 4 },
  },
  {
    id: "warm-caption",
    name: "따뜻한 흰색 나레이션",
    category: "자막",
    y: 0.32,
    style: {
      text: "천천히 걸어가세요 길가에 풍경이 있습니다",
      fontSize: 48,
      bold: false,
      color: "#fff0d5",
      background: "#493b32",
      strokeWidth: 0,
    },
  },
  {
    id: "quote",
    name: "인터뷰 명언",
    category: "자막",
    style: {
      text: "\"매일 사랑을 적어보세요\"",
      fontSize: 64,
      color: "#a0f1df",
      strokeWidth: 0,
    },
  },
  {
    id: "mint",
    name: "민트 마크",
    category: "마크",
    style: { text: "REACUT", fontSize: 104, color: "#62ead1", strokeWidth: 0 },
  },
  {
    id: "comic",
    name: "코미컬한 강조",
    category: "마크",
    style: {
      text: "설렘이 다가옵니다!",
      fontSize: 100,
      color: "#ffd176",
      stroke: "#382637",
      strokeWidth: 7,
    },
  },
  {
    id: "news",
    name: "정보 플래시",
    category: "마크",
    y: 0.29,
    style: {
      text: "실사 · 최신 뉴스",
      fontSize: 60,
      background: "#b63f43",
      strokeWidth: 0,
    },
  },
  {
    id: "label",
    name: "캐릭터 이름표",
    category: "마크",
    y: 0.3,
    style: {
      text: "숲속 · 크리에이터",
      fontSize: 52,
      color: "#15252c",
      background: "#62ead1",
      strokeWidth: 0,
    },
  },
  {
    id: "rise",
    name: "살짝 솟아오르는",
    category: "동적",
    motion: "rise",
    style: { text: "새로운 이야기, 지금 시작합니다", fontSize: 74, strokeWidth: 0 },
  },
  {
    id: "pop",
    name: "바운스 등장",
    category: "동적",
    motion: "pop",
    style: { text: "HELLO！", fontSize: 108, color: "#ffd176", strokeWidth: 4 },
  },
  {
    id: "fade",
    name: "부드러운 빛의 오프닝",
    category: "동적",
    motion: "fade",
    style: {
      text: "아름다운 순간을 만나세요",
      fontSize: 72,
      bold: false,
      color: "#fff0d5",
      strokeWidth: 0,
    },
  },
  {
    id: "end",
    name: "은은한 커튼콜",
    category: "동적",
    motion: "fade",
    style: {
      text: "시청해주셔서 감사합니다 \n 다음에 또 봐요",
      fontSize: 76,
      color: "#a0f1df",
      strokeWidth: 0,
    },
  },
];
type VisualProperty = Exclude<Keyframe["property"], "volume">;
function keys(
  property: VisualProperty,
  points: [number, number][],
): Keyframe[] {
  return points.map(([time, value]) => ({
    id: id(),
    property,
    time,
    value,
    easing: "easeInOut",
  }));
}
function replaceKeys(clip: Clip, additions: Keyframe[]): Keyframe[] {
  const properties = new Set(additions.map((k) => k.property));
  return [
    ...clip.keyframes.filter((k) => !properties.has(k.property)),
    ...additions,
  ];
}
export function makeTextPreset(
  preset: TextPreset,
  trackId: string,
  start: number,
  project: Pick<Project, "width" | "height" | "fps">,
): Clip {
  const clip = createClip(undefined, trackId, start, project.fps);
  const scale = Math.min(project.width / 1920, project.height / 1080);
  clip.text = {
    ...clip.text!,
    ...preset.style,
    fontSize: Math.min(
      1000,
      Math.max(8, (preset.style.fontSize ?? 72) * scale),
    ),
    strokeWidth: (preset.style.strokeWidth ?? 2) * scale,
  };
  clip.name = preset.style.text.replaceAll("\n", " · ");
  clip.transform.y = (preset.y ?? 0) * project.height;
  if (preset.motion) {
    clip.fadeIn = 0.5;
    clip.fadeOut = 0.5;
  }
  if (preset.motion === "rise")
    clip.keyframes = keys("y", [
      [0, clip.transform.y + project.height * 0.12],
      [0.65, clip.transform.y],
    ]);
  if (preset.motion === "pop")
    clip.keyframes = keys("scale", [
      [0, 0.45],
      [0.4, 1.1],
      [0.65, 1],
    ]);
  return clip;
}
export function addTextPreset(
  project: Project,
  preset: TextPreset,
  start: number,
): { project: Project; clip: Clip } {
  const track =
    project.tracks.find((t) => t.kind === "text" && !t.locked) ??
    createTrack("text");
  const clip = makeTextPreset(preset, track.id, start, project);
  return {
    project: {
      ...project,
      tracks: project.tracks.includes(track)
        ? project.tracks
        : [track, ...project.tracks],
      clips: [...project.clips, clip],
    },
    clip,
  };
}
export const MOTION_PRESETS = [
  { id: "push", name: "천천히 전진", description: "현재 확대된 부분에서 천천히 확대, 피사체 강조" },
  { id: "pull", name: "카메라 축소", description: "가까운 거리에서 현재 사진으로 뒤로 이동" },
  { id: "pan-left", name: "왼쪽으로 로밍", description: "사진과 풍경에 적합한 수평으로 약간 이동" },
  {
    id: "pan-right",
    name: "오른쪽으로 로밍",
    description: "사진과 풍경에 적합한 수평으로 약간 이동",
  },
  { id: "float", name: "가볍게 플로트", description: "위아래로 천천히 플로트" },
  { id: "pulse", name: "호흡 및 확대", description: "부드럽게 확대 및 두 번 하강" },
  { id: "sway", name: "부드럽게 스윙", description: "작은 각도로 왼쪽 및 오른쪽으로 스윙" },
  { id: "shake", name: "리드미컬한 진동", description: "짧은 수평 진동 후 원래 위치로 복귀" },
] as const;
export type MotionId = (typeof MOTION_PRESETS)[number]["id"];
export function motionPatch(
  clip: Clip,
  motion: MotionId,
  project: Pick<Project, "width" | "height">,
): Partial<Clip> {
  const d = clip.duration,
    t = clip.transform;
  const scale = (v: number) => Math.max(0.01, Math.min(10, v));
  let frames: Keyframe[];
  switch (motion) {
    case "push":
      frames = keys("scale", [
        [0, t.scale],
        [d, scale(t.scale * 1.18)],
      ]);
      break;
    case "pull":
      frames = keys("scale", [
        [0, scale(t.scale * 1.18)],
        [d, t.scale],
      ]);
      break;
    case "pan-left":
    case "pan-right": {
      const delta = project.width * 0.06 * (motion === "pan-left" ? -1 : 1);
      frames = keys("x", [
        [0, t.x - delta],
        [d, t.x + delta],
      ]);
      break;
    }
    case "float":
      frames = keys("y", [
        [0, t.y],
        [d * 0.25, t.y - project.height * 0.025],
        [d * 0.75, t.y + project.height * 0.025],
        [d, t.y],
      ]);
      break;
    case "pulse":
      frames = keys("scale", [
        [0, t.scale],
        [d * 0.25, scale(t.scale * 1.08)],
        [d * 0.5, t.scale],
        [d * 0.75, scale(t.scale * 1.08)],
        [d, t.scale],
      ]);
      break;
    case "sway":
      frames = keys("rotation", [
        [0, t.rotation],
        [d * 0.25, t.rotation - 3],
        [d * 0.75, t.rotation + 3],
        [d, t.rotation],
      ]);
      break;
    case "shake":
      frames = keys("x", [
        [0, t.x],
        ...Array.from(
          { length: 6 },
          (_, i) =>
            [
              (d * (i + 1)) / 12,
              t.x + project.width * 0.014 * (i % 2 ? 1 : -1),
            ] as [number, number],
        ),
        [d * 0.65, t.x],
        [d, t.x],
      ]);
      break;
  }
  return { keyframes: replaceKeys(clip, frames) };
}
export const TRANSITION_PRESETS = [
  {
    id: "dissolve",
    name: "오버레이",
    description: "2개 장면이 부드럽게 섞임",
    category: "기본",
  },
  {
    id: "dip",
    name: "배경을 통과",
    description: "캔버스 배경으로 페이드된 후 다음 세그먼트 입력",
    category: "기본",
  },
  {
    id: "slide-left",
    name: "왼쪽 슬라이드 인",
    description: "다음 세그먼트가 오른쪽에서 슬라이드 인",
    category: "카메라 이동",
  },
  {
    id: "slide-right",
    name: "오른쪽 슬라이드 인",
    description: "다음 세그먼트가 왼쪽에서 슬라이드 인",
    category: "카메라 이동",
  },
  {
    id: "slide-up",
    name: "위로 슬라이드",
    description: "다음 세그먼트가 아래쪽에서 슬라이드 인",
    category: "카메라 이동",
  },
  {
    id: "slide-down",
    name: "슬라이드 인",
    description: "다음 세그먼트가 위에서 슬라이드 인",
    category: "카메라 이동",
  },
  {
    id: "zoom",
    name: "확대/축소 전송",
    description: "다음 세그먼트가 작은 것에서 큰 것으로 바뀌고 페이드 인",
    category: "동적",
  },
  {
    id: "spin",
    name: "회전 전송",
    description: "다음 세그먼트가 부드럽게 회전하고 확대되고 페이드 인됩니다",
    category: "동적",
  },
] as const;
export type TransitionId = (typeof TRANSITION_PRESETS)[number]["id"];
/** Make the leading edge meet the existing curve at duration; preserve its later keys. */
function incomingKeys(
  clip: Clip,
  property: VisualProperty,
  value: number,
  duration: number,
): Keyframe[] {
  const target = evaluateKeyframes(clip, duration).transform[property];
  const sorted = clip.keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time);
  const curve = sorted.filter(
    (k, i) => i === sorted.length - 1 || sorted[i + 1].time !== k.time,
  );
  const rightIndex = curve.findIndex((k) => k.time > duration);
  const right = curve[rightIndex],
    left = curve[rightIndex - 1];
  // Restrict the first surviving non-linear segment to its remaining interval.
  // Merely keeping its destination key would restart easing and change later motion.
  const remaining = clip.keyframes
    .filter((k) => k.property !== property || k.time > duration)
    .map((k) => {
      if (
        k.id !== right?.id ||
        !left ||
        left.time >= duration ||
        right.easing === "linear"
      )
        return k;
      const window = right.easingWindow ?? { start: 0, end: 1 };
      return {
        ...k,
        easingWindow: {
          start:
            window.start +
            ((window.end - window.start) * (duration - left.time)) /
              (right.time - left.time),
          end: window.end,
        },
      };
    });
  return [
    ...remaining,
    ...keys(property, [
      [0, value],
      [duration, target],
    ]),
  ];
}
export function applyTransition(
  project: Project,
  clipId: string,
  transition: TransitionId,
  seconds: number,
): { project: Project; duration: number } {
  if (
    !TRANSITION_PRESETS.some((p) => p.id === transition) ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  )
    throw new Error("전환 매개변수가 유효하지 않습니다.");
  const front = project.clips.find((c) => c.id === clipId),
    track = project.tracks.find((t) => t.id === front?.trackId);
  if (!front || !track || front.text || track.kind === "audio")
    throw new Error("사진 클립을 선택하세요.");
  if (track.locked) throw new Error("먼저 트랙 잠금을 해제해 주세요");
  const siblings = project.clips
    .filter((c) => c.trackId === track.id)
    .sort((a, b) => a.start - b.start);
  const index = siblings.findIndex((c) => c.id === front.id),
    next = siblings[index + 1];
  const end = front.start + front.duration,
    tolerance = 1 / project.fps + 0.00001;
  if (
    !next ||
    next.text ||
    next.start > end + tolerance ||
    next.start < end - front.duration / 2 - 0.00001
  )
    throw new Error("동일 트랙에 두 개의 인접한 그림 클립이 필요합니다. 먼저 간격이나 과도하게 겹치는 부분을 제거하십시오.");
  const limit = Math.min(5, front.duration / 2, next.duration / 2);
  const duration =
    Math.floor(Math.min(seconds, limit) * project.fps + 1e-8) / project.fps;
  if (duration < 1 / project.fps) throw new Error("클립이 너무 짧아 전환을 추가할 수 없습니다.");
  const newStart = snapToFrame(
    end - (transition === "dip" ? 0 : duration),
    project.fps,
  );
  if (
    siblings[index + 2] &&
    newStart + next.duration > siblings[index + 2].start + 0.00001
  )
    throw new Error("전환이 후속 클립과 겹칩니다. 먼저 다음 클립을 위한 공간을 남겨두십시오");
  let incoming: Clip = {
    ...next,
    start: newStart,
    fadeIn: duration,
    audioFadeIn: duration,
    videoFadeWindow: undefined,
    audioFadeWindow: undefined,
  };
  const at = evaluateKeyframes(next, duration).transform;
  if (transition.startsWith("slide")) {
    const horizontal =
        transition === "slide-left" || transition === "slide-right",
      property = horizontal ? "x" : "y";
    const sign =
      transition === "slide-left" || transition === "slide-up" ? 1 : -1;
    incoming.keyframes = incomingKeys(
      incoming,
      property,
      at[property] + (horizontal ? project.width : project.height) * sign,
      duration,
    );
    incoming.fadeIn = 0;
  }
  if (transition === "zoom" || transition === "spin")
    incoming.keyframes = incomingKeys(
      incoming,
      "scale",
      Math.max(0.01, at.scale * 0.3),
      duration,
    );
  if (transition === "spin")
    incoming.keyframes = incomingKeys(
      incoming,
      "rotation",
      at.rotation - 35,
      duration,
    );
  const outgoing: Clip = {
    ...front,
    fadeOut: transition === "dip" ? duration : 0,
    videoFadeWindow: front.videoFadeWindow
      ? {
          ...front.videoFadeWindow,
          fadeOut: transition === "dip" ? duration : 0,
        }
      : undefined,
    audioFadeOut: duration,
    audioFadeWindow: undefined,
  };
  const outgoingIds = new Set(linkedIds(project, [front.id]));
  const incomingIds = new Set(linkedIds(project, [next.id]));
  if (project.clips.some(c => (outgoingIds.has(c.id) || incomingIds.has(c.id)) && project.tracks.find(t => t.id === c.trackId)?.locked))
    throw new Error("연결 오디오 트랙이 잠겨 있습니다. 먼저 잠금을 해제하십시오");
  // A trimmed envelope's original end need not equal this clip's end: materialize the outgoing dip.
  if (transition === "dip") outgoing.videoFadeWindow = undefined;
  return {
    duration,
    project: {
      ...project,
      clips: project.clips.map((c) =>
        c.id === front.id ? outgoing : c.id === next.id ? incoming :
        incomingIds.has(c.id) ? { ...c, start: c.start + newStart - next.start, audioFadeIn: duration, audioFadeWindow: undefined } :
        outgoingIds.has(c.id) ? { ...c, audioFadeOut: duration, audioFadeWindow: undefined } : c,
      ),
    },
  };
}
