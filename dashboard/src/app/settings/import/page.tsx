'use client';
import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportResult {
  ok: boolean;
  results?: {
    invInserted?: number; invUpdated?: number;
    coInserted?: number; coUpdated?: number;
    errors?: string[];
    [sheet: string]: unknown;
  };
  error?: string;
}

const REQUIRED_FIELDS = [
  { col: '기업명', table: '투자현황', type: 'TEXT', required: true, note: '기준 키 (필수)' },
  { col: '투자유형', table: '투자현황', type: 'TEXT', note: '지분투자 / 전환채권' },
  { col: '투자년도', table: '투자현황', type: 'INTEGER' },
  { col: '투자월', table: '투자현황', type: 'INTEGER' },
  { col: '투자금액($M)', table: '투자현황', type: 'REAL', note: 'PRIVATE' },
  { col: '투자 Round', table: '투자현황', type: 'TEXT', note: 'Seed | Series A .. Pre-IPO' },
  { col: 'Round 총액($M)', table: '투자현황', type: 'REAL', note: 'PRIVATE' },
  { col: '당사 지분율(%)', table: '투자현황', type: 'REAL', note: 'PRIVATE' },
  { col: '투자조건', table: '투자현황', type: 'TEXT', note: 'PRIVATE' },
  { col: '투자 당시 기업가치($M)', table: '투자현황', type: 'REAL', note: 'PRIVATE' },
  { col: '현재 기업가치($M)', table: '투자현황', type: 'REAL', note: 'PRIVATE' },
  { col: '담당자', table: '투자현황', type: 'TEXT', required: false, note: '선택 (신규 필드)' },
  { col: '투자thesis', table: '투자현황', type: 'TEXT', required: false, note: '선택 (신규 필드)' },
  { col: '공동투자자', table: '투자현황', type: 'TEXT', required: false, note: '선택 (신규 필드)' },
];

