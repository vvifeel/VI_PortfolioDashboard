// ── Core company profile (companies table) ──────────────────────────────────
export interface Company {
  company_name: string;
  company_name_ko?: string;
  legal_name?: string;

  // Classification
  sector?: string;
  sub_sector?: string;
  primary_industry?: string;
  business_stage?: string;   // Early / Growth / Late / Mature

  // Location
  region?: string;
  hq_country?: string;       // ISO-2: US, KR, IL
  hq_city?: string;
  hq_state?: string;

  // Identity
  founded_year?: number;
  status?: string;           // Alive / IPO / Acquired / Dead
  website?: string;
  crunchbase_url?: string;
  description?: string;

  // Business
  business_model?: string;
  revenue_model?: string;    // SaaS / Transaction / Services / Marketplace
  key_products?: string;

  // People
  ceo_name?: string;
  ceo_linkedin?: string;
  cto_name?: string;
  cfo_name?: string;
  cofounders?: string;       // JSON: [{name, title}]
  key_executives?: string;   // JSON: [{name, title, linkedin}]
  board_members?: string;    // JSON: [{name, organization}]

  // Headcount
  employee_count_at_investment?: number;
  current_employee_count?: number;
  employee_count_history?: string;  // JSON: [{date, count}]
  employee_growth_pct?: number;

  // Financials (external / agent-collected)
  total_funding_external_m?: number;
  latest_external_round?: string;
  latest_external_valuation_m?: number;
  post_money_valuation_m?: number;
  last_funding_date?: string;
  last_funding_amount_m?: number;
  funding_rounds?: string;          // JSON: [{date,type,amount_m,lead_investors,post_money_m}]
  revenue_range?: string;           // e.g. "$10M–$50M"
  arr_estimate?: string;
  profitability_status?: string;    // Pre-revenue / Revenue / Profitable / Cash-flow+
  burn_rate_estimate?: string;

  // Market
  market_size_estimate?: string;
  market_position?: string;         // Leader / Challenger / Niche
  competitors?: string;             // JSON array
  all_investors?: string;           // JSON array
  technologies?: string;            // JSON array
  patents_count?: number;

  // Social / Media
  linkedin_url?: string;
  twitter_url?: string;
  logo_url?: string;

  // Exit events
  ipo_date?: string;
  ipo_exchange?: string;
  ipo_ticker?: string;
  ipo_price?: number;
  acquired_by?: string;
  acquired_date?: string;
  acquired_price_m?: number;
  acquisition_info?: string;        // legacy JSON blob
  ipo_info?: string;                // legacy JSON blob

  // Intelligence signals
  latest_news_headline?: string;
  latest_urgency?: number;          // 1–5
  signal_summary?: string;          // AI one-liner for portfolio list
  signal_keywords?: string;         // JSON: ["funding","leadership_change"]
  signal_updated_at?: string;

  // Enrichment tracking
  last_enriched_at?: string;
  last_profile_update_at?: string;
  update_reason?: string;
  monitoring_tier?: number;         // 1/2/3
  priority_score?: number;
}

// ── Internal investment record (PRIVATE — never send externally) ────────────
export interface Investment {
  id: number;
  company_name: string;
  investment_type?: string;
  investment_year?: number;
  investment_month?: number;
  investment_amount_m?: number;
  round?: string;
  round_total_m?: number;
  stake_pct?: number;
  investment_terms?: string;
  valuation_at_investment_m?: number;
  current_valuation_m?: number;
  portfolio_manager?: string;
  board_member?: string;
  co_investors?: string;
  investment_thesis?: string;
  target_exit_year?: number;
  next_review_date?: string;
  notes?: string;
}

// ── News item ────────────────────────────────────────────────────────────────
export interface NewsItem {
  id: number;
  company_name: string;
  title?: string;
  one_line_summary?: string;
  source?: string;
  source_url?: string;
  published_at?: string;
  collected_at?: string;
  urgency_level: number;
  tags: string;            // JSON string
  raw_content?: string;
  is_read: number;
}

// ── Monitoring source ────────────────────────────────────────────────────────
export interface MonitoringSource {
  id: number;
  name: string;
  type: string;
  config: string;          // JSON string
  active: number;
  frequency: string;
  cost_type: string;
  description?: string;
  phase?: number;
  coming_soon?: number;
  created_at?: string;
  updated_at?: string;
}

// ── Portfolio list row ───────────────────────────────────────────────────────
export interface PortfolioListItem {
  company_name: string;
  sector?: string;
  region?: string;
  status?: string;
  monitoring_tier?: number;
  latest_urgency?: number;
  latest_news_headline?: string;
  latest_news_tags?: string;
  signal_summary?: string;
  signal_keywords?: string;
  signal_updated_at?: string;
  last_news_collected_at?: string;
  investment_count: number;
}

// ── Overview / Analytics ─────────────────────────────────────────────────────
export interface OverviewStats {
  totalCompanies: number;
  totalInvestments: number;
  totalSectors: number;
  totalRegions: number;
  aliveCount: number;
  ipoCount: number;
  acquiredCount: number;
  deadCount: number;
}

export interface ChartData {
  sectorDist:  Array<{ name: string; value: number }>;
  regionDist:  Array<{ name: string; value: number }>;
  vintageDist: Array<{ year: number; count: number }>;
  roundDist:   Array<{ name: string; value: number }>;
  statusDist:  Array<{ name: string; value: number }>;
  typeDist:    Array<{ name: string; value: number }>;
}
