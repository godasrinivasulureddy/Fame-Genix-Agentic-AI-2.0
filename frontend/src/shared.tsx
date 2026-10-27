import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertOctagon,
  Battery,
  Bluetooth,
  Bot,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  Phone,
  Plus,
  Radio,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { api, errMsg } from './api';
import type {
  BluetoothDevice,
  CareLevel,
  EmergencyCase,
  EmergencyStatus,
  Evidence,
  MultiAgentConsensus,
  Patient,
  PortalSettings,
  RiskAssessment,
  Vitals,
} from './types';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`clinic-card ${className}`}>{children}</section>
);

export const Overline = ({ children, className = 'text-[#d97757]' }: { children: ReactNode; className?: string }) => (
  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[11px] ${className}`}>{children}</p>
);

export const Btn = ({
  tone = 'cyan',
  className = '',
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cyan' | 'rose' | 'ghost' | 'emerald' | 'amber' }) => (
  <button
    {...p}
    className={`inline-flex items-center justify-center rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
      tone === 'cyan'
        ? 'bg-[#d97757] text-[#1a1915] shadow-md shadow-[#d97757]/30 hover:bg-[#e58a6e]'
        : tone === 'rose'
        ? 'bg-[#fb7185] text-[#1a1915] shadow-md shadow-[#fb7185]/30 hover:bg-[#f43f5e]'
        : tone === 'emerald'
        ? 'bg-[#41d69a] text-[#1a1915] shadow-md shadow-[#41d69a]/30 hover:bg-[#5ae0a9]'
        : tone === 'amber'
        ? 'bg-[#f2b955] text-[#1a1915] shadow-md shadow-[#f2b955]/30 hover:bg-[#f5c66e]'
        : 'border border-[#3e3e38] bg-[#2c2c2b] text-[#faf9f5] shadow-sm hover:bg-[#30302e]'
    } ${className}`}
  />
);

export const fieldCls =
  'w-full rounded-xl border border-[#52514a] bg-[#1b1b19] px-3 text-sm text-[#faf9f5] placeholder:text-[#77766e] shadow-inner transition focus:border-[#d97757] focus:ring-2 focus:ring-[#d97757]/30';

const CARE: Record<CareLevel, string> = {
  STABLE: 'border-[#41d69a] bg-[#41d69a]/10 text-[#41d69a]',
  MONITOR: 'border-[#9c87f5] bg-[#9c87f5]/10 text-[#9c87f5]',
  ROUTINE_REVIEW: 'border-[#9c87f5] bg-[#9c87f5]/10 text-[#9c87f5]',
  PRIORITY_REVIEW: 'border-[#f2b955] bg-[#f2b955]/10 text-[#f2b955]',
  URGENT: 'border-[#f2b955] bg-[#f2b955]/10 text-[#f2b955]',
  POSSIBLE_EMERGENCY: 'border-[#fb7185] bg-[#fb7185]/10 text-[#fb7185]',
};

export const RiskBadge = ({ level }: { level?: CareLevel }) => (
  <span
    className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px] ${
      level ? CARE[level] ?? CARE.MONITOR : 'border-[#3e3e38] text-[#a9a99f]'
    }`}
  >
    {level ?? 'NO ASSESSMENT'}
  </span>
);

export const StatusBadge = ({
  status,
  tone = 'slate',
}: {
  status: string;
  tone?: 'slate' | 'cyan' | 'rose' | 'emerald' | 'amber';
}) => (
  <span
    className={`inline-block rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px] ${
      {
        slate: 'border-[#3e3e38] text-[#a9a99f]',
        cyan: 'border-[#d97757] text-[#d97757]',
        rose: 'border-[#fb7185] text-[#fb7185]',
        emerald: 'border-[#41d69a] text-[#41d69a]',
        amber: 'border-[#f2b955] text-[#f2b955]',
      }[tone]
    }`}
  >
    {status.replace(/_/g, ' ')}
  </span>
);

export const Simulated = ({ label = '[SIMULATED]' }: { label?: string }) => (
  <span className="rounded-lg border border-[#f2b955] bg-[#f2b955]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#f2b955]">
    {label}
  </span>
);

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div role="status" className="flex flex-col items-center justify-center py-6 gap-2">
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
    <p className="font-mono text-xs text-[#a9a99f]">{label}</p>
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-[#3e3e38] p-4 text-center text-xs text-[#a9a99f] sm:text-sm">
    {children}
  </p>
);

export const ErrorState = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-[#fb7185] bg-[#fb7185]/10 p-3 text-xs text-[#fb7185] sm:text-sm">
    <div className="flex items-center gap-2">
      <AlertOctagon size={16} />
      <span>{message}</span>
      {retry && (
        <button onClick={retry} className="ml-auto font-bold underline hover:text-[#faf9f5]">
          Retry
        </button>
      )}
    </div>
  </div>
);

