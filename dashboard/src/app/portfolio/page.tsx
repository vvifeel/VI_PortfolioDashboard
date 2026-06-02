'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { getStatusStyle, getUrgencyDot, parseTags, TAG_STYLES, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

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

const STATUS_OPTIONS = ['', 'Alive', 'IPO', 'Acquired', 'Dead'];
const TIER_OPTIONS = [
  { value: '', label: '티어 전체' },
  { value: '1', label: 'Tier 1' },
  { value: '2', label: 'Tier 2' },
  { value: '3', label: 'Tier 3' },
];

const TIER_STYLE: Record<number, string> = {
  1: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
  2: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  3: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-700',
};

function SignalCell({ row }: { row: Row }) {
  const urgency = row.latest_urgency ?? 0;
  const keywords = parseTags(row.signal_keywords ?? row.latest_news_tags ?? '[]');
  const summary = row.signal_summary || row.latest_news_headline;

  const updatedAt = row.signal_updated_at || row.last_news_collected_at;
  const relativeTime = updatedAt ? (() => {
    const diff = Date.now() - new Date(updatedAt).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return '오늘';
    if (d < 7) return `${d}일 전`;
    if (d < 30) return `${Math.floor(d / 7)}주 전`;
    return `${Math.floor(d / 30)}개월 전`;
  })() : null;

  if (!summary && keywords.length === 0) {
    return <span className="text-slate-300 dark:text-zinc-700 text-xs">시그널 없음</span>;
  }

  return (
    <div className="flex items-start gap-2 min-w-0">
      {urgency > 0 && (
        <span className="text-base mt-0.5 shrink-0">{getUrgencyDot(urgency)}</span>
      )}
      <div className="flex-1 min-w-0">
        {summary && (
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed line-clamp-2">{summary}</p>
        )}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {keywords.slice(0, 4).map(tag => (
            <span key={tag} className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
              TAG_STYLES[tag] ?? 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
            )}>
              {tag}
            </span>
          ))}
          {keywords.length > 4 && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-600">+{keywords.length - 4}</span>
          )}
          {relativeTime && (
            <span className="text-[10px] text-slate-300 dark:text-zinc-700 ml-auto">{relativeTime}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState(searchParams.get('sector') ?? '');
  const [region, setRegion] = useState(searchParams.get('region') ?? '');
  const [round, setRound] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '30' });
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    if (region) params.set('region', region);
    if (round)  params.set('round', round);
    if (status) params.set('status', status);
    if (tier)   params.set('tier', tier);
    const res = await fetch(`/api/portfolio?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [search, sector, region, round, status, tier, page]);

  useEffect(() => { setPage(1); }, [search, sector, region, round, status, tier]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">포트폴리오 기업</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">
            {data ? `총 ${data.total.toLocaleString()}개 기업` : '로딩 중...'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={13} className="text-amber-500" />
          <span className="text-xs text-slate-400 dark:text-zinc-600">시그널 업데이트순 정렬</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="기업명 검색..."
            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-sky-500/50" />
        </div>

        {([
          { val: sector, set: setSector, opts: data?.sectors ?? [], placeholder: '섹터' },
          { val: region, set: setRegion, opts: data?.regions ?? [], placeholder: '지역' },
          { val: round,  set: setRound,  opts: data?.rounds ?? [],  placeholder: '라운드' },
          { val: status, set: setStatus, opts: STATUS_OPTIONS,      placeholder: '상태' },
        ] as Array<{ val: string; set: (v: string) => void; opts: string[]; placeholder: string }>).map(({ val, set, opts, placeholder }) => (
          <div key={placeholder} className="relative">
            <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <select value={val} onChange={e => set(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer">
              <option value="">{placeholder} 전체</option>
              {opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}

        {/* Tier filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg px-1 py-1">
          {TIER_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => setTier(value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                tier === value
                  ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">기업명</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">섹터 · 지역</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">상태</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium w-2/5">시그널</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="text-center py-12 text-slate-400 dark:text-zinc-500">로딩 중...</td></tr>
            )}
            {!loading && data?.data.map(row => {
              const urgency = row.latest_urgency ?? 0;
              const borderColor = urgency >= 5 ? 'border-l-red-500'
                : urgency >= 4 ? 'border-l-orange-400'
                : urgency >= 3 ? 'border-l-yellow-400'
                : urgency >= 2 ? 'border-l-emerald-400'
                : 'border-l-transparent';
              const tierNum = row.monitoring_tier ?? 2;

              return (
                <tr key={row.company_name}
                  className={cn(
                    'border-b border-slate-100 dark:border-zinc-800/50',
                    'hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors',
                    'border-l-2', borderColor
                  )}>
                  {/* Company */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[10px] shrink-0 border', TIER_STYLE[tierNum])}>
                        T{tierNum}
                      </Badge>
                      <Link href={`/portfolio/${encodeURIComponent(row.company_name)}`}
                        className="font-medium text-slate-900 dark:text-zinc-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                        {row.company_name}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5 ml-8">
                      {[
                        row.investment_count > 0 && `${row.investment_count}건 투자`,
                        row.hq_city,
                        row.founded_year && `${row.founded_year}년 설립`,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </td>

                  {/* Sector + Region */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {row.sector ? (
                        <button onClick={() => setSector(sector === row.sector ? '' : (row.sector ?? ''))}
                          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline block text-left">
                          {row.sector}
                        </button>
                      ) : <span className="text-xs text-slate-300 dark:text-zinc-700">—</span>}
                      {row.region ? (
                        <button onClick={() => setRegion(region === row.region ? '' : (row.region ?? ''))}
                          className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 block text-left">
                          {row.region}
                        </button>
                      ) : null}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {row.status && (
                      <Badge className={getStatusStyle(row.status)}>
                        {row.status.length > 16 ? row.status.slice(0, 16) + '…' : row.status}
                      </Badge>
                    )}
                  </td>

                  {/* Signal */}
                  <td className="px-4 py-3">
                    <SignalCell row={row} />
                  </td>
                </tr>
              );
            })}
            {!loading && data?.data.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-slate-400 dark:text-zinc-500">검색 결과가 없습니다</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-xs text-slate-500 dark:text-zinc-500">
              {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} / {data.total}건
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
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400 dark:text-zinc-500">로딩 중...</div>}>
      <PortfolioContent />
    </Suspense>
  );
}
