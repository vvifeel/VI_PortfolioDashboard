import Link from 'next/link';
import { ArrowLeft, ExternalLink, DollarSign, Percent, FileText, Link2 } from 'lucide-react';
import { getStatusStyle, getUrgencyDot, getUrgencyLabel, getUrgencyStyle, parseTags, TAG_STYLES, formatM, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { Company, Investment, NewsItem } from '@/lib/types';

async function getCompanyData(company: string) {
  const res = await fetch(`http://localhost:3000/api/portfolio/${encodeURIComponent(company)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <h2 className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-slate-400 dark:text-zinc-500 w-28 shrink-0 mt-0.5">{label}</span>
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

  // 상태 분류
  const statusGroup = company.status?.includes('IPO') ? 'IPO'
    : company.status?.includes('Acquired') || company.status?.includes('Subsidiary') ? 'Acquired'
    : company.status?.includes('Dead') || company.status?.includes('Wound') ? 'Dead'
    : company.status ?? 'Alive';

  const allNews = news;

  // Parse JSON arrays safely
  const competitors: string[] = (() => { try { return JSON.parse(company.competitors ?? '[]') ?? []; } catch { return []; } })();
  const technologies: string[] = (() => { try { return JSON.parse(company.technologies ?? '[]') ?? []; } catch { return []; } })();

  const hasAgentData = company.current_employee_count || company.total_funding_external_m || company.revenue_range || competitors.length > 0 || technologies.length > 0;

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
            </div>
            {company.company_name_ko && (
              <div className="text-sm text-slate-500 dark:text-zinc-500 mt-1 mb-2">{company.company_name_ko}</div>
            )}
            {/* sector + region as links */}
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
                </a>
              )}
              {company.founded_year && (
                <span className="text-sm text-slate-400 dark:text-zinc-500">설립 {company.founded_year}</span>
              )}
            </div>
          </div>
          {/* right side: website + last updated */}
          <div className="text-right shrink-0 space-y-2">
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:underline justify-end">
                <ExternalLink size={13} /> 웹사이트
              </a>
            )}
            {company.linkedin_url && (
              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 hover:underline justify-end">
                <Link2 size={13} /> LinkedIn
              </a>
            )}
            {company.last_enriched_at && (
              <div className="text-xs text-slate-400 dark:text-zinc-600">
                마지막 업데이트: {new Date(company.last_enriched_at).toLocaleDateString('ko-KR')}
              </div>
            )}
          </div>
        </div>

        {/* Description — large and readable */}
        {company.description && (
          <p className="text-base text-slate-600 dark:text-zinc-300 mt-6 leading-relaxed max-w-3xl">{company.description}</p>
        )}

        {/* CEO only */}
        {company.ceo_name && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">CEO</div>
              <div className="text-sm font-medium text-slate-800 dark:text-zinc-200">{company.ceo_name}</div>
            </div>
            {company.cofounders && (
              <div>
                <div className="text-xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">Co-Founders</div>
                <div className="text-sm text-slate-700 dark:text-zinc-300">{company.cofounders}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Investment Details */}
        <Section title={`투자 내역 (${investments.length}건)`}>
          <div className="space-y-4">
            {investments.map((inv, i) => (
              <div key={inv.id} className={cn('', i > 0 && 'pt-4 border-t border-slate-100 dark:border-zinc-800')}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20">{inv.round}</Badge>
                  <span className="text-xs text-slate-400 dark:text-zinc-500">{inv.investment_year}/{String(inv.investment_month).padStart(2, '0')}</span>
                  <Badge className={inv.investment_type === '지분투자'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'}>
                    {inv.investment_type}
                  </Badge>
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
                    <span className="text-xs text-slate-400 dark:text-zinc-500">투자 당시 기업가치</span>
                    <span className="text-sm text-slate-700 dark:text-zinc-200 ml-auto">{formatM(inv.valuation_at_investment_m)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 py-1">
                    <DollarSign size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                    <span className="text-xs text-slate-400 dark:text-zinc-500">현재 기업가치</span>
                    <span className="text-sm font-medium ml-auto" style={{ color: (inv.current_valuation_m ?? 0) > (inv.valuation_at_investment_m ?? 0) ? '#34d399' : '#f87171' }}>
                      {formatM(inv.current_valuation_m)}
                    </span>
                  </div>
                  {inv.round_total_m && (
                    <div className="flex items-center gap-1.5 py-1 col-span-2">
                      <DollarSign size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                      <span className="text-xs text-slate-400 dark:text-zinc-500">라운드 총액</span>
                      <span className="text-sm text-slate-700 dark:text-zinc-200 ml-auto">{formatM(inv.round_total_m)}</span>
                    </div>
                  )}
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

        {/* CB Insights / Agent-collected section */}
        <Section title="외부 인텔리전스">
          {!hasAgentData ? (
            <div className="text-xs text-slate-400 dark:text-zinc-600 py-4 text-center">Agent 실행 후 자동 수집됩니다</div>
          ) : (
            <div className="space-y-1">
              <Field label="비즈니스 모델" value={company.business_model} />
              <Field label="주요 제품/서비스" value={company.key_products} />
              <Field label="현재 직원 수" value={company.current_employee_count ? `${company.current_employee_count.toLocaleString()}명` : null} />
              <Field label="외부 총 펀딩" value={company.total_funding_external_m ? formatM(company.total_funding_external_m) : null} />
              <Field label="최신 라운드" value={company.latest_external_round
                ? (company.latest_external_valuation_m
                  ? `${company.latest_external_round} · ${formatM(company.latest_external_valuation_m)}`
                  : company.latest_external_round)
                : null} />
              <Field label="추정 매출" value={company.revenue_range} />
              {company.acquisition_info && statusGroup === 'Acquired' && (
                <div className="mt-3 p-2.5 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-lg">
                  <div className="text-xs text-violet-600 dark:text-violet-400 font-medium mb-1">인수 정보</div>
                  <div className="text-sm text-slate-700 dark:text-zinc-300">{company.acquisition_info}</div>
                </div>
              )}
              {company.ipo_info && statusGroup === 'IPO' && (
                <div className="mt-3 p-2.5 bg-sky-50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20 rounded-lg">
                  <div className="text-xs text-sky-600 dark:text-sky-400 font-medium mb-1">IPO 정보</div>
                  <div className="text-sm text-slate-700 dark:text-zinc-300">{company.ipo_info}</div>
                </div>
              )}
              {competitors.length > 0 && (
                <div className="pt-3">
                  <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">경쟁사</div>
                  <div className="flex flex-wrap gap-1.5">
                    {competitors.map((c: string) => <Pill key={c} label={c} />)}
                  </div>
                </div>
              )}
              {technologies.length > 0 && (
                <div className="pt-3">
                  <div className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">기술 스택</div>
                  <div className="flex flex-wrap gap-1.5">
                    {technologies.map((t: string) => <Pill key={t} label={t} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* News Timeline */}
      <Section title={`뉴스 타임라인 (${allNews.length}건)`}>
        {allNews.length === 0 ? (
          <div className="text-sm text-slate-400 dark:text-zinc-600 py-4 text-center">수집된 뉴스가 없습니다. Agent 실행 후 업데이트됩니다.</div>
        ) : (
          <div className="space-y-3">
            {allNews.map(item => {
              const tags = parseTags(item.tags);
              return (
                <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors">
                  <span className="text-base mt-0.5">{getUrgencyDot(item.urgency_level)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn('text-[10px]', getUrgencyStyle(item.urgency_level))}>
                        {getUrgencyLabel(item.urgency_level)}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-zinc-500">{item.source}</span>
                      {item.published_at && (
                        <span className="text-xs text-slate-400 dark:text-zinc-600">{new Date(item.published_at).toLocaleDateString('ko-KR')}</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-zinc-200 mt-1">{item.one_line_summary || item.title}</div>
                    {item.title && item.one_line_summary && (
                      <div className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{item.title}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tags.map(tag => (
                        <span key={tag} className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', TAG_STYLES[tag] ?? 'bg-slate-100 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700')}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    {item.source_url && (
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-sky-600/60 dark:text-sky-500/60 hover:text-sky-600 dark:hover:text-sky-400 mt-1 inline-flex items-center gap-1">
                        원문 보기 <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
