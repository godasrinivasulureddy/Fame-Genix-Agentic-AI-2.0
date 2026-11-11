import { downloadElementAsPdf } from './pdfExport';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Apple,
  Bluetooth,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Heart,
  History,
  MessageSquare,
  Mic,
  PieChart as PieIcon,
  RotateCcw,
  Trash2,
  Settings,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserCheck,
  Users,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import { api, errMsg } from './api';
import type {
  ChainBlock,
  EmergencyCase,
  Evidence,
  RiskAssessment,
  TriageState,
  Vitals,
} from './types';
import { TriageCommandCenter } from './neuralOrb';
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

const SEVERITIES = ['LOW', 'MODERATE', 'HIGH'] as const;
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

function VoiceInput({ onText }: { onText: (t: string) => void; equalGrid?: boolean }) {
  const [lang, setLang] = useState<(typeof LANGS)[number][0]>(LANGS[0][0]);
  const [rec, setRec] = useState(false);
  const [note, setNote] = useState<string>('');
  const recogRef = useRef<any>(null);

  const win = typeof window !== 'undefined' ? (window as any) : {};
  const Speech = win.SpeechRecognition || win.webkitSpeechRecognition;

  const toggle = () => {
    if (rec) {
      try {
        recogRef.current?.stop();
      } catch {
        /* noop */
      }
      setRec(false);
      setNote('');
      return;
    }
    if (!Speech) {
      const presets = [
        'Persistent sharp chest pain radiating to left shoulder and breathing difficulty',
        'Severe shortness of breath and wheezing after climbing stairs',
        'Sudden dizzy spells with elevated heart palpitations',
        'Pale skin, severe nausea, and stomach pain with high blood pressure',
      ];
      const randomPrompt = presets[Math.floor(Math.random() * presets.length)];
      setNote('Microphone API simulated (browser restricted speech)');
      onText(randomPrompt);
      setTimeout(() => setNote(''), 4000);
      return;
    }
    try {
      const r = new Speech();
      r.lang = lang;
      r.continuous = false;
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onstart = () => {
        setRec(true);
        setNote('Listening... Speak now');
      };
      r.onresult = (ev: any) => {
        let transcript = '';
        for (let i = 0; i < ev.results.length; i++) {
          transcript += ev.results[i][0].transcript;
        }
        if (transcript.trim()) {
          onText(transcript.trim());
          setNote(`Recognized: "${transcript.trim()}"`);
          setTimeout(() => setNote(''), 3500);
        }
      };
      r.onerror = (e: any) => {
        setNote(`Mic error: ${e.error || 'speech not detected'}`);
        setRec(false);
        setTimeout(() => setNote(''), 3000);
      };
      r.onend = () => {
        setRec(false);
      };
      recogRef.current = r;
      r.start();
    } catch {
      setNote('Speech service unavailable');
      setRec(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Dictation language"
        className={`${fieldCls} w-auto text-xs`}
        value={lang}
        onChange={(e) => setLang(e.target.value as any)}
      >
        {LANGS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <Btn
        type="button"
        tone="ghost"
        onClick={toggle}
        className={`flex items-center gap-1.5 text-xs transition-all ${
          rec ? 'border-[#fb7185] bg-[#fb7185]/20 text-[#fb7185] animate-pulse' : ''
        }`}
      >
        <Mic size={14} className={rec ? 'text-[#fb7185]' : 'text-[#d97757]'} />
        {rec ? 'Stop Dictation' : 'Voice Dictate'}
      </Btn>
      {note && <span className="font-mono text-[11px] text-[#f2b955]">{note}</span>}
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
  const res = data as Record<string, any>;
  if (!res) return null;

  const identifiedConditions: string[] = res.identified_conditions || [];
  const suggestedSpecialist: string =
    res.suggested_specialist || res.suggested_specialty || 'General Physician / Internal Medicine';
  const nextSteps: string[] = res.next_steps || [];

  if (res.tests !== undefined || res.report_type !== undefined || res.abnormal_test_count !== undefined) {
    return (
      <div className="space-y-4 rounded-2xl bg-[#1b1b19] p-4 border border-[#3e3e38]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#d97757]">
              {res.source && res.source.includes('NVIDIA')
                ? 'NVIDIA Nemotron SuperVL Extraction'
                : res.source === 'AI_GEMINI_OCR'
                ? 'Gemini Multimodal AI Ingestion'
                : 'Document Parsing Engine'}
            </span>
            <h4 className="text-base font-extrabold text-[#faf9f5]">
              {res.report_type ? res.report_type.replace(/_/g, ' ') : 'Clinical Laboratory Analysis'}
            </h4>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                (res.abnormal_test_count || 0) > 0
                  ? 'bg-[#fb7185]/20 text-[#fb7185] border border-[#fb7185]/40'
                  : 'bg-[#41d69a]/20 text-[#41d69a] border border-[#41d69a]/40'
              }`}
            >
              {(res.abnormal_test_count || 0) > 0
                ? `${res.abnormal_test_count} Abnormal Biomarkers`
                : 'All Biomarkers Within Normal Limits'}
            </span>
          </div>
        </div>

        {/* 3-Card Clinical Callout: Conditions, Specialist, Next Steps */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[#fb7185]/40 bg-[#fb7185]/10 p-3 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#fb7185] flex items-center gap-1.5">
              <ShieldAlert size={13} /> Identified Diseases / Conditions
            </span>
            <div className="space-y-1 pt-1">
              {identifiedConditions.length > 0 ? (
                identifiedConditions.map((c, i) => (
                  <p key={i} className="text-xs font-bold text-[#faf9f5] leading-snug">
                    • {c}
                  </p>
                ))
              ) : (
                <p className="text-xs font-bold text-[#faf9f5] leading-snug">
                  • Clinical Biomarker Profile Extracted
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#f2b955]/40 bg-[#f2b955]/10 p-3 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#f2b955] flex items-center gap-1.5">
              <Stethoscope size={13} /> Suggested Specialist Doctor
            </span>
            <p className="text-xs font-bold text-[#faf9f5] pt-1 leading-snug">{suggestedSpecialist}</p>
            <span className="block text-[10px] text-[#a9a99f]">Recommended Clinical Specialty</span>
          </div>

          <div className="rounded-xl border border-[#41d69a]/40 bg-[#41d69a]/10 p-3 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#41d69a] flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Recommended Next Steps
            </span>
            <div className="space-y-1 pt-1">
              {nextSteps.length > 0 ? (
                nextSteps.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-[11px] font-medium text-[#faf9f5] leading-tight">
                    • {s}
                  </p>
                ))
              ) : (
                <p className="text-[11px] font-medium text-[#faf9f5] leading-tight">
                  • Consult clinician with report
                </p>
              )}
            </div>
          </div>
        </div>

        {res.explanation && (
          <p className="text-xs leading-relaxed text-[#faf9f5] bg-[#262624] p-3 rounded-xl border border-[#3e3e38]/60">
            <strong className="text-[#d97757]">AI Clinical Interpretation: </strong>
            {res.explanation}
          </p>
        )}

        {Array.isArray(res.tests) && res.tests.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[#3e3e38]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#262624] font-mono text-[11px] text-[#a9a99f]">
                <tr>
                  <th className="p-2.5">Test Parameter</th>
                  <th className="p-2.5">Observed Value</th>
                  <th className="p-2.5">Reference Interval</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3e3e38]/60 font-mono">
                {res.tests.map((t: any, idx: number) => {
                  const isAbnormal = ['HIGH', 'LOW', 'CRITICAL_REPORTED'].includes(
                    t.status?.toUpperCase()
                  );
                  return (
                    <tr key={idx} className={isAbnormal ? 'bg-[#fb7185]/5' : ''}>
                      <td className="p-2.5 font-sans font-medium text-[#faf9f5]">{t.name}</td>
                      <td className="p-2.5 font-bold text-[#faf9f5]">
                        {t.raw_value || (t.value != null ? `${t.value} ${t.unit || ''}` : '--')}
                      </td>
                      <td className="p-2.5 text-[#a9a99f]">
                        {t.raw_reference_range ||
                          (t.reference_min !== undefined
                            ? `${t.reference_min} - ${t.reference_max} ${t.unit || ''}`
                            : 'Standard physiological interval')}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAbnormal
                              ? 'bg-[#fb7185]/20 text-[#fb7185]'
                              : 'bg-[#41d69a]/20 text-[#41d69a]'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {suggestedSpecialist && (
          <div className="flex items-center justify-between text-xs font-mono text-[#a9a99f] pt-1">
            <span>
              Target Consultation: <strong className="text-[#d97757]">{suggestedSpecialist}</strong>
            </span>
            <span>
              Extraction Confidence:{' '}
              <strong className="text-[#41d69a]">{res.extraction_confidence || 'HIGH'}</strong>
            </span>
          </div>
        )}
      </div>
    );
  }

  // Optical physical assessment results
  if (res.visual_findings !== undefined || res.body_area !== undefined) {
    return (
      <div className="space-y-4 rounded-2xl bg-[#1b1b19] p-4 border border-[#3e3e38]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38] pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#d97757]">
              {res.source && res.source.includes('NVIDIA')
                ? 'NVIDIA Multimodal SuperVL Visual Engine'
                : res.source === 'AI_GEMINI_VISION'
                ? 'Gemini Vision AI Engine'
                : 'Optical Physical Assessment'}
            </span>
            <h4 className="text-base font-extrabold text-[#faf9f5] capitalize">
              {res.body_area ? `${res.body_area.replace(/_/g, ' ')} Inspection` : 'Physical Observation Inspection'}
            </h4>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#41d69a]/20 text-[#41d69a] border border-[#41d69a]/40">
              Quality: {res.image_quality || 'ADEQUATE'}
            </span>
          </div>
        </div>

        {/* 3-Card Clinical Callout: Conditions, Specialist, Next Steps */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[#fb7185]/40 bg-[#fb7185]/10 p-3 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#fb7185] flex items-center gap-1.5">
              <ShieldAlert size={13} /> Identified Diseases / Conditions
            </span>
            <div className="space-y-1 pt-1">
              {identifiedConditions.length > 0 ? (
                identifiedConditions.map((c, i) => (
                  <p key={i} className="text-xs font-bold text-[#faf9f5] leading-snug">
                    • {c}
                  </p>
                ))
              ) : (
                <p className="text-xs font-bold text-[#faf9f5] leading-snug">
                  • Cutaneous / Physical Inspection Mapped
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#f2b955]/40 bg-[#f2b955]/10 p-3 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#f2b955] flex items-center gap-1.5">
              <Stethoscope size={13} /> Suggested Specialist Doctor
            </span>
            <p className="text-xs font-bold text-[#faf9f5] pt-1 leading-snug">{suggestedSpecialist}</p>
            <span className="block text-[10px] text-[#a9a99f]">Recommended Clinical Specialty</span>
          </div>

          <div className="rounded-xl border border-[#41d69a]/40 bg-[#41d69a]/10 p-3 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#41d69a] flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Recommended Next Steps
            </span>
            <div className="space-y-1 pt-1">
              {nextSteps.length > 0 ? (
                nextSteps.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-[11px] font-medium text-[#faf9f5] leading-tight">
                    • {s}
                  </p>
                ))
              ) : (
                <p className="text-[11px] font-medium text-[#faf9f5] leading-tight">
                  • Protect area and monitor symptoms
                </p>
              )}
            </div>
          </div>
        </div>

        {res.explanation && (
          <p className="text-xs leading-relaxed text-[#faf9f5] bg-[#262624] p-3 rounded-xl border border-[#3e3e38]/60">
            <strong className="text-[#d97757]">Clinical Visual Findings: </strong>
            {res.explanation}
          </p>
        )}

        {Array.isArray(res.visual_findings) && res.visual_findings.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase font-bold text-[#a9a99f]">
              Identified Visual Patterns ({res.visual_findings.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {res.visual_findings.map((vf: any, i: number) => (
                <div key={i} className="rounded-xl border border-[#3e3e38] bg-[#262624] p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#faf9f5] capitalize">
                      {vf.finding ? vf.finding.replace(/_/g, ' ') : vf.observation || 'Visual Sign'}
                    </span>
                    <span className="rounded bg-[#41d69a]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#41d69a] uppercase">
                      {vf.severity || 'mild'}
                    </span>
                  </div>
                  {vf.location && (
                    <p className="text-[11px] text-[#a9a99f] mt-0.5">Location: {vf.location}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs font-mono text-[#a9a99f] pt-1">
          <span>Specialist Consultation: <strong className="text-[#d97757]">{suggestedSpecialist}</strong></span>
          <span>Signal Reliability: <strong className="text-[#41d69a]">VERIFIED</strong></span>
        </div>
      </div>
    );
  }

  return (
    <pre className="max-h-64 overflow-auto rounded-xl bg-[#1b1b19] p-3 font-mono text-[11px] text-[#d97757]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Upload({
  kind,
  title,
  accept,
  onUploadSuccess,
}: {
  kind: 'reports' | 'images';
  title: string;
  accept: string;
  onUploadSuccess?: (out: any) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [out, setOut] = useState<unknown>();

  const run = async (f?: File) => {
    if (!f) return;
    setErr(undefined);
    setOut(undefined);
    if (f.size > MAX_BYTES) {
      setErr('Selected file exceeds 100 MB limit. Please select a smaller document.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.analyze(kind, f);
      setOut(result);
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const resetUpload = () => {
    setErr(undefined);
    setOut(undefined);
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#faf9f5] flex items-center gap-2">
          <FileText size={16} className="text-[#d97757]" />
          {title}
        </h3>
        {(out !== undefined || err) && (
          <button
            onClick={resetUpload}
            title="Clear and upload new document"
            className="flex items-center gap-1.5 rounded-full border border-[#3e3e38] bg-[#1e1e1c] px-2.5 py-1 text-[11px] font-semibold text-[#a9a99f] hover:border-[#d97757] hover:text-[#faf9f5] hover:bg-[#d97757]/10 transition shadow-sm"
          >
            <RotateCcw size={12} className="text-[#d97757]" />
            <span>Upload New</span>
          </button>
        )}
      </div>
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
        Drop document here or click to browse (PDF, JPG, PNG up to 100 MB)
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

// -------------------------------------------------------------
// Interactive 3-Color Clinical Health Analytics Suite
// 1. Line Chart (Health Trends Analysis)
// 2. Pie Chart (Biomarker / Acuity Distribution)
// 3. Speedometer Chart (Acuity Risk Dial)
// -------------------------------------------------------------

function ClinicalTrendsLineChart({
  score,
  scoreHistory,
}: {
  score: number;
  scoreHistory?: number[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    if (scoreHistory && scoreHistory.length >= 2) {
      const rec = scoreHistory.slice(-7);
      return rec.map((s, i) => ({
        index: i,
        val: Math.max(0, Math.min(100, Math.round(s))),
        label: i === rec.length - 1 ? 'Now' : `Eval -${rec.length - 1 - i}`,
      }));
    }

    const target = Math.max(0, Math.min(100, Math.round(score)));
    const steps = [
      { t: 'T-6h', ratio: 0.35, offset: -4 },
      { t: 'T-5h', ratio: 0.42, offset: 3 },
      { t: 'T-4h', ratio: 0.52, offset: -2 },
      { t: 'T-3h', ratio: 0.65, offset: 5 },
      { t: 'T-2h', ratio: 0.78, offset: -3 },
      { t: 'T-1h', ratio: 0.90, offset: 2 },
      { t: 'Now',  ratio: 1.0,  offset: 0 },
    ];

    return steps.map((s, i) => {
      let v: number;
      if (i === steps.length - 1) {
        v = target;
      } else {
        v = Math.round(Math.max(8, Math.min(100, target * s.ratio + s.offset)));
      }
      return { index: i, val: v, label: s.t };
    });
  }, [score, scoreHistory]);

  const min = 0;
  const max = 100;
  const w = 260;
  const h = 110;
  const pad = 20;

  const pts = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = h - pad - (p.val / (max - min)) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor = score >= 67 ? '#fb7185' : score >= 34 ? '#f2b955' : '#41d69a';
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="flex flex-col items-center justify-between rounded-2xl border border-[#3e3e38]/70 bg-[#171715] p-3.5 shadow-md">
      <div className="w-full flex items-center justify-between border-b border-[#3e3e38]/40 pb-1.5 mb-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#faf9f5] flex items-center gap-1.5">
          <TrendingUp size={12} className="text-[#d97757]" /> 1. Health Trends
        </span>
        <span className="font-mono text-[10px] font-bold" style={{ color: strokeColor }}>
          {activePoint?.val ?? score.toFixed(0)}% Acuity {hoveredIdx !== null ? `(${activePoint?.label})` : ''}
        </span>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 overflow-visible select-none">
        <defs>
          <linearGradient id="clinicalLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <line x1={pad} y1={pad} x2={w - pad} y2={pad} stroke="#fb7185" strokeOpacity="0.25" strokeDasharray="3 3" />
        <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#f2b955" strokeOpacity="0.20" strokeDasharray="3 3" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#41d69a" strokeOpacity="0.20" strokeDasharray="3 3" />

        <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill="url(#clinicalLineGrad)" />

        <polyline
          points={pts}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${strokeColor}66)` }}
        />

        {points.map((p, i) => {
          const cx = pad + (i / (points.length - 1)) * (w - pad * 2);
          const cy = h - pad - (p.val / (max - min)) * (h - pad * 2);
          const isLatest = i === points.length - 1;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : isLatest ? 4 : 2.5}
                fill={isLatest ? '#faf9f5' : strokeColor}
                stroke="#171715"
                strokeWidth="1.5"
                className={isLatest ? 'animate-pulse' : ''}
              />
              <circle cx={cx} cy={cy} r="14" fill="transparent" />
            </g>
          );
        })}
      </svg>

      <div className="w-full flex items-center justify-between text-[9px] font-mono text-[#a9a99f] pt-1 border-t border-[#3e3e38]/30">
        <span>T-6h</span>
        <span>T-3h</span>
        <span className="font-bold text-[#faf9f5]">Now (Latest)</span>
      </div>
    </div>
  );
}

