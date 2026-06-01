# 포트폴리오 인텔리전스 — 일일 업데이트

## Privacy 규칙 (절대 준수)
- 외부 API/MCP 호출 시 회사명(텍스트)만 전달
- investment_amount, stake_pct, investment_terms 등 투자 세부 데이터 외부 전달 금지

---

## Phase 0: 세션 용량 확인

Claude Code는 현재 세션 내 남은 토큰을 직접 조회할 수 없다. 대신 **당일 딥다이브 횟수**를 토큰 사용량의 대리 지표로 사용한다 (딥다이브 1회 ≈ CB Insights 3회 호출 + 요약 생성 ≈ 약 2,000~5,000 토큰).

```python
python3 -c "
import sqlite3
conn = sqlite3.connect('data/portfolio.db')
limit  = conn.execute(\"SELECT value FROM intelligence_config WHERE key='session_deep_dive_limit'\").fetchone()[0]
done   = conn.execute(\"SELECT COUNT(*) FROM company_update_log WHERE run_date=date('now')\").fetchone()[0]
print(f'딥다이브 예산: {done}/{limit} 사용 (남은 슬롯: {int(limit)-done})')
conn.close()
"
```

- 남은 슬롯 == 0이면 **Phase 1 CB Insights 호출 전체 건너뜀** (Phase 2 뉴스 수집은 진행)
- 남은 슬롯 < 5이면 Phase 1에서 starvation(기아) 기업과 urgency ≥ 4 기업만 처리

---

## Phase 1: 기업 프로파일 우선순위 기반 업데이트

### 1-1. 오늘의 업데이트 계획 생성

```bash
python3 scripts/db_writer.py generate-plan
```

출력된 리스트를 확인한다. 각 항목에는 우선순위 점수와 선택 이유가 표시된다:
- `starvation(N d)` — 15일 이상 업데이트 없음 (강제 처리)
- `urgency=N` — 긴급도 4 이상 뉴스 발생
- `missing_fields=N` — 핵심 필드 3개 이상 공란
- `overdue` — 티어 기준 업데이트 주기 초과
- `scheduled` — 정기 체크

### 1-2. 기업별 CB Insights 딥다이브 (계획 순서대로, 남은 슬롯 내)

각 기업에 대해 아래를 처리한다:

**a) 현재값 조회**:
```python
python3 -c "
import sqlite3
conn = sqlite3.connect('data/portfolio.db')
row = conn.execute('''SELECT ceo_name, description, current_employee_count,
    total_funding_external_m, latest_external_round, status
    FROM companies WHERE company_name=?''', ('{company_name}',)).fetchone()
print(row)
"
```

**b) CB Insights 조회** (회사명만 전달 — Privacy 준수):
- `get_company_profile` → status, ceo_name, description, website
- `get_company_headcount` → current_employee_count
- `get_company_funding` → total_funding_external_m, latest_external_round, latest_external_valuation_m

**c) 변경사항이 있는 경우만 업데이트**:
```bash
# 예: CEO 변경
python3 scripts/db_writer.py update-company \
  --company "{company_name}" \
  --field "ceo_name" \
  --value "{새CEO이름}" \
  --source "CB Insights" \
  --reason "{선택이유}"

# 예: IPO 완료
python3 scripts/db_writer.py update-company \
  --company "{company_name}" \
  --field "status" \
  --value "IPO" \
  --source "CB Insights" \
  --reason "ipo_detected"
```

**d) 멀티 필드 변경 시 업데이트 로그 기록**:
```bash
python3 scripts/db_writer.py log-profile-update \
  --company "{company_name}" \
  --fields '["ceo_name", "current_employee_count"]' \
  --before '{"ceo_name": "이전값", "current_employee_count": 500}' \
  --after '{"ceo_name": "새값", "current_employee_count": 600}' \
  --reason "{선택이유}" \
  --score {우선순위점수} \
  --source "CB Insights"
```

변경사항이 없으면 log-profile-update를 생략하고 다음 기업으로 넘어간다.

---

## Phase 2: 뉴스 수집 (신호 감지 → 심층 분석)

### 2-1. 활성 소스 확인
```python
python3 -c "
import sqlite3
rows = sqlite3.connect('data/portfolio.db').execute(
    'SELECT name, type, phase FROM monitoring_sources WHERE active=1 ORDER BY phase'
).fetchall()
for r in rows: print(r)
"
```

### 2-2. 신호 감지 — Phase 1 소스 (전체 포트폴리오, 무료)

**Google News RSS 배치 검색** (기업 15개씩 OR 쿼리):
```
https://news.google.com/rss/search?q="Company1"+OR+"Company2"+OR+...&hl=en-US&gl=US
```
배치당 한 URL 요청 → 결과에서 기업명 포함 기사 추출 → **핫리스트** 작성

**Naver 뉴스 MCP** — 국내 기업 대상:
```
NaverSearch-search_news 도구로 기업명 검색
```

**Crunchbase News RSS** (단일 피드, 기업명 매칭):
```
https://news.crunchbase.com/feed/
```

결과: 오늘 뉴스에 등장한 기업 핫리스트

### 2-3. 심층 분석 — Phase 2 소스 (핫리스트만, CB Insights)

핫리스트 기업 + Phase 0에서 남은 딥다이브 슬롯이 있을 때만:
- `get_company_news` 호출 (회사명만 전달)
- 각 기사에 대해 1줄 한국어 요약 + 긴급도 1-5 분류 + 태그 분류

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

긴급도 기준:
- 5 Critical: 파산, 완전 매각, 주요 스캔들, 대규모 구조조정
- 4 Urgent: 인수/피인수 제안, IPO 파일링, CEO 교체, 주요 규제 제재
- 3 Important: 대형 펀딩 라운드, 전략적 피봇, 주요 파트너십
- 2 Notable: 제품 출시, 업계 수상, 채용 확대
- 1 Info: 정기 업데이트, 마이너 블로그

---

## Phase 3: 보고

```python
# 오늘 처리된 기업 및 변경 요약
python3 -c "
import sqlite3, json
conn = sqlite3.connect('data/portfolio.db')
rows = conn.execute('''SELECT company_name, fields_updated, reason, source
    FROM company_update_log WHERE run_date=date(\"now\") ORDER BY updated_at DESC''').fetchall()
for r in rows:
    fields = json.loads(r[1] or '[]')
    print(f'  {r[0]}: {fields} ({r[3]}) — {r[2]}')
print(f'총 {len(rows)}개 기업 프로파일 업데이트')
"

# 긴급도 4 이상 뉴스
python3 -c "
import sqlite3
rows = sqlite3.connect('data/portfolio.db').execute('''
    SELECT company_name, one_line_summary, urgency_level
    FROM news_items WHERE collected_at >= datetime(\"now\",\"-24 hours\") AND urgency_level >= 4
    ORDER BY urgency_level DESC
''').fetchall()
for r in rows: print(f'  [{r[2]}] {r[0]}: {r[1]}')
"
```

최종 처리 요약 출력:
- 프로파일 업데이트: N개 기업, M개 필드
- 뉴스 수집: K건 (긴급 L건)
- 딥다이브 슬롯: used/total
- 다음 실행 대기 기업 상위 5개 (generate-plan 출력 참조)
