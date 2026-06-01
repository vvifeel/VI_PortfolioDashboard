#!/usr/bin/env python3
"""Initialize the portfolio SQLite database schema."""
import sqlite3
import os
import sys

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.db"))

def init():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.executescript("""
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- ── PRIVATE: 투자 거래 내역 ──────────────────────────────
    CREATE TABLE IF NOT EXISTS portfolio_investments (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name              TEXT NOT NULL,
        investment_type           TEXT,          -- 지분투자 | 전환채권
        investment_year           INTEGER,
        investment_month          INTEGER,
        investment_amount_m       REAL,
        round                     TEXT,          -- Seed | Series A .. Pre-IPO
        round_total_m             REAL,
        stake_pct                 REAL,
        investment_terms          TEXT,
        valuation_at_investment_m REAL,
        current_valuation_m       REAL,
        portfolio_manager         TEXT,
        board_member              TEXT,
        co_investors              TEXT,
        investment_thesis         TEXT,
        target_exit_year          INTEGER,
        next_review_date          TEXT,
        notes                     TEXT,
        imported_at               TEXT DEFAULT (datetime('now')),
        UNIQUE(company_name, investment_year, investment_month, round)
    );

    -- ── PUBLIC: 기업 프로필 (사전 준비 + Agent 수집) ──────────
    CREATE TABLE IF NOT EXISTS companies (
        company_name                 TEXT PRIMARY KEY,
        company_name_ko              TEXT,
        sector                       TEXT,
        sub_sector                   TEXT,
        region                       TEXT,
        hq_city                      TEXT,
        founded_year                 INTEGER,
        status                       TEXT,        -- Alive | IPO | Acquired | Dead
        website                      TEXT,
        description                  TEXT,
        business_model               TEXT,
        key_products                 TEXT,
        ceo_name                     TEXT,
        cto_name                     TEXT,
        cfo_name                     TEXT,
        cofounders                   TEXT,
        employee_count_at_investment INTEGER,
        -- Agent 자동 수집 필드 (초기 NULL)
        current_employee_count       INTEGER,
        employee_count_history       TEXT,        -- JSON array [{date, count}]
        total_funding_external_m     REAL,
        latest_external_round        TEXT,
        latest_external_valuation_m  REAL,
        revenue_range                TEXT,        -- e.g. "$10M-$50M"
        competitors                  TEXT,        -- JSON array
        all_investors                TEXT,        -- JSON array
        technologies                 TEXT,        -- JSON array
        linkedin_url                 TEXT,
        twitter_url                  TEXT,
        logo_url                     TEXT,
        latest_news_headline         TEXT,
        latest_urgency               INTEGER,     -- 1-5
        acquisition_info             TEXT,        -- JSON
        ipo_info                     TEXT,        -- JSON
        last_enriched_at             TEXT
    );

    -- ── PUBLIC: 수집 뉴스 아이템 ──────────────────────────────
    CREATE TABLE IF NOT EXISTS news_items (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name     TEXT NOT NULL,
        title            TEXT,
        one_line_summary TEXT,
        source           TEXT,
        source_url       TEXT UNIQUE,
        published_at     TEXT,
        collected_at     TEXT DEFAULT (datetime('now')),
        urgency_level    INTEGER DEFAULT 1,       -- 1-5
        tags             TEXT DEFAULT '[]',       -- JSON array
        raw_content      TEXT,
        is_read          INTEGER DEFAULT 0
    );

    -- ── 소스 관리 ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS monitoring_sources (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,    -- rss | mcp | scrape | search
        config      TEXT NOT NULL,   -- JSON
        active      INTEGER DEFAULT 1,
        frequency   TEXT DEFAULT 'daily',  -- realtime | daily | weekly
        cost_type   TEXT DEFAULT 'free',   -- free | subscription
        description TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- ── 업데이트 로그 ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS update_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        run_at         TEXT DEFAULT (datetime('now')),
        run_type       TEXT,           -- scheduled | manual
        sources_used   TEXT,           -- JSON array
        companies_hit  INTEGER DEFAULT 0,
        news_collected INTEGER DEFAULT 0,
        errors         TEXT DEFAULT '[]'
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_investments_company ON portfolio_investments(company_name);
    CREATE INDEX IF NOT EXISTS idx_news_company        ON news_items(company_name);
    CREATE INDEX IF NOT EXISTS idx_news_urgency        ON news_items(urgency_level);
    CREATE INDEX IF NOT EXISTS idx_news_collected      ON news_items(collected_at);
    """)

    # 기본 모니터링 소스 시드
    defaults = [
        ("Google News RSS",    "rss",    '{"url_template": "https://news.google.com/rss/search?q={company}+startup&hl=en-US&gl=US&ceid=US:en"}', 1, "realtime", "free", "회사명 기반 Google 뉴스 RSS"),
        ("TechCrunch RSS",     "rss",    '{"url": "https://techcrunch.com/feed/"}',                                                               1, "daily",    "free", "스타트업 전문 뉴스"),
        ("VentureBeat RSS",    "rss",    '{"url": "https://venturebeat.com/feed/"}',                                                              1, "daily",    "free", "AI·기술 스타트업 뉴스"),
        ("Reuters Tech RSS",   "rss",    '{"url": "https://feeds.reuters.com/reuters/technologyNews"}',                                           1, "daily",    "free", "Reuters 기술 뉴스"),
        ("CB Insights",        "mcp",    '{"tool": "get_company_news", "mcp_id": "46513b98"}',                                                    1, "daily",    "subscription", "CB Insights 기업 뉴스 및 프로필"),
        ("Bloomberg",          "scrape", '{"url": "https://www.bloomberg.com", "requires_login": true}',                                         0, "realtime", "subscription", "Bloomberg 로그인 세션 스크래핑 (별도 설정 필요)"),
    ]
    c.executemany(
        "INSERT OR IGNORE INTO monitoring_sources (name, type, config, active, frequency, cost_type, description) VALUES (?,?,?,?,?,?,?)",
        defaults
    )

    conn.commit()
    conn.close()
    print(f"✅ DB initialized: {DB_PATH}")

if __name__ == "__main__":
    init()
