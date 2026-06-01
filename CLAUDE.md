# VI Portfolio Dashboard — Claude Code Agent

이 레포지토리는 VC 포트폴리오 인텔리전스 시스템입니다.
Claude Code Agent가 뉴스 수집 및 DB 업데이트를 담당합니다.

## 절대 규칙 — Privacy

외부 API / MCP 도구 호출 시:
- ✅ 허용: company_name (텍스트 문자열만)
- ❌ 금지: investment_amount_m, stake_pct, investment_year, investment_terms, valuation_at_investment_m, current_valuation_m

포트폴리오 기업 목록 조회:
```bash
python3 scripts/db_writer.py list-companies
```

## 파일 구조

```
data/portfolio.db          # SQLite DB (메인 데이터)
scripts/
  init_db.py               # DB 스키마 초기화
  import_excel.py          # Excel → DB import
  db_writer.py             # 수집 결과 DB 저장 헬퍼
  rss_poll.py              # RSS 경량 수집 (AI 없음)
.claude/prompts/
  daily_update.md          # 일일 업데이트 프롬프트
dashboard/                 # Next.js 대시보드 (포트 3000)
```

## 수집 뉴스 저장 방법

```bash
python3 scripts/db_writer.py news \
  --company "Airtable" \
  --title "Airtable raises Series D" \
  --summary "Airtable, Series D 펀딩 완료로 기업가치 $15B 달성" \
  --source "TechCrunch" \
  --url "https://techcrunch.com/..." \
  --urgency 4 \
  --tags '["funding", "valuation"]'
```

## 긴급도 분류 기준

- 5 Critical: 파산, 완전 매각, 주요 스캔들, 대규모 구조조정
- 4 Urgent: 인수/피인수 제안, IPO 파일링, CEO 교체, 주요 규제 제재
- 3 Important: 대형 펀딩 라운드, 전략적 피봇, 주요 파트너십
- 2 Notable: 제품 출시, 업계 수상, 소규모 채용 확대
- 1 Info: 정기 업데이트, 마이너 블로그 포스트

## 태그 목록

funding, ipo, acquisition, leadership, product, regulatory, competition, partnership, financial

## 대시보드 실행

```bash
cd dashboard && npm run dev    # 개발 (포트 3000)
cd dashboard && npm run build && npm start  # 프로덕션
```
