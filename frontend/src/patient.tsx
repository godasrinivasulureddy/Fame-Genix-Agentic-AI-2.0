import { useEffect, useRef, useState } from 'react';
import { FileText, Mic, Volume2 } from 'lucide-react';
import { api, errMsg } from './api';
import type { EmergencyCase, Evidence, RiskAssessment, Vitals } from './types';
import {
  Btn, Card, Empty, ErrorState, EvidenceList, HandoverPassportModal, Loading, Overline, RiskBadge, RiskDonut,
  SafetyRules, Simulated, Spectrum, VITAL_META, buildPassport, fieldCls, useLoad,
} from './shared';

const LANGS = [['en-IN', 'English'], ['te-IN', 'Telugu'], ['hi-IN', 'Hindi']] as const;
const SPECIALTIES = ['General Physician', 'Pulmonology', 'Cardiology'];
const SEVERITIES = ['LOW', 'MODERATE', 'HIGH'];
const MAX_BYTES = 10 * 1024 * 1024;

interface SpeechRec {
  lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void;
}
type SRCtor = new () => SpeechRec;

function VoiceInput({ onText }: { onText: (t: string) => void }) {
  const [lang, setLang] = useState<string>(LANGS[0][0]);
  const [on, setOn] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return <p className="text-[11px] text-slate-500">Voice dictation is not supported in this browser.</p>;
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const r = new Ctor(); r.lang = lang; r.interimResults = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setOn(false); r.onerror = () => setOn(false);
    rec.current = r; r.start(); setOn(true);
  };
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Dictation language" value={lang} onChange={(e) => setLang(e.target.value)} className={fieldCls + ' w-auto'}>
        {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
      <Btn tone={on ? 'rose' : 'ghost'} onClick={toggle} className="flex items-center gap-2"><Mic size={16} />{on ? 'Stop' : 'Dictate'}</Btn>
    </div>
  );
}

function Speaker({ text }: { text: string }) {
  if (!('speechSynthesis' in window)) return null;
  return <Btn tone="ghost" className="flex items-center gap-2" onClick={() => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }}><Volume2 size={16} />Listen</Btn>;
}

function Result({ data }: { data: unknown }) {
  const rows = Array.isArray(data) ? data : Array.isArray((data as { results?: unknown })?.results) ? (data as { results: unknown[] }).results : null;
  if (rows && rows.length && typeof rows[0] === 'object' && rows[0] !== null) {
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r as object))));
    return (
      <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead><tr>{cols.map((c) => <th key={c} className="border-b border-slate-800 p-2 font-mono text-slate-400">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="border-b border-slate-800/80 p-2">{String((r as Record<string, unknown>)[c] ?? '')}</td>)}</tr>)}</tbody>
      </table></div>
    );
  }
  return <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-3 font-mono text-[11px] text-cyan-300">{JSON.stringify(data, null, 2)}</pre>;
}

