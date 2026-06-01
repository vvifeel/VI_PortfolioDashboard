import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Database from 'better-sqlite3';
import path from 'path';

function getWriteDb() {
  const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : path.join(process.cwd(), '..', 'data', 'portfolio.db');
  return new Database(dbPath);
}

export async function GET() {
  const db = getDb();

  const sources = db.prepare(`
    SELECT id, name, type, config, active, frequency, cost_type, description, phase, coming_soon
    FROM monitoring_sources ORDER BY phase, coming_soon, cost_type, name
  `).all();

  const tierCounts = db.prepare(`
    SELECT monitoring_tier, COUNT(*) as count FROM companies GROUP BY monitoring_tier
  `).all() as Array<{ monitoring_tier: number; count: number }>;

  const config = db.prepare(`SELECT key, value FROM intelligence_config`).all() as Array<{ key: string; value: string }>;

  const lastRun = db.prepare(`
    SELECT run_at, news_collected, companies_hit FROM update_log ORDER BY run_at DESC LIMIT 1
  `).get();

  const tierCountMap: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  tierCounts.forEach(r => { tierCountMap[r.monitoring_tier] = r.count; });

  const configMap: Record<string, string> = {};
  config.forEach(r => { configMap[r.key] = r.value; });

  return NextResponse.json({ sources, tierCounts: tierCountMap, config: configMap, lastRun });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const db = getWriteDb();

  if (body.configKey && body.value !== undefined) {
    db.prepare(`INSERT OR REPLACE INTO intelligence_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(body.configKey, body.value);
  }

  if (body.sourceId !== undefined && body.active !== undefined) {
    db.prepare(`UPDATE monitoring_sources SET active=? WHERE id=?`).run(body.active ? 1 : 0, body.sourceId);
  }

  db.close();
  return NextResponse.json({ ok: true });
}
