import { useEffect, useState } from 'react';
import {
  Building2,
  Camera,
  Download,
  MapPin,
  Radio,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { api, errMsg } from './api';
import type {
  AmbulanceBrief,
  Consultation,
  EmergencyCase,
  EmergencyStatus,
  Evidence,
  TriageItem,
} from './types';
import {
  Btn,
  Card,
  ClinicalDossierModal,
  Empty,
  ErrorState,
  EvidenceList,
  HandoverPassportModal,
  HospitalGridModal,
  Loading,
  MultiAgentConsensusModal,
  Overline,
  PortalSettingsModal,
  RiskBadge,
  SafetyRules,
  Simulated,
  StatusBadge,
  VitalsGrid,
  buildPassport,
  fieldCls,
  useLoad,
} from './shared';

const POLL = 10000;
const sel = (on: boolean) =>
  `w-full rounded-2xl border p-3.5 text-left transition ${
    on
      ? 'border-[#d97757] bg-[#d97757]/10 shadow-md'
      : 'border-[#3e3e38] bg-[#2c2c2b] hover:border-[#52514a]'
  }`;

const DECISIONS = ['MONITOR', 'FOLLOW_UP', 'URGENT_REVIEW', 'EMERGENCY_ESCALATION', 'RESOLVED'];

export function DoctorView() {
  const [tab, setTab] = useState<'triage' | 'consult'>('triage');
  const triage = useLoad(api.doctorQueue, [], POLL);
  const consults = useLoad(api.consultationQueue, [], POLL);
  const [key, setKey] = useState<string>();
  const [ev, setEv] = useState<Evidence[]>();
  const [decision, setDecision] = useState(DECISIONS[0]);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();

  // Modals
  const [passport, setPassport] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [societyOpen, setSocietyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hospitalOpen, setHospitalOpen] = useState(false);

  const rows: Array<{ k: string; t?: TriageItem; c?: Consultation }> =
    tab === 'triage'
      ? (triage.data ?? []).map((t, i) => ({ k: t.id ?? t.patient_id ?? String(i), t }))
      : (consults.data ?? []).map((c) => ({ k: c.id, c }));

  const cur = rows.find((r) => r.k === key);
  const patient = cur?.t?.patient ?? cur?.c?.patient;
  const a = cur?.t ?? cur?.c?.assessment;
  const patientId = patient?.id ?? cur?.t?.patient_id ?? cur?.c?.patient_id;

  const pick = async (k: string, query: string) => {
    setKey(k);
    setMsg(undefined);
    setErr(undefined);
    setEv(undefined);
    try {
      setEv(await api.rag(query));
    } catch {
      setEv([]);
    }
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setErr(undefined);
    try {
      await fn();
      setMsg(okMsg);
      triage.reload();
      consults.reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const list = tab === 'triage' ? triage : consults;

  return (
    <div className="space-y-6">
      {/* Doctor Action Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3e3e38] bg-[#2c2c2b] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]">
            <Stethoscope size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#faf9f5]">Clinical Intelligence Workstation</h2>
            <p className="text-xs text-[#a9a99f]">
              Prioritized triage queue, explainable decision support, and multi-agent specialist deliberation
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {patientId && (
            <Btn tone="ghost" onClick={() => setDossierOpen(true)} className="text-xs flex items-center gap-1.5">
              <Users size={14} className="text-[#d97757]" />
              Patient Dossier & PDF
            </Btn>
          )}
          <Btn tone="ghost" onClick={() => setSocietyOpen(true)} className="text-xs flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#9c87f5]" />
            Multi-Agent Society
          </Btn>
          <Btn tone="ghost" onClick={() => setHospitalOpen(true)} className="text-xs flex items-center gap-1.5">
            <Building2 size={14} className="text-[#41d69a]" />
            Hospital Resource Grid
          </Btn>
          <Btn tone="ghost" onClick={() => setSettingsOpen(true)} className="text-xs flex items-center gap-1.5">
            <Settings size={14} />
            Settings
          </Btn>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left Column: Triage & Consultation Queues */}
        <div className="space-y-3 xl:col-span-4">
          <div className="flex gap-2 rounded-xl bg-[#1b1b19] p-1 border border-[#3e3e38]" role="tablist">
            {(['triage', 'consult'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setKey(undefined);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                  tab === t
                    ? 'bg-[#d97757] text-[#1a1915] shadow-sm'
                    : 'text-[#a9a99f] hover:text-[#faf9f5]'
                }`}
              >
                {t === 'triage' ? 'Prioritized Triage Queue' : 'Tele-Consultation Queue'}
              </button>
            ))}
          </div>

          {list.loading ? (
            <Loading label="Polling clinical triage queue…" />
          ) : list.error ? (
            <ErrorState message={list.error} retry={list.reload} />
          ) : !rows.length ? (
            <Empty>No patients currently awaiting triage review.</Empty>
          ) : (
            <div className="space-y-2">
              {rows.map(({ k, t, c }) => (
                <button
                  key={k}
                  className={sel(k === key)}
                  onClick={() =>
                    void pick(
                      k,
                      [(t ?? c?.assessment)?.care_level, c?.specialty, c?.health_summary].filter(Boolean).join(' ') ||
                        'triage'
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#faf9f5]">
                      {(t?.patient ?? c?.patient)?.full_name ?? 'Patient'}
                    </span>
                    {c && <span className="font-mono text-xs text-[#d97757] font-bold">{c.token_number}</span>}
                  </div>
                  <p className="font-mono text-[11px] text-[#a9a99f]">
                    {(t?.patient ?? c?.patient)?.public_id ?? ''}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <RiskBadge level={(t ?? c?.assessment)?.care_level} />
                    {t?.risk_score !== undefined && (
                      <span className="font-mono text-xs text-[#faf9f5]">
                        Score: <strong>{t.risk_score.toFixed(1)}</strong>
                      </span>
                    )}
                    {c && <StatusBadge status={c.status} tone="cyan" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Active Patient Clinical Dossier */}
        <div className="space-y-4 xl:col-span-8">
          {!cur ? (
            <Card>
              <Empty>Select a patient from the queue to open their clinical dossier and decision logger.</Empty>
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#3e3e38] pb-3 mb-3">
                  <div>
                    <Overline>Active Clinical Patient Dossier</Overline>
                    <h2 className="text-xl font-bold text-[#faf9f5]">{patient?.full_name ?? 'Patient'}</h2>
                    <p className="text-xs text-[#a9a99f]">
                      {[
                        patient?.age && `${patient.age} yrs`,
                        patient?.blood_group && `Blood Group: ${patient.blood_group}`,
                        patient?.known_conditions,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn tone="ghost" onClick={() => setPassport(true)} className="text-xs">
                      Handover Passport
                    </Btn>
                    <Btn tone="ghost" onClick={() => setDossierOpen(true)} className="text-xs flex items-center gap-1">
                      <Download size={14} /> Full Dossier & PDF
                    </Btn>
                    {cur.c && cur.c.status === 'WAITING' && (
                      <Btn
                        onClick={() => void act(() => api.startConsultation(cur.c!.id), 'Consultation started')}
                        className="text-xs"
                      >
                        Start Consultation
                      </Btn>
                    )}
                    {cur.c && cur.c.status === 'IN_REVIEW' && (
                      <Btn
                        tone="emerald"
                        onClick={() => void act(() => api.completeConsultation(cur.c!.id), 'Consultation completed')}
                        className="text-xs"
                      >
                        Complete Consultation
                      </Btn>
                    )}
                  </div>
                </div>

                {cur.c?.health_summary && (
                  <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                    <Overline>Patient Intake Summary</Overline>
                    <p className="mt-1 text-xs text-[#faf9f5] leading-relaxed">{cur.c.health_summary}</p>
                  </div>
                )}
              </Card>

              <SafetyRules a={a as never} />

              <Card>
                <Overline>Telemetry Snapshot (GATT & Device Stream)</Overline>
                <div className="mt-2">
                  <VitalsGrid
                    v={a?.vitals}
                    badge={<Simulated label="DATA PROVENANCE: Telemetry stream verified via backend pipeline" />}
                  />
                </div>
              </Card>

              <Card>
                <Overline>Explainable Multi-Modal Risk Factor Breakdown</Overline>
                {a?.top_factors?.length ? (
                  <ul className="mt-2 space-y-1.5 text-xs text-[#faf9f5]">
                    {a.top_factors.map((f) => (
                      <li
                        key={f.factor_name}
                        className="flex items-center justify-between rounded-lg bg-[#1b1b19] px-3 py-1.5 border border-[#3e3e38]"
                      >
                        <span>{f.factor_name}</span>
                        <span className="font-mono text-[#d97757]">
                          {f.direction.replace(/_/g, ' ')} · {f.contribution}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2">
                    <Empty>No factor decomposition returned for this patient record.</Empty>
                  </div>
                )}
              </Card>

              <Card>
                <Overline className="text-[#9c87f5]">
                  Verified Clinical Guidelines & Evidence Citations (Hybrid RAG + Tavily)
                </Overline>
                <div className="mt-2">
                  {ev === undefined ? (
                    <Loading label="Retrieving clinical evidence citations…" />
                  ) : (
                    <EvidenceList items={ev} />
                  )}
                </div>
              </Card>

              {/* Clinician Decision Logger */}
              <Card>
                <Overline>Clinician Decision Logger & Audit Trail</Overline>
                <div className="mt-2 space-y-3">
                  <select
                    aria-label="Clinical Decision Action"
                    className={fieldCls}
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  >
                    {DECISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <textarea
                    aria-label="Clinical Assessment Note"
                    className={`${fieldCls} min-h-24 py-2`}
                    placeholder="Enter clinical assessment notes, medication instructions, or escalation justification…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <Btn
                      disabled={!patientId || !note.trim()}
                      onClick={() =>
                        void act(
                          () => api.logReview({ patient_id: patientId!, decision, note, assessment_id: a?.id }),
                          'Clinical decision signed and recorded in immutable audit log.'
                        ).then(() => setNote(''))
                      }
                      className="px-6"
                    >
                      Save & Sign Clinical Decision
                    </Btn>
                    {msg && <p className="text-xs text-[#41d69a] font-bold">{msg}</p>}
                  </div>
                  {err && <ErrorState message={err} />}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {passport && cur && (
        <HandoverPassportModal
          passport={buildPassport(patient, a as never, undefined, a?.vitals)}
          onClose={() => setPassport(false)}
        />
      )}
      {dossierOpen && patientId && (
        <ClinicalDossierModal patientId={patientId} onClose={() => setDossierOpen(false)} />
      )}
      {societyOpen && (
        <MultiAgentConsensusModal
          initialData={{
            symptom_text: cur?.c?.health_summary ?? (a?.active_symptoms ?? []).map((s) => s.name).join(', '),
            vitals: a?.vitals as Record<string, number>,
            conditions: patient?.known_conditions,
            allergies: patient?.allergies,
          }}
          onClose={() => setSocietyOpen(false)}
        />
      )}
      {hospitalOpen && <HospitalGridModal onClose={() => setHospitalOpen(false)} />}
      {settingsOpen && <PortalSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export const LIFECYCLE: EmergencyStatus[] = [
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

const stageIdx = (s: EmergencyStatus) =>
  LIFECYCLE.indexOf(s === 'PATIENT_REACHED' ? 'ON_SCENE' : s);

export function Stepper({
  steps,
  current,
  label,
}: {
  steps: Array<{ id: string; label: string }>;
  current: number;
  label: string;
}) {
  return (
    <ol aria-label={label} className="flex flex-wrap gap-1.5">
      {steps.map((s, i) => (
        <li
          key={s.id}
          aria-current={i === current ? 'step' : undefined}
          className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
            i < current
              ? 'border-[#41d69a]/40 bg-[#41d69a]/10 text-[#41d69a]'
              : i === current
              ? 'border-[#d97757] bg-[#d97757]/20 text-[#d97757] ring-1 ring-[#d97757]'
              : 'border-[#3e3e38] text-[#a9a99f]'
          }`}
        >
          {i < current ? '✓ ' : ''}
          {s.label.replace(/_/g, ' ')}
        </li>
      ))}
    </ol>
  );
}

function CaseBoard({
  cases,
  id,
  onPick,
}: {
  cases: EmergencyCase[];
  id?: string;
  onPick: (id: string) => void;
}) {
  return !cases.length ? (
    <Empty>No active emergency cases. Operations normal.</Empty>
  ) : (
    <div className="space-y-2">
      {cases.map((c) => (
        <button key={c.id} className={sel(c.id === id)} onClick={() => onPick(c.id)}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#faf9f5]">
              {c.patient?.full_name ?? 'Patient'}
            </span>
            <StatusBadge
              status={c.severity}
              tone={c.severity === 'CRITICAL' || c.severity === 'HIGH' ? 'rose' : 'slate'}
            />
          </div>
          <p className="font-mono text-[11px] text-[#a9a99f]">{c.public_id ?? c.id}</p>
          <div className="mt-2 flex items-center justify-between">
            <StatusBadge status={c.status} tone="cyan" />
            <span className="text-[11px] text-[#a9a99f]">
              {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function EmergencyView() {
  const cases = useLoad(api.emergencyCases, [], POLL);
  const [id, setId] = useState<string>();
  const [err, setErr] = useState<string>();
  const [msg, setMsg] = useState<string>();

  // Modals
  const [passport, setPassport] = useState(false);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cctvSimulating, setCctvSimulating] = useState(false);

  const c = cases.data?.find((x) => x.id === id);

  const act = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setErr(undefined);
    setMsg(undefined);
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
      cases.reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const triggerCctvFall = async () => {
    setCctvSimulating(true);
    setErr(undefined);
    try {
      const pId = c?.patient_id ?? 'p-demo-fall';
      const alert = await api.cctvFallAlert('VISION-CCTV-ER-ROOM-1', pId, 0.96);
      setMsg(`Ambient CCTV fall alert recorded: ${alert.event_id} (Confidence: ${(alert.confidence_score * 100).toFixed(0)}%). Emergency protocol activated.`);
      cases.reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setCctvSimulating(false);
    }
  };

  const i = c ? stageIdx(c.status) : -1;

  return (
    <div className="space-y-6">
      {/* Emergency Command Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3e3e38] bg-[#2c2c2b] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#fb7185]/40 bg-[#fb7185]/10 text-[#fb7185]">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#faf9f5]">Emergency Command & Dispatch Center</h2>
            <p className="text-xs text-[#a9a99f]">
              Autonomous 10-stage incident lifecycle, regional trauma bed allocation, and CCTV fall telemetry
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="ghost" onClick={() => setHospitalOpen(true)} className="text-xs flex items-center gap-1.5">
            <Building2 size={14} className="text-[#41d69a]" />
            Metropolitan Hospital Bed Grid
          </Btn>
          <Btn
            tone="ghost"
            onClick={triggerCctvFall}
            disabled={cctvSimulating}
            className="text-xs flex items-center gap-1.5"
          >
            <Camera size={14} className="text-[#f2b955]" />
            {cctvSimulating ? 'Processing CCTV Feed…' : 'Simulate CCTV Fall Alert'}
          </Btn>
          <Btn tone="ghost" onClick={() => setSettingsOpen(true)} className="text-xs flex items-center gap-1.5">
            <Settings size={14} />
            Settings
          </Btn>
        </div>
      </div>

      {msg && <p className="text-xs font-bold text-[#41d69a] rounded-xl bg-[#41d69a]/10 p-3 border border-[#41d69a]">{msg}</p>}

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left Column: Emergency Incidents Board */}
        <div className="space-y-3 xl:col-span-5">
          <div className="flex items-center justify-between">
            <Overline>Active Emergency Incidents</Overline>
            <span className="font-mono text-xs text-[#a9a99f]">{cases.data?.length ?? 0} active</span>
          </div>
          {cases.loading ? (
            <Loading label="Polling emergency incident board…" />
          ) : cases.error ? (
            <ErrorState message={cases.error} retry={cases.reload} />
          ) : (
            <CaseBoard cases={cases.data ?? []} id={id} onPick={setId} />
          )}
        </div>

        {/* Right Column: Case Lifecycle & Dispatch Controls */}
        <div className="space-y-4 xl:col-span-7">
          {!c ? (
            <Card>
              <Empty>Select an active emergency incident to inspect telemetry and dispatch response units.</Empty>
            </Card>
          ) : (
            <>
              <Card>
                <Overline>10-Stage Emergency Response State Machine</Overline>
                <div className="mt-3">
                  <Stepper
                    label="Emergency lifecycle"
                    current={i}
                    steps={LIFECYCLE.map((s) => ({ id: s, label: s }))}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn tone="ghost" onClick={() => setPassport(true)} className="text-xs">
                    Handover Passport
                  </Btn>
                  <Btn
                    disabled={c.status !== 'DETECTED' && c.status !== 'UNDER_REVIEW'}
                    onClick={() => void act(() => api.verifyCase(c.id), 'Emergency incident verified.')}
                    className="text-xs"
                  >
                    Verify Incident
                  </Btn>
                  <Btn
                    tone="rose"
                    disabled={c.status !== 'VERIFIED'}
                    onClick={() => void act(() => api.dispatchCase(c.id), 'Ambulance dispatch requested.')}
                    className="text-xs"
                  >
                    Request Ambulance Dispatch
                  </Btn>
                  <Btn
                    tone="ghost"
                    disabled={i < LIFECYCLE.indexOf('DISPATCHED') || i >= LIFECYCLE.length - 1}
                    onClick={() => void act(() => api.advanceCase(c.id), 'Case advanced to next transit stage.')}
                    className="text-xs"
                  >
                    Advance Transit Stage
                  </Btn>
                  <Btn tone="ghost" onClick={() => setHospitalOpen(true)} className="text-xs">
                    Check Hospital Bed Grid
                  </Btn>
                </div>
                {err && <div className="mt-3"><ErrorState message={err} /></div>}
              </Card>

              <SafetyRules a={c.assessment} />

              <Card>
                <Overline>Patient Triage & Medical Snapshot</Overline>
                <div className="mt-3 grid gap-3 text-xs text-[#faf9f5] sm:grid-cols-3">
                  <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                    <p className="text-[10px] text-[#a9a99f]">Demographics</p>
                    <p className="font-bold">{c.patient?.full_name ?? 'Unknown'}</p>
                    <p className="font-mono text-[#d97757]">
                      {c.patient?.age ? `${c.patient.age} yrs` : '—'} · {c.patient?.blood_group ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                    <p className="text-[10px] text-[#a9a99f]">Trigger & Symptoms</p>
                    <p className="font-bold">{c.trigger_type ?? 'SOS'}</p>
                    <p className="text-[#a9a99f]">
                      {(c.assessment?.active_symptoms ?? []).map((s) => s.name).join(', ') || 'No symptoms'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                    <p className="text-[10px] text-[#a9a99f]">Emergency Contact</p>
                    <p className="font-bold">{c.patient?.emergency_contact_name || 'Not provided'}</p>
                    <p className="font-mono text-[#d97757]">{c.patient?.emergency_contact_phone || 'No phone'}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <Overline>Incident Telemetry Snapshot</Overline>
                <div className="mt-2">
                  <VitalsGrid v={c.assessment?.vitals} />
                </div>
              </Card>

              <Card>
                <Overline>Incident Location & Geolocation Latch</Overline>
                <div className="mt-2 flex items-center justify-between text-xs text-[#faf9f5]">
                  <p className="flex items-center gap-1.5">
                    <MapPin size={16} className="text-[#d97757]" />
                    {c.location?.address ?? 'Browser/Device GPS Coordinate Latch'}
                    {c.location?.lat !== undefined && (
                      <span className="font-mono text-[#a9a99f]">
                        {' '}· {c.location.lat.toFixed(4)}, {c.location.lng?.toFixed(4)}
                      </span>
                    )}
                  </p>
                  <Simulated label="[SIMULATED] Demo Location" />
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {passport && c && (
        <HandoverPassportModal
          passport={buildPassport(c.patient, c.assessment, c, c.assessment?.vitals)}
          onClose={() => setPassport(false)}
        />
      )}
      {hospitalOpen && <HospitalGridModal onClose={() => setHospitalOpen(false)} />}
      {settingsOpen && <PortalSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

const TRANSIT: Array<{ id: EmergencyStatus; label: string }> = [
  { id: 'DISPATCHED', label: 'Dispatched' },
  { id: 'EN_ROUTE', label: 'En Route' },
  { id: 'ON_SCENE', label: 'On Scene' },
  { id: 'TRANSPORTING', label: 'Transporting' },
  { id: 'HOSPITAL_REACHED', label: 'Hospital Reached' },
  { id: 'COMPLETED', label: 'Completed' },
];

const ACTIVE = new Set<EmergencyStatus>([
  'DISPATCHED',
  'EN_ROUTE',
  'ON_SCENE',
  'PATIENT_REACHED',
  'TRANSPORTING',
  'HOSPITAL_REACHED',
  'COMPLETED',
]);

export function AmbulanceView() {
  const cases = useLoad(api.emergencyCases, [], POLL);
  const [id, setId] = useState<string>();
  const [err, setErr] = useState<string>();
  const [passport, setPassport] = useState(false);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const brief = useLoad<AmbulanceBrief | undefined>(
    () => (id ? api.ambulanceBrief(id) : Promise.resolve(undefined)),
    [id],
    POLL
  );

  const mine = (cases.data ?? []).filter((c) => ACTIVE.has(c.status));
  const c = mine.find((x) => x.id === id);
  const i = c
    ? TRANSIT.findIndex((t) => t.id === (c.status === 'PATIENT_REACHED' ? 'ON_SCENE' : c.status))
    : -1;

  const b = brief.data;
  const patient = b?.patient ?? c?.patient;
  const a = b?.assessment ?? c?.assessment;
  const vitals = b?.vitals ?? a?.vitals;

  const advance = async () => {
    setErr(undefined);
    try {
      await api.ambulanceAdvance(c!.id);
      cases.reload();
      brief.reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      {/* Ambulance Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3e3e38] bg-[#2c2c2b] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]">
            <Radio size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#faf9f5]">Ambulance & Field Response Unit 01</h2>
            <p className="text-xs text-[#a9a99f]">
              High-contrast paramedic transit stepper, trauma hospital bed allocation, and receiving bay handoff
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="ghost" onClick={() => setHospitalOpen(true)} className="text-xs flex items-center gap-1.5">
            <Building2 size={14} className="text-[#41d69a]" />
            Hospital Bed Grid
          </Btn>
          <Btn tone="ghost" onClick={() => setSettingsOpen(true)} className="text-xs flex items-center gap-1.5">
            <Settings size={14} />
            Settings
          </Btn>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-4">
          <Overline>Assigned Transit Cases</Overline>
          {cases.loading ? (
            <Loading label="Polling dispatched cases…" />
          ) : cases.error ? (
            <ErrorState message={cases.error} retry={cases.reload} />
          ) : mine.length ? (
            <CaseBoard cases={mine} id={id} onPick={setId} />
          ) : (
            <Empty>No dispatched cases assigned to this ambulance response unit.</Empty>
          )}
        </div>

        <div className="space-y-4 xl:col-span-8">
          {!c ? (
            <Card>
              <Empty>Select an assigned case to view the pre-arrival clinical brief.</Empty>
            </Card>
          ) : (
            <>
              <Card>
                <Overline>Transit Milestones & Stepper</Overline>
                <div className="mt-3">
                  <Stepper label="Transit" current={i} steps={TRANSIT} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn tone="ghost" onClick={() => setPassport(true)} className="text-xs">
                    Handover Passport
                  </Btn>
                  <Btn
                    disabled={c.status === 'COMPLETED'}
                    onClick={() => void advance()}
                    className="text-xs px-5"
                  >
                    Advance Transit Status
                  </Btn>
                  <Btn tone="ghost" onClick={() => setHospitalOpen(true)} className="text-xs">
                    Trauma Bay Allocation
                  </Btn>
                </div>
                {err && <div className="mt-3"><ErrorState message={err} /></div>}
              </Card>

              <SafetyRules a={a} />

              <Card>
                <Overline>Pre-Arrival Patient Emergency Dossier</Overline>
                {brief.loading ? (
                  <Loading label="Loading patient emergency profile…" />
                ) : brief.error ? (
                  <ErrorState message={brief.error} retry={brief.reload} />
                ) : (
                  <div className="mt-3 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38] pb-3">
                      <div>
                        <h3 className="text-lg font-bold text-[#faf9f5]">
                          {patient?.full_name ?? b?.patient_profile?.full_name ?? 'Patient'}
                        </h3>
                        <p className="font-mono text-xs text-[#d97757]">
                          {patient?.public_id ?? b?.patient_profile?.public_id}
                        </p>
                      </div>
                      <p className="text-xs text-[#a9a99f]">
                        {[
                          b?.patient_profile?.age && `${b.patient_profile.age} yrs`,
                          b?.patient_profile?.blood_group && `Blood Group: ${b.patient_profile.blood_group}`,
                          b?.patient_profile?.height_cm && `${b.patient_profile.height_cm} cm`,
                          b?.patient_profile?.weight_kg && `${b.patient_profile.weight_kg} kg`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    {b?.incident_snapshot?.reported_issue && (
                      <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                        <p className="text-[10px] text-[#a9a99f] uppercase font-bold">Reported Clinical Issue</p>
                        <p className="text-sm font-bold text-[#fb7185] mt-0.5">
                          {b.incident_snapshot.reported_issue}
                        </p>
                      </div>
                    )}

                    <VitalsGrid v={vitals} />

                    <div className="flex items-center justify-between text-xs text-[#a9a99f] border-t border-[#3e3e38] pt-2">
                      <p>
                        Location: {c.location?.address ?? 'En route to Latched GPS'} <Simulated />
                      </p>
                      <p>Contact: {patient?.emergency_contact_phone || 'None documented'}</p>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {passport && c && (
        <HandoverPassportModal
          passport={buildPassport(patient, a, c, vitals)}
          onClose={() => setPassport(false)}
        />
      )}
      {hospitalOpen && <HospitalGridModal onClose={() => setHospitalOpen(false)} />}
      {settingsOpen && <PortalSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export function AdminView() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [rules, setRules] = useState<
    Array<{ rule_id: string; condition: string; severity: string; reason: string }>
  >([]);
  const [audit, setAudit] = useState<
    Array<{
      id: string;
      actor_role: string;
      action: string;
      target_type: string;
      target_id: string;
      result: string;
      created_at: string;
    }>
  >([]);
  const [err, setErr] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Admin Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3e3e38] bg-[#2c2c2b] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#faf9f5]">System Intelligence & Governance Console</h2>
            <p className="text-xs text-[#a9a99f]">
              AI benchmark validation, deterministic safety rule verification, and immutable audit ledger
            </p>
          </div>
        </div>
        <Btn tone="ghost" onClick={() => setSettingsOpen(true)} className="text-xs flex items-center gap-1.5">
          <Settings size={14} />
          System Settings & Failover
        </Btn>
      </div>

      {err && <ErrorState message={err} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <Overline>Model Validation Benchmarks</Overline>
          <div className="mt-3">
            {metrics ? (
              <pre className="max-h-72 overflow-auto rounded-xl bg-[#1b1b19] p-3 font-mono text-[11px] text-[#d97757]">
                {JSON.stringify(metrics, null, 2)}
              </pre>
            ) : (
              <Loading label="Loading validation benchmarks…" />
            )}
          </div>
        </Card>

        <Card>
          <Overline>Deterministic Safety Rule Catalog (RF-001 to RF-007)</Overline>
          <ul className="mt-3 max-h-72 overflow-auto space-y-2">
            {rules.length ? (
              rules.map((r) => (
                <li key={r.rule_id} className="rounded-lg bg-[#1b1b19] p-2.5 text-xs text-[#faf9f5] border border-[#3e3e38]">
                  <span className="mr-2 font-mono font-bold text-[#fb7185]">[{r.rule_id}]</span>
                  {r.condition}
                  <span className="block font-mono text-[10px] text-[#d97757] mt-0.5">
                    {r.severity} · {r.reason}
                  </span>
                </li>
              ))
            ) : (
              <Loading label="Loading safety ruleset…" />
            )}
          </ul>
        </Card>

        <Card>
          <Overline>Immutable Append-Only Audit Log</Overline>
          <div className="mt-3 max-h-72 overflow-auto space-y-1.5">
            {audit.length ? (
              audit.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-[#3e3e38] bg-[#1b1b19] p-2.5 text-[11px] text-[#faf9f5]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#d97757]">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                    <span className="font-mono text-[#f2b955] uppercase text-[10px]">{a.actor_role}</span>
                  </div>
                  <p className="mt-0.5 font-bold">{a.action}</p>
                  <p className="font-mono text-[#a9a99f] text-[10px]">
                    {a.target_type}/{a.target_id} · {a.result}
                  </p>
                </div>
              ))
            ) : (
              <Loading label="Loading system audit records…" />
            )}
          </div>
        </Card>
      </div>

      {settingsOpen && <PortalSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
