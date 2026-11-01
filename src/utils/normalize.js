/**
 * Roboflow 모델의 영문/한글 클래스명을 Smart Recipe 표준 한국어 식재료 이름으로 정규화합니다.
 */

// 식재료 정규화 매핑 테이블
const INGREDIENT_MAP = {
  // 토마토
  tomato: '토마토',
  tomatoes: '토마토',
  'cherry tomato': '토마토',
  'cherry-tomato': '토마토',
  'cherry tomatoes': '토마토',
  방울토마토: '토마토',
  토마토: '토마토',

  // 감자
  potato: '감자',
  potatoes: '감자',
  감자: '감자',

  // 당근
  carrot: '당근',
  carrots: '당근',
  당근: '당근',

  // 양파
  onion: '양파',
  onions: '양파',
  'red onion': '양파',
  양파: '양파',

  // 계란
  egg: '계란',
  eggs: '계란',
  'boiled egg': '계란',
  달걀: '계란',
  계란: '계란',

  // 브로콜리
  broccoli: '브로콜리',
  brocolli: '브로콜리',
  브로콜리: '브로콜리',

  // 사과
  apple: '사과',
  apples: '사과',
  'red apple': '사과',
  'green apple': '사과',
  사과: '사과',

  // 바나나
  banana: '바나나',
  bananas: '바나나',
  바나나: '바나나',

  // 오이
  cucumber: '오이',
  cucumbers: '오이',
  오이: '오이',

  // 버섯
  mushroom: '버섯',
  mushrooms: '버섯',
  버섯: '버섯',

  // 추가 식재료 지원
  cabbage: '양배추',
  양배추: '양배추',
  garlic: '마늘',
  마늘: '마늘',
  pepper: '고추',
  'bell pepper': '파프리카',
  파프리카: '파프리카',
  tofu: '두부',
  두부: '두부',
  pumpkin: '단호박',
  호박: '호박'
};

/**
 * 원본 클래스명을 정규화된 한국어 식재료명으로 변환합니다.
 * 매핑 테이블에 없는 경우 문자열 트림 후 그대로 반환합니다.
 * @param {string} rawClass
 * @returns {string} 정규화된 식재료명
 */
export function normalizeIngredientName(rawClass) {
  if (!rawClass || typeof rawClass !== 'string') return '알 수 없음';

  const cleaned = rawClass.trim().toLowerCase().replace(/[-_]+/g, ' ');
  if (INGREDIENT_MAP[cleaned]) {
    return INGREDIENT_MAP[cleaned];
  }

  // 한글 입력 그대로인 경우 등 원형 반환
  const originalCleaned = rawClass.trim();
  return INGREDIENT_MAP[originalCleaned] || originalCleaned;
}
