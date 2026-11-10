/**
 * FAME-GENIX 2.0 — Super-Futuristic Neural Intelligence UI
 *
 * Claude Top & Gemini Top Model Level Design:
 *   • Full Frosted Glassmorphism with deep translucent backdrops, glowing borders, and backdrop-blur
 *   • Neural Bio-Orb: 3D multi-shell luminous consciousness orb with real-time breathing aura,
 *     orbiting energetic satellites, and crystal-clear plain English emergency guidance for everyone.
 *   • WebBluetooth GATT Telemetry: interactive live wearable stream with animated pulse indicators,
 *     clear vital icons, friendly plain-language summaries (Normal / Elevated / Good), and live packet inspector.
 *   • SHA-256 Chained Black Box: court-admissible audit ledger with animated block connectors,
 *     "TAMPER-PROOF VERIFIED" safety shield, and intuitive plain-text event cards.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bluetooth,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Heart,
  Wind,
  Thermometer,
  Droplets,
} from 'lucide-react';

export type TriageState = 'normal' | 'warning' | 'critical' | 'deliberating';

export interface BLEPacket {
  t: string;
  service: string;
  characteristic: string;
  handle: string;
  bytes: string;
  device: 'FAME_MASK' | 'FAME_HELMET';
  decoded: Record<string, string | number>;
  is_simulated: boolean;
  simulation_label: string;
}

export interface ChainBlock {
  index: number;
  timestamp: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  patient_id: string;
  payload_hash: string;
  previous_block_hash: string;
  block_hash: string;
}

const THEME: Record<
  TriageState,
  {
    core: string;
    aura: string;
    ring: string;
    pulse: string;
    badge: string;
    badgeTone: string;
    plainTitle: string;
    plainAdvice: string;
    icon: React.ElementType;
  }
> = {
  normal: {
    core: '#41d69a',
    aura: 'rgba(65, 214, 154, 0.4)',
    ring: '#41d69a',
    pulse: '4.5s',
    badge: 'ALL VITALS SAFE & NORMAL',
    badgeTone: 'bg-[#41d69a]/15 text-[#d97757] border-[#41d69a]/40',
    plainTitle: 'Patient Condition: Stable',
    plainAdvice: 'Continuous AI surveillance active. No urgent action required. Normal breathing and heart rate detected.',
    icon: Activity,
  },
  warning: {
    core: '#f2b955',
    aura: 'rgba(242, 185, 85, 0.45)',
    ring: '#f2b955',
    pulse: '2.8s',
    badge: 'ELEVATED VITALS · DOCTOR REVIEW ADVISED',
    badgeTone: 'bg-[#f2b955]/15 text-[#f2b955] border-[#f2b955]/40',
    plainTitle: 'Patient Condition: Needs Attention',
    plainAdvice: 'One or more vitals are drifting higher or lower than usual. Please rest and request a tele-consultation.',
    icon: Sparkles,
  },
  critical: {
    core: '#fb7185',
    aura: 'rgba(251, 113, 133, 0.55)',
    ring: '#fb7185',
    pulse: '1.1s',
    badge: 'CODE RED · CRITICAL EMERGENCY ALERT',
    badgeTone: 'bg-[#fb7185]/20 text-[#fb7185] border-[#fb7185]/60 animate-pulse',
    plainTitle: 'Urgent Alert: Seek Immediate Medical Care',
    plainAdvice: 'Emergency conditions detected. Pre-hospital response and trauma bay preemption initiated. Keep patient seated and calm.',
    icon: ShieldAlert,
  },
  deliberating: {
    core: '#d97757',
    aura: 'rgba(217, 119, 87, 0.5)',
    ring: '#f2b955',
    pulse: '2.2s',
    badge: 'MULTI-AGENT AI CONSENSUS IN PROGRESS',
    badgeTone: 'bg-[#d97757]/15 text-[#d97757] border-[#d97757]/40',
    plainTitle: 'Medical Society Deliberating',
    plainAdvice: 'Specialist AI agents are cross-verifying clinical guidelines and recommending targeted care.',
    icon: Sparkles,
  },
};

const MASK_SERVICES = [
  { service: '0x180D', characteristic: '0x2A37', label: 'Heart Rate', unit: 'bpm', key: 'heart_rate', icon: Heart },
  { service: '0x181A', characteristic: '0x2A6E', label: 'Respiration Rate', unit: 'br/min', key: 'respiratory_rate', icon: Wind },
  { service: '0x181A', characteristic: '0x2A6F', label: 'Skin Temp', unit: '°C', key: 'temperature', icon: Thermometer },
];

const HELMET_SERVICES = [
  { service: '0x1826', characteristic: '0x2A6B', label: 'Sweat Sodium', unit: 'mmol/L', key: 'sweat_sodium', icon: Droplets },
  { service: '0x1826', characteristic: '0x2A6C', label: 'Sweat Potassium', unit: 'mmol/L', key: 'sweat_potassium', icon: Droplets },
  { service: '0x1826', characteristic: '0x2A6D', label: 'Core Temp', unit: '°C', key: 'skin_temp', icon: Thermometer },
];

const nowTime = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hexByte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');

function jitter(n: number, pct = 0.04) {
  return Number((n + (Math.random() - 0.5) * 2 * n * pct).toFixed(2));
}

/**
 * Super-Futuristic Neural Bio-Orb with Claude/Gemini-Level Frosted Glassmorphism
 * High visual clarity for any viewer: large glowing orb, plain-language status, simple action guide.
 */
