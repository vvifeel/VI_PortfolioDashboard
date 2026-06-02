'use client';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, SlidersHorizontal, ChevronRight, ChevronDown, ChevronUp,
  X, TrendingUp, TrendingDown, BarChart2,
} from 'lucide-react';
import OverviewCharts from '@/components/charts/OverviewCharts';
import SignalRadar from '@/components/SignalRadar';
import { getStatusStyle, getUrgencyDot, formatM, cn } from '@/lib/utils';
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
  description?: string;
  investment_type?: string;
  inv_year?: number;
  investment_amount_m?: number;
  stake_pct?: number;
  inv_round?: string;
  round_total_m?: number;
  valuation_at_investment_m?: number;
  current_valuation_m?: number;
  investment_terms?: string;
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

const STATUS_DOT: Record<string, string> = {
  'Alive': 'bg-emerald-400',
  'IPO': 'bg-sky-400',
  'Acquired': 'bg-violet-400',
  'Dead/Closed': 'bg-red-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function relDays(iso?: string): string | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return '오늘';
  if (d < 7) return `${d}일`;
  if (d < 30) return `${Math.floor(d / 7)}주`;
  return `${Math.floor(d / 30)}개월`;
}

function computeChartData(rows: Row[]): ChartData {
  function countBy(get: (r: Row) => string | undefined | null) {
    const c: Record<string, number> = {};
    for (const r of rows) { const v = get(r); if (v) c[v] = (c[v] ?? 0) + 1; }
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }
  const vm: Record<number, number> = {};
  for (const r of rows) if (r.inv_year) vm[r.inv_year] = (vm[r.inv_year] ?? 0) + 1;
  return {
    sectorDist:  countBy(r => r.sector),
    regionDist:  countBy(r => r.region),
    vintageDist: Object.entries(vm).map(([y, c]) => ({ year: Number(y), count: c })).sort((a, b) => a.year - b.year),
    roundDist:   countBy(r => r.inv_round),
    statusDist:  countBy(r => r.status),
    typeDist:    countBy(r => r.investment_type),
  };
}

// ── Range Slider ──────────────────────────────────────────────────────────────
function RangeSlider({ label, min, max, value, step = 1, format, onChange }: {
  label: string; min: number; max: number;
  value: [number, number]; step?: number;
  format?: (n: number) => string;
  onChange: (v: [number, number]) => void;
}) {
  if (max <= 0 || max <= min) return null;
  const fmt = format ?? String;
  const [lo, hi] = value;
  const pct1 = ((lo - min) / (max - min)) * 100;
  const pct2 = ((hi - min) / (max - min)) * 100;
  const isActive = lo > min || hi < max;

  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 148 }}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-medium whitespace-nowrap', isActive ? 'text-sky-500' : 'text-slate-500 dark:text-zinc-500')}>
          {label}
        </span>
        <span className={cn('text-[10px] tabular-nums whitespace-nowrap', isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-400 dark:text-zinc-600')}>
          {fmt(lo)}{lo === min && hi === max ? '' : ''} — {fmt(hi)}
        </span>
      </div>
      <div className="relative h-5 flex items-center select-none">
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-slate-200 dark:bg-zinc-700 pointer-events-none" />
        <div className="absolute h-[3px] rounded-full pointer-events-none"
          style={{
            left: `${pct1}%`, right: `${100 - pct2}%`,
            background: isActive ? '#38bdf8' : '#94a3b8',
          }} />
        <input type="range" min={min} max={max} step={step} value={lo}
          onChange={e => onChange([Math.min(Number(e.target.value), hi - step), hi])}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: lo > max - (max - min) * 0.1 ? 5 : 3 }} />
        <input type="range" min={min} max={max} step={step} value={hi}
          onChange={e => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 4 }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 shadow pointer-events-none transition-colors"
          style={{ left: `calc(${pct1}% - 6px)`, background: isActive ? '#38bdf8' : '#94a3b8', zIndex: 6 }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 shadow pointer-events-none transition-colors"
          style={{ left: `calc(${pct2}% - 6px)`, background: isActive ? '#38bdf8' : '#94a3b8', zIndex: 6 }} />
      </div>
    </div>
  );
}

// ── Active filter chip ─────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">
      {label}
      <button onClick={onRemove} className="hover:text-sky-900 dark:hover:text-sky-100 transition-colors">
        <X size={10} />
      </button>
    </span>
  );
}

