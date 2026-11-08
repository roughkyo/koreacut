import type { Clip, MediaAsset, Project, TrackKind } from "./types";
import {
  createProject,
  createTrack,
  createClip,
  id,
  validateProject,
} from "./model";

type ObjectValue = Record<string, unknown>;
export interface CapcutImportOptions {
  name?: string;
  mediaUrl?: (path: string) => string;
}
export interface CapcutImportResult {
  project: Project;
  warnings: string[];
}
const object = (v: unknown): ObjectValue =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as ObjectValue) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const string = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const number = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const seconds = (v: unknown) => number(v) / 1_000_000;
const bounded = (v: unknown, low: number, high: number, fallback: number) =>
  Math.max(low, Math.min(high, number(v, fallback)));
const identityUrl = (path: string) => path;

/** Experimental, lossy conversion of decoded tracks/materials JSON.
 * Desktop envelope decoding is handled before this platform-neutral converter. */
export function importCapcutDraft(
  input: unknown,
  options: CapcutImportOptions = {},
): CapcutImportResult {
  if (typeof input === "string") {
    const source = input.trim().replace(/^\uFEFF/, "");
    if (!source.startsWith("{"))
      throw new Error(
        "컷 초안은 불투명한 로드인 경우 데스크톱 클라이언트의 컷 드래프트 가져오기 기능을 통해 열어주세요.",
      );
    try {
      input = JSON.parse(source);
    } catch {
      throw new Error("초안 JSON은 구문 분석할 수 없습니다.");
    }
  }
  const draft = object(input);
  // Modern empty timelines omit tracks. Require the observed versioned draft
  // structure so arbitrary objects and malformed tracks still fail validation.
  const sparseEmpty =
    draft.tracks === undefined &&
    typeof draft.id === "string" && draft.id.length > 0 &&
    Number.isInteger(draft.version) && number(draft.version) > 0 &&
    typeof draft.new_version === "string" && draft.new_version.length > 0 &&
    (draft.duration === undefined || draft.duration === 0) &&
    Object.keys(object(draft.materials)).length === 0 &&
    number(object(draft.canvas_config).width) > 0 &&
    number(object(draft.canvas_config).height) > 0;
  const tracks = sparseEmpty ? [] : draft.tracks;
  if (
    !Array.isArray(tracks) ||
    !draft.materials ||
    typeof draft.materials !== "object" ||
    Array.isArray(draft.materials)
  )
    throw new Error("지원되는 초안이 아닙니다. 트랙과 자료 또는 유효한 빈 타임라인 구조가 필요합니다.");
  if (tracks.length > 1000) throw new Error("드래프트 트랙 수가 가져오기 제한을 초과합니다.");
  const warnings: string[] = [
    "실험적 가져오기: 기본 타임라인만 변환되고 일부 효과와 텍스트 스타일이 손실됩니다. 미리보기를 확인하고 내보내세요.",
  ];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const project = createProject(
    options.name ?? string(draft.name, "클립 가져오기 프로젝트"),
  );
  // The controlled native export uses black when no canvas background is set.
  project.background = "#000000";
  const canvas = object(draft.canvas_config);
  const hasCanvasDimensions =
    number(canvas.width) > 0 && number(canvas.height) > 0;
  if (hasCanvasDimensions) {
    project.width = Math.round(bounded(canvas.width, 16, 7680, 1920));
    project.height = Math.round(bounded(canvas.height, 16, 7680, 1080));
  }
  const fps = number(draft.fps, 30);
  project.fps = [24, 25, 30, 50, 60].includes(fps) ? fps : 30;
  if (fps !== project.fps) warn(`프레임 속도 ${fps} 는 지원되지 않으며 30fps로 변경되었습니다.`);
  project.tracks = [];
  project.assets = [];
  project.clips = [];
  const materials = object(draft.materials);
  const materialById = new Map<
    string,
    { category: string; data: ObjectValue }
  >();
  let materialCount = 0;
  for (const [category, items] of Object.entries(materials))
    for (const item of array(items)) {
      if (++materialCount > 100000) throw new Error("초안 소재 개수가 가져오기 제한을 초과했습니다.");
      const data = object(item),
        materialId = string(data.id);
      if (materialId) materialById.set(materialId, { category, data });
    }
  const assets = new Map<string, MediaAsset>();
  const makeAsset = (
    materialId: string,
    category: string,
    data: ObjectValue,
  ): MediaAsset | undefined => {
    const known = assets.get(materialId);
    if (known) return known;
    const type = string(data.type);
    const kind =
      category === "audios"
        ? "audio"
        : ["photo", "image"].includes(type)
          ? "image"
          : type === "video" || type === ""
            ? "video"
            : undefined;
    if (!kind) {
      warn(`소재 유형 ${type || category} 는 지원되지 않으며 해당 클립을 건너뛰었습니다.`);
      return undefined;
    }
    const path = string(data.path);
    if (
      path &&
      (!/^(\/|[a-zA-Z]:[\\/])/.test(path) ||
        path.includes("\0") ||
        path.length > 32768)
    ) {
      warn("재료 경로가 지원되는 기본 절대 경로가 아니며 해당 클립을 건너뛰었습니다.");
      return undefined;
    }
    if (!path) {
      warn(
        `재료 ${string(data.material_name, materialId)} 에는 로컬 경로가 없으며 관련 클립을 건너뛰었습니다.`,
      );
      return undefined;
    }
    const asset: MediaAsset = {
      id: id(),
      kind,
      path,
      url: (options.mediaUrl ?? identityUrl)(path),
      name: string(
        data.material_name,
        string(data.name, path.split(/[\\/]/).pop() ?? "미디어"),
      ),
      duration: bounded(seconds(data.duration), 0, 86400 * 8, 0),
      width: bounded(data.width, 0, 100000, 0),
      height: bounded(data.height, 0, 100000, 0),
      fps: bounded(data.fps, 0, 1000, project.fps),
      hasAudio: kind === "audio" || kind === "video",
      missing: false,
    };
    assets.set(materialId, asset);
    project.assets.push(asset);
    return asset;
  };
  let originalCanvas: { width: number; height: number } | undefined;
  const positions = new Map<Clip, { x: number; y: number }>();
  const inferredDurations = new Set<string>();
  const trackLayers = new Map<string, number>();
  const unmappedSettings = new Set<string>();
  const settingNames: Record<string, string> = {
    canvases: "캔버스 배경", placeholder_infos: "자리 표시자 설정",
    sound_channel_mappings: "채널 설정", material_colors: "재질 색상",
    vocal_separations: "음성 분리", material_animations: "조각 애니메이션",
    transitions: "전환", video_effects: "비디오 특수 효과", audio_effects: "오디오 효과",
    audio_fades: "사운드 페이드 인", masks: "마스크",
  };
  let totalSegments = 0;
  for (const rawTrack of tracks) {
    const sourceTrack = object(rawTrack),
      kind = string(sourceTrack.type);
    if (!["video", "audio", "text"].includes(kind)) {
      warn(`트랙 유형 ${kind || "알 수 없음"} 지원되지 않음, 건너뛰었습니다.`);
      continue;
    }
    const track = createTrack(
      kind as TrackKind,
      string(
        sourceTrack.name,
        { video: "영상", audio: "오디오", text: "텍스트" }[kind],
      ),
    );
    project.tracks.push(track);
    const layers = array(sourceTrack.segments)
      .map((item) => object(item).track_render_index)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const uniqueLayers = [...new Set(layers)];
    trackLayers.set(track.id, uniqueLayers[0] ?? project.tracks.length - 1);
    if (uniqueLayers.length > 1)
      warn("동일 트랙에 있는 클립의 레이어 순서가 다르며 첫 번째 클립의 트랙 레벨에 따라 가져왔습니다. 폐색관계를 확인해주세요.");
    for (const rawSegment of array(sourceTrack.segments)) {
      if (++totalSegments > 10000) throw new Error("초안 클립 수가 가져오기 제한을 초과했습니다.");
      const segment = object(rawSegment),
        materialId = string(segment.material_id),
        material = materialById.get(materialId);
      if (!material) {
        warn(`클립에서 참조한 자료 ${materialId || "알 수 없음"} 가 존재하지 않아 건너뛰었습니다.`);
        continue;
      }
      const target = object(segment.target_timerange),
        source = object(segment.source_timerange);
      const start = seconds(target.start),
        duration = seconds(target.duration),
        sourceIn = seconds(source.start);
      if (
        start < 0 ||
        duration <= 0 ||
        start + duration > 86400 ||
        sourceIn < 0 ||
        sourceIn > 86400 * 8
      ) {
        warn("시간 범위가 잘못된 클립이 있어 건너뛰었습니다.");
        continue;
      }
      let asset: MediaAsset | undefined;
      if (kind === "text") {
        if (
          material.category !== "texts" ||
          !["text", "subtitle", ""].includes(string(material.data.type))
        ) {
          warn("기본이 아닌 텍스트 자료는 건너뛰었습니다.");
          continue;
        }
      } else {
        if (material.category !== (kind === "audio" ? "audios" : "videos")) {
          warn("소재 유형이 트랙과 일치하지 않아 해당 클립을 건너뛰었습니다.");
          continue;
        }
        asset = makeAsset(materialId, material.category, material.data);
        if (!asset) continue;
        if (asset.duration === 0 && asset.kind !== "image")
          inferredDurations.add(asset.id);
      }
      const clip = createClip(asset, track.id, start, project.fps);
      clip.start = start;
      clip.duration = duration;
      clip.sourceIn = sourceIn;
      const refs = array(segment.extra_material_refs).map((v) => string(v));
      const speedMaterial = refs
        .map((ref) => materialById.get(ref))
        .find((m) => m?.category === "speeds");
      const speed = number(
        speedMaterial?.data.speed,
        asset?.kind === "image" || !asset
          ? 1
          : seconds(source.duration) / duration || 1,
      );
      if (speed < 0.1 || speed > 8) {
        warn(`클립 속도 ${speed} 가 0.1~8x 범위를 벗어나므로 건너뛰었습니다.`);
        continue;
      }
      if (asset && asset.kind !== "image") {
        const extent = sourceIn + duration * speed;
        if (extent > 86400 * 8) {
          warn("소스 자료의 시간 범위가 지원 범위를 초과하여 해당 클립을 건너뛰었습니다.");
          continue;
        }
        if (inferredDurations.has(asset.id)) {
          asset.duration = Math.max(asset.duration, extent);
          warn(
            "일부 자료는 지속 시간이 부족하고 기본 클립에서 추론되었습니다. 실제 기간을 확인하려면 자료를 다시 연결하십시오.",
          );
        } else if (extent > asset.duration + 0.08) {
          warn("클립이 녹화된 소스 자료 지속 시간을 초과하여 건너뛰었습니다.");
          continue;
        }
        if (
          seconds(source.duration) > 0 &&
          Math.abs(seconds(source.duration) - duration * speed) > 0.08
        )
          warn("소스/타겟 시간 범위는 기본 속도와 다릅니다. 곡선 속도 변화 등은 보존되지 않을 수 있습니다.");
      }
      clip.speed = speed;
      clip.volume = bounded(segment.volume, 0, 4, 1);
      if (clip.volume !== number(segment.volume, 1))
        warn("클립 볼륨이 지원 범위를 벗어났으며 0~4x로 제한되었습니다. 소리를 확인해 주세요.");
      const transform = object(segment.clip),
        position = object(transform.transform),
        scale = object(transform.scale),
        flip = object(transform.flip);
      clip.transform.scale = bounded(scale.x, 0.05, 10, 1);
      clip.transform.rotation = bounded(transform.rotation, -1e9, 1e9, 0);
      clip.transform.opacity = bounded(transform.alpha, 0, 1, 1);
      if (clip.transform.scale !== number(scale.x, 1))
        warn("클립 스케일링은 지원 범위를 벗어났으며 0.05~10x로 제한되었습니다.");
      if (clip.transform.opacity !== number(transform.alpha, 1))
        warn("조각 투명도가 지원 범위를 벗어났으며 0-1로 제한되었습니다.");
      clip.transform.flipX = flip.horizontal === true;
      clip.transform.flipY = flip.vertical === true;
      if (number(scale.y, number(scale.x, 1)) !== number(scale.x, 1))
        warn("비례 스케일링을 균일 스케일링으로 가져오며 화면이 바뀔 수 있습니다.");
      if (kind === "text") {
        const text = parseText(material.data.content);
        if (text === undefined || text.length > 20000) {
          warn("텍스트 내용을 구문 분석할 수 없는 조각은 건너뛰었습니다.");
          continue;
        }
        clip.text!.text = text;
        clip.name = text.slice(0, 30) || "텍스트";
        warn(
          "텍스트 내용이 보존되었습니다. 컷아웃 글꼴, 패턴, 스타일 및 레이아웃은 매핑되지 않으며 ReaCut 기본 스타일이 사용됩니다.",
        );
      }
      if (segment.reverse === true) warn("역방향 재생은 지원되지 않으며, 클립이 앞으로 재생됩니다.");
      if (
        array(segment.common_keyframes).length ||
        Object.keys(object(segment.keyframes)).length
      )
        warn("클립 키프레임은 매핑되지 않으며 클립의 정적 매개변수는 유지됩니다.");
      for (const ref of refs) {
        const extra = materialById.get(ref);
        if (extra && extra.category !== "speeds")
          unmappedSettings.add(settingNames[extra.category] ?? "기타 추가 효과");
        if (
          extra?.category === "speeds" &&
          array(extra.data.curve_speed).length
        )
          warn("커브 속도 변경은 지원되지 않으며, 기본 속도만 유지됩니다.");
      }
      if (Object.keys(object(material.data.crop)).length)
        warn("크롭 정보는 매핑되지 않고 전체 영상이 사용됩니다.");
      // Only accepted visual segments may establish an unspecified canvas.
      // Library-only materials and rejected clips must not affect its size.
      if (!hasCanvasDimensions && !originalCanvas && kind === "video" && asset) {
        const width = number(material.data.width),
          height = number(material.data.height);
        if (
          Number.isInteger(width) &&
          width > 0 &&
          width <= 100000 &&
          Number.isInteger(height) &&
          height > 0 &&
          height <= 100000
        )
          originalCanvas = { width, height };
      }
      positions.set(clip, { x: number(position.x), y: number(position.y) });
      project.clips.push(clip);
    }
  }
  if (!hasCanvasDimensions) {
    if (originalCanvas) {
      project.width = Math.round(bounded(originalCanvas.width, 16, 7680, 1920));
      project.height = Math.round(bounded(originalCanvas.height, 16, 7680, 1080));
      warn(
        `Draft에는 유효한 캔버스 크기가 없으며, 가져올 수 있는 첫 번째 시각적 클립에서 ${project.width} × ${project.height}로 추론됩니다. 캔버스 비율을 확인해주세요.`,
      );
    } else {
      warn(
        "Draft에는 유효한 캔버스 크기가 없으며 추론할 시각적 클립도 없으며 기본값인 1920 × 1080이 사용됩니다. 캔버스 비율을 확인해주세요.",
      );
    }
  }
  for (const [clip, position] of positions) {
    clip.transform.x = bounded((position.x * project.width) / 2, -1e9, 1e9, 0);
    clip.transform.y = bounded((-position.y * project.height) / 2, -1e9, 1e9, 0);
  }
  // Native higher track_render_index is drawn above lower values. ReaCut's
  // first track is the top layer; source array order is the fallback.
  project.tracks.sort((a, b) => trackLayers.get(b.id)! - trackLayers.get(a.id)!);
  if (!project.tracks.length) project.tracks = [createTrack("video")];
  if (!project.clips.length) warn("가져올 기본 조각이 없습니다.");
  if (unmappedSettings.size)
    warn(`추가 설정이 변환되지 않습니다:${[...unmappedSettings].join("、")}. 해당 효과를 확인해주세요.`);
  const bg = object(canvas.background);
  if (Object.keys(bg).length)
    warn("클리핑 캔버스 배경은 매핑되지 않고 검정색 배경을 사용합니다.");
  return { project: validateProject(project), warnings };
}

function parseText(content: unknown): string | undefined {
  if (typeof content !== "string") return undefined;
  if (!content.trim().startsWith("{")) return content;
  try {
    const value = object(JSON.parse(content));
    return typeof value.text === "string" ? value.text : undefined;
  } catch {
    return undefined;
  }
}
