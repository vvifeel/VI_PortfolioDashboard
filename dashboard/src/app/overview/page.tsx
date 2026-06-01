import OverviewCharts from '@/components/charts/OverviewCharts';
import type { ChartData } from '@/lib/types';
import { Activity, Building2, Globe, LayoutGrid, TrendingUp, CheckCircle2, Zap, XCircle } from 'lucide-react';

async function getOverviewData() {
  const res = await fetch('http://localhost:3000/api/overview', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-semibold text-zinc-100">{value.toLocaleString()}</div>
        <div className="text-sm text-zinc-400 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-zinc-600 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default async function OverviewPage() {
  let data: { kpis: Record<string, number>; charts: ChartData; lastRun?: { run_at: string; news_collected: number } } | null = null;
  let error: string | null = null;

  try {
    data = await getOverviewData();
  } catch {
    error = 'DB 연결 오류 — 서버를 확인하세요';
  }

  const kpis = data?.kpis;
  const charts = data?.charts;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">포트폴리오 대시보드</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.lastRun
              ? `마지막 업데이트: ${new Date(data.lastRun.run_at).toLocaleString('ko-KR')}`
              : '뉴스 수집 대기 중'}
          </p>
        </div>
        <div className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
          PoC Demo — 가상 데이터
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="포트폴리오 기업"   value={kpis.totalCompanies}   icon={Building2}   color="bg-sky-500/10 text-sky-400" />
          <KpiCard label="총 투자 건수"       value={kpis.totalInvestments} icon={TrendingUp}   color="bg-violet-500/10 text-violet-400" />
          <KpiCard label="커버 섹터"          value={kpis.totalSectors}     icon={LayoutGrid}   color="bg-amber-500/10 text-amber-400" />
          <KpiCard label="투자 국가"          value={kpis.totalRegions}     icon={Globe}        color="bg-emerald-500/10 text-emerald-400" />
          <KpiCard label="Active 기업"        value={kpis.aliveCount}       icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-400" />
          <KpiCard label="IPO 기업"           value={kpis.ipoCount}         icon={Zap}          color="bg-sky-500/10 text-sky-400" />
          <KpiCard label="Acquired 기업"      value={kpis.acquiredCount}    icon={Activity}     color="bg-violet-500/10 text-violet-400" />
          <KpiCard label="Dead / Closed"      value={kpis.deadCount}        icon={XCircle}      color="bg-red-500/10 text-red-400" />
        </div>
      )}

      {/* Charts */}
      {charts && <OverviewCharts charts={charts} />}
    </div>
  );
}
