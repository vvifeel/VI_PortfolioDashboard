# VI Portfolio Dashboard — Claude Code Agent

이 레포지토리는 VC 포트폴리오 인텔리전스 시스템입니다.
Claude Code Agent가 기업 프로파일 업데이트 및 뉴스 수집을 담당합니다.

---

## 절대 규칙 — Privacy

외부 API / MCP 도구 호출 시:
- ✅ 허용: company_name (텍스트 문자열만)
- ❌ 금지: investment_amount_m, stake_pct, investment_year, investment_terms, valuation_at_investment_m, current_valuation_m

---

## 파일 구조

```
data/portfolio.db              # SQLite DB (메인 데이터)
scripts/
  init_db.py                   # DB 스키마 초기화 (최초 1회)
  migrate_enrichment.py        # enrichment 테이블/컬럼 마이그레이션
  import_excel.py              # Excel → DB import
  db_writer.py                 # Agent 수집 결과 저장 헬퍼 (PUBLIC 필드만)
.claude/prompts/
  daily_update.md              # 일일 업데이트 실행 프롬프트 (Phase 0~3)
dashboard/                     # Next.js 대시보드 (포트 3000)
  src/app/
    overview/page.tsx          # KPI + 차트 6종 + 뉴스 패널
    portfolio/page.tsx         # 기업 리스트 (필터 + 차트)
    portfolio/[company]/page.tsx  # 기업 상세
    news/page.tsx              # 뉴스 피드
    settings/
      intelligence/page.tsx   # 파이프라인 설정
      sources/page.tsx         # 모니터링 소스 CRUD
      import/page.tsx          # Excel import UI
  src/components/
    charts/
      OverviewCharts.tsx       # 차트 6종 (섹터 TopN바, 지역 버블맵 등)
      RegionBubbleMap.tsx      # 세계지도 + 버블 오버레이 (d3-geo + ResizeObserver)
      SectorTreemap.tsx        # (미사용) — OverviewCharts의 TopNBarSection으로 대체됨
    SignalRadar.tsx             # 우측 사이드바 시그널 패널
```

---

## DB 테이블 요약

| 테이블 | 용도 |
|--------|------|
| `portfolio_investments` | 투자 거래 내역 (PRIVATE — agent 접근 금지) |
| `companies` | 기업 프로파일 (PUBLIC + agent 수집 필드) |
| `news_items` | 수집 뉴스 |
| `monitoring_sources` | 수집 소스 관리 (phase 1/2 구분) |
| `company_update_log` | 기업 프로파일 변경 이력 |
| `company_update_plan` | 일일 enrichment 계획 |
| `intelligence_config` | Agent 설정 key-value |
| `update_log` | 수집 실행 이력 |

### intelligence_config 주요 설정

| key | 기본값 | 설명 |
|-----|--------|------|
| `session_deep_dive_limit` | 30 | 일 1회 실행 기준 CB Insights 최대 딥다이브 횟수 (토큰 사용량 대리 지표) |
| `starvation_days` | 15 | N일 이상 미업데이트 기업 강제 우선 처리 |
| `force_check_days` | 15 | 어떤 기업도 최대 N일 이상 방치하지 않음 |
| `tier1_frequency_days` | 7 | Tier 1 기업 업데이트 주기 |
| `tier2_frequency_days` | 14 | Tier 2 기업 업데이트 주기 |
| `tier3_frequency_days` | 30 | Tier 3 기업 업데이트 주기 |
| `min_urgency_for_immediate` | 4 | 이 이상 긴급도 발생 시 즉시 딥다이브 |
| `high_signal_keywords` | JSON array | Phase 2 트리거 키워드 목록 |

---

## db_writer.py 명령어

```bash
# 뉴스 저장
python3 scripts/db_writer.py news \
  --company "Airtable" --title "..." --summary "한국어 요약" \
  --source "TechCrunch" --url "https://..." --urgency 4 \
  --tags '["funding", "valuation"]'

# 기업 목록 출력
python3 scripts/db_writer.py list-companies

# 우선순위 점수 계산 및 출력 (상위 30개)
python3 scripts/db_writer.py score-companies

# 오늘의 enrichment 계획 생성 (DB 저장 + 출력)
python3 scripts/db_writer.py generate-plan [--budget N]

# 오늘의 계획 조회
python3 scripts/db_writer.py show-plan

# 기업 프로파일 단일 필드 업데이트 + 로그
python3 scripts/db_writer.py update-company \
  --company "Figma" --field "ceo_name" --value "Dylan Field" \
  --source "CB Insights" --reason "leadership_change"

# 멀티 필드 업데이트 후 로그 기록
python3 scripts/db_writer.py log-profile-update \
  --company "Figma" \
  --fields '["ceo_name", "current_employee_count"]' \
  --before '{"ceo_name": "이전", "current_employee_count": 1000}' \
  --after  '{"ceo_name": "새값", "current_employee_count": 1200}' \
  --reason "starvation(20d)" --score 14.7 --source "CB Insights"
```

