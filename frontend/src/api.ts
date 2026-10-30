import type {
  ABDMPreauthBundle,
  AmbulanceBrief,
  BluetoothDevice,
  CCTVFallAlert,
  ClinicalDossier,
  ClinicalSOAPNote,
  Consultation,
  CryptographicBlackBoxAudit,
  EmergencyCase,
  Evidence,
  FASTStrokeResult,
  GreenCorridorPreemption,
  HelmetHeatStrain,
  HospitalFacility,
  MaskBreathomicsVOCs,
  MultiAgentConsensus,
  Patient,
  PortalSettings,
  RPPGFaceVitalsResult,
  RiskAssessment,
  SessionUser,
  TabletScanResult,
  TriageItem,
  Vitals,
} from './types';

const BASE: string = import.meta.env.VITE_API_BASE ?? '/api/v1';
const KEY = 'fg_token';

export const tokenStore = {
  get: () => localStorage.getItem(KEY),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Unexpected error');

interface Envelope {
  data?: unknown;
  error?: unknown;
  detail?: unknown;
}

async function req<T>(
  path: string,
  opts: { method?: string; json?: unknown; form?: FormData } = {}
): Promise<T> {
  const headers = new Headers();
  const t = tokenStore.get();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  if (opts.form) body = opts.form;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  });
  let payload: Envelope | null = null;
  try {
    payload = (await res.json()) as Envelope;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || payload?.error) {
    const e = payload?.error ?? payload?.detail;
    const msg =
      typeof e === 'string'
        ? e
        : (e as { message?: string } | undefined)?.message ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return (payload && 'data' in payload ? payload.data : payload) as T;
}

const post = <T>(path: string, json?: unknown) => req<T>(path, { method: 'POST', json: json ?? {} });
const put = <T>(path: string, json?: unknown) => req<T>(path, { method: 'PUT', json: json ?? {} });