/** Shared drag-and-drop uploader for lab reports (OCR) and clinical photos. */
function Upload({ kind, title, accept }: { kind: 'reports' | 'images'; title: string; accept: string }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [out, setOut] = useState<unknown>();
  const run = async (f?: File) => {
    if (!f) return;
    setErr(undefined); setOut(undefined);
    if (f.size > MAX_BYTES) { setErr('Selected report file exceeds 10 MB limit. Please select a smaller document (PDF/JPG/PNG).'); return; }
    setBusy(true);
    try { setOut(await api.analyze(kind, f)); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Card>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void run(e.dataTransfer.files[0]); }}
        className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center text-xs text-slate-400 ${drag ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-700'}`}>
        <FileText size={24} className="text-cyan-400" />Drag a file here or tap to select (max 10 MB)
        <input type="file" accept={accept} className="sr-only" onChange={(e) => void run(e.target.files?.[0])} />
      </label>
      {busy && <div className="mt-3" role="progressbar" aria-label="Analyzing"><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-500" /></div></div>}
      {err && <div className="mt-3"><ErrorState message={err} /></div>}
      {out !== undefined && <div className="mt-3"><Result data={out} /></div>}
      <p className="mt-3 text-[11px] text-slate-500">AI-assisted report interpretation does not replace professional medical review. Original lab ranges are strictly preserved.</p>
    </Card>
  );
}

function Spark({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <p className="font-mono text-[11px] text-slate-500">need 2+ readings</p>;
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(' ');
  return <svg viewBox="0 0 100 30" className="h-12 w-full" role="img" aria-label={`${label} trend`}><polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.5" /></svg>;
}

/** Scenario presets only pre-fill the form (clearly labelled). The risk score always comes from the backend. */
const PRESETS: Record<string, Record<string, string>> = {
  RESPIRATORY_DRIFT: { heart_rate: '110', spo2: '89', respiratory_rate: '26', temperature: '37.4' },
  TACHYCARDIA: { heart_rate: '135', spo2: '96', respiratory_rate: '18', temperature: '36.9' },
  BASELINE: { heart_rate: '72', spo2: '98', respiratory_rate: '14', temperature: '36.7' },
};

export default function PatientView() {
  const me = useLoad(api.myPatient, []);
  const [symptoms, setSymptoms] = useState<Array<{ name: string; severity: string }>>([]);
  const [text, setText] = useState(''); const [sev, setSev] = useState('HIGH');
  const [vit, setVit] = useState<Record<string, string>>({}); const [simulated, setSimulated] = useState(false);
  const [history, setHistory] = useState<Array<Vitals & { simulated: boolean }>>([]);
  const [a, setA] = useState<RiskAssessment>(); const [insight, setInsight] = useState<{ explanation?: string; suggested_specialty?: string }>();
  const [ev, setEv] = useState<Evidence[]>(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]); const [token, setToken] = useState<string>();
  const [passport, setPassport] = useState(false);
  const [sosCase, setSosCase] = useState<EmergencyCase | null>(null);
  const [sosErr, setSosErr] = useState<string>();
  const p = me.data;
  useEffect(() => {
    const off = api.subscribeEvents((event) => {
      if (event === 'observation.created' || event === 'analysis.completed') {
        // Silent refresh of assessment when backend pushes new telemetry
        if (a) void api.insight(a.id).then((i) => { setInsight(i); if (i.suggested_specialty) setSpecialty(i.suggested_specialty); }).catch(() => {});
      }
    });
    return off;
  }, [a?.id]);

  const addSymptom = () => { const n = text.trim(); if (n) { setSymptoms((s) => [...s, { name: n, severity: sev }]); setText(''); } };
  const analyze = async () => {
    setBusy(true); setErr(undefined); setToken(undefined); setInsight(undefined); setEv(undefined);
    const vitals: Vitals = {};
    for (const m of VITAL_META) if (vit[m.key]?.trim()) vitals[m.key] = Number(vit[m.key]);
    try {
      const res = await api.createAssessment({ symptoms, vitals });
      setA(res); setHistory((h) => [...h, { ...vitals, simulated }]);
      const q = [...symptoms.map((s) => s.name), res.care_level].join(' ');
      const [i, r] = await Promise.allSettled([api.insight(res.id), api.rag(q)]);
      if (i.status === 'fulfilled') { setInsight(i.value); if (i.value.suggested_specialty) setSpecialty(i.value.suggested_specialty); }
      setEv(r.status === 'fulfilled' ? r.value : []);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const consult = async () => {
    try { setToken((await api.requestConsultation({ specialty, health_summary: insight?.explanation ?? symptoms.map((s) => s.name).join(', ') })).token_number); }
    catch (e) { setErr(errMsg(e)); }
  };
  const triggerSos = async () => {
    setSosErr(undefined); setSosCase(null);
    let lat: number | undefined; let lng: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 }),
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* location unavailable — proceed without */ }
    }
    try { setSosCase(await api.sos({ latitude: lat, longitude: lng })); }
    catch (e) { setSosErr(errMsg(e)); }
  };
  const lastVitals = history.length ? history[history.length - 1] : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          {me.loading ? <Loading /> : me.error ? <ErrorState message={me.error} retry={me.reload} /> : p && (<>
            <Overline>Patient Identity</Overline>
            <h2 className="mt-1 text-xl font-bold text-white">{p.full_name}</h2>
            <p className="font-mono text-xs text-slate-400">{p.public_id ?? 'ID pending'}</p>
            <p className="mt-2 text-xs text-slate-300">{[p.age && `${p.age} y`, p.blood_group, p.sex].filter(Boolean).join(' · ') || 'Demographics not populated'}</p>
            <p className="text-xs text-slate-400">{p.known_conditions || 'No known conditions recorded'}</p>
          </>)}
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1">
          <Overline>Clinical Care Level</Overline>
          {a ? <><RiskBadge level={a.care_level} /><p className="font-mono text-xs text-slate-400">AI risk score {a.risk_score.toFixed(1)}</p></> : <Empty>Run an analysis to see your care level.</Empty>}
        </Card>
        <Card>
          <Overline>Wearable</Overline>
          <p className="mt-2 text-xs text-slate-300">No device pairing is implemented in the backend.</p>
          <div className="mt-2"><Simulated label="[SIMULATED] FAME_MASK link not real" /></div>
        </Card>
      </div>

      <Card>
        <Overline>Multi-Factor Health Risk Assessment</Overline>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input className={fieldCls} value={text} placeholder="Describe a symptom" aria-label="Symptom" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSymptom()} />
              <select aria-label="Severity" className={fieldCls + ' w-auto'} value={sev} onChange={(e) => setSev(e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
              <Btn tone="ghost" onClick={addSymptom}>Add</Btn>
            </div>
            <VoiceInput onText={(t) => setText((x) => (x ? x + ' ' : '') + t)} />
            <ul className="flex flex-wrap gap-2">{symptoms.map((s, i) => (
              <li key={i}><button onClick={() => setSymptoms((x) => x.filter((_, j) => j !== i))} className="min-h-0 rounded-lg border border-slate-700 px-2 py-1 text-xs" aria-label={`Remove ${s.name}`}>{s.name} · {s.severity} ✕</button></li>))}</ul>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">Vitals (optional)</span>
              {Object.keys(PRESETS).map((k) => <button key={k} className="min-h-0 rounded-lg border border-amber-500/30 px-2 py-1 font-mono text-[10px] text-amber-400"
                onClick={() => { setVit(PRESETS[k]); setSimulated(true); }}>{k}</button>)}
              {simulated && <Simulated />}</div>
            <div className="grid grid-cols-2 gap-2">{VITAL_META.map((m) => (
              <label key={m.key} className="text-[11px] text-slate-400">{m.label} ({m.unit})
                <input inputMode="decimal" className={fieldCls + ' mt-1 font-mono'} value={vit[m.key] ?? ''} onChange={(e) => { setVit({ ...vit, [m.key]: e.target.value }); setSimulated(false); }} /></label>))}</div>
          </div>
        </div>
        <Btn className="mt-4 w-full sm:w-auto" disabled={busy || (!symptoms.length && !Object.values(vit).some(Boolean))} onClick={() => void analyze()}>{busy ? 'ANALYZING…' : 'ANALYZE HEALTH'}</Btn>
        {err && <div className="mt-3"><ErrorState message={err} /></div>}
      </Card>

      {a && (<>
        <SafetyRules a={a} />
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Overline>Diagnostic Core & Risk Assessment</Overline>
            <div className="flex gap-2"><Btn tone="ghost" onClick={() => setPassport(true)}>Handover Passport</Btn>
              <Btn tone="rose" onClick={() => void triggerSos()}>Emergency SOS</Btn></div>
            {sosCase && <p role="status" className="mt-2 text-xs text-amber-300">Simulated emergency case {sosCase.public_id ?? sosCase.id} created. Authorized responders can now review it.</p>}
            {sosErr && <div className="mt-2"><ErrorState message={sosErr} /></div>}
          </div>
          <div className="mt-3 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto"><RiskDonut score={a.risk_score} /></div>
            <div className="space-y-3">
              <div className="flex items-center gap-3"><RiskBadge level={a.care_level} /><span className="font-mono text-xs text-slate-400">confidence {a.confidence_score.toFixed(0)}%</span></div>
              <Spectrum score={a.risk_score} />
              {a.top_factors?.length ? <ul className="space-y-1 text-xs text-slate-300">{a.top_factors.map((f) => (
                <li key={f.factor_name} className="flex justify-between gap-2"><span>{f.factor_name}</span><span className="font-mono text-slate-400">{f.direction.replace('_', ' ')} · {f.contribution}</span></li>))}</ul> : null}
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-2"><Overline>AI Health Explanation</Overline>{insight?.explanation && <Speaker text={insight.explanation} />}</div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">{insight?.explanation ?? (busy ? 'Loading…' : 'No AI explanation was returned for this assessment.')}</p>
        </Card>
        <Card>
          <Overline className="text-indigo-300">Verified Clinical Literature Evidence & Triage Guidelines (RAG)</Overline>
          <div className="mt-3">{ev === undefined ? <Loading /> : <EvidenceList items={ev} />}</div>
        </Card>
        <Card>
          <Overline>Suggested Specialist & Consultation</Overline>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select aria-label="Specialty" className={fieldCls + ' w-auto'} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {Array.from(new Set([specialty, ...SPECIALTIES])).map((s) => <option key={s}>{s}</option>)}</select>
            <Btn onClick={() => void consult()}>Request Doctor Consultation</Btn>
            {token && <span className="font-mono text-sm font-bold text-emerald-400">Token {token}</span>}
          </div>
        </Card>
      </>)}

      <Card>
        <Overline>Continuous Telemetry</Overline>
        {history.length ? <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">{VITAL_META.map((m) => (
          <div key={m.key}><p className="text-[11px] text-slate-400">{m.label}</p>
            <p className="font-mono text-3xl font-extrabold tabular-nums text-cyan-400">{lastVitals?.[m.key] ?? '—'}</p>
            <Spark label={m.label} values={history.map((h) => h[m.key]).filter((x): x is number => typeof x === 'number')} /></div>))}</div>
          : <div className="mt-2"><Empty>Readings you submit appear here. No live device stream exists in the backend.</Empty></div>}
        {lastVitals?.simulated && <div className="mt-2"><Simulated /></div>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Upload kind="reports" title="Lab Report OCR" accept=".pdf,.jpg,.jpeg,.png" />
        <Upload kind="images" title="AI Optical & Multi-Modal Parser" accept=".jpg,.jpeg,.png" />
      </div>
      {passport && <HandoverPassportModal passport={buildPassport(p, a, undefined, a?.vitals ?? lastVitals)} onClose={() => setPassport(false)} />}
    </div>
  );
}