export const BackendRequired = ({ what }: { what: string }) => (
  <div className="rounded-xl border border-dashed border-[#f2b955] bg-[#f2b955]/10 p-4 text-xs text-[#f2b955] sm:text-sm">
    <Overline className="text-[#f2b955]">BACKEND SUPPORT REQUIRED</Overline>
    <p className="mt-1">{what}</p>
  </div>
);

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [s, setS] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [n, setN] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let live = true;
    setS((p) => ({ ...p, loading: true, error: undefined }));
    fnRef
      .current()
      .then((data) => live && setS({ data, loading: false }))
      .catch((e) => live && setS({ loading: false, error: errMsg(e) }));

    const id = pollMs
      ? window.setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          fnRef
            .current()
            .then((data) => live && setS({ data, loading: false }))
            .catch(() => undefined);
        }, pollMs)
      : undefined;
    return () => {
      live = false;
      if (id) window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n, pollMs]);
  return { ...s, reload: useCallback(() => setN((x) => x + 1), []) };
}

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`mx-auto min-h-full w-full ${maxWidth} border border-[#3e3e38] bg-[#262624] p-4 sm:my-8 sm:min-h-0 sm:rounded-3xl sm:border sm:p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#3e3e38] pb-3">
          <h2 className="text-base font-bold text-[#faf9f5] sm:text-xl flex items-center gap-2">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="grid min-h-[36px] min-w-[36px] place-items-center rounded-xl border border-[#3e3e38] bg-[#2c2c2b] text-[#a9a99f] hover:text-[#faf9f5]"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RiskDonut({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = pct < 34 ? '#41d69a' : pct < 67 ? '#f2b955' : '#fb7185';
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label={`Risk score ${pct.toFixed(0)} out of 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1b1b19" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="64"
        textAnchor="middle"
        fill="#faf9f5"
        fontSize="28"
        fontWeight="800"
        fontFamily="var(--font-mono)"
      >
        {pct.toFixed(0)}
      </text>
      <text x="60" y="80" textAnchor="middle" fill="#a9a99f" fontSize="9">
        / 100
      </text>
    </svg>
  );
}

export const Spectrum = ({ score }: { score: number }) => (
  <div>
    <div className="relative h-2 rounded-full bg-gradient-to-r from-[#41d69a] via-[#f2b955] to-[#fb7185]">
      <span
        className="absolute -top-1 h-4 w-1 rounded bg-[#faf9f5] shadow-sm"
        style={{ left: `calc(${Math.max(0, Math.min(100, score))}% - 2px)` }}
      />
    </div>
    <div className="mt-1 flex justify-between font-mono text-[10px] text-[#a9a99f]">
      <span>0 LOW</span>
      <span>50 MODERATE</span>
      <span>100 CRITICAL</span>
    </div>
  </div>
);

export function EvidenceCard({ ev }: { ev: Evidence }) {
  return (
    <article className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3 shadow-sm shadow-black/20">
      <div className="flex flex-wrap items-center gap-2">
        {ev.citation_id && <span className="font-mono text-[11px] font-bold text-[#d97757]">[{ev.citation_id}]</span>}
        {ev.publisher && <span className="text-[11px] text-[#a9a99f]">{ev.publisher}</span>}
        {typeof ev.score === 'number' && (
          <span className="ml-auto font-mono text-[11px] text-[#a9a99f]">
            conf {(ev.score <= 1 ? ev.score * 100 : ev.score).toFixed(0)}%
          </span>
        )}
      </div>
      {ev.title && <h4 className="mt-1 text-sm font-bold text-[#faf9f5]">{ev.title}</h4>}
      {ev.excerpt && <p className="mt-1 text-xs leading-relaxed text-[#a9a99f] sm:text-sm">{ev.excerpt}</p>}
    </article>
  );
}

export const EvidenceList = ({ items }: { items?: Evidence[] }) =>
  items && items.length ? (
    <div className="space-y-3">
      {items.map((e, i) => (
        <EvidenceCard key={e.citation_id ?? i} ev={e} />
      ))}
    </div>
  ) : (
    <Empty>No clinical references currently retrieved for this analysis.</Empty>
  );

