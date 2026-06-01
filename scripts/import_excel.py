#!/usr/bin/env python3
"""
Import Excel data into the portfolio SQLite database.
Supports both:
  - Single-sheet format (current): "투자 포트폴리오 (전체)"
  - Two-sheet format (future):
      Sheet 1: 포트폴리오_투자현황  → portfolio_investments
      Sheet 2: 기업_프로필          → companies
"""
import sqlite3
import pandas as pd
import json
import os
import sys
import argparse
from datetime import datetime

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.db"))

# ── 컬럼 매핑: 현재 단일 시트 형식 ──────────────────────────────────────────
INVESTMENT_MAP = {
    "기업명":               "company_name",
    "투자유형":             "investment_type",
    "투자년도":             "investment_year",
    "투자월":               "investment_month",
    "투자금액($M)":         "investment_amount_m",
    "투자 Round":           "round",
    "Round 총액($M)":       "round_total_m",
    "당사 지분율(%)":        "stake_pct",
    "투자조건":             "investment_terms",
    "투자 당시 기업가치($M)": "valuation_at_investment_m",
    "현재 기업가치($M)":    "current_valuation_m",
    # 미래 2-시트 추가 필드
    "담당자":               "portfolio_manager",
    "이사회참여":           "board_member",
    "공동투자자":           "co_investors",
    "투자thesis":           "investment_thesis",
    "Exit목표연도":         "target_exit_year",
    "다음검토일":           "next_review_date",
    "메모":                 "notes",
}

COMPANY_MAP = {
    "기업명":            "company_name",
    "기업명_한글":        "company_name_ko",
    "분야":              "sector",
    "회사 개요":          "description",   # 단일시트 컬럼명
    "기업소개":          "description",   # 미래시트 컬럼명
    "서브섹터":          "sub_sector",
    "지역":              "region",
    "본사도시":          "hq_city",
    "설립년도":          "founded_year",
    "현재 상태":          "status",
    "웹사이트":          "website",
    "비즈니스모델":       "business_model",
    "주요제품서비스":     "key_products",
    "CEO":               "ceo_name",
    "CTO":               "cto_name",
    "CFO":               "cfo_name",
    "Co-Founder":        "cofounders",    # 단일시트
    "CoFounders":        "cofounders",   # 미래시트
    "투자당시직원수":     "employee_count_at_investment",
}


def clean_val(v):
    """NaN → None 처리"""
    if pd.isna(v) if not isinstance(v, (list, dict)) else False:
        return None
    return v


def import_single_sheet(df, conn):
    """단일 시트 형식 import"""
    df = df.rename(columns={c: INVESTMENT_MAP.get(c, COMPANY_MAP.get(c, c)) for c in df.columns})

    inv_cols = [v for v in INVESTMENT_MAP.values() if v in df.columns]
    com_cols = [v for v in COMPANY_MAP.values() if v in df.columns]

    # 중복 컬럼 제거
    inv_cols = list(dict.fromkeys(inv_cols))
    com_cols = list(dict.fromkeys(com_cols))

    inv_inserted = inv_updated = 0
    com_inserted = com_updated = 0
    errors = []

    c = conn.cursor()

    for _, row in df.iterrows():
        company = row.get("company_name")
        if not company or pd.isna(company):
            continue

        # portfolio_investments upsert
        inv_data = {col: clean_val(row.get(col)) for col in inv_cols}
        inv_data["company_name"] = company
        try:
            existing = c.execute(
                "SELECT id FROM portfolio_investments WHERE company_name=? AND investment_year=? AND round=?",
                (company, inv_data.get("investment_year"), inv_data.get("round"))
            ).fetchone()
            if existing:
                sets = ", ".join(f"{k}=?" for k in inv_data if k != "company_name")
                vals = [inv_data[k] for k in inv_data if k != "company_name"] + [existing[0]]
                c.execute(f"UPDATE portfolio_investments SET {sets} WHERE id=?", vals)
                inv_updated += 1
            else:
                keys = ", ".join(inv_data.keys())
                placeholders = ", ".join("?" * len(inv_data))
                c.execute(f"INSERT INTO portfolio_investments ({keys}) VALUES ({placeholders})", list(inv_data.values()))
                inv_inserted += 1
        except Exception as e:
            errors.append(f"Investment row {company}: {e}")

        # companies upsert (기업당 최초 1회)
        com_data = {col: clean_val(row.get(col)) for col in com_cols if col in df.columns}
        com_data["company_name"] = company
        try:
            existing_co = c.execute("SELECT company_name FROM companies WHERE company_name=?", (company,)).fetchone()
            if existing_co:
                sets = ", ".join(f"{k}=?" for k in com_data if k != "company_name")
                if sets:
                    vals = [com_data[k] for k in com_data if k != "company_name"] + [company]
                    c.execute(f"UPDATE companies SET {sets} WHERE company_name=?", vals)
                    com_updated += 1
            else:
                keys = ", ".join(com_data.keys())
                placeholders = ", ".join("?" * len(com_data))
                c.execute(f"INSERT INTO companies ({keys}) VALUES ({placeholders})", list(com_data.values()))
                com_inserted += 1
        except Exception as e:
            errors.append(f"Company row {company}: {e}")

    conn.commit()
    return {
        "investments": {"inserted": inv_inserted, "updated": inv_updated},
        "companies":   {"inserted": com_inserted, "updated": com_updated},
        "errors":      errors,
    }