### 허용된 PUBLIC 필드 (update-company / log-profile-update)

`status`, `ceo_name`, `cto_name`, `cfo_name`, `cofounders`, `description`,
`business_model`, `key_products`, `website`, `hq_city`, `founded_year`,
`current_employee_count`, `employee_count_history`, `total_funding_external_m`,
`latest_external_round`, `latest_external_valuation_m`, `revenue_range`,
`competitors`, `all_investors`, `technologies`, `linkedin_url`, `twitter_url`,
`logo_url`, `acquisition_info`, `ipo_info`

---

## 일일 업데이트 실행 흐름

자세한 내용은 `.claude/prompts/daily_update.md` 참조.

```
Phase 0: 세션 용량 확인 (당일 company_update_log 카운트 vs session_deep_dive_limit)
Phase 1: 기업 프로파일 enrichment (generate-plan → CB Insights → update-company → log-profile-update)
Phase 2: 뉴스 수집 (신호 감지 RSS → 핫리스트 → CB Insights 심층 분석 → news 저장)
Phase 3: 보고 (처리 요약 출력 + update_log 저장)
```

---

## 긴급도 분류 기준

- 5 Critical: 파산, 완전 매각, 주요 스캔들, 대규모 구조조정
- 4 Urgent: 인수/피인수 제안, IPO 파일링, CEO 교체, 주요 규제 제재
- 3 Important: 대형 펀딩 라운드, 전략적 피봇, 주요 파트너십
- 2 Notable: 제품 출시, 업계 수상, 소규모 채용 확대
- 1 Info: 정기 업데이트, 마이너 블로그 포스트

## 태그 목록

`funding` `ipo` `acquisition` `leadership` `product` `regulatory` `competition` `partnership` `financial`

---

## 대시보드 페이지 구조

| 경로 | 설명 |
|------|------|
| `/overview` | KPI 8종, 차트 6종, 뉴스 패널, 프로파일 업데이트 활동 로그 |
| `/portfolio` | 기업 리스트 (검색, 섹터/지역/라운드/상태 필터 + 인라인 범위슬라이더) |
| `/portfolio/[company]` | 기업 상세 (hero 헤더 + 메타 그리드, 투자내역, 재무/펀딩, 시장/경쟁, 뉴스 타임라인) |
| `/news` | 뉴스 피드 (긴급도/태그 필터, 슬라이드 드로어) |
| `/settings/intelligence` | 파이프라인 설정, 수집 트리거, 티어 드래그&드랍 배정 |
| `/settings/sources` | 모니터링 소스 CRUD |
| `/settings/import` | Excel import UI |

---

## 대시보드 UI 상세 — portfolio/page.tsx

### CompanyRow 컬럼 레이아웃

| 컬럼 | 너비 | 내용 |
|------|------|------|
| Col 1 기업명·지역 | `w-64` | 1행: 티어배지 + 기업명 + 지역버튼 / 2행: 상태배지 + 설립연도 + 본사도시 |
| Col 2 섹터·소개 | `flex-1` | 섹터 pill + 설명 텍스트 한 줄 (flex-row, truncate) |
| Col 3 투자내역 | `w-44` | 건수버튼(클릭 펼치기, ChevronDown) + 총투자금 + 지분% |
| Col 4 기업가치 | `w-40` | 당시가치 / 현재가치 / 등락률 |
| Col 5 시그널 | `flex-1` | 긴급도 아이콘 + 시그널 텍스트 + 날짜 |

- 건수 클릭 → 해당 행 바로 아래에 전체 폭 투자내역 테이블 펼침 (investment_terms 미잘림)
- `formatM` / `invFmt`: 소수점 2자리 표시 (`$1.50B`, `$25.00M`)

### 필터바

