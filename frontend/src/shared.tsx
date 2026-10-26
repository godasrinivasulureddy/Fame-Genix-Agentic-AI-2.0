import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Lock, X } from 'lucide-react';
import { errMsg } from './api';
import type { CareLevel, EmergencyCase, Evidence, Patient, RiskAssessment, Vitals } from './types';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`clinic-card ${className}`}>{children}</section>
);
export const Overline = ({ children, className = 'text-teal-600' }: { children: ReactNode; className?: string }) => (
  <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] sm:text-[11px] ${className}`}>{children}</p>
);
export const Btn = ({ tone = 'cyan', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cyan' | 'rose' | 'ghost' }) => (
  <button {...p} className={`rounded-xl px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
    tone === 'cyan' ? 'bg-[#00b39e] shadow-sm shadow-[#00b39e]/30 hover:bg-[#0a7b6c]'
    : tone === 'rose' ? 'bg-[#fb7185] shadow-sm shadow-[#fb7185]/30 hover:bg-[#f43f5e]'
    : 'border border-[#21262D] bg-white text-[#0f2c38] shadow-sm hover:bg-[#f2f6f9]'} ${className}`} />
);
export const fieldCls = 'w-full rounded-xl border border-[#21262D] bg-white px-3 text-sm text-[#0f2c38] placeholder:text-[#6a8a94] shadow-sm transition';

const CARE: Record<CareLevel, string> = {
  STABLE: 'border-[#34d399] bg-[#34d399]/10 text-[#34d399]',
  MONITOR: 'border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]',
  ROUTINE_REVIEW: 'border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]',
  PRIORITY_REVIEW: 'border-[#fbbf24] bg-[#fbbf24]/10 text-[#fbbf24]',
  URGENT: 'border-[#fbbf24] bg-[#fbbf24]/10 text-[#fbbf24]',
  POSSIBLE_EMERGENCY: 'border-[#fb7185] bg-[#fb7185]/10 text-[#fb7185]',
};
export const RiskBadge = ({ level }: { level?: CareLevel }) => (
  <span className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px] ${level ? CARE[level] ?? CARE.MONITOR : 'border-[#21262D] text-[#6a8a94]'}`}>
    {level ?? 'NO ASSESSMENT'}
  </span>
);
export const StatusBadge = ({ status, tone = 'slate' }: { status: string; tone?: 'slate' | 'cyan' | 'rose' | 'emerald' }) => (
  <span className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px] ${{
    slate: 'border-[#21262D] text-[#6a8a94]', cyan: 'border-[#22d3ee] text-[#22d3ee]',
    rose: 'border-[#fb7185] text-[#fb7185]', emerald: 'border-[#34d399] text-[#34d399]' }[tone]}`}>{status.replace(/_/g, ' ')}</span>
);
export const Simulated = ({ label = '[SIMULATED]' }: { label?: string }) => (
  <span className="rounded-lg border border-[#fbbf24] bg-[#fbbf24]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#fbbf24]">{label}</span>
);

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <p role="status" className="animate-pulse py-6 text-center font-mono text-xs text-[#6a8a94]">{label}</p>
);
export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-[#21262D] p-4 text-center text-xs text-[#6a8a94] sm:text-sm">{children}</p>
);
export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-[#fb7185] bg-[#fb7185]/10 p-3 text-xs text-[#fb7185] sm:text-sm">
    {message} {retry && <button onClick={retry} className="ml-2 min-h-0 font-bold underline">Retry</button>}
  </div>
);
/** Used where the spec names a feature but defines no backend endpoint. Nothing is faked in its place. */
export const BackendRequired = ({ what }: { what: string }) => (
  <div className="rounded-xl border border-dashed border-[#fbbf24] bg-[#fbbf24]/10 p-4 text-xs text-[#fbbf24] sm:text-sm">
    <Overline className="text-[#fbbf24]">BACKEND SUPPORT REQUIRED</Overline>
    <p className="mt-1">{what}</p>
  </div>
);

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [s, setS] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [n, setN] = useState(0);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    let live = true;
    setS((p) => ({ ...p, loading: true, error: undefined }));
    fnRef.current().then((data) => live && setS({ data, loading: false }), (e) => live && setS({ loading: false, error: errMsg(e) }));
    // Conditional polling: only while the tab is visible; silent refresh keeps current data on screen.
    const id = pollMs ? window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fnRef.current().then((data) => live && setS({ data, loading: false }), () => undefined);
    }, pollMs) : undefined;
    return () => { live = false; if (id) window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n, pollMs]);
  return { ...s, reload: useCallback(() => setN((x) => x + 1), []) };
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f2c38]/90" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="mx-auto min-h-full w-full max-w-2xl border border-[#21262D] bg-white p-4 sm:my-8 sm:min-h-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-[#0f2c38] sm:text-xl">{title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="grid min-w-[44px] place-items-center rounded-xl border border-[#21262D]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RiskDonut({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score)); const r = 52; const c = 2 * Math.PI * r;
  const color = pct < 34 ? '#34d399' : pct < 67 ? '#fbbf24' : '#fb7185';
  return (
    <svg viewBox="0 0 120 120" className="h-40 w-40" role="img" aria-label={`Risk score ${pct.toFixed(0)} out of 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="64" textAnchor="middle" fill="#0f2c38" fontSize="28" fontWeight="800" fontFamily="var(--font-mono)">{pct.toFixed(0)}</text>
      <text x="60" y="80" textAnchor="middle" fill="#6a8a94" fontSize="9">/ 100</text>
    </svg>
  );
}
export const Spectrum = ({ score }: { score: number }) => (
  <div>
    <div className="relative h-2 rounded-full bg-gradient-to-r from-[#34d399] via-[#fbbf24] to-[#fb7185]">
      <span className="absolute -top-1 h-4 w-1 rounded bg-white" style={{ left: `calc(${Math.max(0, Math.min(100, score))}% - 2px)` }} />
    </div>
    <div className="mt-1 flex justify-between font-mono text-[10px] text-[#6a8a94]"><span>0 LOW</span><span>100 CRITICAL</span></div>
  </div>
);