def import_two_sheets(xl, conn):
    """미래 2-시트 형식 import"""
    results = {}

    if "포트폴리오_투자현황" in xl.sheet_names:
        df_inv = xl.parse("포트폴리오_투자현황")
        results["investments"] = import_single_sheet(df_inv, conn)

    if "기업_프로필" in xl.sheet_names:
        df_co = xl.parse("기업_프로필")
        df_co = df_co.rename(columns={c: COMPANY_MAP.get(c, c) for c in df_co.columns})
        com_cols = [v for v in COMPANY_MAP.values() if v in df_co.columns]
        c = conn.cursor()
        inserted = updated = 0
        errors = []
        for _, row in df_co.iterrows():
            company = row.get("company_name")
            if not company:
                continue
            com_data = {col: clean_val(row.get(col)) for col in com_cols}
            com_data["company_name"] = company
            try:
                existing = c.execute("SELECT company_name FROM companies WHERE company_name=?", (company,)).fetchone()
                if existing:
                    sets = ", ".join(f"{k}=?" for k in com_data if k != "company_name")
                    vals = [com_data[k] for k in com_data if k != "company_name"] + [company]
                    c.execute(f"UPDATE companies SET {sets} WHERE company_name=?", vals)
                    updated += 1
                else:
                    keys = ", ".join(com_data.keys())
                    placeholders = ", ".join("?" * len(com_data))
                    c.execute(f"INSERT INTO companies ({keys}) VALUES ({placeholders})", list(com_data.values()))
                    inserted += 1
            except Exception as e:
                errors.append(f"Company {company}: {e}")
        conn.commit()
        results["companies_profile"] = {"inserted": inserted, "updated": updated, "errors": errors}

    return results


def main():
    parser = argparse.ArgumentParser(description="Import Excel to portfolio DB")
    parser.add_argument("file", help="Path to .xlsx file")
    parser.add_argument("--db", default=DB_PATH, help="SQLite DB path")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"❌ File not found: {args.file}")
        sys.exit(1)

    conn = sqlite3.connect(args.db)
    xl = pd.ExcelFile(args.file)

    print(f"📋 Sheets found: {xl.sheet_names}")

    two_sheet_names = {"포트폴리오_투자현황", "기업_프로필"}
    if two_sheet_names & set(xl.sheet_names):
        results = import_two_sheets(xl, conn)
    else:
        # 첫 번째 시트를 단일 시트로 처리
        df = xl.parse(xl.sheet_names[0])
        results = import_single_sheet(df, conn)

    conn.close()
    print(f"\n✅ Import complete:")
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
