'use client';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search, SlidersHorizontal, ChevronRight,
  ChevronDown, ChevronUp, X, TrendingUp, TrendingDown, BarChart2, MapPin,
} from 'lucide-react';
import OverviewCharts from '@/components/charts/OverviewCharts';
import SignalRadar from '@/components/SignalRadar';
import { getStatusStyle, getUrgencyDot, formatM, cn } from '@/lib/utils';
import type { ChartData } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Investment {
  id?: number;
  round?: string;
  investment_year?: number;
  investment_month?: number;
  investment_type?: string;
  investment_amount_m?: number;
  stake_pct?: number;
  valuation_at_investment_m?: number;
  current_valuation_m?: number;
  investment_terms?: string;
  round_total_m?: number;
}

interface Row {
  company_name: string;
  sector?: string;
  region?: string;
  status?: string;
  monitoring_tier?: number;
  latest_urgency?: number;
  latest_news_headline?: string;
  signal_summary?: string;
  signal_keywords?: string;
  signal_updated_at?: string;
  last_news_collected_at?: string;
  investment_count: number;
  founded_year?: number;
  hq_city?: string;
  description?: string;
  investments: Investment[];
  total_investment_m?: number;
  // Latest investment fields (for filtering)
  investment_type?: string;
  inv_year?: number;
  investment_amount_m?: number;
  stake_pct?: number;
  inv_round?: string;
  current_valuation_m?: number;
  valuation_at_investment_m?: number;
}

const STATUS_OPTS = ['', 'Alive', 'IPO', 'Acquired', 'Dead'];
const TIER_OPTS = [
  { value: '', label: '전체' }, { value: '1', label: 'T1' },
  { value: '2', label: 'T2' }, { value: '3', label: 'T3' },
];
const TIER_CLS: Record<number, string> = {
  1: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30',
  2: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  3: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-700',
};
const STATUS_DOT_COLOR: Record<string, string> = {
  Alive: '#34d399', IPO: '#38bdf8', Acquired: '#a78bfa', 'Dead/Closed': '#f87171',
};
const STATUS_BADGE: Record<string, string> = {
  Alive: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20',
  IPO:   'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20',
  Acquired: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20',
};

function relDays(iso?: string) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return '오늘';
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

