import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
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
  const companies = db.prepare(`
    SELECT company_name, monitoring_tier, status, sector, last_profile_update_at
    FROM companies ORDER BY monitoring_tier ASC, company_name ASC
  `).all();
  return NextResponse.json({ companies });
}

export async function PATCH(req: NextRequest) {
  const { company_name, tier } = await req.json();
  if (!company_name || ![1, 2, 3].includes(tier)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const db = getWriteDb();
  db.prepare(`UPDATE companies SET monitoring_tier=? WHERE company_name=?`).run(tier, company_name);
  db.close();
  return NextResponse.json({ ok: true });
}
