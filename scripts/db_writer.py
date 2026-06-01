#!/usr/bin/env python3
"""
db_writer.py — Claude Code Agent가 수집 결과를 DB에 저장할 때 사용하는 헬퍼.
PRIVACY: 이 스크립트는 PUBLIC 데이터만 씁니다. PRIVATE 컬럼(투자금액, 지분율 등)에는 접근하지 않습니다.
"""
import sqlite3
import json
import argparse
import os
import sys
from datetime import datetime, timedelta

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.db"))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def write_news(company_name: str, title: str, summary: str, source: str,
               source_url: str, urgency: int, tags: list[str],
               raw_content: str = "", published_at: str = ""):
    """뉴스 아이템 저장 (source_url 중복 시 무시)"""
    conn = get_conn()
    try:
        conn.execute("""
            INSERT OR IGNORE INTO news_items
                (company_name, title, one_line_summary, source, source_url,
                 urgency_level, tags, raw_content, published_at)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (company_name, title, summary, source, source_url,
              urgency, json.dumps(tags, ensure_ascii=False),
              raw_content, published_at or datetime.now().isoformat()))
        conn.execute("""
            UPDATE companies
            SET latest_news_headline=?, latest_urgency=?, last_enriched_at=?
            WHERE company_name=?
        """, (summary or title, urgency, datetime.now().isoformat(), company_name))
        conn.commit()
        print(f"✅ News saved: [{urgency}] {company_name} — {title[:60]}")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
    finally:
        conn.close()


def update_company_profile(company_name: str, **kwargs):
    """기업 프로필의 Agent 수집 필드 업데이트 (PUBLIC 필드만)"""
    ALLOWED = {
        "current_employee_count", "employee_count_history", "total_funding_external_m",
        "latest_external_round", "latest_external_valuation_m", "revenue_range",
        "competitors", "all_investors", "technologies", "linkedin_url",
        "twitter_url", "logo_url", "acquisition_info", "ipo_info",
    }
    safe_kwargs = {k: v for k, v in kwargs.items() if k in ALLOWED}
    if not safe_kwargs:
        return
    safe_kwargs["last_enriched_at"] = datetime.now().isoformat()

    conn = get_conn()
    try:
        sets = ", ".join(f"{k}=?" for k in safe_kwargs)
        vals = list(safe_kwargs.values()) + [company_name]
        conn.execute(f"UPDATE companies SET {sets} WHERE company_name=?", vals)
        conn.commit()
        print(f"✅ Profile updated: {company_name} ({list(safe_kwargs.keys())})")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
    finally:
        conn.close()


def log_update_run(run_type: str, sources_used: list, companies_hit: int,
                   news_collected: int, errors: list):
    """업데이트 실행 로그 저장"""
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO update_log (run_type, sources_used, companies_hit, news_collected, errors)
            VALUES (?,?,?,?,?)
        """, (run_type, json.dumps(sources_used), companies_hit, news_collected, json.dumps(errors)))
        conn.commit()
    finally:
        conn.close()


def get_company_names() -> list[str]:
    """포트폴리오 기업명 목록 반환 (Agent 수집 루프용)"""
    conn = get_conn()
    rows = conn.execute("SELECT DISTINCT company_name FROM companies ORDER BY company_name").fetchall()
    conn.close()
    return [r[0] for r in rows]


def calculate_priority_scores():
    """Compute priority score for every company and update DB."""
    conn = get_conn()
    c = conn.cursor()

    companies = c.execute("""
        SELECT c.company_name, c.monitoring_tier, c.status, c.last_profile_update_at,
               c.latest_urgency, c.description, c.ceo_name, c.current_employee_count,
               c.priority_score
        FROM companies c
    """).fetchall()

    now = datetime.now()
    updates = []

    for row in companies:
        name, tier, status, last_update, urgency, desc, ceo, emp_count, _ = row

        # Base score from tier
        tier_score = {1: 100, 2: 50, 3: 20}.get(tier or 2, 50)

        # Status multiplier
        status_str = (status or '').lower()
        if 'pre-ipo' in status_str or 'pre ipo' in status_str:
            multiplier = 2.0
        elif 'ipo' in status_str:
            multiplier = 1.5
        elif 'acquired' in status_str or 'subsidiary' in status_str:
            multiplier = 0.5
        elif 'dead' in status_str or 'wound' in status_str or 'closed' in status_str:
            multiplier = 0.1
        else:
            multiplier = 1.0

        score = tier_score * multiplier

        # Staleness bonus
        reason_parts = []
        if last_update:
            try:
                days_ago = (now - datetime.fromisoformat(last_update.replace('Z', ''))).days
            except Exception:
                days_ago = 999
        else:
            days_ago = 999

        if days_ago >= 60:
            score += 100
            reason_parts.append(f"기아방지({days_ago}일 미체크)")
        elif days_ago >= 30:
            score += 50
            reason_parts.append(f"장기 미체크({days_ago}일)")
        elif days_ago >= 14:
            score += 25

        # Urgency bonus
        urgency_bonus = {5: 80, 4: 40, 3: 20, 2: 5}.get(urgency or 0, 0)
        if urgency_bonus:
            score += urgency_bonus
            if urgency and urgency >= 4:
                reason_parts.append(f"긴급뉴스(Level {urgency})")

        # Missing fields bonus
        missing = []
        if not desc:
            missing.append("기업소개")
            score += 30
        if not ceo:
            missing.append("CEO")
            score += 20
        if not emp_count:
            missing.append("직원수")
            score += 15
        if missing:
            reason_parts.append(f"미보완: {', '.join(missing)}")

        reason = " / ".join(reason_parts) if reason_parts else "정기 체크"
        updates.append((round(score, 2), reason, name))

    c.executemany("UPDATE companies SET priority_score=?, update_reason=? WHERE company_name=?", updates)
    conn.commit()
    conn.close()
    print(f"✅ 우선순위 점수 계산 완료: {len(updates)}개 기업")
    return updates


