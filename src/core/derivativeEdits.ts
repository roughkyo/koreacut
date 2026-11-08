import type { DerivativeRequest, MediaAsset, Project } from './types';
import { clone, evaluateKeyframes, id, snapToFrame, validateProject } from './model';
import { linkedIds, placeAsset } from './timelineEdits';

/** Shared preflight on both sides of IPC; a locked linked member blocks the entire edit. */
export function derivativePlan(p: Project, clipId: string, r: DerivativeRequest) {
  if (!r || !['reverse', 'freeze'].includes(r.mode) || !['reverse', 'mute'].includes(r.audio) ||
      !Number.isFinite(r.time) || !Number.isFinite(r.duration)) throw new Error("잘못된 미디어 처리 요청");
  const clip = p.clips.find(c => c.id === clipId), asset = p.assets.find(a => a.id === clip?.assetId);
  if (!clip || !asset || asset.kind !== 'video' || asset.missing) throw new Error("사용 가능한 비디오 클립을 선택하십시오");
  const linked = new Set(linkedIds(p, [clipId]));
  const members = p.clips.filter(c => linked.has(c.id));
  if (members.some(c => p.tracks.find(t => t.id === c.trackId)?.locked)) throw new Error("연결된 트랙을 먼저 잠금 해제하십시오");
  const frames = Math.round(clip.duration * p.fps);
  if (r.mode === 'reverse' && (frames < 1 || Math.abs(frames / p.fps - clip.duration) > 1e-6)) throw new Error("먼저 클립 지속 시간을 프로젝트 프레임에 맞추십시오");
  if (r.mode === 'reverse') {
    if (clip.duration > 3600) throw new Error("최대 단일 재생 60분, 먼저 클립을 분할하십시오");
    if (members.some(c => { const a = p.assets.find(a => a.id === c.assetId); return a?.path !== asset.path ||
      c.sourceIn !== clip.sourceIn || c.speed !== clip.speed || c.duration !== clip.duration || c.start !== clip.start; }))
      throw new Error("연결된 클립의 소스 범위가 다릅니다. 먼저 연결을 해제한 다음 재생하십시오 뒤로");
  } else {
    const time = snapToFrame(r.time, p.fps);
    if (time < clip.start || time >= clip.start + clip.duration || r.duration < 1 / p.fps || r.duration > 3600)
      throw new Error("재생헤드를 선택한 영상으로 이동해주세요. 정지 기간은 1프레임에서 60분 사이여야 합니다.");
    // Preflight ripple locks before doing any media work.
    if (p.clips.some(c => c.start + c.duration > time + 1e-8 && p.tracks.find(t => t.id === c.trackId)?.locked))
      throw new Error("고정 프레임을 삽입하면 잠긴 트랙이 이동합니다. 먼저 잠금을 해제하십시오.");
  }
  return { clip, asset, members, frames, time: snapToFrame(r.time, p.fps) };
}

export function applyDerivative(p: Project, clipId: string, r: DerivativeRequest, asset: MediaAsset): { project: Project; clipId: string } {
  const plan = derivativePlan(p, clipId, r);
  if (asset.kind !== (r.mode === 'reverse' ? 'video' : 'image')) throw new Error("파생 자료 유형 불일치");
  const next = clone(p); next.assets.push(asset);
  if (r.mode === 'reverse') {
    const ids = new Set(plan.members.map(c => c.id));
    const audio = plan.members.some(c => p.assets.find(a => a.id === c.assetId)?.kind === 'audio')
      ? { ...asset, id: id(), kind: 'audio' as const, name: asset.name + " · 오디오", width: 0, height: 0, thumbnail: undefined } : undefined;
    if (audio) next.assets.push(audio);
    next.clips = next.clips.map(c => !ids.has(c.id) ? c : { ...c,
      assetId: p.assets.find(a => a.id === c.assetId)?.kind === 'audio' ? audio!.id : asset.id,
      name: c.name + " · 역방향", sourceIn: 0, speed: 1, muted: r.audio === 'mute' || c.muted,
    });
    return { project: validateProject(next), clipId };
  }
  const placed = placeAsset(next, asset.id, plan.clip.trackId, plan.time, { sourceIn: 0, duration: r.duration }, 'insert');
  const evaluated = evaluateKeyframes(plan.clip, plan.time - plan.clip.start);
  placed.project.clips = placed.project.clips.map(c => c.id !== placed.clipId ? c : {
    ...c, name: plan.clip.name + " · 프레임 고정", transform: clone(evaluated.transform), adjustments: clone(evaluated.adjustments),
    crop: clone(evaluated.crop), mask: clone(evaluated.mask), chromaKey: clone(evaluated.chromaKey),
  });
  return { ...placed, project: validateProject(placed.project) };
}
