/* ============================================================================
   FAME-GENIX 2.0 — SIMULATED SEED DATA
   ----------------------------------------------------------------------------
   All records in this file are synthetic. No protected health information,
   no real publications, no real facilities, and no real emergency services.
   Timestamps use a fixed sandbox clock (2026-10-26T09:42:00Z) so the prototype
   is deterministic. Front-end only: there is no network layer.
   ========================================================================== */
(function () {
  'use strict';

  var SANDBOX_NOW = Date.parse('2026-10-26T09:42:00Z');

  // Deterministic pseudo-random generator: same data on every load.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Build a 24-point time series ending at SANDBOX_NOW, one sample per hour.
  function series(base, spread, seed, drift) {
    var rand = rng(seed);
    var out = [];
    for (var i = 23; i >= 0; i--) {
      var wave = Math.sin((23 - i) / 2.6) * spread * 0.5;
      var noise = (rand() - 0.5) * spread;
      var trend = drift ? ((23 - i) / 23) * drift : 0;
      out.push({
        t: new Date(SANDBOX_NOW - i * 3600000).toISOString(),
        v: Math.round((base + wave + noise + trend) * 10) / 10
      });
    }
    return out;
  }

  function at(minutesAgo) {
    return new Date(SANDBOX_NOW - minutesAgo * 60000).toISOString();
  }

  var patient = {
    id: 'FGX-P-20418',
    legalName: 'Aarav Mehta',
    preferredName: 'Aarav',
    dateOfBirth: '1987-03-14',
    ageYears: 39,
    sex: 'Male',
    bloodGroup: 'O+',
    locale: 'en-IN',
    regionCode: 'IN-TG-HYD-SIM',
    addressLabel: 'Sandbox Zone 4 · Banjara Hills Grid 12',
    contact: { phone: '+91-9XXXXXXXXX', email: 'aarav.m@example.invalid', preferredChannel: 'SMS' },
    emergencyContact: { name: 'Riya Mehta', relationship: 'Spouse', phone: '+91-9XXXXXXXXX' },
    consent: {
      id: 'CNS-7712',
      status: 'active',
      scope: ['vital_monitoring', 'risk_assessment', 'care_coordination', 'simulated_emergency'],
      grantedAt: '2026-10-20T05:20:00Z',
      expiresAt: '2027-10-20T05:20:00Z',
      revocable: true
    },
    allergies: ['Penicillin'],
    conditions: ['Mild intermittent asthma (self-reported)'],
    clinicianOfRecord: 'Dr. Isha Raman',
    simulationLabel: 'SYNTHETIC PATIENT RECORD'
  };

  var careLevels = [
    { level: 0, name: 'Baseline', description: 'Routine self-monitoring, no active review', color: 'emerald' },
    { level: 1, name: 'Routine observation', description: 'Automated trend watch, monthly clinician review', color: 'emerald' },
    { level: 2, name: 'Enhanced observation', description: 'Daily signal review, evidence-linked assessment', color: 'cyan' },
    { level: 3, name: 'Priority clinical review', description: 'Clinician review within 4 hours', color: 'amber' },
    { level: 4, name: 'Escalated care', description: 'Immediate coordination and incident workflow', color: 'rose' }
  ];

  var vitals = [
    { id: 'hr', label: 'Heart rate', short: 'HR', value: 108, unit: 'bpm', delta1h: 11, refLow: 60, refHigh: 100, status: 'watch', source: 'SIM-DEVICE/Wearable-04', quality: 'good', lastUpdated: at(1), precision: 0, history: series(92, 9, 11, 16), note: 'Sustained upward trend over 6h' },
    { id: 'spo2', label: 'Oxygen saturation', short: 'SpO₂', value: 93, unit: '%', delta1h: -3, refLow: 95, refHigh: 100, status: 'watch', source: 'SIM-DEVICE/PulseOx-02', quality: 'good', lastUpdated: at(1), precision: 0, history: series(97, 2.4, 23, -4), note: 'Below reference band for 3 consecutive samples' },
    { id: 'sbp', label: 'Blood pressure', short: 'BP', value: '128/82', unit: 'mmHg', delta1h: 4, refLow: 90, refHigh: 140, status: 'stable', source: 'SIM-DEVICE/Cuff-01', quality: 'good', lastUpdated: at(18), precision: 0, history: series(124, 8, 37, 4), note: 'Systolic only in trend' },
    { id: 'temp', label: 'Body temperature', short: 'Temp', value: 37.9, unit: '°C', delta1h: 0.4, refLow: 36.1, refHigh: 37.5, status: 'watch', source: 'SIM-DEVICE/Therm-01', quality: 'good', lastUpdated: at(6), precision: 1, history: series(37.1, 0.35, 41, 0.8), note: 'Low-grade elevation' },
    { id: 'rr', label: 'Respiratory rate', short: 'RR', value: 22, unit: '/min', delta1h: 3, refLow: 12, refHigh: 20, status: 'watch', source: 'SIM-DEVICE/Wearable-04', quality: 'fair', lastUpdated: at(1), precision: 0, history: series(17, 2.2, 53, 5), note: 'Fair signal quality — derived measurement' },
    { id: 'glucose', label: 'Blood glucose', short: 'Glucose', value: 104, unit: 'mg/dL', delta1h: -2, refLow: 70, refHigh: 140, status: 'stable', source: 'MANUAL', quality: 'unverified', lastUpdated: at(184), precision: 0, history: series(101, 12, 67, 3), note: 'Patient-entered value, not device verified' }
  ];

  var safetyRules = [
    { id: 'SR-01', name: 'Hypoxaemia escalation', condition: 'SpO₂ < 92% for 2 consecutive samples', action: 'Raise to Level 3 and notify clinician of record', severity: 'critical', enabled: true, owner: 'Clinical Safety Board', lastEvaluated: at(1), hits24h: 3, evaluation: 'pass' },
    { id: 'SR-02', name: 'Oxygen desaturation watch', condition: 'SpO₂ 92–94% with upward RR trend', action: 'Flag for priority clinical review within 4h', severity: 'high', enabled: true, owner: 'Clinical Safety Board', lastEvaluated: at(1), hits24h: 11, evaluation: 'pass' },
    { id: 'SR-03', name: 'Tachycardia + dyspnoea', condition: 'HR > 105 AND reported breathlessness', action: 'Attach evidence packet to case queue', severity: 'high', enabled: true, owner: 'Triage Engineering', lastEvaluated: at(2), hits24h: 7, evaluation: 'pass' },
    { id: 'SR-04', name: 'Chest pain fast-track', condition: 'Reported chest pain OR pressure', action: 'Immediate Level 3 review; suppress self-service advice', severity: 'critical', enabled: true, owner: 'Clinical Safety Board', lastEvaluated: at(2), hits24h: 2, evaluation: 'pass' },
    { id: 'SR-05', name: 'Stale telemetry', condition: 'No device sample for > 20 minutes', action: 'Mark feed stale; require manual confirmation', severity: 'medium', enabled: true, owner: 'Platform Reliability', lastEvaluated: at(3), hits24h: 5, evaluation: 'error' },
    { id: 'SR-06', name: 'Simulated emergency guard', condition: 'Emergency workflow triggered', action: 'Require explicit consent + label all downstream events as simulation', severity: 'critical', enabled: true, owner: 'Governance', lastEvaluated: at(4), hits24h: 1, evaluation: 'pass' },
    { id: 'SR-07', name: 'Model drift threshold', condition: 'Feature drift > 0.18 over 7 days', action: 'Freeze automated outputs; require human sign-off', severity: 'high', enabled: true, owner: 'ML Governance', lastEvaluated: at(9), hits24h: 0, evaluation: 'pass' },
    { id: 'SR-08', name: 'Evidence freshness', condition: 'Citation older than 36 months', action: 'Downgrade confidence label and request appraisal', severity: 'medium', enabled: false, owner: 'Evidence Ops', lastEvaluated: at(31), hits24h: 4, evaluation: 'pass' }
  ];

  var evidence = [
    {
      id: 'EV-1041', type: 'Clinical practice guideline', title: 'Ambulatory assessment of exertional dyspnoea in adults',
      source: 'Synthetic Clinical Guidelines Consortium (SIM)', year: 2025, identifier: 'SIM-GL-2025-041',
      doi: null, relevance: 0.91, grade: 'Moderate', verified: true,
      excerpt: 'Persistent resting tachycardia accompanied by falling oxygen saturation warrants structured clinical review and correlation with patient-reported symptoms. Pulse oximetry should be interpreted alongside signal quality and perfusion indicators.',
      limitation: 'Synthetic placeholder text created for interface demonstration. It is not a clinical recommendation and must not be used for care decisions.',
      linkedFactors: ['SpO₂ trend', 'Heart rate variability'], simulated: true
    },
    {
      id: 'EV-1042', type: 'Peer-reviewed review (simulated)', title: 'Interpreting wearable respiratory rate in outpatient monitoring',
      source: 'Journal of Synthetic Digital Health (SIM)', year: 2024, identifier: 'SIM-PMID-882140',
      doi: null, relevance: 0.84, grade: 'Low', verified: true,
      excerpt: 'Derived respiratory rate from wrist-worn photoplethysmography shows reduced agreement with capnography at rates above 20/min. Discordant readings should be confirmed with a direct measurement before escalation.',
      limitation: 'Fictional publication and identifier. No real study, journal, or patient cohort is represented.',
      linkedFactors: ['Respiratory rate 22/min'], simulated: true
    },
    {
      id: 'EV-1043', type: 'Internal safety protocol', title: 'FGX escalation matrix — Level 2 to Level 3 transition',
      source: 'FAME-GENIX Clinical Safety Board (SIM)', year: 2026, identifier: 'SIM-SOP-ESC-2.4',
      doi: null, relevance: 0.78, grade: 'Operational', verified: true,
      excerpt: 'When two or more independent signals breach their reference band, the case moves to priority clinical review even if the aggregate risk index remains in the moderate band.',
      limitation: 'Fictional internal protocol for a simulated product. Not a document from any real healthcare organisation.',
      linkedFactors: ['Two-signal breach'], simulated: true
    },
    {
      id: 'EV-1044', type: 'Observational study (simulated)', title: 'Low-grade pyrexia with normal systolic pressure in primary care',
      source: 'Synthetic Primary Care Review (SIM)', year: 2023, identifier: 'SIM-PMID-771903',
      doi: null, relevance: 0.61, grade: 'Low', verified: false,
      excerpt: 'Isolated low-grade temperature elevation was a weak predictor of short-term deterioration in the simulated cohort when other vital signs were within reference bands.',
      limitation: 'Fictional study from an earlier review cycle. Appraisal pending; exclude from autonomous decision support.',
      linkedFactors: ['Temperature 37.9°C'], simulated: true
    }
  ];

  var risk = {
    assessmentId: 'RA-90214',
    modelId: 'FGX-Risk',
    modelVersion: '2.4.1',
    computedAt: at(8),
    method: 'Additive feature attribution (simulated explainability)',
    score: 62,
    band: 'Moderate',
    bandColor: 'amber',
    confidence: 0.72,
    confidenceLabel: 'Moderate confidence · elevated uncertainty',
    horizon: '24h deterioration signal (decision support only)',
    calibration: 'Last calibration 2026-09-30 · SIM cohort only',
    disclaimer: 'This is a decision-support output, not a diagnosis. A qualified clinician must interpret these results before any care decision.',
    factors: [
      { id: 'F1', label: 'SpO₂ below reference band', detail: '93% · 3 consecutive samples', contribution: 18, direction: 'increase', evidenceIds: ['EV-1041'] },
      { id: 'F2', label: 'Heart rate upward trend', detail: '108 bpm · +11 in 1h', contribution: 14, direction: 'increase', evidenceIds: ['EV-1041', 'EV-1043'] },
      { id: 'F3', label: 'Reported breathlessness', detail: 'Patient intake · moderate severity', contribution: 12, direction: 'increase', evidenceIds: ['EV-1041'] },
      { id: 'F4', label: 'Respiratory rate elevated', detail: '22/min · fair signal quality', contribution: 9, direction: 'increase', evidenceIds: ['EV-1042'] },
      { id: 'F5', label: 'Temperature elevation', detail: '37.9°C · low-grade', contribution: 6, direction: 'increase', evidenceIds: ['EV-1044'] },
      { id: 'F6', label: 'Blood pressure stable', detail: '128/82 mmHg · no variance', contribution: -9, direction: 'decrease', evidenceIds: [] },
      { id: 'F7', label: 'No prior escalation events', detail: '180-day lookback', contribution: -6, direction: 'decrease', evidenceIds: [] }
    ],
    dataQuality: { completeness: 0.86, staleSignals: 1, simulatedSignals: true, note: 'Glucose is manual and unverified; excluded from scoring.' },
    simulated: true
  };

  var timeline = [
    { id: 'TL-1', at: at(184), actor: 'Patient', type: 'measurement', title: 'Manual glucose entry', detail: '104 mg/dL recorded · MANUAL source', status: 'recorded' },
    { id: 'TL-2', at: at(96), actor: 'System', type: 'safety', title: 'SR-02 triggered a watch', detail: 'SpO₂ 94% with rising respiratory rate', status: 'flagged' },
    { id: 'TL-3', at: at(74), actor: 'Patient', type: 'intake', title: 'Symptom intake submitted', detail: 'Breathlessness on exertion · onset 2 days ago', status: 'triaged' },
    { id: 'TL-4', at: at(51), actor: 'Dr. Isha Raman', type: 'review', title: 'Care level set to Level 2', detail: 'Enhanced observation · daily signal review', status: 'complete' },
    { id: 'TL-5', at: at(8), actor: 'FGX-Risk v2.4.1', type: 'model', title: 'Risk assessment computed', detail: 'Score 62 · Moderate · confidence 0.72', status: 'complete' }
  ];

  var cases = [
    {
      id: 'CASE-4417', patientId: 'FGX-P-20418', patientName: 'Aarav Mehta', age: 39, risk: 62, band: 'Moderate',
      careLevel: 2, priority: 'Priority', slaMinutes: 168, status: 'In review', assignedTo: 'Dr. Isha Raman',
      openedAt: at(74), chiefComplaint: 'Breathlessness on moderate exertion for 2 days',
      history: 'Mild intermittent asthma, self-reported. No prior escalation events in 180-day lookback.',
      symptoms: [
        { code: 'SIM-R06.0', label: 'Dyspnoea on exertion', severity: 6, onset: '2 days' },
        { code: 'SIM-R05', label: 'Dry cough', severity: 3, onset: '2 days' },
        { code: 'SIM-R50.9', label: 'Low-grade fever', severity: 2, onset: '1 day' }
      ],
      evidenceIds: ['EV-1041', 'EV-1042', 'EV-1043', 'EV-1044'],
      consentId: 'CNS-7712', note: null, disposition: null, decisionId: null,
      audit: [
        { at: at(74), actor: 'Triage engine', action: 'Case opened from intake', result: 'Level 2' },
        { at: at(61), actor: 'Evidence service', action: 'Attached 4 citations', result: '1 unverified' },
        { at: at(51), actor: 'Dr. Isha Raman', action: 'Accepted case', result: 'In review' }
      ]
    },
    {
      id: 'CASE-4418', patientId: 'FGX-P-20773', patientName: 'Neha Kulkarni', age: 54, risk: 81, band: 'High',
      careLevel: 3, priority: 'Urgent', slaMinutes: 42, status: 'Awaiting clinician', assignedTo: null,
      openedAt: at(29), chiefComplaint: 'Intermittent chest discomfort with light-headedness',
      history: 'Hypertension, self-reported. Two prior watch flags in 30 days.',
      symptoms: [
        { code: 'SIM-R07.4', label: 'Chest pressure', severity: 7, onset: '3 hours' },
        { code: 'SIM-R42', label: 'Light-headedness', severity: 5, onset: '3 hours' }
      ],
      evidenceIds: ['EV-1041', 'EV-1043'], consentId: 'CNS-7820', note: null, disposition: null, decisionId: null,
      audit: [ { at: at(29), actor: 'SR-04', action: 'Fast-track rule triggered', result: 'Level 3' } ]
    },
    {
      id: 'CASE-4419', patientId: 'FGX-P-20802', patientName: 'Ravi Desai', age: 67, risk: 34, band: 'Low',
      careLevel: 1, priority: 'Routine', slaMinutes: 1440, status: 'Evidence pending', assignedTo: 'Dr. Daniel Okafor',
      openedAt: at(188), chiefComplaint: 'Fatigue after travel',
      history: 'No chronic conditions on file. Device feed paused for 6 hours yesterday.',
      symptoms: [ { code: 'SIM-R53', label: 'Fatigue', severity: 3, onset: '5 days' } ],
      evidenceIds: ['EV-1042'], consentId: 'CNS-7891', note: null, disposition: null, decisionId: null,
      audit: [ { at: at(188), actor: 'Patient', action: 'Requested review', result: 'Queued' } ]
    },
    {
      id: 'CASE-4420', patientId: 'FGX-P-20844', patientName: 'Meera Iyer', age: 28, risk: 19, band: 'Low',
      careLevel: 1, priority: 'Routine', slaMinutes: 2100, status: 'In review', assignedTo: 'Dr. Isha Raman',
      openedAt: at(240), chiefComplaint: 'Headache and poor sleep',
      history: 'No chronic conditions on file.',
      symptoms: [ { code: 'SIM-R51', label: 'Headache', severity: 4, onset: '3 days' } ],
      evidenceIds: ['EV-1042'], consentId: 'CNS-7902', note: null, disposition: null, decisionId: null,
      audit: [ { at: at(240), actor: 'Patient', action: 'Submitted intake', result: 'Queued' } ]
    },
    {
      id: 'CASE-4421', patientId: 'FGX-P-20891', patientName: 'Kabir Shah', age: 45, risk: 71, band: 'High',
      careLevel: 3, priority: 'Urgent', slaMinutes: 88, status: 'In review', assignedTo: 'Dr. Daniel Okafor',
      openedAt: at(118), chiefComplaint: 'Persistent cough with elevated heart rate',
      history: 'Former smoker, self-reported.',
      symptoms: [ { code: 'SIM-R05', label: 'Persistent cough', severity: 5, onset: '6 days' } ],
      evidenceIds: ['EV-1041', 'EV-1044'], consentId: 'CNS-7923', note: null, disposition: null, decisionId: null,
      audit: [ { at: at(118), actor: 'Triage engine', action: 'Case opened', result: 'Level 3' } ]
    },
    {
      id: 'CASE-4422', patientId: 'FGX-P-20910', patientName: 'Anita Rao', age: 61, risk: 47, band: 'Moderate',
      careLevel: 2, priority: 'Priority', slaMinutes: 302, status: 'Ready to close', assignedTo: 'Dr. Isha Raman',
      openedAt: at(420), chiefComplaint: 'Ankle swelling after long flight',
      history: 'Varicose veins, self-reported.',
      symptoms: [ { code: 'SIM-R60.0', label: 'Ankle oedema', severity: 3, onset: '1 day' } ],
      evidenceIds: ['EV-1043'], consentId: 'CNS-7940', note: 'Signals stable over 12h observation. Recommend routine follow-up.', disposition: 'Monitor', decisionId: 'DEC-3381',
      audit: [ { at: at(96), actor: 'Dr. Isha Raman', action: 'Signed decision', result: 'Monitor' } ]
    },
    {
      id: 'CASE-4423', patientId: 'FGX-P-20933', patientName: 'Sana Qureshi', age: 33, risk: 27, band: 'Low',
      careLevel: 1, priority: 'Routine', slaMinutes: 2600, status: 'In review', assignedTo: 'Dr. Daniel Okafor',
      openedAt: at(310), chiefComplaint: 'Intermittent palpitations',
      history: 'No chronic conditions on file. Caffeine intake noted.',
      symptoms: [ { code: 'SIM-R00.2', label: 'Palpitations', severity: 3, onset: '4 days' } ],
      evidenceIds: ['EV-1041'], consentId: 'CNS-7961', note: null, disposition: null, decisionId: null,
      audit: [ { at: at(310), actor: 'Patient', action: 'Submitted intake', result: 'Queued' } ]
    }
  ];

  var incidentStages = ['Reported', 'Verified', 'Dispatch requested', 'Unit assigned', 'En route', 'On scene', 'Resolved'];

  var incidents = [
    {
      id: 'INC-2026-1048', type: 'Breathing difficulty — simulated', severity: 'High', status: 'En route', stageIndex: 4,
      location: 'Sandbox Zone 4 · Banjara Hills Grid 12', grid: 'G12-SE', caller: 'Patient self-report (app)',
      reportedAt: at(17), patientId: 'FGX-P-20418', patientName: 'Aarav Mehta', channel: 'In-app emergency button',
      coords: { patient: { x: 186, y: 176 }, unit: { x: 306, y: 252 }, hospital: { x: 520, y: 92 } },
      assignedUnit: 'AMB-07', consentVerified: true, simulated: true,
      protocol: [
        { id: 'P1', label: 'Caller identity and callback number confirmed', done: true, rule: 'SR-06' },
        { id: 'P2', label: 'Exact location verified against patient profile', done: true, rule: 'SR-06' },
        { id: 'P3', label: 'Simulation status disclosed on all outbound messages', done: true, rule: 'SR-06' },
        { id: 'P4', label: 'Consent for simulated emergency workflow recorded', done: true, rule: 'SR-06' },
        { id: 'P5', label: 'Unit capability matched to incident type', done: false, rule: 'OPS-2' },
        { id: 'P6', label: 'Receiving facility pre-alert acknowledged', done: false, rule: 'OPS-4' }
      ],
      comms: [
        { at: at(17), from: 'Patient app', text: 'Simulated emergency request received from patient profile.', kind: 'inbound' },
        { at: at(15), from: 'Operator M. Sen', text: 'Incident verified. Simulation label applied to all downstream events.', kind: 'internal' },
        { at: at(12), from: 'Dispatch', text: 'AMB-07 assigned. ETA 9 min to scene.', kind: 'outbound' },
        { at: at(4), from: 'AMB-07', text: 'Departed scene. Patient stable, supplemental O₂ by simulated protocol.', kind: 'inbound' }
      ],
      log: [
        { at: at(17), label: 'Reported', actor: 'Patient app' }, { at: at(15), label: 'Verified', actor: 'Operator M. Sen' },
        { at: at(13), label: 'Dispatch requested', actor: 'Operator M. Sen' }, { at: at(12), label: 'Unit assigned', actor: 'Dispatch' },
        { at: at(9), label: 'En route', actor: 'AMB-07' }
      ]
    },
    {
      id: 'INC-2026-1047', type: 'Fall with minor injury — simulated', severity: 'Medium', status: 'Unit assigned', stageIndex: 3,
      location: 'Sandbox Zone 2 · Jubilee Hills Grid 07', grid: 'G07-NW', caller: 'Caregiver (phone)',
      reportedAt: at(34), patientId: 'FGX-P-20773', patientName: 'Neha Kulkarni', channel: 'Voice line (simulated)',
      coords: { patient: { x: 120, y: 108 }, unit: { x: 210, y: 162 }, hospital: { x: 520, y: 92 } },
      assignedUnit: 'AMB-02', consentVerified: true, simulated: true,
      protocol: [
        { id: 'P1', label: 'Caller identity and callback number confirmed', done: true, rule: 'SR-06' },
        { id: 'P2', label: 'Exact location verified against patient profile', done: true, rule: 'SR-06' },
        { id: 'P3', label: 'Simulation status disclosed on all outbound messages', done: true, rule: 'SR-06' },
        { id: 'P4', label: 'Consent for simulated emergency workflow recorded', done: true, rule: 'SR-06' },
        { id: 'P5', label: 'Unit capability matched to incident type', done: true, rule: 'OPS-2' },
        { id: 'P6', label: 'Receiving facility pre-alert acknowledged', done: false, rule: 'OPS-4' }
      ],
      comms: [ { at: at(34), from: 'Caregiver', text: 'Reported fall, patient conscious.', kind: 'inbound' } ],
      log: [ { at: at(34), label: 'Reported', actor: 'Caregiver' }, { at: at(32), label: 'Verified', actor: 'Operator K. Roy' }, { at: at(29), label: 'Dispatch requested', actor: 'Operator K. Roy' }, { at: at(27), label: 'Unit assigned', actor: 'Dispatch' } ]
    },
    {
      id: 'INC-2026-1046', type: 'Chest discomfort — simulated', severity: 'High', status: 'On scene', stageIndex: 5,
      location: 'Sandbox Zone 6 · Gachibowli Grid 21', grid: 'G21-SW', caller: 'Family member (app)',
      reportedAt: at(58), patientId: 'FGX-P-20891', patientName: 'Kabir Shah', channel: 'In-app emergency button',
      coords: { patient: { x: 398, y: 228 }, unit: { x: 398, y: 228 }, hospital: { x: 520, y: 92 } },
      assignedUnit: 'AMB-11', consentVerified: true, simulated: true,
      protocol: [ { id: 'P1', label: 'Caller identity and callback number confirmed', done: true, rule: 'SR-06' }, { id: 'P2', label: 'Exact location verified against patient profile', done: true, rule: 'SR-06' }, { id: 'P3', label: 'Simulation status disclosed on all outbound messages', done: true, rule: 'SR-06' }, { id: 'P4', label: 'Consent for simulated emergency workflow recorded', done: true, rule: 'SR-06' }, { id: 'P5', label: 'Unit capability matched to incident type', done: true, rule: 'OPS-2' }, { id: 'P6', label: 'Receiving facility pre-alert acknowledged', done: false, rule: 'OPS-4' } ],
      comms: [ { at: at(20), from: 'AMB-11', text: 'On scene. Assessment in progress (simulated).', kind: 'inbound' } ],
      log: [ { at: at(58), label: 'Reported', actor: 'Family member' }, { at: at(55), label: 'Verified', actor: 'Operator M. Sen' }, { at: at(53), label: 'Dispatch requested', actor: 'Operator M. Sen' }, { at: at(51), label: 'Unit assigned', actor: 'Dispatch' }, { at: at(44), label: 'En route', actor: 'AMB-11' }, { at: at(20), label: 'On scene', actor: 'AMB-11' } ]
    },
    {
      id: 'INC-2026-1045', type: 'Device signal loss — simulated', severity: 'Low', status: 'Resolved', stageIndex: 6,
      location: 'Sandbox Zone 1 · Secunderabad Grid 03', grid: 'G03-NE', caller: 'Automated rule SR-05',
      reportedAt: at(212), patientId: 'FGX-P-20802', patientName: 'Ravi Desai', channel: 'Telemetry watchdog',
      coords: { patient: { x: 288, y: 64 }, unit: { x: 288, y: 64 }, hospital: { x: 520, y: 92 } },
      assignedUnit: null, consentVerified: true, simulated: true,
      protocol: [ { id: 'P1', label: 'Caller identity and callback number confirmed', done: true, rule: 'SR-05' }, { id: 'P2', label: 'Exact location verified against patient profile', done: true, rule: 'SR-05' }, { id: 'P3', label: 'Simulation status disclosed on all outbound messages', done: true, rule: 'SR-06' }, { id: 'P4', label: 'Consent for simulated emergency workflow recorded', done: true, rule: 'SR-06' }, { id: 'P5', label: 'Unit capability matched to incident type', done: true, rule: 'OPS-2' }, { id: 'P6', label: 'Receiving facility pre-alert acknowledged', done: true, rule: 'OPS-4' } ],
      comms: [ { at: at(190), from: 'System', text: 'Device feed recovered. False positive closed.', kind: 'internal' } ],
      log: [ { at: at(212), label: 'Reported', actor: 'Rule SR-05' }, { at: at(205), label: 'Verified', actor: 'Operator K. Roy' }, { at: at(190), label: 'Resolved', actor: 'Operator K. Roy' } ]
    }
  ];

  var units = [
    { id: 'AMB-07', type: 'Advanced life support', crew: ['R. Nair', 'T. Ahmed'], status: 'En route', etaMinutes: 9, capability: 'O₂ · Monitoring · Paramedic', zone: 'Zone 4', selected: true },
    { id: 'AMB-02', type: 'Basic life support', crew: ['S. Paul', 'D. Verma'], status: 'Assigned', etaMinutes: 14, capability: 'O₂ · First response', zone: 'Zone 2', selected: false },
    { id: 'AMB-11', type: 'Advanced life support', crew: ['A. Rao', 'M. Khan'], status: 'On scene', etaMinutes: 0, capability: 'O₂ · Monitoring · Paramedic', zone: 'Zone 6', selected: false },
    { id: 'AMB-04', type: 'Basic life support', crew: ['P. Bose', 'L. Dutta'], status: 'Available', etaMinutes: 6, capability: 'O₂ · First response', zone: 'Zone 4', selected: false },
    { id: 'AMB-09', type: ' neonatal transfer', crew: ['K. Iyer', 'S. Menon'], status: 'Unavailable', etaMinutes: null, capability: 'Specialist transfer', zone: 'Zone 8', selected: false, disabledReason: 'Off-shift · maintenance' },
    { id: 'AMB-15', type: 'Advanced life support', crew: ['F. Ali', 'N. Roy'], status: 'Available', etaMinutes: 12, capability: 'O₂ · Monitoring · Paramedic', zone: 'Zone 5', selected: false }
  ];

  var transit = {
    unitId: 'AMB-07', incidentId: 'INC-2026-1048', patientId: 'FGX-P-20418', patientName: 'Aarav Mehta',
    crew: ['R. Nair (Paramedic)', 'T. Ahmed (Driver)'],
    departedAt: at(4), etaMinutes: 9, progress: 0.42, signal: 'live',
    destination: { name: 'Sandbox Receiving Facility — North (SIM)', bay: 'Bay 3 · Observation', contact: 'Desk +91-9XXXXXXXXX', distanceKm: 5.8, preAlert: 'sent', preAlertAt: at(3), acknowledgedAt: null },
    waveform: { label: 'ECG trace (simulated)', rate: 108, rhythm: 'Sinus tachycardia pattern (simulated)', gain: '10 mm/mV', speed: '25 mm/s' },
    telemetry: [
      { id: 'hr', label: 'Heart rate', value: 108, unit: 'bpm', delta: 3, status: 'watch' },
      { id: 'spo2', label: 'SpO₂', value: 94, unit: '%', delta: 1, status: 'watch' },
      { id: 'sbp', label: 'BP', value: '126/80', unit: 'mmHg', delta: -2, status: 'stable' },
      { id: 'rr', label: 'Respiratory rate', value: 21, unit: '/min', delta: -1, status: 'watch' }
    ],
    stages: [
      { label: 'At scene', at: at(12), state: 'complete' },
      { label: 'Departed', at: at(4), state: 'complete' },
      { label: 'In transit', at: at(1), state: 'active' },
      { label: 'Arrival', at: null, state: 'pending' },
      { label: 'Handoff', at: null, state: 'pending' }
    ],
    sbar: [
      { id: 'S', label: 'Situation', detail: 'Simulated breathing difficulty, moderate severity.', done: true },
      { id: 'B', label: 'Background', detail: 'Mild asthma history, 2-day exertional dyspnoea.', done: true },
      { id: 'A', label: 'Assessment', detail: 'SpO₂ 94% on simulated O₂, HR 108, alert.', done: false },
      { id: 'R', label: 'Recommendation', detail: 'Observation bay, clinician review within 15 min.', done: false }
    ],
    interventions: ['Supplemental O₂ (simulated)', 'Continuous monitoring', 'IV access — not performed (simulation)'],
    log: [
      { at: at(12), label: 'Unit on scene', actor: 'AMB-07' },
      { at: at(4), label: 'Departed scene', actor: 'AMB-07' },
      { at: at(3), label: 'Pre-alert sent to receiving facility', actor: 'R. Nair' },
      { at: at(1), label: 'Telemetry stream attached', actor: 'System' }
    ],
    simulated: true
  };

  var metrics = {
    updatedAt: at(1),
    kpis: [
      { id: 'cases', label: 'Active cases', value: '1,284', delta: '+4.2%', direction: 'up', tone: 'neutral', sub: 'vs. 7d mean', spark: [22, 25, 23, 28, 27, 31, 29, 34, 33, 36, 38, 41] },
      { id: 'latency', label: 'Assessment p95', value: '412 ms', delta: '−38 ms', direction: 'down', tone: 'emerald', sub: 'target < 600 ms', spark: [48, 46, 44, 47, 43, 41, 42, 40, 38, 39, 36, 34] },
      { id: 'escalations', label: 'Escalations / 1k', value: '18.6', delta: '+1.4', direction: 'up', tone: 'amber', sub: 'within control band', spark: [16, 17, 16, 18, 17, 19, 18, 20, 19, 20, 19, 21] },
      { id: 'evidence', label: 'Evidence coverage', value: '94.1%', delta: '+0.8%', direction: 'up', tone: 'emerald', sub: 'cases with citations', spark: [88, 89, 89, 90, 91, 91, 92, 92, 93, 93, 94, 94] },
      { id: 'sla', label: 'Incident SLA', value: '97.3%', delta: '−0.6%', direction: 'down', tone: 'amber', sub: 'simulated drills', spark: [99, 98, 99, 98, 98, 97, 98, 97, 97, 98, 97, 97] },
      { id: 'consent', label: 'Consent valid', value: '99.8%', delta: '0.0%', direction: 'flat', tone: 'neutral', sub: 'of active records', spark: [100, 100, 99, 100, 100, 100, 99, 100, 100, 100, 100, 100] }
    ],
    volume: {
      labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
      cases: [42, 36, 31, 38, 54, 71, 84, 78, 92, 88, 69, 58],
      escalations: [6, 5, 4, 5, 8, 11, 14, 12, 17, 15, 10, 8]
    },
    segments: [
      { label: '18–34', value: 0.88, target: 0.85, tone: 'violet' },
      { label: '35–49', value: 0.84, target: 0.85, tone: 'amber' },
      { label: '50–64', value: 0.79, target: 0.85, tone: 'amber' },
      { label: '65+', value: 0.72, target: 0.85, tone: 'rose' },
      { label: 'Sparse data', value: 0.61, target: 0.80, tone: 'rose' }
    ],
    auditEventsToday: 14820, integrityLastCheck: at(46)
  };

  var models = [
    { id: 'FGX-Risk', version: '2.4.1', purpose: 'Deterioration signal scoring', status: 'Production', deployedAt: '2026-09-30T00:00:00Z', drift: 0.09, coverage: 0.94, approval: 'CSB-2026-091', owner: 'ML Governance', action: 'rollback' },
    { id: 'FGX-Triage', version: '1.9.0', purpose: 'Intake structuring', status: 'Production', deployedAt: '2026-10-04T00:00:00Z', drift: 0.07, coverage: 0.98, approval: 'CSB-2026-094', owner: 'Triage Engineering', action: 'rollback' },
    { id: 'FGX-Evidence', version: '3.0.2', purpose: 'Citation retrieval', status: 'Production', deployedAt: '2026-10-11T00:00:00Z', drift: 0.12, coverage: 0.91, approval: 'CSB-2026-099', owner: 'Evidence Ops', action: 'rollback' },
    { id: 'FGX-Risk', version: '2.5.0-rc1', purpose: 'Deterioration signal scoring', status: 'Candidate', deployedAt: null, drift: 0.04, coverage: 0.63, approval: 'PENDING', owner: 'ML Governance', action: 'review' },
    { id: 'FGX-Forecast', version: '0.8.4', purpose: 'Capacity forecast', status: 'Suspended', deployedAt: '2026-08-18T00:00:00Z', drift: 0.23, coverage: 0.42, approval: 'REVOKED', owner: 'Platform Reliability', action: 'review' }
  ];

  var audit = [
    { id: 'AUD-91823', at: at(2), actor: 'operator.msen', role: 'Emergency operator', action: 'INCIDENT_STATUS_CHANGED', resource: 'INC-2026-1048', outcome: 'success', hash: '8f2a…c91d', verified: true },
    { id: 'AUD-91822', at: at(6), actor: 'model.fgx-risk', role: 'Service account', action: 'RISK_ASSESSMENT_CREATED', resource: 'RA-90214', outcome: 'success', hash: 'b71d…4e02', verified: true },
    { id: 'AUD-91821', at: at(9), actor: 'dr.iraman', role: 'Doctor', action: 'CASE_ACCEPTED', resource: 'CASE-4417', outcome: 'success', hash: '3ca8…77f1', verified: true },
    { id: 'AUD-91820', at: at(14), actor: 'patient.20418', role: 'Patient', action: 'CONSENT_SCOPE_READ', resource: 'CNS-7712', outcome: 'success', hash: 'de40…9b13', verified: true },
    { id: 'AUD-91819', at: at(21), actor: 'rule.sr-05', role: 'Safety rule', action: 'TELEMETRY_STALE_DETECTED', resource: 'FGX-P-20802', outcome: 'error', hash: null, verified: false },
    { id: 'AUD-91818', at: at(33), actor: 'admin.kroy', role: 'Administrator', action: 'SAFETY_RULE_DISABLED', resource: 'SR-08', outcome: 'success', hash: 'aa91…0c45', verified: true },
    { id: 'AUD-91817', at: at(48), actor: 'evidence.service', role: 'Service account', action: 'CITATION_APPRAISAL_REQUESTED', resource: 'EV-1044', outcome: 'success', hash: '7e12…b0aa', verified: true },
    { id: 'AUD-91816', at: at(72), actor: 'dr.dokafor', role: 'Doctor', action: 'DECISION_SIGNED', resource: 'DEC-3380', outcome: 'success', hash: 'c0f7…3d68', verified: true }
  ];

  window.FGX_DATA = {
    meta: {
      product: 'FAME-GENIX', version: '2.0.0-rc.4', environment: 'SANDBOX',
      dataClassification: 'SIMULATED / SYNTHETIC', sandboxNow: new Date(SANDBOX_NOW).toISOString(),
      region: 'IN-TG-HYD-SIM',
      notice: 'All records are synthetic. No real patient data. No real clinical evidence. No connection to emergency services.',
      workstationTarget: '1440px+',
      simulated: true
    },
    patient: patient, careLevels: careLevels, vitals: vitals, safetyRules: safetyRules,
    evidence: evidence, risk: risk, timeline: timeline, cases: cases,
    incidents: incidents, incidentStages: incidentStages, units: units, transit: transit,
    metrics: metrics, models: models, audit: audit,
    consultation: {
      id: 'CONS-2209', caseId: 'CASE-4417', requestedBy: 'FGX-P-20418', status: 'Scheduled',
      clinician: 'Dr. Isha Raman', slot: '2026-10-26T11:00:00Z', mode: 'Video (simulated)',
      reason: 'Review of breathlessness and falling oxygen saturation', consentId: 'CNS-7712'
    },
    reports: []
  };
})();
