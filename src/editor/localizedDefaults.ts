import { createClip, createProject, createTrack } from "../core/model";
import type { MediaAsset, TrackKind } from "../core/types";
import { translateUI } from "../i18n/uiTranslation";

/** Localize only newly generated defaults. Saved/imported names and text are
 * user content and must never change when the interface language changes. */
export function createEditorTrack(kind: TrackKind, name?: string) {
  const labels: Record<TrackKind, [string, string]> = {
    video: ["영상", "Video"], image: ["화면", "Image"],
    audio: ["오디오", "Audio"], text: ["텍스트", "Text"],
  };
  return createTrack(kind, name ?? translateUI(...labels[kind]));
}
export function createEditorProject() {
  const project = createProject(translateUI("제목 없는 프로젝트", "Untitled project"));
  project.tracks = [createEditorTrack("text"), createEditorTrack("video", translateUI("비디오 1", "Video 1")), createEditorTrack("audio", translateUI("오디오 1", "Audio 1"))];
  return project;
}
export function createEditorClip(asset: MediaAsset | undefined, trackId: string, start: number, fps: number) {
  const clip = createClip(asset, trackId, start, fps);
  if (!asset && clip.text) {
    clip.name = translateUI("기본 텍스트", "Default text");
    clip.text.text = translateUI("여기에 텍스트를 입력하세요", "Enter text here");
  }
  return clip;
}
