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
from datetime import datetime

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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

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

    args = parser.parse_args()

    if args.cmd == "news":
        write_news(
            args.company, args.title, args.summary,
            args.source, args.url, args.urgency,
            json.loads(args.tags), args.raw, args.published
        )
    elif args.cmd == "list-companies":
        for name in get_company_names():
            print(name)
    else:
        parser.print_help()