// ── Filtering helper (defined outside component for stable reference) ──────────
function filterRows(rows: Row[], opts: {
  search: string;
  sector: string;
  region: string;
  round: string;
  status: string;
  tier: string;
  invType: string;
  invYear: number;
  invRange: [number, number];
  stakeRange: [number, number];
  valRange: [number, number];
  rangeMax: { inv: number; stake: number; val: number };
  skipSector?: boolean;
  skipRegion?: boolean;
  skipRound?: boolean;
  skipStatus?: boolean;
  skipInvType?: boolean;
  skipInvYear?: boolean;
}): Row[] {
  const {
    search, sector, region, round, status, tier, invType, invYear,
    invRange, stakeRange, valRange, rangeMax,
    skipSector, skipRegion, skipRound, skipStatus, skipInvType, skipInvYear,
  } = opts;
  const invActive   = invRange[0]   > 0 || invRange[1]   < rangeMax.inv;
  const stakeActive = stakeRange[0] > 0 || stakeRange[1] < rangeMax.stake;
  const valActive   = valRange[0]   > 0 || valRange[1]   < rangeMax.val;

  return rows.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      const terms = r.investments?.map(i => i.investment_terms).filter(Boolean).join(' ') ?? '';
      if (![r.company_name, r.description, r.sector, r.region,
            terms, r.inv_round].some(f => f?.toLowerCase().includes(q))) return false;
    }
    if (!skipSector  && sector  && r.sector !== sector) return false;
    if (!skipRegion  && region  && r.region !== region) return false;
    if (!skipRound   && round   && r.inv_round !== round) return false;
    if (!skipStatus  && status  && r.status !== status) return false;
    if (tier && String(r.monitoring_tier ?? 2) !== tier) return false;
    if (!skipInvType && invType && r.investment_type !== invType) return false;
    if (!skipInvYear && invYear && r.inv_year !== invYear) return false;
    if (invActive)   { if (!r.investment_amount_m || r.investment_amount_m < invRange[0] || r.investment_amount_m > invRange[1]) return false; }
    if (stakeActive) { if (!r.stake_pct           || r.stake_pct < stakeRange[0]           || r.stake_pct > stakeRange[1]) return false; }
    if (valActive)   { if (!r.current_valuation_m || r.current_valuation_m < valRange[0]   || r.current_valuation_m > valRange[1]) return false; }
    return true;
  });
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
  const active = lo > min || hi < max;
  const accent = active ? '#38bdf8' : '#94a3b8';

  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 152 }}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-medium', active ? 'text-sky-500' : 'text-slate-500 dark:text-zinc-500')}>
          {label}
        </span>
        <span className={cn('text-[10px] tabular-nums', active ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-400 dark:text-zinc-600')}>
          {fmt(lo)} — {fmt(hi)}
        </span>
      </div>
      <div className="relative h-5 flex items-center select-none">
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-slate-200 dark:bg-zinc-700 pointer-events-none" />
        <div className="absolute h-[3px] rounded-full pointer-events-none"
          style={{ left: `${pct1}%`, right: `${100 - pct2}%`, background: accent }} />
        <input type="range" min={min} max={max} step={step} value={lo}
          onChange={e => onChange([Math.min(Number(e.target.value), hi - step), hi])}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: lo > max - (max - min) * 0.08 ? 5 : 3 }} />
        <input type="range" min={min} max={max} step={step} value={hi}
          onChange={e => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer" style={{ zIndex: 4 }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 shadow pointer-events-none"
          style={{ left: `calc(${pct1}% - 6px)`, background: accent, zIndex: 6 }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 shadow pointer-events-none"
          style={{ left: `calc(${pct2}% - 6px)`, background: accent, zIndex: 6 }} />
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">
      {label}
      <button onClick={onRemove} className="hover:text-sky-900 dark:hover:text-sky-100 transition-colors"><X size={9} /></button>
    </span>
  );
}

function KpiPill({ label, value, accent, onClick }: {
  label: string; value: string | number; accent?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        'flex flex-col items-center px-3 py-1.5 rounded-lg text-center transition-colors shrink-0',
        onClick ? 'hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer' : 'cursor-default',
      )}>
      <span className={cn('text-base font-bold tabular-nums leading-tight', accent ?? 'text-slate-700 dark:text-zinc-200')}>
        {value}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-zinc-600 whitespace-nowrap">{label}</span>
    </button>
  );
}

