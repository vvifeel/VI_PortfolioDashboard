'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { getUrgencyDot, getUrgencyLabel, getUrgencyStyle, parseTags, TAG_STYLES, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface NewsItem {
  id: number;
  company_name: string;
  title?: string;
  one_line_summary?: string;
  source?: string;
  source_url?: string;
  published_at?: string;
  collected_at?: string;
  urgency_level: number;
  tags: string;
}

const ALL_TAGS = ['funding', 'ipo', 'acquisition', 'leadership', 'product', 'regulatory', 'competition', 'partnership', 'financial'];
const URGENCY_LEVELS = [5, 4, 3, 2, 1];

export default function NewsPage() {
  const [data, setData] = useState<{ data: NewsItem[]; total: number } | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<number[]>([]);
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '40' });
    if (urgencyFilter.length) params.set('urgency', urgencyFilter.join(','));
    if (tagFilter) params.set('tag', tagFilter);
    const res = await fetch(`/api/news?${params}`);
    setData(await res.json());
    setLoading(false);
  }, [urgencyFilter, tagFilter, page]);

  useEffect(() => { setPage(1); }, [urgencyFilter, tagFilter]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const toggleUrgency = (level: number) => {
    setUrgencyFilter(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const urgencyLabels: Record<number, string> = { 5: '🔴 Critical', 4: '🟠 Urgent', 3: '🟡 Important', 2: '🟢 Notable', 1: '🔵 Info' };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">뉴스 피드</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {data ? `총 ${data.total.toLocaleString()}건` : '로딩 중...'}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {URGENCY_LEVELS.map(level => (
            <button key={level}
              onClick={() => toggleUrgency(level)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                urgencyFilter.includes(level)
                  ? getUrgencyStyle(level)
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              )}>
              {urgencyLabels[level]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTagFilter('')}
            className={cn('px-2.5 py-1 rounded text-[11px] font-medium border transition-colors',
              !tagFilter ? 'bg-zinc-700 text-zinc-200 border-zinc-600' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700')}>
            전체 태그
          </button>
          {ALL_TAGS.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              className={cn('px-2.5 py-1 rounded text-[11px] font-medium border transition-colors',
                tagFilter === tag
                  ? (TAG_STYLES[tag] ?? 'bg-zinc-700 text-zinc-200 border-zinc-600')
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700')}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* News List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">로딩 중...</div>
      ) : data?.data.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-zinc-500 text-sm">수집된 뉴스가 없습니다</div>
          <div className="text-zinc-600 text-xs mt-2">Agent를 실행하면 뉴스가 자동으로 수집됩니다</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data.map(item => {
            const tags = parseTags(item.tags);
            return (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                <div className="flex gap-3">
                  <span className="text-base mt-0.5 shrink-0">{getUrgencyDot(item.urgency_level)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Link href={`/portfolio/${encodeURIComponent(item.company_name)}`}
                        className="text-sm font-medium text-sky-400 hover:underline">
                        {item.company_name}
                      </Link>
                      <Badge className={cn('text-[10px]', getUrgencyStyle(item.urgency_level))}>
                        {getUrgencyLabel(item.urgency_level)}
                      </Badge>
                      {item.source && <span className="text-xs text-zinc-500">{item.source}</span>}
                      {item.published_at && (
                        <span className="text-xs text-zinc-600 ml-auto">
                          {new Date(item.published_at).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-zinc-200">{item.one_line_summary || item.title}</div>
                    {item.title && item.one_line_summary && item.title !== item.one_line_summary && (
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{item.title}</div>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {tags.map(tag => (
                        <span key={tag}
                          onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                          className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:opacity-80', TAG_STYLES[tag] ?? 'bg-zinc-700/50 text-zinc-400 border-zinc-700')}>
                          {tag}
                        </span>
                      ))}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                          className="ml-auto text-xs text-sky-500/50 hover:text-sky-400 inline-flex items-center gap-1">
                          원문 <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {data && data.data.length < data.total && (
        <button onClick={() => setPage(p => p + 1)}
          className="w-full py-2.5 text-sm text-zinc-400 border border-zinc-800 rounded-lg hover:border-zinc-700 hover:text-zinc-200 transition-colors">
          더 보기 ({data.total - data.data.length}건 남음)
        </button>
      )}
    </div>
  );
}
