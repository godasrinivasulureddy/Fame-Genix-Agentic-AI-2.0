import type {
  AmbulanceBrief, Consultation, EmergencyCase, Evidence, Patient, RiskAssessment, SessionUser, TriageItem, Vitals,
} from './types';

const BASE: string = import.meta.env.VITE_API_BASE ?? '/api/v1';
const KEY = 'fg_token';

export const tokenStore = {
  get: () => localStorage.getItem(KEY),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Unexpected error');

interface Envelope { data?: unknown; error?: unknown; detail?: unknown }

async function req<T>(path: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const headers = new Headers();
  const t = tokenStore.get();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  let body: BodyInit | undefined;
  if (opts.json !== undefined) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(opts.json); }
  if (opts.form) body = opts.form;
  const res = await fetch(`${BASE}${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  let payload: Envelope | null = null;
  try { payload = (await res.json()) as Envelope; } catch { /* non-JSON body */ }
  if (!res.ok || payload?.error) {
    const e = payload?.error ?? payload?.detail;
    const msg = typeof e === 'string' ? e : (e as { message?: string } | undefined)?.message ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return (payload && 'data' in payload ? payload.data : payload) as T;
}

const post = <T>(path: string, json?: unknown) => req<T>(path, { method: 'POST', json: json ?? {} });

/** Endpoints marked ASSUMED are named in the spec but their payloads are not; confirm against backend/app. */
export const api = {
  login: (email: string, password: string) => post<{ access_token: string }>('/auth/login', { email, password }),
  me: () => req<SessionUser>('/auth/me'),
  myPatient: () => req<Patient>('/patients/me'),
  createAssessment: (p: { symptoms: Array<{ name: string; severity: string }>; vitals: Vitals }) =>
    post<RiskAssessment>('/patients/me/assessments', p),
  requestConsultation: (p: { specialty: string; health_summary: string }) => post<Consultation>('/patients/me/consultations', p),
  insight: (assessment_id: string) => post<{ explanation?: string; suggested_specialty?: string }>('/ai/patient-insight', { assessment_id }), // ASSUMED payload
  rag: (query: string) => post<Evidence[]>('/rag/retrieve', { query }), // ASSUMED payload
  analyze: (kind: 'reports' | 'images', file: File) => {
    const form = new FormData(); form.append('file', file); // ASSUMED field name
    return req<unknown>(`/${kind}/analyze`, { form });
  },
  doctorQueue: () => req<TriageItem[]>('/doctors/queue'),
  consultationQueue: () => req<Consultation[]>('/doctors/consultations/queue'),
  startConsultation: (id: string) => post<Consultation>(`/doctors/consultations/${id}/start`),
  completeConsultation: (id: string) => post<Consultation>(`/doctors/consultations/${id}/complete`),
  logReview: (p: { patient_id: string; decision: string; note: string }) => post<unknown>('/doctors/reviews', p),
  emergencyCases: () => req<EmergencyCase[]>('/emergency/cases'),
  verifyCase: (id: string) => post<EmergencyCase>(`/emergency/cases/${id}/verify`),
  dispatchCase: (id: string) => post<EmergencyCase>(`/emergency/cases/${id}/dispatch`),
  advanceCase: (id: string) => post<EmergencyCase>(`/emergency/cases/${id}/advance`),
  ambulanceBrief: (id: string) => req<AmbulanceBrief>(`/ambulance/cases/${id}/brief`),
  sos: (p?: { latitude?: number; longitude?: number }) => post<EmergencyCase>('/emergency/cases/patient', p ?? {}),
  patientDetail: (id: string) => req<{
    patient: Patient;
    latest_assessment?: RiskAssessment;
    explanation_factors?: Array<{ factor_name: string; contribution: number; direction: string }>;
    latest_vitals?: Vitals;
    previous_reviews?: Array<{ id: string; decision: string; note: string; created_at: string }>;
    timeline?: unknown;
  }>(`/doctors/patients/${id}`),
  adminMetrics: () => req<Record<string, unknown>>('/assessments/model/metrics'),
  adminSafetyRules: () => req<{ ruleset_version: string; rules: Array<{ rule_id: string; condition: string; severity: string; reason: string }> }>('/assessments/safety/rules'),
  adminAuditLogs: (limit = 50) => req<Array<{ id: string; actor_id: string; actor_role: string; action: string; target_type: string; target_id: string; result: string; metadata: Record<string, unknown>; created_at: string }>>(`/audit/logs?limit=${limit}`),
  subscribeEvents: (onEvent: (event: string, data: unknown) => void): (() => void) => {
    const t = tokenStore.get();
    if (!t) return () => {};
    const ctrl = new AbortController();
    fetch(`${BASE}/events/stream`, {
      headers: { Authorization: `Bearer ${t}` },
      signal: ctrl.signal,
    }).then(async (res) => {
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
            try { onEvent(eventType, JSON.parse(eventData)); } catch { onEvent(eventType, eventData); }
          }
        }
      }
    }).catch(() => {});
    return () => ctrl.abort();
  },
};
