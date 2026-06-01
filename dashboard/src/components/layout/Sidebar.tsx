'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Newspaper, Rss, Upload, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  { href: '/overview',  label: '대시보드',   icon: LayoutDashboard },
  { href: '/portfolio', label: '포트폴리오',  icon: Building2 },
  { href: '/news',      label: '뉴스 피드',   icon: Newspaper },
];
const SETTINGS_NAV = [
  { href: '/settings/sources', label: '모니터링 소스', icon: Rss },
  { href: '/settings/import',  label: '데이터 Import', icon: Upload },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-slate-200 dark:border-zinc-800">
        <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100 tracking-tight">VI Portfolio</div>
        <div className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Intelligence Dashboard</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              path === href || (href !== '/overview' && path.startsWith(href))
                ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
            )}>
            <Icon size={15} />
            <span>{label}</span>
            {(path === href || path.startsWith(href + '/')) && href !== '/overview' && (
              <ChevronRight size={12} className="ml-auto opacity-50" />
            )}
          </Link>
        ))}

        <div className="pt-4 pb-1 px-3">
          <span className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider font-medium">설정</span>
        </div>
        {SETTINGS_NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              path.startsWith(href)
                ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
            )}>
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-zinc-600">PoC Demo</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