export function EvidenceCard({ ev }: { ev: Evidence }) {
  return (
    <article className="rounded-xl border border-[#21262D] bg-white p-3 shadow-sm shadow-[#000000]/20">
      <div className="flex flex-wrap items-center gap-2">
        {ev.citation_id && <span className="font-mono text-[11px] font-bold text-[#0a7b6c]">[{ev.citation_id}]</span>}
        {ev.publisher && <span className="text-[11px] text-[#6a8a94]">{ev.publisher}</span>}
        {typeof ev.score === 'number' && <span className="ml-auto font-mono text-[11px] text-[#6a8a94]">conf {(ev.score <= 1 ? ev.score * 100 : ev.score).toFixed(0)}%</span>}
      </div>
      {ev.title && <h4 className="mt-1 text-sm font-bold text-[#0f2c38]">{ev.title}</h4>}
      {ev.excerpt && <p className="mt-1 text-xs leading-relaxed text-[#6a8a94] sm:text-sm">{ev.excerpt}</p>}
    </article>
  );
}
export const EvidenceList = ({ items }: { items?: Evidence[] }) =>
  items && items.length ? <div className="space-y-2">{items.map((e, i) => <EvidenceCard key={e.citation_id ?? i} ev={e} />)}</div>
  : <Empty>No clinical references currently retrieved for this analysis. Clinical references appear when specific health risk patterns are identified.</Empty>;

