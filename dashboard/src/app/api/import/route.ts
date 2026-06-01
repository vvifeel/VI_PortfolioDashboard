import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(process.cwd(), '..', 'data', 'portfolio.db');

const INVESTMENT_MAP: Record<string, string> = {
  '기업명': 'company_name',
  '투자유형': 'investment_type',
  '투자년도': 'investment_year',
  '투자월': 'investment_month',
  '투자금액($M)': 'investment_amount_m',
  '투자 Round': 'round',
  'Round 총액($M)': 'round_total_m',
  '당사 지분율(%)': 'stake_pct',
  '투자조건': 'investment_terms',
  '투자 당시 기업가치($M)': 'valuation_at_investment_m',
  '현재 기업가치($M)': 'current_valuation_m',
  '담당자': 'portfolio_manager',
  '이사회참여': 'board_member',
  '공동투자자': 'co_investors',
  '투자thesis': 'investment_thesis',
  'Exit목표연도': 'target_exit_year',
  '다음검토일': 'next_review_date',
  '메모': 'notes',
};

const COMPANY_MAP: Record<string, string> = {
  '기업명': 'company_name',
  '기업명_한글': 'company_name_ko',
  '분야': 'sector',
  '회사 개요': 'description',
  '기업소개': 'description',
  '서브섹터': 'sub_sector',
  '지역': 'region',
  '본사도시': 'hq_city',
  '설립년도': 'founded_year',
  '현재 상태': 'status',
  '웹사이트': 'website',
  '비즈니스모델': 'business_model',
  '주요제품서비스': 'key_products',
  'CEO': 'ceo_name',
  'CTO': 'cto_name',
  'CFO': 'cfo_name',
  'Co-Founder': 'cofounders',
  'CoFounders': 'cofounders',
  '투자당시직원수': 'employee_count_at_investment',
};

function cleanVal(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

function processSheet(rows: Record<string, unknown>[], db: Database.Database) {
  let invInserted = 0, invUpdated = 0, coInserted = 0, coUpdated = 0;
  const errors: string[] = [];

  const invStmt = db.prepare(`
    INSERT INTO portfolio_investments (company_name, investment_type, investment_year, investment_month,
      investment_amount_m, round, round_total_m, stake_pct, investment_terms,
      valuation_at_investment_m, current_valuation_m, portfolio_manager, board_member,
      co_investors, investment_thesis, target_exit_year, next_review_date, notes)
    VALUES (@company_name, @investment_type, @investment_year, @investment_month,
      @investment_amount_m, @round, @round_total_m, @stake_pct, @investment_terms,
      @valuation_at_investment_m, @current_valuation_m, @portfolio_manager, @board_member,
      @co_investors, @investment_thesis, @target_exit_year, @next_review_date, @notes)
    ON CONFLICT(company_name, investment_year, investment_month, round)
    DO UPDATE SET
      investment_amount_m=excluded.investment_amount_m,
      round_total_m=excluded.round_total_m,
      stake_pct=excluded.stake_pct,
      current_valuation_m=excluded.current_valuation_m
  `);

  const coStmt = db.prepare(`
    INSERT INTO companies (company_name, sector, description, region, status,
      ceo_name, cto_name, cfo_name, cofounders, company_name_ko, sub_sector,
      hq_city, founded_year, website, business_model, key_products, employee_count_at_investment)
    VALUES (@company_name, @sector, @description, @region, @status,
      @ceo_name, @cto_name, @cfo_name, @cofounders, @company_name_ko, @sub_sector,
      @hq_city, @founded_year, @website, @business_model, @key_products, @employee_count_at_investment)
    ON CONFLICT(company_name) DO UPDATE SET
      sector=COALESCE(excluded.sector, sector),
      description=COALESCE(excluded.description, description),
      region=COALESCE(excluded.region, region),
      status=COALESCE(excluded.status, status),
      ceo_name=COALESCE(excluded.ceo_name, ceo_name),
      cto_name=COALESCE(excluded.cto_name, cto_name),
      cfo_name=COALESCE(excluded.cfo_name, cfo_name),
      cofounders=COALESCE(excluded.cofounders, cofounders)
  `);

  const doImport = db.transaction((rows: Record<string, unknown>[]) => {
    for (const rawRow of rows) {
      // Map columns
      const row: Record<string, unknown> = {};
      for (const [orig, mapped] of Object.entries({ ...INVESTMENT_MAP, ...COMPANY_MAP })) {
        if (orig in rawRow) row[mapped] = cleanVal(rawRow[orig]);
      }

      const company = row['company_name'] as string;
      if (!company) continue;

      try {
        const invData = {
          company_name: company,
          investment_type: row['investment_type'] ?? null,
          investment_year: row['investment_year'] ?? null,
          investment_month: row['investment_month'] ?? null,
          investment_amount_m: row['investment_amount_m'] ?? null,
          round: row['round'] ?? null,
          round_total_m: row['round_total_m'] ?? null,
          stake_pct: row['stake_pct'] ?? null,
          investment_terms: row['investment_terms'] ?? null,
          valuation_at_investment_m: row['valuation_at_investment_m'] ?? null,
          current_valuation_m: row['current_valuation_m'] ?? null,
          portfolio_manager: row['portfolio_manager'] ?? null,
          board_member: row['board_member'] ?? null,
          co_investors: row['co_investors'] ?? null,
          investment_thesis: row['investment_thesis'] ?? null,
          target_exit_year: row['target_exit_year'] ?? null,
          next_review_date: row['next_review_date'] ?? null,
          notes: row['notes'] ?? null,
        };
        const existing = db.prepare(
          'SELECT id FROM portfolio_investments WHERE company_name=? AND investment_year=? AND round=?'
        ).get(company, invData.investment_year, invData.round);
        invStmt.run(invData);
        existing ? invUpdated++ : invInserted++;
      } catch (e) {
        errors.push(`Investment ${company}: ${e}`);
      }

      try {
        const coData = {
          company_name: company,
          sector: row['sector'] ?? null,
          description: row['description'] ?? null,
          region: row['region'] ?? null,
          status: row['status'] ?? null,
          ceo_name: row['ceo_name'] ?? null,
          cto_name: row['cto_name'] ?? null,
          cfo_name: row['cfo_name'] ?? null,
          cofounders: row['cofounders'] ?? null,
          company_name_ko: row['company_name_ko'] ?? null,
          sub_sector: row['sub_sector'] ?? null,
          hq_city: row['hq_city'] ?? null,
          founded_year: row['founded_year'] ?? null,
          website: row['website'] ?? null,
          business_model: row['business_model'] ?? null,
          key_products: row['key_products'] ?? null,
          employee_count_at_investment: row['employee_count_at_investment'] ?? null,
        };
        const existingCo = db.prepare('SELECT company_name FROM companies WHERE company_name=?').get(company);
        coStmt.run(coData);
        existingCo ? coUpdated++ : coInserted++;
      } catch (e) {
        errors.push(`Company ${company}: ${e}`);
      }
    }
  });

  doImport(rows);
  return { invInserted, invUpdated, coInserted, coUpdated, errors };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `import_${Date.now()}.xlsx`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    const workbook = XLSX.readFile(tmpPath);
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    let results: Record<string, unknown> = {};

    if (workbook.SheetNames.length === 1) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<string, unknown>[];
      results = processSheet(rows, db);
    } else {
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, unknown>[];
        results[sheetName] = processSheet(rows, db);
      }
    }

    db.close();
    return NextResponse.json({ ok: true, results });
  } finally {
    fs.unlinkSync(tmpPath);
  }
}
