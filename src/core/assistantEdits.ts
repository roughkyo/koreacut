import type { Clip, Project, Track } from "./types";
import { clone, createClip, createTrack, projectDuration, snapToFrame, validateProject } from "./model";

import { linkedIds, moveLinked, speedLinked, splitLinked, trimLinked } from "./timelineEdits";

const fields: Record<string, string[]> = {
  addText: ["text", "start", "duration", "fontSize", "color", "x", "y"],
  addAsset: ["assetId", "start", "trackId", "duration"],
  trimClip: ["clipId", "edge", "time"], splitClip: ["clipId", "time"],
  deleteClip: ["clipId"], moveClip: ["clipId", "start", "trackId"],
  setSpeed: ["clipId", "speed"], setVolume: ["clipId", "volume", "muted"],
  setText: ["clipId", "text"], setTransform: ["clipId", "x", "y", "scale", "rotation", "opacity"],
  setFades: ["clipId", "fadeIn", "fadeOut", "audioFadeIn", "audioFadeOut"],
  setProject: ["name", "width", "height", "fps", "background"],
};
const labels: Record<string, string> = {
  addText: "텍스트 추가", addAsset: "클립 추가", trimClip: "클립 자르기", splitClip: "세그먼트 분할",
  deleteClip: "클립 삭제", moveClip: "클립 이동", setSpeed: "속도 조정", setVolume: "볼륨 조정",
  setText: "텍스트 수정", setTransform: "그림 조정", setFades: "페이드 조정", setProject: "항목 조정",
};
function number(value: unknown, name: string, min = 0, max = 86400): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} 지원 범위를 벗어남`);
  return value;
}
function text(value: unknown, name: string, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || value.includes("\0"))
    throw new Error(`${name} 유효하지 않음`);
  return value;
}
function color(value: unknown): string {
  const result = text(value, "색상", 9);
  if (!/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(result)) throw new Error("색상은 16진수 형식을 사용해야 합니다");
  return result;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("편집 제안 형식은 유효하지 않습니다");
  return value as Record<string, unknown>;
}
export interface AssistantEditPreview {
  project: Project;
  descriptions: string[];
  before: { clips: number; duration: number };
  after: { clips: number; duration: number };
}

/** Validate every operation on a clone. No partial edits, disk writes or arbitrary code. */
export function previewAssistantEdits(input: Project, actions: unknown): AssistantEditPreview {
  if (!Array.isArray(actions) || !actions.length || actions.length > 40)
    throw new Error("각 편집 제안은 반드시 1~40개의 수정 사항 포함");
  let project = validateProject(clone(input));
  const descriptions: string[] = [];
  const compatible = (track: Track, clip: Clip) => clip.text ? track.kind === "text" :
    project.assets.some(asset => asset.id === clip.assetId &&
      (track.kind === asset.kind || (track.kind === "video" && asset.kind === "image")));
  const requireClip = (value: unknown): Clip => {
    const clip = project.clips.find(c => c.id === text(value, "조각 ID", 256));
    if (!clip) throw new Error("참조된 제안 조각이 존재하지 않습니다. 다시 생성하십시오.");
    if (project.tracks.find(t => t.id === clip.trackId)?.locked) throw new Error(`“${clip.name}" 트랙이 잠겨 있습니다.`);
    return clip;
  };
  for (const raw of actions) {
    const action = record(raw), type = text(action.type, "작업", 40);
    if (!Object.hasOwn(fields, type) || Object.keys(action).some(key => key !== "type" && !fields[type].includes(key)))
      throw new Error("보조자가 지원되지 않는 작업 또는 필드를 제안했습니다.");
    let target = "", detail = "";
    if (type === "addText") {
      const content = text(action.text, "텍스트 내용");
      let track = project.tracks.find(t => t.kind === "text" && !t.locked);
      if (!track) { track = createTrack("text", "보조 텍스트"); project.tracks.unshift(track); }
      const clip = createClip(undefined, track.id, number(action.start, "시작 지점"), project.fps);
      clip.duration = Math.max(1 / project.fps, snapToFrame(number(action.duration, "기간", 1 / project.fps), project.fps));
      clip.name = content.slice(0, 80); clip.text!.text = content;
      if (action.fontSize !== undefined) clip.text!.fontSize = number(action.fontSize, "글꼴 크기", 8, 500);
      if (action.color !== undefined) clip.text!.color = color(action.color);
      for (const key of ["x", "y"] as const)
        if (action[key] !== undefined) clip.transform[key] = number(action[key], "위치", -10000, 10000);
      project.clips.push(clip); target = content.length > 180 ? content.slice(0, 180) + "…" : content;
      detail = `${clip.start.toFixed(2)}s · ${clip.duration.toFixed(2)}s · 글꼴 크기 ${clip.text!.fontSize} · ${clip.text!.color} · 위치(${clip.transform.x}, ${clip.transform.y})`;
    } else if (type === "addAsset") {
      const asset = project.assets.find(a => a.id === text(action.assetId, "재료 ID", 256));
      if (!asset || asset.missing) throw new Error("제안된 참조 자료가 없거나 손실되었습니다.");
      let track = action.trackId === undefined
        ? project.tracks.find(t => !t.locked && (t.kind === asset.kind || (t.kind === "video" && asset.kind === "image")))
        : project.tracks.find(t => t.id === text(action.trackId, "트랙 ID", 256));
      if (action.trackId !== undefined && !track) throw new Error("대상 트랙이 존재하지 않습니다");
      if (!track) { track = createTrack(asset.kind); project.tracks.push(track); }
      const clip = createClip(asset, track.id, number(action.start, "시작 지점"), project.fps);
      if (track.locked || !compatible(track, clip)) throw new Error("대상 트랙이 잠겨 있거나 유형이 호환되지 않습니다");
      if (action.duration !== undefined) {
        clip.duration = number(action.duration, "기간", 1 / project.fps);
        if (asset.kind !== "image" && clip.duration > asset.duration + 1e-6) throw new Error("클립 지속 시간이 재료 범위를 초과합니다");
      }
      project.clips.push(clip); target = asset.name; detail = `${clip.start.toFixed(2)}s · ${clip.duration.toFixed(2)}s · 트랙 "${track.name}”`;
    } else if (type === "setProject") {
      if (Object.keys(action).length < 2) throw new Error("프로젝트가 비어 있도록 수정되었습니다.");
      if (action.name !== undefined) project.name = text(action.name, "프로젝트 이름", 200);
      for (const key of ["width", "height"] as const) if (action[key] !== undefined) {
        const value = number(action[key], "캔버스 크기", 16, 7680);
        if (!Number.isInteger(value)) throw new Error("캔버스 크기는 정수여야 합니다."); project[key] = value;
      }
      if (action.fps !== undefined) {
        const fps = number(action.fps, "프레임 속도", 24, 60);
        if (![24, 25, 30, 50, 60].includes(fps)) throw new Error("프레임 속도가 지원되지 않습니다."); project.fps = fps;
      }
      if (action.background !== undefined) project.background = color(action.background);
      target = project.name;
      detail = [
        action.name !== undefined ? `이름 "${project.name}”` : "",
        action.width !== undefined || action.height !== undefined ? `캔버스 ${project.width}×${project.height}` : "",
        action.fps !== undefined ? `${project.fps}fps` : "",
        action.background !== undefined ? `배경 ${project.background}` : "",
      ].filter(Boolean).join(" · ");
    } else {
      const clip = requireClip(action.clipId); target = clip.name;
      const temporal = ['moveClip','trimClip','splitClip','setSpeed','deleteClip'].includes(type);
      const members = linkedIds(project, [clip.id]);
      if (temporal && project.clips.some(c => members.includes(c.id) && project.tracks.find(t => t.id === c.trackId)?.locked))
        throw new Error("관련 클립이 있는 트랙이 잠겨 있습니다");
      if (temporal && clip.linkId) target += "(관련 사운드 포함)";
      switch (type) {
        case "deleteClip": project.clips = project.clips.filter(c => !members.includes(c.id)); break;
        case "splitClip": {
          const at = snapToFrame(number(action.time, "분할 시간"), project.fps);
          if (at < clip.start + 1 / project.fps - 1e-6 || at > clip.start + clip.duration - 1 / project.fps + 1e-6)
            throw new Error("분할 지점이 클립 내부에 있어야 합니다");
          const next = splitLinked(project, [clip.id], at);
          if (next === project) throw new Error("분할 지점이 유효한 클립을 형성하지 않습니다. 클립 내부의 프레임 경계를 다시 선택하십시오");
          project = next; detail = `${at.toFixed(2)}s`; break;
        }
        case "trimClip": {
          if (action.edge !== "start" && action.edge !== "end") throw new Error("자르기 가장자리가 유효하지 않습니다");
          const at = number(action.time, "자르기 시간");
          // A natural-language cut is deliberately bounded to the existing clip.
          if (at < clip.start || at > clip.start + clip.duration ||
            (action.edge === "start" ? clip.start + clip.duration - at : at - clip.start) < 1 / project.fps - 1e-6)
            throw new Error("자르기 시간이 현재 클립 범위 내에 있어야 합니다");
          project = trimLinked(project, clip.id, action.edge, at); detail = `${action.edge === "start" ? "시작 지점" : "끝 지점"} ${at.toFixed(2)}s`; break;
        }
        case "moveClip": {
          const at = snapToFrame(number(action.start, "시작 지점"), project.fps);
          if (action.trackId !== undefined) {
            const track = project.tracks.find(t => t.id === text(action.trackId, "트랙 ID", 256));
            if (!track || track.locked || !compatible(track, clip)) throw new Error("대상 트랙을 사용할 수 없거나 유형이 은(는) 호환되지 않습니다");
          }
          project = moveLinked(project, [clip.id], at - clip.start, action.trackId as string | undefined);
          detail = `${at.toFixed(2)}s${action.trackId !== undefined ? ` · 트랙 "${project.tracks.find(t => t.id === action.trackId)!.name}”` : ""}`; break;
        }
        case "setSpeed": project = speedLinked(project, clip.id, number(action.speed, "속도", .1, 8)); detail = `${action.speed}×`; break;
        case "setVolume":
          if (clip.keyframes.some(key => key.property === "volume"))
            throw new Error("이 클립에는 이미 볼륨 키프레임이 있습니다. 볼륨 제안을 생성하기 전에 속성 패널에서 해당 키프레임을 조정하거나 제거하십시오.");
          clip.volume = number(action.volume, "볼륨", 0, 4);
          if (action.muted !== undefined) {
            if (typeof action.muted !== "boolean") throw new Error("음소거 매개변수가 잘못되었습니다."); clip.muted = action.muted;
          }
          detail = `${Math.round(clip.volume * 100)}%${action.muted !== undefined ? (clip.muted ? " · 음소거" : " · 음소거 해제") : ""}`; break;
        case "setText": if (!clip.text) throw new Error("이 클립은 텍스트가 아닙니다"); clip.text.text = text(action.text, "텍스트 내용"); detail = clip.text.text.length > 180 ? clip.text.text.slice(0, 180) + "…" : clip.text.text; break;
        case "setTransform": {
          if (Object.keys(action).length < 3) throw new Error("사진이 비어 있도록 수정되었습니다");
          if (clip.keyframes.some(key => action[key.property] !== undefined))
            throw new Error("수정된 사진 속성에는 이미 키 프레임이 있습니다. 먼저 속성 패널에서 해당 키 프레임을 조정하거나 제거한 다음 제안을 생성하십시오");
          for (const key of ["x", "y", "scale", "rotation", "opacity"] as const) if (action[key] !== undefined)
            clip.transform[key] = number(action[key], key, key === "scale" ? .01 : key === "opacity" ? 0 : -10000, key === "scale" ? 10 : key === "opacity" ? 1 : 10000);
          detail = (["x", "y", "scale", "rotation", "opacity"] as const)
            .filter(key => action[key] !== undefined)
            .map(key => `${{ x: "X", y: "Y", scale: "크기 조절", rotation: "회전", opacity: "투명도" }[key]} ${clip.transform[key]}${key === "rotation" ? "°" : key === "scale" ? "×" : ""}`).join(" · "); break;
        }
        case "setFades":
          for (const key of ["fadeIn", "fadeOut", "audioFadeIn", "audioFadeOut"] as const)
            clip[key] = number(action[key], "페이드 지속 시간", 0, clip.duration);
          delete clip.videoFadeWindow; delete clip.audioFadeWindow;
          detail = `사진 페이드 인 ${clip.fadeIn}s · 페이드 아웃 ${clip.fadeOut}s · 사운드 페이드 인 ${clip.audioFadeIn}s · 페이드 아웃 ${clip.audioFadeOut}s`; break;
      }
    }
    descriptions.push(`${labels[type]}：${target}${detail ? ` · ${detail}` : ""}`);
  }
  project = validateProject(project);
  return { project, descriptions, before: { clips: input.clips.length, duration: projectDuration(input) }, after: { clips: project.clips.length, duration: projectDuration(project) } };
}

