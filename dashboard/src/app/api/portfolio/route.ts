import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search  = searchParams.get('search')  ?? '';
  const sector  = searchParams.get('sector')  ?? '';
  const region  = searchParams.get('region')  ?? '';
  const round   = searchParams.get('round')   ?? '';
  const status  = searchParams.get('status')  ?? '';
  const tier    = searchParams.get('tier')    ?? '';
  const page    = parseInt(searchParams.get('page')  ?? '1');
  const limit   = parseInt(searchParams.get('limit') ?? '30');
  const offset  = (page - 1) * limit;

  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push('(c.company_name LIKE ? OR c.description LIKE ? OR c.sector LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (sector) { conditions.push('c.sector = ?');  params.push(sector); }
  if (region) { conditions.push('c.region = ?');  params.push(region); }
  if (tier)   { conditions.push('COALESCE(c.monitoring_tier, 2) = ?'); params.push(parseInt(tier)); }

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
      c.company_name,
      c.sector,
      c.region,
      c.status,
      c.monitoring_tier,
      c.latest_urgency,
      c.latest_news_headline,
      c.signal_summary,
      c.signal_keywords,
      c.signal_updated_at,
      c.last_profile_update_at,
      c.founded_year,
      c.hq_city,
      c.current_employee_count,
      c.total_funding_external_m,
      c.latest_external_round,
      c.description,
      (SELECT tags FROM news_items
       WHERE company_name = c.company_name
       ORDER BY urgency_level DESC, collected_at DESC LIMIT 1) as latest_news_tags,
      (SELECT MAX(collected_at) FROM news_items
       WHERE company_name = c.company_name) as last_news_collected_at,
      (SELECT COUNT(*) FROM portfolio_investments
       WHERE company_name = c.company_name) as investment_count,
      -- All investments as JSON array (chronological order)
      (SELECT json_group_array(json_object(
        'id', pi2.id,
        'round', pi2.round,
        'investment_year', pi2.investment_year,
        'investment_month', pi2.investment_month,
        'investment_type', pi2.investment_type,
        'investment_amount_m', pi2.investment_amount_m,
        'stake_pct', pi2.stake_pct,
        'valuation_at_investment_m', pi2.valuation_at_investment_m,
        'current_valuation_m', pi2.current_valuation_m,
        'investment_terms', pi2.investment_terms,
        'round_total_m', pi2.round_total_m
      ))
      FROM (SELECT * FROM portfolio_investments
            WHERE company_name = c.company_name
            ORDER BY investment_year ASC, id ASC) pi2
      ) as investments_json,
      COALESCE((SELECT SUM(investment_amount_m) FROM portfolio_investments
                WHERE company_name = c.company_name), 0) as total_investment_m,
      -- Latest investment fields (for client-side filtering)
      li.investment_type,
      li.investment_year  AS inv_year,
      li.investment_month AS inv_month,
      li.investment_amount_m,
      li.stake_pct,
      li.round            AS inv_round,
      li.round_total_m,
      li.valuation_at_investment_m,
      li.current_valuation_m,
      li.investment_terms,
      li.portfolio_manager
    FROM companies c
    LEFT JOIN portfolio_investments li
      ON li.company_name = c.company_name
      AND li.id = (
        SELECT id FROM portfolio_investments
        WHERE company_name = c.company_name
        ORDER BY investment_year DESC, id DESC LIMIT 1
      )
    ${where}
    ORDER BY
      COALESCE(c.signal_updated_at,
               (SELECT MAX(collected_at) FROM news_items WHERE company_name = c.company_name),
               '1970-01-01') DESC,
      c.latest_urgency DESC NULLS LAST,
      c.company_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<Record<string, unknown>>;

  // Parse investments JSON for each row
  const processedRows = rows.map(r => ({
    ...r,
    investments: r.investments_json ? JSON.parse(r.investments_json as string) : [],
    investments_json: undefined,
  }));

  // Filter options for dropdowns
  const sectors = (db.prepare('SELECT DISTINCT sector FROM companies WHERE sector IS NOT NULL ORDER BY sector').all() as Array<{sector: string}>).map(r => r.sector);
  const regions = (db.prepare('SELECT DISTINCT region FROM companies WHERE region IS NOT NULL ORDER BY region').all() as Array<{region: string}>).map(r => r.region);
  const rounds  = (db.prepare('SELECT DISTINCT round FROM portfolio_investments WHERE round IS NOT NULL ORDER BY round').all() as Array<{round: string}>).map(r => r.round);

  return NextResponse.json({ data: processedRows, total, page, limit, sectors, regions, rounds });
}
