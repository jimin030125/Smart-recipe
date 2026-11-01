import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  ChefHat,
  Refrigerator,
  Trash2,
  Plus,
  Search,
  BookOpen,
  AlertCircle,
  ChartNoAxesColumn,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  Layers,
  Clock,
  Flame,
  Users,
  Lightbulb,
  Check,
  X,
  Sparkles,
  Filter
} from 'lucide-react';
import { ingredients as defaultIngredients, recommend } from './recipes';
import { fileToBase64, detectIngredients } from './services/roboflow';
import { normalizeIngredientName } from './utils/normalize';

const emojis = {
  토마토: '🍅',
  감자: '🥔',
  당근: '🥕',
  양파: '🧅',
  계란: '🥚',
  브로콜리: '🥦',
  사과: '🍎',
  바나나: '🍌',
  오이: '🥒',
  버섯: '🍄',
  양배추: '🥬',
  마늘: '🧄',
  고추: '🌶️',
  파프리카: '🫑',
  두부: '🧊',
  단호박: '🎃',
  호박: '🎃',
  '알 수 없음': '❓'
};

const BOX_COLORS = [
  '#16a34a', // 초록
  '#ea580c', // 주황
  '#0284c7', // 파랑
  '#9333ea', // 보라
  '#e11d48', // 빨강
  '#ca8a04', // 황금
  '#0d9488', // 청록
  '#db2777'  // 핑크
];

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [tab, setTab] = useState('home');
  const [owned, setOwned] = useState(() => load('sr-owned', []));
  const [history, setHistory] = useState(() => load('sr-history', []));
  const [customRecipes, setCustomRecipes] = useState(() => load('sr-custom-recipes', []));

  // 이미지 및 Roboflow 객체 탐지 상태
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [detections, setDetections] = useState([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);
  const [hoveredId, setHoveredId] = useState(null);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'success' | 'error'
  const [busy, setBusy] = useState(false);

  // 레시피 검색, 카테고리 필터, 모달 상태
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [detail, setDetail] = useState(null);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);

  // 새 레시피 작성 폼 상태
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category: '볶음/일품',
    items: [],
    customItemInput: '',
    servings: '1~2인분',
    time: 20,
    difficulty: '쉬움',
    calories: '약 250 kcal',
    ingredientsDetailText: '',
    seasoningsText: '',
    stepsText: '',
    tip: ''
  });

  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => localStorage.setItem('sr-owned', JSON.stringify(owned)), [owned]);
  useEffect(() => localStorage.setItem('sr-history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('sr-custom-recipes', JSON.stringify(customRecipes)), [customRecipes]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // 냉장고에 단일 재료 추가
  const add = (x) => {
    if (!x) return;
    setOwned((v) => (v.includes(x) ? v : [...v, x]));
    setStatusType('success');
    setStatus(`'${x}' 재료가 냉장고에 추가되었습니다.`);
  };

  // 이미지 업로드 핸들러
  const upload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024) {
      setStatusType('error');
      setStatus('JPG, PNG, WEBP 형식의 10MB 이하 이미지를 선택해 주세요.');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDetections([]);
    setStatusType('info');
    setStatus('이미지가 준비되었습니다. [식재료 객체 탐지 시작] 버튼을 눌러주세요.');
  };

  // 바운딩 박스 캔버스 렌더링
  const drawBoundingBoxes = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const naturalWidth = img.naturalWidth || displayWidth;
    const naturalHeight = img.naturalHeight || displayHeight;

    if (!naturalWidth || !naturalHeight || !displayWidth || !displayHeight) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const scaleX = displayWidth / naturalWidth;
    const scaleY = displayHeight / naturalHeight;

    detections.forEach((det, idx) => {
      const color = BOX_COLORS[idx % BOX_COLORS.length];
      const isHovered = hoveredId === det.id;

      const xMin = det.bbox.xMin * scaleX;
      const yMin = det.bbox.yMin * scaleY;
      const width = det.bbox.width * scaleX;
      const height = det.bbox.height * scaleY;

      ctx.lineWidth = isHovered ? 4 : det.selected ? 2.5 : 1.5;
      ctx.strokeStyle = det.selected ? color : '#94a3b8';
      ctx.setLineDash(det.selected ? [] : [4, 4]);
      ctx.strokeRect(xMin, yMin, width, height);

      if (isHovered) {
        ctx.fillStyle = `${color}33`;
        ctx.fillRect(xMin, yMin, width, height);
      } else if (det.selected) {
        ctx.fillStyle = `${color}15`;
        ctx.fillRect(xMin, yMin, width, height);
      }

      const labelText = `${det.name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const tagHeight = 22;
      const tagWidth = textWidth + 14;

      ctx.setLineDash([]);
      ctx.fillStyle = det.selected ? color : '#64748b';
      const labelY = Math.max(0, yMin - tagHeight);
      ctx.beginPath();
      ctx.roundRect(xMin, labelY, tagWidth, tagHeight, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, xMin + 7, labelY + 15);
    });
  }, [detections, hoveredId]);

  useEffect(() => {
    drawBoundingBoxes();
    const handleResize = () => drawBoundingBoxes();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawBoundingBoxes]);

  // Roboflow 객체 탐지 실행
  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setStatusType('info');
    setStatus('Roboflow 객체 탐지 모델로 식재료들을 분석하고 있습니다...');

    try {
      const base64 = await fileToBase64(file);
      const data = await detectIngredients(base64, {
        confidence: confidenceThreshold,
        overlap: 0.3
      });

      const preds = data.predictions || [];
      setDetections(preds);

      if (preds.length === 0) {
        setStatusType('error');
        setStatus('탐지된 식재료가 없습니다. 사진 속 조명이나 각도를 조절하거나, 신뢰도 임계값을 낮춰 보세요.');
      } else {
        setStatusType('success');
        setStatus(`총 ${preds.length}개의 식재료 객체가 탐지되었습니다! 결과를 확인하고 냉장고에 등록하세요.`);

        const dateStr = new Date().toLocaleString('ko-KR');
        const newHistoryItems = preds.map((p) => ({
          date: dateStr,
          name: p.name,
          confidence: p.confidence
        }));
        setHistory((h) => [...newHistoryItems, ...h].slice(0, 30));
      }
    } catch (e) {
      console.error(e);
      setStatusType('error');
      setStatus(e.message || '식재료 분석 중 오류가 발생했습니다.');
      setDetections([]);
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (id) => {
    setDetections((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d))
    );
  };

  const updateIngredientName = (id, newName) => {
    setDetections((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: newName } : d))
    );
  };

  const removeDetection = (id) => {
    setDetections((prev) => prev.filter((d) => d.id !== id));
  };

  const addSelectedToFridge = () => {
    const selectedItems = detections.filter((d) => d.selected && d.name && d.name !== '알 수 없음');
    if (selectedItems.length === 0) {
      setStatusType('error');
      setStatus('선택된 유효한 식재료가 없습니다.');
      return;
    }

    const uniqueNames = [...new Set(selectedItems.map((d) => d.name))];
    const newItems = uniqueNames.filter((name) => !owned.includes(name));

    if (newItems.length === 0) {
      setStatusType('info');
      setStatus('선택한 재료는 이미 모두 냉장고에 등록되어 있습니다.');
      return;
    }

    setOwned((prev) => [...prev, ...newItems]);
    setStatusType('success');
    setStatus(`냉장고에 ${newItems.join(', ')} (총 ${newItems.length}종) 재료가 등록되었습니다!`);
  };

  // 커스텀 레시피 등록 핸들러
  const handleSaveCustomRecipe = (e) => {
    e.preventDefault();
    if (!newRecipe.name.trim()) {
      alert('레시피 이름을 입력해 주세요.');
      return;
    }
    if (newRecipe.items.length === 0) {
      alert('주요 식재료를 최소 1개 이상 선택해 주세요.');
      return;
    }

    const stepsArray = newRecipe.stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const ingredientsDetailArray = newRecipe.ingredientsDetailText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const seasoningsArray = newRecipe.seasoningsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const createdRecipe = {
      id: `custom-${Date.now()}`,
      name: newRecipe.name.trim(),
      category: newRecipe.category || '기타',
      items: newRecipe.items,
      servings: newRecipe.servings || '1~2인분',
      calories: newRecipe.calories || '약 250 kcal',
      time: parseInt(newRecipe.time, 10) || 20,
      difficulty: newRecipe.difficulty || '보통',
      ingredientsDetail:
        ingredientsDetailArray.length > 0
          ? ingredientsDetailArray
          : newRecipe.items.map((it) => `${it} 적당량`),
      seasonings: seasoningsArray.length > 0 ? seasoningsArray : ['소금 약간', '식용유 적당량'],
      steps:
        stepsArray.length > 0
          ? stepsArray
          : ['재료를 깨끗이 손질합니다.', '팬에서 익힌 뒤 간을 맞춥니다.'],
      tip: newRecipe.tip.trim() || '기호에 따라 양념의 양을 조절해 보세요.',
      isCustom: true
    };

    setCustomRecipes((prev) => [createdRecipe, ...prev]);
    setIsAddRecipeOpen(false);

    // 폼 초기화
    setNewRecipe({
      name: '',
      category: '볶음/일품',
      items: [],
      customItemInput: '',
      servings: '1~2인분',
      time: 20,
      difficulty: '쉬움',
      calories: '약 250 kcal',
      ingredientsDetailText: '',
      seasoningsText: '',
      stepsText: '',
      tip: ''
    });

    setStatusType('success');
    setStatus(`나만의 레시피 '${createdRecipe.name}'이(가) 성공적으로 등록되었습니다!`);
  };

  // 커스텀 레시피 삭제
  const handleDeleteCustomRecipe = (recipeId, e) => {
    e.stopPropagation();
    if (window.confirm('정말로 이 레시피를 삭제하시겠습니까?')) {
      setCustomRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      if (detail?.id === recipeId) setDetail(null);
    }
  };

  // 식재료 토글 (새 레시피 작성 폼)
  const toggleRecipeItem = (item) => {
    setNewRecipe((prev) => {
      const exists = prev.items.includes(item);
      return {
        ...prev,
        items: exists ? prev.items.filter((x) => x !== item) : [...prev.items, item]
      };
    });
  };

  const addCustomItemToRecipe = () => {
    const val = newRecipe.customItemInput.trim();
    if (!val) return;
    if (!newRecipe.items.includes(val)) {
      setNewRecipe((prev) => ({
        ...prev,
        items: [...prev.items, val],
        customItemInput: ''
      }));
    } else {
      setNewRecipe((prev) => ({ ...prev, customItemInput: '' }));
    }
  };

  // 레시피 목록 계산 (기본 레시피 + 커스텀 레시피)
  const allRecommended = recommend(owned, customRecipes);
  const categories = ['전체', '볶음/일품', '반찬', '샐러드', '수프/양식', '브런치/간식', '나만의 레시피'];

  const filteredRecipes = allRecommended.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    if (categoryFilter === '전체') return true;
    if (categoryFilter === '나만의 레시피') return r.isCustom;
    if (categoryFilter === '브런치/간식') {
      return (
        r.category?.includes('브런치') ||
        r.category?.includes('간식') ||
        r.category?.includes('전') ||
        r.category?.includes('디저트')
      );
    }
    return r.category?.includes(categoryFilter);
  });

  const tabs = [
    ['home', '홈', ChefHat],
    ['analyze', 'AI 분석', Camera],
    ['fridge', '나의 냉장고', Refrigerator],
    ['recipes', '레시피', BookOpen],
    ['stats', '대시보드', ChartNoAxesColumn]
  ];

  const selectedCount = detections.filter((d) => d.selected).length;
  const uniqueSelectedCount = new Set(
    detections.filter((d) => d.selected && d.name).map((d) => d.name)
  ).size;

  return (
    <>
      <header>
        <div className="header-inner">
          <button className="brand" onClick={() => setTab('home')}>
            <ChefHat /> Smart Recipe
          </button>
          <nav>
            {tabs.map(([id, name, Icon]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                <Icon size={17} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {/* 1. 홈 탭 */}
        {tab === 'home' && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">ROBOFLOW OBJECT DETECTION</span>
                <h1>
                  한 장의 사진으로<br />
                  <em>냉장고 재료</em>를 한눈에 인식하세요.
                </h1>
                <p>
                  Roboflow 사전 학습 객체 탐지 모델이 사진 속 여러 식재료를 동시에 찾아내고,
                  정교한 단계별 레시피 추천과 나만의 레시피 등록을 지원합니다.
                </p>
                <button className="primary" onClick={() => setTab('analyze')}>
                  <Camera size={18} /> 다중 식재료 분석 시작
                </button>
              </div>
              <div className="hero-art">
                🥦 🍅 🥚<br />
                🥔 🥕 🧅
              </div>
            </section>
            <div className="cards three">
              <div className="panel">
                <Camera />
                <h3>다중 객체 탐지 (Roboflow)</h3>
                <p>사진 속 다양한 식재료의 위치와 신뢰도를 바운딩 박스로 인식합니다.</p>
              </div>
              <div className="panel">
                <Refrigerator />
                <h3>스마트 냉장고 관리</h3>
                <p>중복 식재료를 자동 통합하여 냉장고 목록을 편리하게 구성합니다.</p>
              </div>
              <div className="panel">
                <BookOpen />
                <h3>정교한 맞춤 레시피</h3>
                <p>재료 정량, 양념, 단계별 조리법 및 나만의 커스텀 레시피를 제공합니다.</p>
              </div>
            </div>
          </>
        )}

        {/* 2. AI 분석 탭 */}
        {tab === 'analyze' && (
          <>
            <h1>AI 식재료 객체 탐지</h1>
            <p className="sub">
              Roboflow 모델이 한 장의 사진에 포함된 여러 식재료의 위치(바운딩 박스)와 종류를 동시에 감지합니다.
            </p>

            <div className="cards two">
              {/* 왼쪽: 이미지 업로드 & 바운딩 박스 오버레이 */}
              <div className="panel">
                <label className="drop">
                  <Camera size={36} />
                  <strong>식재료 사진을 선택하세요</strong>
                  <span>JPG · PNG · WEBP / 최대 10MB</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={upload}
                  />
                </label>

                {preview && (
                  <div className="preview-container">
                    <img
                      ref={imgRef}
                      className="preview"
                      src={preview}
                      alt="업로드한 식재료"
                      onLoad={drawBoundingBoxes}
                    />
                    <canvas ref={canvasRef} className="overlay-canvas" />
                  </div>
                )}

                <div className="filter-row">
                  <div className="spread">
                    <label className="small-label">
                      <SlidersHorizontal size={14} /> 신뢰도 임계값 필터
                    </label>
                    <b>{(confidenceThreshold * 100).toFixed(0)}% 이상</b>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  />
                </div>

                <button
                  className="primary full"
                  disabled={!file || busy}
                  onClick={analyze}
                >
                  <Camera size={18} />
                  {busy ? '객체 탐지 분석 중...' : '식재료 객체 탐지 시작'}
                </button>
              </div>

              {/* 오른쪽: 탐지 결과 목록 & 일괄 등록 */}
              <div className="panel">
                <div className="spread">
                  <h2>탐지 결과 목록</h2>
                  {detections.length > 0 && (
                    <span className="badge">
                      {detections.length}개 탐지됨 (선택 {selectedCount}개)
                    </span>
                  )}
                </div>

                {detections.length > 0 ? (
                  <>
                    <div className="detection-list">
                      {detections.map((det, idx) => {
                        const color = BOX_COLORS[idx % BOX_COLORS.length];
                        const isHovered = hoveredId === det.id;

                        return (
                          <div
                            key={det.id}
                            className={`detection-item ${det.selected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                            onMouseEnter={() => setHoveredId(det.id)}
                            onMouseLeave={() => setHoveredId(null)}
                          >
                            <div className="detection-header">
                              <label className="check-label">
                                <input
                                  type="checkbox"
                                  checked={det.selected}
                                  onChange={() => toggleSelect(det.id)}
                                />
                                <span
                                  className="color-dot"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="emoji-icon">{emojis[det.name] || '🥗'}</span>
                              </label>

                              <select
                                className="ingredient-select"
                                value={det.name}
                                onChange={(e) => updateIngredientName(det.id, e.target.value)}
                              >
                                {defaultIngredients.map((ing) => (
                                  <option key={ing} value={ing}>
                                    {ing}
                                  </option>
                                ))}
                                {!defaultIngredients.includes(det.name) && (
                                  <option value={det.name}>{det.name}</option>
                                )}
                              </select>

                              <b className="conf-badge">
                                {(det.confidence * 100).toFixed(1)}%
                              </b>

                              <button
                                className="icon-btn delete-btn"
                                title="목록에서 제외"
                                onClick={() => removeDetection(det.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            <div className="detection-meta">
                              <small>원본 라벨: {det.rawClass}</small>
                              <small>
                                위치: ({Math.round(det.bbox.xMin)}, {Math.round(det.bbox.yMin)}) ~{' '}
                                {Math.round(det.bbox.width)}×{Math.round(det.bbox.height)}px
                              </small>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="dedup-notice">
                      <Info size={15} />
                      <span>
                        동일 식재료가 중복 탐지된 경우 냉장고에는 1회만 등록됩니다.
                        (등록 예정: 고유 재료 <strong>{uniqueSelectedCount}</strong>종)
                      </span>
                    </div>

                    <button
                      className="secondary full"
                      disabled={selectedCount === 0}
                      onClick={addSelectedToFridge}
                    >
                      <Plus size={17} /> 선택한 재료 냉장고에 등록 ({selectedCount}개)
                    </button>
                  </>
                ) : (
                  <div className="empty-box">
                    <Layers size={36} color="#94a3b8" />
                    <p className="sub">
                      식재료 사진을 업로드하고 [식재료 객체 탐지 시작]을 누르면 바운딩 박스와 탐지 결과가 나타납니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {status && (
              <div className={`notice ${statusType}`}>
                {statusType === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span>{status}</span>
              </div>
            )}
          </>
        )}

        {/* 3. 나의 냉장고 탭 */}
        {tab === 'fridge' && (
          <>
            <h1>나의 냉장고</h1>
            <p className="sub">
              보유 재료 {owned.length}개 · 브라우저에 자동 저장됩니다.
            </p>
            <div className="panel">
              <h2>재료 직접 추가</h2>
              <div className="chips">
                {defaultIngredients.map((x) => (
                  <button
                    className={owned.includes(x) ? 'chip selected' : 'chip'}
                    key={x}
                    onClick={() => add(x)}
                    disabled={owned.includes(x)}
                  >
                    {emojis[x] || '🥗'} {x} <Plus size={14} />
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>보유 중인 재료</h2>
              <div className="chips">
                {owned.length ? (
                  owned.map((x) => (
                    <button
                      className="chip"
                      key={x}
                      onClick={() => setOwned((v) => v.filter((y) => y !== x))}
                    >
                      {emojis[x] || '🥗'} {x} <Trash2 size={14} />
                    </button>
                  ))
                ) : (
                  <p className="sub">아직 등록한 재료가 없습니다. AI 분석 또는 직접 추가해 보세요.</p>
                )}
              </div>
            </div>

            <button className="primary" onClick={() => setTab('recipes')}>
              이 재료로 맞춤 레시피 찾기
            </button>
          </>
        )}

        {/* 4. 레시피 탭 (정교한 상세 정보 + 나만의 레시피 추가 기능) */}
        {tab === 'recipes' && (
          <>
            <div className="recipe-header-row">
              <div>
                <h1>맞춤 레시피 추천</h1>
                <p className="sub">
                  현재 보유 재료 일치율을 기준으로 추천하며, 상세 재료와 단계별 전문 조리법을 제공합니다.
                </p>
              </div>
              <button
                className="primary add-recipe-btn"
                onClick={() => setIsAddRecipeOpen(true)}
              >
                <Plus size={18} /> 나만의 레시피 등록
              </button>
            </div>

            <div className="recipe-filter-bar">
              <div className="search">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="레시피 이름 검색..."
                />
              </div>

              <div className="category-chips">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`cat-chip ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat === '나만의 레시피' && <Sparkles size={14} />}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="cards three">
              {filteredRecipes.map((r) => (
                <div
                  className="panel recipe-card"
                  key={r.id}
                  onClick={() => setDetail(r)}
                >
                  <div className="card-top-row">
                    <span className="card-category">{r.category}</span>
                    {r.isCustom && (
                      <span className="custom-badge">
                        <Sparkles size={12} /> 내가 만든 레시피
                      </span>
                    )}
                  </div>

                  <div className="food-icon">
                    {r.items.map((x) => emojis[x] || '🥗').join(' ')}
                  </div>

                  <div className="spread">
                    <h3>{r.name}</h3>
                    <strong className="green">{r.score}%</strong>
                  </div>

                  <div className="bar">
                    <div style={{ width: `${r.score}%` }} />
                  </div>

                  <div className="recipe-meta-row">
                    <span>
                      <Clock size={13} /> {r.time}분
                    </span>
                    <span>
                      <Flame size={13} /> {r.difficulty}
                    </span>
                    {r.servings && (
                      <span>
                        <Users size={13} /> {r.servings}
                      </span>
                    )}
                  </div>

                  <div className="missing-info">
                    {r.missing.length === 0 ? (
                      <span className="all-ready">
                        <CheckCircle2 size={13} /> 모든 주요 재료 완비!
                      </span>
                    ) : (
                      <small>부족한 재료: {r.missing.join(', ')}</small>
                    )}
                  </div>

                  {r.isCustom && (
                    <button
                      className="delete-custom-btn"
                      title="레시피 삭제"
                      onClick={(e) => handleDeleteCustomRecipe(r.id, e)}
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  )}
                </div>
              ))}
            </div>

            {filteredRecipes.length === 0 && (
              <div className="empty-box">
                <BookOpen size={40} color="#94a3b8" />
                <p>해당 조건에 맞는 레시피가 없습니다.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('전체');
                  }}
                >
                  검색 필터 초기화
                </button>
              </div>
            )}
          </>
        )}

        {/* 5. 대시보드 탭 */}
        {tab === 'stats' && (
          <>
            <h1>나의 대시보드</h1>
            <div className="cards three">
              <div className="panel metric">
                <Refrigerator />
                <b>{owned.length}</b>
                <span>보유 식재료</span>
              </div>
              <div className="panel metric">
                <BookOpen />
                <b>{recommend(owned, customRecipes).length}</b>
                <span>전체 레시피 (커스텀 {customRecipes.length}개)</span>
              </div>
              <div className="panel metric">
                <ChefHat />
                <b>{recommend(owned, customRecipes).filter((r) => r.score === 100).length}</b>
                <span>완전 일치 레시피</span>
              </div>
            </div>
            <div className="panel">
              <h2>최근 AI 객체 탐지 기록</h2>
              {history.length ? (
                history.map((h, i) => (
                  <div className="history" key={i}>
                    <span>
                      {emojis[h.name] || '🥗'} {h.name}
                    </span>
                    <span>
                      {(h.confidence * 100).toFixed(1)}% · {h.date}
                    </span>
                  </div>
                ))
              ) : (
                <p className="sub">아직 분석 기록이 없습니다.</p>
              )}
            </div>
          </>
        )}
      </main>

      {/* 정교한 레시피 상세 모달 */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal recipe-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setDetail(null)}>
              ✕
            </button>

            <div className="modal-top">
              <span className="modal-category">{detail.category}</span>
              {detail.isCustom && (
                <span className="custom-badge">
                  <Sparkles size={12} /> 내가 만든 레시피
                </span>
              )}
              <h2>{detail.name}</h2>
            </div>

            {/* 레시피 요약 메트릭 */}
            <div className="modal-metrics">
              <div className="metric-box">
                <Clock size={16} />
                <b>{detail.time}분</b>
                <span>조리 시간</span>
              </div>
              <div className="metric-box">
                <Flame size={16} />
                <b>{detail.difficulty}</b>
                <span>난이도</span>
              </div>
              <div className="metric-box">
                <Users size={16} />
                <b>{detail.servings || '1~2인분'}</b>
                <span>인분</span>
              </div>
              {detail.calories && (
                <div className="metric-box">
                  <Sparkles size={16} />
                  <b>{detail.calories}</b>
                  <span>예상 칼로리</span>
                </div>
              )}
              <div className="metric-box match-box">
                <b>{detail.score}%</b>
                <span>재료 일치율</span>
              </div>
            </div>

            {/* 주요 식재료 보유 상태 */}
            <div className="detail-section">
              <h3>필요한 주요 식재료</h3>
              <div className="ingredients-check-list">
                {(detail.ingredientsDetail || detail.items).map((itemStr, idx) => {
                  const matchingItem = detail.items.find((it) => itemStr.includes(it));
                  const isOwned = matchingItem ? owned.includes(matchingItem) : false;

                  return (
                    <div
                      key={idx}
                      className={`ingredient-check-item ${isOwned ? 'owned' : 'missing'}`}
                    >
                      {isOwned ? (
                        <Check size={15} className="icon-check" />
                      ) : (
                        <AlertCircle size={15} className="icon-missing" />
                      )}
                      <span>{itemStr}</span>
                      <small className="status-label">
                        {isOwned ? '보유 중' : '부족함'}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 양념 및 소스 */}
            {detail.seasonings && detail.seasonings.length > 0 && (
              <div className="detail-section">
                <h3>양념 및 소스 준비물</h3>
                <div className="seasoning-chips">
                  {detail.seasonings.map((s, i) => (
                    <span key={i} className="seasoning-chip">
                      🧂 {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 단계별 상세 조리법 */}
            <div className="detail-section">
              <h3>단계별 조리 순서</h3>
              <ol className="step-list">
                {Array.isArray(detail.steps) ? (
                  detail.steps.map((step, idx) => (
                    <li key={idx} className="step-item">
                      <span className="step-num">{idx + 1}</span>
                      <p className="step-text">{step}</p>
                    </li>
                  ))
                ) : (
                  <p>{detail.steps}</p>
                )}
              </ol>
            </div>

            {/* 셰프의 조리 꿀팁 */}
            {detail.tip && (
              <div className="tip-box">
                <Lightbulb size={20} />
                <div>
                  <strong>셰프의 꿀팁</strong>
                  <p>{detail.tip}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 나만의 레시피 추가 모달 */}
      {isAddRecipeOpen && (
        <div className="overlay" onClick={() => setIsAddRecipeOpen(false)}>
          <div className="modal add-recipe-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setIsAddRecipeOpen(false)}>
              ✕
            </button>
            <h2>나만의 레시피 등록</h2>
            <p className="sub">
              나만의 비법 요리를 등록하면 냉장고 재료 일치율을 계산해 함께 추천해 드립니다.
            </p>

            <form onSubmit={handleSaveCustomRecipe} className="custom-recipe-form">
              <label className="form-field">
                <strong>요리 이름 *</strong>
                <input
                  type="text"
                  required
                  placeholder="예: 토마토 달걀 볶음밥, 바질 버섯 파스타"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                />
              </label>

              <div className="form-row three-col">
                <label className="form-field">
                  <strong>카테고리</strong>
                  <select
                    value={newRecipe.category}
                    onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
                  >
                    <option value="볶음/일품">볶음/일품</option>
                    <option value="반찬">반찬</option>
                    <option value="샐러드">샐러드</option>
                    <option value="수프/양식">수프/양식</option>
                    <option value="브런치/간식">브런치/간식</option>
                    <option value="국/찌개">국/찌개</option>
                    <option value="기타">기타</option>
                  </select>
                </label>

                <label className="form-field">
                  <strong>조리 시간 (분)</strong>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={newRecipe.time}
                    onChange={(e) => setNewRecipe({ ...newRecipe, time: e.target.value })}
                  />
                </label>

                <label className="form-field">
                  <strong>난이도</strong>
                  <select
                    value={newRecipe.difficulty}
                    onChange={(e) => setNewRecipe({ ...newRecipe, difficulty: e.target.value })}
                  >
                    <option value="쉬움">쉬움</option>
                    <option value="보통">보통</option>
                    <option value="어려움">어려움</option>
                  </select>
                </label>
              </div>

              {/* 매칭 식재료 선택 */}
              <div className="form-field">
                <strong>주요 매칭 식재료 선택 (클릭하여 추가/제외) *</strong>
                <span className="field-hint">
                  냉장고 재료와 일치율을 계산할 때 사용됩니다.
                </span>
                <div className="chips selectable">
                  {defaultIngredients.map((ing) => {
                    const isSelected = newRecipe.items.includes(ing);
                    return (
                      <button
                        type="button"
                        key={ing}
                        className={`chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleRecipeItem(ing)}
                      >
                        {emojis[ing] || '🥗'} {ing} {isSelected ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>

                {/* 기타 식재료 직접 추가 */}
                <div className="add-custom-item-row">
                  <input
                    type="text"
                    placeholder="목록에 없는 식재료 직접 입력 (예: 스파게티면, 베이컨)"
                    value={newRecipe.customItemInput}
                    onChange={(e) => setNewRecipe({ ...newRecipe, customItemInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomItemToRecipe();
                      }
                    }}
                  />
                  <button type="button" className="secondary" onClick={addCustomItemToRecipe}>
                    추가
                  </button>
                </div>

                {newRecipe.items.length > 0 && (
                  <div className="selected-items-display">
                    선택된 식재료: <b>{newRecipe.items.join(', ')}</b>
                  </div>
                )}
              </div>

              <label className="form-field">
                <strong>상세 재료 및 정량 (줄바꿈으로 구분)</strong>
                <textarea
                  rows={3}
                  placeholder={`예:\n완숙 토마토 2개\n계란 3알\n대파 1/2대`}
                  value={newRecipe.ingredientsDetailText}
                  onChange={(e) =>
                    setNewRecipe({ ...newRecipe, ingredientsDetailText: e.target.value })
                  }
                />
              </label>

              <label className="form-field">
                <strong>양념 및 소스 (줄바꿈으로 구분)</strong>
                <textarea
                  rows={2}
                  placeholder={`예:\n진간장 1큰술\n굴소스 0.5큰술\n식용유 2큰술`}
                  value={newRecipe.seasoningsText}
                  onChange={(e) => setNewRecipe({ ...newRecipe, seasoningsText: e.target.value })}
                />
              </label>

              <label className="form-field">
                <strong>조리 순서 (줄바꿈으로 단계 구분) *</strong>
                <textarea
                  rows={5}
                  required
                  placeholder={`예:\n토마토를 먹기 좋은 크기로 썰어줍니다.\n계란을 풀어 스크램블을 만듭니다.\n팬에 토마토를 볶다가 간장과 굴소스로 간을 맞춥니다.\n계란과 함께 섞어 불을 끕니다.`}
                  value={newRecipe.stepsText}
                  onChange={(e) => setNewRecipe({ ...newRecipe, stepsText: e.target.value })}
                />
              </label>

              <label className="form-field">
                <strong>셰프의 꿀팁 / 주의사항 (선택)</strong>
                <input
                  type="text"
                  placeholder="예: 계란을 너무 오래 익히지 않고 반숙일 때 불을 끄면 촉촉합니다."
                  value={newRecipe.tip}
                  onChange={(e) => setNewRecipe({ ...newRecipe, tip: e.target.value })}
                />
              </label>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setIsAddRecipeOpen(false)}
                >
                  취소
                </button>
                <button type="submit" className="primary">
                  <Check size={18} /> 레시피 등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer>
        Smart Recipe · Roboflow 기반 객체 탐지 및 정교한 맞춤 레시피 시스템
      </footer>
    </>
  );
}
