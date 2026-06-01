#!/usr/bin/env python3
"""DB migration: add company profile enrichment tracking tables and columns."""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.db"))


def migrate():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.executescript("""
    -- Per-company profile update audit log
    CREATE TABLE IF NOT EXISTS company_update_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        run_date         TEXT NOT NULL,
        company_name     TEXT NOT NULL,
        fields_updated   TEXT DEFAULT '[]',  -- JSON array of field names changed
        before_values    TEXT DEFAULT '{}',  -- JSON snapshot of values before
        after_values     TEXT DEFAULT '{}',  -- JSON snapshot of values after
        reason           TEXT,               -- why selected (starvation/urgency/tier/scheduled)
        priority_score   REAL DEFAULT 0,
        source           TEXT,               -- CB Insights / RSS / manual
        notes            TEXT,
        updated_at       TEXT DEFAULT (datetime('now'))
    );

    -- Daily enrichment plan (one row per run)
    CREATE TABLE IF NOT EXISTS company_update_plan (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_date     TEXT NOT NULL,
        ordered_list  TEXT DEFAULT '[]',  -- JSON [{company, score, reason}]
        budget_total  INTEGER DEFAULT 30,
        budget_used   INTEGER DEFAULT 0,
        deferred_list TEXT DEFAULT '[]',  -- companies skipped due to budget
        completed     INTEGER DEFAULT 0,
        summary       TEXT,
        created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_update_log_company ON company_update_log(company_name);
    CREATE INDEX IF NOT EXISTS idx_update_log_date    ON company_update_log(run_date);
    CREATE INDEX IF NOT EXISTS idx_update_plan_date   ON company_update_plan(plan_date);
    """)

    # Add new columns to companies if they don't exist yet
    existing_cols = {row[1] for row in c.execute("PRAGMA table_info(companies)").fetchall()}
    new_cols = [
        ("priority_score",        "REAL DEFAULT 0"),
        ("last_profile_update_at","TEXT"),
        ("update_reason",         "TEXT"),
    ]
    for col, defn in new_cols:
        if col not in existing_cols:
            c.execute(f"ALTER TABLE companies ADD COLUMN {col} {defn}")
            print(f"  + companies.{col}")

    # Seed intelligence_config — INSERT OR IGNORE keeps user edits intact
    # session_deep_dive_limit replaces the old cb_daily_budget concept:
    # Direct Claude Code token counting is not available via API, so this count
    # serves as a practical token-usage proxy (each deep dive ~1-3K tokens).
    config_seeds = [
        ("session_deep_dive_limit", "30"),
        ("starvation_days",         "15"),  # days before emergency priority boost
        ("force_check_days",        "15"),  # days before any company must be refreshed
        ("tier1_frequency_days",    "7"),
        ("tier2_frequency_days",    "14"),
        ("tier3_frequency_days",    "30"),
        ("min_urgency_for_immediate","4"),
        ("phase1_batch_size",       "15"),
    ]
    for key, val in config_seeds:
        c.execute("INSERT OR IGNORE INTO intelligence_config (key, value) VALUES (?, ?)", (key, val))

    # Fix old wrong defaults if they were set before this migration
    for key, correct_val in [("starvation_days", "15"), ("force_check_days", "15")]:
        row = c.execute("SELECT value FROM intelligence_config WHERE key=?", (key,)).fetchone()
        if row and int(row[0]) > 15:
            c.execute("UPDATE intelligence_config SET value=? WHERE key=?", (correct_val, key))
            print(f"  Updated {key}: {row[0]} → {correct_val}")

    # Remove the old cb_daily_budget key if it exists (replaced by session_deep_dive_limit)
    c.execute("DELETE FROM intelligence_config WHERE key='cb_daily_budget'")

    conn.commit()
    conn.close()
    print(f"✅ Enrichment migration complete: {DB_PATH}")


if __name__ == "__main__":
    migrate()
