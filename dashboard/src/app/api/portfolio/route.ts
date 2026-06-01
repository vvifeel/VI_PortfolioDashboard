import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search  = searchParams.get('search')  ?? '';
  const sector  = searchParams.get('sector')  ?? '';
  const region  = searchParams.get('region')  ?? '';
  const round   = searchParams.get('round')   ?? '';
  const status  = searchParams.get('status')  ?? '';
  const page    = parseInt(searchParams.get('page') ?? '1');
  const limit   = parseInt(searchParams.get('limit') ?? '30');
  const offset  = (page - 1) * limit;

  const db = getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push('(c.company_name LIKE ? OR c.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (sector)  { conditions.push('c.sector = ?');  params.push(sector); }
  if (region)  { conditions.push('c.region = ?');  params.push(region); }
  if (status === 'Alive')    { conditions.push("c.status = 'Alive'"); }
  else if (status === 'IPO') { conditions.push("c.status LIKE 'IPO%'"); }
  else if (status === 'Acquired') { conditions.push("(c.status LIKE 'Acquired%' OR c.status LIKE 'Subsidiary%')"); }
  else if (status === 'Dead') { conditions.push("(c.status LIKE 'Dead%' OR c.status LIKE '%Wound%')"); }

  if (round) {
    conditions.push('EXISTS (SELECT 1 FROM portfolio_investments pi WHERE pi.company_name = c.company_name AND pi.round = ?)');
    params.push(round);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as n FROM companies c ${where}`).get(...params) as { n: number }).n;

  const rows = db.prepare(`
    SELECT
      c.company_name, c.sector, c.region, c.status,
      c.latest_urgency, c.latest_news_headline,
      (SELECT tags FROM news_items WHERE company_name = c.company_name
       ORDER BY urgency_level DESC, collected_at DESC LIMIT 1) as latest_news_tags,
      (SELECT COUNT(*) FROM portfolio_investments WHERE company_name = c.company_name) as investment_count
    FROM companies c
    ${where}
    ORDER BY c.latest_urgency DESC NULLS LAST, c.company_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Filter options
  const sectors = (db.prepare('SELECT DISTINCT sector FROM companies WHERE sector IS NOT NULL ORDER BY sector').all() as Array<{sector: string}>).map(r => r.sector);
  const regions = (db.prepare('SELECT DISTINCT region FROM companies WHERE region IS NOT NULL ORDER BY region').all() as Array<{region: string}>).map(r => r.region);
  const rounds  = (db.prepare('SELECT DISTINCT round FROM portfolio_investments WHERE round IS NOT NULL ORDER BY round').all() as Array<{round: string}>).map(r => r.round);

  return NextResponse.json({ data: rows, total, page, limit, sectors, regions, rounds });
}