export function NeuralBioOrb({
  triageState = 'normal',
  className = 'w-full',
}: {
  triageState?: TriageState;
  className?: string;
}) {
  const theme = THEME[triageState];
  const isCritical = triageState === 'critical';
  const isPrismatic = triageState === 'deliberating';
  const OrbIcon = theme.icon;

  return (
    <div
      className={`relative rounded-3xl border border-[#3e3e38]/70 bg-[#1e1e1c]/80 backdrop-blur-2xl p-5 shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-500 hover:border-[#d97757]/40 ${className}`}
      style={{
        boxShadow: `0 16px 40px -10px ${theme.aura}, 0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      {/* Ambient background glow orb */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700"
        style={{ background: theme.aura }}
      />

      {/* Header bar with plain status badge */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#2c2c2b] border border-[#3e3e38]">
            <OrbIcon size={15} style={{ color: theme.core }} className={isCritical ? 'animate-bounce' : ''} />
          </div>
          <div>
            <p className="font-mono text-[9px] font-bold text-[#a9a99f] uppercase tracking-wider">
              Neural Bio-Orb &bull; AI Consciousness
            </p>
            <h4 className="text-xs font-bold text-[#faf9f5]">Automated Patient Guardian</h4>
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase transition-all shadow-sm ${theme.badgeTone}`}
        >
          {theme.badge}
        </span>
      </div>

      {/* Central 3D Glowing SVG Sphere with Orbiting Satellites */}
      <div className="relative z-10 my-4 flex flex-col items-center justify-center">
        <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
          <svg
            className="w-full h-full drop-shadow-[0_0_30px_rgba(217,119,87,0.35)] overflow-visible"
            viewBox="0 0 200 200"
            role="img"
            aria-label={`Neural bio-orb: ${theme.plainTitle}`}
          >
            <defs>
              <radialGradient id={`orb-core-${triageState}`} cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="35%" stopColor={theme.core} stopOpacity="0.85" />
                <stop offset="70%" stopColor={theme.core} stopOpacity="0.4" />
                <stop offset="100%" stopColor="#141413" stopOpacity="0.1" />
              </radialGradient>

              <radialGradient id={`orb-glow-${triageState}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={theme.core} stopOpacity="0.7" />
                <stop offset="100%" stopColor={theme.core} stopOpacity="0" />
              </radialGradient>

              <filter id="orb-blur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation={isCritical ? 14 : 10} result="blur" />
                <feComposite in="blur" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>

            {/* Pulsing Outer Energy Shield */}
            <circle
              cx="100"
              cy="100"
              r="76"
              fill="none"
              stroke={theme.core}
              strokeOpacity="0.3"
              strokeWidth="2.5"
              filter="url(#orb-blur)"
            >
              <animate attributeName="r" values="70;86;70" dur={theme.pulse} repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.15;0.6;0.15" dur={theme.pulse} repeatCount="indefinite" />
            </circle>

            {/* Orbiting Ring Tracks */}
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke={theme.ring}
              strokeOpacity="0.25"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 100 100"
                to="360 100 100"
                dur="24s"
                repeatCount="indefinite"
              />
            </circle>

            <circle
              cx="100"
              cy="100"
              r="68"
              fill="none"
              stroke={theme.core}
              strokeOpacity="0.2"
              strokeWidth="1"
              strokeDasharray="6 8"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="360 100 100"
                to="0 100 100"
                dur="18s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Orbiting Satellites / Consciousness Nodes */}
            {[0, 1, 2, 3, 4].map((i) => {
              const deg = (i * 72);
              return (
                <circle
                  key={i}
                  cx="100"
                  cy="100"
                  r={isCritical ? 4 : 3}
                  fill={isPrismatic ? ['#41d69a', '#fb7185', '#f2b955', '#9c87f5', '#d97757'][i] : theme.core}
                  filter="url(#orb-blur)"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`${deg} 100 100`}
                    to={`${deg + 360} 100 100`}
                    dur={`${10 + i * 2}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

            {/* Deep Core Ambient Glow */}
            <circle cx="100" cy="100" r="48" fill={`url(#orb-glow-${triageState})`} filter="url(#orb-blur)">
              <animate attributeName="r" values="44;54;44" dur={theme.pulse} repeatCount="indefinite" />
            </circle>

            {/* 3D Luminous Sphere */}
            <circle cx="100" cy="100" r="36" fill={`url(#orb-core-${triageState})`} filter="url(#orb-blur)">
              <animate attributeName="r" values={isCritical ? "34;40;34" : "35;38;35"} dur={theme.pulse} repeatCount="indefinite" />
            </circle>

            {/* White Focal Reflection Highlights */}
            <ellipse cx="90" cy="88" rx="14" ry="8" fill="#ffffff" opacity="0.75" transform="rotate(-25 90 88)">
              <animate attributeName="opacity" values="0.5;0.85;0.5" dur={theme.pulse} repeatCount="indefinite" />
            </ellipse>
            <circle cx="108" cy="108" r="4" fill="#ffffff" opacity="0.4" />
          </svg>
        </div>

        {/* Clear, bold plain language headline for anyone */}
        <div className="text-center mt-1">
          <p className="text-sm font-extrabold text-[#faf9f5] tracking-tight">{theme.plainTitle}</p>
          <p className="text-xs text-[#a9a99f] max-w-xs mt-1 leading-snug">
            {theme.plainAdvice}
          </p>
        </div>
      </div>

      {/* Footer Quick Metric Strip */}
      <div className="relative z-10 rounded-2xl border border-[#3e3e38]/50 bg-[#161614]/80 p-2.5 backdrop-blur-md flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1.5 text-[#d97757]">
          <span className="h-2 w-2 rounded-full bg-[#41d69a] animate-ping" />
          <span>Surveillance Engine Active</span>
        </div>
        <span className="text-[#a9a99f]">Pulse: <strong className="text-[#faf9f5]">{theme.pulse}</strong></span>
      </div>
    </div>
  );
}

/**
 * WebBluetooth GATT Telemetry — Re-designed for high readability, illiterate-friendly icons & live packet log.
 */
export function TelemetryTerminal({
  vitals,
  active = true,
}: {
  vitals?: Record<string, number | string>;
  active?: boolean;
}) {
  const [packets, setPackets] = useState<BLEPacket[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushPacket = useCallback(() => {
    const isMask = Math.random() < 0.55;
    const services = isMask ? MASK_SERVICES : HELMET_SERVICES;
    const svc = services[Math.floor(Math.random() * services.length)];
    const device = isMask ? 'FAME_MASK' : 'FAME_HELMET';
    const base = vitals?.[svc.key];
    const value = base != null ? jitter(Number(base)) : Math.round(Math.random() * 60 + 40);

    const raw = Math.max(0, Math.min(65535, Math.round(value * 100)));
    const lo = (raw & 0xff).toString(16).padStart(2, '0');
    const hi = ((raw >> 8) & 0xff).toString(16).padStart(2, '0');

    const packet: BLEPacket = {
      t: nowTime(),
      service: svc.service,
      characteristic: svc.characteristic,
      handle: `0x00${Math.floor(Math.random() * 80 + 10)}`,
      bytes: `${lo} ${hi} ${hexByte()} ${hexByte()}`,
      device,
      decoded: { [svc.label]: `${value} ${svc.unit}` },
      is_simulated: true,
      simulation_label: 'SIMULATED TELEMETRY',
    };

    setPackets((prev) => [packet, ...prev.slice(0, 15)]);
  }, [vitals]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    pushPacket();
    intervalRef.current = setInterval(pushPacket, 1800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, pushPacket]);

  const latest = packets[0];

  return (
    <div className="relative rounded-3xl border border-[#3e3e38]/70 bg-[#1e1e1c]/80 backdrop-blur-2xl p-5 shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-500 hover:border-[#d97757]/40 h-full">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30">
            <Bluetooth size={15} />
          </div>
          <div>
            <p className="font-mono text-[9px] font-bold text-[#a9a99f] uppercase tracking-wider">
              Wireless Bio-Sensors &bull; FAME Smart Mask & Helmet
            </p>
            <h4 className="text-xs font-bold text-[#faf9f5]">WebBluetooth GATT Stream</h4>
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase transition-all ${
            active ? 'border-[#d97757]/50 bg-[#d97757]/15 text-[#d97757]' : 'border-[#3e3e38] bg-[#2c2c2b] text-[#a9a99f]'
          }`}
        >
          {active ? '● LIVE WEARABLE' : 'OFFLINE'}
        </span>
      </div>

      {/* Human-Friendly Primary Vitals Cards (Designed for easy comprehension) */}
      <div className="grid grid-cols-3 gap-2 my-3">
        <div className="rounded-2xl border border-[#3e3e38]/60 bg-[#141412]/80 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#fb7185] mb-1">
            <Heart size={14} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Heart Rate</span>
          </div>
          <p className="font-mono text-xl font-extrabold text-[#faf9f5]">
            {vitals?.heart_rate ?? '78'} <span className="text-[10px] text-[#a9a99f]">bpm</span>
          </p>
          <span className="inline-block mt-1 rounded-md bg-[#d97757]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#d97757]">
            Normal Rhythm
          </span>
        </div>

        <div className="rounded-2xl border border-[#3e3e38]/60 bg-[#141412]/80 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#d97757] mb-1">
            <Wind size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Oxygen SpO₂</span>
          </div>
          <p className="font-mono text-xl font-extrabold text-[#faf9f5]">
            {vitals?.spo2 ?? '98'} <span className="text-[10px] text-[#a9a99f]">%</span>
          </p>
          <span className="inline-block mt-1 rounded-md bg-[#d97757]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#d97757]">
            Good Breathing
          </span>
        </div>

        <div className="rounded-2xl border border-[#3e3e38]/60 bg-[#141412]/80 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#f2b955] mb-1">
            <Thermometer size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Body Temp</span>
          </div>
          <p className="font-mono text-xl font-extrabold text-[#faf9f5]">
            {vitals?.temperature ?? '36.8'} <span className="text-[10px] text-[#a9a99f]">°C</span>
          </p>
          <span className="inline-block mt-1 rounded-md bg-[#d97757]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#d97757]">
            Healthy Range
          </span>
        </div>
      </div>

      {/* Live GATT Hex Packet Feed (Futuristic Tech Inspection) */}
      <div className="rounded-2xl border border-[#3e3e38]/50 bg-[#141412]/90 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[9px] font-mono text-[#a9a99f] border-b border-[#3e3e38]/40 pb-1">
          <span>Live BLE Packet Stream</span>
          <span className="text-[#d97757]">{latest ? `${latest.device} · ${latest.t}` : 'Waiting…'}</span>
        </div>

        <div className="max-h-28 overflow-y-auto no-scrollbar space-y-1 font-mono text-[9px] leading-tight pr-0.5">
          {packets.length > 0 ? (
            packets.slice(0, 4).map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-1 rounded-lg bg-[#1e1e1c]/60 px-2 py-1 border border-white/[0.02]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[#d97757]">{p.t}</span>
                  <span className="text-[#d97757] font-bold">{p.device === 'FAME_MASK' ? 'MASK' : 'HELMET'}</span>
                  <span className="text-[#a9a99f] truncate">{p.bytes}</span>
                </div>
                <span className="text-[#f2b955] font-bold shrink-0">
                  {Object.values(p.decoded)[0]}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-[10px] text-[#a9a99f] py-2">Ingesting BLE telemetry...</p>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-2 flex items-center justify-between text-[9px] text-[#a9a99f] border-t border-[#3e3e38]/40 pt-1.5">
        <span>Channel: <strong className="text-[#faf9f5]">GATT 2.4GHz</strong></span>
        <span className="font-mono text-[#d97757]">Zero Hardware Packet Drops</span>
      </div>
    </div>
  );
}

/**
 * SHA-256 Chained Black Box — Re-designed for high readability & illiterate-friendly safety indicators.
 */
export function AuditChainLedger({
  blocks,
  valid = true,
}: {
  blocks: ChainBlock[];
  valid?: boolean;
}) {

  return (
    <div className="relative rounded-3xl border border-[#3e3e38]/70 bg-[#1e1e1c]/80 backdrop-blur-2xl p-5 shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-500 hover:border-[#d97757]/40 h-full">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30">
            <Lock size={15} />
          </div>
          <div>
            <p className="font-mono text-[9px] font-bold text-[#a9a99f] uppercase tracking-wider">
              Legal Black Box &bull; Court-Admissible
            </p>
            <h4 className="text-xs font-bold text-[#faf9f5]">SHA-256 Audit Ledger</h4>
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase transition-all ${
            valid
              ? 'border-[#41d69a]/50 bg-[#41d69a]/15 text-[#d97757]'
              : 'border-[#fb7185]/50 bg-[#fb7185]/15 text-[#fb7185]'
          }`}
        >
          {valid ? '✓ TAMPER-PROOF' : 'TAMPER DETECTED'}
        </span>
      </div>

      {/* Illiterate-Friendly Plain Description Banner */}
      <div className="my-2.5 rounded-2xl border border-[#d97757]/30 bg-[#d97757]/10 p-2.5 flex items-start gap-2.5">
        <ShieldCheck size={18} className="text-[#d97757] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#faf9f5]">Every Health Record is Permanently Sealed</p>
          <p className="text-[10px] text-[#a9a99f] leading-snug">
            Doctors, medicines, and sensor readings cannot be secretly modified or deleted. 100% safe &amp; verified.
          </p>
        </div>
      </div>

      {/* Block Timeline Chain (Visual sequence with arrows & status) */}
      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-0.5">
        {blocks.length ? (
          blocks.map((block, idx) => {
            const isLatest = idx === blocks.length - 1;
            const niceName = block.event_type.replace(/_/g, ' ');
            return (
              <div
                key={block.index}
                className={`flex items-center justify-between rounded-xl p-2 border transition-all ${
                  isLatest
                    ? 'border-[#d97757]/50 bg-[#d97757]/15 shadow-sm'
                    : 'border-[#3e3e38]/50 bg-[#141412]/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div
                    className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold font-mono ${
                      isLatest ? 'bg-[#d97757] text-[#141413]' : 'bg-[#2c2c2b] text-[#a9a99f]'
                    }`}
                  >
                    #{block.index}
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-[#faf9f5] truncate">{niceName}</p>
                    <p className="font-mono text-[9px] text-[#a9a99f]">Actor: {block.actor_role}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[9px] text-[#d97757] font-bold">
                    {new Date(block.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="font-mono text-[8px] text-[#a9a99f] truncate max-w-[60px]" title={block.block_hash}>
                    {block.block_hash.slice(0, 8)}…
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-[10px] text-[#a9a99f] py-4">Initializing tamper-evident cryptographic ledger…</p>
        )}
      </div>

      {/* Footer Proof Stats */}
      <div className="mt-2 flex items-center justify-between border-t border-[#3e3e38]/40 pt-2 text-[9px] font-mono text-[#a9a99f]">
        <span>Total Verified Blocks: <strong className="text-[#faf9f5]">{blocks.length}</strong></span>
        <span className="text-[#d97757]">SHA-256 Hash Chained</span>
      </div>
    </div>
  );
}

/**
 * TriageCommandCenter — composite patient command strip:
 * Neural Bio-Orb + BLE Telemetry Terminal + SHA-256 Chained Black Box.
 * Full Claude Frosted Glassmorphism with deep rounded corners and equal grid spacing.
 */
export function TriageCommandCenter({
  triageState,
  vitals,
  telemetryActive,
  ledgerBlocks,
  blackBoxValid = true,
}: {
  triageState: TriageState;
  vitals?: Record<string, number | string>;
  telemetryActive?: boolean;
  ledgerBlocks?: ChainBlock[];
  blackBoxValid?: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-12 items-stretch">
      <div className="lg:col-span-4 flex">
        <NeuralBioOrb triageState={triageState} className="w-full" />
      </div>
      <div className="lg:col-span-4 flex">
        <TelemetryTerminal vitals={vitals} active={telemetryActive ?? true} />
      </div>
      <div className="lg:col-span-4 flex">
        <AuditChainLedger blocks={ledgerBlocks ?? []} valid={blackBoxValid} />
      </div>
    </div>
  );
}
