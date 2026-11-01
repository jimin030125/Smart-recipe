import { normalizeIngredientName } from '../utils/normalize';

/**
 * File 객체를 Base64 Data URL 문자열로 변환합니다.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * HTMLImageElement로부터 Base64 Data URL을 생성합니다.
 * @param {HTMLImageElement} imgElement
 * @returns {string}
 */
export function imageElementToBase64(imgElement) {
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.naturalWidth || imgElement.width;
  canvas.height = imgElement.naturalHeight || imgElement.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * 서버리스 API (/api/detect)를 호출하여 Roboflow 객체 탐지를 수행합니다.
 * @param {string} base64Image
 * @param {object} options { confidence, overlap }
 * @returns {Promise<{ predictions: Array, image: { width: number, height: number } }>}
 */
export async function detectIngredients(base64Image, options = {}) {
  const { confidence = 0.25, overlap = 0.3 } = options;

  let response;
  try {
    response = await fetch('/api/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64Image,
        confidence,
        overlap
      })
    });
  } catch (netErr) {
    throw new Error('API 서버에 연결할 수 없습니다. 로컬 서버(npm run dev)가 실행 중인지 확인해 주세요.');
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = result?.error || `분석 요청 실패 (상태 코드: ${response.status})`;
    throw new Error(errorMsg);
  }

  const rawPredictions = result.predictions || [];
  const imgMeta = result.image || { width: 0, height: 0 };

  // 각 탐지 객체 정규화 및 바운딩 박스 계산
  const predictions = rawPredictions.map((pred, index) => {
    const rawClass = pred.class || 'unknown';
    const normalizedName = normalizeIngredientName(rawClass);
    const confidenceVal = typeof pred.confidence === 'number' ? pred.confidence : 0;

    // Roboflow: x, y는 박스 중심점
    const x = pred.x;
    const y = pred.y;
    const width = pred.width;
    const height = pred.height;

    const xMin = Math.max(0, x - width / 2);
    const yMin = Math.max(0, y - height / 2);

    return {
      id: pred.detection_id || `det-${index}-${Date.now()}`,
      rawClass,
      name: normalizedName,
      confidence: confidenceVal,
      bbox: {
        x,
        y,
        width,
        height,
        xMin,
        yMin
      },
      selected: true // 사용자가 선택/해제 가능하도록 기본값 true
    };
  });

  return {
    image: imgMeta,
    predictions
  };
}