export function SafetyRules({ a }: { a?: RiskAssessment }) {
  if (!a?.triggered_safety_rules?.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-[#fb7185] bg-[#fb7185]/10 p-4 shadow-sm shadow-[#000000]/10">
      <Overline className="text-[#fb7185]">Red-Flag Safety Rules Triggered</Overline>
      <ul className="mt-2 space-y-2">{a.triggered_safety_rules.map((r) => (
        <li key={r.rule_id} className="text-xs text-[#6a8a94] sm:text-sm">
          <span className="mr-2 font-mono font-bold text-[#fb7185]">[{r.rule_id}]</span>{r.reason}
          <span className="block font-mono text-[11px] text-[#6a8a94]">{r.condition} → {r.forced_care_level}</span>
        </li>))}</ul>
    </div>
  );
}

export const VITAL_META: Array<{ key: keyof Vitals; label: string; unit: string }> = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm' }, { key: 'spo2', label: 'SpO2', unit: '%' },
  { key: 'respiratory_rate', label: 'Resp Rate', unit: '/min' }, { key: 'temperature', label: 'Temp', unit: '°C' },
];
export function VitalsGrid({ v, badge }: { v?: Vitals; badge?: ReactNode }) {
  if (!v || !Object.keys(v).length) return <Empty>No vitals recorded on this assessment.</Empty>;
  return (
    <div>
      {badge && <div className="mb-2">{badge}</div>}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{VITAL_META.map((m) => (
        <div key={m.key} className="rounded-xl border border-[#21262D] bg-white p-3 shadow-sm shadow-[#000000]/10">
          <p className="text-[11px] text-[#6a8a94]">{m.label}</p>
          <p className="font-mono text-3xl font-extrabold tabular-nums text-[#00b39e] sm:text-4xl">{v[m.key] ?? '—'}</p>
          <p className="text-[11px] text-[#6a8a94]">{m.unit}</p>
        </div>))}</div>
    </div>
  );
}

/** Built only from fields present on real records; absent fields stay null rather than being invented. */
export function buildPassport(p?: Patient, a?: RiskAssessment, c?: EmergencyCase, v?: Vitals) {
  return {
    format: 'FAME-GENIX handover summary (structured; FHIR/HL7 conformance not validated)',
    generated_at: new Date().toISOString(),
    patient_public_id: p?.public_id ?? null, case_id: c?.public_id ?? c?.id ?? null,
    patient: p ? { name: p.full_name, age: p.age ?? null, sex: p.sex ?? null, blood_group: p.blood_group ?? null,
      known_conditions: p.known_conditions ?? null, emergency_contact: { name: p.emergency_contact_name ?? null, phone: p.emergency_contact_phone ?? null } } : null,
    assessment: a ? { id: a.id, risk_score: a.risk_score, care_level: a.care_level, symptoms: a.active_symptoms ?? [],
      triggered_safety_rules: (a.triggered_safety_rules ?? []).map((r) => r.rule_id) } : null,
    vitals: { heart_rate: { value: v?.heart_rate ?? null, unit: 'bpm' }, spo2: { value: v?.spo2 ?? null, unit: '%' },
      respiratory_rate: { value: v?.respiratory_rate ?? null, unit: '/min' }, temperature: { value: v?.temperature ?? null, unit: 'C' } },
    emergency_status: c?.status ?? null,
  };
}
export function HandoverPassportModal({ passport, onClose }: { passport: ReturnType<typeof buildPassport>; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(passport, null, 2);
  return (
    <Modal title="Emergency Handover Passport" onClose={onClose}>
      <p className="mb-2 text-xs text-[#6a8a94]">Assembled from live patient, assessment and case records. Missing fields are shown as null.</p>
      <pre className="max-h-[55vh] overflow-auto rounded-xl border border-[#21262D] bg-[#fbfcfe] p-3 font-mono text-[11px] text-[#00b39e]">{json}</pre>
      <Btn className="mt-3 flex items-center gap-2" onClick={async () => { await navigator.clipboard.writeText(json); setCopied(true); }}>
        <Copy size={16} />{copied ? 'Copied' : 'Copy JSON'}</Btn>
    </Modal>
  );
}
export const SecureNote = () => <p className="flex items-center gap-1 text-[11px] text-[#6a8a94]"><Lock size={12} />Authenticated session</p>;