const safeName = (value: string, max = 120) => value
  .replace(/(?:[a-z][a-z\d+.-]*:\/\/|reacut-media:|[A-Za-z]:[\\/]|\\\\|\/)[^\s]*/gi, "[로컬 콘텐츠]")
  .replace(/\0/g, "").slice(0, max);
const safeId = (value: string) => value.length <= 256 && !/[\0\s/\\:]/.test(value);

/** Explicit allowlist: no asset URLs, absolute paths, thumbnails, waveforms or media bytes. */
export function assistantProjectContext(project: Project, selectedIds: string[], playhead: number): string {
  const selected = new Set(selectedIds);
  const rankedClips = [...project.clips].filter(c => safeId(c.id) && safeId(c.trackId) && (!c.assetId || safeId(c.assetId)))
    .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))).slice(0, 100);
  const trackPriority = new Map([...new Set(rankedClips.map(c => c.trackId))].map((id, index) => [id, index]));
  const tracks = [...project.tracks].filter(t => safeId(t.id))
    .sort((a, b) => (trackPriority.get(a.id) ?? Infinity) - (trackPriority.get(b.id) ?? Infinity)).slice(0, 40);
  const trackIds = new Set(tracks.map(t => t.id));
  const assetPriority = new Map([...new Set(rankedClips.map(c => c.assetId))].map((id, index) => [id, index]));
  const assets = [...project.assets].filter(a => safeId(a.id))
    .sort((a, b) => (assetPriority.get(a.id) ?? Infinity) - (assetPriority.get(b.id) ?? Infinity)).slice(0, 100);
  const assetIds = new Set(assets.map(a => a.id));
  const clips = rankedClips.filter(c => trackIds.has(c.trackId) && (!c.assetId || assetIds.has(c.assetId)));
  const summary = {
    projectId: safeId(project.id) ? project.id : "redacted-project", name: safeName(project.name),
    canvas: { width: project.width, height: project.height, fps: project.fps, background: project.background },
    playhead, selectedIds: clips.filter(c => selected.has(c.id)).map(c => c.id), duration: projectDuration(project),
    assets: assets.map(a => ({ id: a.id, name: safeName(a.name), kind: a.kind, duration: a.duration, width: a.width, height: a.height, missing: !!a.missing })),
    tracks: tracks.map(t => ({ id: t.id, name: safeName(t.name), kind: t.kind, locked: t.locked })),
    clips: clips.map(c => ({ id: c.id, name: safeName(c.name), assetId: c.assetId, trackId: c.trackId, start: c.start, duration: c.duration, sourceIn: c.sourceIn, speed: c.speed, volume: c.volume, muted: c.muted,
      transform: { x: c.transform.x, y: c.transform.y, scale: c.transform.scale, rotation: c.transform.rotation, opacity: c.transform.opacity, flipX: c.transform.flipX, flipY: c.transform.flipY },
      animatedProperties: [...new Set(c.keyframes.map(k => k.property))],
      text: c.text ? safeName(c.text.text, 500) : undefined })),
    truncated: clips.length !== project.clips.length || assets.length !== project.assets.length || tracks.length !== project.tracks.length,
  };
  let serialized = JSON.stringify(summary);
  const bytes = new TextEncoder();
  // Leave headroom below the IPC/backend limit. Drop lower-priority clips first;
  // retain every reference used by the remaining clips, especially selection.
  while (bytes.encode(serialized).byteLength > 90_000) {
    summary.truncated = true;
    if (summary.clips.length > 1) summary.clips.pop();
    else if (summary.assets.length > 1) {
      const referenced = new Set(summary.clips.map(c => c.assetId));
      let removable = summary.assets.length - 1;
      while (removable >= 0 && referenced.has(summary.assets[removable].id)) removable--;
      if (removable < 0) break;
      summary.assets.splice(removable, 1);
    } else break;
    summary.selectedIds = summary.clips.filter(c => selected.has(c.id)).map(c => c.id);
    serialized = JSON.stringify(summary);
  }
  return serialized;
}
