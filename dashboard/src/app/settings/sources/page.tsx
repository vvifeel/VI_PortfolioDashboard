'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ToggleLeft, ToggleRight, Rss, Globe, Bot, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Source {
  id: number;
  name: string;
  type: string;
  config: string;
  active: number;
  frequency: string;
  cost_type: string;
  description?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = { rss: Rss, mcp: Bot, scrape: Globe, search: Search };
const TYPE_COLORS: Record<string, string> = {
  rss:    'text-orange-500 bg-orange-50 dark:text-orange-400 dark:bg-orange-400/10',
  mcp:    'text-violet-500 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10',
  scrape: 'text-blue-500 bg-blue-50 dark:text-blue-400 dark:bg-blue-400/10',
  search: 'text-emerald-500 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10',
};
const FREQ_BADGE: Record<string, string> = {
  realtime: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10',
  daily:    'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10',
  weekly:   'text-slate-500 bg-slate-100 dark:text-zinc-400 dark:bg-zinc-400/10',
};

const BLANK: Omit<Source, 'id'> = {
  name: '', type: 'rss', config: '{}', active: 1,
  frequency: 'daily', cost_type: 'free', description: ''
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Source, 'id'>>(BLANK);

  const load = async () => {
    const r = await fetch('/api/sources');
    setSources(await r.json());
  };

  useEffect(() => { load(); }, []);

  const toggle = async (s: Source) => {
    await fetch('/api/sources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, active: s.active ? 0 : 1 })
    });
    load();
  };

  const del = async (id: number) => {
    if (!confirm('이 소스를 삭제할까요?')) return;
    await fetch(`/api/sources?id=${id}`, { method: 'DELETE' });
    load();
  };

  const save = async () => {
    if (!form.name || !form.type) return;
    if (editing !== null) {
      await fetch('/api/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing, ...form })
      });
      setEditing(null);
    } else {
      await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setAdding(false);
    }
    setForm(BLANK);
    load();
  };

  const startEdit = (s: Source) => {
    setEditing(s.id);
    setAdding(false);
    setForm({ name: s.name, type: s.type, config: s.config, active: s.active, frequency: s.frequency, cost_type: s.cost_type, description: s.description ?? '' });
  };

  const inputCls = "w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:border-sky-500/50";

  const FormRow = ({ target }: { target: 'edit' | 'add' }) => (
    <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 dark:text-zinc-500 mb-1 block">소스 이름 *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls} placeholder="예: Google News RSS" />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-zinc-500 mb-1 block">타입 *</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className={inputCls}>
            <option value="rss">RSS 피드</option>
            <option value="mcp">MCP 도구</option>
            <option value="scrape">웹 스크래핑</option>
            <option value="search">웹 검색</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-zinc-500 mb-1 block">수집 주기</label>
          <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
            className={inputCls}>
            <option value="realtime">수시 (30분)</option>
            <option value="daily">일 1회</option>
            <option value="weekly">주 1회</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-zinc-500 mb-1 block">비용</label>
          <select value={form.cost_type} onChange={e => setForm(f => ({ ...f, cost_type: e.target.value }))}
            className={inputCls}>
            <option value="free">무료</option>
            <option value="subscription">구독 필요</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 dark:text-zinc-500 mb-1 block">Config (JSON)</label>
        <textarea value={form.config} onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
          rows={2} className={cn(inputCls, 'font-mono text-slate-500 dark:text-zinc-400')} placeholder='{"url": "https://..."} 또는 {"url_template": "https://...?q={company}"}' />
      </div>
      <div>
        <label className="text-xs text-slate-500 dark:text-zinc-500 mb-1 block">설명</label>
        <input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className={inputCls} placeholder="소스 설명" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded-lg text-sm hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors">
          <Check size={13} /> 저장
        </button>
        <button onClick={() => { setEditing(null); setAdding(false); setForm(BLANK); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm hover:border-slate-300 dark:hover:border-zinc-600 transition-colors">
          <X size={13} /> 취소
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">모니터링 소스 관리</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">변경사항은 다음 Agent 실행 주기부터 반영됩니다</p>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); setForm(BLANK); }}
          className="flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded-lg text-sm hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors">
          <Plus size={14} /> 소스 추가
        </button>
      </div>

      {adding && <FormRow target="add" />}

      <div className="space-y-2">
        {sources.map(s => {
          const Icon = TYPE_ICONS[s.type] ?? Globe;
          return (
            <div key={s.id}>
              {editing === s.id ? (
                <FormRow target="edit" />
              ) : (
                <div className={cn(
                  'bg-white dark:bg-zinc-900 border rounded-xl p-4 flex items-center gap-4 transition-colors shadow-sm',
                  s.active ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800/40 opacity-50'
                )}>
                  <div className={cn('p-2 rounded-lg shrink-0', TYPE_COLORS[s.type] ?? 'text-slate-400 bg-slate-100 dark:text-zinc-400 dark:bg-zinc-400/10')}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{s.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', FREQ_BADGE[s.frequency] ?? 'text-slate-400 bg-slate-100 dark:text-zinc-400 dark:bg-zinc-400/10')}>
                        {s.frequency === 'realtime' ? '수시' : s.frequency === 'daily' ? '일1회' : '주1회'}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', s.cost_type === 'free' ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10' : 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10')}>
                        {s.cost_type === 'free' ? '무료' : '구독'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-600 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">{s.type}</span>
                    </div>
                    {s.description && <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">{s.description}</div>}
                    <div className="text-xs text-slate-300 dark:text-zinc-700 font-mono mt-0.5 truncate max-w-md">{s.config}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggle(s)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
                      {s.active ? <ToggleRight size={18} className="text-sky-500 dark:text-sky-400" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => startEdit(s)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => del(s.id)} className="text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
