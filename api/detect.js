/**
 * Vercel Serverless Function: /api/detect
 * Roboflow Object Detection API를 비공개 API Key로 중계합니다.
 */

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: '서버에 ROBOFLOW_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일 또는 Vercel 환경 변수를 확인해 주세요.'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // 이미 문자열이거나 파싱 실패 시 계속 진행
      }
    }

    const { image, confidence = 0.25, overlap = 0.3 } = body || {};

    if (!image) {
      return res.status(400).json({ error: '분석할 이미지 데이터(base64)가 필요합니다.' });
    }

    // data:image/...;base64, 접두사 제거
    const cleanBase64 = image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const modelEndpoint = `https://detect.roboflow.com/ingredient-classification/10?api_key=${encodeURIComponent(
      apiKey
    )}&confidence=${confidence}&overlap=${overlap}`;

    const roboflowResponse = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: cleanBase64
    });

    const data = await roboflowResponse.json().catch(() => null);

    if (!roboflowResponse.ok) {
      const status = roboflowResponse.status;
      if (status === 401 || status === 403) {
        return res.status(status).json({
          error: 'Roboflow API 키가 유효하지 않거나 권한이 없습니다. API 키를 확인해 주세요.',
          details: data
        });
      }
      if (status === 429) {
        return res.status(429).json({
          error: 'Roboflow API 호출 한도(Rate Limit)를 초과했습니다. 잠시 후 다시 시도해 주세요.',
          details: data
        });
      }
      return res.status(status).json({
        error: data?.message || data?.error || `Roboflow API 오류가 발생했습니다. (상태 코드: ${status})`,
        details: data
      });
    }

    if (!data || !Array.isArray(data.predictions)) {
      return res.status(502).json({
        error: 'Roboflow 서버로부터 올바른 예측 결과를 받지 못했습니다.',
        raw: data
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Inference error:', err);
    return res.status(500).json({
      error: `서버 내부 오류로 이미지 분석에 실패했습니다: ${err.message}`
    });
  }
}
