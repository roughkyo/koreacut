/** Original ReaCut assets. Files are generated locally by scripts/generate-assets.ts. */
export type BuiltinAssetCategory = "stickers" | "backgrounds" | "titles" | "sounds";
export interface BuiltinAsset {
  id: string;
  name: string;
  category: BuiltinAssetCategory;
  kind: "image" | "audio";
  fileName: string;
  width: number;
  height: number;
  duration: number;
  tags: string[];
  transparent: boolean;
}
const image = (id: string, name: string, category: Exclude<BuiltinAssetCategory, "sounds">, tags: string[]): BuiltinAsset => ({
  id, name, category, kind: "image", fileName: `${id}.png`,
  width: category === "stickers" ? 512 : 1920,
  height: category === "stickers" ? 512 : 1080,
  duration: 5, tags, transparent: category !== "backgrounds",
});
const sound = (id: string, name: string, duration: number, tags: string[]): BuiltinAsset => ({
  id, name, category: "sounds", kind: "audio", fileName: `${id}.wav`,
  width: 0, height: 0, duration, tags, transparent: false,
});
export const BUILTIN_ASSETS: readonly BuiltinAsset[] = [
  image("sparkle", "네모난 별빛", "stickers", ["별", "빛나다", "sparkle"]),
  image("burst", "활력 폭발 스티커", "stickers", ["폭발", "강조", "burst"]),
  image("heart", "산호 하트", "stickers", ["하트", "좋아요", "heart"]),
  image("arrow-curved", "손으로 그린 회전 화살표", "stickers", ["화살표", "가이드", "arrow"]),
  image("arrow-left", "되감기 왼쪽", "stickers", ["되감기", "화살표", "reverse"]),
  image("play", "민트 재생 버튼", "stickers", ["재생", "영상", "play"]),
  image("check", "완료 진드기", "stickers", ["성공", "완료", "check"]),
  image("pin", "여행 포지셔닝", "stickers", ["여행", "위치", "pin"]),
  image("speech", "대화 가스 버블", "stickers", ["대화", "텍스트", "speech"]),
  image("quote", "인용 기호", "stickers", ["인터뷰", "인용문", "quote"]),
  image("film", "미니필름", "stickers", ["영화", "영화", "film"]),
  image("clap", "클립보드", "stickers", ["필드 노트", "영화", "clap"]),
  image("sun", "일광 작은 태양", "stickers", ["날씨", "햇빛", "sun"]),
  image("rainbow", "부드러운 무지개", "stickers", ["무지개", "생명", "rainbow"]),
  image("confetti", "축하 색종이 조각", "stickers", ["축하", "축제", "confetti"]),
  image("focus", "보기 프레임", "stickers", ["렌즈", "집중", "focus"]),
  image("bg-midnight", "자정 그라데이션", "backgrounds", ["진한 파란색", "그라데이션", "dark"]),
  image("bg-sunrise", "일 산호 없음", "backgrounds", ["따뜻한 색상", "그라데이션", "warm"]),
  image("bg-mint", "민트 스트리머", "backgrounds", ["신선함", "녹색", "mint"]),
  image("bg-paper", "따뜻한 흰색 종이 질감", "backgrounds", ["종이", "미니멀리스트", "paper"]),
  image("bg-grid", "어두운 좌표 격자", "backgrounds", ["기술", "그리드", "grid"]),
  image("bg-orbit", "파란색과 보라색 트랙", "backgrounds", ["기술", "링", "orbit"]),
  image("title-mint", "민트 캐릭터 스트립", "titles", ["문자", "하위 1/3", "인터뷰"]),
  image("title-coral", "산호 자막 스트립", "titles", ["자막", "하위 1/3", "제목"]),
  image("title-glass", "어둠 정보 카드", "titles", ["메시지", "카드", "제목"]),
  image("title-frame", "영화 가는 선 테두리", "titles", ["테두리", "영화", "제목"]),
  image("title-corner", "코너 및 사이드바", "titles", ["코너", "칼럼", "제목"]),
  image("title-ribbon", "키 스트리머", "titles", ["포인트", "스트리머", "제목"]),
  sound("sound-pop", "라이트 버블", 0.25, ["거품", "전환", "pop"]),
  sound("sound-click", "부드러운 클릭", 0.12, ["클릭", "인터페이스", "click"]),
  sound("sound-chime", "명확한 프롬프트", 1.2, ["벨소리", "팁", "chime"]),
  sound("sound-rise", "위쪽 슬라이드", 0.65, ["상승", "전환", "rise"]),
  sound("sound-whoosh", "Air Sweep", 0.8, ["플래시", "전환", "whoosh"]),
  sound("sound-complete", "삼중톤 완료", 1.4, ["성공", "완료", "complete"]),
  image("bolt", "번개 강조", "stickers", ["번개", "에너지", "bolt"]),
  image("cloud", "부드러운 구름꽃", "stickers", ["날씨", "하늘", "cloud"]),
  image("moon", "달밤 별", "stickers", ["달", "밤", "moon"]),
  image("leaf", "새싹과 녹색 잎", "stickers", ["식물", "자연", "leaf"]),
  image("flame", "열 불꽃", "stickers", ["불꽃", "핫", "flame"]),
  image("camera", "여행 카메라", "stickers", ["사진", "여행", "camera"]),
  image("headphones", "개인용 헤드폰", "stickers", ["음악", "청취", "headphones"]),
  image("microphone", "팟캐스트 마이크", "stickers", ["녹음", "인터뷰", "microphone"]),
  image("coffee", "커피 순간", "stickers", ["생명", "음료", "coffee"]),
  image("paw", "귀여운 애완동물 발자국", "stickers", ["동물", "애완동물", "paw"]),
  image("medal", "하이라이트 메달", "stickers", ["보상", "업적", "medal"]),
  image("clock", "시간 알림", "stickers", ["시계", "카운트다운", "clock"]),
  image("bg-aurora", "오로라 밤", "backgrounds", ["오로라", "야경", "aurora"]),
  image("bg-ocean", "바다 푸른 물결", "backgrounds", ["바다", "파란색", "ocean"]),
  image("bg-lavender", "라벤더 후광", "backgrounds", ["보라색", "환상", "lavender"]),
  image("bg-peach", "복숭아 기하학", "backgrounds", ["분홍색", "기하학", "peach"]),
  image("bg-sand", "사막 모래 언덕", "backgrounds", ["사막", "자연", "sand"]),
  image("bg-dots", "크림색 물방울", "backgrounds", ["파도점", "귀여운", "dots"]),
  image("bg-blueprint", "엔지니어링 청사진", "backgrounds", ["청사진", "기술", "blueprint"]),
  image("bg-comic", "코믹 방출", "backgrounds", ["코믹", "강조", "comic"]),
  image("title-pill", "둥근 모서리 이름표", "titles", ["문자", "둥근 모서리", "pill"]),
  image("title-news", "정보 이중바", "titles", ["정보", "뉴스", "news"]),
  image("title-split", "2색 챕터 카드", "titles", ["챕터", "분할 화면", "split"]),
  image("title-subtitle", "부드럽고 어두운 자막 하단", "titles", ["자막", "그라데이션", "subtitle"]),
  image("title-tape", "접착 테이프", "titles", ["핸드북", "테이프", "tape"]),
  image("title-chapter", "미니멀리스트 챕터 라인", "titles", ["챕터", "미니멀리스트", "chapter"]),
  sound("sound-shutter", "전자 셔터", 0.22, ["사진", "셔터", "shutter"]),
  sound("sound-impact", "저주파 강조", 0.5, ["드럼", "강조", "impact"]),
  sound("sound-twinkle", "별 알림", 1.5, ["팁", "별빛", "twinkle"]),
  sound("sound-fall", "아래쪽 슬라이드", 0.65, ["하강", "전환", "fall"]),
];
export const BUILTIN_CATEGORIES: { id: BuiltinAssetCategory; name: string }[] = [
  { id: "stickers", name: "스티커" }, { id: "backgrounds", name: "배경" },
  { id: "titles", name: "제목 기반" }, { id: "sounds", name: "음향 효과" },
];
export function findBuiltinAsset(id: string): BuiltinAsset | undefined {
  return BUILTIN_ASSETS.find((asset) => asset.id === id);
}
export function filterBuiltinAssets(category: BuiltinAssetCategory | "all", query: string): BuiltinAsset[] {
  const text = query.trim().toLocaleLowerCase();
  return BUILTIN_ASSETS.filter((asset) => (category === "all" || asset.category === category) &&
    `${asset.name} ${asset.tags.join(" ")}`.toLocaleLowerCase().includes(text));
}
export function builtinAssetUrl(asset: BuiltinAsset): string {
  return `${import.meta.env.BASE_URL}builtin-assets/${asset.fileName}`;
}
