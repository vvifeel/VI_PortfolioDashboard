import { getDb } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company: companySlug } = await params;
  const companyName = decodeURIComponent(companySlug);
  const db = getDb();

  const company = db.prepare('SELECT * FROM companies WHERE company_name = ?').get(companyName);
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const investments = db.prepare(`
    SELECT * FROM portfolio_investments WHERE company_name = ?
    ORDER BY investment_year DESC, investment_month DESC
  `).all(companyName);

  const news = db.prepare(`
    SELECT * FROM news_items WHERE company_name = ?
    ORDER BY urgency_level DESC, collected_at DESC
    LIMIT 50
  `).all(companyName);

  // News by other companies in same sector (related intelligence)
  const companyData = company as { sector?: string };
  const relatedNews = companyData.sector
    ? db.prepare(`
        SELECT n.*, n.company_name as related_company
        FROM news_items n
        JOIN companies c ON c.company_name = n.company_name
        WHERE c.sector = ? AND n.company_name != ?
        ORDER BY n.urgency_level DESC, n.collected_at DESC
        LIMIT 5
      `).all(companyData.sector, companyName)
    : [];

  return NextResponse.json({ company, investments, news, relatedNews });
}
