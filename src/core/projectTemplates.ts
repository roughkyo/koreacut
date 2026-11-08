import { clone, id, validateProject } from "./model";
import type { MediaAsset, Project } from "./types";

export interface TemplateSlot {
  id: string;
  kind: "media" | "text";
  targetId: string;
  label: string;
}
export interface ProjectTemplate {
  format: "reacut-template";
  version: 1;
  name: string;
  cover: string;
  project: Project;
  slots: TemplateSlot[];
}
export interface TemplateSummary {
  id: string;
  name: string;
  cover: string;
  slots: number;
}
export interface TemplateReplacements {
  media: Record<string, MediaAsset>;
  text: Record<string, string>;
}

export function validateTemplate(input: unknown): ProjectTemplate {
  if (!input || typeof input !== "object") throw new Error("템플릿 내용이 잘못되었습니다.");
  const t = input as ProjectTemplate;
  if (t.format !== "reacut-template" || t.version !== 1)
    throw new Error("지원되지 않는 템플릿 형식입니다.");
  if (
    typeof t.name !== "string" ||
    !t.name.trim() ||
    t.name.length > 120 ||
    t.name.includes("\0")
  )
    throw new Error("템플릿 이름은 1~120단어여야 합니다.");
  if (
    typeof t.cover !== "string" ||
    t.cover.length > 1500000 ||
    (t.cover !== "" &&
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(t.cover))
  )
    throw new Error("템플릿 표지는 제한된 크기의 PNG여야 합니다.");
  const project = validateProject(t.project);
  if (!Array.isArray(t.slots) || t.slots.length > 200)
    throw new Error("템플릿은 최대 200개의 자리 표시자를 포함할 수 있습니다.");
  const keys = new Set<string>(),
    targets = new Set<string>();
  const slots = t.slots.map((s) => {
    if (
      !s ||
      !["media", "text"].includes(s.kind) ||
      typeof s.id !== "string" ||
      !s.id ||
      s.id.length > 256 ||
      keys.has(s.id) ||
      typeof s.targetId !== "string" ||
      targets.has(`${s.kind}:${s.targetId}`) ||
      typeof s.label !== "string" ||
      !s.label.trim() ||
      s.label.length > 120
    )
      throw new Error("템플릿 자리 표시자가 잘못되었거나 반복되었습니다.");
    if (
      s.kind === "media"
        ? !project.assets.some(
            (a) =>
              a.id === s.targetId &&
              project.clips.some((c) => c.assetId === a.id),
          )
        : !project.clips.some((c) => c.id === s.targetId && c.text)
    )
      throw new Error("템플릿 자리 표시자 참조가 잘못되었습니다.");
    keys.add(s.id);
    targets.add(`${s.kind}:${s.targetId}`);
    return { id: s.id, kind: s.kind, targetId: s.targetId, label: s.label };
  });
  return {
    format: "reacut-template",
    version: 1,
    name: t.name.trim(),
    cover: t.cover,
    project,
    slots,
  };
}
export function defaultTemplate(project: Project, cover = ""): ProjectTemplate {
  const p = validateProject(project);
  // A template only distributes media actually used by its timeline.
  p.assets = p.assets.filter((a) => p.clips.some((c) => c.assetId === a.id));
  const slots: TemplateSlot[] = [
    ...p.assets.map((a) => ({
      id: id(),
      kind: "media" as const,
      targetId: a.id,
      label: a.name.slice(0, 120) || "미디어",
    })),
    ...p.clips
      .filter((c) => c.text)
      .map((c) => ({
        id: id(),
        kind: "text" as const,
        targetId: c.id,
        label: c.text!.text.slice(0, 120).trim() || "카피 라이팅",
      })),
  ].slice(0, 200);
  return validateTemplate({
    format: "reacut-template",
    version: 1,
    name: p.name.slice(0, 120),
    cover,
    project: p,
    slots,
  });
}
/** New identities and no save path: edits can never overwrite the template document. */
export function instantiateTemplate(input: ProjectTemplate): ProjectTemplate {
  const t = validateTemplate(input),
    p = t.project;
  const assets = new Map(p.assets.map((a) => [a.id, id()])),
    tracks = new Map(p.tracks.map((a) => [a.id, id()])),
    clips = new Map(p.clips.map((a) => [a.id, id()])),
    links = new Map(
      p.clips.filter((c) => c.linkId).map((c) => [c.linkId!, id()]),
    );
  p.id = id();
  p.name = t.name + " · 복사";
  p.createdAt = p.updatedAt = new Date().toISOString();
  p.assets.forEach((a) => {
    a.id = assets.get(a.id)!;
  });
  p.tracks.forEach((a) => {
    a.id = tracks.get(a.id)!;
  });
  p.clips.forEach((c) => {
    c.id = clips.get(c.id)!;
    c.trackId = tracks.get(c.trackId)!;
    if (c.assetId) c.assetId = assets.get(c.assetId)!;
    if (c.linkId) c.linkId = links.get(c.linkId)!;
    c.keyframes.forEach((k) => {
      k.id = id();
    });
  });
  t.slots.forEach((s) => {
    s.targetId = (s.kind === "media" ? assets : clips).get(s.targetId)!;
  });
  return validateTemplate(t);
}
/** Exact timeline preservation: reject short media, never silently trim/stretch other clips. */
export function replaceTemplateSlots(
  input: ProjectTemplate,
  replacements: TemplateReplacements,
): Project {
  const t = validateTemplate(input),
    p = t.project;
  for (const [kind, values] of [
    ["media", replacements.media],
    ["text", replacements.text],
  ] as const) {
    if (!values || typeof values !== "object" || Array.isArray(values))
      throw new Error("대체 내용이 잘못되었습니다.");
    for (const key of Object.keys(values))
      if (!t.slots.some((s) => s.id === key && s.kind === kind))
        throw new Error("알 수 없는 템플릿 자리 표시자가 있습니다.");
  }
  for (const s of t.slots) {
    if (s.kind === "text" && Object.hasOwn(replacements.text, s.id)) {
      const value = replacements.text[s.id];
      if (
        typeof value !== "string" ||
        value.length > 20000 ||
        value.includes("\0")
      )
        throw new Error("교체 복사본이 유효하지 않습니다.");
      const c = p.clips.find((c) => c.id === s.targetId)!;
      if (p.tracks.find((tr) => tr.id === c.trackId)!.locked)
        throw new Error("원본 템플릿 프로젝트에서 먼저 교체해야 하는 트랙의 잠금을 해제하세요.");
      c.text!.text = value;
      c.name = value.slice(0, 4096);
    }
    if (s.kind === "media" && Object.hasOwn(replacements.media, s.id)) {
      const a = replacements.media[s.id],
        old = p.assets.find((a) => a.id === s.targetId)!;
      if (!a || a.missing) throw new Error("교체 자료를 사용할 수 없습니다.");
      const uses = p.clips.filter((c) => c.assetId === old.id);
      for (const c of uses) {
        const track = p.tracks.find((tr) => tr.id === c.trackId)!;
        if (track.locked) throw new Error("원본 템플릿 프로젝트에서 먼저 교체해야 하는 트랙의 잠금을 해제하세요.");
        if (!(
          a.kind === old.kind ||
          (track.kind === "video" &&
            ["video", "image"].includes(a.kind) &&
            ["video", "image"].includes(old.kind))
        ))
          throw new Error(`자리 표시자 "${s.label}"가 새 자료 유형과 일치하지 않습니다.`);
        const required = c.sourceIn + c.duration * c.speed;
        if (
          a.kind !== "image" &&
          (!Number.isFinite(a.duration) || a.duration + 1e-6 < required)
        )
          throw new Error(
            `자리 표시자 "${s.label}"에는 최소한 ${required.toFixed(3)} 두 번째 소스 자료(진입 지점 및 속도 포함)가 필요하며 대체가 적용되지 않습니다.`,
          );
      }
      p.assets[p.assets.indexOf(old)] = { ...clone(a), id: old.id };
    }
  }
  // Paired detached audio/video must continue to reference the same recording.
  for (const c of p.clips.filter((c) => c.linkId && c.assetId)) {
    const group = p.clips.filter(
      (other) => other.linkId === c.linkId && other.assetId,
    );
    const changed = group.some((other) =>
      t.slots.some(
        (s) =>
          s.kind === "media" &&
          s.targetId === other.assetId &&
          Object.hasOwn(replacements.media, s.id),
      ),
    );
    if (
      changed &&
      new Set(
        group.map(
          (other) => p.assets.find((a) => a.id === other.assetId)!.path,
        ),
      ).size > 1
    )
      throw new Error(
        "관련 오디오 및 비디오는 동일한 소스 파일로 함께 교체되어야 하거나 원본 템플릿 프로젝트에서 연결 연결이 끊어져야 합니다 먼저",
      );
  }
  return validateProject(p);
}
