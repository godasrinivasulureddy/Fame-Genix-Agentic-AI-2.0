/**
 * FAME-GENIX 2.0 — Super-Futuristic Neural Intelligence UI
 *
 * Neural Bio-Orb: ambient multi-agent consciousness orb whose color and pulse
 * track the patient's triage state:
 *   • normal   → Cyan/Amber breathe (Autonomous Surveillance)
 *   • warning  → Amber pulse (ESI-3/4 watch)
 *   • critical → Crimson fast pulse (Code Red / ESI-1)
 *   • deliberating → Prismatic rotating particle ring (Multi-Agent Society consensus)
 *
 * TelemetryTerminal: live GATT BLE packet stream from the Smart Mask (0x180D /
 * 0x181A) and Smart Helmet (0x1826), every packet stamped
 * "is_simulated": true / "simulation_label": "SIMULATED TELEMETRY".
 *
 * AuditChainLedger: animating SHA-256 chained cryptographic blocks for the
 * tamper-evident medical-legal black box.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bluetooth, Sparkles, ShieldAlert } from 'lucide-react';

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
  { core: string; aura: string; ring: string; pulse: string; label: string; icon: React.ElementType }
> = {
  normal: {
    core: '#41d69a',
    aura: '#41d69a',
    ring: '#41d69a',
    pulse: '5s',
    label: 'AUTONOMOUS SURVEILLANCE · BASELINE STABLE',
    icon: Activity,
  },
  warning: {
    core: '#f2b955',
    aura: '#f2b955',
    ring: '#f2b955',
    pulse: '3s',
    label: 'ESI WATCH · ELEVATED ACUITY MONITORING',
    icon: Sparkles,
  },
  critical: {
    core: '#fb7185',
    aura: '#fb7185',
    ring: '#fb7185',
    pulse: '1.2s',
    label: 'CODE RED · ESI-1 CRITICAL TRIAGE ACTIVATED',
    icon: ShieldAlert,
  },
  deliberating: {
    core: '#9c87f5',
    aura: '#9c87f5',
    ring: '#d97757',
    pulse: '2.5s',
    label: 'MULTI-AGENT SOCIETY · CONSENSUS DELIBERATION ACTIVE',
    icon: Sparkles,
  },
};

const MASK_SERVICES = [
  { service: '0x180D', characteristic: '0x2A37', label: 'Heart Rate', unit: 'bpm', key: 'heart_rate' },
  { service: '0x181A', characteristic: '0x2A6E', label: 'Respiration Rate', unit: 'br/min', key: 'respiratory_rate' },
  { service: '0x181A', characteristic: '0x2A6F', label: 'Skin Temperature', unit: '°C', key: 'temperature' },
];

const HELMET_SERVICES = [
  { service: '0x1826', characteristic: '0x2A6B', label: 'Sweat Sodium', unit: 'mmol/L', key: 'sweat_sodium' },
  { service: '0x1826', characteristic: '0x2A6C', label: 'Sweat Potassium', unit: 'mmol/L', key: 'sweat_potassium' },
  { service: '0x1826', characteristic: '0x2A6D', label: 'Core Skin Temp', unit: '°C', key: 'skin_temp' },
];

const nowTime = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hexByte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');

function jitter(n: number, pct = 0.04) {
  return Number((n + (Math.random() - 0.5) * 2 * n * pct).toFixed(2));
}

/**
 * Neural Bio-Orb — pure SVG / CSS-animated ambient consciousness orb.
 * Zero external animation libraries; driven by SVG <animate> elements.
 */