// ── Compact company row ────────────────────────────────────────────────────────
function CompanyRow({ row, onSectorClick, onRegionClick }: {
  row: Row;
  onSectorClick: (s: string) => void;
  onRegionClick: (r: string) => void;
}) {
  const urgency = row.latest_urgency ?? 0;
  const isUp = (row.current_valuation_m ?? 0) > (row.valuation_at_investment_m ?? 0);
  const hasInv = !!(row.investment_amount_m || row.inv_round || row.stake_pct);
  const hasVal = !!(row.valuation_at_investment_m || row.current_valuation_m);
  const signal = row.signal_summary || row.latest_news_headline;
  const signalTime = relDays(row.signal_updated_at || row.last_news_collected_at);
  const dot = STATUS_DOT[row.status ?? ''] ?? 'bg-slate-300 dark:bg-zinc-600';

  const urgencyBorder =
    urgency >= 5 ? '#ef4444' :
    urgency >= 4 ? '#f97316' :
    urgency >= 3 ? '#eab308' : 'transparent';

  return (
    <div
      className="group border-b border-slate-100 dark:border-zinc-800/60 hover:bg-sky-50/30 dark:hover:bg-zinc-800/20 transition-colors border-l-[3px]"
      style={{ borderLeftColor: urgencyBorder }}
    >
      <Link href={`/portfolio/${encodeURIComponent(row.company_name)}`}
        className="flex flex-col px-4 py-2.5 gap-1">

        {/* Line 1 — Identity */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
          <span className="text-[13px] font-semibold text-slate-800 dark:text-zinc-100 truncate leading-tight">
            {row.company_name}
          </span>
          {row.sector && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onSectorClick(row.sector!); }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20 shrink-0 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors leading-none">
              {row.sector}
            </button>
          )}
          {row.region && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onRegionClick(row.region!); }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors leading-none">
              {row.region}
            </button>
          )}
          {row.status && row.status !== 'Alive' && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0 leading-none', getStatusStyle(row.status))}>
              {row.status}
            </span>
          )}
          {row.monitoring_tier && (
            <span className={cn('text-[9px] px-1 py-0.5 rounded border shrink-0 ml-0.5 leading-none', TIER_COLOR[row.monitoring_tier])}>
              T{row.monitoring_tier}
            </span>
          )}
          <ChevronRight size={12} className="ml-auto shrink-0 text-slate-200 dark:text-zinc-700 group-hover:text-sky-400 transition-colors" />
        </div>

        {/* Line 2 — Financials + Signal */}
        <div className="flex items-center gap-3 pl-3 flex-wrap">
          {/* Investment */}
          {hasInv && (
            <span className="flex items-center gap-1 text-[11px] shrink-0">
              {row.inv_round && (
                <span className="font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-1.5 rounded border border-slate-200 dark:border-zinc-700 text-[10px]">
                  {row.inv_round}
                </span>
              )}
              {row.inv_year && (
                <span className="text-slate-400 dark:text-zinc-600">'{String(row.inv_year).slice(-2)}</span>
              )}
              {row.investment_amount_m && (
                <span className="font-semibold text-slate-700 dark:text-zinc-300 ml-0.5">{formatM(row.investment_amount_m)}</span>
              )}
              {row.stake_pct && (
                <span className="text-slate-400 dark:text-zinc-600">· {row.stake_pct.toFixed(1)}%</span>
              )}
              {row.investment_type && (
                <span className="text-slate-300 dark:text-zinc-700">· {row.investment_type}</span>
              )}
            </span>
          )}

          {/* Valuation */}
          {hasVal && (
            <span className="flex items-center gap-1 text-[11px] shrink-0">
              {row.valuation_at_investment_m && (
                <span className="text-slate-400 dark:text-zinc-600">{formatM(row.valuation_at_investment_m)}</span>
              )}
              {row.current_valuation_m && (
                <>
                  <span className="text-slate-300 dark:text-zinc-700">→</span>
                  <span className={cn('font-medium', isUp ? 'text-emerald-500' : 'text-red-400')}>
                    {formatM(row.current_valuation_m)}
                  </span>
                  {isUp
                    ? <TrendingUp size={10} className="text-emerald-500" />
                    : <TrendingDown size={10} className="text-red-400" />
                  }
                </>
              )}
            </span>
          )}

          {/* Investment terms */}
          {row.investment_terms && (
            <span className="text-[10px] text-slate-300 dark:text-zinc-700 truncate max-w-[150px] shrink-0"
              title={row.investment_terms}>
              {row.investment_terms}
            </span>
          )}

          {/* Signal */}
          {signal && (
            <span className="flex items-center gap-1 min-w-0 flex-1">
              {urgency >= 3 && (
                <span className="text-xs shrink-0">{getUrgencyDot(urgency)}</span>
              )}
              <span className="text-[11px] text-slate-500 dark:text-zinc-500 truncate italic">
                {signal}
              </span>
              {signalTime && (
                <span className="text-[10px] text-slate-300 dark:text-zinc-700 shrink-0">{signalTime} 전</span>
              )}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

// ── KPI pill ──────────────────────────────────────────────────────────────────
function KpiPill({ label, value, accent, onClick }: {
  label: string; value: string | number; accent?: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center px-3 py-1.5 rounded-lg text-center transition-colors shrink-0',
        onClick ? 'hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer' : 'cursor-default'
      )}
    >
      <span className={cn('text-base font-bold tabular-nums leading-tight', accent ?? 'text-slate-700 dark:text-zinc-200')}>
        {value}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-zinc-600 whitespace-nowrap">{label}</span>
    </button>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function PortfolioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter state
  const [search, setSearch]   = useState('');
  const [sector, setSector]   = useState(searchParams.get('sector') ?? '');
  const [region, setRegion]   = useState(searchParams.get('region') ?? '');
  const [round, setRound]     = useState('');
  const [status, setStatus]   = useState(searchParams.get('status') ?? '');
  const [tier, setTier]       = useState('');

  // Range filters
  const [rangeMax, setRangeMax] = useState({ inv: 100, stake: 100, val: 1000 });
  const [invRange, setInvRange]     = useState<[number, number]>([0, 100]);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, 100]);
  const [valRange, setValRange]     = useState<[number, number]>([0, 1000]);

  // UI state
  const [showCharts, setShowCharts]       = useState(true);
  const [showRanges, setShowRanges]       = useState(false);
  const [allRows, setAllRows]             = useState<Row[]>([]);
  const [loading, setLoading]             = useState(true);
  const [dropOptions, setDropOptions]     = useState<{ sectors: string[]; regions: string[]; rounds: string[] }>({
    sectors: [], regions: [], rounds: [],
  });

  // Load all rows once
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/portfolio?limit=999&page=1');
    const json = await res.json();
    const rows: Row[] = json.data ?? [];
    setAllRows(rows);
    setDropOptions({ sectors: json.sectors ?? [], regions: json.regions ?? [], rounds: json.rounds ?? [] });

    // Initialize range maxes
    const maxInv   = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r: Row) => r.investment_amount_m ?? 0))));
    const maxStake = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r: Row) => r.stake_pct ?? 0))));
    const maxVal   = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r: Row) => r.current_valuation_m ?? 0))));
    setRangeMax({ inv: maxInv, stake: maxStake, val: maxVal });
    setInvRange([0, maxInv]);
    setStakeRange([0, maxStake]);
    setValRange([0, maxVal]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Active range detection
  const invActive   = invRange[0] > 0 || invRange[1] < rangeMax.inv;
  const stakeActive = stakeRange[0] > 0 || stakeRange[1] < rangeMax.stake;
  const valActive   = valRange[0] > 0 || valRange[1] < rangeMax.val;

  // Client-side filtering
  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        const fields = [r.company_name, r.description, r.sector, r.region, r.investment_terms, r.inv_round];
        if (!fields.some(f => f?.toLowerCase().includes(q))) return false;
      }
      if (sector && r.sector !== sector) return false;
      if (region && r.region !== region) return false;
      if (round  && r.inv_round !== round) return false;
      if (status && r.status !== status) return false;
      if (tier   && String(r.monitoring_tier ?? 2) !== tier) return false;
      if (invActive) {
        if (r.investment_amount_m == null) return false;
        if (r.investment_amount_m < invRange[0] || r.investment_amount_m > invRange[1]) return false;
      }
      if (stakeActive) {
        if (r.stake_pct == null) return false;
        if (r.stake_pct < stakeRange[0] || r.stake_pct > stakeRange[1]) return false;
      }
      if (valActive) {
        if (r.current_valuation_m == null) return false;
        if (r.current_valuation_m < valRange[0] || r.current_valuation_m > valRange[1]) return false;
      }
      return true;
    });
  }, [allRows, search, sector, region, round, status, tier, invRange, stakeRange, valRange, invActive, stakeActive, valActive]);

  // Chart data (computed from filtered rows; full data for cross-filter context)
  const chartData     = useMemo(() => computeChartData(filteredRows), [filteredRows]);
  const fullChartData = useMemo(() => computeChartData(allRows), [allRows]);

  // KPIs
  const kpis = useMemo(() => {
    const withInv   = filteredRows.filter(r => r.investment_amount_m);
    const withStake = filteredRows.filter(r => r.stake_pct);
    return {
      total:        filteredRows.length,
      alive:        filteredRows.filter(r => r.status === 'Alive').length,
      ipo:          filteredRows.filter(r => r.status === 'IPO').length,
      acquired:     filteredRows.filter(r => r.status === 'Acquired').length,
      sectors:      new Set(filteredRows.map(r => r.sector).filter(Boolean)).size,
      regions:      new Set(filteredRows.map(r => r.region).filter(Boolean)).size,
      totalInvested: withInv.reduce((s, r) => s + (r.investment_amount_m ?? 0), 0),
      avgStake:     withStake.length ? withStake.reduce((s, r) => s + (r.stake_pct ?? 0), 0) / withStake.length : 0,
    };
  }, [filteredRows]);

  // Chart click handlers (toggle filter)
  const handleSectorClick = (s: string) => setSector(prev => prev === s ? '' : s);
  const handleRegionClick = (r: string) => setRegion(prev => prev === r ? '' : r);
  const handleRoundClick  = (r: string) => setRound(prev => prev === r ? '' : r);
  const handleStatusClick = (s: string) => setStatus(prev => prev === s ? '' : s);

  const clearAll = () => {
    setSearch(''); setSector(''); setRegion(''); setRound(''); setStatus(''); setTier('');
    setInvRange([0, rangeMax.inv]);
    setStakeRange([0, rangeMax.stake]);
    setValRange([0, rangeMax.val]);
  };

  const hasActiveFilters = !!(search || sector || region || round || status || tier || invActive || stakeActive || valActive);

  const invFmt   = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}B` : `$${n}M`;
  const valFmt   = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}B` : `$${n}M`;
  const stakeFmt = (n: number) => `${n.toFixed(0)}%`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Main scrollable area ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* KPI strip */}
        <div className="flex items-center gap-1 px-4 py-1 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
          <KpiPill label="전체 기업" value={kpis.total} accent="text-sky-600 dark:text-sky-400"
            onClick={() => clearAll()} />
          <div className="w-px h-6 bg-slate-100 dark:bg-zinc-800 shrink-0" />
          <KpiPill label="Active" value={kpis.alive} accent="text-emerald-500"
            onClick={() => setStatus(s => s === 'Alive' ? '' : 'Alive')} />
          <KpiPill label="IPO" value={kpis.ipo} accent="text-sky-500"
            onClick={() => setStatus(s => s === 'IPO' ? '' : 'IPO')} />
          <KpiPill label="Acquired" value={kpis.acquired} accent="text-violet-500"
            onClick={() => setStatus(s => s === 'Acquired' ? '' : 'Acquired')} />
          <div className="w-px h-6 bg-slate-100 dark:bg-zinc-800 shrink-0" />
          <KpiPill label="섹터 수" value={kpis.sectors} />
          <KpiPill label="투자 국가" value={kpis.regions} />
          <div className="w-px h-6 bg-slate-100 dark:bg-zinc-800 shrink-0" />
          <KpiPill label="총 투자금" value={kpis.totalInvested > 0 ? invFmt(kpis.totalInvested) : '—'} accent="text-violet-600 dark:text-violet-400" />
          <KpiPill label="평균 지분" value={kpis.avgStake > 0 ? `${kpis.avgStake.toFixed(1)}%` : '—'} accent="text-amber-500" />

          {/* Charts toggle */}
          <button
            onClick={() => setShowCharts(v => !v)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <BarChart2 size={12} />
            {showCharts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Charts section (collapsible) */}
        {showCharts && (
          <div className="px-4 pt-3 pb-2">
            {loading ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-slate-100 dark:bg-zinc-800/40 animate-pulse" />
                ))}
              </div>
            ) : (
              <OverviewCharts
                charts={chartData}
                fullCharts={fullChartData}
                activeSector={sector || undefined}
                activeRegion={region || undefined}
                onSectorClick={handleSectorClick}
                onRegionClick={handleRegionClick}
                onRoundClick={handleRoundClick}
                onStatusClick={handleStatusClick}
              />
            )}
          </div>
        )}

        {/* Sticky filter bar */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800">
          {/* Row 1: search + filters */}
          <div className="flex flex-wrap gap-2 items-center px-4 py-2">
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="기업명, 섹터, 투자조건 검색..."
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-sky-500/60 w-52"
              />
            </div>

            {/* Sector */}
            <select value={sector} onChange={e => setSector(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-sky-500/60 appearance-none cursor-pointer max-w-[120px]">
              <option value="">섹터 전체</option>
              {dropOptions.sectors.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* Region */}
            <select value={region} onChange={e => setRegion(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-sky-500/60 appearance-none cursor-pointer max-w-[100px]">
              <option value="">지역 전체</option>
              {dropOptions.regions.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* Round */}
            <select value={round} onChange={e => setRound(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-sky-500/60 appearance-none cursor-pointer max-w-[100px]">
              <option value="">라운드</option>
              {dropOptions.rounds.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* Status */}
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-sky-500/60 appearance-none cursor-pointer max-w-[90px]">
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o || '상태'}</option>)}
            </select>

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

            {/* Range filter toggle */}
            <button
              onClick={() => setShowRanges(v => !v)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                (showRanges || invActive || stakeActive || valActive)
                  ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                  : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-sky-300'
              )}>
              <SlidersHorizontal size={11} />
              범위
              {(invActive || stakeActive || valActive) && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
              )}
            </button>

            {/* Active filter chips */}
            <div className="flex flex-wrap gap-1">
              {sector && <FilterChip label={`섹터: ${sector}`} onRemove={() => setSector('')} />}
              {region && <FilterChip label={`지역: ${region}`} onRemove={() => setRegion('')} />}
              {round  && <FilterChip label={`라운드: ${round}`} onRemove={() => setRound('')} />}
              {status && <FilterChip label={`상태: ${status}`} onRemove={() => setStatus('')} />}
              {invActive && <FilterChip label={`투자금: ${invFmt(invRange[0])}~${invFmt(invRange[1])}`} onRemove={() => setInvRange([0, rangeMax.inv])} />}
              {stakeActive && <FilterChip label={`지분: ${stakeFmt(stakeRange[0])}~${stakeFmt(stakeRange[1])}`} onRemove={() => setStakeRange([0, rangeMax.stake])} />}
              {valActive && <FilterChip label={`현재가치: ${valFmt(valRange[0])}~${valFmt(valRange[1])}`} onRemove={() => setValRange([0, rangeMax.val])} />}
            </div>

            {/* Result count + clear */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400 dark:text-zinc-600">
                {filteredRows.length}/{allRows.length}개
              </span>
              {hasActiveFilters && (
                <button onClick={clearAll}
                  className="text-xs text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-0.5">
                  <X size={11} />전체해제
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Range sliders (collapsible) */}
          {showRanges && (
            <div className="flex flex-wrap gap-6 px-4 pb-3 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
              <RangeSlider
                label="투자금액"
                min={0} max={rangeMax.inv}
                value={invRange}
                step={rangeMax.inv > 100 ? 10 : 1}
                format={invFmt}
                onChange={setInvRange}
              />
              <RangeSlider
                label="지분율"
                min={0} max={rangeMax.stake}
                value={stakeRange}
                step={rangeMax.stake > 50 ? 1 : 0.5}
                format={stakeFmt}
                onChange={setStakeRange}
              />
              <RangeSlider
                label="현재 기업가치"
                min={0} max={rangeMax.val}
                value={valRange}
                step={rangeMax.val > 1000 ? 50 : 10}
                format={valFmt}
                onChange={setValRange}
              />
            </div>
          )}
        </div>

        {/* Column headers */}
        <div className="flex items-center px-4 py-1.5 bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-600">
          <div className="flex-1">기업명 · 섹터 · 지역</div>
          <div className="w-44 shrink-0 text-right pr-4">투자 · 가치</div>
          <div className="w-52 shrink-0">시그널</div>
        </div>

        {/* Portfolio list */}
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex flex-col gap-1.5 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                  <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-40" />
                  <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded w-12" />
                  <div className="h-3 bg-slate-100 dark:bg-zinc-800 rounded w-10" />
                </div>
                <div className="flex gap-3 pl-3">
                  <div className="h-2.5 bg-slate-100 dark:bg-zinc-800 rounded w-24" />
                  <div className="h-2.5 bg-slate-100 dark:bg-zinc-800 rounded w-20" />
                  <div className="h-2.5 bg-slate-100 dark:bg-zinc-800 rounded w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-zinc-600 text-sm">
            조건에 맞는 기업이 없습니다
          </div>
        ) : (
          filteredRows.map(row => (
            <CompanyRow
              key={row.company_name}
              row={row}
              onSectorClick={handleSectorClick}
              onRegionClick={handleRegionClick}
            />
          ))
        )}
      </div>

      {/* ── Signal Radar ────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 sticky top-0 h-screen overflow-hidden border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
        <SignalRadar />
      </aside>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen">
        <div className="flex-1 p-6 text-slate-400 dark:text-zinc-500 text-sm">로딩 중...</div>
        <aside className="w-72 border-l border-slate-200 dark:border-zinc-800" />
      </div>
    }>
      <PortfolioContent />
    </Suspense>
  );
}
