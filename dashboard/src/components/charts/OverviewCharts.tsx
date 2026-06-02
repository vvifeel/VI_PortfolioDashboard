'use client';
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Sector,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ChartData } from '@/lib/types';
import RegionBubbleMap from './RegionBubbleMap';

interface Props {
  charts: ChartData;
  crossFilter?: Partial<ChartData>;
  activeSector?: string;
  activeRegion?: string;
  activeRound?: string;
  activeStatus?: string;
  activeType?: string;
  activeYear?: number;
  onSectorClick?: (s: string) => void;
  onRegionClick?: (r: string) => void;
  onRoundClick?: (r: string) => void;
  onStatusClick?: (s: string) => void;
  onTypeClick?: (t: string) => void;
  onYearClick?: (y: number) => void;
  onClearAll?: () => void;
}

type DataItem = { name: string; value: number; _others?: DataItem[] };
type VintageItem = { year: number; count: number };

const STATUS_COLORS: Record<string, string> = {
  'Alive': '#34d399', 'IPO': '#38bdf8',
  'Acquired': '#a78bfa', 'Dead/Closed': '#f87171', 'Other': '#71717a',
};
const TYPE_COLORS = ['#38bdf8', '#fbbf24', '#a78bfa', '#34d399'];
const DIM_COLOR = '#cbd5e1';

function groupByThreshold(
  raw: Array<{ name: string; value: number }>,
  threshold = 0.04,
  maxItems = 10,
): { items: DataItem[]; total: number } {
  const total = raw.reduce((s, d) => s + d.value, 0);
  if (total === 0 || raw.length <= 2) return { items: raw, total };
  const sorted = [...raw].sort((a, b) => b.value - a.value);
  const main: DataItem[] = [];
  const small: DataItem[] = [];
  sorted.forEach((d, i) => {
    if (i < maxItems && d.value / total >= threshold) main.push(d);
    else small.push(d);
  });
  if (small.length === 0) return { items: main, total };
  if (small.length === 1) return { items: [...main, ...small], total };
  const othersVal = small.reduce((s, d) => s + d.value, 0);
  return { items: [...main, { name: `기타 (${small.length}개)`, value: othersVal, _others: small }], total };
}

function ChartCard({ title, active, children }: { title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(
      'bg-white dark:bg-zinc-900 border rounded-xl p-4 shadow-sm transition-colors',
      active
        ? 'border-sky-300 dark:border-sky-500/50 ring-1 ring-sky-200 dark:ring-sky-500/20'
        : 'border-slate-200 dark:border-zinc-800'
    )}>
      <h3 className={cn('text-xs font-medium mb-3', active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-zinc-400')}>
        {title}
      </h3>
      {children}
    </div>
  );
}

const TS = {
  contentStyle: {
    background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: '8px', fontSize: '11px', color: '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,.07)',
  },
  cursor: { fill: 'rgba(0,0,0,0.025)' },
};

function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  const label = payload.name.length > 11 ? payload.name.slice(0, 11) + '…' : payload.name;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <text x={cx} y={cy - 9} textAnchor="middle" fill={fill} fontSize={10} fontWeight={700}>{label}</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#94a3b8" fontSize={10}>{value}개</text>
      <text x={cx} y={cy + 19} textAnchor="middle" fill="#94a3b8" fontSize={9}>{(percent * 100).toFixed(0)}%</text>
    </g>
  );
}

