export interface Company {
  company_name: string;
  company_name_ko?: string;
  sector?: string;
  sub_sector?: string;
  region?: string;
  hq_city?: string;
  founded_year?: number;
  status?: string;
  website?: string;
  description?: string;
  business_model?: string;
  key_products?: string;
  ceo_name?: string;
  cto_name?: string;
  cfo_name?: string;
  cofounders?: string;
  employee_count_at_investment?: number;
  // Agent-collected
  current_employee_count?: number;
  total_funding_external_m?: number;
  latest_external_round?: string;
  latest_external_valuation_m?: number;
  revenue_range?: string;
  competitors?: string;   // JSON string
  all_investors?: string; // JSON string
  technologies?: string;  // JSON string
  linkedin_url?: string;
  twitter_url?: string;
  logo_url?: string;
  latest_news_headline?: string;
  latest_urgency?: number;
  acquisition_info?: string; // JSON string
  ipo_info?: string;          // JSON string
  last_enriched_at?: string;
}

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
  tags: string; // JSON string
  raw_content?: string;
  is_read: number;
}

export interface MonitoringSource {
  id: number;
  name: string;
  type: string;
  config: string; // JSON string
  active: number;
  frequency: string;
  cost_type: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioListItem {
  company_name: string;
  sector?: string;
  region?: string;
  status?: string;
  latest_urgency?: number;
  latest_news_headline?: string;
  latest_news_tags?: string;
  investment_count: number;
}

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
  sectorDist: Array<{ name: string; value: number }>;
  regionDist: Array<{ name: string; value: number }>;
  vintageDist: Array<{ year: number; count: number }>;
  roundDist: Array<{ name: string; value: number }>;
  statusDist: Array<{ name: string; value: number }>;
  typeDist: Array<{ name: string; value: number }>;
}
