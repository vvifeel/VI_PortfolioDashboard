'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, Filter, ChevronLeft, ChevronRight,
  BarChart2, Building2, Calendar, TrendingUp
} from 'lucide-react';
import OverviewCharts from '@/components/charts/OverviewCharts';
import SignalRadar from '@/components/SignalRadar';
import { getStatusStyle, getUrgencyDot, parseTags, TAG_STYLES, formatM, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { ChartData } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Row {
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
  last_profile_update_at?: string;
  investment_count: number;
  founded_year?: number;
  hq_city?: string;
  current_employee_count?: number;
  total_funding_external_m?: number;
  latest_external_round?: string;
  description?: string;
  // Investment fields (latest investment)
  investment_type?: string;
  inv_year?: number;
  inv_month?: number;
  investment_amount_m?: number;
  stake_pct?: number;
  inv_round?: string;
  round_total_m?: number;
  valuation_at_investment_m?: number;
  current_valuation_m?: number;
  investment_terms?: string;
  portfolio_manager?: string;
}

interface ApiResponse {
  data: Row[];
  total: number;
  page: number;
  limit: number;
  sectors: string[];
  regions: string[];
  rounds: string[];
}

interface AnalyticsData {
  kpis: Record<string, number>;
  charts: ChartData;
  lastRun?: { run_at: string; news_collected: number };
  dateRange?: { dateFrom: string; dateTo: string };
}

const STATUS_OPTIONS = ['', 'Alive', 'IPO', 'Acquired', 'Dead'];
const TIER_OPTIONS = [
  { value: '', label: '전체' },
  { value: '1', label: 'T1' },
  { value: '2', label: 'T2' },
  { value: '3', label: 'T3' },
];
const TIER_COLOR: Record<number, string> = {
  1: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
  2: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  3: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-700',
};
const CUR_YEAR = new Date().getFullYear();
const PRESETS = [
  { label: '전체', dateFrom: '', dateTo: '' },
  { label: '5Y',  dateFrom: `${CUR_YEAR - 5}-01-01`, dateTo: '' },
  { label: '3Y',  dateFrom: `${CUR_YEAR - 3}-01-01`, dateTo: '' },
  { label: '1Y',  dateFrom: `${CUR_YEAR - 1}-01-01`, dateTo: '' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function relDays(iso?: string): string | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return '오늘';
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

function ValChip({ label, val, up }: { label: string; val?: number | null; up?: boolean }) {
  if (!val) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 dark:text-zinc-600">{label}</span>
      <span className={cn(
        'text-[11px] font-semibold',
        up === undefined ? 'text-slate-700 dark:text-zinc-200'
          : up ? 'text-emerald-500' : 'text-red-400'
      )}>
        {formatM(val)}
      </span>
    </div>
  );
}

// ── Company row ───────────────────────────────────────────────────────────────
function CompanyRow({ row, setSector, setRegion }: {
  row: Row;
  setSector: (s: string) => void;
  setRegion: (r: string) => void;
}) {
  const urgency = row.latest_urgency ?? 0;
  const tierNum = row.monitoring_tier ?? 2;
  const keywords = parseTags(row.signal_keywords ?? row.latest_news_tags ?? '[]');
  const signalText = row.signal_summary || row.latest_news_headline;
  const hasInvData = row.investment_amount_m || row.stake_pct || row.inv_round;
  const isUp = (row.current_valuation_m ?? 0) > (row.valuation_at_investment_m ?? 0);

  const borderAccent = urgency >= 5 ? 'border-l-red-500'
    : urgency >= 4 ? 'border-l-orange-400'
    : urgency >= 3 ? 'border-l-yellow-400'
    : 'border-l-transparent';

  return (
    <div className={cn(
      'border-b border-slate-100 dark:border-zinc-800/60',
      'hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors',
      'border-l-2 pl-3', borderAccent
    )}>
      <div className="flex gap-0 py-3 pr-4">

        {/* ── Left: Identity ──────────────────────────────── */}
        <div className="flex-[3] min-w-0 pr-4">
          {/* Name row */}
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-[10px] border shrink-0', TIER_COLOR[tierNum])}>T{tierNum}</Badge>
            <Link href={`/portfolio/${encodeURIComponent(row.company_name)}`}
              className="font-semibold text-sm text-slate-900 dark:text-zinc-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors truncate">
              {row.company_name}
            </Link>
            {row.status && (
              <Badge className={cn('text-[10px] shrink-0', getStatusStyle(row.status))}>
                {row.status.length > 10 ? row.status.slice(0, 10) + '…' : row.status}
              </Badge>
            )}
          </div>

          {/* Description */}
          {row.description && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 line-clamp-1 mb-1.5 leading-relaxed">
              {row.description}
            </p>
          )}

          {/* Meta tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {row.sector && (
              <button onClick={() => setSector(row.sector ?? '')}
                className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-500/20">
                {row.sector}
              </button>
            )}
            {row.region && (
              <button onClick={() => setRegion(row.region ?? '')}
                className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {row.region}{row.hq_city ? ` · ${row.hq_city}` : ''}
              </button>
            )}
            {row.founded_year && (
              <span className="text-[11px] text-slate-400 dark:text-zinc-600">{row.founded_year}년 설립</span>
            )}
            {row.investment_count > 1 && (
              <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">
                {row.investment_count}건 투자
              </span>
            )}
          </div>
        </div>

        {/* ── Middle: Investment data ──────────────────────── */}
        <div className="flex-[2] min-w-0 border-l border-slate-100 dark:border-zinc-800 px-4">
          {hasInvData ? (
            <>
              {/* Round header */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {row.inv_round && (
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                    {row.inv_round}
                  </span>
                )}
                {row.inv_year && (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-600">{row.inv_year}</span>
                )}
                {row.investment_type && (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-600">{row.investment_type}</span>
                )}
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {row.investment_amount_m && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-600">투자금</span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">{formatM(row.investment_amount_m)}</span>
                  </div>
                )}
                {row.stake_pct && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-600">지분</span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">{row.stake_pct.toFixed(1)}%</span>
                  </div>
                )}
                <ValChip label="당시" val={row.valuation_at_investment_m} />
                <ValChip
                  label="현재"
                  val={row.current_valuation_m}
                  up={row.current_valuation_m != null && row.valuation_at_investment_m != null
                    ? row.current_valuation_m > row.valuation_at_investment_m
                    : undefined}
                />
              </div>

              {/* Terms */}
              {row.investment_terms && (
                <div className="mt-1.5 text-[10px] text-slate-400 dark:text-zinc-600 truncate"
                  title={row.investment_terms}>
                  조건: {row.investment_terms}
                </div>
              )}
            </>
          ) : (
            <span className="text-[11px] text-slate-300 dark:text-zinc-700">투자 내역 없음</span>
          )}
        </div>

        {/* ── Right: Signal ────────────────────────────────── */}
        <div className="w-44 shrink-0 border-l border-slate-100 dark:border-zinc-800 pl-4">
          <div className="flex items-start gap-1.5">
            {urgency > 0 && (
              <span className="text-sm mt-0.5 shrink-0">{getUrgencyDot(urgency)}</span>
            )}
            <div className="flex-1 min-w-0">
              {signalText ? (
                <p className="text-[11px] text-slate-600 dark:text-zinc-300 line-clamp-3 leading-relaxed">
                  {signalText}
                </p>
              ) : (
                <span className="text-[11px] text-slate-300 dark:text-zinc-700">시그널 없음</span>
              )}

              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1.5">
                  {keywords.slice(0, 3).map(tag => (
                    <span key={tag} className={cn(
                      'text-[9px] px-1 py-0.5 rounded border font-medium',
                      TAG_STYLES[tag] ?? 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                    )}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {(row.signal_updated_at || row.last_news_collected_at) && (
                <div className="text-[9px] text-slate-300 dark:text-zinc-700 mt-1">
                  {relDays(row.signal_updated_at || row.last_news_collected_at)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analytics KPI ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, href }: {
  label: string; value: number; color: string; href?: string;
}) {
  const inner = (
    <div className={cn(
      'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 text-center shadow-sm transition-all',
      href && 'hover:border-sky-300 dark:hover:border-sky-500/40 hover:shadow-md cursor-pointer'
    )}>
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Main content ──────────────────────────────────────────────────────────────
function PortfolioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<'portfolio' | 'analytics'>(
    (searchParams.get('tab') as 'portfolio' | 'analytics') ?? 'portfolio'
  );

  // Portfolio filters
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState(searchParams.get('sector') ?? '');
  const [region, setRegion] = useState(searchParams.get('region') ?? '');
  const [round, setRound]   = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [tier, setTier]     = useState('');
  const [page, setPage]     = useState(1);

  // Analytics date range
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const activePreset = PRESETS.find(p => p.dateFrom === dateFrom && p.dateTo === dateTo)?.label ?? null;

  // Data
  const [portfolioData, setPortfolioData] = useState<ApiResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [listLoading, setListLoading]     = useState(true);
  const [chartLoading, setChartLoading]   = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '30' });
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    if (region) params.set('region', region);
    if (round)  params.set('round', round);
    if (status) params.set('status', status);
    if (tier)   params.set('tier', tier);
    const res = await fetch(`/api/portfolio?${params}`);
    setPortfolioData(await res.json());
    setListLoading(false);
  }, [search, sector, region, round, status, tier, page]);

  const fetchAnalytics = useCallback(async () => {
    setChartLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    const res = await fetch(`/api/overview${params.toString() ? `?${params}` : ''}`);
    setAnalyticsData(await res.json());
    setChartLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [search, sector, region, round, status, tier]);
  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);
  useEffect(() => {
    if (tab === 'analytics' && !analyticsData) fetchAnalytics();
  }, [tab, analyticsData, fetchAnalytics]);
  useEffect(() => {
    if (tab === 'analytics') fetchAnalytics();
  }, [dateFrom, dateTo]);

  const switchTab = (t: 'portfolio' | 'analytics') => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const totalPages = portfolioData ? Math.ceil(portfolioData.total / portfolioData.limit) : 1;
  const kpis = analyticsData?.kpis;

  return (
    <div className="flex min-h-screen">
      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Sticky header: tabs + filters */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
          {/* Tab row */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 dark:border-zinc-800/60">
            {[
              { id: 'portfolio', label: '포트폴리오', icon: Building2 },
              { id: 'analytics', label: '분석 · 통계',  icon: BarChart2  },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => switchTab(id as 'portfolio' | 'analytics')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2',
                  tab === id
                    ? 'text-sky-600 dark:text-sky-400 border-sky-500 bg-sky-50/50 dark:bg-sky-500/5'
                    : 'text-slate-500 dark:text-zinc-400 border-transparent hover:text-slate-700 dark:hover:text-zinc-200'
                )}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="px-4 py-2.5 flex flex-wrap gap-2 items-center">
            {tab === 'portfolio' && (
              <>
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="기업명 검색..."
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-sky-500/50" />
                </div>

                {([
                  { val: sector, set: setSector, opts: portfolioData?.sectors ?? [], ph: '섹터' },
                  { val: region, set: setRegion, opts: portfolioData?.regions ?? [], ph: '지역' },
                  { val: round,  set: setRound,  opts: portfolioData?.rounds ?? [],  ph: '라운드' },
                  { val: status, set: setStatus, opts: STATUS_OPTIONS,               ph: '상태' },
                ] as Array<{ val: string; set: (v: string) => void; opts: string[]; ph: string }>).map(({ val, set, opts, ph }) => (
                  <div key={ph} className="relative">
                    <Filter size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                    <select value={val} onChange={e => set(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-3 py-1.5 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer">
                      <option value="">{ph}</option>
                      {opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}

                {/* Tier pills */}
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 rounded-lg px-1 py-1">
                  {TIER_OPTIONS.map(({ value, label }) => (
                    <button key={value} onClick={() => setTier(value)}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
                        tier === value
                          ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                      )}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Count */}
                {portfolioData && (
                  <span className="ml-auto text-xs text-slate-400 dark:text-zinc-600 shrink-0">
                    {portfolioData.total}개 기업
                  </span>
                )}
              </>
            )}

            {tab === 'analytics' && (
              <>
                {/* Preset pills */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
                  {PRESETS.map(p => (
                    <button key={p.label}
                      onClick={() => { setDateFrom(p.dateFrom); setDateTo(p.dateTo); }}
                      className={cn('px-2.5 py-1 rounded-md text-sm font-medium transition-colors',
                        activePreset === p.label
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200')}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-1.5">
                  <Calendar size={11} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="text-sm text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-none w-28" />
                  <span className="text-slate-400 dark:text-zinc-600 text-xs">~</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="text-sm text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-none w-28" />
                </div>
                {analyticsData?.lastRun && (
                  <span className="ml-auto text-xs text-slate-400 dark:text-zinc-600 shrink-0">
                    마지막 업데이트: {new Date(analyticsData.lastRun.run_at).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Portfolio tab ───── */}
          {tab === 'portfolio' && (
            <div>
              {/* Column headers */}
              <div className="flex gap-0 px-4 py-2 bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-600 sticky top-0 z-[5]">
                <div className="flex-[3] pl-3 pr-4">기업명 · 섹터 · 지역</div>
                <div className="flex-[2] px-4 border-l border-slate-200 dark:border-zinc-800">투자 내역 (최신)</div>
                <div className="w-44 shrink-0 pl-4 border-l border-slate-200 dark:border-zinc-800">시그널</div>
              </div>

              {listLoading && (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-20 px-4 py-4 flex gap-4 animate-pulse">
                      <div className="flex-[3] space-y-2">
                        <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-2/3" />
                        <div className="h-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded w-full" />
                        <div className="h-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded w-1/2" />
                      </div>
                      <div className="flex-[2] space-y-2">
                        <div className="h-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded w-1/2" />
                      </div>
                      <div className="w-44 space-y-2">
                        <div className="h-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded w-full" />
                        <div className="h-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!listLoading && portfolioData?.data.map(row => (
                <CompanyRow
                  key={row.company_name}
                  row={row}
                  setSector={s => { setSector(sector === s ? '' : s); }}
                  setRegion={r => { setRegion(region === r ? '' : r); }}
                />
              ))}

              {!listLoading && portfolioData?.data.length === 0 && (
                <div className="text-center py-16 text-slate-400 dark:text-zinc-600">검색 결과가 없습니다</div>
              )}

              {/* Pagination */}
              {portfolioData && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-zinc-800 sticky bottom-0 bg-white dark:bg-zinc-950">
                  <span className="text-xs text-slate-500 dark:text-zinc-500">
                    {((page - 1) * portfolioData.limit) + 1}–{Math.min(page * portfolioData.limit, portfolioData.total)} / {portfolioData.total}건
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-slate-400 dark:text-zinc-400">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-slate-400 dark:text-zinc-400 px-2 py-1.5">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-slate-400 dark:text-zinc-400">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Analytics tab ───── */}
          {tab === 'analytics' && (
            <div className="p-5 space-y-5">
              {/* KPI row */}
              {kpis && !chartLoading && (
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
                  <KpiCard label="기업 수"     value={kpis.totalCompanies}   color="text-sky-600 dark:text-sky-400"      href="/portfolio" />
                  <KpiCard label="투자 건수"   value={kpis.totalInvestments} color="text-violet-600 dark:text-violet-400" href="/portfolio" />
                  <KpiCard label="섹터"        value={kpis.totalSectors}     color="text-amber-600 dark:text-amber-400" />
                  <KpiCard label="투자 국가"   value={kpis.totalRegions}     color="text-emerald-600 dark:text-emerald-400" />
                  <KpiCard label="Active"      value={kpis.aliveCount}       color="text-emerald-500"  href="/portfolio?status=Alive" />
                  <KpiCard label="IPO"         value={kpis.ipoCount}         color="text-sky-500"      href="/portfolio?status=IPO" />
                  <KpiCard label="Acquired"    value={kpis.acquiredCount}    color="text-violet-500"   href="/portfolio?status=Acquired" />
                  <KpiCard label="Dead"        value={kpis.deadCount}        color="text-red-500"      href="/portfolio?status=Dead" />
                </div>
              )}
              {chartLoading && (
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-zinc-800/40 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Charts */}
              {analyticsData?.charts && !chartLoading && (
                <OverviewCharts
                  charts={analyticsData.charts}
                  onSectorClick={s => { setSector(s); switchTab('portfolio'); }}
                  onRegionClick={r => { setRegion(r); switchTab('portfolio'); }}
                />
              )}
              {chartLoading && (
                <div className="h-48 flex items-center justify-center text-slate-400 dark:text-zinc-600">
                  <TrendingUp size={24} className="animate-pulse" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Signal Radar panel ──────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 sticky top-0 h-screen overflow-hidden border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
        <SignalRadar />
      </aside>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen">
        <div className="flex-1 p-6 text-slate-400 dark:text-zinc-500">로딩 중...</div>
        <aside className="w-72 border-l border-slate-200 dark:border-zinc-800" />
      </div>
    }>
      <PortfolioContent />
    </Suspense>
  );
}
