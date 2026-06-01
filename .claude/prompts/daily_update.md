# 포트폴리오 인텔리전스 — 일일 업데이트

## Privacy 규칙 (절대 준수)
- 외부 API/MCP 호출 시 회사명(텍스트)만 전달
- investment_amount, stake_pct, investment_terms 등 투자 세부 데이터 외부 전달 금지

---

## Phase 0: 크레딧 예산 확인

```bash
python3 -c "import sqlite3; c=sqlite3.connect('data/portfolio.db').cursor(); print(c.execute(\"SELECT value FROM intelligence_config WHERE key='cb_daily_budget'\").fetchone()[0])"
```

오늘 CB Insights 사용 가능 콜 수를 확인한다. 기본 30콜.
이미 당일 업데이트 실행 이력이 있으면 남은 예산을 차감한다:
```bash
python3 -c "import sqlite3; c=sqlite3.connect('data/portfolio.db').cursor(); print(c.execute(\"SELECT COUNT(*) FROM company_update_log WHERE run_date=date('now')\").fetchone()[0])"
```

---

## Phase 1: 기업 프로파일 업데이트 계획 수립

```bash
python3 scripts/db_writer.py generate-plan --budget {오늘예산}
```

이 명령이 출력한 우선순위 순서대로 오늘 업데이트할 기업 리스트를 확인한다.
리스트에는 이유(기아방지/긴급뉴스/미보완필드/정기체크)가 함께 표시된다.

### 기업 프로파일 업데이트 실행 (예산 내에서)

계획된 기업을 순서대로 처리한다. 각 기업에 대해:

1. **CB Insights에서 최신 정보 조회** (1콜 사용):
   - `get_company_profile` → status, ceo_name, description, website 확인
   - `get_company_headcount` → current_employee_count 확인
   - `get_company_funding` → total_funding_external_m, latest_external_round, latest_external_valuation_m 확인

2. **기존값과 비교 후 변경사항만 업데이트**:
```bash
# 예시: CEO가 바뀐 경우
python3 scripts/db_writer.py update-company \
  --company "{company_name}" \
  --field "ceo_name" \
  --value "{새CEO이름}" \
  --source "CB Insights"

# 예시: IPO된 경우
python3 scripts/db_writer.py update-company \
  --company "{company_name}" \
  --field "status" \
  --value "IPO: NASDAQ (2026-03)" \
  --source "CB Insights"
```

3. **업데이트 기록 저장** — 변경된 경우에만:
```bash
python3 scripts/db_writer.py log-profile-update \
  --company "{company_name}" \
  --fields '["ceo_name", "status"]' \
  --before '{"ceo_name": "이전값", "status": "이전값"}' \
  --after '{"ceo_name": "새값", "status": "새값"}' \
  --reason "{선택이유}" \
  --source "CB Insights"
```

예산 소진 시 즉시 중단한다.

---

## Phase 2: 뉴스 수집 (신호 감지 → 심층 분석)

### 2-1. 활성 소스 확인
```bash
python3 -c "import sqlite3; [print(r) for r in sqlite3.connect('data/portfolio.db').execute('SELECT name, type, phase, config FROM monitoring_sources WHERE active=1 ORDER BY phase').fetchall()]"
```

### 2-2. Phase 1 소스 — 신호 감지 (전체 포트폴리오)

**Google News RSS 배치 검색** — 기업 25개씩 OR 쿼리:
```
https://news.google.com/rss/search?q="Company1"+OR+"Company2"+OR+...&hl=en-US
```
결과에서 포트폴리오 기업명이 포함된 기사를 추출한다.

**Naver 뉴스 MCP** — 국내 기업 대상:
- 기업명으로 `NaverSearch-search_news` 호출

**OpenDART MCP** — 국내 상장사:
- `opendart-search_disclosures` 로 최근 주요공시 확인

**Crunchbase News RSS** — 단일 피드에서 기업명 매칭:
```
https://news.crunchbase.com/feed/
```

결과: 오늘 뉴스에 등장한 기업 목록 (핫리스트)

### 2-3. Phase 2 소스 — 심층 분석 (핫리스트 기업만)

핫리스트에 있는 기업만 CB Insights `get_company_news` 호출 (잔여 예산 내):
- 각 기사에 대해 1줄 한국어 요약 생성
- 긴급도 1-5 분류
- 태그 분류: funding | ipo | acquisition | leadership | product | regulatory | competition | partnership | financial

뉴스 저장:
```bash
python3 scripts/db_writer.py news \
  --company "{company_name}" \
  --title "{title}" \
  --summary "{1줄 한국어 요약}" \
  --source "{source}" \
  --url "{url}" \
  --urgency {1-5} \
  --tags '["{tag}"]'
```

---

## Phase 3: 보고

```bash
# 오늘 업데이트된 기업 현황
python3 -c "
import sqlite3
conn = sqlite3.connect('data/portfolio.db')
rows = conn.execute(\"SELECT company_name, fields_updated, reason, source FROM company_update_log WHERE run_date=date('now') ORDER BY updated_at DESC\").fetchall()
for r in rows: print(r)
"

# 긴급도 4 이상 뉴스
python3 -c "
import sqlite3
conn = sqlite3.connect('data/portfolio.db')
rows = conn.execute(\"SELECT company_name, one_line_summary, urgency_level, tags FROM news_items WHERE collected_at >= date('now') AND urgency_level >= 4 ORDER BY urgency_level DESC\").fetchall()
for r in rows: print(r)
"
```

오늘 처리 요약을 출력한다:
- 기업 프로파일 업데이트: N개 기업, M개 필드 변경
- 뉴스 수집: K개 기업, L건 기사
- 긴급 이슈: 긴급도 4 이상 목록
- 예산 사용: O/P 콜
- 연기된 기업: 상위 5개 + 이유

```bash
python3 scripts/db_writer.py log-run \
  --type "scheduled" \
  --companies {처리기업수} \
  --news {수집뉴스수}
```
