import { useState, useEffect } from 'react';
import { Activity, Stethoscope, ShieldAlert, Ambulance, Heart } from 'lucide-react';
import { api, errMsg, tokenStore } from './api';
import type { Role, SessionUser } from './types';
import PatientView from './patient';
import { AdminView, AmbulanceView, DoctorView, EmergencyView } from './staff';
import { Btn, Card, ErrorState, Modal, fieldCls } from './shared';

const PORTALS: Array<{ role: Role; label: string; blurb: string; local: string; icon: typeof Heart }> = [
  { role: 'PATIENT', label: 'Patient', local: 'patient', icon: Heart, blurb: 'Symptoms, vitals, risk deck, AI explanation, evidence' },
  { role: 'DOCTOR', label: 'Doctor', local: 'doctor', icon: Stethoscope, blurb: 'Triage and consultation queues, decision logger' },
  { role: 'EMERGENCY_OPERATOR', label: 'Emergency Operator', local: 'emergency', icon: ShieldAlert, blurb: 'Incident board and 10-stage state machine' },
  { role: 'AMBULANCE_TEAM', label: 'Ambulance', local: 'ambulance', icon: Ambulance, blurb: 'Transit stepper and pre-arrival brief' },
  { role: 'SYSTEM_ADMIN', label: 'Admin', local: 'admin', icon: Activity, blurb: 'Model metrics, safety rules, audit log' },
];
const DOMAIN: string = import.meta.env.VITE_DEMO_DOMAIN ?? 'famegenix.org';
const DEMO_PW: string = import.meta.env.VITE_DEMO_PASSWORD ?? '';
const NAV_LINKS = ['Home', 'About Us', 'Our Services', 'Doctors', 'Health Packages', 'Pages', 'Blog', 'Contact'];

