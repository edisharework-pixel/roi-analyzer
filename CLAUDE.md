# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요
이커머스 상품 투자 ROI 분석 도구. 쿠팡/네이버 등 채널별 매출·비용 분석, 마케팅 효율 분석, AI 투자 의견 제공.

## 실행 명령어
```bash
npm install --cache /tmp/npm-cache-temp
npx vite --host
# http://localhost:5173/
```
빌드: `npm run build` (출력: dist/)

npm 캐시 오류 시 반드시 `--cache /tmp/npm-cache-temp` 옵션 사용.

## 아키텍처

**단일 파일 구조**: 전체 앱이 `roi_analyzer_merged.jsx` 하나에 들어있다. 절대 파일을 분리하지 않는다.

- `src/main.jsx` → `roi_analyzer_merged.jsx`의 `App`을 import하여 렌더링
- React Router 미사용. `AppCtx` Context로 `route`/`selectedProduct` 상태를 관리하는 자체 라우팅

### 주요 컴포넌트 흐름 (roi_analyzer_merged.jsx)
- `App` (L3039~) — 사이드바 + 라우팅 컨테이너
- `DashboardPage` (L326~) — 상품 리스트, 정렬/필터, KPI 요약
- `ProductDetailPage` (L630~) — 상품 상세 7개 탭 (수익성, 원가, 마케팅, 히스토리, 시계열, 채널, What-If)
- `AiOpinionPage` (L2446~) — Claude/Gemini API 호출, 분석 이력 저장/비교
- `ForecastPage` (L2920~) — 예측 vs 실적

### 데이터
- 상품 데이터: `_PD` 배열(L166)을 디코딩하여 `PRODUCTS` 배열 생성 (93개 상품)
- `calcProductMetrics()` (L150) — 상품별 KPI 계산 핵심 함수
- 사용자 입력 데이터는 모두 localStorage에 자동 저장 (`roi_costlive_{sku}`, `roi_mktlive_{sku}`, `roi_channels_{sku}` 등)

### AI 연동
- 브라우저에서 직접 Anthropic/Gemini API 호출 (서버 없음)
- API 키는 localStorage(`roi_ai_apikey`, `roi_gemini_apikey`)에 저장
- `callAI()` 함수(L104~)가 provider에 따라 분기

## 기술 스택
- React 18 + Vite 5 (SPA, CSR)
- Recharts (차트), SheetJS/xlsx (엑셀 import/export)
- CSS 파일 없음 — 모든 스타일은 inline style

## 코딩 규칙
- **단일 JSX 파일 유지** — 컴포넌트 분리 금지
- **한국어 UI** — 모든 텍스트는 한국어
- **금액 표시** — 반드시 콤마 포맷팅 (`.toLocaleString()`)
- **입력 필드** — 값이 0일 때 포커스하면 클리어
- **자동 저장** — 사용자 입력 변경 시 localStorage에 즉시 저장
- **문법 검증** — `@babel/parser`로 JSX 파싱 확인 가능
