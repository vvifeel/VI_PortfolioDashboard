'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Rss, Bot, Globe, Mail, Lock, Zap, RefreshCw,
  ChevronRight, AlertCircle, CheckCircle2, Clock,
  ArrowRight, Database, Settings2, BarChart3,
  PlayCircle, Users, X, GripVertical
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

function SourceCard({ source, onToggle }: { source: Source; onToggle: (id: number, active: boolean) => void }) {
  const Icon = TYPE_ICON[source.type] ?? Globe;
  const accent = SOURCE_ACCENT[source.name] ?? 'from-slate-400 to-slate-500';
  const isLocked = source.coming_soon === 1;
  const isBrowser = source.config.includes('browser');

  return (
    <div className={cn(
      'relative rounded-xl border transition-all duration-200',
      isLocked
        ? 'border-slate-200 dark:border-zinc-800 opacity-50 bg-slate-50 dark:bg-zinc-900/40'
        : source.active
          ? 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md'
          : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60'
    )}>
      {!isLocked && (
        <div className={cn('h-0.5 rounded-t-xl bg-gradient-to-r', accent, !source.active && 'opacity-30')} />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              isLocked ? 'bg-slate-100 dark:bg-zinc-800' : `bg-gradient-to-br ${accent}`
            )}>
              {isLocked
                ? <Lock size={14} className="text-slate-400 dark:text-zinc-500" />
                : <Icon size={14} className="text-white" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn('text-sm font-medium', isLocked ? 'text-slate-400 dark:text-zinc-600' : 'text-slate-800 dark:text-zinc-200')}>
                  {source.name}
                </span>
                {isLocked && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-500">
                    로드맵
                  </span>
                )}
                {isBrowser && !isLocked && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                    브라우저
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5 truncate">{source.description}</div>
            </div>
          </div>
          {!isLocked && (
            <button
              onClick={() => onToggle(source.id, !source.active)}
              className={cn(
                'relative shrink-0 rounded-full transition-colors duration-200',
                source.active ? 'bg-sky-500' : 'bg-slate-200 dark:bg-zinc-700'
              )}
              style={{ height: '22px', width: '40px' }}>
              <span className={cn(
                'absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200',
                source.active ? 'translate-x-[18px]' : 'translate-x-0'
              )} style={{ width: '18px', height: '18px' }} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-medium border',
            source.cost_type === 'free'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
          )}>
            {source.cost_type === 'free' ? '무료' : '유료'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            {source.type.toUpperCase()}
          </span>
          {source.active === 1 && !isLocked && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
              {source.frequency === 'realtime' ? '수시' : source.frequency === 'daily' ? '일 1회' : '주 1회'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier, count, frequency, onFreqChange }: {
  tier: number; count: number; frequency: string;
  onFreqChange: (freq: string) => void;
}) {
  const c = TIER_STYLES[tier - 1];
  return (
    <div className={cn('rounded-xl border p-5 bg-white dark:bg-zinc-900', c.border)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full', c.dot)} />
            <span className={cn('text-sm font-semibold', c.color)}>{c.label}</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5">{c.sub}</div>
        </div>
        <div className={cn('text-2xl font-bold tabular-nums', c.color)}>{count.toLocaleString()}</div>
      </div>
      <div className="text-xs text-slate-400 dark:text-zinc-600 mt-1">기업</div>
      <div className="mt-4">
        <div className="text-xs text-slate-400 dark:text-zinc-600 mb-2">수집 주기</div>
        <div className="flex gap-1">
          {FREQ_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => onFreqChange(opt.value)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                frequency === opt.value
                  ? cn(c.bg, c.color, 'border', c.border)
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400'
              )}>
              {opt.label}
            </button>
          ))}
        </div>
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

  // Phase 4 — tier drag&drop
  const [companies, setCompanies] = useState<TierCompany[]>([]);
  const [tierSearch, setTierSearch] = useState('');
  const [tierLoading, setTierLoading] = useState(false);
  const [dragCompany, setDragCompany] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<number | null>(null);

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
    <div className="p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">인텔리전스 수집 설정</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1">Agent의 뉴스 수집 전략과 소스를 관리합니다</p>
        </div>

        <div className="flex items-start gap-3">
          {/* Trigger button */}
          <button
            onClick={runCollect}
            disabled={running}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm',
              running
                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-600 text-white'
            )}
          >
            {running
              ? <RefreshCw size={14} className="animate-spin" />
              : <PlayCircle size={14} />}
            {running ? '수집 중...' : '지금 수집 실행'}
          </button>

          {/* Status pill */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-right shadow-sm">
            <div className="text-xs text-slate-400 dark:text-zinc-600">다음 예정 수집</div>
            <div className="text-sm font-medium text-slate-700 dark:text-zinc-300 mt-0.5 flex items-center gap-1.5 justify-end">
              <Clock size={12} className="text-slate-400 dark:text-zinc-600" />
              {loading ? '—' : nextRunText()}
            </div>
            {data?.lastRun && (
              <div className="text-xs text-slate-400 dark:text-zinc-600 mt-1">
                마지막: {new Date(data.lastRun.run_at).toLocaleString('ko-KR')} · {data.lastRun.news_collected}건 수집
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log panel */}
      {showLog && (
        <div className="rounded-xl overflow-hidden border border-zinc-700 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-950 border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', running ? 'bg-green-400 animate-pulse' : 'bg-zinc-500')} />
              <span className="text-xs text-zinc-400 font-mono">수집 로그</span>
            </div>
            <button
              onClick={() => setShowLog(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div
            ref={logRef}
            className="bg-zinc-950 px-4 py-3 font-mono text-xs text-green-400 max-h-48 overflow-y-auto space-y-0.5"
          >
            {runLog.length === 0 ? (
              <span className="text-zinc-600">대기 중...</span>
            ) : runLog.map((line, i) => (
              <div key={i} className={cn(
                line.startsWith('❌') ? 'text-red-400' :
                line.startsWith('⚠') ? 'text-yellow-400' :
                line.startsWith('✅') ? 'text-emerald-400' :
                'text-green-400'
              )}>
                {line}
              </div>
            ))}
            {running && <span className="text-zinc-500 animate-pulse">▋</span>}
          </div>
        </div>
      )}

      {/* Pipeline Visualization */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">수집 파이프라인</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          {/* Phase 1 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold">1</div>
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">신호 감지</div>
                <div className="text-xs text-slate-400 dark:text-zinc-600">빠름 · 저비용 · 전체 포트폴리오</div>
              </div>
            </div>
            <div className="space-y-2">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 h-24 animate-pulse" />
                  ))
                : phase1.map(s => <SourceCard key={s.id} source={s} onToggle={toggleSource} />)
              }
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden lg:flex flex-col items-center justify-center pt-16 gap-2">
            <div className="text-xs text-slate-400 dark:text-zinc-600 text-center whitespace-nowrap">감지된 기업만</div>
            <ArrowRight size={20} className="text-slate-300 dark:text-zinc-600" />
          </div>

          {/* Phase 2 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">2</div>
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">심층 분석</div>
                <div className="text-xs text-slate-400 dark:text-zinc-600">정확 · 고품질 · 선별 기업만</div>
              </div>
            </div>
            <div className="space-y-2">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 h-24 animate-pulse" />
                  ))
                : phase2.map(s => <SourceCard key={s.id} source={s} onToggle={toggleSource} />)
              }
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-zinc-800" />

      {/* Tier Configuration */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={14} className="text-slate-500 dark:text-zinc-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">기업 티어 설정</h2>
        </div>
        <p className="text-xs text-slate-400 dark:text-zinc-600 mb-4">
          중요도에 따라 기업을 티어로 분류하고 수집 주기를 달리합니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(tier => (
            <TierCard
              key={tier}
              tier={tier}
              count={tierCounts[tier] ?? 0}
              frequency={cfg[`tier_${tier}_frequency`] ?? 'daily'}
              onFreqChange={freq => updateTierFreq(tier, freq)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-zinc-800" />

      {/* Tier Drag & Drop Assignment */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-slate-500 dark:text-zinc-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">기업 티어 배정</h2>
            <span className="text-xs text-slate-400 dark:text-zinc-600">— 드래그로 조정</span>
          </div>
          <input
            type="text"
            value={tierSearch}
            onChange={e => setTierSearch(e.target.value)}
            placeholder="기업명 / 섹터 검색..."
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500 w-44"
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-zinc-600 mb-4">
          기업을 드래그해서 티어를 변경하세요. 변경 즉시 저장됩니다.
        </p>

        {tierLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map(tierNum => {
              const ts = TIER_STYLES[tierNum - 1];
              const tierCompanies = filteredCompanies.filter(c => (c.monitoring_tier ?? 2) === tierNum);
              const isOver = dragOverTier === tierNum;

              return (
                <div
                  key={tierNum}
                  onDragOver={(e) => { e.preventDefault(); setDragOverTier(tierNum); }}
                  onDragLeave={() => setDragOverTier(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragCompany) moveTier(dragCompany, tierNum);
                    setDragCompany(null);
                    setDragOverTier(null);
                  }}
                  className={cn(
                    'rounded-xl border transition-all',
                    isOver ? 'ring-2 ring-sky-400 border-sky-300 dark:border-sky-500/50' : ts.border,
                    isOver ? 'bg-sky-50/50 dark:bg-sky-500/5' : 'bg-white dark:bg-zinc-900'
                  )}
                >
                  {/* Column header */}
                  <div className={cn('px-3 py-2.5 border-b flex items-center gap-2', ts.border)}>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', ts.dot)} />
                    <span className={cn('text-xs font-semibold', ts.color)}>{ts.label}</span>
                    <span className="text-xs text-slate-400 dark:text-zinc-600 ml-auto">{tierCompanies.length}개</span>
                  </div>

                  {/* Company chips */}
                  <div className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: '320px' }}>
                    {tierCompanies.length === 0 ? (
                      <div className="text-xs text-slate-300 dark:text-zinc-700 text-center py-6">
                        여기에 드래그하세요
                      </div>
                    ) : tierCompanies.map(c => (
                      <div
                        key={c.company_name}
                        draggable
                        onDragStart={() => setDragCompany(c.company_name)}
                        onDragEnd={() => { setDragCompany(null); setDragOverTier(null); }}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-grab active:cursor-grabbing select-none transition-opacity',
                          ts.chip,
                          dragCompany === c.company_name && 'opacity-40'
                        )}
                      >
                        <GripVertical size={10} className="opacity-40 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate leading-tight">{c.company_name}</div>
                          {c.sector && (
                            <div className="text-[10px] opacity-60 truncate leading-tight">{c.sector}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* High Signal Keywords */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 size={14} className="text-slate-500 dark:text-zinc-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">고신호 키워드</h2>
          <span className="text-xs text-slate-400 dark:text-zinc-600">— Phase 2 딥다이브 트리거 조건</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {JSON.parse(cfg['high_signal_keywords'] ?? '[]').map((kw: string) => (
            <span key={kw} className="text-xs px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 font-medium">
              {kw}
            </span>
          ))}
        </div>
        <div className="text-xs text-slate-400 dark:text-zinc-600 mt-3">
          신호 감지 단계에서 이 키워드가 포함된 기사가 발견되면 해당 기업을 Phase 2 대상으로 자동 격상합니다.
        </div>
      </div>
    </div>
  );
}