const DoctorIllustration = () => (
  <svg width="420" height="520" viewBox="0 0 420 520" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm shadow-[#000000]/15">
    <path d="M340 40 Q420 120 420 420 L340 400 Q320 220 340 40 Z" fill="#00b39e" />
    <circle cx="360" cy="260" r="120" fill="white" />
    <path d="M260 260 Q240 300 260 340 Q280 380 320 340 Q360 300 380 260" fill="#eefbf9" />
    <path d="M208 150 Q208 170 250 170 Q292 170 292 150" fill="#3e2a23" />
    <circle cx="250" cy="150" r="42" fill="#f5e6d3" />
    <path d="M208 108 Q208 90 250 90 Q292 90 292 108" fill="#3e2a23" />
    <circle cx="230" cy="142" r="5" fill="#5a3e36" /><circle cx="270" cy="142" r="5" fill="#5a3e36" />
    <path d="M230 160 Q250 168 270 160" stroke="#5a3e36" strokeWidth="3" strokeLinecap="round" />
    <path d="M190 200 Q150 240 150 360 Q160 460 190 480 Q230 500 270 480 Q280 460 290 360 Q290 240 250 200 Z" fill="white" />
    <path d="M190 220 Q180 260 210 300 Q220 320 210 340 Q200 360 190 380" fill="#eefbf9" />
    <path d="M250 220 Q260 260 230 300 Q220 320 230 340 Q240 360 250 380" fill="#eefbf9" />
    <path d="M230 210 Q210 210 200 230 Q190 260 190 300 Q190 340 210 380 Q230 420 270 400 Q310 380 330 340 Q350 300 350 260 Q350 220 330 210" stroke="#1f2937" strokeWidth="5" fill="none" />
    <circle cx="250" cy="225" r="14" fill="#4b5563" /><circle cx="250" cy="225" r="8" fill="#111827" />
    <path d="M235 260 Q250 280 265 260 Q250 240 235 260 Z" fill="#0a7b6c" />
    <path d="M170 360 Q150 380 150 410 Q150 440 170 460 Q190 480 210 460 M330 360 Q350 380 350 410 Q350 440 330 460 Q310 480 290 460" stroke="#d1d5db" strokeWidth="10" strokeLinecap="round" fill="none" />
  </svg>
);

function AuthModal({ onDone, onClose, presetEmail }: { onDone: () => void; onClose: () => void; presetEmail?: string }) {
  const [email, setEmail] = useState(presetEmail ?? ''); const [pw, setPw] = useState(''); const [err, setErr] = useState<string>(); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(undefined); try { tokenStore.set((await api.login(email, pw)).access_token); onDone(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };
  return <Modal title="Sign in" onClose={onClose}><form onSubmit={(e) => void submit(e)} className="space-y-3"><label className="block text-xs font-medium text-[#6a8a94]">Email</label><input className="clinic-input" type="email" required aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><label className="block text-xs font-medium text-[#6a8a94]">Password</label><input className="clinic-input" type="password" required aria-label="Password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />{err && <ErrorState message={err} />}<Btn tone="cyan" type="submit" disabled={busy} className="w-full clinic-btn-primary">{busy ? 'Signing in…' : 'Sign in'}</Btn></form></Modal>;
}

function Landing({ onExplore, onSignIn }: { onExplore: (r: Role) => void; onSignIn: () => void }) {
  const services = [{ title: 'Cardiology', desc: 'Comprehensive heart care with advanced diagnostics and treatment.', icon: Activity }, { title: 'General Medicine', desc: 'Expert care for everyday health concerns and conditions.', icon: Stethoscope }, { title: 'Dental Care', desc: 'Complete dental solutions for a healthy, confident smile.', icon: Heart }, { title: "Women's Health", desc: 'Compassionate care for women at every stage of life.', icon: ShieldAlert }];
  return (
    <div className="bg-[#fbfcfe] text-[#0f2c38]">
      <header className="sticky top-0 z-30 h-16 border-b border-[#21262D] bg-white px-4 sm:px-8">
        <div className="flex h-full items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-[#123b4e]"><Activity className="text-[#00b39e]" size={20} />FAME-GENIX 2.0</span>
          <nav className="hidden items-center gap-8 text-xs font-medium md:flex">
            {NAV_LINKS.map((n) => <a key={n} href="#" className="hover:text-[#00b39e]">{n}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <button className="hidden text-xs text-[#6a8a94] sm:block">USD</button>
            <button onClick={onSignIn} className="clinic-btn-ghost hidden sm:inline">Sign In</button>
            <button onClick={() => onExplore('PATIENT')} className="clinic-btn-primary hidden sm:inline">Explore Patient</button>
            <button className="rounded-lg border border-[#21262D] p-2 sm:hidden"><Activity size={18} /></button>
          </div>
        </div>
      </header>
      <main>
        <section className="relative overflow-hidden bg-[#d9f6ef]/70 px-4 py-12 sm:px-8 sm:py-24">
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="section-title">Trusted care · better health</p>
              <h1 className="section-heading">Your health<br className="hidden sm:block" />Our <span className="text-[#00b39e]">priority</span></h1>
              <p className="section-copy">Compassionate care, advanced technology, and experienced specialists — all for a healthier you.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Btn tone="cyan" className="clinic-btn-primary" onClick={() => onExplore('PATIENT')}>Book Appointment</Btn>
                <Btn tone="ghost" className="clinic-btn-ghost" onClick={() => onExplore('DOCTOR')}>Our Services</Btn>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2.5"><Activity className="text-[#00b39e]" size={20} /><div><p className="text-xs font-bold">15+</p><p className="text-[10px] text-[#6a8a94]">Expert Doctors</p></div></div>
                <div className="flex items-center gap-2.5"><Heart className="text-[#00b39e]" size={20} /><div><p className="text-xs font-bold">10k+</p><p className="text-[10px] text-[#6a8a94]">Happy Patients</p></div></div>
                <div className="flex items-center gap-2.5"><Stethoscope className="text-[#00b39e]" size={20} /><div><p className="text-xs font-bold">25+</p><p className="text-[10px] text-[#6a8a94]">Specialties</p></div></div>
              </div>
            </div>
            <div className="relative flex justify-center">
              <DoctorIllustration />
              <div className="absolute -right-6 bottom-10 w-48 rounded-2xl border border-[#21262D] bg-white p-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <Heart className="text-[#00b39e]" size={18} />
                  <div>
                    <p className="text-xs font-bold">24/7</p>
                    <p className="text-[10px] text-[#6a8a94]">Emergency Support</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="section-title mb-8">Our services</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((s) => (
                <Card key={s.title}>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9f6ef] text-[#0a7b6c]"><s.icon size={20} /></div>
                  <h3 className="mb-1 text-base font-bold">{s.title}</h3>
                  <p className="text-[11px] leading-relaxed text-[#6a8a94]">{s.desc}</p>
                  <p className="mt-4 text-[10px] font-bold text-[#00b39e] underline">Learn More →</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-[#f2f6f9] px-4 py-16 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="mb-3 text-sm font-bold">Health Checkup Packages</h3>
              <p className="text-[10px] text-[#6a8a94]">Starting From</p>
              <p className="mb-4 text-2xl font-bold">$49</p>
              <Btn tone="ghost" className="clinic-btn-ghost w-full">View Packages</Btn>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold">Why Choose Us?</h3>
              <ul className="space-y-2">
                {['Experienced Doctors', 'Modern Facilities', 'Patient First Approach', 'Affordable Pricing'].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-xs text-[#6a8a94]"><Heart size={14} className="text-[#00b39e]" />{t}</li>
                ))}
              </ul>
              <Btn tone="ghost" className="clinic-btn-ghost mt-4 w-full">Learn More</Btn>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold">Take Care of Yourself Today</h3>
              <p className="mb-4 text-[10px] leading-relaxed text-[#6a8a94]">Early diagnosis, better treatment, healthier life.</p>
              <Btn tone="cyan" className="clinic-btn-primary w-full" onClick={() => onExplore('PATIENT')}>Book Now</Btn>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#21262D] bg-white p-4 shadow-sm">
              <Ambulance size={24} className="text-[#00b39e]" />
              <div>
                <p className="text-xs font-bold">We're Here for You</p>
                <p className="text-[10px] text-[#6a8a94]">Emergency Care 24/7 You Can Trust.</p>
              </div>
              <Btn tone="ghost" className="clinic-btn-ghost text-xs px-3 py-2" onClick={() => onExplore('EMERGENCY_OPERATOR')}>Get Help Now</Btn>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null); const [view, setView] = useState<'landing' | 'app'>('landing'); const [auth, setAuth] = useState<{ email?: string; want?: Role } | null>(null); const [err, setErr] = useState<string>();
  const refresh = async () => { try { setUser(await api.me()); setView('app'); } catch { tokenStore.clear(); setUser(null); } };
  useEffect(() => { if (tokenStore.get()) void refresh(); }, []);
  const goRole = async (role: Role) => { setErr(undefined); if (user?.role === role) return; const local = PORTALS.find((p) => p.role === role)!.local; const email = `${local}@${DOMAIN}`; if (!DEMO_PW) { setAuth({ email, want: role }); return; } try { tokenStore.set((await api.login(email, DEMO_PW)).access_token); await refresh(); } catch (e) { setErr(errMsg(e)); setAuth({ email, want: role }); } };
  const signOut = () => { tokenStore.clear(); setUser(null); setView('landing'); };
  const body = !user ? null : user.role === 'PATIENT' ? <PatientView /> : user.role === 'DOCTOR' ? <DoctorView /> : user.role === 'EMERGENCY_OPERATOR' ? <EmergencyView /> : user.role === 'AMBULANCE_TEAM' ? <AmbulanceView /> : <AdminView />;
  return <div className="min-h-screen bg-[#fbfcfe]">{view === 'landing' || !user ? <Landing onExplore={(r) => void goRole(r)} onSignIn={() => setAuth({})} /> : <><header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-[#21262D] bg-white px-3 sm:px-8"><button onClick={() => setView('landing')} className="flex items-center gap-2 font-bold text-[#0f2c38]"><Activity className="text-[#00b39e]" size={20} /><span className="hidden sm:inline">FAME-GENIX 2.0</span></button><nav aria-label="Portals" className="hidden gap-1 md:flex">{PORTALS.map((p) => <button key={p.role} aria-current={user.role === p.role} onClick={() => void goRole(p.role)} className={`rounded-xl px-3 text-xs font-bold ${user.role === p.role ? 'bg-[#d9f6ef] text-[#0a7b6c]' : 'text-[#6a8a94] hover:text-[#00b39e]'}`}>{p.label}</button>)}</nav><select aria-label="Switch portal" className={fieldCls + ' w-auto md:hidden'} value={user.role} onChange={(e) => void goRole(e.target.value as Role)}>{PORTALS.map((p) => <option key={p.role} value={p.role}>{p.label}</option>)}</select><Btn tone="ghost" className="clinic-btn-ghost" onClick={signOut}>Sign out</Btn></header><main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-8 sm:py-8">{err && <ErrorState message={err} />}<p className="font-mono text-[11px] text-[#6a8a94]">{user.email} · {user.role}</p>{body ?? <Card><p>Loading…</p></Card>}</main></>}{auth && <AuthModal presetEmail={auth.email} onClose={() => setAuth(null)} onDone={() => { setAuth(null); void refresh(); }} />}</div>;
}
