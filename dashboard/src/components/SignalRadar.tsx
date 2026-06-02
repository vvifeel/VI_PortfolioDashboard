'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Radio, RefreshCw } from 'lucide-react';
import { getUrgencyDot, parseTags, TAG_STYLES, cn } from '@/lib/utils';

interface FeedItem {
  key: string;
  type: 'news' | 'update';
  company_name: string;
  urgency: number;
  summary: string;
  tags: string[];
  time: string;
  source?: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return `${Math.floor(d / 7)}주 전`;
}

export default function SignalRadar() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [newsRes, actRes] = await Promise.all([
        fetch('/api/news?limit=20'),
        fetch('/api/activity?limit=10&days=14'),
      ]);
      const [newsJson, actJson] = await Promise.all([newsRes.json(), actRes.json()]);

      const newsItems: FeedItem[] = (newsJson.data ?? []).map((n: any, i: number) => ({
        key: `news-${n.id ?? i}`,
        type: 'news',
        company_name: n.company_name,
        urgency: n.urgency_level ?? 1,
        summary: n.one_line_summary || n.title || '',
        tags: parseTags(n.tags ?? '[]'),
        time: n.published_at || n.collected_at || '',
        source: n.source,
      }));

      const updateItems: FeedItem[] = (actJson.updates ?? []).map((u: any, i: number) => ({
        key: `update-${i}`,
        type: 'update',
        company_name: u.company_name,
        urgency: 1,
        summary: u.reason || '',
        tags: (() => { try { return JSON.parse(u.fields_updated ?? '[]'); } catch { return []; } })(),
        time: u.updated_at || '',
        source: u.source,
      }));

      const all = [...newsItems, ...updateItems]
        .filter(x => x.time)
        .sort((a, b) => {
          if (a.urgency !== b.urgency) return b.urgency - a.urgency;
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        });

      setItems(all.slice(0, 20));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, lastRefresh]);

  const urgencyBorder: Record<number, string> = {
    5: 'border-l-red-500',
    4: 'border-l-orange-400',
    3: 'border-l-yellow-400',
    2: 'border-l-emerald-400',
    1: 'border-l-transparent',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-sky-500" />
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">시그널 레이더</span>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
        </div>
        <button
          onClick={() => setLastRefresh(Date.now())}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          title="새로고침"
        >
          <RefreshCw size={12} className={cn('text-slate-400 dark:text-zinc-600', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
        {loading && items.length === 0 && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-zinc-800/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-6 text-center">
            <div className="text-sm text-slate-400 dark:text-zinc-600">수집된 시그널 없음</div>
            <div className="text-xs text-slate-300 dark:text-zinc-700 mt-1">Agent 실행 후 업데이트됩니다</div>
          </div>
        )}

        {items.map(item => (
          <div key={item.key}
            className={cn(
              'px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors border-l-2',
              urgencyBorder[item.urgency] ?? 'border-l-transparent'
            )}>
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5 shrink-0">{getUrgencyDot(item.urgency)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <Link href={`/portfolio/${encodeURIComponent(item.company_name)}`}
                    className="text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                    {item.company_name}
                  </Link>
                  {item.type === 'update' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                      프로파일 업데이트
                    </span>
                  )}
                </div>

                {item.summary && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                    {item.summary}
                  </p>
                )}

                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {item.tags.slice(0, 3).map(tag => (
                    <span key={tag} className={cn(
                      'text-[9px] px-1 py-0.5 rounded border font-medium',
                      TAG_STYLES[tag] ?? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700'
                    )}>
                      {tag}
                    </span>
                  ))}
                  {item.time && (
                    <span className="text-[9px] text-slate-300 dark:text-zinc-700 ml-auto shrink-0">
                      {relTime(item.time)}
                    </span>
                  )}
                </div>

                {item.source && (
                  <div className="text-[9px] text-slate-300 dark:text-zinc-700 mt-0.5">{item.source}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-zinc-800 shrink-0">
        <Link href="/news"
          className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline w-full text-center block">
          전체 뉴스 피드 보기 →
        </Link>
      </div>
    </div>
  );
}
