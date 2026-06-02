'use client';
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Sector,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';
import type { ChartData } from '@/lib/types';

interface Props {
  charts: ChartData;
  onSectorClick?: (sector: string) => void;
  onRegionClick?: (region: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  'Alive': '#34d399',
  'IPO': '#38bdf8',
  'Acquired': '#a78bfa',
  'Dead/Closed': '#f87171',
  'Other': '#71717a',
};
const TYPE_COLORS = ['#38bdf8', '#fbbf24'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-medium text-slate-600 dark:text-zinc-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
  },
  cursor: { fill: 'rgba(0,0,0,0.04)' },
};

const darkTooltipStyle = {
  contentStyle: {
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e4e4e7',
  },
};

// Group small items into 기타
function groupOthers<T extends { name: string; value: number }>(
  data: T[],
  maxItems = 7
): { main: Array<T | { name: string; value: number; others: T[] }>; hasOthers: boolean } {
  if (data.length <= maxItems) return { main: data, hasOthers: false };
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const main = sorted.slice(0, maxItems) as Array<T | { name: string; value: number; others: T[] }>;
  const othersArr = sorted.slice(maxItems);
  const othersTotal = othersArr.reduce((s, d) => s + d.value, 0);
  if (othersTotal > 0) {
    main.push({ name: `기타 (${othersArr.length}개)`, value: othersTotal, others: othersArr });
  }
  return { main, hasOthers: true };
}

function truncLabel(name: string, max = 14) {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

// Custom active shape for pie hover
function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 4}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={fill} className="text-xs" fontSize={11} fontWeight={600}>
        {truncLabel(payload.name, 12)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {value}개
      </text>
    </g>
  );
}

// Pie chart with 기타 expansion
function SmartPie({
  data,
  colors,
  maxItems = 7,
  onSliceClick,
}: {
  data: Array<{ name: string; value: number }>;
  colors?: string[];
  maxItems?: number;
  onSliceClick?: (name: string) => void;
}) {
  const [othersExpanded, setOthersExpanded] = useState(false);

  const { main } = groupOthers(data, maxItems);
  const displayData = othersExpanded ? data : main;

  const getColor = (name: string, i: number) => {
    if (colors) return colors[i % colors.length];
    return CHART_COLORS[i % CHART_COLORS.length];
  };

  const isOthers = (item: any) => item.others && item.others.length > 0;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={displayData}
            cx="50%" cy="50%"
            innerRadius={52} outerRadius={82}
            dataKey="value" nameKey="name"
            paddingAngle={2}
            activeShape={ActiveShape}
            onClick={(entry: any) => {
              if (isOthers(entry)) {
                setOthersExpanded(e => !e);
              } else {
                onSliceClick?.(entry.name);
              }
            }}
          >
            {displayData.map((entry: any, i) => (
              <Cell
                key={`cell-${i}`}
                fill={getColor(entry.name, i)}
                opacity={isOthers(entry) ? 0.6 : 1}
                cursor={isOthers(entry) ? 'zoom-in' : onSliceClick ? 'pointer' : 'default'}
              />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle}
            formatter={(value, name, props) => {
              const entry = props.payload;
              if (entry?.others?.length > 0) {
                return [
                  <span key="v">
                    {value}개<br />
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>
                      클릭하면 {othersExpanded ? '묶기' : '펼치기'}
                    </span>
                    {!othersExpanded && (
                      <span style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
                        {entry.others.map((o: any) => `${o.name} (${o.value})`).join(', ')}
                      </span>
                    )}
                  </span>,
                  String(name)
                ];
              }
              return [value + '개', String(name)];
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1 px-2">
        {displayData.map((entry: any, i) => (
          <button
            key={entry.name}
            onClick={() => {
              if (isOthers(entry)) setOthersExpanded(e => !e);
              else onSliceClick?.(entry.name);
            }}
            className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getColor(entry.name, i) }} />
            {truncLabel(entry.name, 16)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OverviewCharts({ charts, onSectorClick, onRegionClick }: Props) {
  const { sectorDist, regionDist, vintageDist, roundDist, statusDist, typeDist } = charts;

  const barTickFormatter = (name: string) => truncLabel(name, 13);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      {/* 섹터 분포 */}
      <ChartCard title="섹터 분포">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={sectorDist.slice(0, 12)}
            layout="vertical"
            margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              width={100}
              tickFormatter={barTickFormatter}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v, _n, props) => [v + '개', props.payload.name]}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} cursor="pointer"
              onClick={(data) => onSectorClick?.(data.name as string)}>
              {sectorDist.slice(0, 12).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 지역 분포 */}
      <ChartCard title="지역 분포">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={regionDist.slice(0, 10)}
            layout="vertical"
            margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false} tickLine={false}
              width={80}
              tickFormatter={barTickFormatter}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v, _n, props) => [v + '개', props.payload.name]}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} cursor="pointer"
              onClick={(data) => onRegionClick?.(data.name as string)}>
              {regionDist.slice(0, 10).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 빈티지 */}
      <ChartCard title="투자 빈티지 (연도별)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={vintageDist} margin={{ left: -16, right: 8, top: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, '투자 건수']} />
            <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 라운드 분포 */}
      <ChartCard title="투자 라운드 분포">
        <SmartPie data={roundDist} maxItems={7} />
      </ChartCard>

      {/* 현재 상태 */}
      <ChartCard title="포트폴리오 현재 상태">
        <SmartPie
          data={statusDist}
          colors={statusDist.map(d => STATUS_COLORS[d.name] ?? '#71717a')}
          maxItems={6}
          onSliceClick={onSectorClick}
        />
      </ChartCard>

      {/* 투자 유형 */}
      <ChartCard title="투자 유형">
        <SmartPie data={typeDist} colors={TYPE_COLORS} maxItems={4} />
      </ChartCard>

    </div>
  );
}
