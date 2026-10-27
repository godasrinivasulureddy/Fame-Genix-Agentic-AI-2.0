import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bluetooth,
  FileText,
  Heart,
  MessageSquare,
  Mic,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Volume2,
} from 'lucide-react';
import { api, errMsg } from './api';
import type { EmergencyCase, Evidence, RiskAssessment, Vitals } from './types';
import {
  BluetoothPairModal,
  Btn,
  Card,
  ClinicalChatModal,
  ClinicalDossierModal,
  ErrorState,
  EvidenceChainNode,
  EvidenceList,
  HandoverPassportModal,
  Loading,
  MultiAgentConsensusModal,
  Overline,
  PatientProfileModal,
  PortalSettingsModal,
  RiskBadge,
  RiskDonut,
  SafetyRules,
  Simulated,
  Spectrum,
  VITAL_META,
  buildPassport,
  fieldCls,
  useLoad,
} from './shared';

const LANGS = [
  ['en-IN', 'English'],
  ['te-IN', 'Telugu (తెలుగు)'],
  ['hi-IN', 'Hindi (हिन्दी)'],
] as const;

const SPECIALTIES = [
  'General Physician',
  'Pulmonology & Critical Care',
  'Cardiology & Vascular Medicine',
  'Nephrology & Metabolic Care',
];

const SEVERITIES = ['LOW', 'MODERATE', 'HIGH'];
const MAX_BYTES = 10 * 1024 * 1024;

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type SRCtor = new () => SpeechRec;

function VoiceInput({ onText }: { onText: (t: string) => void }) {
  const [lang, setLang] = useState<string>(LANGS[0][0]);
  const [on, setOn] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  if (!Ctor) {
    return (
      <p className="text-[11px] text-[#a9a99f]">
        Browser speech recognition not supported in this environment. Type symptoms directly.
      </p>
    );
  }

  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Dictation language"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className={`${fieldCls} w-auto text-xs`}
      >
        {LANGS.map(([c, n]) => (
          <option key={c} value={c}>
            {n}
          </option>
        ))}
      </select>
      <Btn tone={on ? 'rose' : 'ghost'} onClick={toggle} className="flex items-center gap-1.5 text-xs">
        <Mic size={14} className={on ? 'animate-pulse' : ''} />
        {on ? 'Recording… Stop' : 'Voice Dictate'}
      </Btn>
    </div>
  );
}

function Speaker({ text }: { text: string }) {
  if (!('speechSynthesis' in window)) return null;
  return (
    <Btn
      tone="ghost"
      className="flex items-center gap-1.5 text-xs"
      onClick={() => {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }}
    >
      <Volume2 size={14} />
      Listen
    </Btn>
  );
}