def generate_plan(budget: int = 30):
    """Generate today's update plan and save to DB."""
    conn = get_conn()
    c = conn.cursor()

    # Recalculate scores first
    calculate_priority_scores()
    conn.close()
    conn = get_conn()
    c = conn.cursor()

    today = datetime.now().strftime('%Y-%m-%d')

    # Get ordered list
    companies = c.execute("""
        SELECT company_name, monitoring_tier, status, priority_score, update_reason,
               last_profile_update_at, latest_urgency
        FROM companies
        ORDER BY priority_score DESC
    """).fetchall()

    ordered = []
    for row in companies:
        name, tier, status, score, reason, last_update, urgency = row
        ordered.append({
            "company": name,
            "tier": tier or 2,
            "status": status or "Unknown",
            "score": round(score or 0, 1),
            "reason": reason or "정기 체크",
            "last_update": last_update,
            "urgency": urgency or 0
        })

    today_batch = ordered[:budget]
    deferred = [o["company"] for o in ordered[budget:]]

    # Delete old plan for today if exists
    c.execute("DELETE FROM company_update_plan WHERE plan_date=?", (today,))
    c.execute("""
        INSERT INTO company_update_plan (plan_date, ordered_list, budget_total, deferred_list)
        VALUES (?, ?, ?, ?)
    """, (today, json.dumps(ordered, ensure_ascii=False),
          budget, json.dumps(deferred, ensure_ascii=False)))

    conn.commit()
    conn.close()

    print(f"\n📋 오늘의 업데이트 계획 ({today})")
    print(f"예산: {budget}콜 / 총 {len(ordered)}개 기업")
    print(f"오늘 처리: {len(today_batch)}개 / 다음으로 연기: {len(deferred)}개\n")
    for i, item in enumerate(today_batch[:10], 1):
        print(f"  {i:2d}. {item['company']:<30} score={item['score']:.1f}  {item['reason']}")
    if len(today_batch) > 10:
        print(f"  ... 외 {len(today_batch)-10}개")

    return today_batch