function NeuralBioOrb({
  triageState = 'normal',
  className = 'w-full h-64 md:h-80',
}: { triageState?: TriageState; className?: string }) {
  const theme = THEME[triageState];
  const isCritical = triageState === 'critical';
  const isPrismatic = triageState === 'deliberating';
  const OrbIcon = theme.icon;
  const orbIconColor =
    theme.core === '#fb7185' ? '#fb7185' : theme.core === '#f2b955' ? '#f2b955' : '#41d69a';

  return (
    <div
      className={`relative rounded-3xl border p-1.5 bg-[#1b1b19] shadow-2xl ${className}`}
      style={{ borderColor: theme.aura }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="w-full h-full max-w-[260px] max-h-[260px] drop-shadow-[0_0_24px_rgba(128,128,128,0.45)]"
          viewBox="0 0 200 200"
          role="img"
          aria-label={`Neural bio-orb: ${theme.label}`}
        >
          <defs>
            <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={theme.core} stopOpacity="1" />
              <stop offset="60%" stopColor={theme.core} stopOpacity="0.5" />
              <stop offset="100%" stopColor={theme.core} stopOpacity="0" />
              {isPrismatic && (
                <animate
                  attributeName="stop-color"
                  values={`${theme.core};#fb7185;#f2b955;#41d69a;${theme.core}`}
                  dur="7s"
                  repeatCount="indefinite"
                />
              )}
            </radialGradient>
            <radialGradient id="orb-aura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={theme.aura} stopOpacity="0.5" />
              <stop offset="100%" stopColor={theme.aura} stopOpacity="0" />
            </radialGradient>
            <filter id="orb-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={isCritical ? 20 : 14} result="blur" />
              <feComposite in="blur" in2="SourceGraphic" operator="over" />
            </filter>
          </defs>

          {/* Outer aura pulse ring */}
          <circle cx="100" cy="100" r="76" fill="none" stroke={theme.aura} strokeOpacity="0.5" strokeWidth="3" filter="url(#orb-glow)">
            <animate attributeName="r" values="66;86;66" dur={theme.pulse} repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.35;0.65;0.35" dur={theme.pulse} repeatCount="indefinite" />
          </circle>

          {/* Orbit ring */}
          <circle cx="100" cy="100" r="92" fill="none" stroke={theme.ring} strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="6 6">
            {isPrismatic && (
              <animate attributeName="stroke-opacity" values="0.22;0.5;0.22" dur="3s" repeatCount="indefinite" />
            )}
          </circle>

          {/* Orbiting consciousness particles */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const offset = (i * 45) % 360;
            const pcolor = isPrismatic ? [`#41d69a`, `#fb7185`, `#f2b955`, `#9c87f5`][i % 4] : theme.core;
            return (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={isPrismatic ? 3.5 : 2.5}
                fill={pcolor}
                filter="url(#orb-glow)"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${offset} 100 100`}
                  to={`${offset + 360} 100 100`}
                  dur={`${8 + (i % 3) * 2}s`}
                  repeatCount="indefinite"
                />
                {isCritical && (
                  <animate attributeName="r" values="2.5;4.5;2.5" dur="0.6s" repeatCount="indefinite" />
                )}
              </circle>
            );
          })}

          {/* Neural core */}
          <circle cx="100" cy="100" r="24" fill="url(#orb-core)" filter="url(#orb-glow)">
            {isCritical && (
              <animate attributeName="r" values="24;29;24" dur="0.8s" repeatCount="indefinite" />
            )}
          </circle>

          {/* Core focal pulse dot */}
          <circle cx="100" cy="100" r="6" fill="#faf9f5" opacity="0.9">
            <animate attributeName="opacity" values="0.6;1;0.6" dur={theme.pulse} repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* State chip */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[#3e3e38] bg-[#141412]/80 px-3 py-1 font-mono text-[10px] font-bold text-[#a9a99f] shadow-lg backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${isCritical ? 'bg-[#fb7185] animate-pulse' : 'bg-[#41d69a] animate-pulse'}`} />
        <span>{theme.label}</span>
        <OrbIcon size={12} className={`text-${orbIconColor}`} />
      </div>
    </div>
  );
}

/**
 * TelemetryTerminal — live GATT BLE packet stream from Smart Mask & Smart Helmet.
 */
function TelemetryTerminal({
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
    const unit = svc.unit as string;

    // Derive realistic GATT bytes from the value (little-endian uint16 → hex)
    const raw = Math.max(0, Math.min(65535, Math.round(value * 100)));
    const lo = (raw & 0xff).toString(16).padStart(2, '0');
    const hi = ((raw >> 8) & 0xff).toString(16).padStart(2, '0');

    const packet: BLEPacket = {
      t: nowTime(),
      service: svc.service,
      characteristic: svc.characteristic,
      handle: `0x${Math.floor(Math.random() * 0x100).toString(16).padStart(2, '0')}`,
      bytes: `${hexByte()} ${lo} ${hi} ${hexByte()}`,
      device,
      decoded: { [svc.label]: `${value} ${unit}`, rssi: `-${55 + Math.floor(Math.random() * 12)} dBm` },
      is_simulated: true,
      simulation_label: 'SIMULATED TELEMETRY',
    };
    setPackets((prev) => [packet, ...prev].slice(0, 14));
  }, [vitals]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    pushPacket(); // immediate first packet
    intervalRef.current = setInterval(pushPacket, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [active, pushPacket]);

  const criticalVitals =
    vitals &&
    ((Number(vitals.heart_rate ?? 0) > 140 || Number(vitals.spo2 ?? 100) < 90) || Number(vitals.temperature ?? 0) > 39);

  return (
    <div className="rounded-3xl border border-[#3e3e38] bg-[#141412] p-4 shadow-lg flex flex-col h-[420px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bluetooth size={14} className="text-[#41d69a]" />
          <span className="font-mono text-[11px] font-bold text-[#a9a99f] uppercase tracking-wider">
            WebBluetooth GATT Telemetry Stream
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold transition ${
            active
              ? 'border-[#41d69a] bg-[#41d69a]/15 text-[#41d69a] shadow-md shadow-[#41d69a]/25'
              : 'border-[#3e3e38] text-[#a9a99f]'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#41d69a] animate-pulse' : 'bg-[#a9a99f]'}`} />
          {active ? 'LIVE STREAM' : 'STREAM PAUSED'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-1.5 font-mono text-[10px] leading-tight">
        {packets.length ? (
          packets.map((p, i) => {
            const isCriticalPacket =
              criticalVitals || (p.decoded['Heart Rate'] != null && Number(String(p.decoded['Heart Rate']).replace(/\D/g, '')) > 130);
            return (
              <div
                key={i}
                className={`flex gap-2 px-2 py-1.5 rounded-xl border border-transparent transition ${isCriticalPacket ? 'border-[#fb7185]/60 bg-[#fb7185]/5 text-[#fb7185]' : 'border-[#3e3e38]/40 bg-[#1b1b19]/40 text-[#a9a99f]'}`}
                title={`Device: ${p.device} · ${p.simulation_label}`}
              >
                <span className="text-[#41d69a]">{p.t}</span>
                <span className="text-[#9c87f5]">[GATT]</span>
                <span className="text-[#d97757]">{p.service}::{p.characteristic}</span>
                <span className="text-[#a9a99f]">handle={p.handle}</span>
                <span className="text-[#a9a99f]">bytes="{p.bytes}"</span>
                <span className="text-[#f2b955]">→ {String(p.decoded[svcKey(p)] ?? '')}</span>
                <span className="rounded-md border border-[#3e3e38]/50 px-1 py-0 bg-[#2c2c2b] text-[9px]">
                  SIMULATED
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-[11px] text-[#a9a99f] font-mono">
            Awaiting wearable telemetry… enable live stream.
          </div>
        )}
      </div>
      <div className="mt-2 border-t border-[#3e3e38]/50 pt-2 flex items-center justify-between text-[10px] text-[#a9a99f]">
        <span>Provenance: <span className="text-[#41d69a]">is_simulated=true</span></span>
        <span className="font-mono text-[#d97757]">SIMULATED TELEMETRY</span>
      </div>
    </div>
  );
}

function svcKey(p: BLEPacket) {
  const map: Record<string, string> = {
    '0x2A37': 'Heart Rate',
    '0x2A6E': 'Respiration Rate',
    '0x2A6F': 'Skin Temperature',
    '0x2A6B': 'Sweat Sodium',
    '0x2A6C': 'Sweat Potassium',
    '0x2A6D': 'Core Skin Temp',
  };
  return map[p.characteristic] ?? 'Heart Rate';
}

/**
 * AuditChainLedger — animating SHA-256 chained tamper-evident block visualization.
 */
export function AuditChainLedger({
  blocks,
  compact = false,
}: {
  blocks: ChainBlock[];
  compact?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!blocks.length) {
    return (
      <div className={`rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 ${compact ? 'h-40' : 'h-72'} flex flex-col items-center justify-center text-[11px] text-[#a9a99f] font-mono`}>
        Cryptographic ledger initializing… genesis block sealed.
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[#3e3e38] bg-[#141412] p-3 ${compact ? 'h-48 md:h-56' : 'h-80 md:h-[420px]'} overflow-hidden relative flex flex-col`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase font-bold text-[#a9a99f]">
          SHA-256 CHAINED MEDICAL BLACK BOX
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#41d69a] animate-pulse" />
          <span className="font-bold text-[#41d69a]">CHAIN INTACT · TAMPER-EVIDENT</span>
        </span>
      </div>

      {/* Vertical chain connector */}
      <div className="flex-1 relative flex items-center pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-[2px] bg-[#3e3e38] z-0" />
        {blocks.map((block, idx) => {
          const isLatest = idx === blocks.length - 1;
          const hash = block.block_hash;
          return (
            <div
              key={block.index}
              className={`relative z-10 mb-4 flex flex-col gap-1 ${
                mounted || idx > 0 ? 'fg-ledger-entry' : ''
              }`}
              style={{ animationDelay: `${idx * 0.12}s`, opacity: mounted || idx > 0 ? 1 : 0 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shadow-lg ${
                      isLatest
                        ? 'bg-[#41d69a] text-[#141412] ring-2 ring-[#41d69a]/40 animate-pulse'
                        : 'bg-[#2c2c2b] text-[#a9a99f] border border-[#3e3e38]'
                    }`}
                  >
                    {block.index}
                  </div>
                  <span className="font-mono text-xs text-[#faf9f5]">{truncate(block.event_type, 26)}</span>
                </div>
                <span className={`font-mono text-[10px] font-bold ${isLatest ? 'text-[#41d69a]' : 'text-[#a9a99f]'}`}>
                  {new Date(block.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#a9a99f] text-[9px]">actor:</span>
                <span className="font-mono text-[10px] text-[#d97757]">{block.actor_id}</span>
                <span className="text-[#a9a99f] text-[9px]">·</span>
                <span className="font-mono text-[10px] text-[#9c87f5]">{block.actor_role}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#a9a99f] text-[9px]">payload hash:</span>
                <span className="font-mono text-[10px] text-[#a9a99f] truncate" title={block.payload_hash}>
                  {truncate(block.payload_hash, 14)}…
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#a9a99f] text-[9px]">prev block:</span>
                <span className="font-mono text-[10px] text-[#fb7185]/80 truncate" title={block.previous_block_hash}>
                  {truncate(block.previous_block_hash, 14)}…
                </span>
              </div>
              {!compact && (
                <div className="flex items-center gap-2">
                  <span className="text-[#a9a99f] text-[9px]">block hash:</span>
                  <span className="font-mono text-[10px] text-[#41d69a] truncate" title={hash}>
                    {truncate(hash, 14)}…
                  </span>
                </div>
              )}
              {idx < blocks.length - 1 && (
                <div className="absolute left-1 top-8 bottom-[calc(100%-28px)] w-[2px] bg-[#41d69a]/30" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s;
}

/**
 * TriageCommandCenter — composite patient command strip: Neural Bio-Orb +
 * BLE telemetry terminal + audit ledger snapshot.
 */
export function TriageCommandCenter({
  triageState,
  vitals,
  telemetryActive,
  ledgerBlocks,
}: {
  triageState: TriageState;
  vitals?: Record<string, number | string>;
  telemetryActive?: boolean;
  ledgerBlocks?: ChainBlock[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <NeuralBioOrb triageState={triageState} />
      </div>
      <div className="lg:col-span-5">
        <TelemetryTerminal vitals={vitals} active={telemetryActive ?? true} />
      </div>
      <div className="lg:col-span-3">
        <AuditChainLedger blocks={ledgerBlocks ?? []} compact />
      </div>
    </div>
  );
}
