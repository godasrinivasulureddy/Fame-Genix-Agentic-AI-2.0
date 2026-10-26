import { useEffect, useState } from 'react';
import { Activity, Ambulance, Heart, ShieldAlert, Stethoscope } from 'lucide-react';
import { api, errMsg, tokenStore } from './api';
import type { Role, SessionUser } from './types';
import PatientView from './patient';
import { AdminView, AmbulanceView, DoctorView, EmergencyView } from './staff';
import { Btn, Card, ErrorState, Modal, Overline, fieldCls } from './shared';

const PORTALS: Array<{ role: Role; label: string; blurb: string; local: string; icon: typeof Heart }> = [
  { role: 'PATIENT', label: 'Patient', local: 'patient', icon: Heart, blurb: 'Symptoms, vitals, risk deck, AI explanation, evidence' },
  { role: 'DOCTOR', label: 'Doctor', local: 'doctor', icon: Stethoscope, blurb: 'Triage and consultation queues, decision logger' },
  { role: 'EMERGENCY_OPERATOR', label: 'Emergency Operator', local: 'emergency', icon: ShieldAlert, blurb: 'Incident board and 10-stage state machine' },
  { role: 'AMBULANCE_TEAM', label: 'Ambulance', local: 'ambulance', icon: Ambulance, blurb: 'Transit stepper and pre-arrival brief' },
  { role: 'SYSTEM_ADMIN', label: 'Admin', local: 'admin', icon: Activity, blurb: 'Model metrics, safety rules, audit log' },
];
const DOMAIN: string = import.meta.env.VITE_DEMO_DOMAIN ?? 'famegenix.org';
const DEMO_PW: string = import.meta.env.VITE_DEMO_PASSWORD ?? '';

function AuthModal({ onDone, onClose, presetEmail }: { onDone: () => void; onClose: () => void; presetEmail?: string }) {
  const [email, setEmail] = useState(presetEmail ?? ''); const [pw, setPw] = useState(''); const [err, setErr] = useState<string>(); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(undefined);
    try { tokenStore.set((await api.login(email, pw)).access_token); onDone(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Sign in" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <input className={fieldCls} type="email" required aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={fieldCls} type="password" required aria-label="Password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <ErrorState message={err} />}
        <Btn type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
    </Modal>
  );
}

function Landing({ onExplore, onSignIn }: { onExplore: (r: Role) => void; onSignIn: () => void }) {
  return (
    <div>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 sm:px-8">
        <span className="flex items-center gap-2 font-bold text-white"><Activity className="text-cyan-400" size={20} />FAME-GENIX 2.0</span>
        <Btn tone="ghost" onClick={onSignIn}>Sign In</Btn>
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-8 sm:py-16">
        <section>
          <Overline>Continuous telemetry • Deterministic risk rules • RAG evidence</Overline>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">Algorithmic Triage, Vitals Drift Detection, and Emergency Handover</h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">Multimodal inputs are scored by the FAME-GENIX backend; deterministic safety rules (RF-001 to RF-007) outrank the AI model, and every escalation ends in a structured handover passport.</p>
          <div className="mt-6 flex flex-wrap gap-2">{PORTALS.slice(0, 4).map((p) => <Btn key={p.role} onClick={() => onExplore(p.role)}>Explore as {p.label}</Btn>)}</div>
        </section>
        <section><Overline>Pipeline</Overline>
          <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">{['Understand', 'Observe', 'Compare', 'Detect', 'Explain', 'Escalate'].map((s, i) => (
            <li key={s} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center"><span className="font-mono text-[10px] text-cyan-400">0{i + 1}</span><p className="text-sm font-bold text-white">{s}</p></li>))}</ol></section>
        <section><Overline>Role Portals</Overline>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PORTALS.map((p) => (
            <button key={p.role} onClick={() => onExplore(p.role)} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left shadow-lg shadow-black/40 hover:border-cyan-500/30">
              <p.icon size={20} className="text-cyan-400" /><h3 className="mt-2 text-base font-bold text-white">{p.label}</h3><p className="text-xs text-slate-400">{p.blurb}</p></button>))}</div></section>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [auth, setAuth] = useState<{ email?: string; want?: Role } | null>(null);
  const [err, setErr] = useState<string>();

  const refresh = async () => { try { setUser(await api.me()); setView('app'); } catch { tokenStore.clear(); setUser(null); } };
  useEffect(() => { if (tokenStore.get()) void refresh(); }, []);

  const goRole = async (role: Role) => {
    setErr(undefined);
    if (user?.role === role) return;
    const local = PORTALS.find((p) => p.role === role)!.local; const email = `${local}@${DOMAIN}`;
    if (!DEMO_PW) { setAuth({ email, want: role }); return; }
    try { tokenStore.set((await api.login(email, DEMO_PW)).access_token); await refresh(); } catch (e) { setErr(errMsg(e)); setAuth({ email, want: role }); }
  };
  const signOut = () => { tokenStore.clear(); setUser(null); setView('landing'); };

  const body = !user ? null : user.role === 'PATIENT' ? <PatientView /> : user.role === 'DOCTOR' ? <DoctorView />
    : user.role === 'EMERGENCY_OPERATOR' ? <EmergencyView /> : user.role === 'AMBULANCE_TEAM' ? <AmbulanceView /> : <AdminView />;

  return (
    <div className="min-h-screen">
      {view === 'landing' || !user ? <Landing onExplore={(r) => void goRole(r)} onSignIn={() => setAuth({})} /> : (<>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-3 sm:px-8">
          <button onClick={() => setView('landing')} className="flex items-center gap-2 font-bold text-white"><Activity className="text-cyan-400" size={20} /><span className="hidden sm:inline">FAME-GENIX 2.0</span></button>
          <nav aria-label="Portals" className="hidden gap-1 md:flex">{PORTALS.map((p) => (
            <button key={p.role} aria-current={user.role === p.role} onClick={() => void goRole(p.role)}
              className={`rounded-xl px-3 text-xs font-bold ${user.role === p.role ? 'bg-cyan-950/50 text-cyan-300' : 'text-slate-400 hover:text-white'}`}>{p.label}</button>))}</nav>
          <select aria-label="Switch portal" className={fieldCls + ' w-auto md:hidden'} value={user.role} onChange={(e) => void goRole(e.target.value as Role)}>{PORTALS.map((p) => <option key={p.role} value={p.role}>{p.label}</option>)}</select>
          <Btn tone="ghost" onClick={signOut}>Sign out</Btn>
        </header>
        <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-8 sm:py-8">
          {err && <ErrorState message={err} />}
          <p className="font-mono text-[11px] text-slate-500">{user.email} · {user.role}</p>
          {body ?? <Card><p>Loading…</p></Card>}
        </main></>)}
      {auth && <AuthModal presetEmail={auth.email} onClose={() => setAuth(null)} onDone={() => { setAuth(null); void refresh(); }} />}
    </div>
  );
}