// ── Company row (card style, multi-investment) ─────────────────────────────────
function CompanyRow({ row, onSectorClick, onRegionClick }: {
  row: Row;
  onSectorClick: (s: string) => void;
  onRegionClick: (r: string) => void;
}) {
  const investments = row.investments ?? [];
  const latestInv   = investments.length > 0 ? investments[investments.length - 1] : null;
  const earliestInv = investments.length > 0 ? investments[0] : null;
  const totalInvM   = row.total_investment_m ?? investments.reduce((s, inv) => s + (inv.investment_amount_m ?? 0), 0);
  const currentVal  = latestInv?.current_valuation_m ?? row.current_valuation_m;
  const latestValAtInv = latestInv?.valuation_at_investment_m ?? row.valuation_at_investment_m;
  const urgency = row.latest_urgency ?? 0;
  const signal  = row.signal_summary || row.latest_news_headline;
  const signalTime = relDays(row.signal_updated_at || row.last_news_collected_at);
  const dotColor = STATUS_DOT_COLOR[row.status ?? ''] ?? '#94a3b8';
  const isUp = (currentVal ?? 0) > (latestValAtInv ?? 0);
  const urgencyBorder =
    urgency >= 5 ? '#ef4444' : urgency >= 4 ? '#f97316' : urgency >= 3 ? '#eab308' : 'transparent';

  return (
    <Link href={`/portfolio/${encodeURIComponent(row.company_name)}`}
      className="block border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-sky-50/30 dark:hover:bg-sky-900/10 transition-colors group border-l-[3px]"
      style={{ borderLeftColor: urgencyBorder }}>

      {/* ── Header: name + meta ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 pt-3 pb-1">
        <div className="flex-1 min-w-0">

          {/* Row 1: tier ● + name + status badge + sector + region + founded */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tier + status dot merged */}
            <div className="flex items-center gap-1 shrink-0">
              {row.monitoring_tier ? (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none flex items-center gap-1', TIER_CLS[row.monitoring_tier])}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                  T{row.monitoring_tier}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
              )}
            </div>

            <span className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-tight">
              {row.company_name}
            </span>

            {/* Status badge */}
            {row.status && (
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded leading-none shrink-0 font-medium',
                STATUS_BADGE[row.status] ?? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
              )}>
                {row.status}
              </span>
            )}

            {/* Sector — square pill */}
            {row.sector && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onSectorClick(row.sector!); }}
                className="text-[10px] px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors leading-none shrink-0 font-medium">
                {row.sector}
              </button>
            )}

            {/* Region — with pin icon */}
            {row.region && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onRegionClick(row.region!); }}
                className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors leading-none shrink-0">
                <MapPin size={9} className="shrink-0" />
                {row.region}{row.hq_city ? ` · ${row.hq_city}` : ''}
              </button>
            )}

            {row.founded_year && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-600 shrink-0">est. {row.founded_year}</span>
            )}

            <ChevronRight size={13} className="ml-auto shrink-0 text-slate-200 dark:text-zinc-700 group-hover:text-sky-400 transition-colors" />
          </div>

          {/* Description — 2 lines max, no truncation */}
          {row.description && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1.5 leading-relaxed line-clamp-2 pl-0.5">
              {row.description}
            </p>
          )}
        </div>

        {/* Right summary: total invested + current val */}
        {(totalInvM > 0 || currentVal) && (
          <div className="shrink-0 text-right space-y-0.5 pt-0.5">
            {totalInvM > 0 && (
              <div>
                <div className="text-[9px] text-slate-400 dark:text-zinc-600 leading-none mb-0.5">총 투자</div>
                <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 tabular-nums">{formatM(totalInvM)}</div>
              </div>
            )}
            {currentVal && (
              <div>
                <div className="text-[9px] text-slate-400 dark:text-zinc-600 leading-none mb-0.5">현재 가치</div>
                <div className={cn('text-xs font-bold tabular-nums flex items-center gap-0.5 justify-end', isUp ? 'text-emerald-500' : 'text-rose-400')}>
                  {formatM(currentVal)}
                  {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Investment rows ──────────────────────────────────────────────────── */}
      {investments.length > 0 && (
        <div className="mx-4 mb-2 mt-1 border border-slate-100 dark:border-zinc-800 rounded-lg overflow-hidden text-xs">
          {investments.map((inv, i) => (
            <div key={inv.id ?? i} className={cn(
              'flex items-center gap-0 bg-slate-50/60 dark:bg-zinc-900/40',
              i > 0 && 'border-t border-slate-100 dark:border-zinc-800'
            )}>
              {/* Round + Year + Type */}
              <div className="w-40 shrink-0 px-3 py-1.5">
                <span className="font-semibold text-slate-700 dark:text-zinc-200">{inv.round ?? '—'}</span>
                {inv.investment_year && <span className="text-slate-400 dark:text-zinc-600 ml-1.5 text-[10px]">{inv.investment_year}</span>}
                {inv.investment_type && (
                  <span className="ml-1.5 text-[10px] text-slate-400 dark:text-zinc-600 bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded leading-none">
                    {inv.investment_type}
                  </span>
                )}
              </div>

              {/* Amount */}
              <div className="w-28 shrink-0 px-3 py-1.5 border-l border-slate-100 dark:border-zinc-800">
                <div className="text-[9px] text-slate-400 dark:text-zinc-600 leading-none mb-0.5">투자금</div>
                <div className="font-semibold text-slate-700 dark:text-zinc-200 tabular-nums">
                  {inv.investment_amount_m ? formatM(inv.investment_amount_m) : <span className="text-slate-300 dark:text-zinc-700">—</span>}
                </div>
              </div>

              {/* Stake */}
              <div className="w-20 shrink-0 px-3 py-1.5 border-l border-slate-100 dark:border-zinc-800">
                <div className="text-[9px] text-slate-400 dark:text-zinc-600 leading-none mb-0.5">지분율</div>
                <div className="font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                  {inv.stake_pct ? `${inv.stake_pct.toFixed(1)}%` : <span className="text-slate-300 dark:text-zinc-700 font-normal">—</span>}
                </div>
              </div>

              {/* Valuation at investment */}
              <div className="w-28 shrink-0 px-3 py-1.5 border-l border-slate-100 dark:border-zinc-800">
                <div className="text-[9px] text-slate-400 dark:text-zinc-600 leading-none mb-0.5">당시 가치</div>
                <div className="text-slate-600 dark:text-zinc-300 tabular-nums">
                  {inv.valuation_at_investment_m ? formatM(inv.valuation_at_investment_m) : <span className="text-slate-300 dark:text-zinc-700">—</span>}
                </div>
              </div>

              {/* Investment terms */}
              <div className="flex-1 min-w-0 px-3 py-1.5 border-l border-slate-100 dark:border-zinc-800">
                {inv.investment_terms ? (
                  <>
                    <div className="text-[9px] text-slate-400 dark:text-zinc-600 leading-none mb-0.5">조건</div>
                    <div className="text-slate-500 dark:text-zinc-400 truncate" title={inv.investment_terms}>{inv.investment_terms}</div>
                  </>
                ) : null}
              </div>
            </div>
          ))}

          {/* Cumulative summary row (only for 2+ investments) */}
          {investments.length > 1 && (
            <div className="flex items-center gap-4 px-3 py-1.5 bg-slate-100/80 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-700 text-xs">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">누적 합계</span>
              <span className="font-bold text-slate-700 dark:text-zinc-200 tabular-nums">{formatM(totalInvM)}</span>
              {currentVal && (
                <>
                  <span className="text-slate-200 dark:text-zinc-700">·</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-600">현재 기업가치</span>
                  <span className={cn('font-bold tabular-nums flex items-center gap-0.5', isUp ? 'text-emerald-500' : 'text-rose-400')}>
                    {formatM(currentVal)}
                    {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  </span>
                  {latestValAtInv && currentVal && (
                    <span className={cn('text-[10px]', isUp ? 'text-emerald-400' : 'text-rose-400')}>
                      ({((currentVal / latestValAtInv - 1) * 100).toFixed(0)}% vs 당시)
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Signal footer ────────────────────────────────────────────────────── */}
      {signal && (
        <div className="flex items-center gap-1.5 px-4 pb-2.5">
          {urgency >= 3 && <span className="text-sm shrink-0 leading-none">{getUrgencyDot(urgency)}</span>}
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex-1 min-w-0 truncate">{signal}</p>
          {signalTime && <span className="text-[10px] text-slate-300 dark:text-zinc-700 shrink-0">{signalTime}</span>}
        </div>
      )}
    </Link>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function PortfolioContent() {
  const searchParams = useSearchParams();

  const [search, setSearch]     = useState('');
  const [sector, setSector]     = useState(searchParams.get('sector') ?? '');
  const [region, setRegion]     = useState(searchParams.get('region') ?? '');
  const [round, setRound]       = useState('');
  const [status, setStatus]     = useState(searchParams.get('status') ?? '');
  const [tier, setTier]         = useState('');
  const [invType, setInvType]   = useState('');
  const [invYear, setInvYear]   = useState(0);

  const [rangeMax, setRangeMax]     = useState({ inv: 100, stake: 100, val: 1000 });
  const [invRange, setInvRange]     = useState<[number, number]>([0, 100]);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, 100]);
  const [valRange, setValRange]     = useState<[number, number]>([0, 1000]);

  const [showCharts, setShowCharts] = useState(true);
  const [showRanges, setShowRanges] = useState(false);
  const [allRows, setAllRows]       = useState<Row[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dropOpts, setDropOpts]     = useState<{ sectors: string[]; regions: string[]; rounds: string[] }>({
    sectors: [], regions: [], rounds: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/portfolio?limit=999&page=1');
    const json = await res.json();
    const rows: Row[] = json.data ?? [];
    setAllRows(rows);
    setDropOpts({ sectors: json.sectors ?? [], regions: json.regions ?? [], rounds: json.rounds ?? [] });
    const maxInv   = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r: Row) => r.investment_amount_m ?? 0))));
    const maxStake = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r: Row) => r.stake_pct ?? 0))));
    const maxVal   = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r: Row) => r.current_valuation_m ?? 0))));
    setRangeMax({ inv: maxInv, stake: maxStake, val: maxVal });
    setInvRange([0, maxInv]); setStakeRange([0, maxStake]); setValRange([0, maxVal]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invActive   = invRange[0] > 0 || invRange[1] < rangeMax.inv;
  const stakeActive = stakeRange[0] > 0 || stakeRange[1] < rangeMax.stake;
  const valActive   = valRange[0] > 0 || valRange[1] < rangeMax.val;

  const filterOpts = { search, sector, region, round, status, tier, invType, invYear, invRange, stakeRange, valRange, rangeMax };

  const filteredRows = useMemo(() => filterRows(allRows, filterOpts),
    [allRows, search, sector, region, round, status, tier, invType, invYear, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-filter: each dimension's chart shows data with that dimension's filter EXCLUDED
  // so clicking a bar keeps the bar chart context intact while other charts update
  const rowsForSector  = useMemo(() => filterRows(allRows, { ...filterOpts, skipSector:  true }), [allRows, search, region, round, status, tier, invType, invYear, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsForRegion  = useMemo(() => filterRows(allRows, { ...filterOpts, skipRegion:  true }), [allRows, search, sector, round, status, tier, invType, invYear, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsForRound   = useMemo(() => filterRows(allRows, { ...filterOpts, skipRound:   true }), [allRows, search, sector, region, status, tier, invType, invYear, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsForStatus  = useMemo(() => filterRows(allRows, { ...filterOpts, skipStatus:  true }), [allRows, search, sector, region, round, tier, invType, invYear, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsForInvType = useMemo(() => filterRows(allRows, { ...filterOpts, skipInvType: true }), [allRows, search, sector, region, round, status, tier, invYear, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsForInvYear = useMemo(() => filterRows(allRows, { ...filterOpts, skipInvYear: true }), [allRows, search, sector, region, round, status, tier, invType, invRange, stakeRange, valRange, rangeMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = useMemo(() => computeChartData(filteredRows), [filteredRows]);

  const crossFilter = useMemo(() => ({
    sectorDist:  computeChartData(rowsForSector).sectorDist,
    regionDist:  computeChartData(rowsForRegion).regionDist,
    roundDist:   computeChartData(rowsForRound).roundDist,
    statusDist:  computeChartData(rowsForStatus).statusDist,
    typeDist:    computeChartData(rowsForInvType).typeDist,
    vintageDist: computeChartData(rowsForInvYear).vintageDist,
  }), [rowsForSector, rowsForRegion, rowsForRound, rowsForStatus, rowsForInvType, rowsForInvYear]);

  const kpis = useMemo(() => {
    const withInv   = filteredRows.filter(r => r.investment_amount_m);
    const withStake = filteredRows.filter(r => r.stake_pct);
    return {
      total:         filteredRows.length,
      alive:         filteredRows.filter(r => r.status === 'Alive').length,
      ipo:           filteredRows.filter(r => r.status === 'IPO').length,
      acquired:      filteredRows.filter(r => r.status === 'Acquired').length,
      sectors:       new Set(filteredRows.map(r => r.sector).filter(Boolean)).size,
      regions:       new Set(filteredRows.map(r => r.region).filter(Boolean)).size,
      totalInvested: withInv.reduce((s, r) => s + (r.investment_amount_m ?? 0), 0),
      avgStake:      withStake.length ? withStake.reduce((s, r) => s + (r.stake_pct ?? 0), 0) / withStake.length : 0,
    };
  }, [filteredRows]);

  const clearAll = () => {
    setSearch(''); setSector(''); setRegion(''); setRound(''); setStatus('');
    setTier(''); setInvType(''); setInvYear(0);
    setInvRange([0, rangeMax.inv]); setStakeRange([0, rangeMax.stake]); setValRange([0, rangeMax.val]);
  };

  const hasFilters = !!(search || sector || region || round || status || tier || invType || invYear || invActive || stakeActive || valActive);

  const invFmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}B` : `$${n}M`;
  const valFmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}B` : `$${n}M`;
  const stFmt  = (n: number) => `${n.toFixed(0)}%`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Main column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* KPI strip */}
        <div className="shrink-0 flex items-center gap-1 px-4 py-1 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
          <KpiPill label="전체 기업" value={kpis.total} accent="text-sky-600 dark:text-sky-400" onClick={clearAll} />
          <div className="w-px h-6 bg-slate-100 dark:bg-zinc-800 shrink-0" />
          <KpiPill label="Active" value={kpis.alive} accent="text-emerald-500"
            onClick={() => setStatus(s => s === 'Alive' ? '' : 'Alive')} />
          <KpiPill label="IPO" value={kpis.ipo} accent="text-sky-500"
            onClick={() => setStatus(s => s === 'IPO' ? '' : 'IPO')} />
          <KpiPill label="Acquired" value={kpis.acquired} accent="text-violet-500"
            onClick={() => setStatus(s => s === 'Acquired' ? '' : 'Acquired')} />
          <div className="w-px h-6 bg-slate-100 dark:bg-zinc-800 shrink-0" />
          <KpiPill label="섹터" value={kpis.sectors} />
          <KpiPill label="국가" value={kpis.regions} />
          <div className="w-px h-6 bg-slate-100 dark:bg-zinc-800 shrink-0" />
          <KpiPill label="총 투자금" value={kpis.totalInvested > 0 ? invFmt(kpis.totalInvested) : '—'} accent="text-violet-600 dark:text-violet-400" />
          <KpiPill label="평균 지분" value={kpis.avgStake > 0 ? `${kpis.avgStake.toFixed(1)}%` : '—'} accent="text-amber-500" />
          <button onClick={() => setShowCharts(v => !v)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
            <BarChart2 size={12} />
            {showCharts ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>

        {/* Charts — natural height, no section scroll */}
        {showCharts && (
          <div className="shrink-0 px-4 pt-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            {loading ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-slate-100 dark:bg-zinc-800/40 animate-pulse" />
                ))}
              </div>
            ) : (
              <OverviewCharts
                charts={chartData}
                crossFilter={crossFilter}
                activeSector={sector || undefined}
                activeRegion={region || undefined}
                activeRound={round || undefined}
                activeStatus={status || undefined}
                activeType={invType || undefined}
                activeYear={invYear || undefined}
                onSectorClick={s => setSector(p => p === s ? '' : s)}
                onRegionClick={r => setRegion(p => p === r ? '' : r)}
                onRoundClick={r => setRound(p => p === r ? '' : r)}
                onStatusClick={s => setStatus(p => p === s ? '' : s)}
                onTypeClick={t => setInvType(p => p === t ? '' : t)}
                onYearClick={y => setInvYear(p => p === y ? 0 : y)}
                onClearAll={clearAll}
              />
            )}
          </div>
        )}

        {/* Filter bar */}
        <div className="shrink-0 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2 items-center px-4 py-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="기업명, 섹터, 투자조건 검색..."
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-sky-500/60 w-52" />
            </div>

            {([
              { val: sector, set: setSector, opts: dropOpts.sectors, ph: '섹터', w: 'max-w-[120px]' },
              { val: region, set: setRegion, opts: dropOpts.regions, ph: '지역', w: 'max-w-[100px]' },
              { val: round,  set: setRound,  opts: dropOpts.rounds,  ph: '라운드', w: 'max-w-[100px]' },
              { val: status, set: setStatus, opts: STATUS_OPTS,       ph: '상태', w: 'max-w-[90px]' },
            ] as Array<{ val: string; set: (v: string) => void; opts: string[]; ph: string; w: string }>).map(({ val, set, opts, ph, w }) => (
              <select key={ph} value={val} onChange={e => set(e.target.value)}
                className={cn('bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 focus:outline-none focus:border-sky-500/60 appearance-none cursor-pointer', w)}>
                <option value="">{ph}</option>
                {opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}

            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 rounded-lg px-1 py-1">
              {TIER_OPTS.map(({ value, label }) => (
                <button key={value} onClick={() => setTier(value)}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
                    tier === value ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                  )}>
                  {label}
                </button>
              ))}
            </div>

            <button onClick={() => setShowRanges(v => !v)}
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

            <div className="flex flex-wrap gap-1">
              {sector  && <Chip label={`섹터: ${sector}`}  onRemove={() => setSector('')} />}
              {region  && <Chip label={`지역: ${region}`}  onRemove={() => setRegion('')} />}
              {round   && <Chip label={`라운드: ${round}`} onRemove={() => setRound('')} />}
              {status  && <Chip label={`상태: ${status}`}  onRemove={() => setStatus('')} />}
              {invType && <Chip label={`유형: ${invType}`} onRemove={() => setInvType('')} />}
              {invYear > 0 && <Chip label={`${invYear}년`} onRemove={() => setInvYear(0)} />}
              {invActive   && <Chip label={`투자금: ${invFmt(invRange[0])}~${invFmt(invRange[1])}`} onRemove={() => setInvRange([0, rangeMax.inv])} />}
              {stakeActive && <Chip label={`지분: ${stFmt(stakeRange[0])}~${stFmt(stakeRange[1])}`} onRemove={() => setStakeRange([0, rangeMax.stake])} />}
              {valActive   && <Chip label={`가치: ${valFmt(valRange[0])}~${valFmt(valRange[1])}`} onRemove={() => setValRange([0, rangeMax.val])} />}
            </div>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400 dark:text-zinc-600">
                {filteredRows.length}{allRows.length !== filteredRows.length ? `/${allRows.length}` : ''}개
              </span>
              {hasFilters && (
                <button onClick={clearAll}
                  className="text-xs text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-0.5">
                  <X size={11} />전체해제
                </button>
              )}
            </div>
          </div>

          {showRanges && (
            <div className="flex flex-wrap gap-6 px-4 pb-3 pt-1 border-t border-slate-100 dark:border-zinc-800/60">
              <RangeSlider label="투자금액" min={0} max={rangeMax.inv}
                value={invRange} step={rangeMax.inv > 100 ? 10 : 1} format={invFmt} onChange={setInvRange} />
              <RangeSlider label="지분율" min={0} max={rangeMax.stake}
                value={stakeRange} step={rangeMax.stake > 50 ? 1 : 0.5} format={stFmt} onChange={setStakeRange} />
              <RangeSlider label="현재 기업가치" min={0} max={rangeMax.val}
                value={valRange} step={rangeMax.val > 1000 ? 50 : 10} format={valFmt} onChange={setValRange} />
            </div>
          )}
        </div>

        {/* Portfolio list — own scroll */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 space-y-2 animate-pulse">
                <div className="flex gap-2">
                  <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-40" />
                  <div className="h-4 bg-slate-100 dark:bg-zinc-800/60 rounded w-16" />
                  <div className="h-4 bg-slate-100 dark:bg-zinc-800/60 rounded w-20" />
                </div>
                <div className="h-3 bg-slate-100 dark:bg-zinc-800/40 rounded w-2/3" />
                <div className="h-10 bg-slate-50 dark:bg-zinc-900/40 rounded-lg" />
              </div>
            ))
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-zinc-600 text-sm">
              조건에 맞는 기업이 없습니다
            </div>
          ) : (
            filteredRows.map(row => (
              <CompanyRow key={row.company_name} row={row}
                onSectorClick={s => setSector(p => p === s ? '' : s)}
                onRegionClick={r => setRegion(p => p === r ? '' : r)} />
            ))
          )}
        </div>
      </div>

      {/* ── Signal Radar ────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 h-screen overflow-hidden border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
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
