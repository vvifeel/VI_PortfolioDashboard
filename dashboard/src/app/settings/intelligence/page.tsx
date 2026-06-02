'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Rss, Bot, Globe, Mail, Lock, Zap, RefreshCw,
  Clock, ArrowRight, Database, Settings2, BarChart3,
  PlayCircle, Users, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Source {
  id: number; name: string; type: string; config: string;
  active: number; frequency: string; cost_type: string;
  description?: string; phase: number; coming_soon: number;
}
interface Config {
  sources: Source[];
  tierCounts: Record<number, number>;
  config: Record<string, string>;
  lastRun?: { run_at: string; news_collected: number; companies_hit: number };
}
interface TierCompany {
  company_name: string;
  monitoring_tier: number | null;
  status?: string;
  sector?: string;
}

const TYPE_ICON: Record<string, React.ElementType> = { rss: Rss, mcp: Bot, scrape: Globe, api: Database, email: Mail };

const SOURCE_ACCENT: Record<string, string> = {
  'Google News RSS':  'from-blue-500 to-blue-600',
  'Naver News':       'from-green-500 to-green-600',
  'OpenDART':         'from-teal-500 to-teal-600',
  'Platum RSS':       'from-violet-500 to-violet-600',
  'TechCrunch RSS':   'from-orange-500 to-orange-600',
  'VentureBeat RSS':  'from-amber-500 to-amber-600',
  'Crunchbase News':  'from-sky-500 to-sky-600',
  'CB Insights':      'from-indigo-500 to-indigo-600',
  'Bloomberg':        'from-black to-zinc-700',
  'The Information':  'from-red-600 to-red-700',
  'PitchBook':        'from-slate-500 to-slate-600',
  'SEC EDGAR':        'from-blue-700 to-blue-800',
  'Axios Pro Deals':  'from-pink-500 to-pink-600',
  'Reuters Tech RSS': 'from-orange-600 to-red-600',
};

const FREQ_OPTIONS = [
  { value: 'daily', label: '매일' },
  { value: '3x_week', label: '주 3회' },
  { value: 'weekly', label: '주 1회' },
];

const TIER_STYLES = [
  { label: 'Tier 1', sub: '최근 투자 · 긴급', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', dot: 'bg-red-500', chip: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20' },
  { label: 'Tier 2', sub: 'Active 기업', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-500', chip: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20' },
  { label: 'Tier 3', sub: '오래된 투자', color: 'text-slate-500 dark:text-zinc-500', bg: 'bg-slate-50 dark:bg-zinc-800/50', border: 'border-slate-200 dark:border-zinc-700', dot: 'bg-slate-400', chip: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700' },
];

function SourceRow({ source, onToggle }: { source: Source; onToggle: (id: number, active: boolean) => void }) {
  const Icon = TYPE_ICON[source.type] ?? Globe;
  const accent = SOURCE_ACCENT[source.name] ?? 'from-slate-400 to-slate-500';
  const isLocked = source.coming_soon === 1;
  const isBrowser = source.config.includes('browser');
  const freqLabel = source.frequency === 'realtime' ? '수시' : source.frequency === 'daily' ? '일 1회' : source.frequency === 'weekly' ? '주 1회' : '주 3회';

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all',
      isLocked
        ? 'border-slate-100 dark:border-zinc-800/60 opacity-50 bg-transparent'
        : source.active
          ? 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80'
          : 'border-transparent bg-slate-50/60 dark:bg-zinc-800/20'
    )}>
      {/* Icon */}
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
        isLocked ? 'bg-slate-100 dark:bg-zinc-800' : `bg-gradient-to-br ${accent}`
      )}>
        {isLocked
          ? <Lock size={11} className="text-slate-400 dark:text-zinc-500" />
          : <Icon size={11} className="text-white" />}
      </div>

      {/* Name + desc */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs font-medium', isLocked ? 'text-slate-400 dark:text-zinc-600' : 'text-slate-700 dark:text-zinc-200')}>
            {source.name}
          </span>
          {isLocked && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-500">로드맵</span>
          )}
          {isBrowser && !isLocked && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">브라우저</span>
          )}
        </div>
        {source.description && (
          <div className="text-[10px] text-slate-400 dark:text-zinc-600 truncate mt-0.5">{source.description}</div>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn(
          'text-[9px] px-1.5 py-0.5 rounded font-medium',
          source.cost_type === 'free'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
        )}>
          {source.cost_type === 'free' ? '무료' : '유료'}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500">
          {source.type.toUpperCase()}
        </span>
        {source.active === 1 && !isLocked && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-500 dark:text-sky-400">
            {freqLabel}
          </span>
        )}
      </div>

      {/* Toggle */}
      {!isLocked && (
        <button
          onClick={() => onToggle(source.id, !source.active)}
          className={cn(
            'relative shrink-0 rounded-full transition-colors duration-200',
            source.active ? 'bg-sky-500' : 'bg-slate-200 dark:bg-zinc-700'
          )}
          style={{ height: '18px', width: '32px' }}>
          <span className={cn(
            'absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200',
            source.active ? 'translate-x-3.5' : 'translate-x-0'
          )} style={{ width: '14px', height: '14px' }} />
        </button>
      )}
    </div>
  );
}

