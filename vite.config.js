import { defineConfig, loadEnv } from 'vite';

// 로컬 개발 서버용 Roboflow API 프록시 미들웨어 플러그인
function roboflowLocalApiPlugin(env) {
  return {
    name: 'roboflow-local-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/detect', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }));
        }

        const apiKey = env.ROBOFLOW_API_KEY || process.env.ROBOFLOW_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(
            JSON.stringify({
              error: '로컬 환경에 ROBOFLOW_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일에 ROBOFLOW_API_KEY=your_key 를 설정해 주세요.'
            })
          );
        }

        let bodyData = '';
        req.on('data', chunk => {
          bodyData += chunk;
        });

        req.on('end', async () => {
          try {
            const parsed = JSON.parse(bodyData || '{}');
            const { image, confidence = 0.25, overlap = 0.3 } = parsed;

            if (!image) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: '분석할 이미지 데이터(base64)가 필요합니다.' }));
            }

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

            res.statusCode = roboflowResponse.status;
            res.setHeader('Content-Type', 'application/json');

            if (!roboflowResponse.ok) {
              if (roboflowResponse.status === 401 || roboflowResponse.status === 403) {
                return res.end(
                  JSON.stringify({
                    error: 'Roboflow API 키가 유효하지 않거나 권한이 없습니다. API 키를 확인해 주세요.',
                    details: data
                  })
                );
              }
              if (roboflowResponse.status === 429) {
                return res.end(
                  JSON.stringify({
                    error: 'Roboflow API 호출 한도(Rate Limit)를 초과했습니다. 잠시 후 다시 시도해 주세요.',
                    details: data
                  })
                );
              }
              return res.end(
                JSON.stringify({
                  error: data?.message || data?.error || `Roboflow API 오류 (${roboflowResponse.status})`,
                  details: data
                })
              );
            }

            return res.end(JSON.stringify(data));
          } catch (err) {
            console.error('Local detect API middleware error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `분석 실패: ${err.message}` }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [roboflowLocalApiPlugin(env)],
    server: {
      port: 5173,
      host: '0.0.0.0'
    }
  };
});