function SmartPie({
  items, total, colors, onSliceClick, activeItem, maxLegend = 8,
}: {
  items: DataItem[]; total: number; colors?: string[];
  onSliceClick?: (name: string) => void;
  activeItem?: string;
  maxLegend?: number;
}) {
  const isOthers = (d: DataItem) => !!(d._others?.length);
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? items.flatMap(d => isOthers(d) ? (d._others ?? []) : [d]) : items;
  const getColor = (name: string, i: number) => colors ? colors[i % colors.length] : CHART_COLORS[i % CHART_COLORS.length];

  return (
    <div>
      <ResponsiveContainer width="100%" height={185}>
        <PieChart>
          <Pie data={display} cx="50%" cy="50%" innerRadius={46} outerRadius={72}
            dataKey="value" nameKey="name" paddingAngle={2}
            activeShape={ActiveShape}
            onClick={(entry: any) => {
              if (isOthers(entry)) { setExpanded(v => !v); return; }
              onSliceClick?.(entry.name);
            }}>
            {display.map((entry, i) => {
              const dimmed = activeItem && entry.name !== activeItem;
              const base = isOthers(entry) ? '#94a3b8' : getColor(entry.name, i);
              return (
                <Cell key={i} fill={dimmed ? DIM_COLOR : base} opacity={dimmed ? 0.3 : 1}
                  cursor={onSliceClick || isOthers(entry) ? 'pointer' : 'default'} />
              );
            })}
          </Pie>
          <Tooltip {...TS}
            formatter={(value, name, props) => {
              const d = props.payload as DataItem;
              const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(0) : 0;
              if (isOthers(d)) {
                return [
                  <span key="v">
                    {value}개 ({pct}%)
                    <span style={{ display: 'block', marginTop: 4, fontSize: 9, color: '#94a3b8' }}>
                      {(d._others ?? []).map(o => `${o.name}(${o.value})`).join(' · ')}
                    </span>
                    <span style={{ display: 'block', marginTop: 4, fontSize: 9, color: '#60a5fa' }}>
                      클릭해서 {expanded ? '접기' : '펼치기'}
                    </span>
                  </span>,
                  String(name),
                ];
              }
              return [`${value}개 (${pct}%)`, String(name)];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 justify-center px-1 -mt-1">
        {display.slice(0, maxLegend).map((entry, i) => {
          const dimmed = activeItem && entry.name !== activeItem;
          return (
            <button key={entry.name}
              onClick={() => { if (isOthers(entry)) setExpanded(v => !v); else onSliceClick?.(entry.name); }}
              className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 transition-colors"
              style={{ opacity: dimmed ? 0.35 : 1 }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: isOthers(entry) ? '#94a3b8' : getColor(entry.name, i) }} />
              {entry.name.length > 13 ? entry.name.slice(0, 13) + '…' : entry.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Bar chart: ≤10 items → Recharts horizontal bars (auto Y-axis width, no truncation)
//              >10 items → 2-column mini-bar grid (all items shown, no grouping)
// ─────────────────────────────────────────────────────────────────────────────
function BarSection({
  data, activeItem, onClick,
}: {
  data: Array<{ name: string; value: number }>;
  activeItem?: string;
  onClick?: (name: string) => void;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, d) => s + d.value, 0);

  if (sorted.length === 0) {
    return <div className="h-20 flex items-center justify-center text-xs text-slate-300 dark:text-zinc-700">데이터 없음</div>;
  }

  if (sorted.length > 10) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-0.5">
        {sorted.map((entry, i) => {
          const pct = total > 0 ? (entry.value / total * 100) : 0;
          const dimmed = !!(activeItem && entry.name !== activeItem);
          const color = dimmed ? DIM_COLOR : CHART_COLORS[i % CHART_COLORS.length];
          return (
            <button key={entry.name} onClick={() => onClick?.(entry.name)}
              className="flex flex-col gap-[3px] text-left hover:bg-slate-50 dark:hover:bg-zinc-800/40 rounded px-1 py-0.5 transition-colors min-w-0"
              style={{ opacity: dimmed ? 0.4 : 1 }}>
              <div className="flex items-center justify-between gap-1 min-w-0">
                <span className="text-[9.5px] text-slate-600 dark:text-zinc-300 truncate leading-tight">{entry.name}</span>
                <span className="text-[9px] text-slate-400 dark:text-zinc-600 shrink-0 tabular-nums">{entry.value}</span>
              </div>
              <div className="h-[3px] w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const maxLabelLen = Math.max(4, ...sorted.map(d => d.name.length));
  const yWidth = Math.min(180, Math.max(72, maxLabelLen * 6.8));
  const height = Math.max(100, sorted.length * 27 + 16);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 32, top: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis dataKey="name" type="category" width={yWidth}
          tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip {...TS}
          formatter={(value, _name, props) => {
            const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(0) : '?';
            return [`${value}개 (${pct}%)`, String((props.payload as any).name)];
          }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} cursor="pointer"
          onClick={(d: any) => onClick?.(d.name)}>
          {sorted.map((entry, i) => {
            const dimmed = !!(activeItem && entry.name !== activeItem);
            return (
              <Cell key={i}
                fill={dimmed ? DIM_COLOR : CHART_COLORS[i % CHART_COLORS.length]}
                opacity={dimmed ? 0.35 : 1}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopNBarSection({
  data, activeItem, onClick, topN = 7,
}: {
  data: Array<{ name: string; value: number }>;
  activeItem?: string;
  onClick?: (name: string) => void;
  topN?: number;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, d) => s + d.value, 0);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  if (sorted.length === 0) {
    return <div className="h-20 flex items-center justify-center text-xs text-slate-300 dark:text-zinc-700">데이터 없음</div>;
  }

  const maxLabelLen = Math.max(4, ...top.map(d => d.name.length));
  const yWidth = Math.min(160, Math.max(60, maxLabelLen * 6.5));
  const chartHeight = Math.max(80, top.length * 26 + 10);

  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={top} layout="vertical" margin={{ left: 0, right: 28, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis dataKey="name" type="category" width={yWidth}
            tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip {...TS}
            formatter={(value, _name, props) => {
              const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(0) : '?';
              return [`${value}개 (${pct}%)`, String((props.payload as any).name)]; // eslint-disable-line @typescript-eslint/no-explicit-any
            }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} cursor="pointer"
            onClick={(d: any) => onClick?.(d.name)}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
            {top.map((entry, i) => {
              const dimmed = !!(activeItem && entry.name !== activeItem);
              return (
                <Cell key={entry.name}
                  fill={dimmed ? DIM_COLOR : CHART_COLORS[i % CHART_COLORS.length]}
                  opacity={dimmed ? 0.35 : 1}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {rest.length > 0 && (
        <div className="mt-1.5 px-0.5">
          <div className="h-[4px] w-full flex rounded-full overflow-hidden mb-1.5">
            {sorted.map((d, i) => {
              const pct = total > 0 ? (d.value / total * 100) : 0;
              const dimmed = !!(activeItem && d.name !== activeItem);
              return (
                <div key={d.name}
                  style={{ width: `${pct}%`, background: dimmed ? DIM_COLOR : CHART_COLORS[i % CHART_COLORS.length], opacity: dimmed ? 0.3 : 1 }}
                  title={`${d.name}: ${d.value}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {rest.map((entry, i) => {
              const dimmed = !!(activeItem && entry.name !== activeItem);
              return (
                <button key={entry.name} onClick={() => onClick?.(entry.name)}
                  className="flex items-center gap-0.5 text-[9px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                  style={{ opacity: dimmed ? 0.35 : 1 }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: CHART_COLORS[(topN + i) % CHART_COLORS.length] }} />
                  {entry.name}
                  <span className="text-slate-400 dark:text-zinc-600 ml-0.5">{entry.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function OverviewCharts({
  charts, crossFilter,
  activeSector, activeRegion, activeRound, activeStatus, activeType, activeYear,
  onSectorClick, onRegionClick, onRoundClick, onStatusClick, onTypeClick, onYearClick,
  onClearAll,
}: Props) {
  const { vintageDist, roundDist, statusDist, typeDist } = charts;

  // Each chart uses crossFilter data for its OWN dimension:
  // crossFilter.sectorDist = rows filtered by everything EXCEPT sector
  // so the sector chart shows "what sectors are available in the current context"
  const sectorData  = crossFilter?.sectorDist  ?? charts.sectorDist;
  const regionData  = crossFilter?.regionDist  ?? charts.regionDist;
  const roundData   = crossFilter?.roundDist   ?? roundDist;
  const statusData  = crossFilter?.statusDist  ?? statusDist;
  const typeData    = crossFilter?.typeDist    ?? typeDist;
  const vintageData = crossFilter?.vintageDist ?? vintageDist;

  const roundGrouped  = groupByThreshold(roundData, 0.04, 8);
  const statusGrouped = groupByThreshold(statusData, 0.04, 6);
  const typeGrouped   = groupByThreshold(typeData, 0.04, 6);

  const hasAnyFilter = !!(activeSector || activeRegion || activeRound || activeStatus || activeType || activeYear);

  return (
    <div className="space-y-2">
      {hasAnyFilter && onClearAll && (
        <div className="flex justify-start">
          <button onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 px-2.5 py-1 rounded-full transition-colors">
            ✕ 필터 초기화 (전체 보기)
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">

        <ChartCard title={`섹터 분포${activeSector ? ` · ${activeSector}` : ''}`} active={!!activeSector}>
          <TopNBarSection data={sectorData} activeItem={activeSector} onClick={onSectorClick} />
        </ChartCard>

        <ChartCard title={`지역 분포${activeRegion ? ` · ${activeRegion}` : ''}`} active={!!activeRegion}>
          <RegionBubbleMap data={regionData} activeItem={activeRegion} onClick={onRegionClick} height={185} />
        </ChartCard>

        <ChartCard title={`투자 빈티지${activeYear ? ` · ${activeYear}년` : ' (연도별)'}`} active={!!activeYear}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vintageData} margin={{ left: -16, right: 8, top: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip {...TS} formatter={(v) => [v + '건', '투자 건수']} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} cursor="pointer"
                onClick={(d: any) => onYearClick?.(d.year)}>
                {(vintageData as VintageItem[]).map((entry, i) => {
                  const dimmed = activeYear && entry.year !== activeYear;
                  return (
                    <Cell key={i} fill={dimmed ? DIM_COLOR : '#38bdf8'} opacity={dimmed ? 0.3 : 1} />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`투자 라운드${activeRound ? ` · ${activeRound}` : ' 분포'}`} active={!!activeRound}>
          <SmartPie items={roundGrouped.items} total={roundGrouped.total}
            onSliceClick={onRoundClick} activeItem={activeRound} />
        </ChartCard>

        <ChartCard title={`포트폴리오 상태${activeStatus ? ` · ${activeStatus}` : ''}`} active={!!activeStatus}>
          <SmartPie
            items={statusGrouped.items} total={statusGrouped.total}
            colors={statusGrouped.items.map(d => STATUS_COLORS[d.name] ?? '#71717a')}
            onSliceClick={onStatusClick} activeItem={activeStatus}
          />
        </ChartCard>

        <ChartCard title={`투자 유형${activeType ? ` · ${activeType}` : ''}`} active={!!activeType}>
          <SmartPie items={typeGrouped.items} total={typeGrouped.total}
            colors={TYPE_COLORS} onSliceClick={onTypeClick} activeItem={activeType} />
        </ChartCard>

      </div>
    </div>
  );
}
