'use client';
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Sector,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ChartData } from '@/lib/types';

interface Props {
  charts: ChartData;
  fullCharts?: Partial<ChartData>;
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

// Group items below pct threshold into "기타"
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

function truncLabel(s: string, max = 15) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <text x={cx} y={cy - 9} textAnchor="middle" fill={fill} fontSize={10} fontWeight={700}>
        {truncLabel(payload.name, 11)}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#94a3b8" fontSize={10}>
        {value}개
      </text>
      <text x={cx} y={cy + 19} textAnchor="middle" fill="#94a3b8" fontSize={9}>
        {(percent * 100).toFixed(0)}%
      </text>
    </g>
  );
}

// Smart pie — keeps full data, dims non-active, handles 기타
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

  const getColor = (name: string, i: number) => {
    if (colors) return colors[i % colors.length];
    return CHART_COLORS[i % CHART_COLORS.length];
  };

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
                <Cell key={i}
                  fill={dimmed ? DIM_COLOR : base}
                  opacity={dimmed ? 0.3 : 1}
                  cursor={onSliceClick || isOthers(entry) ? 'pointer' : 'default'}
                />
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
              {truncLabel(entry.name, 13)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Bar chart with groupByThreshold + cross-filter highlight ──────────────────
function BarSection({
  data, activeItem, onClick, yWidth = 110, maxItems = 10, threshold = 0.04,
}: {
  data: Array<{ name: string; value: number }>;
  activeItem?: string;
  onClick?: (name: string) => void;
  yWidth?: number;
  maxItems?: number;
  threshold?: number;
}) {
  const { items, total } = groupByThreshold(data, threshold, maxItems);
  const height = Math.max(160, Math.min(280, items.length * 26 + 20));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ left: 0, right: 28, top: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis dataKey="name" type="category" width={yWidth}
          tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false}
          tickFormatter={v => truncLabel(v, Math.floor(yWidth / 7.5))} />
        <Tooltip {...TS}
          formatter={(value, name, props) => {
            const d = props.payload as DataItem;
            const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(0) : '?';
            if (d._others?.length) {
              return [
                <span key="v">
                  <strong>{value}개</strong> ({pct}%)
                  <span style={{ display: 'block', marginTop: 4, fontSize: 9, color: '#94a3b8', maxWidth: 200, lineHeight: 1.5 }}>
                    {d._others.map(o => `${o.name}(${o.value})`).join(' · ')}
                  </span>
                </span>,
                String(d.name),
              ];
            }
            return [`${value}개 (${pct}%)`, d.name];
          }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} cursor="pointer"
          onClick={(d: any) => { if (!d._others?.length) onClick?.(d.name); }}>
          {items.map((entry, i) => {
            const isOthersBar = !!(entry as DataItem)._others?.length;
            const dimmed = !isOthersBar && activeItem && entry.name !== activeItem;
            return (
              <Cell key={i}
                fill={isOthersBar ? '#94a3b8' : (dimmed ? DIM_COLOR : CHART_COLORS[i % CHART_COLORS.length])}
                opacity={dimmed ? 0.35 : isOthersBar ? 0.65 : 1}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function OverviewCharts({
  charts, fullCharts,
  activeSector, activeRegion, activeRound, activeStatus, activeType, activeYear,
  onSectorClick, onRegionClick, onRoundClick, onStatusClick, onTypeClick, onYearClick,
  onClearAll,
}: Props) {
  const { vintageDist, roundDist, statusDist, typeDist } = charts;

  // Sector/Region: use full data when filter active (cross-filter context)
  const sectorData = (activeSector && fullCharts?.sectorDist) ? fullCharts.sectorDist : charts.sectorDist;
  const regionData = (activeRegion && fullCharts?.regionDist) ? fullCharts.regionDist : charts.regionDist;

  // Round/Status/Type pies: use full data when filter active
  const roundData  = (activeRound  && fullCharts?.roundDist)  ? fullCharts.roundDist  : roundDist;
  const statusData = (activeStatus && fullCharts?.statusDist) ? fullCharts.statusDist : statusDist;
  const typeData   = (activeType   && fullCharts?.typeDist)   ? fullCharts.typeDist   : typeDist;

  // Vintage: use full when activeYear set, show context
  const vintageData = (activeYear && fullCharts?.vintageDist) ? fullCharts.vintageDist : vintageDist;

  const roundGrouped  = groupByThreshold(roundData, 0.04, 8);
  const statusGrouped = groupByThreshold(statusData, 0.04, 6);
  const typeGrouped   = groupByThreshold(typeData, 0.04, 6);

  const hasAnyFilter = !!(activeSector || activeRegion || activeRound || activeStatus || activeType || activeYear);

  return (
    <div className="space-y-2">
      {/* Clear all button */}
      {hasAnyFilter && onClearAll && (
        <div className="flex justify-end">
          <button onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 px-2.5 py-1 rounded-full transition-colors">
            ✕ 필터 초기화 (전체 보기)
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">

        {/* 섹터 분포 */}
        <ChartCard title={`섹터 분포${activeSector ? ` · ${activeSector}` : ''}`} active={!!activeSector}>
          <BarSection data={sectorData} activeItem={activeSector}
            onClick={onSectorClick} yWidth={118} maxItems={12} threshold={0.03} />
        </ChartCard>

        {/* 지역 분포 */}
        <ChartCard title={`지역 분포${activeRegion ? ` · ${activeRegion}` : ''}`} active={!!activeRegion}>
          <BarSection data={regionData} activeItem={activeRegion}
            onClick={onRegionClick} yWidth={100} maxItems={10} threshold={0.03} />
        </ChartCard>

        {/* 빈티지 */}
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
                    <Cell key={i}
                      fill={dimmed ? DIM_COLOR : '#38bdf8'}
                      opacity={dimmed ? 0.3 : 1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 라운드 분포 */}
        <ChartCard title={`투자 라운드${activeRound ? ` · ${activeRound}` : ' 분포'}`} active={!!activeRound}>
          <SmartPie items={roundGrouped.items} total={roundGrouped.total}
            onSliceClick={onRoundClick} activeItem={activeRound} />
        </ChartCard>

        {/* 현재 상태 */}
        <ChartCard title={`포트폴리오 상태${activeStatus ? ` · ${activeStatus}` : ''}`} active={!!activeStatus}>
          <SmartPie
            items={statusGrouped.items} total={statusGrouped.total}
            colors={statusGrouped.items.map(d => STATUS_COLORS[d.name] ?? '#71717a')}
            onSliceClick={onStatusClick} activeItem={activeStatus}
          />
        </ChartCard>

        {/* 투자 유형 */}
        <ChartCard title={`투자 유형${activeType ? ` · ${activeType}` : ''}`} active={!!activeType}>
          <SmartPie items={typeGrouped.items} total={typeGrouped.total}
            colors={TYPE_COLORS} onSliceClick={onTypeClick} activeItem={activeType} />
        </ChartCard>

      </div>
    </div>
  );
}
