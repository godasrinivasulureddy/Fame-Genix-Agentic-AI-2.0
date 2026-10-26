export type Role = 'PATIENT' | 'DOCTOR' | 'EMERGENCY_OPERATOR' | 'AMBULANCE_TEAM' | 'SYSTEM_ADMIN';
export type CareLevel = 'STABLE' | 'MONITOR' | 'ROUTINE_REVIEW' | 'PRIORITY_REVIEW' | 'URGENT' | 'POSSIBLE_EMERGENCY';
export type EmergencyStatus =
  | 'DETECTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'DISPATCH_REQUESTED' | 'DISPATCHED' | 'EN_ROUTE'
  | 'ON_SCENE' | 'PATIENT_REACHED' | 'TRANSPORTING' | 'HOSPITAL_REACHED' | 'COMPLETED' | 'CANCELLED';

export interface Patient {
  id: string; user_id: string; full_name: string; date_of_birth?: string; sex?: string; age?: number;
  height_cm?: number; weight_kg?: number; profile_picture_url?: string; known_conditions?: string;
  family_history?: string; emergency_contact_name?: string; emergency_contact_phone?: string;
  blood_group?: string; public_id?: string; created_at: string;
}
export interface RiskFactor { factor_name: string; contribution: number; direction: 'ELEVATES_RISK' | 'LOWERS_RISK' | 'NEUTRAL' }
export interface TriggeredSafetyRule { rule_id: string; condition: string; reason: string; forced_care_level: CareLevel }
/** vitals is NOT in the spec's RiskAssessment; optional and rendered only if the backend returns it. */
export type Vitals = Partial<Record<'heart_rate' | 'spo2' | 'respiratory_rate' | 'temperature', number>>;
export interface RiskAssessment {
  id: string; patient_id: string; risk_score: number; confidence_score: number; care_level: CareLevel;
  top_factors?: RiskFactor[]; triggered_safety_rules?: TriggeredSafetyRule[];
  active_symptoms?: Array<{ name: string; severity?: string }>; vitals?: Vitals; created_at: string;
}
export interface EmergencyCase {
  id: string; public_id?: string; patient_id: string; status: EmergencyStatus;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; patient?: Patient; assessment?: RiskAssessment;
  location?: { address?: string; latitude?: number; longitude?: number }; created_at: string; updated_at: string;
}
export interface SessionUser { id: string; email: string; role: Role }
export interface Consultation {
  id: string; token_number: string; status: string; specialty?: string; health_summary?: string;
  patient_id?: string; patient?: Patient; assessment?: RiskAssessment;
}
/** Triage queue row shape is not specified; treated as a partial assessment plus patient. */
export type TriageItem = Partial<RiskAssessment> & { patient?: Patient };
export interface Evidence { citation_id?: string; publisher?: string; title?: string; excerpt?: string; score?: number }
export interface AmbulanceBrief { case?: EmergencyCase; patient?: Patient; assessment?: RiskAssessment; vitals?: Vitals }
