#!/usr/bin/env python3
"""
DB migration v2: add CB Insights / PitchBook-style fields to companies table.
Designed from scratch as a proper VC intelligence schema.
Existing data and columns are preserved — this is additive only.
"""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.db"))


def migrate():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    existing = {row[1] for row in c.execute("PRAGMA table_info(companies)").fetchall()}

    # ── Financial metrics ─────────────────────────────────────────────────────
    financial = [
        ("last_funding_date",       "TEXT"),       # most recent external round date
        ("last_funding_amount_m",   "REAL"),       # amount of most recent round ($M)
        ("post_money_valuation_m",  "REAL"),       # post-money valuation after last round
        ("arr_estimate",            "TEXT"),       # e.g. "$10M–$50M"
        ("revenue_model",           "TEXT"),       # SaaS / Transaction / Services / Marketplace
        ("profitability_status",    "TEXT"),       # Pre-revenue / Revenue / Profitable / Cash-flow+
        ("burn_rate_estimate",      "TEXT"),       # e.g. "$2M/month"
        ("funding_rounds",          "TEXT"),       # JSON: [{date,type,amount_m,lead_investors,post_money_m}]
    ]

    # ── People & org ──────────────────────────────────────────────────────────
    people = [
        ("ceo_linkedin",            "TEXT"),
        ("key_executives",          "TEXT"),       # JSON: [{name,title,linkedin}]
        ("board_members",           "TEXT"),       # JSON: [{name,organization}]
        ("employee_growth_pct",     "REAL"),       # YoY % change in headcount
    ]

    # ── Market & company identity ─────────────────────────────────────────────
    market = [
        ("legal_name",              "TEXT"),       # legal entity name (DBA)
        ("hq_country",              "TEXT"),       # ISO-2 country code e.g. US, KR, IL
        ("hq_state",                "TEXT"),       # state / province
        ("market_size_estimate",    "TEXT"),       # TAM description e.g. "$50B by 2027"
        ("market_position",         "TEXT"),       # Leader / Challenger / Niche
        ("business_stage",          "TEXT"),       # Early / Growth / Late / Mature
        ("patents_count",           "INTEGER"),
        ("crunchbase_url",          "TEXT"),
    ]

    # ── Exit / events ─────────────────────────────────────────────────────────
    exit_fields = [
        ("ipo_date",                "TEXT"),
        ("ipo_exchange",            "TEXT"),       # NYSE / NASDAQ / LSE / KRX
        ("ipo_ticker",              "TEXT"),
        ("ipo_price",               "REAL"),       # IPO price per share
        ("acquired_by",             "TEXT"),
        ("acquired_date",           "TEXT"),
        ("acquired_price_m",        "REAL"),
    ]

    # ── Intelligence signals (agent-populated) ────────────────────────────────
    signals = [
        ("signal_summary",          "TEXT"),       # AI one-liner for portfolio list view
        ("signal_keywords",         "TEXT"),       # JSON: ["funding","leadership_change"]
        ("signal_updated_at",       "TEXT"),       # when signal was last computed
    ]

    all_new = financial + people + market + exit_fields + signals
    added = []
    for col, defn in all_new:
        if col not in existing:
            c.execute(f"ALTER TABLE companies ADD COLUMN {col} {defn}")
            added.append(col)

    # ── Index for signal lookups ───────────────────────────────────────────────
    c.execute("CREATE INDEX IF NOT EXISTS idx_companies_signal_updated ON companies(signal_updated_at)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_companies_tier ON companies(monitoring_tier)")

    conn.commit()
    conn.close()

    if added:
        print(f"✅ Added {len(added)} columns: {', '.join(added)}")
    else:
        print("✅ Schema already up to date — no changes needed")
    print(f"   DB: {DB_PATH}")


if __name__ == "__main__":
    migrate()
