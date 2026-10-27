import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertOctagon,
  Battery,
  Bluetooth,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  Phone,
  Radio,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { api, errMsg } from './api';
import type {
  BluetoothDevice,
  CareLevel,
  EmergencyCase,
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
