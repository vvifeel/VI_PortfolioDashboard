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
from datetime import datetime, date

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.db"))

# PUBLIC fields allowed for agent writes
ALLOWED_PROFILE_FIELDS = {
    # Identity / classification
    "status", "business_stage", "market_position",
    "legal_name", "hq_city", "hq_state", "hq_country", "founded_year", "website", "crunchbase_url",
    # Description
    "description", "business_model", "revenue_model", "key_products",
    # People
    "ceo_name", "ceo_linkedin", "cto_name", "cfo_name",
    "cofounders", "key_executives", "board_members",
    # Headcount
    "current_employee_count", "employee_count_history", "employee_growth_pct",
    # Financials (external / public)
    "total_funding_external_m", "latest_external_round", "latest_external_valuation_m",
    "post_money_valuation_m", "last_funding_date", "last_funding_amount_m",
    "funding_rounds", "revenue_range", "arr_estimate",
    "profitability_status", "burn_rate_estimate",
    # Market
    "competitors", "all_investors", "technologies",
    "market_size_estimate", "patents_count",
    # Social
    "linkedin_url", "twitter_url", "logo_url",
    # Exit events
    "ipo_date", "ipo_exchange", "ipo_ticker", "ipo_price",
    "acquired_by", "acquired_date", "acquired_price_m",
    "acquisition_info", "ipo_info",
    # Intelligence signals
    "signal_summary", "signal_keywords", "signal_updated_at",
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def get_config(conn) -> dict:
    try:
        rows = conn.execute("SELECT key, value FROM intelligence_config").fetchall()
        return {r["key"]: r["value"] for r in rows}
    except Exception:
        return {}


# ─── News ────────────────────────────────────────────────────────────────────

def write_news(company_name: str, title: str, summary: str, source: str,
               source_url: str, urgency: int, tags: list,
               raw_content: str = "", published_at: str = ""):
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


# ─── Profile Update ──────────────────────────────────────────────────────────

def update_company_profile(company_name: str, **kwargs):
    """기업 프로필의 Agent 수집 필드 업데이트 (PUBLIC 필드만)"""
    safe = {k: v for k, v in kwargs.items() if k in ALLOWED_PROFILE_FIELDS}
    if not safe:
        return
    safe["last_enriched_at"] = datetime.now().isoformat()
    conn = get_conn()
    try:
        sets = ", ".join(f"{k}=?" for k in safe)
        vals = list(safe.values()) + [company_name]
        conn.execute(f"UPDATE companies SET {sets} WHERE company_name=?", vals)
        conn.commit()
        print(f"✅ Profile updated: {company_name} ({list(safe.keys())})")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
    finally:
        conn.close()


def update_company_field(company_name: str, field: str, value: str,
                         source: str = "", reason: str = "", log: bool = True):
    """Update a single PUBLIC field and optionally log the change."""
    if field not in ALLOWED_PROFILE_FIELDS:
        print(f"❌ Field '{field}' is not in the allowed PUBLIC field list.", file=sys.stderr)
        sys.exit(1)
    conn = get_conn()
    try:
        row = conn.execute(f"SELECT {field} FROM companies WHERE company_name=?",
                           (company_name,)).fetchone()
        if row is None:
            print(f"❌ Company not found: {company_name}", file=sys.stderr)
            sys.exit(1)
        before_val = dict(row)[field]
        conn.execute(f"UPDATE companies SET {field}=?, last_enriched_at=? WHERE company_name=?",
                     (value, datetime.now().isoformat(), company_name))
        if log:
            today = date.today().isoformat()
            conn.execute("""
                INSERT INTO company_update_log
                    (run_date, company_name, fields_updated, before_values, after_values, reason, source)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (today, company_name,
                  json.dumps([field]),
                  json.dumps({field: before_val}),
                  json.dumps({field: value}),
                  reason, source))
        conn.commit()
        print(f"✅ {company_name}.{field} updated ({source})")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
    finally:
        conn.close()


def log_profile_update(company_name: str, fields_updated: list,
                       before_values: dict, after_values: dict,
                       reason: str, priority_score: float, source: str,
                       notes: str = ""):
    """Log a completed multi-field profile update."""
    conn = get_conn()
    try:
        today = date.today().isoformat()
        conn.execute("""
            INSERT INTO company_update_log
                (run_date, company_name, fields_updated, before_values, after_values,
                 reason, priority_score, source, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (today, company_name,
              json.dumps(fields_updated, ensure_ascii=False),
              json.dumps(before_values, ensure_ascii=False),
              json.dumps(after_values, ensure_ascii=False),
              reason, priority_score, source, notes))
        conn.execute("""
            UPDATE companies
            SET last_profile_update_at=?, update_reason=?, priority_score=?
            WHERE company_name=?
        """, (datetime.now().isoformat(), reason, priority_score, company_name))
        conn.commit()
        print(f"✅ Update logged: {company_name} [{len(fields_updated)} fields] (score={priority_score:.1f})")
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
    finally:
        conn.close()


# ─── Priority Scoring ────────────────────────────────────────────────────────

def calculate_priority_scores(print_results: bool = False) -> list:
    """
    Score every company for profile enrichment priority.

    Score = tier_base + status_weight + staleness + urgency_bonus + missing_bonus + starvation_boost

    Starvation boost (+5.0) fires when a company hasn't been touched in starvation_days (default 15).
    """
    conn = get_conn()
    cfg = get_config(conn)
    starvation_days  = int(cfg.get("starvation_days",     "15"))
    force_check_days = int(cfg.get("force_check_days",    "15"))
    tier1_days       = int(cfg.get("tier1_frequency_days","7"))
    tier2_days       = int(cfg.get("tier2_frequency_days","14"))
    tier3_days       = int(cfg.get("tier3_frequency_days","30"))

    try:
        companies = conn.execute("""
            SELECT company_name, status, monitoring_tier, latest_urgency,
                   last_profile_update_at,
                   current_employee_count, total_funding_external_m,
                   latest_external_round, linkedin_url, logo_url, competitors
            FROM companies
        """).fetchall()
    except Exception:
        conn.close()
        return []
    conn.close()

    today = date.today()
    scores = []

    for c in companies:
        row = dict(c)
        name    = row["company_name"]
        status  = (row["status"] or "Alive").lower()
        tier    = row["monitoring_tier"] or 2
        urgency = row["latest_urgency"] or 1

        tier_base = {1: 3.0, 2: 2.0, 3: 1.0}.get(tier, 1.0)
        status_w  = {"alive": 2.0, "ipo": 2.5, "acquired": 0.8, "dead": 0.0,
                     "wound": 0.0}.get(status.split()[0], 1.5)

        freq_days = {1: tier1_days, 2: tier2_days, 3: tier3_days}.get(tier, force_check_days)
        if row["last_profile_update_at"]:
            try:
                last_dt = datetime.fromisoformat(row["last_profile_update_at"]).date()
                days_old = (today - last_dt).days
            except Exception:
                days_old = force_check_days * 4
        else:
            days_old = force_check_days * 4  # never updated = maximally stale

        staleness     = min(3.0, days_old / max(freq_days, 1))
        urgency_bonus = urgency * 0.4
        missing_fields = sum(1 for f in [
            "current_employee_count", "total_funding_external_m",
            "latest_external_round", "linkedin_url", "logo_url", "competitors"
        ] if not row.get(f))
        missing_bonus    = missing_fields * 0.3
        starvation_boost = 5.0 if days_old >= starvation_days else 0.0

        score = tier_base + status_w + staleness + urgency_bonus + missing_bonus + starvation_boost

        reason_parts = []
        if starvation_boost > 0:
            reason_parts.append(f"starvation({days_old}d)")
        if urgency >= 4:
            reason_parts.append(f"urgency={urgency}")
        if missing_fields >= 3:
            reason_parts.append(f"missing_fields={missing_fields}")
        if staleness >= 2.0:
            reason_parts.append("overdue")

        scores.append({
            "company_name":       name,
            "score":              round(score, 2),
            "reason":             ", ".join(reason_parts) or "scheduled",
            "tier":               tier,
            "status":             status,
            "days_since_update":  days_old,
            "starvation":         starvation_boost > 0,
        })

    scores.sort(key=lambda x: -x["score"])

    if print_results:
        print(f"{'Company':<35} {'Score':>6}  {'T'} {'Days':>5}  Reason")
        print("-" * 75)
        for s in scores[:30]:
            star = "⚠ " if s["starvation"] else "  "
            print(f"{star}{s['company_name']:<33} {s['score']:>6.2f}  {s['tier']}  {s['days_since_update']:>4}d  {s['reason']}")

    return scores


# ─── Plan Generation ─────────────────────────────────────────────────────────

def generate_plan(budget: int = None, print_results: bool = False) -> dict:
    """
    Create today's enrichment plan based on priority scores and session budget.

    The budget represents max CB Insights deep-dive calls per run. Since Claude Code
    does not expose token usage via API, this count acts as a token-usage proxy.
    """
    conn = get_conn()
    cfg = get_config(conn)
    budget_total = budget or int(cfg.get("session_deep_dive_limit", "30"))
    today = date.today().isoformat()
    done_today = 0
    try:
        row = conn.execute(
            "SELECT COUNT(*) as n FROM company_update_log WHERE run_date=?", (today,)
        ).fetchone()
        done_today = row["n"] if row else 0
    except Exception:
        pass
    conn.close()

    remaining = max(0, budget_total - done_today)
    scores    = calculate_priority_scores()
    ordered   = scores[:remaining]
    deferred  = [{"company_name": d["company_name"], "score": d["score"]} for d in scores[remaining:]]

    plan = {
        "plan_date":    today,
        "budget_total": budget_total,
        "budget_used":  done_today,
        "ordered_list": ordered,
        "deferred_list": deferred,
    }

    conn = get_conn()
    try:
        conn.execute("DELETE FROM company_update_plan WHERE plan_date=?", (today,))
        conn.execute("""
            INSERT INTO company_update_plan
                (plan_date, ordered_list, budget_total, budget_used, deferred_list)
            VALUES (?, ?, ?, ?, ?)
        """, (today,
              json.dumps(ordered, ensure_ascii=False),
              budget_total, done_today,
              json.dumps(deferred, ensure_ascii=False)))
        conn.commit()
    except Exception as e:
        print(f"⚠ Plan save error: {e}", file=sys.stderr)
    finally:
        conn.close()

    if print_results:
        print(f"\n📋 Enrichment Plan  {today}")
        print(f"   Budget: {remaining} slots remaining  ({done_today}/{budget_total} used today)\n")
        for i, c in enumerate(ordered, 1):
            star = "⚠ " if c.get("starvation") else "  "
            print(f"  {i:>3}.{star}{c['company_name']:<33} score={c['score']:.2f}  {c['reason']}")
        if deferred:
            print(f"\n  … {len(deferred)} companies deferred to future runs.")

    return plan


# ─── Update Log ──────────────────────────────────────────────────────────────

def log_update_run(run_type: str, sources_used: list, companies_hit: int,
                   news_collected: int, errors: list):
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO update_log (run_type, sources_used, companies_hit, news_collected, errors)
            VALUES (?,?,?,?,?)
        """, (run_type, json.dumps(sources_used), companies_hit, news_collected, json.dumps(errors)))
        conn.commit()
    finally:
        conn.close()


# ─── Company List ────────────────────────────────────────────────────────────

def get_company_names() -> list:
    conn = get_conn()
    rows = conn.execute("SELECT DISTINCT company_name FROM companies ORDER BY company_name").fetchall()
    conn.close()
    return [r["company_name"] for r in rows]


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Portfolio DB writer — PUBLIC fields only")
    sub = parser.add_subparsers(dest="cmd")

    p = sub.add_parser("news", help="뉴스 아이템 저장")
    p.add_argument("--company",   required=True)
    p.add_argument("--title",     required=True)
    p.add_argument("--summary",   default="")
    p.add_argument("--source",    default="")
    p.add_argument("--url",       default="")
    p.add_argument("--urgency",   type=int, default=1)
    p.add_argument("--tags",      default="[]")
    p.add_argument("--raw",       default="")
    p.add_argument("--published", default="")

    sub.add_parser("list-companies", help="포트폴리오 기업명 목록 출력")
    sub.add_parser("score-companies", help="우선순위 점수 계산 및 출력")

    p = sub.add_parser("generate-plan", help="오늘의 업데이트 계획 생성")
    p.add_argument("--budget", type=int, default=None)

    sub.add_parser("show-plan", help="오늘의 업데이트 계획 조회")

    p = sub.add_parser("update-company", help="기업 프로필 단일 필드 업데이트")
    p.add_argument("--company", required=True)
    p.add_argument("--field",   required=True)
    p.add_argument("--value",   required=True)
    p.add_argument("--source",  default="")
    p.add_argument("--reason",  default="")
    p.add_argument("--no-log",  action="store_true")

    p = sub.add_parser("log-profile-update", help="멀티 필드 프로필 업데이트 로그 기록")
    p.add_argument("--company",  required=True)
    p.add_argument("--fields",   required=True, help="JSON array of field names")
    p.add_argument("--before",   default="{}")
    p.add_argument("--after",    default="{}")
    p.add_argument("--reason",   default="scheduled")
    p.add_argument("--score",    type=float, default=0.0)
    p.add_argument("--source",   default="CB Insights")
    p.add_argument("--notes",    default="")

    args = parser.parse_args()

    if args.cmd == "news":
        write_news(args.company, args.title, args.summary,
                   args.source, args.url, args.urgency,
                   json.loads(args.tags), args.raw, args.published)

    elif args.cmd == "list-companies":
        for name in get_company_names():
            print(name)

    elif args.cmd == "score-companies":
        calculate_priority_scores(print_results=True)

    elif args.cmd == "generate-plan":
        generate_plan(budget=args.budget, print_results=True)

    elif args.cmd == "show-plan":
        conn = get_conn()
        row = conn.execute(
            "SELECT * FROM company_update_plan WHERE plan_date=? ORDER BY id DESC LIMIT 1",
            (date.today().isoformat(),)
        ).fetchone()
        conn.close()
        if row:
            plan = dict(row)
            ordered = json.loads(plan["ordered_list"])
            print(f"Plan for {plan['plan_date']}  budget: {plan['budget_used']}/{plan['budget_total']}")
            for i, c in enumerate(ordered, 1):
                name = c.get("company_name", "?")
                print(f"  {i:>3}. {name:<35} score={c.get('score', 0):.2f}  {c.get('reason','')}")
        else:
            print("No plan for today. Run: python3 scripts/db_writer.py generate-plan")

    elif args.cmd == "update-company":
        update_company_field(args.company, args.field, args.value,
                             source=args.source, reason=args.reason,
                             log=not args.no_log)

    elif args.cmd == "log-profile-update":
        log_profile_update(
            company_name   = args.company,
            fields_updated = json.loads(args.fields),
            before_values  = json.loads(args.before),
            after_values   = json.loads(args.after),
            reason         = args.reason,
            priority_score = args.score,
            source         = args.source,
            notes          = args.notes,
        )

    else:
        parser.print_help()