export function SafetyRules({ a }: { a?: RiskAssessment }) {
  if (!a?.triggered_safety_rules?.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-[#fb7185] bg-[#fb7185]/10 p-4 shadow-sm shadow-black/20">
      <Overline className="text-[#fb7185]">Deterministic Safety Red-Flags (Authoritative)</Overline>
      <ul className="mt-2 space-y-2">
        {a.triggered_safety_rules.map((r) => (
          <li key={r.rule_id} className="text-xs text-[#a9a99f] sm:text-sm">
            <span className="mr-2 font-mono font-bold text-[#fb7185]">[{r.rule_id}]</span>
            {r.reason}
            <span className="block font-mono text-[11px] text-[#a9a99f]">
              {r.condition} → {r.forced_care_level}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const VITAL_META: Array<{ key: keyof Vitals; label: string; unit: string }> = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
  { key: 'spo2', label: 'SpO2', unit: '%' },
  { key: 'respiratory_rate', label: 'Resp Rate', unit: '/min' },
  { key: 'temperature', label: 'Temp', unit: '°C' },
];

export function VitalsGrid({ v, badge }: { v?: Vitals; badge?: ReactNode }) {
  if (!v || !Object.keys(v).length) return <Empty>No vitals recorded on this assessment.</Empty>;
  return (
    <div>
      {badge && <div className="mb-3">{badge}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {VITAL_META.map((m) => (
          <div key={m.key} className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-4 shadow-sm shadow-black/20">
            <p className="text-[11px] text-[#a9a99f]">{m.label}</p>
            <p className="font-mono text-3xl font-extrabold tabular-nums text-[#d97757] sm:text-4xl">
              {v[m.key] ?? '—'}
            </p>
            <p className="text-xs text-[#a9a99f]">{m.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function buildPassport(p?: Patient, a?: RiskAssessment, c?: EmergencyCase, v?: Vitals) {
  return {
    format: 'FAME-GENIX handover summary (structured; FHIR/HL7 conformance modeled)',
    generated_at: new Date().toISOString(),
    patient_public_id: p?.public_id ?? null,
    case_id: c?.public_id ?? c?.id ?? null,
    patient: p
      ? {
          name: p.full_name,
          age: p.age ?? null,
          sex: p.sex ?? null,
          blood_group: p.blood_group ?? null,
          known_conditions: p.known_conditions ?? null,
          allergies: p.allergies ?? null,
          emergency_contacts: {
            primary: { name: p.emergency_contact_name ?? null, phone: p.emergency_contact_phone ?? null },
            secondary: { name: p.secondary_contact_name ?? null, phone: p.secondary_contact_phone ?? null },
          },
        }
      : null,
    assessment: a
      ? {
          id: a.id,
          risk_score: a.risk_score,
          care_level: a.care_level,
          symptoms: a.active_symptoms ?? [],
          triggered_safety_rules: (a.triggered_safety_rules ?? []).map((r) => r.rule_id),
        }
      : null,
    vitals: {
      heart_rate: { value: v?.heart_rate ?? null, unit: 'bpm' },
      spo2: { value: v?.spo2 ?? null, unit: '%' },
      respiratory_rate: { value: v?.respiratory_rate ?? null, unit: '/min' },
      temperature: { value: v?.temperature ?? null, unit: '°C' },
    },
    emergency_status: c?.status ?? null,
  };
}

export function HandoverPassportModal({
  passport,
  onClose,
}: {
  passport: ReturnType<typeof buildPassport>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(passport, null, 2);
  return (
    <Modal title="Digital Emergency Handover Passport" onClose={onClose}>
      <p className="mb-2 text-xs text-[#a9a99f]">
        Assembled from live patient, assessment, and emergency case telemetry. Ready for transit handoff.
      </p>
      <pre className="max-h-[55vh] overflow-auto rounded-xl border border-[#3e3e38] bg-[#1b1b19] p-3 font-mono text-[11px] text-[#d97757]">
        {json}
      </pre>
      <div className="mt-4 flex justify-between">
        <Btn
          className="flex items-center gap-2"
          onClick={async () => {
            await navigator.clipboard.writeText(json);
            setCopied(true);
          }}
        >
          <Copy size={16} />
          {copied ? 'Copied' : 'Copy JSON'}
        </Btn>
        <Btn tone="ghost" onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}

/** Rich Patient Clinical Dossier Drawer/Modal */
export function ClinicalDossierModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const dossier = useLoad(() => api.clinicalDossier(patientId), [patientId]);
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();

  const downloadPdf = async () => {
    setDownloading(true);
    setErr(undefined);
    try {
      await api.downloadHealthPdf(patientId);
      setMsg('PDF generated and downloaded successfully.');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setDownloading(false);
    }
  };

  const d = dossier.data;

  return (
    <Modal title="Patient Clinical Dossier & Case Record" onClose={onClose} maxWidth="max-w-3xl">
      {dossier.loading ? (
        <Loading label="Fetching verified clinical dossier…" />
      ) : dossier.error ? (
        <ErrorState message={dossier.error} retry={dossier.reload} />
      ) : !d ? (
        <Empty>No dossier found for this patient.</Empty>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#3e3e38] bg-[#2c2c2b] p-4">
            <div>
              <span className="font-mono text-xs text-[#d97757] font-bold">UHID: {d.public_uhid}</span>
              <h3 className="text-xl font-bold text-[#faf9f5]">{d.full_name}</h3>
              <p className="text-xs text-[#a9a99f]">
                {[d.age && `${d.age} yrs`, d.sex, d.blood_group && `Blood Group: ${d.blood_group}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <Btn onClick={downloadPdf} disabled={downloading} className="flex items-center gap-2">
              <Download size={16} />
              {downloading ? 'Compiling PDF…' : 'Download Health Summary PDF'}
            </Btn>
          </div>

          {msg && <p className="text-xs text-[#41d69a]">{msg}</p>}
          {err && <ErrorState message={err} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3">
              <Overline>Primary SOS Emergency Contact</Overline>
              <p className="mt-1 text-sm font-bold text-[#faf9f5]">{d.contacts?.primary_sos?.name || 'Not Listed'}</p>
              <p className="text-xs text-[#a9a99f] flex items-center gap-1">
                <Phone size={12} /> {d.contacts?.primary_sos?.phone || 'No phone'}
              </p>
              <p className="text-[11px] text-[#d97757]">
                {d.contacts?.primary_sos?.relationship || 'Primary Guardian'}
              </p>
            </div>
            <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3">
              <Overline>Secondary SOS Emergency Contact</Overline>
              <p className="mt-1 text-sm font-bold text-[#faf9f5]">{d.contacts?.secondary_sos?.name || 'Not Listed'}</p>
              <p className="text-xs text-[#a9a99f] flex items-center gap-1">
                <Phone size={12} /> {d.contacts?.secondary_sos?.phone || 'No phone'}
              </p>
              <p className="text-[11px] text-[#d97757]">
                {d.contacts?.secondary_sos?.relationship || 'Secondary Contact'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3">
              <Overline>Verified Allergies & Intercepts</Overline>
              {d.medical_background?.allergies?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.medical_background.allergies.map((a, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-[#fb7185] bg-[#fb7185]/10 px-2 py-0.5 text-xs font-semibold text-[#fb7185]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-[#a9a99f]">No known drug allergies documented.</p>
              )}
            </div>
            <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3">
              <Overline>Chronic Conditions</Overline>
              {d.medical_background?.known_conditions?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.medical_background.known_conditions.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-[#f2b955] bg-[#f2b955]/10 px-2 py-0.5 text-xs font-semibold text-[#f2b955]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-[#a9a99f]">None documented.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3">
            <Overline>Longitudinal Case Statistics</Overline>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-[#1b1b19]">
                <p className="text-xl font-mono font-bold text-[#faf9f5]">
                  {d.case_history?.total_assessments ?? 0}
                </p>
                <p className="text-[10px] text-[#a9a99f]">Total Risk Assessments</p>
              </div>
              <div className="p-2 rounded-lg bg-[#1b1b19]">
                <p className="text-xl font-mono font-bold text-[#d97757]">
                  {d.case_history?.total_consultations ?? 0}
                </p>
                <p className="text-[10px] text-[#a9a99f]">Doctor Consultations</p>
              </div>
              <div className="p-2 rounded-lg bg-[#1b1b19]">
                <p className="text-xl font-mono font-bold text-[#fb7185]">
                  {d.case_history?.emergency_incidents ?? 0}
                </p>
                <p className="text-[10px] text-[#a9a99f]">Emergency Incidents</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** WebBluetooth Hardware Pairing Modal */
export function BluetoothPairModal({ onClose }: { onClose: () => void }) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();

  const scan = async () => {
    setScanning(true);
    setErr(undefined);
    try {
      const res = await api.bluetoothScan();
      setDevices(res);
      setMsg(`Discovered ${res.length} nearby medical telemetry peripherals.`);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    void scan();
  }, []);

  const togglePair = async (d: BluetoothDevice) => {
    setBusyId(d.device_id);
    setErr(undefined);
    try {
      if (d.pairing_status === 'CONNECTED') {
        await api.bluetoothUnpair(d.device_id);
        setDevices((prev) =>
          prev.map((item) => (item.device_id === d.device_id ? { ...item, pairing_status: 'UNPAIRED' } : item))
        );
        setMsg(`Disconnected from ${d.name}.`);
      } else {
        await api.bluetoothPair(d.device_id);
        setDevices((prev) =>
          prev.map((item) => (item.device_id === d.device_id ? { ...item, pairing_status: 'CONNECTED' } : item))
        );
        setMsg(`Successfully paired with ${d.name} via GATT service handshake.`);
      }
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <Modal title="WebBluetooth BLE Device Discovery & Pairing" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#a9a99f]">
            Pair with FAME Smart Mask telemetry hardware, Smart Helmets, or Ambient Sensors.
          </p>
          <Btn onClick={scan} disabled={scanning} tone="ghost" className="flex items-center gap-1.5 text-xs">
            <Radio size={14} className={scanning ? 'animate-pulse text-[#d97757]' : ''} />
            {scanning ? 'Scanning…' : 'Re-Scan'}
          </Btn>
        </div>

        {msg && <p className="text-xs text-[#41d69a]">{msg}</p>}
        {err && <ErrorState message={err} />}

        <div className="space-y-2">
          {devices.map((d) => (
            <div
              key={d.device_id}
              className="flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 grid h-9 w-9 place-items-center rounded-xl border ${
                    d.pairing_status === 'CONNECTED'
                      ? 'border-[#41d69a] bg-[#41d69a]/10 text-[#41d69a]'
                      : 'border-[#3e3e38] bg-[#1b1b19] text-[#a9a99f]'
                  }`}
                >
                  <Bluetooth size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#faf9f5]">{d.name}</h4>
                  <p className="font-mono text-[11px] text-[#a9a99f]">
                    {d.device_id} · {d.hardware_type}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[#a9a99f]">
                    <span className="flex items-center gap-1">
                      <Battery size={12} /> {d.battery_percent}%
                    </span>
                    <span>RSSI: {d.rssi_dbm} dBm</span>
                    <span className="font-mono text-[#d97757]">{d.gatt_services?.join(', ')}</span>
                  </div>
                </div>
              </div>
              <Btn
                onClick={() => void togglePair(d)}
                disabled={busyId === d.device_id}
                tone={d.pairing_status === 'CONNECTED' ? 'rose' : 'cyan'}
                className="text-xs"
              >
                {busyId === d.device_id
                  ? 'Processing…'
                  : d.pairing_status === 'CONNECTED'
                  ? 'Disconnect'
                  : 'Pair Device'}
              </Btn>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Multi-Agent Medical Society Consensus Modal */
export function MultiAgentConsensusModal({
  onClose,
  initialData,
}: {
  onClose: () => void;
  initialData?: {
    symptom_text?: string;
    vitals?: Record<string, number>;
    conditions?: string;
    allergies?: string;
  };
}) {
  const [symptomText, setSymptomText] = useState(
    initialData?.symptom_text ?? 'Acute chest tightness, sudden dyspnea, and dizziness on exertion'
  );
  const [conditions, setConditions] = useState(initialData?.conditions ?? 'Hypertension, Mild Renal Impairment');
  const [allergies, setAllergies] = useState(initialData?.allergies ?? 'Sulfa Drugs');
  const [busy, setBusy] = useState(false);
  const [consensus, setConsensus] = useState<MultiAgentConsensus | null>(null);
  const [err, setErr] = useState<string>();

  const runSociety = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await api.multiAgentConsensus({
        symptom_text: symptomText,
        vitals: initialData?.vitals ?? { hr: 118, spo2: 89, rr: 26, temp: 37.1 },
        conditions,
        allergies,
        lab_values: { creatinine: 1.9, egfr: 48 },
      });
      setConsensus(res);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Multi-Agent Medical Society Deliberation" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <p className="text-xs text-[#a9a99f]">
          Simulates multi-specialist deliberation across specialized clinical agents (Cardiology, Pulmonology,
          Nephrology/Metabolic, Pharmacotherapy) with safety critique validation.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold text-[#faf9f5]">Clinical Symptoms Description</label>
            <input
              className={fieldCls}
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder="Symptoms"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#faf9f5]">Documented Conditions & Allergies</label>
            <div className="flex gap-2">
              <input
                className={fieldCls}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Conditions"
              />
              <input
                className={fieldCls}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Allergies"
              />
            </div>
          </div>
        </div>

        <Btn onClick={runSociety} disabled={busy} className="w-full flex items-center justify-center gap-2">
          <Sparkles size={16} />
          {busy ? 'Deliberating across clinical specialists…' : 'Convene Multi-Agent Medical Society'}
        </Btn>

        {err && <ErrorState message={err} />}

        {consensus && (
          <div className="space-y-3 border-t border-[#3e3e38] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
              <div>
                <Overline>Consensus Triage Acuity</Overline>
                <h4 className="text-lg font-bold text-[#faf9f5]">{consensus.primary_triage_acuity}</h4>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs text-[#d97757]">
                  Confidence: {(consensus.confidence_score * 100).toFixed(0)}%
                </span>
                <p className="text-xs text-[#41d69a] flex items-center justify-end gap-1">
                  <CheckCircle2 size={12} /> {consensus.safety_critique.guideline_conformance}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Overline>Specialist Society Agents</Overline>
              {consensus.participating_agents.map((agent) => (
                <div key={agent.agent_id} className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#faf9f5] flex items-center gap-1.5">
                      <Stethoscope size={14} className="text-[#d97757]" /> {agent.agent_name} ({agent.specialty})
                    </span>
                    <span className="font-mono text-[10px] text-[#f2b955] uppercase">{agent.urgency_level}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#a9a99f]">{agent.assessment}</p>
                  {agent.contraindications_detected?.length > 0 && (
                    <div className="mt-2 rounded-lg bg-[#fb7185]/10 p-2 border border-[#fb7185]">
                      <p className="text-[11px] font-bold text-[#fb7185]">Contraindication Alert Intercept:</p>
                      <ul className="list-disc pl-4 text-[10px] text-[#fb7185]">
                        {agent.contraindications_detected.map((ci, i) => (
                          <li key={i}>{ci}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {agent.suggested_interventions?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {agent.suggested_interventions.map((si, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-[#3e3e38] bg-[#1b1b19] px-2 py-0.5 text-[10px] text-[#faf9f5]"
                        >
                          {si}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#41d69a]/40 bg-[#41d69a]/10 p-3">
              <Overline className="text-[#41d69a]">Safety Evaluator Critique</Overline>
              <p className="mt-1 text-xs text-[#faf9f5]">{consensus.safety_critique.adherence_notes}</p>
              <p className="mt-1 font-mono text-[11px] text-[#a9a99f]">
                Final Consensus Decision: {consensus.final_decision}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Regional Hospital Resource Grid Modal */
export function HospitalGridModal({ onClose }: { onClose: () => void }) {
  const grid = useLoad(api.hospitalGrid, [], 10000);

  return (
    <Modal title="Metropolitan Regional Hospital & ICU Resource Grid" onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <p className="text-xs text-[#a9a99f]">
          Real-time metropolitan emergency departments, ICU bed capacity, Cath Lab readiness, and trauma bay
          availability for emergency routing.
        </p>

        {grid.loading ? (
          <Loading label="Polling regional hospital resources…" />
        ) : grid.error ? (
          <ErrorState message={grid.error} retry={grid.reload} />
        ) : !grid.data?.length ? (
          <Empty>No hospital facilities reported in current zone.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {grid.data.map((h) => (
              <div
                key={h.id}
                className={`rounded-2xl border p-4 shadow-sm transition ${
                  h.status === 'DIVERT' || h.status === 'SATURATED'
                    ? 'border-[#fb7185] bg-[#fb7185]/5'
                    : h.status === 'WARNING'
                    ? 'border-[#f2b955] bg-[#f2b955]/5'
                    : 'border-[#3e3e38] bg-[#2c2c2b]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] text-[#d97757] font-bold">Level {h.trauma_level} Trauma</span>
                    <h4 className="text-sm font-bold text-[#faf9f5]">{h.name}</h4>
                    <p className="text-xs text-[#a9a99f]">
                      {h.distance_km} km · ETA ~{h.estimated_eta_min} min
                    </p>
                  </div>
                  <span
                    className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] font-bold ${
                      h.status === 'NORMAL'
                        ? 'border-[#41d69a] bg-[#41d69a]/10 text-[#41d69a]'
                        : h.status === 'WARNING'
                        ? 'border-[#f2b955] bg-[#f2b955]/10 text-[#f2b955]'
                        : 'border-[#fb7185] bg-[#fb7185]/10 text-[#fb7185]'
                    }`}
                  >
                    {h.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[#1b1b19] p-2">
                    <p className="text-[10px] text-[#a9a99f]">ICU Beds Available</p>
                    <p className="font-mono text-lg font-bold text-[#faf9f5]">
                      {h.available_icu_beds}{' '}
                      <span className="text-xs font-normal text-[#a9a99f]">/ {h.total_icu_beds}</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#1b1b19] p-2">
                    <p className="text-[10px] text-[#a9a99f]">Ventilators Ready</p>
                    <p className="font-mono text-lg font-bold text-[#faf9f5]">{h.ventilators_available}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-[#a9a99f] border-t border-[#3e3e38] pt-2">
                  <span>
                    Cath Lab:{' '}
                    <strong className={h.cath_lab_operational ? 'text-[#41d69a]' : 'text-[#fb7185]'}>
                      {h.cath_lab_operational ? 'OPERATIONAL' : 'OFFLINE'}
                    </strong>
                  </span>
                  <span>
                    Stroke Team:{' '}
                    <strong className={h.stroke_team_ready ? 'text-[#41d69a]' : 'text-[#fb7185]'}>
                      {h.stroke_team_ready ? 'READY' : 'STANDBY'}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Unified Portal Operational Settings Modal */
export function PortalSettingsModal({ onClose }: { onClose: () => void }) {
  const settingsData = useLoad(api.portalSettings, []);
  const [localSettings, setLocalSettings] = useState<PortalSettings>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    if (settingsData.data?.settings) {
      setLocalSettings(settingsData.data.settings);
    }
  }, [settingsData.data]);

  const save = async () => {
    setSaving(true);
    setErr(undefined);
    try {
      const res = await api.updatePortalSettings(localSettings);
      setMsg(res.message || 'Settings saved successfully.');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Unified Portal Operational Settings" onClose={onClose}>
      <div className="space-y-4">
        {settingsData.loading ? (
          <Loading label="Loading operational preferences…" />
        ) : settingsData.error ? (
          <ErrorState message={settingsData.error} retry={settingsData.reload} />
        ) : (
          <div className="space-y-3">
            <Overline>Role Preferences: {settingsData.data?.role}</Overline>

            {Object.entries(localSettings).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3"
              >
                <div>
                  <p className="text-xs font-bold text-[#faf9f5] capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="font-mono text-[10px] text-[#a9a99f]">{key}</p>
                </div>
                {typeof value === 'boolean' ? (
                  <button
                    onClick={() => setLocalSettings((prev) => ({ ...prev, [key]: !value }))}
                    className={`rounded-lg px-3 py-1 font-mono text-xs font-bold transition ${
                      value ? 'bg-[#41d69a] text-[#1a1915]' : 'bg-[#1b1b19] text-[#a9a99f]'
                    }`}
                  >
                    {value ? 'ENABLED' : 'DISABLED'}
                  </button>
                ) : typeof value === 'number' ? (
                  <input
                    type="number"
                    className={`${fieldCls} w-24 text-right`}
                    value={value}
                    onChange={(e) => setLocalSettings((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  />
                ) : (
                  <input
                    type="text"
                    className={`${fieldCls} w-44`}
                    value={String(value)}
                    onChange={(e) => setLocalSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {msg && <p className="text-xs text-[#41d69a]">{msg}</p>}
            {err && <ErrorState message={err} />}

            <Btn onClick={save} disabled={saving} className="w-full">
              {saving ? 'Saving preferences…' : 'Save Operational Preferences'}
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}

export const SecureNote = () => (
  <p className="flex items-center gap-1 text-[11px] text-[#a9a99f]">
    <Lock size={12} />
    Authenticated session
  </p>
);

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-[#3e3e38]/60 ${className}`} />
);

export const LIFECYCLE_STAGES: EmergencyStatus[] = [
  'DETECTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'DISPATCH_REQUESTED',
  'DISPATCHED',
  'EN_ROUTE',
  'ON_SCENE',
  'TRANSPORTING',
  'HOSPITAL_REACHED',
  'COMPLETED',
];

export function IncidentStepper({
  currentStatus,
  onSelectStatus,
  editable = false,
}: {
  currentStatus: EmergencyStatus;
  onSelectStatus?: (status: EmergencyStatus) => void;
  editable?: boolean;
}) {
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStatus);

  return (
    <div className="w-full rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-[#3e3e38] pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#d97757] animate-ping" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
            10-Stage Emergency Dispatch State Machine
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-[#d97757]">
          STAGE {currentIndex >= 0 ? currentIndex + 1 : 1} OF {LIFECYCLE_STAGES.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 lg:grid-cols-10">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isDone = currentIndex > idx;
          const isCurrent = currentIndex === idx;

          return (
            <button
              key={stage}
              type="button"
              disabled={!editable}
              onClick={() => editable && onSelectStatus?.(stage)}
              className={`flex flex-col items-center justify-between rounded-xl border p-2 text-center transition ${
                isCurrent
                  ? 'border-[#d97757] bg-[#d97757]/15 text-[#faf9f5] ring-2 ring-[#d97757]/40 shadow-md'
                  : isDone
                  ? 'border-[#41d69a]/40 bg-[#41d69a]/10 text-[#41d69a]'
                  : 'border-[#3e3e38] bg-[#2c2c2b] text-[#77766e] opacity-60'
              } ${editable && !isCurrent ? 'hover:border-[#d97757] hover:opacity-100 cursor-pointer' : ''}`}
            >
              <span className="font-mono text-[9px] font-bold">
                {isDone ? '✓' : `0${idx + 1}`}
              </span>
              <span className="mt-1 line-clamp-1 font-mono text-[10px] font-bold uppercase">
                {stage.replace(/_/g, ' ')}
              </span>
              <span
                className={`mt-1.5 h-1.5 w-full rounded-full ${
                  isCurrent ? 'bg-[#d97757] animate-pulse' : isDone ? 'bg-[#41d69a]' : 'bg-[#3e3e38]'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EvidenceChainNode({
  detectedSignal,
  clinicalRule,
  evidenceCitation,
  recommendedAction,
}: {
  detectedSignal: string;
  clinicalRule: string;
  evidenceCitation: string;
  recommendedAction: string;
}) {
  return (
    <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-[#3e3e38] pb-2">
        <span className="font-mono text-[11px] font-bold text-[#d97757] uppercase tracking-wider">
          Evidence-Grounded Reasoning Path
        </span>
        <span className="rounded-md border border-[#41d69a]/40 bg-[#41d69a]/10 px-2 py-0.5 font-mono text-[10px] text-[#41d69a]">
          VERIFIED BY PRIMARY SOURCES
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 text-xs">
        <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-2.5">
          <p className="font-mono text-[10px] font-bold text-[#a9a99f] uppercase">1. Patient Signal</p>
          <p className="mt-1 font-semibold text-[#faf9f5]">{detectedSignal}</p>
        </div>
        <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-2.5">
          <p className="font-mono text-[10px] font-bold text-[#a9a99f] uppercase">2. Algorithmic Rule</p>
          <p className="mt-1 font-semibold text-[#f2b955]">{clinicalRule}</p>
        </div>
        <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-2.5">
          <p className="font-mono text-[10px] font-bold text-[#a9a99f] uppercase">3. Primary Evidence</p>
          <p className="mt-1 font-semibold text-[#9c87f5]">{evidenceCitation}</p>
        </div>
        <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-2.5">
          <p className="font-mono text-[10px] font-bold text-[#a9a99f] uppercase">4. Clinical Order</p>
          <p className="mt-1 font-semibold text-[#41d69a]">{recommendedAction}</p>
        </div>
      </div>
    </div>
  );
}

export function FieldProtocolChecklist({
  protocols,
  onToggle,
}: {
  protocols: Array<{ id: string; label: string; checked: boolean; required: boolean }>;
  onToggle: (id: string) => void;
}) {
  const completedCount = protocols.filter((p) => p.checked).length;
  const progressPct = Math.round((completedCount / protocols.length) * 100);

  return (
    <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-[#3e3e38] pb-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
            Pre-Hospital Critical Resuscitation Checklist
          </h4>
          <p className="text-[10px] text-[#a9a99f]">Standardized STEMI / Trauma emergency protocols</p>
        </div>
        <span className="font-mono text-xs font-bold text-[#41d69a]">
          {completedCount}/{protocols.length} ({progressPct}%)
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[#2c2c2b] overflow-hidden">
        <div
          className="h-full bg-[#41d69a] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {protocols.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
              p.checked
                ? 'border-[#41d69a]/40 bg-[#41d69a]/10 text-[#41d69a]'
                : 'border-[#3e3e38] bg-[#2c2c2b] text-[#faf9f5] hover:border-[#52514a]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-5 w-5 place-items-center rounded-lg border font-mono text-[11px] font-bold ${
                  p.checked
                    ? 'border-[#41d69a] bg-[#41d69a] text-[#1a1915]'
                    : 'border-[#52514a] bg-[#1b1b19] text-[#77766e]'
                }`}
              >
                {p.checked ? '✓' : ''}
              </span>
              <span className={`text-xs font-semibold ${p.checked ? 'line-through opacity-80' : ''}`}>
                {p.label}
              </span>
            </div>
            {p.required && (
              <span className="rounded-md border border-[#fb7185]/40 bg-[#fb7185]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#fb7185]">
                MANDATORY
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Patient Health Profile & Clinical Notes Editor Modal
 * Selectively migrated and redesigned from FAME-GENIX V1 with Amber theme aesthetics.
 */
export function PatientProfileModal({
  patient,
  onClose,
  onProfileUpdated,
}: {
  patient: Patient | null;
  onClose: () => void;
  onProfileUpdated: (updated: Patient) => void;
}) {
  const [fullName, setFullName] = useState(patient?.full_name ?? '');
  const [age, setAge] = useState<number | ''>(patient?.age ?? '');
  const [sex, setSex] = useState(patient?.sex ?? '');
  const [bloodGroup, setBloodGroup] = useState(patient?.blood_group ?? '');
  const [heightCm, setHeightCm] = useState<number | ''>(patient?.height_cm ?? '');
  const [weightKg, setWeightKg] = useState<number | ''>(patient?.weight_kg ?? '');
  const [knownConditions, setKnownConditions] = useState(patient?.known_conditions ?? '');
  const [allergies, setAllergies] = useState(patient?.allergies ?? '');
  const [emergencyName, setEmergencyName] = useState(patient?.emergency_contact_name ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(patient?.emergency_contact_phone ?? '');
  const [secondaryName, setSecondaryName] = useState(patient?.secondary_contact_name ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(patient?.secondary_contact_phone ?? '');

  const [notes, setNotes] = useState<Array<{ id: string; note_text: string; created_at: string }>>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    api
      .myNotes()
      .then(setNotes)
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.updateMyProfile({
        full_name: fullName,
        age: age === '' ? undefined : Number(age),
        sex: sex || undefined,
        blood_group: bloodGroup || undefined,
        height_cm: heightCm === '' ? undefined : Number(heightCm),
        weight_kg: weightKg === '' ? undefined : Number(weightKg),
        known_conditions: knownConditions || undefined,
        allergies: allergies || undefined,
        emergency_contact_name: emergencyName || undefined,
        emergency_contact_phone: emergencyPhone || undefined,
        secondary_contact_name: secondaryName || undefined,
        secondary_contact_phone: secondaryPhone || undefined,
      });
      onProfileUpdated(updated);
      setMsg({ type: 'ok', text: 'Personal health profile successfully updated and synchronized.' });
    } catch (x) {
      setMsg({ type: 'err', text: errMsg(x) });
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const created = await api.createNote(newNote.trim());
      setNotes((prev) => [created, ...prev]);
      setNewNote('');
      setMsg({ type: 'ok', text: 'Clinical health note recorded.' });
    } catch (x) {
      setMsg({ type: 'err', text: errMsg(x) });
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setMsg({ type: 'ok', text: 'Health note removed.' });
    } catch (x) {
      setMsg({ type: 'err', text: errMsg(x) });
    }
  };

  return (
    <Modal title="Personal Health Profile & Longitudinal Journal" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-6">
        {msg && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold ${
              msg.type === 'ok'
                ? 'border-[#41d69a]/40 bg-[#41d69a]/10 text-[#41d69a]'
                : 'border-[#fb7185]/40 bg-[#fb7185]/10 text-[#fb7185]'
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[#3e3e38] pb-2">
            <User size={16} className="text-[#d97757]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">Core Demographic & Physical Vitals</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#faf9f5]">Full Legal Name</label>
              <input
                className={fieldCls}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Age</label>
              <input
                type="number"
                className={fieldCls}
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Years"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Biological Sex</label>
              <select className={fieldCls} value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Blood Group</label>
              <select className={fieldCls} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Height (cm)</label>
              <input
                type="number"
                className={fieldCls}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 175"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Weight (kg)</label>
              <input
                type="number"
                className={fieldCls}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 72"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Known Chronic Conditions</label>
              <input
                className={fieldCls}
                value={knownConditions}
                onChange={(e) => setKnownConditions(e.target.value)}
                placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Known Allergies</label>
              <input
                className={fieldCls}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Peanuts, Sulfa Drugs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-[#3e3e38] pt-2 pb-2">
            <Phone size={16} className="text-[#fb7185]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">Emergency Next-of-Kin Contacts</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Primary Contact Name</label>
              <input
                className={fieldCls}
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Next-of-kin name"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Primary Contact Phone</label>
              <input
                className={fieldCls}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+91 / +1 Contact number"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Secondary Contact Name (Optional)</label>
              <input
                className={fieldCls}
                value={secondaryName}
                onChange={(e) => setSecondaryName(e.target.value)}
                placeholder="Alternate contact name"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#faf9f5]">Secondary Contact Phone</label>
              <input
                className={fieldCls}
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="Alternate phone number"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Btn type="submit" disabled={saving} className="flex items-center gap-2">
              <Save size={14} />
              {saving ? 'Synchronizing…' : 'Save Health Profile'}
            </Btn>
          </div>
        </form>

        {/* Longitudinal Clinical Health Notes */}
        <div className="space-y-3 border-t border-[#3e3e38] pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#9c87f5]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                Longitudinal Health Notes & Diary
              </h3>
            </div>
            <span className="font-mono text-[11px] text-[#a9a99f]">{notes.length} notes recorded</span>
          </div>

          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              className={fieldCls}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Record a timestamped clinical symptom observation, medication change, or query…"
            />
            <Btn type="submit" tone="ghost" disabled={savingNote || !newNote.trim()} className="flex items-center gap-1.5 text-xs">
              <Plus size={14} />
              {savingNote ? 'Adding…' : 'Add Note'}
            </Btn>
          </form>

          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            {notes.length === 0 ? (
              <p className="text-xs text-[#77766e] italic">No health notes recorded yet. Add your first clinical note above.</p>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#3e3e38] bg-[#1b1b19] p-3 text-xs"
                >
                  <div className="space-y-1">
                    <p className="text-[#faf9f5] leading-relaxed">{n.note_text}</p>
                    <p className="font-mono text-[10px] text-[#77766e]">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(n.id)}
                    className="text-[#77766e] hover:text-[#fb7185] transition"
                    title="Delete Note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Conversational Clinical AI Assistant Modal
 * Selectively migrated from FAME-GENIX V1 with Amber theme aesthetics & clinical guardrails.
 */
export function ClinicalChatModal({
  onClose,
  initialRole = 'PATIENT',
  patientContext,
}: {
  onClose: () => void;
  initialRole?: 'PATIENT' | 'DOCTOR';
  patientContext?: { name?: string; age?: number; conditions?: string };
}) {
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      specialty?: string;
      safetyLevel?: string;
      reviewRequired?: boolean;
    }>
  >([
    {
      role: 'assistant',
      content: `Hello! I am **FAME Clinical AI Companion**.\n\nI can help evaluate symptoms, explain assessment risk scores, summarize vitals drift, or search clinical evidence guidelines.\n\n${
        patientContext?.name ? `Patient active: **${patientContext.name}**` : ''
      }`,
      specialty: 'Clinical AI',
      safetyLevel: 'NORMAL',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (textToSend?: string) => {
    const prompt = (textToSend ?? input).trim();
    if (!prompt || busy) return;
    setInput('');
    setErr(undefined);

    const nextMessages = [...messages, { role: 'user' as const, content: prompt }];
    setMessages(nextMessages);
    setBusy(true);

    try {
      const history = nextMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chat({ message: prompt, history });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.message,
          specialty: res.suggested_specialty,
          safetyLevel: res.safety_level,
          reviewRequired: res.requires_professional_review,
        },
      ]);
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  const quickPrompts =
    initialRole === 'DOCTOR'
      ? [
          'Generate differential diagnosis for chest discomfort & diaphoresis',
          'Review antiplatelet guidelines for suspected ACS',
          'Summarize high-risk clinical findings on active patient',
        ]
      : [
          'Explain what my current health risk level means',
          'What foods or lifestyle habits help lower blood pressure?',
          'When should I contact emergency services for shortness of breath?',
        ];

  return (
    <Modal title="Clinical AI Health Assistant" onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col h-[65vh]">
        {/* Chat Message Scrollport */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#d97757] text-[#1a1915] font-medium'
                    : 'bg-[#1b1b19] border border-[#3e3e38] text-[#faf9f5]'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#3e3e38]">
                    <Bot size={14} className="text-[#d97757]" />
                    <span className="font-mono text-[10px] font-bold text-[#d97757]">
                      FAME Clinical Intelligence
                    </span>
                    {m.specialty && (
                      <span className="rounded-md border border-[#3e3e38] bg-[#2c2c2b] px-1.5 py-0.5 font-mono text-[9px] text-[#a9a99f]">
                        {m.specialty}
                      </span>
                    )}
                    {m.safetyLevel && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                          m.safetyLevel === 'CRITICAL'
                            ? 'bg-[#fb7185]/20 text-[#fb7185]'
                            : m.safetyLevel === 'MONITOR'
                            ? 'bg-[#f2b955]/20 text-[#f2b955]'
                            : 'bg-[#41d69a]/20 text-[#41d69a]'
                        }`}
                      >
                        {m.safetyLevel}
                      </span>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-line">{m.content}</div>
                {m.reviewRequired && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#f2b955]">
                    <ShieldCheck size={12} />
                    <span>Clinical Physician Review Recommended</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-[#d97757] p-2">
              <Bot size={14} className="animate-pulse" />
              <span>Consulting clinical evidence model…</span>
            </div>
          )}

          {err && <ErrorState message={err} />}
          <div ref={endRef} />
        </div>

        {/* Quick prompt chips */}
        <div className="py-2 flex flex-wrap gap-1.5 border-t border-[#3e3e38] mt-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => send(p)}
              disabled={busy}
              className="rounded-lg border border-[#3e3e38] bg-[#1b1b19] px-2.5 py-1 text-[11px] text-[#a9a99f] hover:border-[#d97757] hover:text-[#faf9f5] transition"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Composer Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 pt-2 border-t border-[#3e3e38]"
        >
          <input
            className={fieldCls}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your medical query, symptoms, or medication question…"
            disabled={busy}
          />
          <Btn type="submit" disabled={busy || !input.trim()} className="flex items-center gap-1.5 px-4">
            <Send size={14} />
            <span>Send</span>
          </Btn>
        </form>
      </div>
    </Modal>
  );
}