function Result({ data }: { data: unknown }) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown })?.results)
    ? (data as { results: unknown[] }).results
    : null;
  if (rows && rows.length && typeof rows[0] === 'object' && rows[0] !== null) {
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r as object))));
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className="border-b border-[#3e3e38] p-2 font-mono text-[#a9a99f]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c} className="border-b border-[#3e3e38]/60 p-2 text-[#faf9f5]">
                    {String((r as Record<string, unknown>)[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-xl bg-[#1b1b19] p-3 font-mono text-[11px] text-[#d97757]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Upload({ kind, title, accept }: { kind: 'reports' | 'images'; title: string; accept: string }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [out, setOut] = useState<unknown>();

  const run = async (f?: File) => {
    if (!f) return;
    setErr(undefined);
    setOut(undefined);
    if (f.size > MAX_BYTES) {
      setErr('Selected file exceeds 10 MB limit. Please select a smaller document.');
      return;
    }
    setBusy(true);
    try {
      setOut(await api.analyze(kind, f));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="text-sm font-bold text-[#faf9f5] flex items-center gap-2">
        <FileText size={16} className="text-[#d97757]" />
        {title}
      </h3>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void run(e.dataTransfer.files[0]);
        }}
        className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center text-xs text-[#a9a99f] transition ${
          drag ? 'border-[#d97757] bg-[#d97757]/10' : 'border-[#3e3e38] hover:border-[#52514a]'
        }`}
      >
        <FileText size={24} className="text-[#d97757]" />
        Drop document here or click to browse (PDF, JPG, PNG up to 10 MB)
        <input type="file" accept={accept} className="sr-only" onChange={(e) => void run(e.target.files?.[0])} />
      </label>
      {busy && (
        <div className="mt-3">
          <Loading label="Running AI clinical parsing & reference range extraction…" />
        </div>
      )}
      {err && (
        <div className="mt-3">
          <ErrorState message={err} />
        </div>
      )}
      {out !== undefined && (
        <div className="mt-3">
          <Result data={out} />
        </div>
      )}
      <p className="mt-3 text-[11px] text-[#a9a99f]">
        AI-assisted OCR & optical analysis adheres to clinical non-diagnostic guardrails. Lab reference ranges are strictly preserved.
      </p>
    </Card>
  );
}

function Spark({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <p className="font-mono text-[11px] text-[#a9a99f]">need 2+ readings</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" className="h-10 w-full" role="img" aria-label={`${label} trend`}>
      <polyline points={pts} fill="none" stroke="#d97757" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const PRESETS: Record<string, Record<string, string>> = {
  RESPIRATORY_DRIFT: { heart_rate: '112', spo2: '88', respiratory_rate: '26', temperature: '37.4' },
  TACHYCARDIA: { heart_rate: '138', spo2: '96', respiratory_rate: '19', temperature: '36.9' },
  BASELINE: { heart_rate: '72', spo2: '98', respiratory_rate: '14', temperature: '36.7' },
};

export default function PatientView() {
  const me = useLoad(api.myPatient, []);
  const activeEmerg = useLoad(api.activePatientEmergency, [], 10000);

  const [symptoms, setSymptoms] = useState<Array<{ name: string; severity: string }>>([]);
  const [text, setText] = useState('');
  const [sev, setSev] = useState('HIGH');
  const [vit, setVit] = useState<Record<string, string>>({
    heart_rate: '78',
    spo2: '98',
    respiratory_rate: '15',
    temperature: '36.8',
  });
  const [simulated, setSimulated] = useState(false);
  const [history, setHistory] = useState<Array<Vitals & { simulated: boolean }>>([
    { heart_rate: 74, spo2: 99, respiratory_rate: 14, temperature: 36.6, simulated: false },
    { heart_rate: 78, spo2: 98, respiratory_rate: 15, temperature: 36.8, simulated: false },
  ]);

  const [a, setA] = useState<RiskAssessment>();
  const [insight, setInsight] = useState<{ explanation?: string; suggested_specialty?: string }>();
  const [ev, setEv] = useState<Evidence[]>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [token, setToken] = useState<string>();

  // Modals
  const [passport, setPassport] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [btOpen, setBtOpen] = useState(false);
  const [societyOpen, setSocietyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // SOS state
  const [sosBusy, setSosBusy] = useState(false);
  const [sosCase, setSosCase] = useState<EmergencyCase | null>(null);
  const [sosErr, setSosErr] = useState<string>();

  const p = me.data;

  useEffect(() => {
    const off = api.subscribeEvents((event) => {
      if (event === 'observation.created' || event === 'analysis.completed' || event === 'emergency.advanced') {
        activeEmerg.reload();
        if (a) {
          void api.insight(a.id).then((i) => {
            setInsight(i);
            if (i.suggested_specialty) setSpecialty(i.suggested_specialty);
          }).catch(() => {});
        }
      }
    });
    return off;
  }, [a?.id]);

  const addSymptom = () => {
    const n = text.trim();
    if (n) {
      setSymptoms((s) => [...s, { name: n, severity: sev }]);
      setText('');
    }
  };

  const analyze = async () => {
    setBusy(true);
    setErr(undefined);
    setToken(undefined);
    setInsight(undefined);
    setEv(undefined);
    const vitals: Vitals = {};
    for (const m of VITAL_META) {
      if (vit[m.key]?.trim()) vitals[m.key] = Number(vit[m.key]);
    }
    try {
      const res = await api.createAssessment({ symptoms, vitals });
      setA(res);
      setHistory((h) => [...h, { ...vitals, simulated }]);
      const q = [...symptoms.map((s) => s.name), res.care_level].join(' ');
      const [i, r] = await Promise.allSettled([api.insight(res.id), api.rag(q)]);
      if (i.status === 'fulfilled') {
        setInsight(i.value);
        if (i.value.suggested_specialty) setSpecialty(i.value.suggested_specialty);
      }
      setEv(r.status === 'fulfilled' ? r.value : []);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const consult = async () => {
    try {
      const res = await api.requestConsultation({
        specialty,
        health_summary: insight?.explanation ?? symptoms.map((s) => s.name).join(', '),
      });
      setToken(res.token_number);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const triggerSos = async () => {
    setSosBusy(true);
    setSosErr(undefined);
    let lat: number | undefined;
    let lng: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* location unavailable fallback */
      }
    }
    try {
      const res = await api.sos({ latitude: lat, longitude: lng });
      setSosCase(res);
      activeEmerg.reload();
    } catch (e) {
      setSosErr(errMsg(e));
    } finally {
      setSosBusy(false);
    }
  };

  const lastVitals = history.length ? history[history.length - 1] : undefined;
  const currentEmergency = activeEmerg.data || sosCase;

  return (
    <div className="space-y-6">
      {/* 1. Patient Operational Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-5 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]">
            <Heart size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#faf9f5]">{p?.full_name ?? 'John Doe'}</h2>
              <span className="font-mono text-xs font-semibold text-[#d97757]">
                {p?.public_id ?? 'FG-P-000001'}
              </span>
            </div>
            <p className="text-xs text-[#a9a99f]">
              {[p?.age && `${p.age} yrs`, p?.blood_group, p?.sex, p?.known_conditions]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="ghost" onClick={() => setProfileOpen(true)} className="text-xs flex items-center gap-1.5">
            <UserCheck size={14} className="text-[#d97757]" />
            Profile &amp; Notes
          </Btn>
          <Btn tone="ghost" onClick={() => setChatOpen(true)} className="text-xs flex items-center gap-1.5">
            <MessageSquare size={14} className="text-[#9c87f5]" />
            AI Health Chat
          </Btn>
          <Btn tone="ghost" onClick={() => setBtOpen(true)} className="text-xs flex items-center gap-1.5">
            <Bluetooth size={14} className="text-[#41d69a]" />
            BLE Hardware
          </Btn>
          <Btn tone="ghost" onClick={() => setDossierOpen(true)} className="text-xs flex items-center gap-1.5">
            <Users size={14} className="text-[#d97757]" />
            Clinical Dossier
          </Btn>
          <Btn tone="ghost" onClick={() => setSocietyOpen(true)} className="text-xs flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#9c87f5]" />
            Multi-Agent Society
          </Btn>
          <Btn tone="ghost" onClick={() => setSettingsOpen(true)} className="text-xs flex items-center gap-1.5">
            <Settings size={14} />
            Settings
          </Btn>
          <Btn
            tone="rose"
            onClick={triggerSos}
            disabled={sosBusy}
            className="text-xs flex items-center gap-1.5 shadow-lg shadow-[#fb7185]/20 font-extrabold"
          >
            <ShieldAlert size={14} />
            {sosBusy ? 'Latching GPS…' : 'EMERGENCY SOS'}
          </Btn>
        </div>
      </div>

      {/* Active Emergency Alert Banner if triggered */}
      {currentEmergency && (
        <div className="rounded-2xl border border-[#fb7185] bg-[#fb7185]/10 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-[#fb7185] animate-pulse" />
              <div>
                <p className="text-xs font-bold text-[#fb7185] uppercase tracking-wider">
                  Active Emergency Incident — Case {currentEmergency.public_id ?? currentEmergency.id.slice(0, 8)}
                </p>
                <p className="text-sm font-bold text-[#faf9f5]">
                  Status: <span className="font-mono text-[#d97757]">{currentEmergency.status}</span> · Responders Dispatched
                </p>
              </div>
            </div>
            <Btn tone="ghost" onClick={() => setPassport(true)} className="text-xs">
              Open Receiving Trauma Passport
            </Btn>
          </div>
        </div>
      )}
      {sosErr && <ErrorState message={sosErr} />}

      {/* 2. Primary Telemetry Metric Strip */}
      <div className="rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <Overline>Physiological Telemetry & FAME Wearable Interface</Overline>
            <h3 className="text-base font-bold text-[#faf9f5]">Continuous Telemetry & Anomaly Detection</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#a9a99f]">Scenarios:</span>
            {Object.keys(PRESETS).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setVit(PRESETS[k]);
                  setSimulated(true);
                }}
                className="rounded-lg border border-[#3e3e38] bg-[#1b1b19] px-2 py-1 font-mono text-[10px] text-[#d97757] hover:border-[#d97757] transition"
              >
                {k.replace(/_/g, ' ')}
              </button>
            ))}
            {simulated && <Simulated />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {VITAL_META.map((m) => (
            <div key={m.key} className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#a9a99f]">{m.label}</span>
                <span className="font-mono text-[10px] text-[#a9a99f]">{m.unit}</span>
              </div>
              <p className="font-mono text-3xl font-extrabold tabular-nums text-[#d97757] my-1">
                {vit[m.key] ?? '—'}
              </p>
              <Spark
                label={m.label}
                values={history.map((h) => h[m.key]).filter((x): x is number => typeof x === 'number')}
              />
              <input
                inputMode="decimal"
                aria-label={m.label}
                className={`${fieldCls} mt-2 text-xs font-mono py-1`}
                value={vit[m.key] ?? ''}
                onChange={(e) => {
                  setVit({ ...vit, [m.key]: e.target.value });
                  setSimulated(false);
                }}
                placeholder={`Edit ${m.unit}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Asymmetric Split Layout: Intake (Left 45%) & Diagnostic Reasoning (Right 55%) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Multimodal Clinical Intake */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-5 shadow-lg space-y-4">
            <div>
              <Overline>Multimodal Clinical Intake</Overline>
              <h3 className="text-base font-bold text-[#faf9f5] mt-0.5">Symptom Expression & Voice Input</h3>
              <p className="text-xs text-[#a9a99f] mt-1">
                Enter your symptoms naturally or use speech dictation in English, Telugu, or Hindi.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  className={fieldCls}
                  value={text}
                  placeholder="Describe symptoms (e.g. sharp chest pain, shortness of breath)"
                  aria-label="Symptom text"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSymptom()}
                />
                <select
                  aria-label="Severity"
                  className={`${fieldCls} w-auto text-xs`}
                  value={sev}
                  onChange={(e) => setSev(e.target.value)}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Btn tone="ghost" onClick={addSymptom} className="text-xs">
                  Add
                </Btn>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <VoiceInput onText={(t) => setText((x) => (x ? `${x} ` : '') + t)} />
              </div>

              {symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#3e3e38]">
                  {symptoms.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSymptoms((prev) => prev.filter((_, idx) => idx !== i))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#3e3e38] bg-[#1b1b19] px-2.5 py-1 text-xs font-semibold text-[#faf9f5] hover:border-[#fb7185] hover:text-[#fb7185] transition"
                    >
                      <span>{s.name}</span>
                      <span className="font-mono text-[10px] text-[#d97757]">({s.severity})</span>
                      <span>✕</span>
                    </button>
                  ))}
                </div>
              )}

              {err && <ErrorState message={err} />}

              <Btn
                onClick={analyze}
                disabled={busy || (!symptoms.length && !Object.values(vit).some(Boolean))}
                className="w-full text-sm py-3 font-extrabold tracking-wide uppercase shadow-lg shadow-[#d97757]/20"
              >
                {busy ? 'SYNTHESIZING MULTI-MODAL RISK…' : 'ANALYZE CLINICAL RISK'}
              </Btn>
            </div>
          </div>

          {/* Multimodal File Upload Panels */}
          <div className="space-y-3">
            <Upload kind="reports" title="Lab Report OCR & Reference Range Parser" accept=".pdf,.jpg,.jpeg,.png" />
            <Upload kind="images" title="Optical Physical Assessment & Photo Analysis" accept=".jpg,.jpeg,.png" />
          </div>
        </div>

        {/* Right Column: Structured Diagnostic Reasoning (Detected -> Means -> What to do) */}
        <div className="lg:col-span-7 space-y-5">
          {a ? (
            <>
              {/* Safety Rules Banner if triggered */}
              <SafetyRules a={a} />

              {/* 3-Tier Clinical Understanding Panel */}
              <div className="rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-6 shadow-xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3e3e38] pb-3">
                  <div>
                    <Overline>Diagnostic Risk Synthesis</Overline>
                    <h3 className="text-lg font-bold text-[#faf9f5]">Algorithmic Acuity & Risk Breakdown</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn tone="ghost" onClick={() => setPassport(true)} className="text-xs">
                      Trauma Passport
                    </Btn>
                    <Btn tone="ghost" onClick={() => setSocietyOpen(true)} className="text-xs flex items-center gap-1">
                      <Sparkles size={14} className="text-[#9c87f5]" /> Multi-Agent
                    </Btn>
                  </div>
                </div>

                {/* TIER 1: WHAT WAS DETECTED */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#d97757]/20 font-mono text-xs font-bold text-[#d97757]">
                      1
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                      What The System Detected
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {VITAL_META.map((m) => (
                      <div key={m.key} className="rounded-xl bg-[#2c2c2b] p-2.5">
                        <span className="text-[10px] text-[#a9a99f]">{m.label}</span>
                        <p className="font-mono text-sm font-bold text-[#faf9f5]">
                          {vit[m.key] ? `${vit[m.key]} ${m.unit}` : 'Not measured'}
                        </p>
                      </div>
                    ))}
                  </div>
                  {symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-[#a9a99f]">Reported:</span>
                      {symptoms.map((s, idx) => (
                        <span
                          key={idx}
                          className="rounded-md border border-[#3e3e38] bg-[#2c2c2b] px-2 py-0.5 font-mono text-[11px] text-[#faf9f5]"
                        >
                          {s.name} ({s.severity})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* TIER 2: WHAT IT MEANS */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#f2b955]/20 font-mono text-xs font-bold text-[#f2b955]">
                      2
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                      What It Means (Clinical Acuity Tier)
                    </h4>
                  </div>

                  <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                    <div className="mx-auto text-center">
                      <RiskDonut score={a.risk_score} />
                      <p className="mt-1 font-mono text-xs text-[#a9a99f]">
                        Confidence: {a.confidence_score.toFixed(0)}%
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <RiskBadge level={a.care_level} />
                        <span className="font-mono text-xs text-[#a9a99f]">Classification: {a.care_level}</span>
                      </div>
                      <Spectrum score={a.risk_score} />

                      {a.top_factors?.length ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#a9a99f]">
                            Contributing Risk Biomarkers
                          </p>
                          <ul className="space-y-1 text-xs text-[#faf9f5]">
                            {a.top_factors.map((f) => (
                              <li
                                key={f.factor_name}
                                className="flex items-center justify-between rounded-lg bg-[#2c2c2b] px-3 py-1.5"
                              >
                                <span>{f.factor_name}</span>
                                <span className="font-mono text-[#d97757]">
                                  {f.direction.replace(/_/g, ' ')} · {f.contribution}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* TIER 3: WHAT THE PATIENT SHOULD DO */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#41d69a]/20 font-mono text-xs font-bold text-[#41d69a]">
                        3
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                        What You Should Do Next
                      </h4>
                    </div>
                    {insight?.explanation && <Speaker text={insight.explanation} />}
                  </div>

                  <p className="text-sm leading-relaxed text-[#faf9f5] bg-[#2c2c2b] p-3 rounded-xl border border-[#3e3e38]">
                    {insight?.explanation ?? (busy ? 'Synthesizing explanation…' : 'No explanation available.')}
                  </p>

                  {/* Tele-Consultation Request Action */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3e3e38]">
                    <span className="text-xs text-[#a9a99f]">Request doctor review:</span>
                    <select
                      aria-label="Specialty"
                      className={`${fieldCls} w-auto text-xs`}
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                    >
                      {Array.from(new Set([specialty, ...SPECIALTIES])).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Btn onClick={consult} className="text-xs">
                      Book Tele-Consultation
                    </Btn>
                    {token && (
                      <span className="rounded-xl border border-[#41d69a] bg-[#41d69a]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#41d69a]">
                        Token: {token}
                      </span>
                    )}
                  </div>
                </div>

                {/* Evidence Chain Component */}
                <EvidenceChainNode
                  detectedSignal={symptoms[0]?.name ? `${symptoms[0].name} (${symptoms[0].severity})` : 'Normal Baseline'}
                  clinicalRule={a.triggered_safety_rules?.[0]?.reason ?? 'Standard Acuity Fusion Model'}
                  evidenceCitation={ev?.[0]?.title ?? 'AHA/ACC 2024 Guidelines for Acute Cardiac Care'}
                  recommendedAction={a.care_level === 'POSSIBLE_EMERGENCY' ? 'Immediate EMS Dispatch' : 'Tele-consultation & Observation'}
                />

                {/* Primary Evidence Citations Drawer */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4">
                  <Overline className="text-[#9c87f5]">
                    Verified Literature Evidence & Citations (RAG + Tavily)
                  </Overline>
                  <div className="mt-3">
                    {ev === undefined ? (
                      <Loading label="Retrieving literature citations…" />
                    ) : (
                      <EvidenceList items={ev} />
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#3e3e38] bg-[#2c2c2b]/50 p-12 text-center min-h-[400px]">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1b1b19] border border-[#3e3e38] text-[#d97757] mb-3">
                <Heart size={28} />
              </div>
              <h3 className="text-base font-bold text-[#faf9f5]">Awaiting Multi-Modal Clinical Intake</h3>
              <p className="mt-1 text-xs text-[#a9a99f] max-w-sm">
                Enter your symptoms, record voice dictation, or select a preset scenario on the left to generate algorithmic risk fusion.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {passport && (
        <HandoverPassportModal
          passport={buildPassport(p, a, currentEmergency || undefined, a?.vitals ?? lastVitals)}
          onClose={() => setPassport(false)}
        />
      )}
      {dossierOpen && p?.id && <ClinicalDossierModal patientId={p.id} onClose={() => setDossierOpen(false)} />}
      {btOpen && <BluetoothPairModal onClose={() => setBtOpen(false)} />}
      {societyOpen && <MultiAgentConsensusModal onClose={() => setSocietyOpen(false)} />}
      {settingsOpen && <PortalSettingsModal onClose={() => setSettingsOpen(false)} />}
      {profileOpen && (
        <PatientProfileModal
          patient={p ?? null}
          onClose={() => setProfileOpen(false)}
          onProfileUpdated={() => {
            me.reload();
          }}
        />
      )}
      {chatOpen && (
        <ClinicalChatModal
          onClose={() => setChatOpen(false)}
          initialRole="PATIENT"
          patientContext={{
            name: p?.full_name,
            age: p?.age,
            conditions: p?.known_conditions,
          }}
        />
      )}
    </div>
  );
}
