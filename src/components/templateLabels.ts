import type { ProjectTemplate } from "../core/projectTemplates";
import type { Language } from "../i18n";
import { LIBRARY_ENGLISH } from "./libraryLabels";

export const TEMPLATE_NAMES: Readonly<Record<string, string>> = {
  promo: "Product promo · Three scenes",
  talk: "Talking head · Key points",
  gallery: "Photo story · Travel journal",
};
const textByExample: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  promo: {
    "신제품 프로모션 · 세 가지 리듬": TEMPLATE_NAMES.promo,
    "영감을 불러일으키기": "Let inspiration happen",
    "그림으로 이야기 전달": "Tell your story through pictures",
    "로컬 편집 · 무료 생성": "Edit locally · Create freely",
  },
  talk: {
    "음성 자막 · 설명할 핵심 포인트": TEMPLATE_NAMES.talk,
    "첫 번째 단계: 음성 비디오 가져오기": "Step 1: Import your talking-head video",
    "두 번째 단계: 각 자막 사본 교체": "Step 2: Replace each subtitle",
    "세 번째 단계: 리듬 조정 및 내보내기": "Step 3: Adjust the pacing and export",
    "로컬 창작교실": "Local editing workshop",
    "컬럼 코너 마커": "Corner label",
  },
  gallery: {
    "그래픽 및 텍스트 표시 · 여행 메모": TEMPLATE_NAMES.gallery,
    "길을 따라 빛을 기록하다": "Capture the light along the way",
    "삶의 색을 모으다": "Collect the colors of life",
    "다음 정지, 계속": "Next stop, a new adventure",
  },
};
const common: Readonly<Record<string, string>> = {
  "텍스트": "Text", "비디오 1": "Video 1", "오디오 1": "Audio 1", "기본 텍스트": "Default text",
  "자정 그라데이션": LIBRARY_ENGLISH["자정 그라데이션"], "민트 스트리머": LIBRARY_ENGLISH["민트 스트리머"],
  "파란색과 보라색 트랙": LIBRARY_ENGLISH["파란색과 보라색 트랙"], "어두운 좌표 격자": LIBRARY_ENGLISH["어두운 좌표 격자"],
  "따뜻한 흰색 종이 질감": LIBRARY_ENGLISH["따뜻한 흰색 종이 질감"], "일 산호 없음": LIBRARY_ENGLISH["일 산호 없음"],
  "바다 푸른 물결": LIBRARY_ENGLISH["바다 푸른 물결"],
};

/** Only a newly instantiated, explicitly built-in example is eligible. Saved or
 * imported templates must not be translated, even if their names match ours. */
export function localizeBuiltinTemplate(
  template: ProjectTemplate,
  builtinId: string | undefined,
  language: Language,
): ProjectTemplate {
  const phrases = builtinId ? textByExample[builtinId] : undefined;
  if (language === "zh-CN" || !phrases) return template;
  const result = structuredClone(template);
  const label = (value: string) => phrases[value] ?? common[value] ?? value;
  result.name = label(result.name);
  const copyName = template.name + " · 복사";
  result.project.name = result.project.name === copyName
    ? result.name + " · Copy"
    : label(result.project.name);
  result.project.tracks.forEach(track => { track.name = label(track.name); });
  result.project.assets.forEach(asset => { asset.name = label(asset.name); });
  result.project.clips.forEach(clip => {
    clip.name = label(clip.name);
    if (clip.text) clip.text.text = label(clip.text.text);
  });
  result.slots.forEach(slot => { slot.label = label(slot.label); });
  return result;
}