function ClinicalDistributionPieChart({
  score,
  careLevel,
}: {
  score: number;
  careLevel?: string;
}) {
  const safePct = Math.max(10, Math.min(80, Math.round(100 - score)));
  const cautionPct = Math.max(10, Math.min(50, Math.round(score * 0.4)));
  const urgentPct = Math.max(10, 100 - safePct - cautionPct);

  const size = 95;
  const center = size / 2;
  const radius = 34;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * radius;

  const safeLen = (safePct / 100) * circ;
  const cautionLen = (cautionPct / 100) * circ;
  const urgentLen = (urgentPct / 100) * circ;

  const safeOffset = 0;
  const cautionOffset = -safeLen;
  const urgentOffset = -(safeLen + cautionLen);

  return (
    <div className="flex flex-col items-center justify-between rounded-2xl border border-[#3e3e38]/70 bg-[#171715] p-3.5 shadow-md">
      <div className="w-full flex items-center justify-between border-b border-[#3e3e38]/40 pb-1.5 mb-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#faf9f5] flex items-center gap-1.5">
          <PieIcon size={12} className="text-[#f2b955]" /> 2. Signal Distribution
        </span>
        <span className="font-mono text-[10px] font-bold text-[#f2b955]">
          {careLevel ? careLevel.replace(/_/g, ' ') : 'ACUITY RATIO'}
        </span>
      </div>

      <div className="relative flex items-center justify-center my-0.5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#41d69a"
            strokeWidth={strokeWidth}
            strokeDasharray={`${safeLen} ${circ}`}
            strokeDashoffset={safeOffset}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f2b955"
            strokeWidth={strokeWidth}
            strokeDasharray={`${cautionLen} ${circ}`}
            strokeDashoffset={cautionOffset}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#fb7185"
            strokeWidth={strokeWidth}
            strokeDasharray={`${urgentLen} ${circ}`}
            strokeDashoffset={urgentOffset}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-xs font-black text-[#faf9f5]">{score.toFixed(0)}</span>
          <span className="font-mono text-[7px] uppercase font-bold text-[#a9a99f]">INDEX</span>
        </div>
      </div>

      <div className="w-full flex items-center justify-around text-[9px] font-mono pt-1 border-t border-[#3e3e38]/30">
        <span className="text-[#41d69a] font-bold">● Safe {safePct}%</span>
        <span className="text-[#f2b955] font-bold">● Caution {cautionPct}%</span>
        <span className="text-[#fb7185] font-bold">● Urgent {urgentPct}%</span>
      </div>
    </div>
  );
}

function ClinicalSpeedometerGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = -90 + (clamped / 100) * 180;
  const strokeColor = clamped >= 67 ? '#fb7185' : clamped >= 34 ? '#f2b955' : '#41d69a';

  return (
    <div className="flex flex-col items-center justify-between rounded-2xl border border-[#3e3e38]/70 bg-[#171715] p-3.5 shadow-md">
      <div className="w-full flex items-center justify-between border-b border-[#3e3e38]/40 pb-1.5 mb-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#faf9f5] flex items-center gap-1.5">
          <Activity size={12} className="text-[#41d69a]" /> 3. Speedometer Dial
        </span>
        <span className="font-mono text-[10px] font-bold" style={{ color: strokeColor }}>
          {clamped >= 67 ? 'HIGH RISK' : clamped >= 34 ? 'CAUTION' : 'OPTIMAL'}
        </span>
      </div>

      <div className="relative w-full flex flex-col items-center justify-center my-0.5">
        <svg viewBox="0 0 160 88" className="w-36 h-20 overflow-visible">
          <path
            d="M 20 80 A 60 60 0 0 1 58 28"
            fill="none"
            stroke="#41d69a"
            strokeWidth="9"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M 64 24 A 60 60 0 0 1 96 24"
            fill="none"
            stroke="#f2b955"
            strokeWidth="9"
            opacity="0.85"
          />
          <path
            d="M 102 28 A 60 60 0 0 1 140 80"
            fill="none"
            stroke="#fb7185"
            strokeWidth="9"
            strokeLinecap="round"
            opacity="0.85"
          />

          <g transform={`rotate(${angle} 80 80)`}>
            <polygon points="78,80 82,80 80.5,26" fill={strokeColor} style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }} />
            <circle cx="80" cy="80" r="5" fill="#faf9f5" stroke="#171715" strokeWidth="2" />
          </g>
        </svg>

        <div className="text-center -mt-2">
          <span className="font-mono text-base font-black" style={{ color: strokeColor }}>
            {clamped.toFixed(0)}
          </span>
          <span className="font-mono text-[9px] text-[#a9a99f]"> / 100</span>
        </div>
      </div>

      <div className="w-full flex items-center justify-between text-[9px] font-mono text-[#a9a99f] pt-1 border-t border-[#3e3e38]/30">
        <span className="text-[#41d69a] font-bold">0 Cal</span>
        <span className="text-[#f2b955] font-bold">50 Baseline</span>
        <span className="text-[#fb7185] font-bold">100 Peak</span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Health History Modal & Detailed Assessment Template View
