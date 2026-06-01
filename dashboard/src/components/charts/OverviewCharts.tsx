'use client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Legend
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';

interface ChartData {
  sectorDist: Array<{ name: string; value: number }>;
  regionDist: Array<{ name: string; value: number }>;
  vintageDist: Array<{ year: number; count: number }>;
  roundDist: Array<{ name: string; value: number }>;
  statusDist: Array<{ name: string; value: number }>;
  typeDist: Array<{ name: string; value: number }>;
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#e4e4e7', fontSize: '12px' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

export default function OverviewCharts({ charts }: { charts: ChartData }) {
  const { sectorDist, regionDist, vintageDist, roundDist, statusDist, typeDist } = charts;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      {/* 섹터 분포 */}
      <ChartCard title="섹터 분포 (Top 12)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sectorDist.slice(0, 12)} layout="vertical" margin={{ left: 4, right: 16 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={90} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {sectorDist.slice(0, 12).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 지역 분포 */}
      <ChartCard title="지역 분포 (Top 10)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={regionDist.slice(0, 10)} layout="vertical" margin={{ left: 4, right: 16 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={70} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {regionDist.slice(0, 10).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 빈티지 연도 */}
      <ChartCard title="투자 빈티지 (연도별)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={vintageDist} margin={{ left: -16, right: 8 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, '투자 건수']} />
            <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 라운드 분포 */}
      <ChartCard title="투자 라운드 분포">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={roundDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
              dataKey="value" nameKey="name" paddingAngle={2}>
              {roundDist.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend
              formatter={(v) => <span style={{ fontSize: 11, color: '#a1a1aa' }}>{v}</span>}
              iconSize={8} iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 현재 상태 */}
      <ChartCard title="포트폴리오 현재 상태">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
              dataKey="value" nameKey="name" paddingAngle={2}>
              {statusDist.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#71717a'} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend
              formatter={(v) => <span style={{ fontSize: 11, color: '#a1a1aa' }}>{v}</span>}
              iconSize={8} iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 투자 유형 */}
      <ChartCard title="투자 유형">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={typeDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
              dataKey="value" nameKey="name" paddingAngle={4}>
              {typeDist.map((_, i) => (
                <Cell key={i} fill={TYPE_COLORS[i % 2]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend
              formatter={(v) => <span style={{ fontSize: 11, color: '#a1a1aa' }}>{v}</span>}
              iconSize={8} iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
}
