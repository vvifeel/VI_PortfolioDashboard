'use client';
import { useMemo } from 'react';
import { ResponsiveTreeMapHtml } from '@nivo/treemap';
import { CHART_COLORS } from '@/lib/utils';

interface Props {
  data: Array<{ name: string; value: number }>;
  activeItem?: string;
  onClick?: (name: string) => void;
  height?: number;
}

export default function SectorTreemap({ data, activeItem, onClick, height = 220 }: Props) {
  const colorMap = useMemo(
    () => Object.fromEntries(data.map((d, i) => [d.name, CHART_COLORS[i % CHART_COLORS.length]])),
    [data],
  );

  const treeData = useMemo(() => ({
    id: 'root',
    children: data.map(d => ({ id: d.name, value: d.value })),
  }), [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-300 dark:text-zinc-700" style={{ height }}>
        데이터 없음
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveTreeMapHtml
        data={treeData}
        identity="id"
        value="value"
        innerPadding={3}
        outerPadding={2}
        tile="squarify"
        enableParentLabel={false}
        labelSkipSize={24}
        label={node => `${node.id} (${node.value})`}
        colors={node => {
          const id = String(node.id);
          if (activeItem && id !== activeItem) return '#e2e8f0';
          return colorMap[id] ?? '#94a3b8';
        }}
        nodeOpacity={activeItem ? 0.9 : 1}
        borderWidth={2}
        borderColor="#ffffff"
        onClick={node => onClick?.(String(node.id))}
        theme={{
          labels: {
            text: {
              fontSize: 10,
              fontWeight: 600,
              fill: '#ffffff',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            },
          },
          tooltip: {
            container: {
              background: '#fff',
              fontSize: 11,
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
              border: '1px solid #e2e8f0',
            },
          },
        }}
        tooltip={({ node }) => (
          <div style={{ padding: '6px 10px' }}>
            <strong style={{ color: colorMap[String(node.id)] ?? '#94a3b8' }}>{node.id}</strong>
            <span style={{ color: '#64748b', marginLeft: 6 }}>{node.value}개</span>
            <span style={{ color: '#94a3b8', marginLeft: 4, fontSize: 10 }}>
              ({((node.value / data.reduce((s, d) => s + d.value, 0)) * 100).toFixed(0)}%)
            </span>
          </div>
        )}
      />
    </div>
  );
}