- 검색창 + 섹터/지역/라운드/상태 드롭다운 + 티어 버튼그룹이 한 줄로 연속 배치
- **범위 슬라이더(투자금액·지분율·기업가치) 항상 인라인 표시** — 토글 버튼 없음
  - 슬라이더 값 라벨 클릭 → 숫자 직접 입력 가능
  - 하한 핸들 z-index 버그 수정: lo가 min일 때 loZ=5로 강제
- 활성 필터 chip은 필터바 하단에 표시, 차트 필터 초기화 버튼은 **좌측** 배치

### 차트 (OverviewCharts.tsx)

- 섹터분포: **TopNBarSection** — 상위 7개 수평 바차트 + 하단 나머지 항목 인라인 칩
  - `SectorTreemap`은 미사용 (파일은 남아 있음)
- 지역분포: **RegionBubbleMap** — 세계지도(naturalEarth1) + 절대위치 SVG 버블 오버레이
  - d3-geo `geoNaturalEarth1().scale(130).translate([w*0.5, h*0.54])` 로 외부에서 직접 프로젝션 계산
  - `overflow: hidden` + 경계 밖 버블 클리핑으로 프레임 이탈 방지
  - 각 버블에 `key={name_idx}` 고유키 부여 (React key 경고 해결)
- 크로스필터: 각 차트는 자신의 차원 필터를 제외한 `rowsForX`를 데이터소스로 사용
  → 한 차트를 클릭해도 해당 차트의 분포는 그대로 유지

---

## 대시보드 UI 상세 — portfolio/[company]/page.tsx

### Hero 헤더 구성

1. 기업명 + 상태배지 + 티어배지
2. 한글기업명 (있을 경우)
3. 섹터 / 서브섹터 / 지역 / 설립연도 / 비즈니스스테이지 태그
4. 우측: 웹사이트 / LinkedIn / Crunchbase 링크
5. 빠른 통계바: 직원수, 총 펀딩, 최신 라운드, 시장포지션, 추정매출
6. 기업 소개 (description)
7. **메타 그리드** (description 아래, border-top 구분선):
   - Founded · Status · CEO · Revenue 2026 · Website · HQ · Valuation
   - 각 항목: 10px uppercase 라벨 + 14px 값 (없으면 `—`)
   - Website는 `<a>` 링크, 프로토콜 제거 표시
8. 인텔리전스 시그널 박스 (있을 경우)

### 콘텐츠 섹션

| 섹션 | 비고 |
|------|------|
| 투자 내역 | 라운드별 투자금/지분/가치/조건 상세 |
| 재무·펀딩 | 외부 펀딩, ARR, 번레이트, 투자자 목록 |
| 시장·경쟁 | 시장규모, 경쟁사, 기술스택 |
| 뉴스 타임라인 | 긴급도별 뉴스 카드 |

> **팀·경영진 섹션은 제거됨** — CEO 등 임원 정보는 hero 메타 그리드에서 표시

---

## 기술 스택 메모

| 항목 | 내용 |
|------|------|
| Next.js | 16 (App Router, TypeScript, `'use client'` 필수) |
| 스타일 | Tailwind CSS v4 |
| 차트 | Recharts v3 (바/라인), @nivo/geo (세계지도) |
| 지도 프로젝션 | d3-geo `geoNaturalEarth1()` — @nivo/geo custom layer로 프로젝션 함수 전달 불가, ResizeObserver + 외부 계산 + 절대위치 SVG 방식 사용 |
| DB | SQLite + better-sqlite3 |

### @nivo/geo 주의사항

- `ResponsiveGeoMap`의 `layers` prop에 커스텀 레이어를 넣어도 내부 d3-geo projection 함수를 받을 수 없음
- 해결책: `ResizeObserver`로 컨테이너 크기 추적 → `geoNaturalEarth1().scale(130).translate([w*0.5, h*0.54])` 로 직접 프로젝션 계산 → `position: absolute` SVG 오버레이로 버블 렌더링

---

## 대시보드 실행

```bash
cd dashboard && npm run dev          # 개발 (포트 3000)
cd dashboard && npm run build && npm start  # 프로덕션
```

## DB 초기화 / 마이그레이션 (최초 설치 시)

```bash
python3 scripts/init_db.py           # 기본 스키마
python3 scripts/migrate_enrichment.py  # enrichment 테이블 + intelligence_config 시드
```
