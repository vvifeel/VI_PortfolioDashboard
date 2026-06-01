# 포트폴리오 일일 인텔리전스 업데이트

## 작업 목표
포트폴리오 기업들의 최신 뉴스를 수집하여 DB에 저장하고 긴급 이슈를 파악한다.

## Privacy 규칙 (반드시 준수)
- 외부 API/MCP 호출 시 회사명(텍스트)만 전달
- investment_amount, stake_pct, investment_terms 등 투자 세부 데이터는 절대 외부 전달 금지

## 실행 단계

### 1. 기업 목록 조회
```bash
python3 scripts/db_writer.py list-companies
```

### 2. 활성 모니터링 소스 확인
```bash
sqlite3 data/portfolio.db "SELECT name, type, config, frequency FROM monitoring_sources WHERE active=1"
```

### 3. 소스별 뉴스 수집
활성 소스에 따라:
- **RSS 소스**: feedparser로 각 기업명으로 Google News RSS 검색
  - URL 패턴: `https://news.google.com/rss/search?q={company_name}+startup&hl=en-US`
- **CB Insights MCP** (구독 활성 시): CB Insights MCP 도구 호출 (`get_company_news`)
- **웹검색**: 기업명으로 최신 뉴스 검색

### 4. 수집 결과 처리
각 기사에 대해:
1. 1줄 한국어 요약 생성 (기사 본문만 사용, 투자 데이터 미포함)
2. 긴급도 1-5 분류 (CLAUDE.md 기준 참고)
3. 태그 분류: funding | ipo | acquisition | leadership | product | regulatory | competition | partnership | financial

### 5. DB 저장
```bash
python3 scripts/db_writer.py news \
  --company "{company_name}" \
  --title "{article_title}" \
  --summary "{1줄 한국어 요약}" \
  --source "{source_name}" \
  --url "{article_url}" \
  --urgency {1-5} \
  --tags '["{tag1}", "{tag2}"]'
```

### 6. 완료 보고
긴급도 4 이상 이슈 목록을 출력한다.

## 주의사항
- 이미 수집된 URL (source_url UNIQUE)은 자동으로 무시됨 (중복 방지)
- 기업 목록이 많을 경우 배치로 처리 (한 번에 50개씩)
- 오류 발생 시 해당 기업 건너뛰고 계속 진행
