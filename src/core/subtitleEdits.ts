import {
  mergeSubtitles,
  splitSubtitle,
  subtitleAnimation,
  SUBTITLE_STYLE_FIELDS,
  type SubtitleAnimation,
  type SubtitleStyleValues,
} from "./subtitleWorkflow";
import { clone, snapToFrame, trimClip, validateProject } from "./model";
import type { Clip, Project } from "./types";

export type SubtitleEdit =
  | { type: "cue"; text: string; start: number; end: number }
  | { type: "offset"; seconds: number }
  | { type: "replace"; find: string; replacement: string }
  | { type: "style"; referenceId: string }
  | { type: "styleValues"; values: SubtitleStyleValues }
  | { type: "animation"; options: SubtitleAnimation }
  | { type: "split"; at: number; offset: number }
  | { type: "merge" };

export interface SubtitleEditPlan {
  edit: SubtitleEdit;
  base: string;
  project: Project;
  changedIds: string[];
}

function text(
  value: unknown,
  label: string,
  empty = true,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > 20000 ||
    value.includes("\0") ||
    (!empty && !value.length)
  )
    throw new Error(`${label}잘못됨(최대 20000 단어)`);
}
function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label}제한된 값이어야 합니다.`);
}
function cue(project: Project, id: string, editable = true): Clip {
  const clip = project.clips.find((c) => c.id === id);
  const track = project.tracks.find((t) => t.id === clip?.trackId);
  if (!clip?.text || track?.kind !== "text")
    throw new Error("선택한 자막이 존재하지 않거나 텍스트 조각이 아닙니다.");
  if (editable && track.locked)
    throw new Error(`트랙 "${track.name}"가 잠겨 있습니다. 먼저 잠금을 해제하십시오.`);
  return clip;
}

/** Prepare on a clone. Overlapping cues are legal; none of the targets may fail silently. */
export function prepareSubtitleEdit(
  input: Project,
  ids: readonly string[],
  edit: SubtitleEdit,
): SubtitleEditPlan {
  let project = validateProject(clone(input));
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 10000 ||
    new Set(ids).size !== ids.length
  )
    throw new Error("중복되지 않은 자막을 선택하십시오.");
  const originals = ids.map((id) => cue(project, id));
  if (new Set(originals.map((c) => c.trackId)).size !== 1)
    throw new Error("일괄 작업당 하나의 자막 트랙만 수정할 수 있습니다.");
  if (!edit || typeof edit !== "object") throw new Error("자막 작업이 잘못되었습니다.");
  if (edit.type === "cue") {
    if (ids.length !== 1) throw new Error("자막을 하나씩 선택하여 편집할 수 있습니다.");
    text(edit.text, "자막 내용");
    finite(edit.start, "시작 시간");
    finite(edit.end, "종료 시간");
    if (edit.start < 0 || edit.end > 86400 || edit.end <= edit.start)
      throw new Error("자막 시간은 0~86400초 이내여야 하며, 종료 시간은 시작 시간보다 이후여야 합니다.");
    const start = snapToFrame(edit.start, project.fps),
      end = snapToFrame(edit.end, project.fps);
    if (end - start < 1 / project.fps - 1e-9)
      throw new Error("자막 길이가 1프레임 이상입니다.");
    const original = originals[0];
    const originalEnd = original.start + original.duration;
    if (
      Math.abs(end - start - original.duration) < 1e-9 ||
      start >= originalEnd ||
      end <= original.start
    ) {
      // A translated or disjoint cue is a move, not a crop of its old absolute envelope.
      // Keep its local animation/fades so moving an animated caption does not make it disappear.
      original.start = start;
      project = trimClip(project, original.id, "end", end);
    } else {
      if (end > originalEnd)
        project = trimClip(project, original.id, "end", end);
      if (start < original.start)
        project = trimClip(project, original.id, "start", start);
      project = trimClip(project, original.id, "start", start);
      project = trimClip(project, original.id, "end", end);
    }
    const next = cue(project, original.id);
    if (
      Math.abs(next.start - start) > 1e-8 ||
      Math.abs(next.start + next.duration - end) > 1e-8
    )
      throw new Error("선택한 자막 시간을 적용할 수 없습니다.");
    next.text!.text = edit.text;
    next.name = edit.text.slice(0, 4096);
  } else if (edit.type === "offset") {
    finite(edit.seconds, "오프셋");
    if (Math.abs(edit.seconds) > 86400) throw new Error("오프셋이 범위를 벗어났습니다.");
    const delta = snapToFrame(edit.seconds, project.fps);
    for (const clip of originals) {
      const start = snapToFrame(clip.start + delta, project.fps);
      if (start < 0 || start + clip.duration > 86400)
        throw new Error("오프셋 이후의 자막이 타임라인 범위를 벗어났습니다. 수정된 자막이 없습니다.");
      clip.start = start;
    }
  } else if (edit.type === "replace") {
    text(edit.find, "콘텐츠 찾기", false);
    text(edit.replacement, "콘텐츠 교체");
    for (const clip of originals) {
      const pieces = clip.text!.text.split(edit.find);
      const size =
        clip.text!.text.length +
        (pieces.length - 1) * (edit.replacement.length - edit.find.length);
      if (size > 20000)
        throw new Error("교체된 자막 콘텐츠는 다음과 같습니다. 유효하지 않음(최대 20000개");
      const value = pieces.join(edit.replacement);
      text(value, "자막 내용을 대체했습니다.");
      clip.text!.text = value;
      clip.name = value.slice(0, 4096);
    }
  } else if (edit.type === "style") {
    const reference = cue(project, edit.referenceId, false);
    const { text: _content, ...style } = reference.text!;
    for (const clip of originals)
      clip.text = { ...clip.text!, ...clone(style) };
  } else if (edit.type === "styleValues") {
    if (
      !edit.values ||
      Object.keys(edit.values).some(
        (k) =>
          !SUBTITLE_STYLE_FIELDS.includes(
            k as (typeof SUBTITLE_STYLE_FIELDS)[number],
          ),
      ) ||
      SUBTITLE_STYLE_FIELDS.some((k) => edit.values[k] === undefined)
    )
      throw new Error("자막 스타일 필드가 유효하지 않습니다.");
    for (const clip of originals)
      clip.text = { ...clip.text!, ...clone(edit.values) };
  } else if (edit.type === "animation") {
    const replacements = new Map(
      originals.map((c) => [
        c.id,
        subtitleAnimation(c, edit.options, project.fps),
      ]),
    );
    project.clips = project.clips.map((c) => replacements.get(c.id) ?? c);
  } else if (edit.type === "split") {
    if (ids.length !== 1) throw new Error("분할 시 자막을 선택하세요.");
    project = splitSubtitle(project, originals[0], edit.at, edit.offset);
  } else if (edit.type === "merge")
    project = mergeSubtitles(project, originals);
  else throw new Error("지원되지 않는 자막 작업");
  project = validateProject(project);
  const before = new Map(input.clips.map((c) => [c.id, c])),
    after = new Map(project.clips.map((c) => [c.id, c]));
  return {
    edit: clone(edit),
    base: JSON.stringify(input),
    project,
    changedIds: [...new Set([...before.keys(), ...after.keys()])].filter(
      (id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)),
    ),
  };
}

/** A user can keep an edit form open while the project changes elsewhere. Never overwrite it. */
export function applySubtitleEdit(
  current: Project,
  plan: SubtitleEditPlan,
): Project {
  if (JSON.stringify(current) !== plan.base)
    throw new Error("항목이 변경되었습니다. 수정 후 적용하기 전에 자막을 다시 확인하세요.");
  return validateProject(clone(plan.project));
}