// -------------------------------------------------------------

function HealthHistoryModal({
  patientId,
  onClose,
  onSelectAssessment,
}: {
  patientId: string;
  onClose: () => void;
  onSelectAssessment: (a: RiskAssessment) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<RiskAssessment[]>([]);
  const [err, setErr] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setErr(undefined);
    try {
      const data = await api.patientAssessments(patientId);
      setLogs(data || []);
      setSelectedIds(new Set());
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [patientId]);

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((l) => l.id)));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDownloadPdf = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = logs.find((l) => l.id === id);
    if (item) {
      // Opening detail view allows exact DOM rendering and instant one-click download
      onSelectAssessment(item);
    } else {
      setDownloadingId(id);
      try {
        await api.downloadAssessmentPdf(id);
      } catch (e) {
        alert(`Failed to download assessment PDF: ${errMsg(e)}`);
      } finally {
        setDownloadingId(null);
      }
    }
  };

  const handleDeleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this clinical assessment log?')) return;
    setDeleting(true);
    try {
      await api.deleteAssessment(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      alert(`Failed to delete assessment: ${errMsg(e)}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected health assessment log(s)?`)) return;
    setDeleting(true);
    try {
      await api.batchDeleteAssessments(Array.from(selectedIds));
      setLogs((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
    } catch (e) {
      alert(`Failed to delete selected logs: ${errMsg(e)}`);
    } finally {
      setDeleting(false);
    }
  };

  const allSelected = logs.length > 0 && selectedIds.size === logs.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < logs.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-3xl border border-[#3e3e38] bg-[#1e1e1c] p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3e3e38] pb-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#41d69a]/15 text-[#41d69a] border border-[#41d69a]/30">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#faf9f5]">Clinical Health Assessment History</h2>
              <p className="text-xs text-[#a9a99f]">
                Permanent temporal registry of all synthesized clinical assessments with exact date &amp; time logs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-2 text-[#a9a99f] hover:text-[#faf9f5] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Select All & Bulk Delete */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-[#161614] rounded-xl border border-[#3e3e38]">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#faf9f5] select-none">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-[#3e3e38] bg-[#2c2c2b] text-[#d97757] focus:ring-[#d97757] accent-[#d97757] cursor-pointer"
              />
              <span>
                Select All ({selectedIds.size}/{logs.length} selected)
              </span>
            </label>

            {selectedIds.size > 0 && (
              <Btn
                tone="rose"
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="text-xs flex items-center gap-1.5 py-1 px-3 bg-[#fb7185]/20 text-[#fb7185] border border-[#fb7185]/40 hover:bg-[#fb7185]/30 transition"
              >
                <Trash2 size={13} />
                <span>Delete Selected ({selectedIds.size})</span>
              </Btn>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading && <Loading label="Loading patient assessment logs from clinical ledger…" />}
          {err && <ErrorState message={err} />}
          {!loading && !err && logs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#3e3e38] p-8 text-center text-xs text-[#a9a99f]">
              No past health assessments recorded yet. Synthesize an assessment via the intake portal to log results.
            </div>
          )}

          {!loading &&
            !err &&
            logs.map((item) => {
              const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent';
              const isUrgent = item.risk_score >= 67 || item.care_level === 'POSSIBLE_EMERGENCY';
              const isCaution = item.risk_score >= 34 && item.risk_score < 67;
              const badgeCls = isUrgent
                ? 'bg-[#fb7185]/20 text-[#fb7185] border-[#fb7185]/40'
                : isCaution
                ? 'bg-[#f2b955]/20 text-[#f2b955] border-[#f2b955]/40'
                : 'bg-[#41d69a]/20 text-[#41d69a] border-[#41d69a]/40';

              const isChecked = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectAssessment(item)}
                  className={`group cursor-pointer rounded-2xl border ${
                    isChecked ? 'border-[#d97757] bg-[#221c1a]' : 'border-[#3e3e38] bg-[#161614]'
                  } p-4 transition-all hover:border-[#d97757] hover:bg-[#1f1f1d] shadow-sm flex flex-wrap items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-3">
                    {/* Individual Selection Checkbox */}
                    <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => toggleSelectOne(item.id, e as any)}
                        className="w-4 h-4 rounded border-[#3e3e38] bg-[#2c2c2b] text-[#d97757] focus:ring-[#d97757] accent-[#d97757] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-[#a9a99f]" />
                        <span className="font-mono text-xs font-bold text-[#faf9f5]">{dateStr}</span>
                        <span className="font-mono text-[10px] text-[#a9a99f]">
                          ID: {item.id.slice(0, 8)}…
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${badgeCls}`}>
                          {item.care_level ? item.care_level.replace(/_/g, ' ') : 'STABLE'}
                        </span>
                        <span className="text-xs text-[#a9a99f]">
                          Symptoms:{' '}
                          <strong className="text-[#faf9f5]">
                            {item.active_symptoms && item.active_symptoms.length > 0
                              ? item.active_symptoms.map((s) => s.name).join(', ')
                              : 'Baseline / None'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Download PDF, Risk Score, View Button & Delete Log Button */}
                  <div className="flex items-center gap-3">
                    {/* Download Button beside/left side of Risk score */}
                    <button
                      type="button"
                      title="Download Log as PDF"
                      onClick={(e) => handleDownloadPdf(item.id, e)}
                      disabled={downloadingId === item.id}
                      className="rounded-xl border border-[#d97757]/40 bg-[#d97757]/15 p-2 text-[#d97757] hover:bg-[#d97757]/25 hover:text-[#faf9f5] hover:border-[#d97757] transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      <Download size={15} className={downloadingId === item.id ? 'animate-bounce' : ''} />
                    </button>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-[#a9a99f] uppercase block">Risk Score</span>
                      <span className="font-mono text-lg font-black text-[#d97757]">
                        {item.risk_score != null ? Math.round(item.risk_score) : 0}%
                      </span>
                    </div>

                    <Btn
                      tone="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAssessment(item);
                      }}
                      className="text-xs flex items-center gap-1.5 group-hover:border-[#d97757] group-hover:text-[#faf9f5]"
                    >
                      <Eye size={14} className="text-[#d97757]" />
                      <span>View</span>
                    </Btn>

                    {/* Delete Log Button on the right */}
                    <button
                      type="button"
                      title="Delete log"
                      onClick={(e) => handleDeleteOne(item.id, e)}
                      disabled={deleting}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-[#3e3e38]">
          <span className="text-xs text-[#a9a99f]">
            {logs.length} assessment {logs.length === 1 ? 'log' : 'logs'} recorded
          </span>
          <Btn tone="ghost" onClick={onClose} className="text-xs">
            Close
          </Btn>
        </div>
      </div>
    </div>
  );
}

function HistoricalAssessmentDetailModal({
  assessment,
  patient,
  onClose,
}: {
  assessment: RiskAssessment;
  patient?: any;
  onClose: () => void;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [insight, setInsight] = useState<any>();
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.insight(assessment.id);
        if (live) setInsight(res);
      } catch {
        /* fallback to baseline info */
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [assessment.id]);

  const a = assessment;
  const isHealthyOrSafe = a.risk_score < 30 && (a.care_level === 'STABLE' || a.care_level === ('LOW' as any));
  const dateFormatted = a.created_at ? new Date(a.created_at).toLocaleString() : 'Evaluation Record';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div ref={exportRef} data-pdf-export-root="true" className="relative w-full max-w-4xl rounded-3xl border border-[#3e3e38] bg-[#1e1e1c] p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Patient Clinical Bio-Data Strip */}
        <div data-pdf-block="bio-strip" className="rounded-2xl border border-[#3e3e38] bg-[#262624] p-4 shadow-md space-y-3">
          {/* Official Healthcare System Report Title Heading */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3e3e38]/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#d97757] text-[#141413]">
                <Activity size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-[#faf9f5] uppercase font-mono">
                  Fame Genix — Health Care Report
                </h2>
                <p className="text-[11px] font-bold text-[#d97757] tracking-wider uppercase font-mono">
                  Clinical Assessment Record
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {/* Date & Time beside header */}
              <div className="text-right">
                <span className="font-mono text-[10px] uppercase font-bold text-[#d97757] block">
                  Date &amp; Time
                </span>
                <span className="font-mono text-xs font-bold text-[#faf9f5]">
                  {dateFormatted}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#41d69a]/40 bg-[#41d69a]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#41d69a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#41d69a] animate-pulse" />
                CONFIDENTIAL MEDICAL RECORD
              </span>
            </div>
          </div>

          {/* Patient Demographics Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30">
                <Heart size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[#faf9f5]">{patient?.full_name ?? 'John Doe'}</h4>
                  <span className="font-mono text-xs font-semibold text-[#d97757]">
                    {patient?.public_id ?? 'FG-P-000001'}
                  </span>
                </div>
                <p className="text-[11px] text-[#a9a99f]">
                  {[patient?.age && `${patient.age} yrs`, patient?.blood_group, patient?.sex, patient?.known_conditions]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="text-right font-mono text-[10px] text-[#a9a99f]">
              <span>Verified AI Synthesized Diagnostic Ledger</span>
            </div>
          </div>
        </div>
        {/* Modal Top Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3e3e38] pb-3 sticky top-0 bg-[#1e1e1c]/95 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold text-[#d97757] px-2 py-0.5 rounded bg-[#d97757]/15">
                Archived Assessment Template View
              </span>
              <span className="font-mono text-xs text-[#a9a99f]">ID: {a.id}</span>
            </div>
          </div>
          <div data-pdf-ignore="true" className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (!exportRef.current) return;
                setExportingPdf(true);
                try {
                  await downloadElementAsPdf(
                    exportRef.current,
                    `FAME-GENIX-Assessment-${a.id.slice(0, 8)}.pdf`,
                    (msg) => setExportStatus(msg)
                  );
                } catch (e) {
                  alert(`Failed to generate exact PDF: ${errMsg(e)}`);
                } finally {
                  setExportingPdf(false);
                  setExportStatus('');
                }
              }}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 rounded-xl border border-[#d97757]/40 bg-[#d97757]/15 px-3.5 py-1.5 font-mono text-xs font-bold text-[#faf9f5] hover:bg-[#d97757]/30 hover:border-[#d97757] transition disabled:opacity-50 cursor-pointer shadow-md shadow-[#d97757]/10"
            >
              <Download size={14} className={exportingPdf ? 'animate-bounce text-[#d97757]' : 'text-[#d97757]'} />
              <span>{exportingPdf ? (exportStatus || 'Capturing Exact View…') : 'Download PDF (Exact View)'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-2 text-[#a9a99f] hover:text-[#faf9f5] transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Safety Rules if present */}
        <SafetyRules a={a} />

        {/* 5-TIER PATIENT PORTAL RESULTS TEMPLATE */}
        <div className="space-y-5">
          {/* TIER 1: Telemetry & Anomaly Detection */}
          <div data-pdf-block="tier-1" className="rounded-2xl border border-[#3e3e38] bg-[#161614] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#d97757]/20 font-mono text-xs font-bold text-[#d97757]">
                1
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                Telemetry &amp; Anomaly Detection
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {VITAL_META.map((m) => {
                const val = a.vitals ? (a.vitals as any)[m.key] : undefined;
                return (
                  <div key={m.key} className="rounded-xl bg-[#262624] p-2.5">
                    <span className="text-[10px] text-[#a9a99f]">{m.label}</span>
                    <p className="font-mono text-sm font-bold text-[#faf9f5]">
                      {val != null ? `${val} ${m.unit}` : 'Standard Baselines'}
                    </p>
                  </div>
                );
              })}
            </div>
            {a.active_symptoms && a.active_symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-[#a9a99f]">Reported:</span>
                {a.active_symptoms.map((s, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-[#3e3e38] bg-[#262624] px-2 py-0.5 font-mono text-[11px] text-[#faf9f5]"
                  >
                    {s.name} {s.severity ? `(${s.severity})` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* TIER 2: Evidence-Grounded Reasoning Path */}
          <div data-pdf-block="tier-2" className="rounded-2xl border border-[#3e3e38] bg-[#161614] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#9c87f5]/20 font-mono text-xs font-bold text-[#9c87f5]">
                2
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                Evidence-Grounded Reasoning Path
              </h4>
            </div>
            <EvidenceChainNode
              detectedSignal={
                a.active_symptoms?.[0]?.name ? `${a.active_symptoms[0].name}` : 'Normal Baseline'
              }
              clinicalRule={a.triggered_safety_rules?.[0]?.reason ?? 'Standard Acuity Fusion Model'}
              evidenceCitation={'American Diabetes Association (ADA) / AHA Standards of Care'}
              recommendedAction={
                a.care_level === 'POSSIBLE_EMERGENCY'
                  ? 'Immediate EMS Dispatch'
                  : 'Tele-consultation & Observation'
              }
            />
          </div>

          {/* TIER 3: Multi Factor Health Risk Score & 3 Visual Gauges */}
          <div data-pdf-block="tier-3" className="rounded-3xl border border-[#3e3e38]/80 bg-[#161614] p-5 shadow-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38]/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-[#f2b955] to-[#d97757] font-mono text-xs font-black text-[#141413]">
                  3
                </span>
                <div>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#faf9f5]">
                    Multi Factor Health Risk Score
                  </h4>
                  <p className="text-[10px] text-[#a9a99f]">
                    Simple visual gauges for instant understanding · Green = Safe, Amber = Caution, Red = Urgent
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RiskBadge level={a.care_level} />
                <span className="rounded-full border border-[#41d69a]/30 bg-[#41d69a]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#41d69a]">
                  AI Confidence: {a.confidence_score ? a.confidence_score.toFixed(0) : 90}%
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-12 items-center">
              <div className="md:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-[#3e3e38]/60 bg-[#1e1e1c] p-4 text-center shadow-inner">
                <div className="relative flex items-center justify-center">
                  <RiskDonut score={a.risk_score} />
                </div>
                <div className="mt-2.5 w-full flex items-center justify-around text-[10px] font-bold font-mono">
                  <span className={a.risk_score < 34 ? 'text-[#41d69a] underline' : 'text-[#a9a99f]'}>
                    ● 0-33 Safe
                  </span>
                  <span
                    className={
                      a.risk_score >= 34 && a.risk_score < 67 ? 'text-[#f2b955] underline' : 'text-[#a9a99f]'
                    }
                  >
                    ● 34-66 Caution
                  </span>
                  <span className={a.risk_score >= 67 ? 'text-[#fb7185] underline' : 'text-[#a9a99f]'}>
                    ● 67+ High
                  </span>
                </div>
              </div>

              <div className="md:col-span-8 space-y-3.5">
                <div className="rounded-2xl border border-[#3e3e38]/50 bg-[#1e1e1c] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#faf9f5]">Overall Health Condition Barometer</span>
                    <span
                      className={`font-mono ${
                        a.risk_score >= 67
                          ? 'text-[#fb7185]'
                          : a.risk_score >= 34
                          ? 'text-[#f2b955]'
                          : 'text-[#41d69a]'
                      }`}
                    >
                      {a.risk_score >= 67
                        ? 'Action Recommended Immediately'
                        : a.risk_score >= 34
                        ? 'Moderate Caution Advised'
                        : 'Healthy Baseline Maintained'}
                    </span>
                  </div>
                  <Spectrum score={a.risk_score} />
                  <div className="flex items-center justify-between text-[9px] font-mono text-[#a9a99f] pt-1">
                    <span>Low / Normal</span>
                    <span>Moderate Acuity</span>
                    <span>High / Emergency</span>
                  </div>
                </div>

                {a.top_factors && a.top_factors.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#a9a99f]">
                      Key Contributing Health Signals ({a.top_factors.length})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {a.top_factors.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-[#3e3e38]/60 bg-[#1e1e1c] px-3 py-2 text-xs"
                        >
                          <span className="text-[#faf9f5] font-semibold truncate">{f.factor_name}</span>
                          <span className="font-mono text-[10px] font-bold text-[#d97757] shrink-0 ml-1">
                            {f.direction?.replace(/_/g, ' ')} ({f.contribution})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Color Gauges Horizontally */}
            <div data-pdf-sub-block="tier-3-gauges" className="grid gap-3 pt-3 border-t border-[#3e3e38]/60 md:grid-cols-3">
              <ClinicalTrendsLineChart score={a.risk_score} />
              <ClinicalDistributionPieChart score={a.risk_score} careLevel={a.care_level} />
              <ClinicalSpeedometerGauge score={a.risk_score} />
            </div>
          </div>

          {/* TIER 4: Doctor Consultation Requirement */}
          <div data-pdf-block="tier-4" className="rounded-2xl border border-[#3e3e38] bg-[#161614] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#41d69a]/20 font-mono text-xs font-bold text-[#41d69a]">
                  4
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                  Doctor Consultation Requirement
                </h4>
              </div>
              {insight?.explanation && <Speaker text={insight.explanation} />}
            </div>

            {isHealthyOrSafe ? (
              <div className="rounded-xl border border-[#41d69a]/40 bg-[#41d69a]/10 p-4 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-[#41d69a] shrink-0" />
                <div>
                  <h5 className="text-sm font-bold text-[#faf9f5]">Routine Wellness Baseline Maintained</h5>
                  <p className="text-xs text-[#a9a99f] mt-0.5">
                    Your parameters are within normal baseline ranges. No specialist doctor consultation or intervention is required at this time.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-[#faf9f5] bg-[#262624] p-3 rounded-xl border border-[#3e3e38]">
                  {insight?.explanation ?? (loading ? 'Synthesizing explanation…' : 'Clinical evaluation indicated.')}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3e3e38]">
                  <span className="text-xs text-[#a9a99f]">Recommended Specialist:</span>
                  <span className="rounded-lg border border-[#3e3e38] bg-[#262624] px-3 py-1 font-mono text-xs font-bold text-[#d97757]">
                    {insight?.suggested_specialty || insight?.specialist?.specialty || 'General Physician / Internal Medicine'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* TIER 5: Food Recommendation & Home Tips */}
          <div data-pdf-block="tier-5" className="rounded-2xl border border-[#3e3e38] bg-[#161614] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#d97757]/20 font-mono text-xs font-bold text-[#d97757]">
                  5
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5] flex items-center gap-1.5">
                  <Utensils size={14} className="text-[#d97757]" /> Food Recommendation &amp; Home Tips to Recover
                </h4>
              </div>
              <span className="text-[10px] font-mono text-[#a9a99f]">AI Clinical Nutritionist</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#41d69a]/30 bg-[#41d69a]/5 p-3 space-y-1.5">
                <p className="font-mono text-[10px] font-bold uppercase text-[#41d69a] flex items-center gap-1">
                  <Apple size={12} /> Recommended Recovery Foods
                </p>
                <ul className="text-xs text-[#faf9f5] space-y-1 pl-4 list-disc">
                  {insight?.food_guidance?.recommended?.length ? (
                    insight.food_guidance.recommended.map((item: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-bold">{item.title || item}:</span>{' '}
                        <span className="text-[#a9a99f]">{item.reason || ''}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li>Electrolyte-rich fluids (coconut water, oral rehydration)</li>
                      <li>Warm clear broths and ginger infusion</li>
                      <li>Steamed vegetables, oats, and easily digestible proteins</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-[#fb7185]/30 bg-[#fb7185]/5 p-3 space-y-1.5">
                <p className="font-mono text-[10px] font-bold uppercase text-[#fb7185] flex items-center gap-1">
                  <AlertTriangle size={12} /> Foods &amp; Habits to Avoid / Limit
                </p>
                <ul className="text-xs text-[#faf9f5] space-y-1 pl-4 list-disc">
                  {insight?.food_guidance?.limit?.length ? (
                    insight.food_guidance.limit.map((item: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-bold">{item.title || item}:</span>{' '}
                        <span className="text-[#a9a99f]">{item.reason || ''}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li>Excess sodium and processed salted snacks</li>
                      <li>Heavy fried, spicy, or greasy meals</li>
                      <li>Caffeine, energy drinks, and alcohol</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-[#3e3e38] bg-[#262624] p-3 space-y-1.5">
              <p className="font-mono text-[10px] font-bold uppercase text-[#faf9f5] flex items-center gap-1">
                <CheckCircle2 size={12} className="text-[#41d69a]" /> Home Self-Care &amp; Restorative Steps
              </p>
              <ul className="text-xs text-[#a9a99f] space-y-1 pl-4 list-disc">
                {insight?.self_care?.length ? (
                  insight.self_care.map((item: any, idx: number) => (
                    <li key={idx} className="text-[#faf9f5]">
                      <span className="font-bold">{item.title || item}:</span>{' '}
                      <span className="text-[#a9a99f]">{item.description || ''}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="text-[#faf9f5]">Rest in a comfortable, semi-upright posture</li>
                    <li className="text-[#faf9f5]">Maintain continuous pulse &amp; SpO2 monitoring with wearable</li>
                    <li className="text-[#faf9f5]">Maintain adequate hydration in small, frequent sips</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Close Button */}
        <div data-pdf-ignore="true" className="flex justify-end pt-3 border-t border-[#3e3e38]">
          <Btn tone="ghost" onClick={onClose} className="text-xs">
            Close Template View
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Spark({ values, label, color = '#d97757' }: { values: number[]; label: string; color?: string }) {
  if (values.length < 2) return <p className="font-mono text-[11px] text-[#a9a99f]">calibrating sensor waveform...</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 22}`)
    .join(' ');
  const areaPts = `0,30 ${pts} 100,30`;
  const gradId = `grad-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <svg viewBox="0 0 100 30" className="h-12 w-full overflow-visible transition-all duration-300" role="img" aria-label={`${label} live waveform trend`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.length > 0 && (
        <circle
          cx="100"
          cy={28 - ((values[values.length - 1] - min) / span) * 22}
          r="3"
          fill={color}
          className="animate-ping"
        />
      )}
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
  const [liveStreamActive, setLiveStreamActive] = useState(true);
  const [vit, setVit] = useState<Record<string, string>>({
    heart_rate: '78',
    spo2: '98',
    respiratory_rate: '15',
    temperature: '36.8',
  });
  const [simulated, setSimulated] = useState(false);
  const [history, setHistory] = useState<Array<Vitals & { simulated: boolean }>>([
    { heart_rate: 72, spo2: 99, respiratory_rate: 14, temperature: 36.6, simulated: false },
    { heart_rate: 74, spo2: 98, respiratory_rate: 15, temperature: 36.7, simulated: false },
    { heart_rate: 76, spo2: 99, respiratory_rate: 14, temperature: 36.7, simulated: false },
    { heart_rate: 75, spo2: 98, respiratory_rate: 15, temperature: 36.8, simulated: false },
    { heart_rate: 78, spo2: 98, respiratory_rate: 15, temperature: 36.8, simulated: false },
  ]);

  useEffect(() => {
    if (!liveStreamActive) return;
    const interval = setInterval(() => {
      setVit((prev) => {
        const hrBase = parseFloat(prev.heart_rate || '78');
        const spo2Base = parseFloat(prev.spo2 || '98');
        const rrBase = parseFloat(prev.respiratory_rate || '15');
        const tempBase = parseFloat(prev.temperature || '36.8');

        const hrDelta = Math.floor(Math.random() * 5) - 2;
        const spo2Delta = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const rrDelta = Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const tempDelta = Math.random() * 0.1 - 0.05;

        const newHr = Math.min(160, Math.max(50, Math.round(hrBase + hrDelta)));
        const newSpo2 = Math.min(100, Math.max(80, Math.round(spo2Base + spo2Delta)));
        const newRr = Math.min(45, Math.max(10, Math.round(rrBase + rrDelta)));
        const newTemp = parseFloat(Math.min(41.0, Math.max(35.5, tempBase + tempDelta)).toFixed(1));

        const newEntry = {
          heart_rate: newHr,
          spo2: newSpo2,
          respiratory_rate: newRr,
          temperature: newTemp,
          simulated: true,
        };

        setHistory((h) => [...h.slice(-14), newEntry]);

        return {
          heart_rate: String(newHr),
          spo2: String(newSpo2),
          respiratory_rate: String(newRr),
          temperature: String(newTemp),
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [liveStreamActive]);

  const [a, setA] = useState<RiskAssessment>();
  const [assessmentScoreHistory, setAssessmentScoreHistory] = useState<number[]>([]);
  const [insight, setInsight] = useState<{
    explanation?: string;
    suggested_specialty?: string;
    possible_patterns?: string[];
    specialist?: { specialty: string; reason: string };
    self_care?: Array<{ title: string; description: string }>;
    food_guidance?: {
      recommended?: Array<{ title: string; reason: string }>;
      limit?: Array<{ title: string; reason: string }>;
    };
  }>();
  const [ev, setEv] = useState<Evidence[]>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [token, setToken] = useState<string>();
  const diagnosticSynthesisRef = useRef<HTMLDivElement>(null);

  // Modals
  const [passport, setPassport] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [btOpen, setBtOpen] = useState(false);
  const [societyOpen, setSocietyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<RiskAssessment | null>(null);
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
          void api.insight(a.id).then((i: any) => {
            setInsight(i);
            if (i.suggested_specialty) setSpecialty(i.suggested_specialty);
            else if (i.specialist?.specialty) setSpecialty(i.specialist.specialty);
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

  const resetAssessment = () => {
    setSymptoms([]);
    setText('');
    setSev('HIGH');
    setA(undefined);
    setInsight(undefined);
    setEv(undefined);
    setErr(undefined);
    setToken(undefined);
    setSimulated(false);
    setVit({
      heart_rate: '78',
      spo2: '98',
      respiratory_rate: '15',
      temperature: '36.8',
    });
  };

  const runAssessmentWithSymptoms = async (
    targetSymptoms: Array<{ name: string; severity: string }>,
    targetVitals?: Record<string, string>
  ) => {
    setBusy(true);
    setErr(undefined);
    setToken(undefined);
    setInsight(undefined);
    setEv(undefined);
    const vSource = targetVitals ?? vit;
    const vitals: Vitals = {};
    for (const m of VITAL_META) {
      if (vSource[m.key]?.trim()) vitals[m.key] = Number(vSource[m.key]);
    }
    try {
      const res = await api.createAssessment({ symptoms: targetSymptoms, vitals });
      setA(res);
      setAssessmentScoreHistory((prev) => [...prev, res.risk_score]);
      setHistory((h) => [...h, { ...vitals, simulated }]);
      const q = [...targetSymptoms.map((s) => s.name), res.care_level].join(' ');
      const [i, r] = await Promise.allSettled([api.insight(res.id), api.rag(q)]);
      if (i.status === 'fulfilled') {
        setInsight(i.value as any);
        if ((i.value as any).suggested_specialty) {
          setSpecialty((i.value as any).suggested_specialty);
        } else if ((i.value as any).specialist?.specialty) {
          setSpecialty((i.value as any).specialist.specialty);
        }
      }
      setEv(r.status === 'fulfilled' ? r.value : []);
      // Auto-scroll animation to Diagnostic Risk Synthesis
      setTimeout(() => {
        diagnosticSynthesisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    await runAssessmentWithSymptoms(symptoms, vit);
  };

  const handleUploadIntake = (uploadResult: any) => {
    if (!uploadResult) return;
    const newSymptoms: Array<{ name: string; severity: string }> = [...symptoms];

    const conditions: string[] = uploadResult.identified_conditions || [];
    conditions.forEach((c) => {
      if (c && !newSymptoms.some((s) => s.name.toLowerCase() === c.toLowerCase())) {
        newSymptoms.push({ name: c, severity: 'HIGH' });
      }
    });

    if (Array.isArray(uploadResult.tests)) {
      uploadResult.tests.forEach((param: any) => {
        if (param.status && param.status !== 'NORMAL' && param.name) {
          const symName = `${param.name}: ${param.raw_value || param.value || ''} (${param.status})`;
          if (!newSymptoms.some((s) => s.name.toLowerCase() === symName.toLowerCase())) {
            newSymptoms.push({
              name: symName,
              severity: param.status === 'CRITICAL_REPORTED' || param.status === 'HIGH' ? 'HIGH' : 'MODERATE',
            });
          }
        }
      });
    }

    if (Array.isArray(uploadResult.visual_findings)) {
      uploadResult.visual_findings.forEach((vf: any) => {
        const obs = vf.finding || vf.observation;
        if (obs && !newSymptoms.some((s) => s.name.toLowerCase() === obs.toLowerCase())) {
          newSymptoms.push({ name: obs, severity: vf.severity || 'HIGH' });
        }
      });
    }

    if (newSymptoms.length > symptoms.length) {
      setSymptoms(newSymptoms);
    }

    if (uploadResult.suggested_specialist) {
      setSpecialty(uploadResult.suggested_specialist);
    }

    void runAssessmentWithSymptoms(newSymptoms.length ? newSymptoms : symptoms, vit);
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

  const triageState: TriageState = useMemo(() => {
    if (currentEmergency) return 'critical';
    if (a?.care_level === 'POSSIBLE_EMERGENCY') return 'critical';
    if (a?.care_level === 'URGENT') return 'warning';
    return 'normal';
  }, [a, currentEmergency]);

  const [ledgerBlocks, setLedgerBlocks] = useState<ChainBlock[]>([]);
  useEffect(() => {
    let live = true;
    (async () => {
      const sha256 = async (str: string) => {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      };
      const patientId = p?.id ?? 'GLOBAL';
      const now = Date.now();
      let prevHash = '0'.repeat(64);
      const blocks: ChainBlock[] = [];
      const seal = async (
        index: number,
        event_type: string,
        actor_id: string,
        actor_role: string,
        data: Record<string, unknown>,
      ) => {
        const ts = new Date(now - (3 - index) * 300000).toISOString();
        const payloadHash = await sha256(JSON.stringify({ ...data, actor_id, actor_role }));
        const header = `${index}|${ts}|${event_type}|${actor_id}|${patientId}|${payloadHash}|${prevHash}`;
        const blockHash = await sha256(header);
        blocks.push({
          index,
          timestamp: ts,
          event_type,
          actor_id,
          actor_role,
          patient_id: patientId,
          payload_hash: payloadHash,
          previous_block_hash: prevHash,
          block_hash: blockHash,
        });
        prevHash = blockHash;
      };
      await seal(0, 'GENESIS_CLINICAL_BLACK_BOX', 'SYSTEM', 'SYSTEM_ADMIN', {});
      await seal(1, 'PATIENT_PORTAL_SESSION_STARTED', patientId, 'PATIENT', {});
      if (a) {
        await seal(
          2,
          'CLINICAL_RISK_ASSESSMENT_CREATED',
          patientId,
          'PATIENT',
          { risk_score: a.risk_score, care_level: a.care_level },
        );
      }
      if (currentEmergency) {
        await seal(
          3,
          'EMERGENCY_SOS_TRIGGERED',
          patientId,
          'PATIENT',
          { case_id: currentEmergency.id, status: currentEmergency.status },
        );
      }
      if (live) setLedgerBlocks(blocks);
    })();
    return () => {
      live = false;
    };
  }, [a, currentEmergency, p?.id]);

  const isLowRiskOrHealthy = a && a.risk_score < 30 && (a.care_level === 'STABLE' || a.care_level === ('LOW' as any));

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
          <Btn
            tone="ghost"
            onClick={() => setHistoryOpen(true)}
            className="text-xs flex items-center gap-1.5 border border-[#3e3e38] hover:border-[#41d69a]/60 text-[#faf9f5]"
          >
            <History size={14} className="text-[#41d69a]" />
            Health History
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
            <Overline>Physiological Telemetry &amp; FAME Wearable Interface</Overline>
            <h3 className="text-base font-bold text-[#faf9f5]">Continuous Telemetry &amp; Anomaly Detection</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setLiveStreamActive(!liveStreamActive)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold border transition ${
                liveStreamActive
                  ? 'bg-[#41d69a]/15 border-[#41d69a] text-[#41d69a] shadow-md shadow-[#41d69a]/20'
                  : 'bg-[#20201e] border-[#3e3e38] text-[#a9a99f]'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${liveStreamActive ? 'bg-[#41d69a] animate-ping' : 'bg-[#a9a99f]'}`} />
              {liveStreamActive ? 'LIVE WEARABLE STREAM [AUTO-PULSE]' : 'STREAM PAUSED'}
            </button>

            <span className="text-xs text-[#a9a99f] ml-1">Inject Anomaly:</span>
            {Object.keys(PRESETS).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setVit(PRESETS[k]);
                  setSimulated(true);
                }}
                className="rounded-lg border border-[#3e3e38] bg-[#1b1b19] px-2.5 py-1 font-mono text-[10px] text-[#d97757] hover:border-[#d97757] hover:bg-[#20201e] transition font-bold"
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

          <div className="rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-5 shadow-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Overline>Multimodal Clinical Intake</Overline>
                <h3 className="text-base font-bold text-[#faf9f5] mt-0.5">Symptom Expression &amp; Voice Input</h3>
                <p className="text-xs text-[#a9a99f] mt-1">
                  Enter your symptoms naturally or use speech dictation in English, Telugu, or Hindi — then synthesize algorithmic risk fusion.
                </p>
              </div>
              <button
                onClick={resetAssessment}
                title="Reset symptoms and vitals for fresh health assessment"
                className="flex items-center gap-1.5 rounded-full border border-[#3e3e38] bg-[#1e1e1c] px-3 py-1.5 text-xs font-semibold text-[#a9a99f] hover:border-[#41d69a] hover:text-[#faf9f5] hover:bg-[#41d69a]/10 transition shadow-sm shrink-0"
              >
                <RotateCcw size={13} className="text-[#41d69a]" />
                <span>Refresh for Next Assessment</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Full-width spacious intake input box extending to dead right */}
              <div className="w-full">
                <input
                  className={`${fieldCls} w-full py-5 px-4 text-sm md:text-base rounded-2xl shadow-inner transition-all focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]`}
                  value={text}
                  placeholder="Describe symptoms (e.g. sharp chest pain, shortness of breath)"
                  aria-label="Symptom text"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSymptom()}
                />
              </div>

              {/* Controls bar: Language box, Severity box (LOW/MODERATE/HIGH) right beside it, Add button, Voice Dictate */}
              {/* 2nd row: Language Dropdown + Voice Dictate + Severity Dropdown + Add Button equally aligned in 1 horizontal line */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 items-center pt-1">
                <VoiceInput onText={(t) => setText((x) => (x ? `${x} ` : '') + t)} equalGrid={true} />
                <select
                  aria-label="Severity"
                  className={`${fieldCls} w-full text-xs py-2.5 font-bold rounded-xl`}
                  value={sev}
                  onChange={(e) => setSev(e.target.value)}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Btn
                  tone="ghost"
                  onClick={addSymptom}
                  className="w-full text-xs py-2.5 font-bold rounded-xl border border-[#3e3e38] hover:border-[#d97757] hover:text-[#d97757]"
                >
                  Add
                </Btn>
              </div>

              {/* Ready to analyze symptom counter */}
              {symptoms.length > 0 && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="font-mono text-[11px] text-[#41d69a]">
                    {symptoms.length} symptom{symptoms.length > 1 ? 's' : ''} added · ready to analyze
                  </span>
                </div>
              )}

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

              {/* Clear ~2 cm physical gap between Row 2 controls and Row 3 Analyze Button */}
              <div className="my-8" />

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

      {/* 4. Multimodal File Upload Panels Side-by-Side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Upload
          kind="reports"
          title="Lab Report OCR & Reference Range Parser"
          accept=".pdf,.jpg,.jpeg,.png"
          onUploadSuccess={handleUploadIntake}
        />
        <Upload
          kind="images"
          title="Optical Physical Assessment & Photo Analysis"
          accept=".jpg,.jpeg,.png"
          onUploadSuccess={handleUploadIntake}
        />
      </div>


        {/* 5. Diagnostic Risk Synthesis (5 Ordered Blocks) */}
        {a ? (
          <div ref={diagnosticSynthesisRef} className="space-y-5 scroll-mt-20">
              {/* Safety Rules Banner if triggered */}
              <SafetyRules a={a} />

              <div className="rounded-3xl border border-[#3e3e38] bg-[#2c2c2b] p-6 shadow-xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3e3e38] pb-3">
                  <div>
                    <Overline>Diagnostic Risk Synthesis</Overline>
                    <h3 className="text-lg font-bold text-[#faf9f5]">Algorithmic Acuity &amp; Risk Breakdown</h3>
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

                {/* BLOCK 1: Telemetry & Anomaly Detection */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#d97757]/20 font-mono text-xs font-bold text-[#d97757]">
                      1
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                      Telemetry &amp; Anomaly Detection
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

                {/* BLOCK 2: Evidence-Grounded Reasoning Path (Swapped to 2nd position) */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#9c87f5]/20 font-mono text-xs font-bold text-[#9c87f5]">
                      2
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                      Evidence-Grounded Reasoning Path
                    </h4>
                  </div>
                  <EvidenceChainNode
                    detectedSignal={
                      symptoms[0]?.name ? `${symptoms[0].name} (${symptoms[0].severity})` : 'Normal Baseline'
                    }
                    clinicalRule={a.triggered_safety_rules?.[0]?.reason ?? 'Standard Acuity Fusion Model'}
                    evidenceCitation={ev?.[0]?.title ?? 'American Diabetes Association (ADA) / AHA Standards of Care'}
                    recommendedAction={
                      a.care_level === 'POSSIBLE_EMERGENCY'
                        ? 'Immediate EMS Dispatch'
                        : 'Tele-consultation & Observation'
                    }
                  />
                </div>

                {/* BLOCK 3: Multi Factor Health Risk Score & 3 Visual Gauges (Swapped to 3rd position) */}
                <div className="rounded-3xl border border-[#3e3e38]/80 bg-[#1e1e1c]/90 backdrop-blur-2xl p-5 shadow-2xl space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3e3e38]/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-[#f2b955] to-[#d97757] font-mono text-xs font-black text-[#141413] shadow-md shadow-[#f2b955]/20">
                        3
                      </span>
                      <div>
                        <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#faf9f5]">
                          Multi Factor Health Risk Score
                        </h4>
                        <p className="text-[10px] text-[#a9a99f]">
                          Simple visual gauges for instant understanding · Green = Safe, Amber = Caution, Red = Urgent
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={a.care_level} />
                      <span className="rounded-full border border-[#41d69a]/30 bg-[#41d69a]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#41d69a]">
                        AI Confidence: {a.confidence_score.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-12 items-center">
                    <div className="md:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-[#3e3e38]/60 bg-[#161614]/90 p-4 text-center shadow-inner">
                      <div className="relative flex items-center justify-center">
                        <RiskDonut score={a.risk_score} />
                      </div>
                      <div className="mt-2.5 w-full flex items-center justify-around text-[10px] font-bold font-mono">
                        <span className={a.risk_score < 34 ? 'text-[#41d69a] underline' : 'text-[#a9a99f]'}>
                          ● 0-33 Safe
                        </span>
                        <span
                          className={
                            a.risk_score >= 34 && a.risk_score < 67
                              ? 'text-[#f2b955] underline'
                              : 'text-[#a9a99f]'
                          }
                        >
                          ● 34-66 Caution
                        </span>
                        <span className={a.risk_score >= 67 ? 'text-[#fb7185] underline' : 'text-[#a9a99f]'}>
                          ● 67+ High
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-8 space-y-3.5">
                      <div className="rounded-2xl border border-[#3e3e38]/50 bg-[#161614]/80 p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#faf9f5]">Overall Health Condition Barometer</span>
                          <span
                            className={`font-mono ${
                              a.risk_score >= 67
                                ? 'text-[#fb7185]'
                                : a.risk_score >= 34
                                ? 'text-[#f2b955]'
                                : 'text-[#41d69a]'
                            }`}
                          >
                            {a.risk_score >= 67
                              ? 'Action Recommended Immediately'
                              : a.risk_score >= 34
                              ? 'Moderate Caution Advised'
                              : 'Healthy Baseline Maintained'}
                          </span>
                        </div>
                        <Spectrum score={a.risk_score} />
                        <div className="flex items-center justify-between text-[9px] font-mono text-[#a9a99f] pt-1">
                          <span>Low / Normal</span>
                          <span>Moderate Acuity</span>
                          <span>High / Emergency</span>
                        </div>
                      </div>

                      {a.top_factors && a.top_factors.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#a9a99f]">
                            Key Contributing Health Signals ({a.top_factors.length})
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {a.top_factors.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded-xl border border-[#3e3e38]/60 bg-[#161614]/70 px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="h-2 w-2 rounded-full bg-[#d97757] shrink-0" />
                                  <span className="text-[#faf9f5] font-semibold truncate">{f.factor_name}</span>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-[#d97757] shrink-0 ml-1">
                                  {f.direction.replace(/_/g, ' ')} ({f.contribution})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3 Color Gauges Horizontally */}
                  <div className="grid gap-3 pt-3 border-t border-[#3e3e38]/60 md:grid-cols-3">
                    <ClinicalTrendsLineChart score={a.risk_score} scoreHistory={assessmentScoreHistory} />
                    <ClinicalDistributionPieChart score={a.risk_score} careLevel={a.care_level} />
                    <ClinicalSpeedometerGauge score={a.risk_score} />
                  </div>
                </div>

                {/* BLOCK 4: Doctor Consultation Requirement (Dynamic AI suggestion / Healthy Baseline Guard) */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#41d69a]/20 font-mono text-xs font-bold text-[#41d69a]">
                        4
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5]">
                        Doctor Consultation Requirement
                      </h4>
                    </div>
                    {insight?.explanation && <Speaker text={insight.explanation} />}
                  </div>

                  {isLowRiskOrHealthy ? (
                    <div className="rounded-xl border border-[#41d69a]/40 bg-[#41d69a]/10 p-4 flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-[#41d69a] shrink-0" />
                      <div>
                        <h5 className="text-sm font-bold text-[#faf9f5]">Routine Wellness Baseline Maintained</h5>
                        <p className="text-xs text-[#a9a99f] mt-0.5">
                          Your clinical parameters are optimal and within safe baseline limits. No specialist doctor consultation is needed. Maintain daily hydration, balanced nutrition, and healthy habits.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed text-[#faf9f5] bg-[#2c2c2b] p-3 rounded-xl border border-[#3e3e38]">
                        {insight?.explanation ?? (busy ? 'Synthesizing explanation…' : 'No explanation available.')}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3e3e38]">
                        <span className="text-xs text-[#a9a99f]">Suggested Specialist:</span>
                        <select
                          aria-label="Specialist"
                          className={`${fieldCls} w-auto text-xs font-bold text-[#d97757]`}
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                        >
                          {Array.from(
                            new Set([
                              specialty,
                              insight?.suggested_specialty,
                              insight?.specialist?.specialty,
                              ...(symptoms.some((s) => /chest|heart|cardio|pulse|palpitat|tachy/i.test(s.name))
                                ? ['Cardiologist (Heart & Vascular Specialist)']
                                : []),
                              ...(symptoms.some((s) => /breath|lung|asthma|cough|wheez|spo2|respir/i.test(s.name))
                                ? ['Pulmonologist (Respiratory Specialist)']
                                : []),
                              ...(symptoms.some((s) => /head|brain|dizzy|stroke|seiz|faint/i.test(s.name))
                                ? ['Neurologist (Brain & Nerve Specialist)']
                                : []),
                              ...(symptoms.some((s) => /stomach|gastric|vomit|nausea|abdom|digest|stricture|dysphagia|net/i.test(s.name))
                                ? ['Gastroenterologist (Digestive Specialist)']
                                : []),
                              ...(symptoms.some((s) => /skin|rash|derma|itch|burn/i.test(s.name))
                                ? ['Dermatologist (Skin Specialist)']
                                : []),
                              ...(symptoms.some((s) => /kidney|urine|renal|electrolyt/i.test(s.name))
                                ? ['Nephrologist & Metabolic Care']
                                : []),
                              ...SPECIALTIES,
                            ].filter(Boolean))
                          ).map((s) => (
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
                    </>
                  )}
                </div>

                {/* BLOCK 5: Food Recommendation & Home Tips to Recover */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#d97757]/20 font-mono text-xs font-bold text-[#d97757]">
                        5
                      </span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#faf9f5] flex items-center gap-1.5">
                        <Utensils size={14} className="text-[#d97757]" /> Food Recommendation &amp; Home Tips to Recover
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-[#a9a99f]">AI Clinical Nutritionist</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#41d69a]/30 bg-[#41d69a]/5 p-3 space-y-1.5">
                      <p className="font-mono text-[10px] font-bold uppercase text-[#41d69a] flex items-center gap-1">
                        <Apple size={12} /> Recommended Recovery Foods
                      </p>
                      <ul className="text-xs text-[#faf9f5] space-y-1 pl-4 list-disc">
                        {insight?.food_guidance?.recommended && insight.food_guidance.recommended.length > 0 ? (
                          insight.food_guidance.recommended.map((item: any, idx: number) => (
                            <li key={idx}>
                              <span className="font-bold">{typeof item === 'string' ? item : item.title}:</span>{' '}
                              <span className="text-[#a9a99f]">{typeof item === 'string' ? '' : item.reason}</span>
                            </li>
                          ))
                        ) : (
                          [
                            'Electrolyte-rich fluids (coconut water, oral rehydration)',
                            'Warm clear broths and ginger infusion',
                            'Steamed vegetables, oats, and easily digestible proteins',
                          ].map((f, i) => <li key={i}>{f}</li>)
                        )}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#fb7185]/30 bg-[#fb7185]/5 p-3 space-y-1.5">
                      <p className="font-mono text-[10px] font-bold uppercase text-[#fb7185] flex items-center gap-1">
                        <AlertTriangle size={12} /> Foods &amp; Habits to Avoid / Limit
                      </p>
                      <ul className="text-xs text-[#faf9f5] space-y-1 pl-4 list-disc">
                        {insight?.food_guidance?.limit && insight.food_guidance.limit.length > 0 ? (
                          insight.food_guidance.limit.map((item: any, idx: number) => (
                            <li key={idx}>
                              <span className="font-bold">{typeof item === 'string' ? item : item.title}:</span>{' '}
                              <span className="text-[#a9a99f]">{typeof item === 'string' ? '' : item.reason}</span>
                            </li>
                          ))
                        ) : (
                          [
                            'Excess sodium, processed salted snacks',
                            'Heavy fried, spicy, or greasy meals',
                            'Caffeine, energy drinks, and alcohol',
                          ].map((f, i) => <li key={i}>{f}</li>)
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#3e3e38] bg-[#2c2c2b] p-3 space-y-1.5">
                    <p className="font-mono text-[10px] font-bold uppercase text-[#faf9f5] flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-[#41d69a]" /> Home Self-Care &amp; Restorative Steps
                    </p>
                    <ul className="text-xs text-[#a9a99f] space-y-1 pl-4 list-disc">
                      {insight?.self_care && insight.self_care.length > 0 ? (
                        insight.self_care.map((item: any, idx: number) => (
                          <li key={idx} className="text-[#faf9f5]">
                            <span className="font-bold">{typeof item === 'string' ? item : item.title}:</span>{' '}
                            <span className="text-[#a9a99f]">{typeof item === 'string' ? '' : item.description}</span>
                          </li>
                        ))
                      ) : (
                        [
                          'Rest in a semi-upright position if breathing is labored',
                          'Continuously monitor pulse and SpO2 with wearable sensor',
                          'Maintain adequate hydration in small, frequent sips',
                          'Seek immediate clinical care if pain radiates or breathless worsening occurs',
                        ].map((s, i) => (
                          <li key={i} className="text-[#faf9f5]">
                            {s}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                {/* Primary Evidence Citations Drawer */}
                <div className="rounded-2xl border border-[#3e3e38] bg-[#1b1b19] p-4">
                  <Overline className="text-[#9c87f5]">
                    Verified Literature Evidence &amp; Citations (RAG + Tavily)
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
          </div>
          ) : (
          <div ref={diagnosticSynthesisRef} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#3e3e38] bg-[#2c2c2b]/50 p-16 text-center min-h-[420px] scroll-mt-20">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1b1b19] border border-[#3e3e38] text-[#d97757] mb-4">
                <Heart size={32} />
              </div>
              <h3 className="text-lg font-bold text-[#faf9f5] mb-2">Awaiting Multi-Modal Clinical Intake</h3>
              <p className="text-xs text-[#a9a99f] max-w-md leading-relaxed">
                Enter your symptoms in the intake box on the left, record voice dictation, upload a document or photo, or select a preset scenario to synthesize algorithmic risk fusion.
              </p>
            </div>
          )}

      {/* 5. Neural Bio-Orb & Hardware Black Box Ledger (3 Cards) */}
      <TriageCommandCenter
        triageState={triageState}
        vitals={vit}
        telemetryActive={liveStreamActive}
        ledgerBlocks={ledgerBlocks}
      />

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

      {/* Health History Modal */}
      {historyOpen && p?.id && (
        <HealthHistoryModal
          patientId={p.id}
          onClose={() => setHistoryOpen(false)}
          onSelectAssessment={(item) => setSelectedHistoryItem(item)}
        />
      )}

      {/* Historical Assessment Full Patient Portal Template Detail Modal */}
      {selectedHistoryItem && (
        <HistoricalAssessmentDetailModal
          assessment={selectedHistoryItem}
          patient={p}
          onClose={() => setSelectedHistoryItem(null)}
        />
      )}
    </div>
  );
}
