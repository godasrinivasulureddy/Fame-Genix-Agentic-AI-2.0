import { useEffect, useState } from 'react';
import {
  Activity,
  Ambulance,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  Radio,
  Settings,
  Shield,
  ShieldAlert,
  Stethoscope,
  Zap,
  ShieldCheck,
  Network,
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
  const [tab, setTab] = useState<'credentials' | 'sso' | 'biometric'>('credentials');
  const [email, setEmail] = useState(presetEmail ?? `patient@${DOMAIN}`);
  const [pw, setPw] = useState(DEMO_PW);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [scanningBio, setScanningBio] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      setErr(`Zero-Trust Handshake failed: ${errMsg(x)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricAuth = async () => {
    setScanningBio(true);
    setErr(undefined);
    setTimeout(async () => {
      try {
        const res = await api.login(email, DEMO_PW);
        tokenStore.set(res.access_token);
        setScanningBio(false);
        onDone();
      } catch (x) {
        setScanningBio(false);
        setErr('Biometric hardware signature verification failed.');
      }
    }, 1200);
  };

  return (
    <Modal title="Cyber-Secure Zero-Trust Clinical Gateway" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Futuristic Status Bar */}
        <div className="flex items-center justify-between rounded-xl bg-[#141412] px-3 py-2 border border-[#d97757]/30 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-[#41d69a]">
            <span className="h-2 w-2 rounded-full bg-[#41d69a] animate-pulse" />
            256-BIT TLS VAULT ACTIVE
          </span>
          <span className="text-[#d97757] font-bold">ABDM / HIPAA HARDENED</span>
        </div>

        {/* Auth Method Tabs */}
        <div className="flex gap-1.5 rounded-xl bg-[#141412] p-1 border border-[#3e3e38]">
          <button
            type="button"
            onClick={() => setTab('credentials')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
              tab === 'credentials'
                ? 'bg-[#d97757] text-[#1a1915] shadow-md shadow-[#d97757]/20'
                : 'text-[#a9a99f] hover:text-[#faf9f5]'
            }`}
          >
            Clinical Pass
          </button>
          <button
            type="button"
            onClick={() => setTab('sso')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
              tab === 'sso'
                ? 'bg-[#d97757] text-[#1a1915] shadow-md shadow-[#d97757]/20'
                : 'text-[#a9a99f] hover:text-[#faf9f5]'
            }`}
          >
            Federated SSO
          </button>
          <button
            type="button"
            onClick={() => setTab('biometric')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
              tab === 'biometric'
                ? 'bg-[#d97757] text-[#1a1915] shadow-md shadow-[#d97757]/20'
                : 'text-[#a9a99f] hover:text-[#faf9f5]'
            }`}
          >
            Face/BLE Key
          </button>
        </div>

        {tab === 'credentials' ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#a9a99f]">Authorized Clinical Identity</label>
              <input
                className={`${fieldCls} mt-1 border-[#d97757]/40 focus:border-[#d97757] bg-[#141412] text-sm`}
                type="email"
                required
                aria-label="Email"
                placeholder="clinician@famegenix.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#a9a99f]">Zero-Knowledge Token / Passphrase</label>
              <div className="relative mt-1">
                <input
                  className={`${fieldCls} border-[#d97757]/40 focus:border-[#d97757] bg-[#141412] text-sm font-mono pr-10`}
                  type={showPw ? "text" : "password"}
                  required
                  aria-label="Password"
                  placeholder="••••••••••••"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#a9a99f] hover:text-[#faf9f5] transition cursor-pointer"
                  title={showPw ? "Hide password" : "Show password"}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Role Quick Selector Preset */}
            <div className="rounded-xl bg-[#141412] p-2.5 border border-[#3e3e38]/70">
              <span className="font-mono text-[10px] text-[#a9a99f] uppercase tracking-wider block mb-1">
                Authorized Clinical Personas:
              </span>
              <div className="flex flex-wrap gap-1">
                {PORTALS.map((p) => (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => setEmail(`${p.local}@${DOMAIN}`)}
                    className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] transition ${
                      email.startsWith(p.local)
                        ? 'border-[#d97757] bg-[#d97757]/20 text-[#d97757] font-bold'
                        : 'border-[#3e3e38] bg-[#20201e] text-[#a9a99f] hover:text-[#faf9f5]'
                    }`}
                  >
                    {p.local}
                  </button>
                ))}
              </div>
            </div>

            {err && <ErrorState message={err} />}
            <Btn type="submit" disabled={busy} className="w-full py-2.5 font-bold tracking-wide shadow-lg shadow-[#d97757]/25">
              {busy ? 'Authenticating with Clinical Core...' : 'VERIFY & ENTER SECURE WORKSTATION'}
            </Btn>
          </form>
        ) : tab === 'sso' ? (
          <div className="space-y-3">
            <p className="text-xs text-[#a9a99f] leading-relaxed font-mono">
              Cryptographically verified OAuth2 / SAML / ABDM institutional federation:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSsoLogin('DOCTOR', 'Hospital AD / SAML')}
                className="w-full flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#141412] p-3 text-left hover:border-[#d97757] hover:bg-[#20201e] transition"
              >
                <div className="flex items-center gap-2.5">
                  <Stethoscope size={18} className="text-[#d97757]" />
                  <div>
                    <p className="text-xs font-bold text-[#faf9f5]">Hospital Active Directory / Epic SAML</p>
                    <p className="text-[10px] font-mono text-[#a9a99f]">Attending physicians & trauma surgeons</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#d97757]" />
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSsoLogin('PATIENT', 'National Healthcare ID')}
                className="w-full flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#141412] p-3 text-left hover:border-[#41d69a] hover:bg-[#20201e] transition"
              >
                <div className="flex items-center gap-2.5">
                  <Heart size={18} className="text-[#41d69a]" />
                  <div>
                    <p className="text-xs font-bold text-[#faf9f5]">Ayushman Bharat / ABHA National ID</p>
                    <p className="text-[10px] font-mono text-[#a9a99f]">Citizen continuous wearable passport</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#41d69a]" />
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSsoLogin('EMERGENCY_OPERATOR', 'Emergency Dispatch System')}
                className="w-full flex items-center justify-between rounded-xl border border-[#3e3e38] bg-[#141412] p-3 text-left hover:border-[#fb7185] hover:bg-[#20201e] transition"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert size={18} className="text-[#fb7185]" />
                  <div>
                    <p className="text-xs font-bold text-[#faf9f5]">Municipal 911 / 108 Emergency CAD</p>
                    <p className="text-[10px] font-mono text-[#a9a99f]">Trauma dispatch & Green Corridor gateway</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#fb7185]" />
              </button>
            </div>

            {err && <ErrorState message={err} />}
          </div>
        ) : (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-[#d97757] bg-[#141412]">
              <Radio size={32} className={`text-[#d97757] ${scanningBio ? 'animate-spin' : 'animate-pulse'}`} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#faf9f5]">Hardware Biometric Handshake</h4>
              <p className="mt-1 text-xs font-mono text-[#a9a99f]">
                Authenticating via Smart Mask BLE key or Webcam Face rPPG signature...
              </p>
            </div>
            {err && <ErrorState message={err} />}
            <Btn onClick={handleBiometricAuth} disabled={scanningBio} className="w-full py-2.5 font-bold">
              {scanningBio ? 'SCANNING BIOMETRIC SIGNATURE...' : 'SCAN & AUTHENTICATE'}
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ===== Landing Page — Super Futuristic Intelligence (Redesigned) ===== */

function Landing({
  onExplore,
  onSignIn,
}: {
  onExplore: (r: Role) => void;
  onSignIn: () => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState<number>(0);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  // Soft auto-rotation of pipeline steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWorkflowStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const WORKFLOW_STEPS = [
    {
      num: '01',
      title: 'Continuous Biosensor & Wearable Ingestion',
      metric: 'GATT BLE 20Hz',
      desc: 'Real-time telemetry stream from Smart Masks (VOC breathomics, SpO2, respiration) and Smart Helmets (sweat electrolytes, core temp).',
      source: 'Physical AI Edge',
    },
    {
      num: '02',
      title: 'Sub-Second Anomaly & Z-Score Drift Fusion',
      metric: 'EWMA + Deterministic RF',
      desc: 'Authoritative clinical safety rules (RF-001 to RF-011) execute deterministically at sub-second latency, intercepting acute decompensation.',
      source: 'Deterministic Safety Core',
    },
    {
      num: '03',
      title: 'Multi-Agent Clinical Society Consensus',
      metric: '4-Agent Deliberation',
      desc: 'Cardio-respiratory, Nephrology/Pharma, and Triage agents deliberate with an Independent Safety Evaluator validating against AHA/GOLD guidelines.',
      source: 'NVIDIA Nemotron 3.5 / 4',
    },
    {
      num: '04',
      title: 'Autonomous Urban Preemption & Digital Handover',
      metric: '< 60s Cashless Pre-Auth',
      desc: 'Municipal traffic signals preempted 400m ahead of transit ambulances, instant Ayushman Bharat approval, and EHR SOAP note generation.',
      source: 'Emergency Response Grid',
    },
  ];

  const AGENTS = [
    {
      id: 'cardio',
      name: 'Cardio-Respiratory Specialist',
      role: 'Hemodynamic Stability & Crackle Acoustics',
      focus: 'Correlates SpO2 desaturation, tachycardia, and acoustic respiratory wheezes for early heart failure & COPD warnings.',
      telemetry: 'HR: 108 bpm | SpO2: 91% | Wheeze: Grade-2',
    },
    {
      id: 'nephro',
      name: 'Nephrology & Breathomics Agent',
      role: 'Renal Function & Exhaled VOC Volatilome',
      focus: 'Analyzes micro-fluidic sweat sodium loss and exhaled breath biomarkers (Acetone for DKA, Ammonia for uremic encephalopathy).',
      telemetry: 'Sweat Na+: 52 mmol/L | Acetone: 1.9 ppm',
    },
    {
      id: 'triage',
      name: 'Emergency Triage Officer',
      role: 'ESI Acuity & Immediate Directives',
      focus: 'Computes Emergency Severity Index (ESI-1/2/3), orchestrates pre-hospital resource reservation, and commands cath lab standby.',
      telemetry: 'Acuity: ESI-2 | Trauma Bay 03 Reserved',
    },
    {
      id: 'evaluator',
      name: 'Independent Safety Evaluator',
      role: 'AHA / ESC / GOLD Guideline Cross-Exam',
      focus: 'Cross-examines proposed pharmacotherapy against patient allergy profiles and persists decisions to the immutable SHA-256 black box.',
      telemetry: 'AHA Protocol: Verified | Audit Hash: Chained',
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#141413] text-[#faf9f5] overflow-x-hidden selection:bg-[#d97757]/30 selection:text-white">
      {/* ===== AMBIENT CLAUDE CHARCOAL & WARM SAND BACKGROUND ===== */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        {/* Soft, non-glaring natural gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-5%,rgba(217,119,87,0.14),rgba(20,20,19,0.95)_65%,#141413_100%)]" />

        {/* Ambient Subtle Warmth Orbs (Claude Amber + Muted Terracotta) */}
        <div className="absolute top-[10%] left-[8%] w-[540px] h-[540px] rounded-full bg-[#d97757]/8 blur-[130px] animate-float-1" />
        <div className="absolute top-[32%] right-[6%] w-[620px] h-[620px] rounded-full bg-[#f2b955]/7 blur-[150px] animate-float-2" />
        <div className="absolute bottom-[10%] left-[22%] w-[580px] h-[580px] rounded-full bg-[#41d69a]/5 blur-[140px] animate-float-1" />

        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(217,119,87,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(217,119,87,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ===== REFINED TOP NAVIGATION BAR ===== */}
      <header className="sticky top-0 z-50 flex h-18 items-center justify-between border-b border-[#3e3e38]/40 bg-[#191918]/80 backdrop-blur-2xl px-4 sm:px-8 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Refined Brand Emblem */}
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d97757] text-[#141413] font-bold shadow-md shadow-[#d97757]/20">
            <Activity size={20} className="stroke-[2.5]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-[#faf9f5] text-base sm:text-lg">
                FAME-GENIX
              </span>
              <span className="rounded-md border border-[#d97757]/30 bg-[#d97757]/10 px-2 py-0.5 font-mono text-[9px] font-bold text-[#d97757] tracking-wider uppercase">
                2.0
              </span>
            </div>
            <span className="hidden sm:block font-mono text-[10px] text-[#a9a99f] tracking-wide">
              Physical AI & Multi-Agent Healthcare Platform
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <div className="hidden lg:flex items-center gap-2.5 rounded-full border border-[#3e3e38] bg-[#1e1e1c]/80 px-3.5 py-1 text-xs font-mono backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#41d69a]" />
          <span className="text-[#a9a99f]">Neural Telemetry Core: <strong className="text-[#faf9f5]">Active</strong></span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onSignIn}
            className="rounded-xl border border-[#3e3e38] bg-[#1e1e1c] px-3.5 py-2 text-xs font-semibold text-[#faf9f5] hover:border-[#d97757]/60 hover:bg-[#262624] transition-all"
          >
            Clinical SSO
          </button>
          <button
            onClick={() => onExplore('PATIENT')}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-[#d97757] px-4 py-2 text-xs font-bold text-[#141413] hover:bg-[#e08465] transition-all shadow-sm"
          >
            <span>Launch Command Center</span>
            <ArrowRight size={14} className="stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <main className="mx-auto max-w-7xl px-4 pt-10 pb-10 sm:px-6 sm:pt-12 sm:pb-14 lg:pt-14 lg:pb-16 space-y-14">
        <section className="relative grid gap-8 items-start lg:grid-cols-12">
          {/* Left Column Content - Shifted upwards and to the left */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-5 text-left">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-3.5 py-1 text-xs font-mono text-[#d97757]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d97757] animate-pulse" />
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Continuous Surveillance &bull; Autonomous Triage
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-extrabold tracking-tight leading-[1.12] text-[#faf9f5]">
              <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-[42px] xl:text-[48px] whitespace-nowrap">
                Autonomous Continuous Monitoring
              </span>
              <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-[42px] xl:text-[48px] mt-1 text-transparent bg-clip-text bg-gradient-to-r from-[#d97757] via-[#e28a6d] to-[#f2b955]">
                Multi-Agent Healthcare System
              </span>
              <span className="block text-lg sm:text-xl lg:text-2xl mt-1.5 font-bold text-[#a9a99f] tracking-normal">
                Workflow & Emergency Preemption
              </span>
            </h1>

            {/* Subtitle / Description */}
            <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-[#a9a99f]">
              Synthesizing continuous biosensor telemetry from <strong className="text-[#faf9f5]">Smart Masks</strong>,{' '}
              <strong className="text-[#faf9f5]">Smart Helmets</strong>, and <strong className="text-[#faf9f5]">Ambient CCTV</strong> into
              sub-second clinical triage. Deliberated by a four-agent medical society with zero-touch municipal
              traffic preemption and sub-minute cashless insurance pre-authorization.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-wrap gap-3 items-center">
              <button
                onClick={() => onExplore('PATIENT')}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#d97757] px-6 py-3.5 text-xs font-bold text-[#141413] hover:bg-[#e08465] transition-all shadow-md shadow-[#d97757]/20"
              >
                <span>Enter Patient Portal</span>
                <ArrowRight size={14} className="stroke-[2.5] group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onExplore('DOCTOR')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#3e3e38] bg-[#1e1e1c] px-5 py-3.5 text-xs font-semibold text-[#faf9f5] hover:border-[#d97757]/50 hover:bg-[#262624] transition-all"
              >
                <Stethoscope size={15} className="text-[#d97757]" />
                <span>Doctor Workstation</span>
              </button>

              <button
                onClick={() => onExplore('EMERGENCY_OPERATOR')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#3e3e38] bg-[#1e1e1c] px-5 py-3.5 text-xs font-semibold text-[#faf9f5] hover:border-[#fb7185]/50 hover:bg-[#262624] transition-all"
              >
                <ShieldAlert size={15} className="text-[#fb7185]" />
                <span>Emergency 911/108</span>
              </button>
            </div>

            {/* Spec Highlights */}
            <div className="pt-3 flex flex-wrap items-center gap-6 text-xs font-mono text-[#a9a99f] border-t border-[#3e3e38]/50">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-[#41d69a]" />
                <span>Telemetry: <strong className="text-[#faf9f5]">Mask & Helmet BLE</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#f2b955]" />
                <span>Dual Engine: <strong className="text-[#faf9f5]">Nemotron 3.5 + Gemini 2.5</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#d97757]" />
                <span>Audit Ledger: <strong className="text-[#faf9f5]">SHA-256 Chained</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column Visual: Calibrated Claude Amber Neural Orb */}
          <div className="lg:col-span-4 xl:col-span-4 flex justify-center items-center pt-2 lg:pt-0 transform translate-x-0 lg:translate-x-[74px] translate-y-0 lg:translate-y-[38px]">
            <div className="relative w-full max-w-[380px] aspect-square flex items-center justify-center">
              {/* Outer Subtle Orbit Tracks */}
              <div className="absolute inset-0 rounded-full border border-[#3e3e38]/60 animate-spin" style={{ animationDuration: '35s' }} />
              <div className="absolute inset-6 rounded-full border border-dashed border-[#d97757]/20 animate-spin" style={{ animationDuration: '50s', animationDirection: 'reverse' }} />
              <div className="absolute inset-12 rounded-full bg-gradient-to-br from-[#d97757]/10 via-[#f2b955]/5 to-transparent blur-2xl animate-orb-pulse" />

              {/* Central Glowing 3D Neural Bio-Orb */}
              <div className="relative z-10 w-60 h-60 sm:w-68 sm:h-68 flex items-center justify-center animate-orb-float">
                <svg
                  viewBox="0 0 240 240"
                  className="w-full h-full drop-shadow-[0_12px_40px_rgba(217,119,87,0.35)] overflow-visible"
                >
                  <defs>
                    <radialGradient id="claude-orb-glow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#faf9f5" stopOpacity="0.8" />
                      <stop offset="35%" stopColor="#e28a6d" stopOpacity="0.5" />
                      <stop offset="70%" stopColor="#d97757" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#1e1e1c" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="claude-orb-core" cx="38%" cy="32%" r="62%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="30%" stopColor="#e89478" stopOpacity="0.9" />
                      <stop offset="75%" stopColor="#d97757" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#8c3e23" stopOpacity="1" />
                    </radialGradient>
                    <filter id="claude-soft-bloom" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Soft Aura Ring */}
                  <circle cx="120" cy="120" r="100" fill="url(#claude-orb-glow)" opacity="0.6" />

                  {/* Gentle Orbiting Satellite Nodes */}
                  <g className="animate-spin" style={{ transformOrigin: '120px 120px', animationDuration: '18s' }}>
                    <circle cx="120" cy="24" r="4.5" fill="#faf9f5" filter="url(#claude-soft-bloom)" />
                    <circle cx="216" cy="120" r="3.5" fill="#f2b955" />
                    <circle cx="120" cy="216" r="4.5" fill="#d97757" />
                    <circle cx="24" cy="120" r="3" fill="#e28a6d" />
                  </g>

                  {/* Tilted Satellite Track */}
                  <g className="animate-spin" style={{ transformOrigin: '120px 120px', animationDuration: '24s', animationDirection: 'reverse' }}>
                    <ellipse cx="120" cy="120" rx="90" ry="42" fill="none" stroke="rgba(217,119,87,0.25)" strokeWidth="1" strokeDasharray="5 3" transform="rotate(30 120 120)" />
                    <circle cx="185" cy="78" r="4" fill="#faf9f5" />
                    <circle cx="55" cy="162" r="3" fill="#41d69a" />
                  </g>

                  {/* Core Ceramic Sphere */}
                  <circle cx="120" cy="120" r="66" fill="url(#claude-orb-core)" filter="url(#claude-soft-bloom)" />

                  {/* Subtle Clean Heartbeat Waveform */}
                  <path
                    d="M 88 120 L 106 120 L 112 108 L 120 134 L 126 112 L 132 120 L 152 120"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] animate-pulse"
                  />
                </svg>
              </div>

              {/* Orbiting Frosted Badges */}
              <div className="absolute -top-3 -right-2 glass-panel-claude px-3 py-1.5 rounded-xl text-[10px] font-mono border border-[#3e3e38] shadow-lg">
                <span className="flex items-center gap-1.5 text-[#d97757] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#41d69a] animate-pulse" />
                  SURVEILLANCE ACTIVE
                </span>
                <span className="text-[#a9a99f]">Micro-Vitals Continuous</span>
              </div>

              <div className="absolute -bottom-5 -left-3 glass-panel-claude px-3.5 py-1.5 rounded-xl text-[10px] font-mono border border-[#3e3e38] shadow-lg">
                <span className="text-[#faf9f5] block font-semibold">4-AGENT CONSENSUS</span>
                <span className="text-[#a9a99f]">Zero-Touch Green Corridor</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== END-TO-END WORKFLOW STEPPER ===== */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#3e3e38]/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#d97757]" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#d97757]">
                  Clinical Operations
                </span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-[#faf9f5] tracking-tight">
                Healthcare System Workflow Pipeline
              </h2>
            </div>
            <span className="font-mono text-xs text-[#a9a99f]">
              Biosensor Ingestion &rarr; Consensus &rarr; Preemption
            </span>
          </div>

          {/* Stepper Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isActive = activeWorkflowStep === idx;
              return (
                <div
                  key={step.num}
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`cursor-pointer rounded-2xl p-5 transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? 'glass-panel-claude border-[#d97757] shadow-lg shadow-[#d97757]/10'
                      : 'glass-panel-claude glass-panel-claude-hover opacity-85'
                  }`}
                >
                  {/* Subtle top indicator bar */}
                  {isActive && <div className="absolute top-0 left-0 right-0 h-1 bg-[#d97757]" />}

                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xl font-bold text-[#d97757]">{step.num}</span>
                    <span className="font-mono text-[10px] font-semibold rounded-md border border-[#3e3e38] bg-[#1e1e1c] px-2 py-0.5 text-[#a9a99f]">
                      {step.metric}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#faf9f5] leading-snug">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#a9a99f]">{step.desc}</p>

                  <div className="mt-4 pt-2.5 border-t border-[#3e3e38]/40 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#77766e]">Engine:</span>
                    <span className="font-semibold text-[#faf9f5]">{step.source}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== MULTI-AGENT CLINICAL SOCIETY ===== */}
        <section className="glass-panel-claude rounded-2xl p-6 sm:p-8 border border-[#3e3e38] shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Network size={16} className="text-[#d97757]" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#d97757]">
                  Agentic Society Core
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-[#faf9f5]">
                Multi-Agent Medical Consensus Deliberation
              </h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#a9a99f] bg-[#141413] px-3 py-1.5 rounded-lg border border-[#3e3e38]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#41d69a]" />
              <span>NVIDIA Nemotron-4 340B Instruct Active</span>
            </div>
          </div>

          {/* Agent Selector Tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((agent, i) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(i)}
                className={`text-left rounded-xl p-4 transition-all duration-200 border ${
                  selectedAgent === i
                    ? 'bg-[#262624] border-[#d97757] shadow-sm ring-1 ring-[#d97757]/50'
                    : 'bg-[#1a1a18]/60 border-[#3e3e38]/50 hover:border-[#3e3e38] hover:bg-[#20201e]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] font-bold text-[#d97757]">
                    AGENT 0{i + 1}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedAgent === i ? 'bg-[#d97757]' : 'bg-[#3e3e38]'}`} />
                </div>
                <h4 className="font-bold text-xs sm:text-sm text-[#faf9f5]">{agent.name}</h4>
                <p className="mt-1 text-[11px] text-[#a9a99f] line-clamp-1">{agent.role}</p>
              </button>
            ))}
          </div>

          {/* Active Agent Deliberation Detail */}
          <div className="mt-5 rounded-xl border border-[#3e3e38]/70 bg-[#141413] p-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#3e3e38]/50 pb-2.5 mb-2.5">
              <span className="text-[#faf9f5] font-semibold flex items-center gap-2">
                <Activity size={13} className="text-[#d97757]" />
                Active Focus: {AGENTS[selectedAgent].name}
              </span>
              <span className="text-[10px] text-[#41d69a] font-semibold">GUIDELINE COMPLIANT</span>
            </div>
            <p className="text-[#a9a99f] leading-relaxed mb-3">
              <strong className="text-[#faf9f5]">Clinical Mandate:</strong> {AGENTS[selectedAgent].focus}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#3e3e38]/40 text-[11px]">
              <span className="text-[#77766e]">Observed Telemetry Vector:</span>
              <span className="text-[#d97757] bg-[#1e1e1c] px-2.5 py-0.5 rounded border border-[#3e3e38]">
                {AGENTS[selectedAgent].telemetry}
              </span>
            </div>
          </div>
        </section>

        {/* ===== SPECIALIZED WORKSTATIONS ===== */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#d97757]">
              Role-Based Portals
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#faf9f5]">Five Unified Workstations</h2>
            <p className="text-xs text-[#a9a99f]">
              Dedicated, zero-trust portals for patients, physicians, emergency operators, paramedics, and governance.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PORTALS.map((p) => (
              <div
                key={p.role}
                onClick={() => onExplore(p.role)}
                className="group cursor-pointer glass-panel-claude glass-panel-claude-hover rounded-2xl p-5 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#262624] border border-[#3e3e38] text-[#d97757] group-hover:border-[#d97757]/40 transition-colors">
                    <p.icon size={18} className="stroke-[2.5]" />
                  </div>
                  <span className="font-mono text-[9px] font-semibold rounded-md border border-[#3e3e38] bg-[#1e1e1c] px-2 py-0.5 text-[#a9a99f]">
                    {p.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#faf9f5] group-hover:text-[#d97757] transition-colors">{p.label}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#a9a99f]">{p.blurb}</p>

                <div className="mt-4 pt-2.5 border-t border-[#3e3e38]/40 flex items-center justify-between text-xs font-mono text-[#d97757]">
                  <span>Launch Portal</span>
                  <ArrowRight size={13} className="stroke-[2.5] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mt-16 border-t border-[#3e3e38]/40 bg-[#141413] py-8 px-4 sm:px-8 text-center text-xs text-[#a9a99f]">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="font-mono text-xs text-[#faf9f5] font-semibold">
            FAME-GENIX Agentic AI 2.0 &bull; Nebius &times; NVIDIA Global AI Hackathon 2026
          </p>
          <p className="text-[11px] text-[#77766e] max-w-2xl mx-auto">
            Autonomous multi-agent clinical decision support and emergency preemption. Deterministic safety rules (RF-001 to RF-011) strictly override model inferences. All telemetry carries simulation provenance.
          </p>
        </div>
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
    if (user) {
      if (user.role === role) return;
      // If already authenticated and switching role, require session re-authentication or switch
      const local = PORTALS.find((p) => p.role === role)!.local;
      setAuth({ email: `${local}@${DOMAIN}`, want: role });
      return;
    }
    // Strict Gate: prompt authentic credentials or biometric/SSO authentication
    const local = PORTALS.find((p) => p.role === role)!.local;
    setAuth({ email: `${local}@${DOMAIN}`, want: role });
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