export const api = {
  // Authentication & Session
  login: (email: string, password: string) =>
    post<{ access_token: string; refresh_token: string }>('/auth/login', { email, password }),
  me: () => req<SessionUser>('/auth/me'),
  refreshSession: (refreshToken: string) =>
    post<{ access_token: string; refresh_token: string }>('/auth/refresh', { refresh_token: refreshToken }),

  // Patients Domain
  myPatient: () => req<Patient>('/patients/me'),
  updateMyProfile: (payload: Partial<Patient> & Record<string, unknown>) =>
    put<Patient>('/patients/me', payload),
  clinicalDossier: (patientId: string) =>
    req<ClinicalDossier>(`/patients/${patientId}/clinical-dossier`),
  createAssessment: (p: { symptoms: Array<{ name: string; severity: string }>; vitals?: Vitals }) =>
    post<RiskAssessment>('/patients/me/assessments', p),
  requestConsultation: (p: { specialty: string; health_summary: string }) =>
    post<Consultation>('/patients/me/consultations', p),
  myNotes: () => req<Array<{ id: string; note_text: string; created_at: string }>>('/patients/me/notes'),
  createNote: (note_text: string) =>
    post<{ id: string; note_text: string; created_at: string }>('/patients/me/notes', { note_text }),
  deleteNote: (id: string) => req<{ deleted_id: string }>(`/patients/me/notes/${id}`, { method: 'DELETE' }),

  // Health Summary PDF Generator
  downloadHealthPdf: async (
    patientId: string,
    opts?: { startDate?: string; endDate?: string; sections?: string }
  ) => {
    const params = new URLSearchParams();
    if (opts?.startDate) params.set('start_date', opts.startDate);
    if (opts?.endDate) params.set('end_date', opts.endDate);
    if (opts?.sections) params.set('sections', opts.sections);
    const q = params.toString() ? `?${params.toString()}` : '';
    const headers = new Headers();
    const t = tokenStore.get();
    if (t) headers.set('Authorization', `Bearer ${t}`);
    const res = await fetch(`${BASE}/patients/${patientId}/report/pdf${q}`, { headers });
    if (!res.ok) throw new ApiError(`PDF download failed (${res.status})`, res.status);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FAME_GENIX_Health_Report_${patientId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // AI & Multi-Modal Foundation
  extractSymptoms: (text: string, language = 'English') =>
    post<{ concepts: Array<{ concept: string; severity: string }>; detected_language: string }>(
      '/ai/symptoms/extract',
      { text, language }
    ),
  insight: (assessment_id: string) =>
    post<{ explanation?: string; suggested_specialty?: string }>('/ai/patient-insight', { assessment_id }),
  rag: (query: string, top_k = 4) => post<Evidence[]>('/rag/retrieve', { query, top_k }),
  analyze: (kind: 'reports' | 'images', file: File, extra?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => form.append(k, v));
    }
    return req<unknown>(`/${kind}/analyze`, { form });
  },
  chat: (payload: { message: string; conversation_id?: string; history?: Array<{ role: string; content: string }> }) =>
    post<{
      message: string;
      language: string;
      suggested_specialty?: string;
      safety_level: string;
      requires_professional_review: boolean;
    }>('/ai/chat', payload),

  // Multi-Agent Medical Society Consensus
  multiAgentConsensus: (payload: {
    symptom_text: string;
    vitals?: Record<string, number>;
    conditions?: string;
    allergies?: string;
    lab_values?: Record<string, number>;
  }) => post<MultiAgentConsensus>('/ai/multi-agent/consensus', payload),

  // Bluetooth Hardware & Edge Device Pairing
  bluetoothScan: () => req<BluetoothDevice[]>('/devices/bluetooth/scan'),
  bluetoothPair: (deviceId: string) =>
    post<{ status: string; pairing_status: string; hardware_type?: string }>(
      `/devices/bluetooth/${encodeURIComponent(deviceId)}/pair`
    ),
  bluetoothUnpair: (deviceId: string) =>
    post<{ status: string; pairing_status: string }>(
      `/devices/bluetooth/${encodeURIComponent(deviceId)}/unpair`
    ),

  // Ambient CCTV Fall Alert
  cctvFallAlert: (cctvId: string, patientId: string, confidence = 0.96) =>
    post<CCTVFallAlert>(
      `/devices/cctv/fall-alert?cctv_id=${encodeURIComponent(cctvId)}&patient_id=${encodeURIComponent(
        patientId
      )}&confidence=${confidence}`
    ),

  // Unified Portal Settings
  portalSettings: () => req<{ role: string; settings: PortalSettings }>('/settings/me'),
  updatePortalSettings: (settings: PortalSettings) =>
    put<{ status: string; role: string; updated_settings: PortalSettings; message?: string }>('/settings/me', settings),

  // Doctor CDS Domain
  doctorQueue: () => req<TriageItem[]>('/doctors/queue'),
  consultationQueue: () => req<Consultation[]>('/doctors/consultations/queue'),
  startConsultation: (id: string) => post<Consultation>(`/doctors/consultations/${id}/start`),
  completeConsultation: (id: string) => post<Consultation>(`/doctors/consultations/${id}/complete`),
  logReview: (p: { patient_id: string; decision: string; note: string; assessment_id?: string }) =>
    post<{ id: string; decision: string; created_at: string }>('/doctors/reviews', p),
  patientDetail: (id: string) =>
    req<{
      patient: Patient;
      latest_assessment?: RiskAssessment;
      explanation_factors?: Array<{ factor_name: string; contribution: number; direction: string }>;
      latest_vitals?: Vitals;
      previous_reviews?: Array<{ id: string; decision: string; note: string; created_at: string }>;
      timeline?: unknown;
    }>(`/doctors/patients/${id}`),

  // Emergency Command & Operations
  emergencyCases: () => req<EmergencyCase[]>('/emergency/cases'),
  getEmergencyCase: (id: string) => req<EmergencyCase>(`/emergency/cases/${id}`),
  verifyCase: (id: string) => post<EmergencyCase>(`/emergency/cases/${id}/verify`),
  dispatchCase: (id: string) => post<EmergencyCase>(`/emergency/cases/${id}/dispatch`),
  advanceCase: (id: string) => post<EmergencyCase>(`/emergency/cases/${id}/advance`),
  activePatientEmergency: () => req<EmergencyCase | null>('/emergency/cases/patient/active'),
  sos: (p?: { latitude?: number; longitude?: number; accuracy?: number }) =>
    post<EmergencyCase>('/emergency/cases/patient', p ?? {}),

  // Hospital Resource Allocation & Handover Passport
  hospitalGrid: () => req<HospitalFacility[]>('/emergency/hospitals/grid'),
  emergencyPassport: (caseId: string) =>
    req<{
      passport_id: string;
      case_id: string;
      status: string;
      patient: Record<string, unknown>;
      recommended_hospital?: HospitalFacility;
    }>(`/emergency/cases/${caseId}/handover-passport`),

  // Ambulance Field Response
  ambulanceAssigned: () => req<EmergencyCase[]>('/ambulance/assigned'),
  ambulanceBrief: (id: string) => req<AmbulanceBrief>(`/ambulance/cases/${id}/brief`),
  ambulanceAdvance: (id: string) => post<EmergencyCase>(`/ambulance/cases/${id}/status`),

  // Governance & Admin Console
  adminMetrics: () => req<Record<string, unknown>>('/assessments/model/metrics'),
  adminSafetyRules: () =>
    req<{
      ruleset_version: string;
      rules: Array<{ rule_id: string; condition: string; severity: string; reason: string }>;
    }>('/assessments/safety/rules'),
  adminAuditLogs: (limit = 50) =>
    req<
      Array<{
        id: string;
        actor_id: string;
        actor_role: string;
        action: string;
        target_type: string;
        target_id: string;
        result: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }>
    >(`/audit/logs?limit=${limit}`),

  // Simulator Controls
  startSimulator: (device_id: string, scenario: string) =>
    post<{ scenario: string; step: number; status: string }>('/simulator/start', { device_id, scenario }),
  stepSimulator: () =>
    post<{
      scenario: string;
      step: number;
      readings: Array<{ metric: string; value: number; unit: string }>;
      assessment: RiskAssessment;
    }>('/simulator/step'),
  stopSimulator: () => post<{ status: string }>('/simulator/stop'),

  // Real-Time Server-Sent Events
  subscribeEvents: (onEvent: (event: string, data: unknown) => void): (() => void) => {
    const t = tokenStore.get();
    if (!t) return () => {};
    const ctrl = new AbortController();
    fetch(`${BASE}/events/stream`, {
      headers: { Authorization: `Bearer ${t}` },
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            let eventType = 'message';
            let eventData = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              if (line.startsWith('data: ')) eventData = line.slice(6).trim();
            }
            if (eventData) {
              try {
                onEvent(eventType, JSON.parse(eventData));
              } catch {
                onEvent(eventType, eventData);
              }
            }
          }
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  },

  // --- Next-Gen Clinical Innovations Endpoints ---
  scanTabletCamera: (payload: { query?: string; ocr_text?: string }) =>
    post<TabletScanResult>('/patients/pharmacy/scan-tablet', payload),

  rppgFaceScan: (payload: { frames_count?: number }) =>
    post<RPPGFaceVitalsResult>('/patients/diagnostics/rppg-face-scan', payload),

  fastStrokeScreen: (payload: { facial_droop: boolean; arm_drift: boolean; slurred_speech: boolean }) =>
    post<FASTStrokeResult>('/patients/diagnostics/fast-stroke-screen', payload),

  coughAcousticScreen: (payload: { signature: string }) =>
    post<Record<string, unknown>>('/patients/diagnostics/cough-acoustic', payload),

  generateSOAPNote: (patientId: string, payload: { conversation_transcript?: string; clinician_notes?: string }) =>
    post<ClinicalSOAPNote>(`/doctors/patients/${patientId}/soap-note`, payload),

  verifyBlackBoxAudit: () =>
    req<CryptographicBlackBoxAudit>('/audit/black-box/verify'),

  getHelmetHeatStrain: (patientId: string, params?: { sodium?: number; potassium?: number; skin_temp?: number }) => {
    const q = new URLSearchParams({
      patient_id: patientId,
      sodium: String(params?.sodium ?? 48.0),
      potassium: String(params?.potassium ?? 6.2),
      skin_temp: String(params?.skin_temp ?? 38.0),
    });
    return req<HelmetHeatStrain>(`/emergency/diagnostics/helmet-heat-strain?${q.toString()}`);
  },

  getMaskBreathVOCs: (patientId: string, params?: { acetone?: number; ammonia?: number; no_ppb?: number }) => {
    const q = new URLSearchParams({
      patient_id: patientId,
      acetone: String(params?.acetone ?? 0.8),
      ammonia: String(params?.ammonia ?? 0.5),
      no_ppb: String(params?.no_ppb ?? 18.0),
    });
    return req<MaskBreathomicsVOCs>(`/emergency/diagnostics/mask-breath-vocs?${q.toString()}`);
  },

  requestGreenCorridor: (payload: { ambulance_id: string; hospital_id: string; latitude: number; longitude: number }) =>
    post<GreenCorridorPreemption>('/emergency/green-corridor', payload),

  requestABDMPreauth: (payload: { patient_id: string; diagnosis_code: string; procedure_code: string; cost_inr: number }) =>
    post<ABDMPreauthBundle>('/emergency/insurance/abdm-preauth', payload),
};
