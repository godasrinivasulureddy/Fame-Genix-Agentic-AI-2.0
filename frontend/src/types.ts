export type Role = 'PATIENT' | 'DOCTOR' | 'EMERGENCY_OPERATOR' | 'AMBULANCE_TEAM' | 'SYSTEM_ADMIN';
export type CareLevel = 'STABLE' | 'MONITOR' | 'ROUTINE_REVIEW' | 'PRIORITY_REVIEW' | 'URGENT' | 'POSSIBLE_EMERGENCY';
export type EmergencyStatus =
  | 'DETECTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'DISPATCH_REQUESTED' | 'DISPATCHED' | 'EN_ROUTE'
  | 'ON_SCENE' | 'PATIENT_REACHED' | 'TRANSPORTING' | 'HOSPITAL_REACHED' | 'COMPLETED' | 'CANCELLED';

export interface Patient {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth?: string;
  sex?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  profile_picture_url?: string;
  known_conditions?: string;
  allergies?: string;
  family_history?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  secondary_contact_name?: string;
  secondary_contact_phone?: string;
  secondary_contact_relationship?: string;
  blood_group?: string;
  public_id?: string;
  created_at: string;
}

export interface RiskFactor {
  factor_name: string;
  contribution: number;
  direction: 'ELEVATES_RISK' | 'LOWERS_RISK' | 'NEUTRAL';
}

export interface TriggeredSafetyRule {
  rule_id: string;
  condition: string;
  reason: string;
  forced_care_level: CareLevel;
}

export type Vitals = Partial<Record<'heart_rate' | 'spo2' | 'respiratory_rate' | 'temperature', number>>;

export interface RiskAssessment {
  id: string;
  patient_id: string;
  risk_score: number;
  confidence_score: number;
  care_level: CareLevel;
  top_factors?: RiskFactor[];
  triggered_safety_rules?: TriggeredSafetyRule[];
  active_symptoms?: Array<{ name: string; severity?: string }>;
  vitals?: Vitals;
  created_at: string;
}

export interface EmergencyCase {
  id: string;
  public_id?: string;
  patient_id: string;
  status: EmergencyStatus;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  patient?: Patient;
  assessment?: RiskAssessment;
  location?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    consent?: boolean;
    accuracy?: number;
    source?: string;
    address?: string;
  };
  trigger_type?: string;
  trigger_rule_id?: string;
  trigger_measurements?: Record<string, unknown>;
  measurement_quality?: string;
  simulation_status?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  sso_provider?: string;
}

export interface Consultation {
  id: string;
  token_number: string;
  status: string;
  specialty?: string;
  health_summary?: string;
  patient_id?: string;
  patient?: Patient;
  assessment?: RiskAssessment;
  risk_score?: number;
  care_level?: CareLevel;
  requested_at?: string;
}

export type TriageItem = Partial<RiskAssessment> & {
  patient?: Patient;
  id?: string;
  patient_id?: string;
};

export interface Evidence {
  citation_id?: string;
  publisher?: string;
  title?: string;
  excerpt?: string;
  score?: number;
}

export interface AmbulanceBrief {
  case?: EmergencyCase;
  patient_profile?: {
    full_name: string;
    public_id: string;
    age: number | string;
    blood_group?: string;
    height_cm?: number | string;
    weight_kg?: number | string;
  };
  incident_snapshot?: {
    reported_issue: string;
    active_symptoms: Array<{ name: string; severity?: string }>;
    red_flags: string[];
    risk_score: number;
    care_level: string;
  };
  medical_context?: {
    known_conditions: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    location_accuracy?: number;
    location_source?: string;
  };
  patient?: Patient;
  assessment?: RiskAssessment;
  vitals?: Vitals;
}

export interface BluetoothDevice {
  device_id: string;
  hardware_type: string;
  name: string;
  rssi_dbm: number;
  battery_percent: number;
  pairing_status: 'UNPAIRED' | 'PAIRING' | 'CONNECTED';
  gatt_services: string[];
}

export interface ClinicalDossier {
  patient_id: string;
  public_uhid: string;
  full_name: string;
  age?: number;
  sex?: string;
  blood_group?: string;
  registered_at: string;
  contacts: {
    primary_sos: { name?: string; phone?: string; relationship?: string };
    secondary_sos: { name?: string; phone?: string; relationship?: string };
  };
  medical_background: {
    known_conditions: string[];
    allergies: string[];
    family_history?: string;
  };
  latest_vitals_snapshot: Array<{
    metric: string;
    value: number;
    unit: string;
    quality: string;
    recorded_at: string;
  }>;
  case_history: {
    total_assessments: number;
    total_consultations: number;
    emergency_incidents: number;
    recent_consultations: Array<{
      token_number: string;
      specialty: string;
      status: string;
      risk_score?: number;
      care_level?: string;
      requested_at: string;
    }>;
    recent_emergencies: Array<{
      case_id: string;
      status: string;
      trigger_type: string;
      created_at: string;
      resolved_at?: string;
    }>;
  };
}

export interface MultiAgentConsensus {
  primary_triage_acuity: string;
  confidence_score: number;
  participating_agents: Array<{
    agent_id: string;
    agent_name: string;
    specialty: string;
    assessment: string;
    suggested_interventions: string[];
    contraindications_detected: string[];
    urgency_level: string;
  }>;
  safety_critique: {
    evaluator_passed: boolean;
    guideline_conformance: string;
    critical_concerns: string[];
    adherence_notes: string;
  };
  suggested_differential: string[];
  final_decision: string;
}

export interface HospitalFacility {
  id: string;
  name: string;
  distance_km: number;
  estimated_eta_min: number;
  trauma_level: number;
  total_icu_beds: number;
  available_icu_beds: number;
  ventilators_available: number;
  cath_lab_operational: boolean;
  stroke_team_ready: boolean;
  status: 'NORMAL' | 'WARNING' | 'SATURATED' | 'DIVERT';
}

export interface CCTVFallAlert {
  event_id: string;
  cctv_id: string;
  patient_id: string;
  confidence_score: number;
  trigger_action: string;
  timestamp: string;
}

export type PortalSettings = Record<string, unknown>;
