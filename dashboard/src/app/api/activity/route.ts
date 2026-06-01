import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '20');
  const days = parseInt(url.searchParams.get('days') ?? '7');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const updates = db.prepare(`
    SELECT company_name, fields_updated, before_values, after_values,
           reason, source, notes, updated_at, run_date
    FROM company_update_log
    WHERE run_date >= ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(cutoffStr, limit);

  const todayPlan = db.prepare(`
    SELECT plan_date, budget_total, budget_used, completed, summary,
           ordered_list, deferred_list
    FROM company_update_plan
    WHERE plan_date = date('now')
    ORDER BY created_at DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  const urgentNews = db.prepare(`
    SELECT company_name, one_line_summary, urgency_level, tags, collected_at
    FROM news_items
    WHERE collected_at >= datetime('now', '-24 hours')
      AND urgency_level >= 4
    ORDER BY urgency_level DESC, collected_at DESC
    LIMIT 5
  `).all();

  return NextResponse.json({ updates, todayPlan: todayPlan ?? null, urgentNews });
}
