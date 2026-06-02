import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const db = getDb();
  const url = new URL(request.url);

  // Date range filter (dateFrom / dateTo replace the old yearFrom)
  const dateFrom = url.searchParams.get('dateFrom') ?? '';
  const dateTo   = url.searchParams.get('dateTo')   ?? '';

  // Build investment year filter from date range
  const conditions: string[] = [];
  if (dateFrom) {
    const yr = new Date(dateFrom).getFullYear();
    conditions.push(`investment_year >= ${yr}`);
  }
  if (dateTo) {
    const yr = new Date(dateTo).getFullYear();
    conditions.push(`investment_year <= ${yr}`);
  }
  const yearFilter = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalCompanies = (db.prepare('SELECT COUNT(*) as n FROM companies').get() as { n: number }).n;
  const totalInvestments = (db.prepare(
    `SELECT COUNT(*) as n FROM portfolio_investments WHERE 1=1 ${yearFilter}`
  ).get() as { n: number }).n;
  const totalSectors = (db.prepare(
    'SELECT COUNT(DISTINCT sector) as n FROM companies WHERE sector IS NOT NULL'
  ).get() as { n: number }).n;
  const totalRegions = (db.prepare(
    'SELECT COUNT(DISTINCT region) as n FROM companies WHERE region IS NOT NULL'
  ).get() as { n: number }).n;

  const statusCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'Alive' THEN 1 ELSE 0 END) as alive,
      SUM(CASE WHEN status LIKE 'IPO%' THEN 1 ELSE 0 END) as ipo,
      SUM(CASE WHEN status LIKE 'Acquired%' OR status LIKE 'Subsidiary%' THEN 1 ELSE 0 END) as acquired,
      SUM(CASE WHEN status LIKE 'Dead%' OR status LIKE '%Wound%' THEN 1 ELSE 0 END) as dead
    FROM companies
  `).get() as { alive: number; ipo: number; acquired: number; dead: number };

  // ── Charts ────────────────────────────────────────────────────────────────
  const sectorDist = db.prepare(`
    SELECT sector as name, COUNT(*) as value FROM companies
    WHERE sector IS NOT NULL GROUP BY sector ORDER BY value DESC LIMIT 15
  `).all() as Array<{ name: string; value: number }>;

  const regionDist = db.prepare(`
    SELECT region as name, COUNT(*) as value FROM companies
    WHERE region IS NOT NULL GROUP BY region ORDER BY value DESC LIMIT 15
  `).all() as Array<{ name: string; value: number }>;

  const vintageDist = db.prepare(`
    SELECT investment_year as year, COUNT(*) as count
    FROM portfolio_investments
    WHERE investment_year IS NOT NULL ${yearFilter}
    GROUP BY investment_year ORDER BY investment_year
  `).all() as Array<{ year: number; count: number }>;

  const roundDist = db.prepare(`
    SELECT round as name, COUNT(*) as value
    FROM portfolio_investments
    WHERE round IS NOT NULL ${yearFilter}
    GROUP BY round ORDER BY value DESC
  `).all() as Array<{ name: string; value: number }>;

  const statusDist = db.prepare(`
    SELECT
      CASE
        WHEN status = 'Alive' THEN 'Alive'
        WHEN status LIKE 'IPO%' THEN 'IPO'
        WHEN status LIKE 'Acquired%' OR status LIKE 'Subsidiary%' THEN 'Acquired'
        WHEN status LIKE 'Dead%' OR status LIKE '%Wound%' THEN 'Dead/Closed'
        ELSE 'Other'
      END as name,
      COUNT(*) as value
    FROM companies GROUP BY name ORDER BY value DESC
  `).all() as Array<{ name: string; value: number }>;

  const typeDist = db.prepare(`
    SELECT investment_type as name, COUNT(*) as value
    FROM portfolio_investments
    WHERE investment_type IS NOT NULL ${yearFilter}
    GROUP BY investment_type
  `).all() as Array<{ name: string; value: number }>;

  // ── Recent news & activity ────────────────────────────────────────────────
  const lastRun = db.prepare(`
    SELECT run_at, news_collected, run_type FROM update_log ORDER BY run_at DESC LIMIT 1
  `).get() as { run_at: string; news_collected: number; run_type: string } | null;

  const recentNews = db.prepare(`
    SELECT company_name, one_line_summary, urgency_level, tags, published_at, source
    FROM news_items
    ORDER BY urgency_level DESC, collected_at DESC
    LIMIT 8
  `).all() as Array<{ company_name: string; one_line_summary?: string; urgency_level: number; tags: string; published_at?: string; source?: string }>;

  const recentActivity = db.prepare(`
    SELECT company_name, fields_updated, reason, source, updated_at
    FROM company_update_log
    ORDER BY updated_at DESC LIMIT 5
  `).all();

  return NextResponse.json({
    kpis: {
      totalCompanies,
      totalInvestments,
      totalSectors,
      totalRegions,
      aliveCount:    statusCounts.alive    ?? 0,
      ipoCount:      statusCounts.ipo      ?? 0,
      acquiredCount: statusCounts.acquired ?? 0,
      deadCount:     statusCounts.dead     ?? 0,
    },
    charts: { sectorDist, regionDist, vintageDist, roundDist, statusDist, typeDist },
    lastRun,
    recentNews,
    recentActivity,
    // Echo back the active date range so UI can confirm what was applied
    dateRange: { dateFrom, dateTo },
  });
}
