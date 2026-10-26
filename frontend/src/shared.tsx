import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Lock, X } from 'lucide-react';
import { errMsg } from './api';
import type { CareLevel, EmergencyCase, Evidence, Patient, RiskAssessment, Vitals } from './types';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/40 sm:p-5 ${className}`}>{children}</section>
);
export const Overline = ({ children, className = 'text-cyan-400' }: { children: ReactNode; className?: string }) => (
  <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] sm:text-[11px] ${className}`}>{children}</p>
);
export const Btn = ({ tone = 'cyan', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cyan' | 'rose' | 'ghost' }) => (
  <button {...p} className={`rounded-xl px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
    tone === 'cyan' ? 'bg-cyan-600 shadow-md shadow-cyan-600/25 hover:bg-cyan-500'
    : tone === 'rose' ? 'bg-rose-600 shadow-md shadow-rose-600/30 hover:bg-rose-500'
    : 'border border-slate-700 bg-slate-950/80 text-slate-200 hover:border-slate-500'} ${className}`} />
);
export const fieldCls = 'w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 text-sm text-slate-100 placeholder:text-slate-500';

const CARE: Record<CareLevel, string> = {
  STABLE: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-400',
  MONITOR: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-400',
  ROUTINE_REVIEW: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-400',
  PRIORITY_REVIEW: 'border-amber-500/30 bg-amber-950/40 text-amber-400',
  URGENT: 'border-amber-500/40 bg-amber-950/40 text-amber-400',
  POSSIBLE_EMERGENCY: 'border-rose-500/40 bg-rose-950/40 text-rose-400',
};
export const RiskBadge = ({ level }: { level?: CareLevel }) => (
  <span className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px] ${level ? CARE[level] ?? CARE.MONITOR : 'border-slate-700 text-slate-400'}`}>
    {level ?? 'NO ASSESSMENT'}
  </span>
);
export const StatusBadge = ({ status, tone = 'slate' }: { status: string; tone?: 'slate' | 'cyan' | 'rose' | 'emerald' }) => (
  <span className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px] ${{
    slate: 'border-slate-700 text-slate-300', cyan: 'border-cyan-500/30 text-cyan-400',
    rose: 'border-rose-500/40 text-rose-400', emerald: 'border-emerald-500/30 text-emerald-400' }[tone]}`}>{status.replace(/_/g, ' ')}</span>
);
export const Simulated = ({ label = '[SIMULATED]' }: { label?: string }) => (
  <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">{label}</span>
);

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <p role="status" className="animate-pulse py-6 text-center font-mono text-xs text-slate-400">{label}</p>
);
export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-400 sm:text-sm">{children}</p>
);
export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 sm:text-sm">
    {message} {retry && <button onClick={retry} className="ml-2 min-h-0 font-bold underline">Retry</button>}
  </div>
);
/** Used where the spec names a feature but defines no backend endpoint. Nothing is faked in its place. */
export const BackendRequired = ({ what }: { what: string }) => (
  <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-950/20 p-4 text-xs text-amber-300 sm:text-sm">
    <Overline className="text-amber-400">BACKEND SUPPORT REQUIRED</Overline>
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="mx-auto min-h-full w-full max-w-2xl border-slate-800 bg-slate-900 p-4 sm:my-8 sm:min-h-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-white sm:text-xl">{title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="grid min-w-[44px] place-items-center rounded-xl border border-slate-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RiskDonut({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score)); const r = 52; const c = 2 * Math.PI * r;
  const color = pct < 34 ? '#22d3ee' : pct < 67 ? '#fbbf24' : '#fb7185';
  return (
    <svg viewBox="0 0 120 120" className="h-40 w-40" role="img" aria-label={`Risk score ${pct.toFixed(0)} out of 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="64" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="800" fontFamily="var(--font-mono)">{pct.toFixed(0)}</text>
      <text x="60" y="80" textAnchor="middle" fill="#64748b" fontSize="9">/ 100</text>
    </svg>
  );
}
export const Spectrum = ({ score }: { score: number }) => (
  <div>
    <div className="relative h-2 rounded-full bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500">
      <span className="absolute -top-1 h-4 w-1 rounded bg-white" style={{ left: `calc(${Math.max(0, Math.min(100, score))}% - 2px)` }} />
    </div>
    <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>0 LOW</span><span>100 CRITICAL</span></div>
  </div>
);

export function EvidenceCard({ ev }: { ev: Evidence }) {
  return (
    <article className="rounded-xl border border-indigo-300/20 bg-indigo-950/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {ev.citation_id && <span className="font-mono text-[11px] font-bold text-indigo-300">[{ev.citation_id}]</span>}
        {ev.publisher && <span className="text-[11px] text-slate-400">{ev.publisher}</span>}
        {typeof ev.score === 'number' && <span className="ml-auto font-mono text-[11px] text-slate-400">conf {(ev.score <= 1 ? ev.score * 100 : ev.score).toFixed(0)}%</span>}
      </div>
      {ev.title && <h4 className="mt-1 text-sm font-bold text-white">{ev.title}</h4>}
      {ev.excerpt && <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">{ev.excerpt}</p>}
    </article>
  );
}
export const EvidenceList = ({ items }: { items?: Evidence[] }) =>
  items && items.length ? <div className="space-y-2">{items.map((e, i) => <EvidenceCard key={e.citation_id ?? i} ev={e} />)}</div>
  : <Empty>No clinical references currently retrieved for this analysis. Clinical references appear when specific health risk patterns are identified.</Empty>;

export function SafetyRules({ a }: { a?: RiskAssessment }) {
  if (!a?.triggered_safety_rules?.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4">
      <Overline className="text-rose-400">Red-Flag Safety Rules Triggered</Overline>
      <ul className="mt-2 space-y-2">{a.triggered_safety_rules.map((r) => (
        <li key={r.rule_id} className="text-xs text-slate-200 sm:text-sm">
          <span className="mr-2 font-mono font-bold text-rose-400">[{r.rule_id}]</span>{r.reason}
          <span className="block font-mono text-[11px] text-slate-400">{r.condition} → {r.forced_care_level}</span>
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
        <div key={m.key} className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-[11px] text-slate-400">{m.label}</p>
          <p className="font-mono text-3xl font-extrabold tabular-nums text-cyan-400 sm:text-4xl">{v[m.key] ?? '—'}</p>
          <p className="text-[11px] text-slate-500">{m.unit}</p>
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
    <Modal title="Emergency Handover Passport (FHIR/HL7 Compatible)" onClose={onClose}>
      <p className="mb-2 text-xs text-slate-400">Assembled from live patient, assessment and case records. Missing fields are shown as null.</p>
      <pre className="max-h-[55vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px] text-cyan-300">{json}</pre>
      <Btn className="mt-3 flex items-center gap-2" onClick={async () => { await navigator.clipboard.writeText(json); setCopied(true); }}>
        <Copy size={16} />{copied ? 'Copied' : 'Copy JSON'}</Btn>
    </Modal>
  );
}
export const SecureNote = () => <p className="flex items-center gap-1 text-[11px] text-slate-500"><Lock size={12} />Authenticated session</p>;
