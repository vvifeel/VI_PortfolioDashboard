'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Newspaper, Settings, Rss,
  Upload, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="text-sm font-semibold text-zinc-100 tracking-tight">VI Portfolio</div>
        <div className="text-xs text-zinc-500 mt-0.5">Intelligence Dashboard</div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
              path === href || (href !== '/overview' && path.startsWith(href))
                ? 'bg-sky-500/10 text-sky-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            )}>
            <Icon size={15} />
            <span>{label}</span>
            {(path === href || path.startsWith(href + '/')) && href !== '/overview' && (
              <ChevronRight size={12} className="ml-auto opacity-50" />
            )}
          </Link>
        ))}

        <div className="pt-4 pb-1 px-3">
          <span className="text-xs text-zinc-600 uppercase tracking-wider font-medium">설정</span>
        </div>
        {SETTINGS_NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
              path.startsWith(href)
                ? 'bg-sky-500/10 text-sky-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            )}>
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-600">PoC v0.1</div>
      </div>
    </aside>
  );
}
