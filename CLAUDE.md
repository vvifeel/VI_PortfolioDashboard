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
| `/portfolio` | 기업 리스트 (검색, 섹터/지역/라운드/상태 필터) |
| `/portfolio/[company]` | 기업 상세 (hero 헤더, CB Insights 필드, 뉴스 히스토리) |
| `/news` | 뉴스 피드 (긴급도/태그 필터, 슬라이드 드로어) |
| `/settings/intelligence` | 파이프라인 설정, 수집 트리거, 티어 드래그&드랍 배정 |
| `/settings/sources` | 모니터링 소스 CRUD |
| `/settings/import` | Excel import UI |

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
