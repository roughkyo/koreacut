import { createClip, createProject, createTrack, id } from "./model";
import { defaultTemplate } from "./projectTemplates";
import { subtitleAnimation } from "./subtitleWorkflow";
import type { MediaAsset } from "./types";
export const TEMPLATE_EXAMPLES = [
  {
    id: "promo",
    name: "신제품 프로모션 · 세 가지 리듬",
    background: "bg-midnight",
    media: ["bg-midnight", "bg-mint", "bg-orbit"],
    description: "3개의 장면과 제목이 포함된 가로 화면 홍보 동영상 12초, 제품 동영상으로 대체하기에 적합합니다.",
  },
  {
    id: "talk",
    name: "음성 자막 · 설명할 핵심 포인트",
    background: "bg-grid",
    media: ["bg-grid"],
    description:
      "12초 음성 형식, 3개의 자막 및 자막; 메인 화면을 나만의 음성 비디오로 교체하세요.",
  },
  {
    id: "gallery",
    name: "그래픽 및 텍스트 표시 · 여행 메모",
    background: "bg-paper",
    media: ["bg-paper", "bg-sunrise", "bg-ocean"],
    description: "12초 그래픽 및 텍스트 표시, 3개 세그먼트의 이미지 및 카피라이팅, 독립적으로 조정 가능한 확대 애니메이션 유지.",
  },
] as const;
export function buildTemplateExample(key: string, assets: MediaAsset[]) {
  const def = TEMPLATE_EXAMPLES.find((d) => d.id === key);
  if (!def || assets.length !== def.media.length)
    throw new Error("원본 샘플이 존재하지 않거나 자료가 불완전합니다.");
  const p = createProject(def.name);
  p.width = 640;
  p.height = 360;
  p.assets = assets;
  const video = p.tracks.find((t) => t.kind === "video")!,
    text = p.tracks[0];
  const messages =
    key === "promo"
      ? ["영감을 불러일으키기", "그림으로 이야기 전달", "로컬 편집 · 무료 생성"]
      : key === "talk"
        ? [
            "첫 번째 단계: 음성 비디오 가져오기",
            "두 번째 단계: 각 자막 사본 교체",
            "세 번째 단계: 리듬 조정 및 내보내기",
          ]
        : ["길을 따라 빛을 기록하다", "삶의 색을 모으다", "다음 정지, 계속"];
  for (let i = 0; i < assets.length; i++) {
    const c = createClip(
      assets[i],
      video.id,
      key === "talk" ? 0 : i * 4,
      p.fps,
    );
    c.duration = key === "talk" ? 12 : 4;
    if (key === "gallery")
      c.keyframes = [
        { id: id(), property: "scale", time: 0, value: 1, easing: "linear" },
        {
          id: id(),
          property: "scale",
          time: 4,
          value: 1.08,
          easing: "easeInOut",
        },
      ];
    p.clips.push(c);
  }
  for (let i = 0; i < 3; i++) {
    let c = createClip(undefined, text.id, i * 4, p.fps);
    c.duration = 4;
    c.text = {
      ...c.text!,
      text: messages[i],
      fontSize: key === "talk" ? 26 : 32,
      background: "#101015cc",
      strokeWidth: 0,
    };
    c.transform.y = key === "talk" ? 110 : 65;
    c = subtitleAnimation(
      c,
      {
        entrance: "slide-up",
        exit: "fade",
        inDuration: 0.4,
        outDuration: 0.4,
        distance: 18,
        hold: "still",
      },
      p.fps,
    );
    p.clips.push(c);
  }
  if (key === "talk") {
    const track = createTrack("text", "컬럼 코너 마커");
    p.tracks.unshift(track);
    const c = createClip(undefined, track.id, 0, p.fps);
    c.duration = 12;
    c.text = {
      ...c.text!,
      text: "로컬 창작교실",
      fontSize: 20,
      color: "#40ead3",
      strokeWidth: 0,
    };
    c.transform.y = -140;
    p.clips.push(c);
  }
  return defaultTemplate(p);
}
