# ROI Analyzer

## 프로젝트 개요
이커머스 상품 투자 ROI 분석 도구. 쿠팡/네이버 등 채널별 매출·비용 분석, 마케팅 효율 분석, AI 투자 의견 제공.

## 기술 스택
- **프레임워크**: React 18 + Vite 5
- **차트**: Recharts
- **엑셀**: SheetJS (xlsx)
- **AI**: Anthropic Claude API (브라우저 직접 호출)
- **데이터 저장**: localStorage (자동 저장)

## 실행 방법
```bash
npm install --cache /tmp/npm-cache-temp
npx vite --host
# http://localhost:5173/
```

## 프로젝트 구조
- `roi_analyzer_merged.jsx` - 전체 앱 (단일 파일)
- `src/main.jsx` - 엔트리 포인트
- `index.html` - HTML 셸
- `vite.config.js` - Vite 설정
- `package.json` - 의존성

## 주요 컴포넌트 (roi_analyzer_merged.jsx 내부)
- `App` - 메인 레이아웃, 사이드바, 라우팅
- `DashboardPage` - 대시보드 (상품 리스트, KPI 요약)
- `ProductDetailPage` - 상품 상세 분석 (7개 탭)
  - 수익성 종합, 원가·비용, 마케팅 효율·비용, 마케팅 히스토리, 시계열 추이, 채널별 분석, What-If
- `AiOpinionPage` - AI 투자 분석 (Claude API 연동, 이력 저장, 비교)
- `ForecastPage` - 예측 vs 실적

## 데이터 구조
- 상품 데이터: `PRODUCTS` 배열 (93개 상품, `_PD` 에서 디코딩)
- Context: `AppCtx` (route, selectedProduct)
- localStorage 키:
  - `roi_costlive_{sku}` - 원가 정보 (자동 저장)
  - `roi_mktlive_{sku}` - 마케팅 비용 (자동 저장)
  - `roi_channels_{sku}` - 채널별 판매 데이터 (자동 저장)
  - `roi_cost_{sku}` - 원가 이력
  - `roi_mkt_{sku}` - 마케팅 비용 이력
  - `roi_ai_history` - AI 분석 이력
  - `roi_ai_apikey` - Anthropic API 키
  - `roi_memo_{sku}_{category}` - 카테고리별 메모

## 코딩 규칙
- 단일 JSX 파일 구조 유지 (분리하지 않음)
- 문법 검증: `@babel/parser`로 확인
- npm 캐시 문제 시: `--cache /tmp/npm-cache-temp` 사용
- 스타일: inline style 사용 (CSS 파일 없음)
- 금액 표시: 콤마 포맷팅 필수
- 한국어 UI
