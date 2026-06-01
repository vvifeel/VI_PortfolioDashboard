#!/usr/bin/env python3
import sqlite3, os
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'portfolio.db')
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.executescript("""
-- Per-company update log
CREATE TABLE IF NOT EXISTS company_update_log (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date         TEXT NOT NULL,
    company_name     TEXT NOT NULL,
    fields_updated   TEXT DEFAULT '[]',   -- JSON array of field names
    before_values    TEXT DEFAULT '{}',   -- JSON snapshot before
    after_values     TEXT DEFAULT '{}',   -- JSON snapshot after
    reason           TEXT,                -- why this company was selected
    priority_score   REAL DEFAULT 0,
    source           TEXT,                -- CB Insights / RSS / manual
    notes            TEXT,
    updated_at       TEXT DEFAULT (datetime('now'))
);

-- Daily update plans
CREATE TABLE IF NOT EXISTS company_update_plan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_date       TEXT NOT NULL,
    ordered_list    TEXT DEFAULT '[]',    -- JSON [{company, score, reason, status}]
    budget_total    INTEGER DEFAULT 30,
    budget_used     INTEGER DEFAULT 0,
    deferred_list   TEXT DEFAULT '[]',    -- JSON [company names deferred]
    completed       INTEGER DEFAULT 0,
    summary         TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_update_log_company ON company_update_log(company_name);
CREATE INDEX IF NOT EXISTS idx_update_log_date    ON company_update_log(run_date);
CREATE INDEX IF NOT EXISTS idx_update_plan_date   ON company_update_plan(plan_date);
""")

# Add columns to companies if not exist
for col_def in [
    ("priority_score",         "REAL DEFAULT 0"),
    ("last_profile_update_at", "TEXT"),
    ("update_reason",          "TEXT"),
]:
    try:
        c.execute(f"ALTER TABLE companies ADD COLUMN {col_def[0]} {col_def[1]}")
    except Exception:
        pass  # already exists

# Add cb_daily_budget to intelligence_config
c.execute("INSERT OR IGNORE INTO intelligence_config (key, value) VALUES ('cb_daily_budget', '30')")
c.execute("INSERT OR IGNORE INTO intelligence_config (key, value) VALUES ('starvation_days', '60')")
c.execute("INSERT OR IGNORE INTO intelligence_config (key, value) VALUES ('force_check_days', '30')")

conn.commit()
conn.close()
print("Schema updated")
