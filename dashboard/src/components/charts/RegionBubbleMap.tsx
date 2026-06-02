'use client';
import { useMemo } from 'react';
import { ResponsiveGeoMap } from '@nivo/geo';
import type React from 'react';

// @nivo/geo type declarations omit `layers` even though the runtime supports it
type GeoMapAny = React.ComponentType<React.ComponentProps<typeof ResponsiveGeoMap> & { layers?: unknown[] }>; // eslint-disable-line @typescript-eslint/no-explicit-any
const GeoMap = ResponsiveGeoMap as GeoMapAny;
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import { CHART_COLORS } from '@/lib/utils';

// [longitude, latitude] centroids for common VC portfolio countries
const CENTROIDS: Record<string, [number, number]> = {
  // Korean names
  '미국': [-95.71, 37.09], '한국': [127.77, 35.91], '이스라엘': [34.85, 31.05],
  '영국': [-3.44, 55.38], '중국': [104.19, 35.86], '일본': [138.25, 36.20],
  '인도': [78.96, 20.59], '싱가포르': [103.82, 1.35], '독일': [10.45, 51.17],
  '프랑스': [2.21, 46.23], '캐나다': [-106.35, 56.13], '호주': [133.78, -25.27],
  '브라질': [-51.93, -14.24], '스웨덴': [18.64, 60.13], '네덜란드': [5.29, 52.13],
  '스위스': [8.23, 46.82], '대만': [120.96, 23.70], '홍콩': [114.18, 22.32],
  '아랍에미리트': [53.85, 23.42], '터키': [35.24, 38.96], '스페인': [-3.75, 40.46],
  '이탈리아': [12.57, 41.87], '인도네시아': [113.92, -0.79], '베트남': [108.28, 14.06],
  '태국': [100.99, 15.87], '말레이시아': [109.69, 4.21], '멕시코': [-102.55, 23.63],
  '남아프리카': [25.08, -29.00], '핀란드': [25.72, 61.92], '덴마크': [9.50, 56.26],
  '폴란드': [19.15, 51.92], '뉴질랜드': [172.36, -40.90], '칠레': [-71.54, -35.68],
  // English names
  'USA': [-95.71, 37.09], 'US': [-95.71, 37.09], 'United States': [-95.71, 37.09],
  'Korea': [127.77, 35.91], 'South Korea': [127.77, 35.91],
  'Israel': [34.85, 31.05], 'UK': [-3.44, 55.38], 'United Kingdom': [-3.44, 55.38],
  'China': [104.19, 35.86], 'Japan': [138.25, 36.20], 'India': [78.96, 20.59],
  'Singapore': [103.82, 1.35], 'Germany': [10.45, 51.17], 'France': [2.21, 46.23],
  'Sweden': [18.64, 60.13], 'Netherlands': [5.29, 52.13], 'Switzerland': [8.23, 46.82],
  'Canada': [-106.35, 56.13], 'Brazil': [-51.93, -14.24], 'Australia': [133.78, -25.27],
  'Taiwan': [120.96, 23.70], 'Hong Kong': [114.18, 22.32],
  'UAE': [53.85, 23.42], 'Turkey': [35.24, 38.96],
};

interface Props {
  data: Array<{ name: string; value: number }>;
  activeItem?: string;
  onClick?: (name: string) => void;
  height?: number;
}

const worldFeatures = feature(worldTopo, worldTopo.objects.countries).features;

export default function RegionBubbleMap({ data, activeItem, onClick, height = 220 }: Props) {
  const maxValue = Math.max(1, ...data.map(d => d.value));

  // colorMap stable across renders based on sorted order
  const colorMap = useMemo(
    () => Object.fromEntries([...data].sort((a, b) => b.value - a.value).map((d, i) => [d.name, CHART_COLORS[i % CHART_COLORS.length]])),
    [data],
  );

  // Build custom bubble layer as a render function (closure captures latest props)
  const bubbleLayer = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ projection }: { projection: (c: [number, number]) => [number, number] | null }) => (
      <g>
        {data.map(d => {
          const centroid = CENTROIDS[d.name];
          if (!centroid) return null;
          const pt = projection(centroid);
          if (!pt) return null;
          const [x, y] = pt;
          const r = Math.max(7, (d.value / maxValue) * 28 + 4);
          const dimmed = !!(activeItem && d.name !== activeItem);
          const color = colorMap[d.name] ?? '#94a3b8';
          return (
            <g key={d.name} onClick={() => onClick?.(d.name)} style={{ cursor: 'pointer' }}>
              <title>{d.name}: {d.value}개</title>
              <circle cx={x} cy={y} r={r}
                fill={dimmed ? '#cbd5e1' : color}
                opacity={dimmed ? 0.3 : 0.82}
                stroke="#fff" strokeWidth={1.5}
              />
              {r >= 12 && (
                <text x={x} y={y + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(10, r * 0.62)} fill="#fff" fontWeight={700}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  }, [data, activeItem, onClick, maxValue, colorMap]);

  // Legend (countries with no centroid are listed below map)
  const missing = data.filter(d => !CENTROIDS[d.name]);

  return (
    <div>
      <div style={{ height }}>
        <GeoMap
          features={worldFeatures as any} // eslint-disable-line @typescript-eslint/no-explicit-any
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          projectionType="naturalEarth1"
          projectionScale={145}
          projectionTranslation={[0.5, 0.56]}
          projectionRotation={[0, 0, 0]}
          fillColor="#e8edf2"
          borderWidth={0.4}
          borderColor="#c8d3db"
          enableGraticule={false}
          layers={['features', bubbleLayer]}
          isInteractive={false}
        />
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-center px-1 mt-1">
        {[...data].sort((a, b) => b.value - a.value).map(d => {
          const dimmed = !!(activeItem && d.name !== activeItem);
          return (
            <button key={d.name}
              onClick={() => onClick?.(d.name)}
              className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 transition-colors"
              style={{ opacity: dimmed ? 0.35 : 1 }}>
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ background: colorMap[d.name] ?? '#94a3b8' }} />
              {d.name}
              <span className="text-slate-400 dark:text-zinc-600">{d.value}</span>
            </button>
          );
        })}
        {missing.length > 0 && (
          <span className="text-[9px] text-slate-300 dark:text-zinc-700">
            ({missing.map(d => `${d.name} ${d.value}`).join(', ')} — 지도 미표시)
          </span>
        )}
      </div>
    </div>
  );
}