const COMPANY_FIELDS = [
  { col: '기업명', table: '기업프로필', type: 'TEXT', required: true },
  { col: '분야', table: '기업프로필', type: 'TEXT' },
  { col: '회사 개요', table: '기업프로필', type: 'TEXT' },
  { col: '지역', table: '기업프로필', type: 'TEXT' },
  { col: '현재 상태', table: '기업프로필', type: 'TEXT' },
  { col: 'CEO', table: '기업프로필', type: 'TEXT' },
  { col: 'CTO', table: '기업프로필', type: 'TEXT' },
  { col: 'CFO', table: '기업프로필', type: 'TEXT' },
  { col: 'Co-Founder', table: '기업프로필', type: 'TEXT' },
  { col: '웹사이트', table: '기업프로필', type: 'TEXT', note: '신규 필드 (권고)' },
  { col: '설립년도', table: '기업프로필', type: 'INTEGER', note: '신규 필드 (권고)' },
  { col: '서브섹터', table: '기업프로필', type: 'TEXT', note: '신규 필드 (선택)' },
  { col: '비즈니스모델', table: '기업프로필', type: 'TEXT', note: '신규 필드 (선택)' },
  { col: '주요제품서비스', table: '기업프로필', type: 'TEXT', note: '신규 필드 (선택)' },
  { col: '투자당시직원수', table: '기업프로필', type: 'INTEGER', note: '신규 필드 (선택)' },
];

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      alert('.xlsx 또는 .xls 파일만 지원합니다');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      setResult(await res.json());
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">엑셀 데이터 Import</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">포트폴리오 Excel 파일을 업로드하면 DB에 자동으로 반영됩니다</p>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          drag
            ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/5'
            : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-slate-50/50 dark:bg-zinc-900/50'
        )}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <FileSpreadsheet size={32} className={cn('mx-auto mb-3', drag ? 'text-sky-500 dark:text-sky-400' : 'text-slate-300 dark:text-zinc-600')} />
        {file ? (
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-zinc-200">{file.name}</div>
            <div className="text-xs text-slate-400 dark:text-zinc-500 mt-1">{(file.size / 1024).toFixed(1)} KB — 클릭하여 파일 변경</div>
          </div>
        ) : (
          <div>
            <div className="text-sm text-slate-500 dark:text-zinc-400">Excel 파일을 드래그하거나 클릭하여 업로드</div>
            <div className="text-xs text-slate-400 dark:text-zinc-600 mt-1">.xlsx, .xls 지원</div>
          </div>
        )}
      </div>

      {file && (
        <button onClick={upload} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 rounded-lg text-sm font-medium hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors disabled:opacity-50">
          <Upload size={14} />
          {loading ? 'Import 진행 중...' : 'Import 실행'}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className={cn('rounded-xl p-5 border', result.ok ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20')}>
          <div className="flex items-center gap-2 mb-3">
            {result.ok
              ? <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />
              : <AlertCircle size={16} className="text-red-500 dark:text-red-400" />}
            <span className={cn('text-sm font-medium', result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {result.ok ? 'Import 완료' : `오류: ${result.error}`}
            </span>
          </div>
          {result.ok && result.results && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {typeof result.results.invInserted === 'number' && (
                <>
                  <div className="text-slate-500 dark:text-zinc-400">투자 내역 신규</div>
                  <div className="text-slate-700 dark:text-zinc-200 font-medium">{result.results.invInserted}건</div>
                  <div className="text-slate-500 dark:text-zinc-400">투자 내역 업데이트</div>
                  <div className="text-slate-700 dark:text-zinc-200 font-medium">{result.results.invUpdated}건</div>
                  <div className="text-slate-500 dark:text-zinc-400">기업 프로필 신규</div>
                  <div className="text-slate-700 dark:text-zinc-200 font-medium">{result.results.coInserted}건</div>
                  <div className="text-slate-500 dark:text-zinc-400">기업 프로필 업데이트</div>
                  <div className="text-slate-700 dark:text-zinc-200 font-medium">{result.results.coUpdated}건</div>
                </>
              )}
              {Array.isArray(result.results.errors) && result.results.errors.length > 0 && (
                <div className="col-span-2">
                  <div className="text-amber-600 dark:text-amber-400 text-xs mt-1">⚠ 오류 {result.results.errors.length}건:</div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                    {result.results.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Field Reference */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-sky-500 dark:text-sky-400" />
          <h2 className="text-sm font-medium text-slate-700 dark:text-zinc-300">실제 데이터 준비 가이드 — 필드 정의</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sheet 1 */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30">
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Sheet 1: 포트폴리오_투자현황</div>
              <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">투자 거래 건당 1 row (기업 다중 투자 시 여러 row)</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800">
                  <th className="text-left px-3 py-2 text-slate-500 dark:text-zinc-500 font-medium">컬럼명</th>
                  <th className="text-left px-3 py-2 text-slate-500 dark:text-zinc-500 font-medium">타입</th>
                  <th className="text-left px-3 py-2 text-slate-500 dark:text-zinc-500 font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {REQUIRED_FIELDS.map(f => (
                  <tr key={f.col} className="border-b border-slate-100 dark:border-zinc-800/50">
                    <td className="px-3 py-1.5 text-slate-700 dark:text-zinc-300 font-mono">{f.col}</td>
                    <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-500">{f.type}</td>
                    <td className="px-3 py-1.5 text-slate-400 dark:text-zinc-600">{f.note ?? (f.required === false ? '선택' : '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sheet 2 */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30">
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Sheet 2: 기업_프로필 (선택)</div>
              <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">기업당 1 row — 없어도 동작, Agent가 보완</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800">
                  <th className="text-left px-3 py-2 text-slate-500 dark:text-zinc-500 font-medium">컬럼명</th>
                  <th className="text-left px-3 py-2 text-slate-500 dark:text-zinc-500 font-medium">타입</th>
                  <th className="text-left px-3 py-2 text-slate-500 dark:text-zinc-500 font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {COMPANY_FIELDS.map(f => (
                  <tr key={f.col} className="border-b border-slate-100 dark:border-zinc-800/50">
                    <td className="px-3 py-1.5 text-slate-700 dark:text-zinc-300 font-mono">{f.col}</td>
                    <td className="px-3 py-1.5 text-slate-500 dark:text-zinc-500">{f.type}</td>
                    <td className="px-3 py-1.5 text-slate-400 dark:text-zinc-600">{f.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-zinc-600 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-3">
          💡 <strong className="text-slate-600 dark:text-zinc-400">진짜 데이터 교체 방법</strong>: 위 형식대로 xlsx 준비 → 이 페이지에서 업로드 → 기존 데이터 upsert (기업명+연도+라운드 기준으로 덮어쓰기).
          기존 DB 백업: <code className="text-sky-600 dark:text-sky-400">cp data/portfolio.db data/portfolio_backup.db</code>
        </div>
      </div>
    </div>
  );
}
