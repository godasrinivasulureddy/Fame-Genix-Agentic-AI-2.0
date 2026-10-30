import { useEffect, useState } from 'react';
import {
  Activity,
  Ambulance,
  ArrowRight,
  CheckCircle2,
  Heart,
  Radio,
  Settings,
  Shield,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react';
import { api, errMsg, tokenStore } from './api';
import type { Role, SessionUser } from './types';
import PatientView from './patient';
import { AdminView, AmbulanceView, DoctorView, EmergencyView } from './staff';
import {
  Btn,
  Card,
  ErrorState,
  Modal,
  Overline,
  PortalSettingsModal,
  fieldCls,
} from './shared';

const PORTALS: Array<{
  role: Role;
  label: string;
  blurb: string;
  local: string;
  icon: typeof Heart;
  badge: string;
}> = [
  {
    role: 'PATIENT',
    label: 'Patient Portal',
    local: 'patient',
    icon: Heart,
    badge: 'Continuous Telemetry',
    blurb: 'Multimodal symptoms intake, FAME Smart Mask BLE stream, vital drift detection, and AI explanation',
  },
  {
    role: 'DOCTOR',
    label: 'Doctor Workstation',
    local: 'doctor',
    icon: Stethoscope,
    badge: 'Clinical Decision Support',
    blurb: 'Prioritized acuity triage, multi-agent medical society consensus, patient dossier & PDF export',
  },
  {
    role: 'EMERGENCY_OPERATOR',
    label: 'Emergency Command',
    local: 'emergency',
    icon: ShieldAlert,
    badge: '10-Stage Lifecycle',
    blurb: 'Real-time incident verification, dispatch coordination, ambient CCTV fall alerts, and trauma hospital bed grid',
  },
  {
    role: 'AMBULANCE_TEAM',
    label: 'Ambulance Transit',
    local: 'ambulance',
    icon: Ambulance,
    badge: 'Field Response',
    blurb: 'High-contrast paramedic stepper, pre-arrival patient brief, and receiving ER trauma bay handoff',
  },
  {
    role: 'SYSTEM_ADMIN',
    label: 'Governance Console',
    local: 'admin',
    icon: Shield,
    badge: 'Audit & Benchmarks',
    blurb: 'Model validation benchmarks, deterministic RF safety rules catalog, and immutable audit ledger',
  },
];

const DOMAIN: string = import.meta.env.VITE_DEMO_DOMAIN ?? 'famegenix.org';
const DEMO_PW: string = import.meta.env.VITE_DEMO_PASSWORD ?? 'FameGenix#2026';

function AuthModal({
  onDone,
  onClose,
  presetEmail,
}: {
  onDone: () => void;
  onClose: () => void;
  presetEmail?: string;
}) {
  const [tab, setTab] = useState<'credentials' | 'sso'>('credentials');
  const [email, setEmail] = useState(presetEmail ?? `patient@${DOMAIN}`);
  const [pw, setPw] = useState(DEMO_PW);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    try {
      const res = await api.login(email, pw);
      tokenStore.set(res.access_token);
      onDone();
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  const handleSsoLogin = async (ssoRole: Role, _provider: string) => {
    setBusy(true);
    setErr(undefined);
    try {
      const local = PORTALS.find((p) => p.role === ssoRole)?.local ?? 'patient';
      const targetEmail = `${local}@${DOMAIN}`;
      const res = await api.login(targetEmail, DEMO_PW);
      tokenStore.set(res.access_token);
      onDone();
    } catch (x) {
      setErr(`SSO Handshake failed: ${errMsg(x)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Secure System Authentication & SSO" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Auth Method Tabs */}
        <div className="flex gap-2 rounded-xl bg-[#1b1b19] p-1 border border-[#3e3e38]">
          <button
            type="button"
            onClick={() => setTab('credentials')}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              tab === 'credentials'
                ? 'bg-[#d97757] text-[#1a1915]'
                : 'text-[#a9a99f] hover:text-[#faf9f5]'
            }`}
          >
            Clinical Credentials
          </button>
          <button
            type="button"
            onClick={() => setTab('sso')}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              tab === 'sso'
                ? 'bg-[#d97757] text-[#1a1915]'
                : 'text-[#a9a99f] hover:text-[#faf9f5]'
            }`}
          >
            Institutional SSO
          </button>
        </div>

        {tab === 'credentials' ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-[#a9a99f]">Email Address</label>
              <input
                className={`${fieldCls} mt-1`}
                type="email"
                required
                aria-label="Email"
                placeholder="name@famegenix.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#a9a99f]">Password</label>
              <input
                className={`${fieldCls} mt-1`}
                type="password"
                required
                aria-label="Password"
                placeholder="Password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </div>

            <div className="rounded-xl bg-[#1b1b19] p-2.5 border border-[#3e3e38]">
              <p className="font-mono text-[11px] text-[#a9a99f]">
                Demo master credentials: <strong className="text-[#faf9f5]">FameGenix#2026</strong>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PORTALS.map((p) => (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => setEmail(`${p.local}@${DOMAIN}`)}
                    className="rounded-lg border border-[#3e3e38] bg-[#2c2c2b] px-2 py-0.5 font-mono text-[10px] text-[#d97757] hover:border-[#d97757]"
                  >
                    {p.local}
                  </button>
                ))}
              </div>
            </div>

            {err && <ErrorState message={err} />}
            <Btn type="submit" disabled={busy} className="w-full py-2.5">
              {busy ? 'Verifying Credentials…' : 'Sign In with Authorized Profile'}
            </Btn>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#a9a99f] leading-relaxed">
              Authenticate via hospital Active Directory, SAML 2.0 federation, or national healthcare identity (ABHA).
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSsoLogin('DOCTOR', 'Hospital AD / SAML')}
                className="w-full flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3 text-left hover:border-[#d97757] transition"
              >
                <div className="flex items-center gap-2.5">
                  <Stethoscope size={18} className="text-[#d97757]" />
                  <div>
                    <p className="text-xs font-bold text-[#faf9f5]">Hospital Active Directory / SAML SSO</p>
                    <p className="text-[10px] text-[#a9a99f]">Direct physician & clinician federation</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#d97757]" />
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSsoLogin('PATIENT', 'National Healthcare ID')}
                className="w-full flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3 text-left hover:border-[#d97757] transition"
              >
                <div className="flex items-center gap-2.5">
                  <Heart size={18} className="text-[#41d69a]" />
                  <div>
                    <p className="text-xs font-bold text-[#faf9f5]">National Healthcare Identity / ABHA SSO</p>
                    <p className="text-[10px] text-[#a9a99f]">Universal citizen health record link</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#41d69a]" />
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSsoLogin('EMERGENCY_OPERATOR', 'Emergency Dispatch System')}
                className="w-full flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3 text-left hover:border-[#fb7185] transition"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert size={18} className="text-[#fb7185]" />
                  <div>
                    <p className="text-xs font-bold text-[#faf9f5]">Regional 911 / EMS Dispatch SSO</p>
                    <p className="text-[10px] text-[#a9a99f]">Emergency dispatch & ambulance CAD network</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#fb7185]" />
              </button>
            </div>

            {err && <ErrorState message={err} />}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Landing({
  onExplore,
  onSignIn,
}: {
  onExplore: (r: Role) => void;
  onSignIn: () => void;
}) {
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);

  return (
    <div className="min-h-screen bg-[#262624] text-[#faf9f5]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#3e3e38] bg-[#262624]/90 backdrop-blur-md px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757] text-[#1a1915] font-extrabold shadow-md shadow-[#d97757]/30">
            <Activity size={20} />
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-[#faf9f5] text-base sm:text-lg">FAME-GENIX 2.0</span>
            <span className="ml-2 hidden rounded-md border border-[#d97757]/40 bg-[#d97757]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d97757] sm:inline">
              CLINICAL AI & EMS
            </span>
          </div>

          {/* Interactive Simulation Toggle (from V1) */}
          <button
            onClick={() => setIsEmergencyMode(!isEmergencyMode)}
            className={`hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold transition border ${
              isEmergencyMode
                ? 'bg-[#fb7185]/20 border-[#fb7185] text-[#fb7185] shadow-lg shadow-[#fb7185]/20'
                : 'bg-[#41d69a]/10 border-[#41d69a]/40 text-[#41d69a] hover:border-[#41d69a]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isEmergencyMode ? 'bg-[#fb7185] animate-ping' : 'bg-[#41d69a]'
              }`}
            />
            <span>{isEmergencyMode ? 'CODE RED ACTIVE (Click for Stable)' : 'STABLE MODE (Click for Code Red)'}</span>
          </button>
        </div>

        {/* Quick Portal Switcher Pills */}
        <nav className="hidden xl:flex items-center gap-1 rounded-xl bg-[#1b1b19] p-1 border border-[#3e3e38] font-mono text-xs">
          {PORTALS.map((p) => (
            <button
              key={p.role}
              onClick={() => onExplore(p.role)}
              className="px-2.5 py-1 rounded-lg text-[#a9a99f] hover:text-[#faf9f5] hover:bg-[#2c2c2b] transition flex items-center gap-1.5"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  p.role === 'PATIENT'
                    ? 'bg-[#41d69a]'
                    : p.role === 'DOCTOR'
                    ? 'bg-[#d97757]'
                    : p.role === 'EMERGENCY_OPERATOR'
                    ? 'bg-[#fb7185]'
                    : p.role === 'AMBULANCE_TEAM'
                    ? 'bg-[#f2b955]'
                    : 'bg-[#9c87f5]'
                }`}
              />
              <span>{p.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Btn tone="ghost" onClick={onSignIn} className="text-xs">
            Sign In / SSO
          </Btn>
          <Btn onClick={() => onExplore('PATIENT')} className="text-xs">
            Launch Portal
          </Btn>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-8 sm:py-20">
        {/* Hero Section */}
        <section className="relative grid gap-12 items-center lg:grid-cols-12">
          {/* Ambient simulation backdrop glow */}
          <div
            className={`pointer-events-none absolute -top-24 right-1/4 h-96 w-96 rounded-full blur-[120px] transition-all duration-700 ${
              isEmergencyMode ? 'bg-[#fb7185]/20' : 'bg-[#d97757]/15'
            }`}
          />

          <div className="lg:col-span-7 space-y-5">
            {isEmergencyMode ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#fb7185] bg-[#fb7185]/10 px-3.5 py-1 font-mono text-xs font-bold text-[#fb7185] shadow-lg shadow-[#fb7185]/20 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-[#fb7185]" />
                ACTIVE CRITICAL OVERRIDE · CODE RED ENGAGED · PRIORITY 1 DISPATCH
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-3.5 py-1 font-mono text-xs font-semibold text-[#d97757]">
                <span className="h-2 w-2 rounded-full bg-[#d97757] animate-ping" />
                Continuous Telemetry · Deterministic Safety · Multi-Agent Society
              </div>
            )}

            <h1 className="text-3xl font-extrabold tracking-tight text-[#faf9f5] sm:text-5xl lg:text-6xl leading-[1.1]">
              Algorithmic Triage, Vitals Drift Detection & Emergency Handover
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[#a9a99f] sm:text-base">
              FAME-GENIX 2.0 is an enterprise-grade clinical decision support and emergency command platform.
              Multimodal physiological signals and patient symptoms are processed through deterministic red-flag safety
              rules (RF-001 through RF-007), verified clinical evidence retrieval (RAG + Tavily), and a synchronized
              pre-hospital Digital Handover Passport.
            </p>

            <div className="pt-2 flex flex-wrap gap-2.5">
              {PORTALS.map((p) => (
                <Btn
                  key={p.role}
                  tone={p.role === 'PATIENT' ? 'cyan' : 'ghost'}
                  onClick={() => onExplore(p.role)}
                  className="text-xs py-2.5 px-4"
                >
                  <p.icon size={14} className="mr-1.5" />
                  Explore {p.label}
                </Btn>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div
              className={`relative rounded-3xl border bg-[#2c2c2b] p-6 shadow-2xl transition-all duration-300 ${
                isEmergencyMode
                  ? 'border-[#fb7185] shadow-[#fb7185]/20 ring-1 ring-[#fb7185]'
                  : 'border-[#3e3e38]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#3e3e38] pb-3">
                <span className="text-xs font-bold text-[#faf9f5] flex items-center gap-2">
                  <Radio
                    size={14}
                    className={isEmergencyMode ? 'text-[#fb7185] animate-ping' : 'text-[#41d69a] animate-pulse'}
                  />
                  {isEmergencyMode ? 'ACTIVE CODE RED TELEMETRY' : 'Live Telemetry Waveform Signature'}
                </span>
                <span className={`font-mono text-[10px] font-bold ${isEmergencyMode ? 'text-[#fb7185]' : 'text-[#d97757]'}`}>
                  {isEmergencyMode ? 'LATENCY 12ms · DISPATCH ACTIVE' : '99.4% UPTIME'}
                </span>
              </div>

              {/* Dynamic ECG Waveform Graphic */}
              <div className="my-4 h-28 rounded-2xl bg-[#1b1b19] p-3 flex items-center justify-center border border-[#3e3e38] overflow-hidden">
                <svg
                  viewBox="0 0 400 60"
                  className={`w-full h-full transition-colors duration-500 ${
                    isEmergencyMode ? 'text-[#fb7185]' : 'text-[#d97757]'
                  }`}
                >
                  {isEmergencyMode ? (
                    // Tachycardia ECG wave
                    <path
                      d="M 0 30 L 20 30 L 25 5 L 30 55 L 35 15 L 40 45 L 45 30 L 75 30 L 80 5 L 85 55 L 90 15 L 95 45 L 100 30 L 130 30 L 135 5 L 140 55 L 145 15 L 150 45 L 155 30 L 185 30 L 190 5 L 195 55 L 200 15 L 205 45 L 210 30 L 240 30 L 245 5 L 250 55 L 255 15 L 260 45 L 265 30 L 295 30 L 300 5 L 305 55 L 310 15 L 315 45 L 320 30 L 350 30 L 355 5 L 360 55 L 365 15 L 370 45 L 375 30 L 400 30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    // Normal sinus rhythm wave
                    <path
                      d="M 0 30 L 40 30 L 50 10 L 60 50 L 70 20 L 80 40 L 90 30 L 150 30 L 160 8 L 170 52 L 180 18 L 190 42 L 200 30 L 260 30 L 270 12 L 280 48 L 290 22 L 300 38 L 310 30 L 400 30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {isEmergencyMode ? (
                  <>
                    <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#fb7185]/50">
                      <p className="text-[10px] text-[#fb7185] uppercase font-bold">Rule RF-002 Triggered</p>
                      <p className="text-sm font-bold text-[#faf9f5] mt-0.5">MAP &lt; 65 mmHg</p>
                      <p className="text-[10px] text-[#fb7185]">Immediate Code Red Dispatch</p>
                    </div>
                    <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#fb7185]/50">
                      <p className="text-[10px] text-[#fb7185] uppercase font-bold">Unit #04 En Route</p>
                      <p className="text-sm font-bold text-[#faf9f5] mt-0.5">ETA: 4 Minutes</p>
                      <p className="text-[10px] text-[#fb7185]">Cath Lab 01 Pre-Warmed</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                      <p className="text-[10px] text-[#a9a99f] uppercase font-bold">Safety Rule Guardrails</p>
                      <p className="text-sm font-bold text-[#41d69a] mt-0.5">Authoritative Priority</p>
                      <p className="text-[10px] text-[#a9a99f]">Deterministic override over LLMs</p>
                    </div>
                    <div className="rounded-xl bg-[#1b1b19] p-3 border border-[#3e3e38]">
                      <p className="text-[10px] text-[#a9a99f] uppercase font-bold">Trauma Bed Broker</p>
                      <p className="text-sm font-bold text-[#d97757] mt-0.5">Regional Grid</p>
                      <p className="text-[10px] text-[#a9a99f]">Live ICU & Cath Lab routing</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Prototype scope banner: these are engineering controls, not clinical validation metrics. */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-3xl border border-[#3e3e38] bg-[#1b1b19] p-4 text-xs">
          <div className="flex items-center gap-3 p-2">
            <span className="font-mono text-xl font-extrabold text-[#41d69a]">Rules</span>
            <div>
              <p className="font-bold text-[#faf9f5]">Deterministic safety layer</p>
              <p className="text-[10px] text-[#a9a99f]">Rule thresholds take priority over model output</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2">
            <span className="font-mono text-xl font-extrabold text-[#d97757]">AI</span>
            <div>
              <p className="font-bold text-[#faf9f5]">Grounded assistance</p>
              <p className="text-[10px] text-[#a9a99f]">Nebius/NVIDIA path with deterministic fallback</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2">
            <span className="font-mono text-xl font-extrabold text-[#9c87f5]">RAG</span>
            <div>
              <p className="font-bold text-[#faf9f5]">Traceable evidence</p>
              <p className="text-[10px] text-[#a9a99f]">Keyword retrieval over curated guideline chunks</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2">
            <span className="font-mono text-xl font-extrabold text-[#f2b955]">Demo</span>
            <div>
              <p className="font-bold text-[#faf9f5]">Non-clinical prototype</p>
              <p className="text-[10px] text-[#a9a99f]">Simulation workflows for software demonstration</p>
            </div>
          </div>
        </section>

        {/* 6-Stage Signal Pipeline */}
        <section className="space-y-4">
          <Overline>Architectural Signal Flow</Overline>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { num: '01', title: 'Understand', desc: 'Concept Extraction & Voice' },
              { num: '02', title: 'Observe', desc: 'BLE Mask & CCTV Stream' },
              { num: '03', title: 'Compare', desc: 'Longitudinal Drift (EWMA)' },
              { num: '04', title: 'Detect', desc: 'Deterministic Safety Rules' },
              { num: '05', title: 'Deliberate', desc: 'Multi-Agent Society Consensus' },
              { num: '06', title: 'Coordinate', desc: 'Receiving Trauma Passport' },
            ].map((s) => (
              <div key={s.num} className="rounded-2xl border border-[#3e3e38] bg-[#2c2c2b] p-4 shadow-sm">
                <span className="font-mono text-xs font-bold text-[#d97757]">{s.num}</span>
                <h4 className="mt-1 text-sm font-bold text-[#faf9f5]">{s.title}</h4>
                <p className="mt-1 text-xs text-[#a9a99f]">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 5-Role Portals */}
        <section className="space-y-4">
          <Overline>Role-Based Operational Portals</Overline>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PORTALS.map((p) => (
              <button
                key={p.role}
                onClick={() => onExplore(p.role)}
                className="rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-6 text-left shadow-lg hover:border-[#d97757] transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1b1b19] border border-[#3e3e38] text-[#d97757] group-hover:bg-[#d97757] group-hover:text-[#1a1915] transition">
                    <p.icon size={20} />
                  </div>
                  <span className="rounded-lg border border-[#3e3e38] bg-[#1b1b19] px-2 py-0.5 font-mono text-[10px] text-[#a9a99f]">
                    {p.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#faf9f5] group-hover:text-[#d97757] transition">
                  {p.label}
                </h3>
                <p className="mt-1.5 text-xs text-[#a9a99f] leading-relaxed">{p.blurb}</p>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#3e3e38] bg-[#1b1b19] py-8 text-center text-xs text-[#a9a99f]">
        <p>FAME-GENIX Agentic AI 2.0 · Designed for Nebius × NVIDIA Global AI Hackathon 2026</p>
        <p className="mt-1 font-mono text-[11px] text-[#77766e]">
          Demonstration Prototype. Deterministic clinical safety rules outrank AI predictions.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [auth, setAuth] = useState<{ email?: string; want?: Role } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ssoNotice, setSsoNotice] = useState<string>();
  const [err, setErr] = useState<string>();

  const refresh = async () => {
    try {
      const u = await api.me();
      setUser(u);
      setView('app');
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  };

  // Inspect URL parameters for SSO callback tokens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('sso_token') || params.get('access_token');
    if (token) {
      tokenStore.set(token);
      window.history.replaceState({}, document.title, window.location.pathname);
      setSsoNotice('Institutional SSO Token verified. Authenticated successfully.');
      void refresh();
      return;
    }
    if (tokenStore.get()) {
      void refresh();
    }
  }, []);

  const goRole = async (role: Role) => {
    setErr(undefined);
    if (user?.role === role) return;
    const local = PORTALS.find((p) => p.role === role)!.local;
    const email = `${local}@${DOMAIN}`;
    if (!DEMO_PW) {
      setAuth({ email, want: role });
      return;
    }
    try {
      const res = await api.login(email, DEMO_PW);
      tokenStore.set(res.access_token);
      await refresh();
    } catch (e) {
      setErr(errMsg(e));
      setAuth({ email, want: role });
    }
  };

  const signOut = () => {
    tokenStore.clear();
    setUser(null);
    setView('landing');
    setSsoNotice(undefined);
  };

  const body = !user ? null : user.role === 'PATIENT' ? (
    <PatientView />
  ) : user.role === 'DOCTOR' ? (
    <DoctorView />
  ) : user.role === 'EMERGENCY_OPERATOR' ? (
    <EmergencyView />
  ) : user.role === 'AMBULANCE_TEAM' ? (
    <AmbulanceView />
  ) : (
    <AdminView />
  );

  return (
    <div className="min-h-screen bg-[#262624] text-[#faf9f5]">
      {view === 'landing' || !user ? (
        <Landing onExplore={(r) => void goRole(r)} onSignIn={() => setAuth({})} />
      ) : (
        <>
          {/* Authenticated Sticky Header Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#3e3e38] bg-[#262624]/95 backdrop-blur-md px-3 sm:px-8">
            <button
              onClick={() => setView('landing')}
              className="flex items-center gap-2.5 font-bold text-[#faf9f5] hover:text-[#d97757] transition"
            >
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#d97757] text-[#1a1915]">
                <Activity size={18} />
              </div>
              <span className="hidden font-extrabold sm:inline tracking-tight">FAME-GENIX 2.0</span>
            </button>

            {/* Portal Switcher Nav */}
            <nav aria-label="Portal Navigation" className="hidden gap-1.5 md:flex">
              {PORTALS.map((p) => (
                <button
                  key={p.role}
                  aria-current={user.role === p.role}
                  onClick={() => void goRole(p.role)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    user.role === p.role
                      ? 'bg-[#d97757] text-[#1a1915] shadow-sm'
                      : 'text-[#a9a99f] hover:text-[#faf9f5] hover:bg-[#2c2c2b]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </nav>

            {/* Mobile Portal Selector */}
            <select
              aria-label="Switch portal"
              className={`${fieldCls} w-auto text-xs md:hidden`}
              value={user.role}
              onChange={(e) => void goRole(e.target.value as Role)}
            >
              {PORTALS.map((p) => (
                <option key={p.role} value={p.role}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* User Session Pill & Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 rounded-xl bg-[#1b1b19] px-3 py-1.5 border border-[#3e3e38]">
                <span className="h-2 w-2 rounded-full bg-[#41d69a]" />
                <span className="font-mono text-xs text-[#faf9f5]">{user.email}</span>
                <span className="font-mono text-[10px] text-[#d97757] uppercase font-bold">
                  [{user.role}]
                </span>
              </div>
              <Btn tone="ghost" onClick={() => setSettingsOpen(true)} className="text-xs p-2 sm:px-3">
                <Settings size={14} />
                <span className="hidden sm:inline ml-1">Settings</span>
              </Btn>
              <Btn tone="ghost" onClick={signOut} className="text-xs">
                Sign out
              </Btn>
            </div>
          </header>

          <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-8 sm:py-8">
            {ssoNotice && (
              <div className="flex items-center gap-2 rounded-xl border border-[#41d69a] bg-[#41d69a]/10 p-3 text-xs text-[#41d69a]">
                <CheckCircle2 size={16} />
                <span>{ssoNotice}</span>
              </div>
            )}
            {err && <ErrorState message={err} />}
            {body ?? (
              <Card>
                <p className="text-center font-mono text-xs text-[#a9a99f]">Loading workstation portal…</p>
              </Card>
            )}
          </main>
        </>
      )}

      {auth && (
        <AuthModal
          presetEmail={auth.email}
          onClose={() => setAuth(null)}
          onDone={() => {
            setAuth(null);
            void refresh();
          }}
        />
      )}
      {settingsOpen && <PortalSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