function TierRow({ tier, count, frequency, onFreqChange }: {
  tier: number; count: number; frequency: string;
  onFreqChange: (freq: string) => void;
}) {
  const c = TIER_STYLES[tier - 1];
  return (
    <div className={cn('rounded-lg border p-2.5', c.border)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot)} />
          <span className={cn('text-xs font-semibold', c.color)}>{c.label}</span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-600">{c.sub}</span>
        </div>
        <span className={cn('text-xs font-bold tabular-nums', c.color)}>
          {count}<span className="text-[10px] font-normal ml-0.5 text-slate-400 dark:text-zinc-600">개</span>
        </span>
      </div>
      <div className="flex gap-1">
        {FREQ_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => onFreqChange(opt.value)}
            className={cn(
              'flex-1 py-0.5 rounded text-[10px] font-medium transition-colors',
              frequency === opt.value
                ? cn(c.bg, c.color, 'border', c.border)
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400'
            )}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  const [data, setData] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  // Phase 3 — collection trigger
  const [runLog, setRunLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Tier assignment
  const [companies, setCompanies] = useState<TierCompany[]>([]);
  const [tierSearch, setTierSearch] = useState('');
  const [tierLoading, setTierLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/intelligence/config');
    setData(await res.json());
    setLoading(false);
  }, []);

  const loadTiers = useCallback(async () => {
    setTierLoading(true);
    const res = await fetch('/api/companies/tiers');
    const json = await res.json();
    setCompanies(json.companies ?? []);
    setTierLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTiers(); }, [loadTiers]);

  // Auto-scroll log panel
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [runLog]);

  const toggleSource = async (id: number, active: boolean) => {
    await fetch('/api/intelligence/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: id, active }),
    });
    load();
  };

  const updateTierFreq = async (tier: number, value: string) => {
    await fetch('/api/intelligence/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configKey: `tier_${tier}_frequency`, value }),
    });
    load();
  };

  const runCollect = () => {
    setRunLog([]);
    setRunning(true);
    setShowLog(true);
    const evs = new EventSource('/api/trigger-collect');
    evs.onmessage = (e) => {
      const { msg } = JSON.parse(e.data);
      if (msg === '__DONE__') { evs.close(); setRunning(false); load(); return; }
      setRunLog(prev => [...prev, msg]);
    };
    evs.onerror = () => { evs.close(); setRunning(false); };
  };

  const moveTier = async (companyName: string, newTier: number) => {
    setCompanies(prev => prev.map(c =>
      c.company_name === companyName ? { ...c, monitoring_tier: newTier } : c
    ));
    await fetch('/api/companies/tiers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: companyName, tier: newTier }),
    });
  };

  const phase1 = data?.sources.filter(s => s.phase === 1) ?? [];
  const phase2 = data?.sources.filter(s => s.phase === 2) ?? [];
  const cfg = data?.config ?? {};
  const tierCounts = data?.tierCounts ?? { 1: 0, 2: 0, 3: 0 };

  const filteredCompanies = tierSearch
    ? companies.filter(c => c.company_name.toLowerCase().includes(tierSearch.toLowerCase()) || (c.sector ?? '').toLowerCase().includes(tierSearch.toLowerCase()))
    : companies;

  const nextRunText = () => {
    if (!data?.lastRun) return '미예정 — cron 설정 필요';
    const last = new Date(data.lastRun.run_at);
    const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
    return next.toLocaleString('ko-KR');
  };

  return (
    <div className="p-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">인텔리전스 수집 설정</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Agent의 뉴스 수집 전략과 소스를 관리합니다</p>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <button
            onClick={runCollect}
            disabled={running}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-sm',
              running
                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-600 text-white'
            )}
          >
            {running ? <RefreshCw size={13} className="animate-spin" /> : <PlayCircle size={13} />}
            {running ? '수집 중...' : '지금 수집 실행'}
          </button>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-right shadow-sm">
            <div className="text-[10px] text-slate-400 dark:text-zinc-600">다음 예정 수집</div>
            <div className="text-xs font-medium text-slate-700 dark:text-zinc-300 mt-0.5 flex items-center gap-1 justify-end">
              <Clock size={11} className="text-slate-400 dark:text-zinc-600" />
              {loading ? '—' : nextRunText()}
            </div>
            {data?.lastRun && (
              <div className="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">
                마지막: {new Date(data.lastRun.run_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {data.lastRun.news_collected}건
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log panel */}
      {showLog && (
        <div className="rounded-xl overflow-hidden border border-zinc-700 shadow-sm mb-4">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 dark:bg-zinc-950 border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <div className={cn('w-1.5 h-1.5 rounded-full', running ? 'bg-green-400 animate-pulse' : 'bg-zinc-500')} />
              <span className="text-xs text-zinc-400 font-mono">수집 로그</span>
            </div>
            <button onClick={() => setShowLog(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X size={13} />
            </button>
          </div>
          <div ref={logRef} className="bg-zinc-950 px-4 py-3 font-mono text-xs text-green-400 max-h-40 overflow-y-auto space-y-0.5">
            {runLog.length === 0 ? (
              <span className="text-zinc-600">대기 중...</span>
            ) : runLog.map((line, i) => (
              <div key={i} className={cn(
                line.startsWith('❌') ? 'text-red-400' :
                line.startsWith('⚠') ? 'text-yellow-400' :
                line.startsWith('✅') ? 'text-emerald-400' : 'text-green-400'
              )}>{line}</div>
            ))}
            {running && <span className="text-zinc-500 animate-pulse">▋</span>}
          </div>
        </div>
      )}

      {/* 2-column main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 mb-4">

        {/* LEFT — Pipeline */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">수집 파이프라인</span>
          </div>
          <div className="grid grid-cols-[1fr_24px_1fr] gap-2 items-start">
            {/* Phase 1 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">1</div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">신호 감지</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-600">빠름 · 저비용 · 전체</div>
                </div>
              </div>
              <div className="space-y-1">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 h-10 animate-pulse" />)
                  : phase1.map(s => <SourceRow key={s.id} source={s} onToggle={toggleSource} />)
                }
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center justify-center pt-9 gap-1">
              <div className="text-[9px] text-slate-300 dark:text-zinc-600 [writing-mode:vertical-rl] mb-1">감지된 기업만</div>
              <ArrowRight size={14} className="text-slate-300 dark:text-zinc-600" />
            </div>

            {/* Phase 2 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">2</div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">심층 분석</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-600">정확 · 고품질 · 선별</div>
                </div>
              </div>
              <div className="space-y-1">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 h-10 animate-pulse" />)
                  : phase2.map(s => <SourceRow key={s.id} source={s} onToggle={toggleSource} />)
                }
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Tier config + Keywords */}
        <div className="space-y-3">
          {/* Tier config */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <BarChart3 size={13} className="text-slate-500 dark:text-zinc-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">티어 수집 주기</span>
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map(tier => (
                <TierRow
                  key={tier}
                  tier={tier}
                  count={tierCounts[tier] ?? 0}
                  frequency={cfg[`tier_${tier}_frequency`] ?? 'daily'}
                  onFreqChange={freq => updateTierFreq(tier, freq)}
                />
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Settings2 size={13} className="text-slate-500 dark:text-zinc-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">고신호 키워드</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {JSON.parse(cfg['high_signal_keywords'] ?? '[]').map((kw: string) => (
                <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 font-medium">
                  {kw}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-600 mt-2">
              이 키워드 감지 시 Phase 2 자동 격상
            </div>
          </div>
        </div>
      </div>

      {/* Tier Assignment Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-slate-500 dark:text-zinc-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">기업 티어 배정</span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-600">— 변경 즉시 저장</span>
          </div>
          <input
            type="text"
            value={tierSearch}
            onChange={e => setTierSearch(e.target.value)}
            placeholder="기업명 / 섹터 검색..."
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500 w-40"
          />
        </div>
        {tierLoading ? (
          <div className="h-32 animate-pulse bg-slate-50 dark:bg-zinc-900/40" />
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90">
                  <th className="text-left px-4 py-2 text-xs text-slate-500 dark:text-zinc-500 font-medium">기업명</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 dark:text-zinc-500 font-medium">섹터</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 dark:text-zinc-500 font-medium">상태</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 dark:text-zinc-500 font-medium w-32">티어</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 dark:text-zinc-500 font-medium">마지막 업데이트</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 dark:text-zinc-600 text-xs">
                      {tierSearch ? '검색 결과가 없습니다' : '기업이 없습니다'}
                    </td>
                  </tr>
                )}
                {filteredCompanies.map((c, i) => {
                  const curTier = c.monitoring_tier ?? 2;
                  const ts = TIER_STYLES[curTier - 1];
                  const lastUpdate = (c as any).last_profile_update_at;
                  const relTime = lastUpdate ? (() => {
                    const diff = Date.now() - new Date(lastUpdate).getTime();
                    const d = Math.floor(diff / 86400000);
                    if (d === 0) return '오늘';
                    if (d < 7) return `${d}일 전`;
                    if (d < 30) return `${Math.floor(d / 7)}주 전`;
                    return `${Math.floor(d / 30)}개월 전`;
                  })() : '—';

                  return (
                    <tr key={c.company_name}
                      className={cn(
                        'border-b border-slate-100 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors',
                        i === filteredCompanies.length - 1 && 'border-b-0'
                      )}>
                      <td className="px-4 py-2">
                        <a href={`/portfolio/${encodeURIComponent(c.company_name)}`}
                          className="text-xs font-medium text-slate-800 dark:text-zinc-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                          {c.company_name}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 dark:text-zinc-500">{c.sector ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 dark:text-zinc-500">{c.status ?? '—'}</td>
                      <td className="px-4 py-2">
                        <select
                          value={curTier}
                          onChange={e => moveTier(c.company_name, parseInt(e.target.value))}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-lg border font-medium appearance-none cursor-pointer focus:outline-none',
                            ts.chip
                          )}>
                          <option value={1}>Tier 1</option>
                          <option value={2}>Tier 2</option>
                          <option value={3}>Tier 3</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400 dark:text-zinc-600">{relTime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
