import { useEffect, useState } from 'react';
import { api, errMsg } from './api';
import type { AmbulanceBrief, Consultation, EmergencyCase, EmergencyStatus, Evidence, TriageItem } from './types';
import {
  BackendRequired, Btn, Card, Empty, ErrorState, EvidenceList, HandoverPassportModal, Loading, Overline, RiskBadge,
  SafetyRules, Simulated, StatusBadge, VitalsGrid, buildPassport, fieldCls, useLoad,
} from './shared';

const POLL = 15000;
const sel = (on: boolean) => `w-full rounded-xl border p-3 text-left ${on ? 'border-cyan-500/50 bg-cyan-950/20' : 'border-slate-800 bg-slate-950/80 hover:border-slate-600'}`;
const DECISIONS = ['MONITOR', 'FOLLOW_UP', 'URGENT_REVIEW', 'EMERGENCY_ESCALATION', 'RESOLVED'];

export function DoctorView() {
  const [tab, setTab] = useState<'triage' | 'consult'>('triage');
  const triage = useLoad(api.doctorQueue, [], POLL);
  const consults = useLoad(api.consultationQueue, [], POLL);
  const [key, setKey] = useState<string>();
  const [ev, setEv] = useState<Evidence[]>();
  const [decision, setDecision] = useState(DECISIONS[0]); const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>(); const [err, setErr] = useState<string>(); const [passport, setPassport] = useState(false);

  const rows: Array<{ k: string; t?: TriageItem; c?: Consultation }> = tab === 'triage'
    ? (triage.data ?? []).map((t, i) => ({ k: t.id ?? t.patient_id ?? String(i), t }))
    : (consults.data ?? []).map((c) => ({ k: c.id, c }));
  const cur = rows.find((r) => r.k === key);
  const patient = cur?.t?.patient ?? cur?.c?.patient;
  const a = cur?.t ?? cur?.c?.assessment;
  const patientId = patient?.id ?? cur?.t?.patient_id ?? cur?.c?.patient_id;

  const pick = async (k: string, query: string) => {
    setKey(k); setMsg(undefined); setErr(undefined); setEv(undefined);
    try { setEv(await api.rag(query)); } catch { setEv([]); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(undefined); try { await fn(); setMsg(ok); triage.reload(); consults.reload(); } catch (e) { setErr(errMsg(e)); }
  };
  const list = tab === 'triage' ? triage : consults;

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-3 xl:col-span-4">
        <div className="flex gap-2" role="tablist">{(['triage', 'consult'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setKey(undefined); }}
            className={`flex-1 rounded-xl border px-3 text-sm font-bold ${tab === t ? 'border-cyan-500/50 text-cyan-400' : 'border-slate-800 text-slate-400'}`}>
            {t === 'triage' ? 'Triage Queue' : 'Consultation Queue'}</button>))}</div>
        {list.loading ? <Loading /> : list.error ? <ErrorState message={list.error} retry={list.reload} />
          : !rows.length ? <Empty>No active consultation requests in triage queue.</Empty>
          : rows.map(({ k, t, c }) => (
            <button key={k} className={sel(k === key)} onClick={() => void pick(k, [(t ?? c?.assessment)?.care_level, c?.specialty, c?.health_summary].filter(Boolean).join(' ') || 'triage')}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white">{(t?.patient ?? c?.patient)?.full_name ?? 'Patient'}</span>
                {c && <span className="font-mono text-xs text-cyan-400">{c.token_number}</span>}</div>
              <p className="font-mono text-[11px] text-slate-400">{(t?.patient ?? c?.patient)?.public_id ?? ''}</p>
              <div className="mt-1 flex items-center gap-2"><RiskBadge level={(t ?? c?.assessment)?.care_level} />
                {t?.risk_score !== undefined && <span className="font-mono text-xs text-slate-300">{t.risk_score.toFixed(1)}</span>}
                {c && <StatusBadge status={c.status} />}</div>
            </button>))}
      </div>

      <div className="space-y-4 xl:col-span-8">
        {!cur ? <Card><Empty>Select a patient from the queue to open the clinical dossier.</Empty></Card> : (<>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><Overline>Clinical Dossier</Overline><h2 className="text-xl font-bold text-white">{patient?.full_name ?? 'Patient'}</h2>
                <p className="text-xs text-slate-400">{[patient?.age && `${patient.age} y`, patient?.blood_group, patient?.known_conditions].filter(Boolean).join(' · ')}</p></div>
              <div className="flex flex-wrap gap-2"><Btn tone="ghost" onClick={() => setPassport(true)}>Handover Passport</Btn>
                {cur.c && cur.c.status === 'WAITING' && <Btn onClick={() => void act(() => api.startConsultation(cur.c!.id), 'Consultation started')}>Start</Btn>}
                {cur.c && cur.c.status === 'IN_REVIEW' && <Btn onClick={() => void act(() => api.completeConsultation(cur.c!.id), 'Consultation completed')}>Complete</Btn>}</div>
            </div>
            {cur.c?.health_summary && <p className="mt-2 text-xs text-slate-300 sm:text-sm">{cur.c.health_summary}</p>}
          </Card>
          <SafetyRules a={a as never} />
          <Card><Overline>Telemetry Snapshot</Overline><div className="mt-2"><VitalsGrid v={a?.vitals} badge={<Simulated label="PROVENANCE: as stored on assessment (device vs simulated not reported by API)" />} /></div></Card>
          <Card><Overline>Explainable Multi-Modal Risk Breakdown</Overline>
            {a?.top_factors?.length ? <ul className="mt-2 space-y-1 text-xs text-slate-300">{a.top_factors.map((f) => (
              <li key={f.factor_name} className="flex justify-between"><span>{f.factor_name}</span><span className="font-mono text-slate-400">{f.direction.replace('_', ' ')} · {f.contribution}</span></li>))}</ul>
              : <div className="mt-2"><Empty>No factor breakdown returned for this record.</Empty></div>}</Card>
          <Card><Overline className="text-indigo-300">Verified Clinical Guidelines & Evidence Citations</Overline><div className="mt-2">{ev === undefined ? <Loading /> : <EvidenceList items={ev} />}</div></Card>
          <Card>
            <Overline>Clinician Decision Logger</Overline>
            <div className="mt-2 space-y-2">
              <select aria-label="Decision" className={fieldCls} value={decision} onChange={(e) => setDecision(e.target.value)}>{DECISIONS.map((d) => <option key={d}>{d}</option>)}</select>
              <textarea aria-label="Clinical assessment note" className={fieldCls + ' min-h-24 py-2'} placeholder="Clinical assessment note" value={note} onChange={(e) => setNote(e.target.value)} />
              <Btn disabled={!patientId || !note.trim()} onClick={() => void act(() => api.logReview({ patient_id: patientId!, decision, note }), 'Decision logged').then(() => setNote(''))}>Save & Log Clinical Decision</Btn>
              {msg && <p role="status" className="text-xs text-emerald-400">{msg}</p>}{err && <ErrorState message={err} />}
            </div>
            <div className="mt-3"><BackendRequired what="Prior clinical reviews: the spec defines no endpoint to list past reviews." /></div>
          </Card>
        </>)}
      </div>
      {passport && cur && <HandoverPassportModal passport={buildPassport(patient, a as never, undefined, a?.vitals)} onClose={() => setPassport(false)} />}
    </div>
  );
}