def log_profile_update(company: str, fields: list, before: dict, after: dict,
                        reason: str, source: str, notes: str = ""):
    """Log a company profile update to company_update_log."""
    conn = get_conn()
    today = datetime.now().strftime('%Y-%m-%d')

    # Filter to only actually changed fields
    changed_fields = [f for f in fields if before.get(f) != after.get(f)]

    if not changed_fields:
        conn.close()
        return False

    conn.execute("""
        INSERT INTO company_update_log
          (run_date, company_name, fields_updated, before_values, after_values, reason, source, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (today, company,
          json.dumps(changed_fields, ensure_ascii=False),
          json.dumps({k: before.get(k) for k in changed_fields}, ensure_ascii=False),
          json.dumps({k: after.get(k) for k in changed_fields}, ensure_ascii=False),
          reason, source, notes))

    # Mark company as updated
    conn.execute("""
        UPDATE companies SET last_profile_update_at = datetime('now')
        WHERE company_name = ?
    """, (company,))

    conn.commit()
    conn.close()
    print(f"  ✅ {company}: {', '.join(changed_fields)} 업데이트 기록")
    return True


def update_company_field(company: str, field: str, value, source: str = "agent"):
    """Update a single PUBLIC field in companies table and log the change."""
    # Only allow PUBLIC fields (not investment data)
    ALLOWED_FIELDS = {
        'status', 'ceo_name', 'description', 'current_employee_count',
        'total_funding_external_m', 'latest_external_round', 'latest_external_valuation_m',
        'revenue_range', 'competitors', 'all_investors', 'technologies',
        'linkedin_url', 'twitter_url', 'logo_url', 'latest_news_headline',
        'latest_urgency', 'acquisition_info', 'ipo_info', 'website',
        'sub_sector', 'business_model', 'key_products', 'hq_city',
        'employee_count_history', 'cofounders', 'founded_year',
    }
    if field not in ALLOWED_FIELDS:
        print(f"  ⚠️  필드 '{field}'는 업데이트 불가 (보안 정책)")
        return False

    conn = get_conn()
    row = conn.execute(f"SELECT {field} FROM companies WHERE company_name=?", (company,)).fetchone()
    if not row:
        conn.close()
        print(f"  ⚠️  기업 '{company}' 없음")
        return False

    before_val = row[0]
    conn.execute(f"UPDATE companies SET {field}=?, last_profile_update_at=datetime('now') WHERE company_name=?",
                 (value, company))
    conn.commit()
    conn.close()

    print(f"  ✅ {company}.{field}: {before_val!r} → {value!r}")
    return True


def show_plan(date: str = None):
    """Show the update plan for a given date."""
    conn = get_conn()
    date = date or datetime.now().strftime('%Y-%m-%d')
    row = conn.execute("SELECT * FROM company_update_plan WHERE plan_date=?", (date,)).fetchone()
    if not row:
        print(f"❌ {date} 계획 없음. 'generate-plan' 먼저 실행하세요.")
        conn.close()
        return

    _, plan_date, ordered_json, budget_total, budget_used, deferred_json, completed, summary, created_at = row
    ordered = json.loads(ordered_json)
    deferred = json.loads(deferred_json)

    print(f"\n📋 업데이트 계획 — {plan_date}")
    print(f"예산 {budget_used}/{budget_total}콜 사용 | 연기 {len(deferred)}개 | {'완료' if completed else '진행중'}")
    print("─" * 60)
    for i, item in enumerate(ordered[:budget_total], 1):
        print(f"  {i:2d}. {item['company']:<28} [{item['status']:<10}] score={item['score']:.1f}  {item['reason']}")
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")

    # news 서브커맨드
    p_news = sub.add_parser("news", help="뉴스 아이템 저장")
    p_news.add_argument("--company",  required=True)
    p_news.add_argument("--title",    required=True)
    p_news.add_argument("--summary",  default="")
    p_news.add_argument("--source",   default="")
    p_news.add_argument("--url",      default="")
    p_news.add_argument("--urgency",  type=int, default=1)
    p_news.add_argument("--tags",     default="[]")
    p_news.add_argument("--raw",      default="")
    p_news.add_argument("--published", default="")

    # list-companies 서브커맨드
    sub.add_parser("list-companies", help="포트폴리오 기업명 목록 출력")

    # generate-plan
    p_plan = sub.add_parser('generate-plan')
    p_plan.add_argument('--budget', default='30')

    # show-plan
    p_show = sub.add_parser('show-plan')
    p_show.add_argument('--date')

    # update-company
    p_upd = sub.add_parser('update-company')
    p_upd.add_argument('--company', required=True)
    p_upd.add_argument('--field', required=True)
    p_upd.add_argument('--value', required=True)
    p_upd.add_argument('--source', default='agent')

    # score-companies
    sub.add_parser('score-companies')

    # log-profile-update
    p_logp = sub.add_parser('log-profile-update')
    p_logp.add_argument('--company', required=True)
    p_logp.add_argument('--fields', required=True)   # JSON array string
    p_logp.add_argument('--before', required=True)   # JSON object string
    p_logp.add_argument('--after', required=True)    # JSON object string
    p_logp.add_argument('--reason', required=True)
    p_logp.add_argument('--source', default='agent')
    p_logp.add_argument('--notes', default='')

    # log-run
    p_logrun = sub.add_parser('log-run')
    p_logrun.add_argument('--type', default='scheduled')
    p_logrun.add_argument('--companies', type=int, default=0)
    p_logrun.add_argument('--news', type=int, default=0)

    args = parser.parse_args()

    if args.command == "news":
        write_news(
            args.company, args.title, args.summary,
            args.source, args.url, args.urgency,
            json.loads(args.tags), args.raw, args.published
        )
    elif args.command == "list-companies":
        for name in get_company_names():
            print(name)
    elif args.command == 'generate-plan':
        budget = int(args.budget) if hasattr(args, 'budget') and args.budget else 30
        generate_plan(budget)
    elif args.command == 'show-plan':
        show_plan(args.date if hasattr(args, 'date') and args.date else None)
    elif args.command == 'update-company':
        update_company_field(args.company, args.field, args.value, args.source or 'agent')
    elif args.command == 'score-companies':
        calculate_priority_scores()
    elif args.command == 'log-profile-update':
        fields = json.loads(args.fields)
        before = json.loads(args.before)
        after = json.loads(args.after)
        log_profile_update(args.company, fields, before, after, args.reason, args.source, args.notes or '')
    elif args.command == 'log-run':
        log_update_run(args.type, [], args.companies, args.news, [])
        print(f"✅ 실행 로그 저장: {args.type} / 기업 {args.companies}개 / 뉴스 {args.news}건")
    else:
        parser.print_help()
