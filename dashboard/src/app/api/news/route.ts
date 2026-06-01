import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urgency  = searchParams.get('urgency');   // comma-separated levels e.g. "4,5"
  const tag      = searchParams.get('tag') ?? '';
  const company  = searchParams.get('company') ?? '';
  const page     = parseInt(searchParams.get('page') ?? '1');
  const limit    = parseInt(searchParams.get('limit') ?? '40');
  const offset   = (page - 1) * limit;

  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (urgency) {
    const levels = urgency.split(',').map(Number).filter(n => n >= 1 && n <= 5);
    if (levels.length) {
      conditions.push(`urgency_level IN (${levels.join(',')})`);
    }
  }
  if (tag)     { conditions.push("tags LIKE ?");         params.push(`%"${tag}"%`); }
  if (company) { conditions.push("company_name LIKE ?"); params.push(`%${company}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as n FROM news_items ${where}`).get(...params) as { n: number }).n;

  const rows = db.prepare(`
    SELECT * FROM news_items
    ${where}
    ORDER BY urgency_level DESC, collected_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return NextResponse.json({ data: rows, total, page, limit });
}
