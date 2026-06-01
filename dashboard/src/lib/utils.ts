export const CHART_COLORS = [
  '#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#fb923c', '#4ade80', '#60a5fa', '#e879f9', '#2dd4bf',
  '#facc15', '#f472b6', '#818cf8', '#86efac', '#fca5a5',
  '#67e8f9', '#c4b5fd', '#fdba74',
];

export function getStatusStyle(status: string = ''): string {
  if (status === 'Alive') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if (status.includes('IPO')) return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
  if (status.includes('Acquired') || status.includes('Subsidiary')) return 'text-violet-400 bg-violet-400/10 border-violet-400/20';
  if (status.includes('Dead') || status.includes('Wound')) return 'text-red-400 bg-red-400/10 border-red-400/20';
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
}

export function getUrgencyStyle(level: number): string {
  const styles: Record<number, string> = {
    5: 'text-red-400 bg-red-400/10 border-red-400/30',
    4: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    3: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    2: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    1: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  };
  return styles[level] ?? styles[1];
}

export function getUrgencyDot(level: number): string {
  const dots: Record<number, string> = { 5: '🔴', 4: '🟠', 3: '🟡', 2: '🟢', 1: '🔵' };
  return dots[level] ?? '⚪';
}

export function getUrgencyLabel(level: number): string {
  const labels: Record<number, string> = { 5: 'Critical', 4: 'Urgent', 3: 'Important', 2: 'Notable', 1: 'Info' };
  return labels[level] ?? 'Info';
}

export const TAG_STYLES: Record<string, string> = {
  funding:     'bg-sky-400/10 text-sky-300 border-sky-400/20',
  ipo:         'bg-violet-400/10 text-violet-300 border-violet-400/20',
  acquisition: 'bg-pink-400/10 text-pink-300 border-pink-400/20',
  leadership:  'bg-amber-400/10 text-amber-300 border-amber-400/20',
  product:     'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  regulatory:  'bg-red-400/10 text-red-300 border-red-400/20',
  competition: 'bg-orange-400/10 text-orange-300 border-orange-400/20',
  partnership: 'bg-teal-400/10 text-teal-300 border-teal-400/20',
  financial:   'bg-indigo-400/10 text-indigo-300 border-indigo-400/20',
};

export function parseTags(tagsJson: string): string[] {
  try { return JSON.parse(tagsJson) ?? []; }
  catch { return []; }
}

export function formatM(val?: number | null): string {
  if (val == null) return '—';
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  return `$${val.toFixed(1)}M`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
