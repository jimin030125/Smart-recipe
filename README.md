# Smart Recipe

AI 기반 식재료 다중 객체 탐지(Roboflow Object Detection) 및 맞춤 레시피 추천 웹 애플리케이션 (React + Vite).

---

## 🌟 주요 기능

1. **AI 다중 식재료 객체 탐지 (Roboflow Universe)**
   - 모델: `https://universe.roboflow.com/tf-cpeu2/ingredient-classification` (ID: `ingredient-classification/10`)
   - 한 장의 사진에 포함된 여러 식재료를 동시에 탐지
   - 바운딩 박스(위치), 라벨(식재료명), 신뢰도(Confidence %) 캔버스 오버레이 시각화
   - 영문/한국어 클래스명을 Smart Recipe 표준 한국어 식재료명으로 자동 정규화
   - 탐지 결과 목록에서 재료 이름 수정 및 선택 등록 기능 제공

2. **스마트 냉장고 관리**
   - 탐지된 식재료 중복 자동 통합 (예: 토마토 3개가 탐지되어도 냉장고에는 1회만 등록)
   - 식재료 수동 추가/삭제 및 브라우저 로컬 스토리지 자동 저장

3. **맞춤 레시피 추천**
   - 냉장고에 등록된 식재료와 레시피 간의 일치율(Score %)을 실시간 계산하여 최적의 요리 추천
   - 부족한 재료 목록 및 상세 조리법 안내

4. **대시보드 통계**
   - 보유 식재료 수, 최근 AI 탐지 기록, 완비 레시피 수 시각화

5. **보안 및 서버리스 아키텍처**
   - Vercel Serverless Function (`api/detect.js`)을 통해 비공개 Roboflow API 키 보호
   - Vite 개발 서버 미들웨어를 통해 로컬(`npm run dev`)에서도 추가 서버 없이 즉시 동작

---

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일에 발급받은 Roboflow API 키를 입력합니다:
```bash
ROBOFLOW_API_KEY=your_roboflow_private_api_key
```

### 3. 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:5173`으로 접속합니다.

### 4. 프로덕션 빌드
```bash
npm run build
```

---

## ☁️ Vercel 배포 가이드

1. GitHub 저장소에 코드를 Push합니다.
2. [Vercel](https://vercel.com/) 대시보드에서 해당 저장소를 Import합니다.
   - **Framework Preset**: Vite
   - **Root Directory**: `smart-recipe` (프로젝트 구조에 맞게 설정)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables** 설정:
   - Key: `ROBOFLOW_API_KEY`
   - Value: 사용자의 Roboflow Private API Key
4. 배포 완료 후 제공되는 도메인에서 `/api/detect` 서버리스 함수와 함께 즉시 서비스 이용이 가능합니다.