export const LIFECYCLE: EmergencyStatus[] = ['DETECTED', 'UNDER_REVIEW', 'VERIFIED', 'DISPATCH_REQUESTED', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'HOSPITAL_REACHED', 'COMPLETED'];
const stageIdx = (s: EmergencyStatus) => LIFECYCLE.indexOf(s === 'PATIENT_REACHED' ? 'ON_SCENE' : s);

export function Stepper({ steps, current, label }: { steps: Array<{ id: string; label: string }>; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap gap-2">{steps.map((s, i) => (
      <li key={s.id} aria-current={i === current ? 'step' : undefined}
        className={`rounded-lg border px-2 py-1 font-mono text-[10px] font-semibold sm:text-[11px] ${i < current ? 'border-emerald-500/30 text-emerald-400' : i === current ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
        {i < current ? '✓ ' : ''}{s.label}</li>))}</ol>
  );
}

function CaseBoard({ cases, id, onPick }: { cases: EmergencyCase[]; id?: string; onPick: (id: string) => void }) {
  return !cases.length ? <Empty>No active emergency cases. System operating in nominal monitoring state.</Empty> : (
    <div className="space-y-2">{cases.map((c) => (
      <button key={c.id} className={sel(c.id === id)} onClick={() => onPick(c.id)}>
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white">{c.patient?.full_name ?? 'Patient'}</span>
          <StatusBadge status={c.severity} tone={c.severity === 'CRITICAL' || c.severity === 'HIGH' ? 'rose' : 'slate'} /></div>
        <p className="font-mono text-[11px] text-slate-400">{c.public_id ?? c.id}</p>
        <div className="mt-1"><StatusBadge status={c.status} tone="cyan" /></div></button>))}</div>
  );
}

export function EmergencyView() {
  const cases = useLoad(api.emergencyCases, [], POLL);
  const [id, setId] = useState<string>(); const [err, setErr] = useState<string>(); const [passport, setPassport] = useState(false);
  const c = cases.data?.find((x) => x.id === id);
  const act = async (fn: () => Promise<unknown>) => { setErr(undefined); try { await fn(); cases.reload(); } catch (e) { setErr(errMsg(e)); } };
  const i = c ? stageIdx(c.status) : -1;
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-3 xl:col-span-5">
        <div className="flex items-center justify-between"><Overline>Emergency Cases Board</Overline><span className="font-mono text-xs text-slate-400">{cases.data?.length ?? 0} active</span></div>
        {cases.loading ? <Loading /> : cases.error ? <ErrorState message={cases.error} retry={cases.reload} /> : <CaseBoard cases={cases.data ?? []} id={id} onPick={setId} />}
      </div>
      <div className="space-y-4 xl:col-span-7">
        {!c ? <Card><Empty>Select an incident to open its dossier.</Empty></Card> : (<>
          <Card>
            <Overline>Transit Progress & Hospital Handoff Stepper</Overline>
            <div className="mt-3"><Stepper label="Emergency lifecycle" current={i} steps={LIFECYCLE.map((s) => ({ id: s, label: s }))} /></div>
            {(c.status === 'CANCELLED' || c.status === 'PATIENT_REACHED') && <p className="mt-2"><StatusBadge status={c.status} tone="rose" /></p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn tone="ghost" onClick={() => setPassport(true)}>Handover Passport</Btn>
              <Btn disabled={c.status !== 'DETECTED' && c.status !== 'UNDER_REVIEW'} onClick={() => void act(() => api.verifyCase(c.id))}>Verify Emergency</Btn>
              <Btn tone="rose" disabled={c.status !== 'VERIFIED'} onClick={() => void act(() => api.dispatchCase(c.id))}>Request Dispatch</Btn>
              <Btn tone="ghost" disabled={i < LIFECYCLE.indexOf('DISPATCHED') || i >= LIFECYCLE.length - 1} onClick={() => void act(() => api.advanceCase(c.id))}>Advance Stage</Btn>
            </div>
            {err && <div className="mt-3"><ErrorState message={err} /></div>}
          </Card>
          <SafetyRules a={c.assessment} />
          <Card><Overline>Patient Emergency Profile</Overline>
            <div className="mt-2 grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
              <div><p className="text-slate-500">Demographics</p>{c.patient?.age ?? '—'} y · {c.patient?.blood_group ?? '—'}</div>
              <div><p className="text-slate-500">Current incident</p>{(c.assessment?.active_symptoms ?? []).map((s) => s.name).join(', ') || 'No symptoms recorded'}<br />Risk {c.assessment?.risk_score?.toFixed(1) ?? '—'}</div>
              <div><p className="text-slate-500">Medical context</p>{c.patient?.known_conditions || '—'}<br />{c.patient?.emergency_contact_name ?? '—'} {c.patient?.emergency_contact_phone ?? ''}</div></div></Card>
          <Card><Overline>Vitals Snapshot</Overline><div className="mt-2"><VitalsGrid v={c.assessment?.vitals} /></div></Card>
          <Card><Overline>Incident Location & GPS</Overline>
            <p className="mt-2 text-xs text-slate-300">{c.location?.address ?? 'No address recorded'}
              {c.location?.latitude !== undefined && <span className="font-mono"> · {c.location.latitude}, {c.location.longitude}</span>} <Simulated /></p></Card>
        </>)}
      </div>
      {passport && c && <HandoverPassportModal passport={buildPassport(c.patient, c.assessment, c, c.assessment?.vitals)} onClose={() => setPassport(false)} />}
    </div>
  );
}

const TRANSIT: Array<{ id: EmergencyStatus; label: string }> = [
  { id: 'DISPATCHED', label: 'Dispatched' }, { id: 'EN_ROUTE', label: 'En Route' }, { id: 'ON_SCENE', label: 'On Scene' },
  { id: 'TRANSPORTING', label: 'Transporting' }, { id: 'HOSPITAL_REACHED', label: 'Hospital Reached' }, { id: 'COMPLETED', label: 'Completed' },
];
const ACTIVE = new Set<EmergencyStatus>(['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'PATIENT_REACHED', 'TRANSPORTING', 'HOSPITAL_REACHED', 'COMPLETED']);

export function AmbulanceView() {
  const cases = useLoad(api.emergencyCases, [], POLL);
  const [id, setId] = useState<string>(); const [err, setErr] = useState<string>(); const [passport, setPassport] = useState(false);
  const brief = useLoad<AmbulanceBrief | undefined>(() => (id ? api.ambulanceBrief(id) : Promise.resolve(undefined)), [id], POLL);
  const mine = (cases.data ?? []).filter((c) => ACTIVE.has(c.status));
  const c = mine.find((x) => x.id === id);
  const i = c ? TRANSIT.findIndex((t) => t.id === (c.status === 'PATIENT_REACHED' ? 'ON_SCENE' : c.status)) : -1;
  const b = brief.data; const patient = b?.patient ?? c?.patient; const a = b?.assessment ?? c?.assessment; const vitals = b?.vitals ?? a?.vitals;
  const advance = async () => { setErr(undefined); try { await api.advanceCase(c!.id); cases.reload(); brief.reload(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-3 xl:col-span-4"><Overline>Dispatched Cases</Overline>
        {cases.loading ? <Loading /> : cases.error ? <ErrorState message={cases.error} retry={cases.reload} /> : mine.length ? <CaseBoard cases={mine} id={id} onPick={setId} /> : <Empty>No dispatched cases awaiting this unit.</Empty>}</div>
      <div className="space-y-4 xl:col-span-8">
        {!c ? <Card><Empty>Select a dispatched case to open the emergency brief.</Empty></Card> : (<>
          <Card><Overline>Transit Progress & Hospital Handoff Stepper</Overline>
            <div className="mt-3"><Stepper label="Transit" current={i} steps={TRANSIT} /></div>
            <div className="mt-4 flex flex-wrap gap-2"><Btn tone="ghost" onClick={() => setPassport(true)}>Handover Passport</Btn>
              <Btn disabled={c.status === 'COMPLETED'} onClick={() => void advance()}>Advance Transit Status</Btn></div>
            {err && <div className="mt-3"><ErrorState message={err} /></div>}</Card>
          <SafetyRules a={a} />
          <Card><Overline>Ambulance Emergency Brief</Overline>
            {brief.loading ? <Loading /> : brief.error ? <ErrorState message={brief.error} retry={brief.reload} /> : (
              <div className="mt-2 space-y-3"><p className="text-sm text-white">{patient?.full_name ?? 'Patient'} <span className="font-mono text-xs text-slate-400">{patient?.public_id}</span></p>
                <p className="text-xs text-slate-300">{[patient?.age && `${patient.age} y`, patient?.height_cm && `${patient.height_cm} cm`, patient?.weight_kg && `${patient.weight_kg} kg`, patient?.blood_group].filter(Boolean).join(' · ')}</p>
                <VitalsGrid v={vitals} />
                <p className="text-xs text-slate-300">{c.location?.address ?? 'No dispatch address recorded'} <Simulated /></p></div>)}</Card>
        </>)}
      </div>
      {passport && c && <HandoverPassportModal passport={buildPassport(patient, a, c, vitals)} onClose={() => setPassport(false)} />}
    </div>
  );
}

export function AdminView() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [rules, setRules] = useState<Array<{ rule_id: string; condition: string; severity: string; reason: string }>>([]);
  const [audit, setAudit] = useState<Array<{ id: string; actor_role: string; action: string; target_type: string; target_id: string; result: string; created_at: string }>>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    let live = true;
    Promise.all([api.adminMetrics(), api.adminSafetyRules(), api.adminAuditLogs(50)])
      .then(([m, r, a]) => {
        if (!live) return;
        setMetrics(m);
        setRules(r.rules ?? []);
        setAudit(a ?? []);
      })
      .catch((e) => live && setErr(errMsg(e)));
    return () => { live = false; };
  }, []);
  return (
    <div className="space-y-4">
      {err && <ErrorState message={err} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <Overline>Model Performance Metrics</Overline>
          <div className="mt-3">
            {metrics ? <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-3 font-mono text-[11px] text-cyan-300">{JSON.stringify(metrics, null, 2)}</pre>
              : <Loading label="Loading metrics…" />}
          </div>
        </Card>
        <Card>
          <Overline>Deterministic Safety Rule Catalog (RF-001 to RF-011)</Overline>
          <ul className="mt-3 space-y-2">
            {rules.length ? rules.map((r) => (
              <li key={r.rule_id} className="text-xs text-slate-300">
                <span className="mr-2 font-mono font-bold text-rose-400">[{r.rule_id}]</span>{r.condition}
                <span className="block font-mono text-[10px] text-slate-500">{r.severity} · {r.reason}</span>
              </li>
            )) : <Loading label="Loading rules…" />}
          </ul>
        </Card>
        <Card>
          <Overline>System Audit Log</Overline>
          <div className="mt-3 max-h-64 overflow-auto space-y-1">
            {audit.length ? audit.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-[11px] text-slate-300">
                <span className="font-mono text-cyan-400">{new Date(a.created_at).toLocaleString()}</span>
                <span className="ml-2 font-mono text-amber-300">{a.actor_role}</span>
                <span className="ml-2">{a.action}</span>
                <span className="ml-2 font-mono text-slate-500">{a.target_type}/{a.target_id}</span>
              </div>
            )) : <Loading label="Loading audit logs…" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
