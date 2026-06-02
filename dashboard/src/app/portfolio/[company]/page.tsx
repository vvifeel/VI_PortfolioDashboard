import Link from 'next/link';
import { ArrowLeft, ExternalLink, DollarSign, Percent, FileText, Link2, ChevronDown } from 'lucide-react';
import { getStatusStyle, getUrgencyDot, getUrgencyLabel, getUrgencyStyle, parseTags, TAG_STYLES, formatM, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { Company, Investment, NewsItem } from '@/lib/types';

async function getCompanyData(company: string) {
  const res = await fetch(`http://localhost:3000/api/portfolio/${encodeURIComponent(company)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
        <h2 className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{title}</h2>
        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-slate-400 dark:text-zinc-500 w-32 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-slate-700 dark:text-zinc-200 flex-1">{String(value)}</span>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
      {label}
    </span>
  );
}

function NewsCard({ item, dimmed }: { item: NewsItem; dimmed?: boolean }) {
  const tags = parseTags(item.tags);
  const urgency = item.urgency_level;
  const borderAccent = urgency >= 5 ? 'border-l-4 border-l-red-500'
    : urgency >= 4 ? 'border-l-4 border-l-orange-400'
    : urgency >= 3 ? 'border-l-4 border-l-yellow-400'
    : '';

  return (
    <div className={cn(
      'flex gap-3 p-3.5 rounded-xl transition-colors',
      dimmed
        ? 'bg-slate-50/60 dark:bg-zinc-800/20 opacity-60 hover:opacity-80'
        : urgency >= 4
          ? 'bg-orange-50/40 dark:bg-orange-500/5 border border-orange-200/60 dark:border-orange-500/20 hover:bg-orange-50 dark:hover:bg-orange-500/10'
          : 'bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100 dark:hover:bg-zinc-800/60',
      borderAccent
    )}>
      <span className={cn('text-base mt-0.5 shrink-0', dimmed && 'grayscale')}>{getUrgencyDot(urgency)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge className={cn('text-[10px]', getUrgencyStyle(urgency))}>{getUrgencyLabel(urgency)}</Badge>
          <span className="text-xs text-slate-500 dark:text-zinc-500">{item.source}</span>
          {item.published_at && (
            <span className="text-xs text-slate-400 dark:text-zinc-600 ml-auto">
              {new Date(item.published_at).toLocaleDateString('ko-KR')}
            </span>
          )}
        </div>
        <div className={cn('text-sm mt-0.5', dimmed ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-700 dark:text-zinc-200')}>
          {item.one_line_summary || item.title}
        </div>
        {item.title && item.one_line_summary && (
          <div className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{item.title}</div>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map(tag => (
            <span key={tag} className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
              TAG_STYLES[tag] ?? 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
            )}>
              {tag}
            </span>
          ))}
        </div>
        {item.source_url && (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-sky-600/60 dark:text-sky-500/60 hover:text-sky-600 dark:hover:text-sky-400 mt-1.5 inline-flex items-center gap-1">
            원문 보기 <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: companySlug } = await params;
  const companyName = decodeURIComponent(companySlug);
  const result = await getCompanyData(companyName);

  if (!result) {
    return (
      <div className="p-6">
        <div className="text-slate-500 dark:text-zinc-500">기업 정보를 찾을 수 없습니다: <strong>{companyName}</strong></div>
        <Link href="/portfolio" className="text-sky-600 dark:text-sky-400 text-sm mt-2 inline-flex items-center gap-1 hover:underline">
          <ArrowLeft size={12} /> 목록으로
        </Link>
      </div>
    );
  }

  const { company, investments, news }: { company: Company; investments: Investment[]; news: NewsItem[] } = result;

  const statusGroup = company.status?.includes('IPO') ? 'IPO'
    : company.status?.includes('Acquired') || company.status?.includes('Subsidiary') ? 'Acquired'
    : company.status?.includes('Dead') || company.status?.includes('Wound') ? 'Dead'
    : 'Alive';

  const competitors: string[] = (() => { try { return JSON.parse(company.competitors ?? '[]') ?? []; } catch { return []; } })();
  const technologies: string[] = (() => { try { return JSON.parse(company.technologies ?? '[]') ?? []; } catch { return []; } })();
  const keyExecs: Array<{ name: string; title: string; linkedin?: string }> = (() => {
    try { return JSON.parse(company.key_executives ?? '[]') ?? []; } catch { return []; }
  })();
  const boardMembers: Array<{ name: string; organization?: string }> = (() => {
    try { return JSON.parse(company.board_members ?? '[]') ?? []; } catch { return []; }
  })();
  const allInvestors: string[] = (() => { try { return JSON.parse(company.all_investors ?? '[]') ?? []; } catch { return []; } })();

  // Split news by urgency
  const urgentNews  = news.filter(n => n.urgency_level >= 4);  // prominent
  const normalNews  = news.filter(n => n.urgency_level === 3);
  const minorNews   = news.filter(n => n.urgency_level <= 2);

  const hasFinancialData = company.total_funding_external_m || company.latest_external_round ||
    company.revenue_range || company.arr_estimate || company.last_funding_date ||
    company.funding_rounds;
  const hasTeamData = company.ceo_name || company.cto_name || company.cfo_name ||
    company.cofounders || keyExecs.length > 0 || boardMembers.length > 0;
  const hasMarketData = company.market_size_estimate || company.market_position ||
    competitors.length > 0 || technologies.length > 0 || allInvestors.length > 0;
  const hasExitData = (statusGroup === 'IPO' && (company.ipo_date || company.ipo_ticker)) ||
    (statusGroup === 'Acquired' && (company.acquired_by || company.acquired_date));

  return (
    <div className="p-6 space-y-5 bg-slate-50 dark:bg-zinc-950 min-h-screen">
      {/* Back */}
      <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
        <ArrowLeft size={12} /> 포트폴리오 목록
      </Link>

      {/* Hero Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-4xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{company.company_name}</h1>
              {company.status && (
                <Badge className={getStatusStyle(company.status)}>
                  {company.status.length > 25 ? company.status.slice(0, 25) + '…' : company.status}
                </Badge>
              )}
              {company.monitoring_tier && (
                <Badge className={cn('text-xs border', {
                  1: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
                  2: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
                  3: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-700',
                }[company.monitoring_tier] ?? '')}>
                  Tier {company.monitoring_tier}
                </Badge>
              )}
            </div>
            {company.company_name_ko && (
              <div className="text-sm text-slate-500 dark:text-zinc-500 mt-1 mb-2">{company.company_name_ko}</div>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {company.sector && (
                <a href={`/portfolio?sector=${encodeURIComponent(company.sector)}`}
                  className="text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline bg-sky-50 dark:bg-sky-500/10 px-3 py-1 rounded-full">
                  {company.sector}
                </a>
              )}
              {company.sub_sector && (
                <span className="text-sm text-slate-400 dark:text-zinc-500">· {company.sub_sector}</span>
              )}
              {company.region && (
                <a href={`/portfolio?region=${encodeURIComponent(company.region)}`}
                  className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                  {company.region}{company.hq_city ? `, ${company.hq_city}` : ''}
                  {company.hq_country ? ` (${company.hq_country})` : ''}
                </a>
              )}
              {company.founded_year && (
                <span className="text-sm text-slate-400 dark:text-zinc-500">설립 {company.founded_year}</span>
              )}
              {company.business_stage && (
                <span className="text-xs px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                  {company.business_stage}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-2">
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:underline justify-end">
                <ExternalLink size={13} /> 웹사이트
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 justify-end">
                <Link2 size={13} /> LinkedIn
              </a>
            )}
            {company.crunchbase_url && (
              <a href={company.crunchbase_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 justify-end">
                <ExternalLink size={13} /> Crunchbase
              </a>
            )}
            {company.last_profile_update_at && (
              <div className="text-xs text-slate-400 dark:text-zinc-600 mt-2">
                프로파일 업데이트: {new Date(company.last_profile_update_at).toLocaleDateString('ko-KR')}
              </div>
            )}
          </div>
        </div>

        {/* Quick stats bar */}
        {(company.current_employee_count || company.total_funding_external_m || company.latest_external_round || company.market_position) && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-6 flex-wrap">
            {company.current_employee_count && (
              <div>
                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">직원 수</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {company.current_employee_count.toLocaleString()}명
                  {company.employee_growth_pct && (
                    <span className={cn('ml-1.5 text-xs', company.employee_growth_pct >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {company.employee_growth_pct >= 0 ? '+' : ''}{company.employee_growth_pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}
            {company.total_funding_external_m && (
              <div>
                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">총 펀딩</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{formatM(company.total_funding_external_m)}</div>
              </div>
            )}
            {company.latest_external_round && (
              <div>
                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">최신 라운드</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {company.latest_external_round}
                  {company.latest_external_valuation_m && (
                    <span className="ml-1.5 text-xs text-slate-500 dark:text-zinc-500">· {formatM(company.latest_external_valuation_m)}</span>
                  )}
                </div>
              </div>
            )}
            {company.market_position && (
              <div>
                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">시장 포지션</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{company.market_position}</div>
              </div>
            )}
            {company.revenue_range && (
              <div>
                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">추정 매출</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{company.revenue_range}</div>
              </div>
            )}
          </div>
        )}

        {company.description && (
          <p className="text-base text-slate-600 dark:text-zinc-300 mt-5 leading-relaxed max-w-3xl">{company.description}</p>
        )}

        {/* Signal summary */}
        {company.signal_summary && (
          <div className="mt-4 px-4 py-3 bg-sky-50 dark:bg-sky-500/5 border border-sky-200/60 dark:border-sky-500/20 rounded-xl">
            <div className="text-xs text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-1 font-medium">인텔리전스 시그널</div>
            <div className="text-sm text-slate-700 dark:text-zinc-300">{company.signal_summary}</div>
            {company.signal_keywords && (() => {
              const kws: string[] = (() => { try { return JSON.parse(company.signal_keywords ?? '[]'); } catch { return []; } })();
              return kws.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {kws.map(kw => (
                    <span key={kw} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border',
                      TAG_STYLES[kw] ?? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
                    )}>{kw}</span>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Investment Details */}
        <Section title={`투자 내역`} badge={`${investments.length}건`}>
          <div className="space-y-4">
            {investments.length === 0 && (
              <div className="text-xs text-slate-400 dark:text-zinc-600 py-4 text-center">투자 내역 없음</div>
            )}
            {investments.map((inv, i) => (
              <div key={inv.id} className={cn('', i > 0 && 'pt-4 border-t border-slate-100 dark:border-zinc-800')}>
                <div className="flex items-center gap-2 mb-2">
                  {inv.round && <Badge className="bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20">{inv.round}</Badge>}
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    {inv.investment_year}/{String(inv.investment_month ?? 1).padStart(2, '0')}
                  </span>
                  {inv.investment_type && (
                    <Badge className={inv.investment_type === '지분투자'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'}>
                      {inv.investment_type}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="flex items-center gap-1.5 py-1">
                    <DollarSign size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">투자금액</span>
                    <span className="text-sm text-slate-700 dark:text-zinc-200 ml-auto font-medium">{formatM(inv.investment_amount_m)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 py-1">
                    <Percent size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">지분율</span>
                    <span className="text-sm text-slate-700 dark:text-zinc-200 ml-auto">{inv.stake_pct ? `${inv.stake_pct.toFixed(2)}%` : '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 py-1">
                    <DollarSign size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">투자시 기업가치</span>
                    <span className="text-sm text-slate-700 dark:text-zinc-200 ml-auto">{formatM(inv.valuation_at_investment_m)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 py-1">
                    <DollarSign size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">현재 기업가치</span>
                    <span className="text-sm font-medium ml-auto" style={{ color: (inv.current_valuation_m ?? 0) > (inv.valuation_at_investment_m ?? 0) ? '#34d399' : '#f87171' }}>
                      {formatM(inv.current_valuation_m)}
                    </span>
                  </div>
                </div>
                {inv.investment_terms && (
                  <div className="mt-2 p-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-lg">
                    <div className="flex items-start gap-1.5">
                      <FileText size={11} className="text-slate-400 dark:text-zinc-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{inv.investment_terms}</span>
                    </div>
                  </div>
                )}
                {inv.portfolio_manager && (
                  <div className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">담당: {inv.portfolio_manager}</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Financials */}
        <Section title="재무 · 펀딩">
          {!hasFinancialData ? (
            <div className="text-xs text-slate-400 dark:text-zinc-600 py-4 text-center">Agent 실행 후 자동 수집됩니다</div>
          ) : (
            <div className="space-y-0.5">
              <Field label="총 외부 펀딩" value={company.total_funding_external_m ? formatM(company.total_funding_external_m) : null} />
              <Field label="최신 라운드" value={company.latest_external_round} />
              {company.latest_external_valuation_m && (
                <Field label="최신 기업가치" value={formatM(company.latest_external_valuation_m)} />
              )}
              <Field label="마지막 펀딩일" value={company.last_funding_date} />
              {company.last_funding_amount_m && (
                <Field label="마지막 펀딩액" value={formatM(company.last_funding_amount_m)} />
              )}
              <Field label="추정 매출" value={company.revenue_range} />
              <Field label="ARR 추정" value={company.arr_estimate} />
              <Field label="수익화 상태" value={company.profitability_status} />
              <Field label="번레이트" value={company.burn_rate_estimate} />
              <Field label="매출 모델" value={company.revenue_model} />
              {allInvestors.length > 0 && (
                <div className="pt-3">
                  <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">전체 투자자</div>
                  <div className="flex flex-wrap gap-1.5">
                    {allInvestors.slice(0, 10).map(inv => <Pill key={inv} label={inv} />)}
                    {allInvestors.length > 10 && (
                      <span className="text-xs text-slate-400 dark:text-zinc-600 self-center">+{allInvestors.length - 10}명</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* Team + Market row */}
      {(hasTeamData || hasMarketData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Team */}
          {hasTeamData && (
            <Section title="팀 · 경영진">
              <div className="space-y-2">
                {company.ceo_name && (
                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500">CEO</div>
                      <div className="text-sm font-medium text-slate-800 dark:text-zinc-200">{company.ceo_name}</div>
                    </div>
                    {company.ceo_linkedin && (
                      <a href={company.ceo_linkedin} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1">
                        <Link2 size={11} /> LinkedIn
                      </a>
                    )}
                  </div>
                )}
                {company.cto_name && <Field label="CTO" value={company.cto_name} />}
                {company.cfo_name && <Field label="CFO" value={company.cfo_name} />}
                {company.cofounders && <Field label="Co-Founders" value={company.cofounders} />}
                {keyExecs.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Key Executives</div>
                    <div className="space-y-1.5">
                      {keyExecs.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-slate-700 dark:text-zinc-300">{ex.name}</span>
                            <span className="text-xs text-slate-400 dark:text-zinc-500 ml-2">{ex.title}</span>
                          </div>
                          {ex.linkedin && (
                            <a href={ex.linkedin} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-sky-600/60 dark:text-sky-500/60 hover:text-sky-600 dark:hover:text-sky-400">
                              <Link2 size={10} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {boardMembers.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">이사회</div>
                    <div className="space-y-1">
                      {boardMembers.map((m, i) => (
                        <div key={i} className="text-sm">
                          <span className="text-slate-700 dark:text-zinc-300">{m.name}</span>
                          {m.organization && <span className="text-xs text-slate-400 dark:text-zinc-500 ml-2">· {m.organization}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Market */}
          {hasMarketData && (
            <Section title="시장 · 경쟁">
              <div className="space-y-0.5">
                <Field label="시장 규모" value={company.market_size_estimate} />
                <Field label="시장 포지션" value={company.market_position} />
                <Field label="비즈니스 모델" value={company.business_model} />
                <Field label="주요 제품" value={company.key_products} />
                {company.patents_count && <Field label="특허 수" value={`${company.patents_count}건`} />}
              </div>
              {competitors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">경쟁사</div>
                  <div className="flex flex-wrap gap-1.5">
                    {competitors.map((c: string) => <Pill key={c} label={c} />)}
                  </div>
                </div>
              )}
              {technologies.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">기술 스택</div>
                  <div className="flex flex-wrap gap-1.5">
                    {technologies.map((t: string) => <Pill key={t} label={t} />)}
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      )}

      {/* Exit Events */}
      {hasExitData && (
        <div>
          {statusGroup === 'IPO' && (
            <Section title="IPO 정보">
              <div className="space-y-0.5">
                <Field label="IPO 날짜" value={company.ipo_date} />
                <Field label="거래소" value={company.ipo_exchange} />
                <Field label="티커" value={company.ipo_ticker} />
                {company.ipo_price && <Field label="공모가" value={`$${company.ipo_price}`} />}
                {company.ipo_info && (
                  <div className="mt-2 p-2.5 bg-sky-50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20 rounded-lg text-sm text-slate-700 dark:text-zinc-300">
                    {company.ipo_info}
                  </div>
                )}
              </div>
            </Section>
          )}
          {statusGroup === 'Acquired' && (
            <Section title="인수 정보">
              <div className="space-y-0.5">
                <Field label="인수자" value={company.acquired_by} />
                <Field label="인수일" value={company.acquired_date} />
                {company.acquired_price_m && <Field label="인수 금액" value={formatM(company.acquired_price_m)} />}
                {company.acquisition_info && (
                  <div className="mt-2 p-2.5 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-lg text-sm text-slate-700 dark:text-zinc-300">
                    {company.acquisition_info}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* News Timeline — urgency-aware */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <h2 className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider">뉴스 타임라인</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600">{news.length}건</span>
        </div>

        {news.length === 0 ? (
          <div className="text-sm text-slate-400 dark:text-zinc-600 py-4 text-center">
            수집된 뉴스가 없습니다. Agent 실행 후 업데이트됩니다.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Urgent + Critical — always prominent */}
            {urgentNews.length > 0 && (
              <div className="space-y-2">
                {urgentNews.map(item => <NewsCard key={item.id} item={item} />)}
              </div>
            )}

            {/* Normal urgency */}
            {normalNews.length > 0 && (
              <div className="space-y-2">
                {urgentNews.length > 0 && <div className="h-px bg-slate-100 dark:bg-zinc-800 my-3" />}
                {normalNews.map(item => <NewsCard key={item.id} item={item} />)}
              </div>
            )}

            {/* Minor news — dimmed, collapsible */}
            {minorNews.length > 0 && (
              <details className="group">
                <summary className={cn(
                  'cursor-pointer flex items-center gap-1.5 py-2 text-xs text-slate-400 dark:text-zinc-600',
                  'hover:text-slate-500 dark:hover:text-zinc-400 transition-colors list-none',
                  (urgentNews.length > 0 || normalNews.length > 0) && 'mt-2 border-t border-slate-100 dark:border-zinc-800 pt-3'
                )}>
                  <ChevronDown size={12} className="group-open:rotate-180 transition-transform shrink-0" />
                  일반 뉴스 {minorNews.length}건 (긴급도 1–2)
                </summary>
                <div className="mt-2 space-y-1.5">
                  {minorNews.map(item => <NewsCard key={item.id} item={item} dimmed />)}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
