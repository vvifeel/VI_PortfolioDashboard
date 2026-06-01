'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStatusStyle, getUrgencyDot, parseTags, TAG_STYLES, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface Row {
  company_name: string;
  sector?: string;
  region?: string;
  status?: string;
  round?: string;
  investment_year?: number;
  latest_urgency?: number;
  latest_news_headline?: string;
  latest_news_tags?: string;
  investment_count: number;
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

function PortfolioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState(searchParams.get('sector') ?? '');
  const [region, setRegion] = useState(searchParams.get('region') ?? '');
  const [round, setRound] = useState('');
  const [status, setStatus] = useState('');
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
    const res = await fetch(`/api/portfolio?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [search, sector, region, round, status, page]);

  useEffect(() => { setPage(1); }, [search, sector, region, round, status]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">포트폴리오 기업</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">
          {data ? `총 ${data.total.toLocaleString()}개 기업` : '로딩 중...'}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
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
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">기업명</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">섹터</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">지역</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium">상태</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 dark:text-zinc-500 font-medium w-1/3">최신 뉴스</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400 dark:text-zinc-500">로딩 중...</td></tr>
            )}
            {!loading && data?.data.map(row => {
              const tags = parseTags(row.latest_news_tags ?? '[]');
              const urgency = row.latest_urgency ?? 0;
              const borderColor = urgency >= 5 ? 'border-l-red-500'
                : urgency >= 4 ? 'border-l-orange-400'
                : urgency >= 3 ? 'border-l-yellow-400'
                : urgency >= 2 ? 'border-l-emerald-400'
                : 'border-l-transparent';
              return (
                <tr key={row.company_name}
                  className={cn(
                    'border-b border-slate-100 dark:border-zinc-800/50',
                    'hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors',
                    'border-l-2', borderColor
                  )}>
                  <td className="px-4 py-3">
                    <Link href={`/portfolio/${encodeURIComponent(row.company_name)}`}
                      className="font-medium text-slate-900 dark:text-zinc-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                      {row.company_name}
                    </Link>
                    <div className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5">{row.investment_count}건 투자{row.investment_year ? ` · ${row.investment_year}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.sector ? (
                      <button onClick={() => setSector(sector === row.sector ? '' : (row.sector ?? ''))}
                        className="text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-left">
                        {row.sector}
                      </button>
                    ) : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {row.region ? (
                      <button onClick={() => setRegion(region === row.region ? '' : (row.region ?? ''))}
                        className="text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-left">
                        {row.region}
                      </button>
                    ) : <span className="text-slate-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {row.status && (
                      <Badge className={getStatusStyle(row.status)}>
                        {row.status.length > 18 ? row.status.slice(0, 18) + '…' : row.status}
                      </Badge>
                    )}
                    {row.round && (
                      <div className="text-xs text-slate-400 dark:text-zinc-600 mt-1">{row.round}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {urgency > 0 && (
                        <span className="text-sm mt-0.5 shrink-0">{getUrgencyDot(urgency)}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        {row.latest_news_headline
                          ? <span className="text-slate-600 dark:text-zinc-300 text-xs leading-relaxed line-clamp-2">{row.latest_news_headline}</span>
                          : <span className="text-slate-300 dark:text-zinc-600 text-xs">수집된 뉴스 없음</span>
                        }
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.slice(0, 3).map(tag => (
                              <span key={tag} className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-default', TAG_STYLES[tag] ?? 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700')}>
                                {tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-600 px-1">+{tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && data?.data.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400 dark:text-zinc-500">검색 결과가 없습니다</td></tr>
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
