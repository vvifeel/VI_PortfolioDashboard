'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Building2, Globe, LayoutGrid, TrendingUp, CheckCircle2, Zap, XCircle, RefreshCw } from 'lucide-react';
import OverviewCharts from '@/components/charts/OverviewCharts';
import type { ChartData } from '@/lib/types';
import { getUrgencyDot, getUrgencyStyle, getUrgencyLabel, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface NewsItem {
  company_name: string;
  one_line_summary?: string;
  urgency_level: number;
  tags: string;
  published_at?: string;
  source?: string;
}

const YEAR_FILTERS = [
  { label: 'All', value: '' },
  { label: '5Y', value: String(new Date().getFullYear() - 5) },
  { label: '3Y', value: String(new Date().getFullYear() - 3) },
  { label: '1Y', value: String(new Date().getFullYear() - 1) },
];

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-3xl font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{value.toLocaleString()}</div>
        <div className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<{ kpis: Record<string, number>; charts: ChartData; recentNews: NewsItem[]; lastRun?: { run_at: string; news_collected: number } } | null>(null);
  const [yearFrom, setYearFrom] = useState('');
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = yearFrom ? `?yearFrom=${yearFrom}` : '';
      const res = await fetch(`/api/overview${params}`);
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [yearFrom]);

  useEffect(() => { fetch_(); }, [fetch_]);

  useEffect(() => {
    fetch('/api/activity?limit=8&days=7').then(r => r.json()).then(setActivityData).catch(() => {});
  }, []);

  const kpis = data?.kpis;
  const charts = data?.charts;
  const news = data?.recentNews ?? [];

  const handleSectorClick = (sector: string) => router.push(`/portfolio?sector=${encodeURIComponent(sector)}`);
  const handleRegionClick = (region: string) => router.push(`/portfolio?region=${encodeURIComponent(region)}`);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">포트폴리오 대시보드</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">
            {data?.lastRun
              ? `마지막 업데이트: ${new Date(data.lastRun.run_at).toLocaleString('ko-KR')}`
              : '뉴스 수집 대기 중'}
          </p>
        </div>
        {/* Year Range Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
          {YEAR_FILTERS.map(f => (
            <button key={f.label} onClick={() => setYearFrom(f.value)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                yearFrom === f.value
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      {kpis && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="포트폴리오 기업"   value={kpis.totalCompanies}   icon={Building2}   color="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" />
          <KpiCard label="총 투자 건수"       value={kpis.totalInvestments} icon={TrendingUp}   color="bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400" />
          <KpiCard label="커버 섹터"          value={kpis.totalSectors}     icon={LayoutGrid}   color="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" />
          <KpiCard label="투자 국가"          value={kpis.totalRegions}     icon={Globe}        color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <KpiCard label="Active" value={kpis.aliveCount}    icon={CheckCircle2} color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" sub="현재 운영중" />
          <KpiCard label="IPO"    value={kpis.ipoCount}      icon={Zap}          color="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" sub="상장 완료" />
          <KpiCard label="Acquired" value={kpis.acquiredCount} icon={Activity}   color="bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400" sub="인수 완료" />
          <KpiCard label="Dead / Closed" value={kpis.deadCount} icon={XCircle}  color="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400" sub="종료" />
        </div>
      )}

      {/* Main split: Charts + News */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Charts — 2/3 */}
        <div className="xl:col-span-2">
          {charts && !loading && (
            <OverviewCharts
              charts={charts}
              onSectorClick={handleSectorClick}
              onRegionClick={handleRegionClick}
            />
          )}
          {loading && (
            <div className="h-64 flex items-center justify-center text-slate-400 dark:text-zinc-600">로딩 중...</div>
          )}
        </div>

        {/* News Panel — 1/3 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
              실시간 인텔리전스
            </h2>
            <a href="/news" className="text-xs text-sky-600 dark:text-sky-400 hover:underline">전체보기</a>
          </div>
          <div className="space-y-2">
            {news.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                <div className="text-slate-400 dark:text-zinc-600 text-sm">수집된 뉴스가 없습니다</div>
                <div className="text-slate-300 dark:text-zinc-700 text-xs mt-1">Agent 실행 후 업데이트됩니다</div>
              </div>
            ) : news.map((item, i) => (
              <a key={i} href={`/portfolio/${encodeURIComponent(item.company_name)}`}
                className="block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 hover:border-sky-300 dark:hover:border-sky-500/40 hover:shadow-sm transition-all">
                <div className="flex items-start gap-2.5">
                  <span className="text-base mt-0.5 shrink-0">{getUrgencyDot(item.urgency_level)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{item.company_name}</span>
                      <Badge className={cn('text-[10px]', getUrgencyStyle(item.urgency_level))}>
                        {getUrgencyLabel(item.urgency_level)}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.one_line_summary}
                    </p>
                    {item.published_at && (
                      <div className="text-[10px] text-slate-400 dark:text-zinc-600 mt-1">
                        {new Date(item.published_at).toLocaleDateString('ko-KR')} · {item.source}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      {activityData && activityData.updates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <RefreshCw size={13} className="text-slate-400 dark:text-zinc-500" />
              기업 프로파일 업데이트 활동
            </h2>
            {activityData.todayPlan && (
              <span className="text-xs text-slate-400 dark:text-zinc-600">
                오늘 {activityData.todayPlan.budget_used ?? 0}/{activityData.todayPlan.budget_total}콜 사용
              </span>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            {activityData.updates.slice(0, 8).map((item: any, i: number) => {
              const fields: string[] = JSON.parse(item.fields_updated ?? '[]');
              const after: Record<string, unknown> = JSON.parse(item.after_values ?? '{}');
              return (
                <div key={i} className={cn(
                  'px-4 py-3 flex items-start gap-3',
                  i > 0 && 'border-t border-slate-100 dark:border-zinc-800'
                )}>
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/portfolio/${encodeURIComponent(item.company_name)}`}
                        className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline">
                        {item.company_name}
                      </a>
                      {fields.map((f: string) => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500">
                          {f}
                        </span>
                      ))}
                      <span className="text-xs text-slate-400 dark:text-zinc-600 ml-auto">
                        {item.source}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">{item.reason}</div>
                    {Object.keys(after).length > 0 && (
                      <div className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5 font-mono truncate">
                        {Object.entries(after).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-300 dark:text-zinc-700 shrink-0 mt-0.5">
                    {new Date(item.updated_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
