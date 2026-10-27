
/* ============================================================================
   FAME-GENIX 2.0 — Workspace views
   ========================================================================== */

/* ------------------------------------------------------- shared fragments --- */
function screenHead(opts) {
  return '<div class="screen-head"><div>' +
    '<div class="eyebrow">' + esc(opts.eyebrow) + '</div>' +
    '<h1 class="screen-title">' + esc(opts.title) + '</h1>' +
    '<p class="subhead">' + esc(opts.sub) + '</p>' +
    (opts.meta ? '<div class="head-meta">' + opts.meta + '</div>' : '') +
    '</div><div class="head-actions">' + (opts.actions || '') + '</div></div>';
}
function notice(tone, title, text, actions) {
  return '<div class="notice tone-' + tone + '">' + icon(tone === 'rose' ? 'alert' : tone === 'emerald' ? 'check' : 'info') +
    '<div>' + (title ? '<span class="notice-title">' + title + '</span>' : '') + text + '</div>' +
    (actions ? '<div class="notice-actions">' + actions + '</div>' : '') + '</div>';
}
function severityTag(sev) {
  var t = sev === 'High' || sev === 'Urgent' || sev === 'Critical' ? 'rose' : sev === 'Medium' || sev === 'Priority' ? 'amber' : 'emerald';
  return tag(sev.toUpperCase(), t);
}
function statusTag(status) {
  var t = /Resolved|Ready to close|Available|Production|complete/i.test(status) ? 'emerald'
    : /Urgent|On scene|En route|Error|Failed/i.test(status) ? 'rose'
    : /In review|Scheduled|Candidate|Assigned|Pending/i.test(status) ? 'amber' : 'cyan';
  return tag(status.toUpperCase(), t);
}
function vitalStatusTag(v) {
  return '<span class="vital-status ' + (v.status === 'stable' ? 'tone-emerald' : 'tone-amber') + '">' +
    dot(v.status === 'stable' ? 'emerald' : 'amber') + (v.status === 'stable' ? 'STABLE' : 'WATCH') + '</span>';
}
function patientStrip() {
  var p = D.patient, lv = D.careLevels[2];
  return '<div class="patient-strip">' +
    '<div class="strip-cell primary"><div class="lbl">PATIENT IDENTITY · SYNTHETIC</div><div class="val">' + esc(p.legalName) + '</div><div class="sub">' + esc(p.id) + ' · ' + esc(p.simulationLabel) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">AGE / SEX</div><div class="val">' + p.ageYears + ' yrs · ' + esc(p.sex) + '</div><div class="sub">Blood group ' + esc(p.bloodGroup) + ' · DOB ' + esc(p.dateOfBirth) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">REGION / LOCALE</div><div class="val mono">' + esc(p.regionCode) + '</div><div class="sub">' + esc(p.addressLabel) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">CARE LEVEL</div><div class="val"><span class="level-badge tone-' + lv.color + '"><span class="lvl">L' + lv.level + '</span> ' + esc(lv.name) + '</span></div><div class="sub">Set by ' + esc(p.clinicianOfRecord) + ' · ' + ago(D.timeline[3].at) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">CONSENT</div><div class="val"><span class="tone-emerald" style="display:inline-flex;align-items:center;gap:6px;color:var(--emerald)">' + dot('emerald') + esc(p.consent.status.toUpperCase()) + '</span></div><div class="sub mono">' + esc(p.consent.id) + ' · 4 scopes</div></div>' +
    '<div class="strip-cell"><div class="lbl">LAST SIGNAL SYNC</div><div class="val mono">' + isoTime(new Date(S.patient.telemetry.lastSync).toISOString()) + '</div><div class="sub">' + (S.patient.telemetry.error ? 'FEED ERROR · CACHED' : S.patient.telemetry.live ? 'LIVE SIMULATED FEED' : 'STREAM PAUSED') + ' · ' + ago(new Date(S.patient.telemetry.lastSync).toISOString()) + '</div></div>' +
    '</div>';
}

/* ==========================================================================
   01 — PATIENT INTAKE & RISK MONITORING
   ========================================================================== */
function viewPatient() {
  var i = S.patient.intake, t = S.patient.telemetry, r = S.patient.risk;
  var head = screenHead({
    eyebrow: 'WORKSPACE 01 / PATIENT',
    title: 'Patient intake & risk monitoring',
    sub: 'Structured symptom intake, longitudinal signal review, and explainable decision support — all within an explicitly simulated record.',
    meta: '<span>' + tag('SANDBOX RECORD', 'amber') + '</span><span>' + tag('LEVEL 2 · ENHANCED OBSERVATION', 'cyan') + '</span><span class="sep"></span><span>CLINICIAN OF RECORD: ' + esc(D.patient.clinicianOfRecord.toUpperCase()) + '</span><span class="sep"></span><span>SANDBOX CLOCK ' + isoTime(D.meta.sandboxNow) + '</span>',
    actions: btn('Export summary', 'export-summary', { cls: 'ghost optional', icon: 'download' }) +
      btn('Request consultation', 'open-consult', { cls: 'violet', icon: 'send' }) +
      btn('Simulate emergency', 'open-emergency', { cls: 'danger', icon: 'zap' })
  });

  var topNotice = notice('amber', 'SIMULATED PATIENT RECORD · NOT CLINICAL CARE',
    '<b>All patient identity, measurements, reports, citations, and risk outputs on this screen are synthetic.</b> Risk results are decision-support outputs, not a diagnosis. No clinician or emergency service is contacted.');

  /* left: intake form + safety rules */
  var symptomOptions = ['Breathlessness', 'Dry cough', 'Fever', 'Chest discomfort', 'Fatigue', 'Dizziness'];
  var canSubmit = i.description.trim().length >= 12 && i.status !== 'loading';
  var intakeBody = '';
  if (i.status === 'success') {
    intakeBody = stateBox({ tone: 'emerald', icon: 'check', title: 'Intake ' + esc(i.recordId) + ' submitted', sub: 'Structured record written to the simulated timeline. Safety rules SR-02 and SR-03 were evaluated.' });
    intakeBody += '<div class="mini-list mt-16">' +
      statRow('Chief description', i.description.slice(0, 46) + (i.description.length > 46 ? '…' : '')) +
      statRow('Onset', i.onset) + statRow('Severity', i.severity + ' / 10') +
      statRow('Reported symptoms', i.symptoms.join(', ') || 'None') +
      statRow('Measurements', 'HR ' + i.measurements.hr + ' · SpO₂ ' + i.measurements.spo2 + ' · Temp ' + i.measurements.temp) +
      statRow('Reports', S.patient.reports.length ? S.patient.reports.length + ' attached' : 'None attached') + '</div>' +
      '<div class="btn-row mt-16">' + btn('Start new intake', 'intake-reset', { cls: 'primary' }) + btn('View doctor queue', 'nav-doctor-cases', { cls: 'ghost' }) + '</div>';
  } else if (i.status === 'error') {
    intakeBody = stateBox({ tone: 'rose', icon: 'x', title: 'Intake could not be saved', sub: 'Simulated error E-INT-503: triage service timed out. Your draft is preserved below; nothing was written to the record.', actions: btn('Retry', 'intake-submit', { cls: 'tiny' }) + btn('Reset', 'intake-reset', { cls: 'tiny ghost' }) });
    intakeBody += intakeFormFields(i, symptomOptions);
  } else {
    intakeBody = intakeFormFields(i, symptomOptions);
    intakeBody += '<div class="divider"></div>' +
      '<div class="field-label">Attached reports <span class="hint">optional · synthetic</span></div>' +
      (S.patient.reports.length
        ? S.patient.reports.map(function (f) {
            return '<div class="file-row">' + icon('file') + '<span class="fname">' + esc(f.name) + '</span>' + tag(f.id, 'violet') + tag('PARSED', 'emerald') + '</div>';
          }).join('')
        : '<div class="upload-zone" role="button" tabindex="0" data-action="open-upload">' + icon('upload') +
          '<div class="uz-title">No reports attached</div><div class="uz-sub">PDF / CSV · SYNTHETIC DOCUMENTS ONLY</div></div>') +
      (S.patient.reports.length ? '<div class="btn-row mt-8">' + btn('Attach another', 'open-upload', { cls: 'ghost tiny', icon: 'plus' }) + '</div>' : '') +
      '<div class="notice tone-rose mt-12" style="margin-bottom:0;padding:8px 10px">' + icon('alert') +
      '<div style="font-size:10.5px"><b>Real emergency?</b> Use your local emergency number. This screen cannot contact emergency services.</div></div>' +
      '<div class="btn-row mt-12">' +
      btn(i.status === 'loading' ? 'Submitting intake…' : 'Submit intake record', 'intake-submit', { cls: 'primary', disabled: !canSubmit, loading: i.status === 'loading' }) +
      btn('Simulate error', 'intake-fail', { cls: 'ghost tiny' }) + '</div>' +
      '<div class="form-hint" data-intake-hint>' + (i.description.trim().length >= 12
        ? 'Ready to submit · evaluated against 8 safety rules.'
        : 'Disabled: enter at least 12 characters in the description to enable submission.') + '</div>';
  }

  var intakePanel = panel({ title: 'Structured symptom intake', idx: 'INTAKE', tone: 'cyan',
    meta: tag('STEP 1 OF 3', 'muted'), body: intakeBody,
    foot: '<span>' + icon('lock') + ' Consent ' + esc(D.patient.consent.id) + ' covers this intake.</span>' + tag('NOT A DIAGNOSIS', 'violet') });

  var rulesBody = D.safetyRules.slice(0, 4).map(function (r) {
    return '<div class="rule-item"><div class="rule-top"><span class="rule-id">' + esc(r.id) + '</span>' +
      '<span class="rule-name">' + esc(r.name) + '</span>' + dot(r.severity === 'critical' ? 'rose' : 'amber') + '</div>' +
      '<div class="rule-cond">IF ' + esc(r.condition) + '</div>' +
      '<div class="rule-action"><b>→</b> ' + esc(r.action) + '</div></div>';
  }).join('') +
    '<div class="callout tone-amber mt-12"><b>Rule engine is advisory.</b> Rules route records for human review; they do not determine a clinical outcome. 8 rules are configured, 7 enabled.</div>';
  var rulesPanel = panel({ title: 'Active safety rules', idx: 'SAFETY', tone: 'amber',
    actions: btn('View all 8', 'goto-admin-rules', { cls: 'ghost tiny' }), body: rulesBody });

  /* middle: vitals + trend + timeline */
  var feedHealthy = !t.error;
  var vitalRows = D.vitals.map(function (v) {
    var vals = v.history.map(function (h) { return h.v; });
    var tone = v.status === 'stable' ? 'emerald' : 'amber';
    return '<tr class="clickable" data-action="vital-detail" data-arg="' + v.id + '" title="Open 24h signal history">' +
      '<td><div class="strong">' + esc(v.label) + '</div><div class="cell-meta">' + esc(v.short) + ' · ' + v.history.length + ' samples</div></td>' +
      '<td><span class="vital-val" data-vital-value="' + v.id + '">' + esc(v.value) + '</span><span class="unit">' + esc(v.unit) + '</span>' +
        (t.error && v.source !== 'MANUAL' ? '<div class="cell-meta c-amber">CACHED VALUE</div>' : '') + '</td>' +
      '<td><span class="mono ' + (v.delta1h > 0 ? 'trend-up' : v.delta1h < 0 ? 'trend-down' : 'trend-flat') + '" data-vital-delta="' + v.id + '">' +
        (v.delta1h > 0 ? '+' : '') + v.delta1h + '</span><div class="cell-meta">/ 1h</div></td>' +
      '<td><span data-vital-spark="' + v.id + '">' + sparkline(vals, tone) + '</span></td>' +
      '<td class="mono nowrap">' + (typeof v.refLow === 'number' ? v.refLow + '–' + v.refHigh : '—') + '</td>' +
      '<td><div class="mono fs-10">' + esc(v.source.replace('SIM-DEVICE/', '')) + '</div>' + vitalStatusTag(v) + '</td>' +
      '<td>' + tag(v.quality, v.quality === 'good' ? 'emerald' : 'amber') + '</td></tr>';
  }).join('');

  var vitalsBody = (t.error ? stateBox({ tone: 'rose', icon: 'x', title: 'Telemetry feed unavailable', sub: 'Simulated device gateway E-FEED-12 timed out. Showing last cached samples from ' + isoTime(new Date(t.lastSync).toISOString()) + '.', actions: btn('Retry connection', 'telemetry-retry', { cls: 'tiny' }) }) + '<div class="mt-12"></div>' : '') +
    '<div class="table-wrap"><table class="table compact vital-table"><thead><tr>' +
    '<th>Measurement</th><th>Current</th><th>Δ 1h</th><th>24h trend</th><th>Reference</th><th>Source</th><th>Quality</th>' +
    '</tr></thead><tbody>' + vitalRows + '</tbody></table></div>';
  var vitalsPanel = panel({ title: 'Vital signs — telemetry', idx: 'SIGNALS', tone: 'cyan', flush: false,
    meta: '<span class="row tight">' + dot(feedHealthy && t.live ? 'cyan' : 'amber', feedHealthy && t.live) +
      '<span>' + (t.error ? 'FEED ERROR · CACHED' : t.live ? 'LIVE · SIMULATED' : 'STREAM PAUSED') + '</span></span>',
    actions: btn(t.live ? 'Pause' : 'Resume', 'telemetry-toggle', { cls: 'ghost tiny', icon: t.live ? 'pause' : 'play' }) +
      btn(t.error ? 'Clear error' : 'Simulate feed error', 'telemetry-error', { cls: 'ghost tiny' }),
    body: vitalsBody,
    foot: '<span>6 signals · 4 device, 1 manual, 1 derived · last sync <span data-sync-label>' + ago(new Date(t.lastSync).toISOString()) + '</span></span>' + tag('NO REAL DEVICE CONNECTED', 'amber') });

  var chartIds = [['hr', 'HR'], ['spo2', 'SpO₂'], ['rr', 'RR'], ['temp', 'Temp']];
  var chartActions = '<div class="seg">' + chartIds.map(function (c) {
    return '<button data-action="chart-toggle" data-arg="' + c[0] + '" class="' + (S.patient.chart.indexOf(c[0]) >= 0 ? 'on' : '') + '">' + c[1] + '</button>';
  }).join('') + '</div>';
  var chartPanel = panel({ title: 'Longitudinal trend · 24 hours', idx: 'TREND', tone: 'violet', actions: chartActions,
    body: '<div class="chart-box"><div id="trendChart">' + trendChart() + '</div>' +
      '<div class="legend">' + chartIds.map(function (c) {
        var colors = { hr: 'cyan', spo2: 'violet', rr: 'amber', temp: 'emerald' };
        return '<span class="item tone-' + colors[c[0]] + '"><span class="swatch"></span>' + c[1] + '</span>';
      }).join('') + '<span class="item"><span class="swatch box" style="background:var(--text-4)"></span>Illustrative reference band</span></div></div>',
    foot: '<span>Normalised per-series scale for shape comparison. Absolute values are in the table above.</span>' + tag('SIMULATED HISTORY', 'amber') });

  var timelinePanel = panel({ title: 'Care timeline', idx: 'ACTIVITY', tone: 'emerald',
    actions: btn('Export record', 'export-summary', { cls: 'ghost tiny', icon: 'download' }),
    body: '<div class="timeline">' + D.timeline.map(function (e) {
      var tones = { measurement: 'cyan', safety: 'amber', intake: 'violet', review: 'emerald', model: 'violet', report: 'cyan' };
      return '<div class="tl-item accent tone-' + (tones[e.type] || 'cyan') + '">' +
        '<div class="tl-head"><span class="tl-title">' + esc(e.title) + '</span><span class="tl-time">' + isoTime(e.at) + '</span></div>' +
        '<div class="tl-detail">' + esc(e.detail) + '</div><div class="tl-actor">' + esc(e.actor) + ' · ' + esc(e.status.toUpperCase()) + '</div></div>';
    }).join('') + '</div>' });

  /* right: risk + ladder + coordination */
  var riskBody;
  if (r.loading) {
    riskBody = '<div class="row" style="gap:14px"><div class="skeleton" style="width:88px;height:88px;border-radius:50%"></div>' +
      '<div style="flex:1"><div class="skeleton lg" style="width:60%"></div><div class="skeleton mt-8" style="width:85%"></div><div class="skeleton mt-8" style="width:70%"></div></div></div>' +
      '<div class="divider"></div>' + skeletonRows(4) +
      '<div class="form-hint">Recomputing feature attributions against the current signal window…</div>';
  } else {
    riskBody = '<div class="risk-hero">' + ringSvg(r.score) + '<div><div class="row tight">' + tag('AI-ASSISTED', 'violet') + tag('EXPLAINABLE', 'violet') + '</div>' +
      '<div class="risk-band" style="margin-top:7px">' + esc(r.band) + ' · ' + r.score + '/100</div>' +
      '<div class="risk-sub">24h deterioration signal · <b>not a diagnosis</b></div></div></div>' +
      '<div class="confidence">' + icon('info') + ' <b>' + esc(D.risk.confidenceLabel) + '</b><br>Confidence ' + num(D.risk.confidence * 100, 0) + '% · incomplete data and simulated signals limit interpretation.</div>' +
      '<div class="panel-sub mt-16">FEATURE ATTRIBUTIONS · ADDITIVE (SIMULATED)</div>' +
      D.risk.factors.map(function (f) {
        var w = Math.abs(f.contribution), neg = f.contribution < 0;
        return '<div class="factor"><div class="factor-top"><div><div class="factor-label">' + esc(f.label) + '</div>' +
          '<div class="factor-detail">' + esc(f.detail) + '</div></div>' +
          '<span class="factor-weight ' + (neg ? 'neg' : '') + '">' + (f.contribution > 0 ? '+' : '') + f.contribution + '</span></div>' +
          '<div class="bar-track"><div class="bar-fill ' + (neg ? 'neg' : '') + '" style="width:' + (w / 20 * 100) + '%"></div></div>' +
          (f.evidenceIds.length ? '<div class="evidence-links">' + f.evidenceIds.map(function (id) {
            return '<button class="link" data-action="view-evidence" data-arg="' + id + '">' + icon('file') + ' ' + id + '</button>';
          }).join('') + '</div>' : '') + '</div>';
      }).join('') +
      '<div class="notice tone-violet mt-12" style="margin-bottom:0">' + icon('shield') + '<div style="font-size:10.5px"><b>' + esc(D.risk.disclaimer) + '</b><br>' + esc(D.risk.method) + ' · ' + esc(D.risk.calibration) + '.</div></div>';
  }
  var riskPanel = panel({ title: 'Explainable risk assessment', idx: 'MODEL', tone: 'violet',
    meta: '<span>' + esc(D.risk.assessmentId) + '</span>' + tag('SIMULATED OUTPUT', 'amber'),
    body: riskBody,
    foot: '<div class="btn-row">' + btn('View evidence packet', 'view-evidence', { cls: 'violet tiny', arg: 'EV-1041' }) +
      btn(r.loading ? 'Computing…' : 'Re-run assessment', 'rerun-risk', { cls: 'ghost tiny', icon: 'refresh', disabled: r.loading }) + '</div>' +
      '<span class="mono fs-10">' + esc(D.risk.modelId) + ' v' + esc(D.risk.modelVersion) + ' · ' + isoTime(r.computedAt) + '</span>' });

  var ladderPanel = panel({ title: 'Care level ladder', idx: 'ROUTING', tone: 'cyan',
    meta: tag('CURRENT L2', 'cyan'),
    body: '<div class="ladder">' + D.careLevels.map(function (l) {
      return '<div class="ladder-step tone-' + l.color + (l.level === 2 ? ' active' : '') + '">' +
        '<span class="lv">' + (l.level === 2 ? '▶' : l.level) + '</span><span class="bar"></span>' +
        '<span class="strong">' + esc(l.name) + '</span><span class="desc">' + esc(l.description) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="panel-note">Level transitions require clinician review. The model can recommend a level but cannot change it.</div>' });

  var c = D.consultation;
  var coordPanel = panel({ title: 'Care coordination', idx: 'TEAM', tone: 'emerald',
    body: '<div class="mini-list">' + statRow('Consultation', c.id) + statRow('Status', c.status.toUpperCase()) +
      statRow('Clinician', c.clinician) + statRow('Slot', isoDate(S.patient.consult.slot)) +
      statRow('Mode', c.mode) + statRow('Case', c.caseId) + statRow('Consent', c.consentId) + '</div>' +
      '<div class="divider"></div>' +
      '<div class="row between"><div><div class="mono fs-10 c-muted">VIDEO BRIDGE</div><div class="fs-11" style="color:var(--text-2);margin-top:3px">Unavailable in sandbox</div></div>' +
      btn('Join', 'noop', { cls: 'ghost tiny', disabled: true, title: 'Video bridge is disabled in the sandbox environment' }) + '</div>' +
      '<div class="btn-row mt-12">' + btn('Request earlier slot', 'open-consult', { cls: 'ghost tiny' }) +
      btn('Open doctor review', 'nav-doctor-cases', { cls: 'ghost tiny' }) + '</div>' });

  return head + topNotice + patientStrip() +
    '<div class="grid g-patient">' +
      '<div class="stack">' + intakePanel + rulesPanel + '</div>' +
      '<div class="stack">' + vitalsPanel + chartPanel + timelinePanel + '</div>' +
      '<div class="stack">' + riskPanel + ladderPanel + coordPanel + '</div>' +
    '</div>';
}
function intakeFormFields(i, symptomOptions) {
  return '<div class="field"><div class="field-label">Describe your symptoms <span class="hint">free text · required</span></div>' +
    '<textarea class="textarea" data-model="intake.description" placeholder="What are you experiencing? When did it start, and what makes it better or worse?">' + esc(i.description) + '</textarea></div>' +
    '<div class="field-row"><div class="field"><div class="field-label">Onset</div><select class="select" data-model="intake.onset">' +
      ['Today', '1–2 days', '3–7 days', '1–4 weeks', 'Longer'].map(function (o) { return '<option' + (i.onset === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
    '</select></div><div class="field"><div class="field-label">Duration</div><div class="input-group">' +
      '<input class="input mono" data-model="intake.duration" value="' + esc(i.duration) + '"><span class="unit">' + esc(i.durationUnit) + '</span></div></div></div>' +
    '<div class="field"><div class="field-label">Severity <span class="hint">' + i.severity + ' / 10</span></div>' +
      '<input class="range" type="range" min="1" max="10" value="' + i.severity + '" data-model="intake.severity">' +
      '<div class="range-scale"><span>1 · mild</span><span>5 · moderate</span><span>10 · severe</span></div></div>' +
    '<div class="field"><div class="field-label">Associated symptoms <span class="hint">select all that apply</span></div><div class="chips">' +
      symptomOptions.map(function (s) {
        return '<button class="chip' + (i.symptoms.indexOf(s) >= 0 ? ' on' : '') + '" data-action="intake-chip" data-arg="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('') + '</div></div>' +
    '<div class="hr-label">QUICK MEASUREMENT ENTRY · SIMULATED</div>' +
    '<div class="field-row three">' +
      '<div class="field"><div class="field-label">Heart rate</div><div class="input-group"><input class="input mono" data-model="intake.measurements.hr" value="' + esc(i.measurements.hr) + '"><span class="unit">bpm</span></div></div>' +
      '<div class="field"><div class="field-label">SpO₂</div><div class="input-group"><input class="input mono" data-model="intake.measurements.spo2" value="' + esc(i.measurements.spo2) + '"><span class="unit">%</span></div></div>' +
      '<div class="field"><div class="field-label">Temp</div><div class="input-group"><input class="input mono" data-model="intake.measurements.temp" value="' + esc(i.measurements.temp) + '"><span class="unit">°C</span></div></div>' +
    '</div>';
}

/* ==========================================================================
   02 — DOCTOR CASE REVIEW
   ========================================================================== */
function riskForCase(c) {
  if (c.id === 'CASE-4417') return D.risk;
  return {
    assessmentId: 'RA-' + (90000 + parseInt(c.id.slice(-4), 10)),
    modelVersion: D.risk.modelVersion, score: c.risk, band: c.band,
    confidence: c.risk > 60 ? 0.68 : 0.81,
    confidenceLabel: c.risk > 60 ? 'Moderate confidence · elevated uncertainty' : 'High confidence · simulated cohort',
    disclaimer: D.risk.disclaimer,
    factors: [
      { id: 'F1', label: 'Presenting complaint', detail: c.chiefComplaint.slice(0, 48), contribution: Math.round(c.risk * .28), direction: 'increase', evidenceIds: ['EV-1041'] },
      { id: 'F2', label: 'Recent signal variance', detail: '2 of 6 signals outside reference band', contribution: Math.round(c.risk * .18), direction: 'increase', evidenceIds: ['EV-1042'] },
      { id: 'F3', label: 'Care pathway history', detail: c.history.slice(0, 44), contribution: Math.round(c.risk * .10), direction: 'increase', evidenceIds: [] },
      { id: 'F4', label: 'Stable haemodynamics', detail: 'No sustained BP deviation', contribution: -8, direction: 'decrease', evidenceIds: [] }
    ]
  };
}
function viewDoctor() {
  var d = S.doctor, c = activeCase();
  var head = screenHead({
    eyebrow: 'WORKSPACE 02 / CLINICIAN',
    title: 'Doctor case review',
    sub: 'Priority queue, evidence-linked clinical picture, and signed disposition. Model output is advisory and every decision writes an audit event.',
    meta: '<span>' + tag('7 OPEN CASES', 'cyan') + '</span><span>' + tag('2 URGENT', 'rose') + '</span><span class="sep"></span><span>REVIEWER: DR. ISHA RAMAN</span><span class="sep"></span><span>QUEUE SLA TARGET 4H FOR L3+</span>',
    actions: btn('Refresh queue', 'refresh-queue', { cls: 'ghost optional', icon: 'refresh', loading: d.refreshBusy }) +
      btn('Inspect case data', 'open-drawer-case', { cls: 'ghost', icon: 'database' }) +
      btn('State library', 'states', { cls: 'ghost optional', icon: 'layers' })
  });
  var topNotice = notice('violet', 'CLINICIAN DECISION SUPPORT · NOT A DIAGNOSIS',
    'Risk scores, feature attributions, and citations are <b>synthetic decision-support material</b>. Review the source signals and record your own assessment before signing a disposition.');

  var filtered = doctorFilteredCases();
  var tabs = [['all', 'All'], ['urgent', 'Urgent'], ['unassigned', 'Unassigned'], ['close', 'Ready to close']];
  var queueBody = '<div style="padding:10px 11px;border-bottom:1px solid var(--line)">' +
    '<div class="seg" style="width:100%;display:flex">' + tabs.map(function (t) {
      return '<button style="flex:1" data-action="doctor-filter" data-arg="' + t[0] + '" class="' + (d.filter === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="row between mt-8"><input id="caseSearchInput" class="input mono" style="height:28px;font-size:10.5px" placeholder="Filter by ID or name…" value="' + esc(d.query) + '" data-model="doctor.query">' +
    '<label class="check" style="white-space:nowrap"><input type="checkbox" data-action="doctor-myqueue" ' + (d.myQueue ? 'checked' : '') + '><span class="fs-10">My queue</span></label></div></div>' +
    (d.refreshBusy || d.loading ? skeletonRows(5)
      : filtered.length ? filtered.map(function (q) {
          var t = toneForBand(q.band);
          return '<button class="queue-item' + (d.selected === q.id ? ' active' : '') + '" data-action="select-case" data-arg="' + q.id + '">' +
            '<div class="q-top"><span class="q-id">' + esc(q.id) + '</span>' + severityTag(q.priority) + '</div>' +
            '<div class="row between"><span class="q-name">' + esc(q.patientName) + '</span><span class="mono fs-10 c-muted">L' + q.careLevel + ' · ' + q.age + 'y</span></div>' +
            '<div class="q-sub">' + esc(q.chiefComplaint) + '</div>' +
            '<div class="q-bottom"><span class="risk-pill tone-' + t + '"><span class="bar"><i style="width:' + q.risk + '%"></i></span>' + q.risk + ' ' + esc(q.band) + '</span>' +
            '<span class="sla ' + (q.slaMinutes < 60 ? 'urgent' : '') + '">SLA ' + duration(q.slaMinutes) + '</span></div>' +
            '<div class="row between"><span class="fs-10 c-muted">' + esc(q.status) + '</span><span class="fs-10 c-muted">' + esc(q.assignedTo || 'UNASSIGNED') + '</span></div></button>';
        }).join('')
      : emptyState('No cases in this view', 'Change the filter or clear the search to see the full simulated queue.', btn('Clear filters', 'doctor-clear-filters', { cls: 'ghost tiny' }))) ;
  var queuePanel = panel({ title: 'Case queue', idx: 'QUEUE', tone: 'cyan', flush: true,
    meta: tag(filtered.length + ' SHOWN', 'muted'), body: queueBody,
    foot: '<span>Sorted by priority, then SLA.</span>' + tag('SIMULATED CASES', 'amber') });

  var detail;
  if (!c) {
    detail = panel({ title: 'Case detail', idx: 'DETAIL', tone: 'violet',
      body: emptyState('No case selected', 'Choose a case from the queue to review its clinical picture, evidence packet, and decision form.', btn('Select first case', 'select-first-case', { cls: 'primary tiny' })),
      foot: '<span>Read-only until a case is selected.</span>' });
  } else if (d.loading) {
    detail = panel({ title: 'Case detail', idx: 'DETAIL', tone: 'violet', body: skeletonRows(7), foot: '<span>Loading simulated case record…</span>' });
  } else {
    detail = doctorDetail(c);
  }
  return head + topNotice + '<div class="grid g-doctor">' + queuePanel + '<div style="min-width:0">' + detail + '</div></div>';
}
function doctorFilteredCases() {
  var d = S.doctor, q = d.query.toLowerCase().trim();
  return D.cases.filter(function (c) {
    if (d.myQueue && c.assignedTo && c.assignedTo !== 'Dr. Isha Raman') return false;
    if (d.filter === 'urgent' && c.priority !== 'Urgent') return false;
    if (d.filter === 'unassigned' && c.assignedTo) return false;
    if (d.filter === 'close' && c.status !== 'Ready to close') return false;
    if (q && (c.id + ' ' + c.patientName + ' ' + c.chiefComplaint).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function doctorDetail(c) {
  var d = S.doctor, risk = riskForCase(c), tone = toneForBand(c.band);
  var header = '<div class="panel-body" style="padding:11px 13px;border-bottom:1px solid var(--line)">' +
    '<div class="row between" style="align-items:flex-start">' +
    '<div><div class="row tight">' + severityTag(c.priority) + tag('CASE ' + c.id, 'cyan') + statusTag(c.status) + '</div>' +
    '<h2 style="margin:8px 0 3px;font-size:17px;letter-spacing:-.01em;color:var(--white)">' + esc(c.patientName) + ' <span class="mono fs-11 c-muted">' + esc(c.patientId) + '</span></h2>' +
    '<div class="fs-11 c-muted">' + esc(c.chiefComplaint) + '</div></div>' +
    '<div class="row tight">' + btn('Open data record', 'open-drawer-case', { cls: 'ghost tiny', icon: 'database' }) +
      (c.assignedTo ? tag('ASSIGNED · ' + c.assignedTo.replace('Dr. ', '').toUpperCase(), 'emerald') : btn('Assign to me', 'assign-case', { cls: 'primary tiny' })) + '</div></div></div>';

  var pictureBody = '<div class="panel-sub">CHIEF COMPLAINT · PATIENT-REPORTED</div>' +
    '<div class="callout tone-cyan">' + esc(c.chiefComplaint) + '</div>' +
    '<div class="panel-sub mt-16">RELEVANT HISTORY · SELF-REPORTED / SIMULATED</div>' +
    '<div class="fs-11" style="color:var(--text-2);line-height:1.6">' + esc(c.history) + '</div>' +
    '<div class="panel-sub mt-16">STRUCTURED SYMPTOMS</div>' +
    '<div class="table-wrap"><table class="table compact"><thead><tr><th>Sim code</th><th>Reported symptom</th><th>Severity</th><th>Onset</th></tr></thead><tbody>' +
    c.symptoms.map(function (s) {
      return '<tr><td class="mono">' + esc(s.code) + '</td><td class="strong">' + esc(s.label) + '</td>' +
        '<td><span class="mono ' + (s.severity >= 6 ? 'c-rose' : 'c-amber') + '">' + s.severity + '/10</span></td><td class="mono fs-10">' + esc(s.onset) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="panel-note">“SIM-” codes are synthetic interface placeholders, not ICD or SNOMED codes.</div>' +
    '<div class="grid mt-16" style="grid-template-columns:repeat(3,1fr);gap:9px">' +
      statTile('Heart rate', '108 bpm · +11/h') + statTile('SpO₂', '93% · −3/h') + statTile('Care level', 'L' + c.careLevel + ' · ' + D.careLevels[c.careLevel].name) + '</div>';
  var picturePanel = panel({ title: 'Clinical picture', idx: '01', tone: 'cyan', body: pictureBody });

  var riskBody = '<div class="row" style="gap:14px;align-items:center">' + ringSvg(risk.score) +
    '<div style="flex:1"><div class="row tight">' + tag('MODEL OUTPUT', 'violet') + tag('SIMULATED', 'amber') + '</div>' +
    '<div class="risk-band" style="color:var(--t);font-size:14px;margin-top:6px">' + esc(risk.band) + ' · ' + risk.score + '/100</div>' +
    '<div class="risk-sub">' + esc(risk.confidenceLabel) + '</div></div></div>' +
    '<div class="panel-sub mt-16">TOP ATTRIBUTIONS</div>' +
    risk.factors.slice(0, 4).map(function (f) {
      return '<div class="factor"><div class="factor-top"><div><div class="factor-label">' + esc(f.label) + '</div>' +
        '<div class="factor-detail">' + esc(f.detail) + '</div></div><span class="factor-weight ' + (f.contribution < 0 ? 'neg' : '') + '">' +
        (f.contribution > 0 ? '+' : '') + f.contribution + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + (f.contribution < 0 ? 'neg' : 'violet') + '" style="width:' + clamp(Math.abs(f.contribution) / 20 * 100, 4, 100) + '%"></div></div></div>';
    }).join('') +
    '<div class="notice tone-violet mt-12" style="margin-bottom:0">' + icon('shield') + '<div style="font-size:10.5px"><b>' + esc(risk.disclaimer) + '</b><br>Model ' + esc(D.risk.modelId) + ' v' + esc(risk.modelVersion) + ' · ' + esc(D.risk.assessmentId) + ' · computed ' + isoTime(D.risk.computedAt) + '.</div></div>';
  var riskPanel = panel({ title: 'AI risk summary · explainable output', idx: '02', tone: 'violet',
    actions: btn('Model record', 'open-drawer-risk', { cls: 'ghost tiny' }), body: riskBody });

  var evList = c.evidenceIds.map(function (id) { return find(D.evidence, 'id', id); }).filter(Boolean)
    .filter(function (e) { return !d.verifiedOnly || e.verified; });
  var evidenceBody = '<div class="row between mb-12"><span class="fs-11 c-muted">Citations retrieved for this case and linked to the model attributions.</span>' +
    '<label class="check"><input type="checkbox" data-action="doctor-verified" ' + (d.verifiedOnly ? 'checked' : '') + '><span class="fs-10">Verified only</span></label></div>' +
    (evList.length ? evList.map(function (e) {
      return '<div class="evidence-item"><div class="ev-top"><div class="ev-title">' + esc(e.title) + '</div>' +
        tag(e.verified ? 'VERIFIED' : 'APPRAISAL PENDING', e.verified ? 'emerald' : 'amber') + '</div>' +
        '<div class="ev-meta">' + esc(e.id) + ' · ' + esc(e.source) + ' · ' + e.year + ' · ' + esc(e.identifier) + ' · relevance ' + num(e.relevance * 100, 0) + '%</div>' +
        '<div class="ev-excerpt">“' + esc(e.excerpt.slice(0, 178)) + '…”</div>' +
        '<div class="ev-actions"><button class="link" data-action="view-evidence" data-arg="' + e.id + '">Open citation →</button>' +
        tag('SYNTHETIC SOURCE', 'amber') + '</div></div>';
    }).join('') : emptyState('No verified citations', 'This case only has unverified synthetic citations. Turn off the filter to review them with their limitations.', btn('Show all', 'doctor-verified', { cls: 'ghost tiny' })));
  var evidencePanel = panel({ title: 'Clinical evidence packet', idx: '03', tone: 'violet',
    meta: tag(evList.length + ' CITATIONS', 'violet'), body: evidenceBody,
    foot: '<span>All publications and identifiers on this screen are fictional.</span>' + tag('NOT CLINICAL GUIDANCE', 'amber') });

  var decisionBody = decisionForm(c);
  var decisionPanel = panel({ title: 'Clinical decision & sign-off', idx: '04', tone: 'emerald', body: decisionBody,
    foot: '<span>Signed decisions are immutable in the simulated audit log.</span>' + tag('HUMAN SIGN-OFF REQUIRED', 'cyan') });

  var routingPanel = panel({ title: 'Routing & consent', idx: '05', tone: 'cyan',
    body: '<div class="mini-list">' + statRow('Case ID', c.id) + statRow('Status', c.status) +
      statRow('Priority', c.priority) + statRow('Care level', 'L' + c.careLevel) +
      statRow('SLA remaining', duration(c.slaMinutes)) + statRow('Assigned to', c.assignedTo || 'Unassigned') +
      statRow('Opened', isoTime(c.openedAt)) + statRow('Consent', c.consentId) + '</div>' +
      '<div class="divider"></div><div class="mono fs-10 c-muted">CONSENT SCOPES</div>' +
      '<div class="row tight mt-8">' + D.patient.consent.scope.map(function (s) { return tag(s.replace(/_/g, ' '), 'emerald'); }).join('') + '</div>' });

  var consultPanel = panel({ title: 'Consultation request', idx: '06', tone: 'violet',
    body: '<div class="mini-list">' + statRow('Request', D.consultation.id) + statRow('Requested by', D.consultation.requestedBy) +
      statRow('Reason', D.consultation.reason.slice(0, 30) + '…') + statRow('Mode', D.consultation.mode) +
      statRow('Slot', isoDate(D.consultation.slot)) + statRow('Status', D.consultation.status) + '</div>' +
      '<div class="notice tone-amber mt-12" style="margin-bottom:0">' + icon('info') + '<div style="font-size:10.5px">Video bridge is disabled in this sandbox. Consultations are record objects only.</div></div>' });

  var auditPanel = panel({ title: 'Case audit trail', idx: '07', tone: 'emerald',
    body: '<div class="timeline">' + c.audit.map(function (a) {
      return '<div class="tl-item accent tone-emerald"><div class="tl-head"><span class="tl-title">' + esc(a.action) + '</span>' +
        '<span class="tl-time">' + isoTime(a.at) + '</span></div><div class="tl-detail">Result: ' + esc(a.result) + '</div>' +
        '<div class="tl-actor">' + esc(a.actor) + '</div></div>';
    }).join('') + '</div>' });

  var rulePanel = panel({ title: 'Rules triggered', idx: '08', tone: 'amber',
    body: D.safetyRules.slice(0, 3).map(function (r) {
      return '<div class="rule-item"><div class="rule-top"><span class="rule-id">' + esc(r.id) + '</span><span class="rule-name">' + esc(r.name) + '</span></div>' +
        '<div class="rule-cond">' + esc(r.condition) + '</div><div class="rule-action"><b>→</b> ' + esc(r.action) + '</div></div>';
    }).join('') });

  return '<section class="panel"><header class="panel-head"><div class="panel-title tone-cyan"><span class="accent"></span><span>CASE WORKSPACE</span></div>' +
    '<div class="panel-meta">' + tag(c.id, 'cyan') + tag('SANDBOX RECORD', 'amber') + '</div></header>' + header +
    '<div class="panel-body" style="background:var(--bg)"><div class="grid g-doctor-detail">' +
      '<div class="stack">' + picturePanel + riskPanel + evidencePanel + decisionPanel + '</div>' +
      '<div class="stack">' + routingPanel + consultPanel + auditPanel + rulePanel + '</div>' +
    '</div></div></section>';
}
function decisionForm(c) {
  var d = S.doctor;
  if (c.decisionId || d.decisionStatus === 'success') {
    return stateBox({ tone: 'emerald', icon: 'check', title: 'Decision ' + esc(c.decisionId || d.decisionId) + ' signed',
      sub: 'Disposition <b>' + esc(c.disposition || d.disposition || 'Monitor') + '</b> recorded. The case moved to Ready to close and an audit hash was written.' }) +
      '<div class="mini-list mt-16">' + statRow('Signed by', 'Dr. Isha Raman') + statRow('Note', (c.note || d.note || '').slice(0, 64) + '…') +
      statRow('Evidence reviewed', c.evidenceIds.length + ' synthetic citations') + statRow('Audit hash', 'c0f7…3d68') + '</div>' +
      '<div class="btn-row mt-16">' + btn('View audit log', 'goto-admin-audit', { cls: 'ghost tiny' }) +
      btn('Select next case', 'select-first-case', { cls: 'primary tiny' }) + '</div>';
  }
  var needsOverride = (d.disposition === 'Monitor' || d.disposition === 'Close') && c.risk >= 60;
  var canSign = d.note.trim().length >= 20 && !!d.disposition && d.acknowledged && (!needsOverride || d.override.trim().length >= 8) && d.decisionStatus !== 'loading';
  var dispositions = ['Monitor', 'Request data', 'Escalate', 'Refer', 'Close'];
  return (d.decisionStatus === 'error' ? stateBox({ tone: 'rose', icon: 'x', title: 'Decision was not signed', sub: 'Simulated error E-SIGN-409: the audit writer rejected the request. Your draft is preserved; no status changed.', actions: btn('Retry', 'doctor-submit', { cls: 'tiny' }) + btn('Dismiss', 'doctor-dismiss-error', { cls: 'tiny ghost' }) }) + '<div class="divider"></div>' : '') +
    '<div class="field"><div class="field-label">Clinical assessment note <span class="hint">minimum 20 characters</span></div>' +
    '<textarea class="textarea" data-model="doctor.note" placeholder="Document your own interpretation of the signals, evidence limitations, and plan…">' + esc(d.note) + '</textarea>' +
    '<div class="form-hint" data-note-count>' + d.note.trim().length + ' / 20 characters minimum · stored locally in this sandbox.</div></div>' +
    '<div class="field"><div class="field-label">Disposition</div><div class="seg" style="display:flex;flex-wrap:wrap">' +
    dispositions.map(function (x) {
      return '<button data-action="doctor-disposition" data-arg="' + x + '" class="' + (d.disposition === x ? 'on' : '') + '">' + x + '</button>';
    }).join('') + '</div></div>' +
    (needsOverride ? '<div class="notice tone-amber">' + icon('alert') + '<div><span class="notice-title">SAFETY RULE SR-02 · DOCUMENTED OVERRIDE REQUIRED</span>' +
      'Risk index is ' + c.risk + ' with two signals outside their reference band. A non-escalating disposition requires a short reason.</div></div>' +
      '<div class="field mt-12"><div class="field-label">Override rationale <span class="hint">required for this disposition</span></div>' +
      '<textarea class="textarea" data-model="doctor.override" placeholder="Explain why escalation is not indicated at this time…">' + esc(d.override) + '</textarea></div>' : '') +
    '<label class="check mt-12"><input type="checkbox" data-action="doctor-ack" ' + (d.acknowledged ? 'checked' : '') + '>' +
    '<span>I have reviewed the source signals, the synthetic citations and their limitations, and the model disclaimer. This disposition is my own clinical judgement.<span class="check-meta">Required before sign-off · SR-07 human-in-the-loop control</span></span></label>' +
    '<div class="divider"></div><div class="btn-row">' +
    btn(d.decisionStatus === 'loading' ? 'Signing decision…' : 'Sign decision', 'doctor-submit', { cls: 'primary', disabled: !canSign, loading: d.decisionStatus === 'loading', icon: 'lock' }) +
    btn('Simulate save error', 'doctor-fail', { cls: 'ghost tiny' }) + '</div>' +
    '<div class="form-hint" data-decision-hint>' + (!d.note.trim() || d.note.trim().length < 20 ? 'Disabled: add an assessment note of at least 20 characters.'
      : !d.disposition ? 'Disabled: choose a disposition.'
      : needsOverride && d.override.trim().length < 8 ? 'Disabled: document the override rationale.'
      : !d.acknowledged ? 'Disabled: confirm the acknowledgement checkbox.'
      : 'Ready to sign · writes DEC record and audit event.') + '</div>';
}

/* ==========================================================================
   03 — EMERGENCY OPERATOR INCIDENT COORDINATION
   ========================================================================== */
function viewOperator() {
  var o = S.operator, inc = activeIncident() || D.incidents[0];
  var head = screenHead({
    eyebrow: 'WORKSPACE 03 / EMERGENCY OPERATIONS',
    title: 'Emergency incident coordination',
    sub: 'Incident verification, unit assignment, protocol adherence, and communications for simulated emergency exercises.',
    meta: '<span>' + tag('4 INCIDENTS', 'cyan') + '</span><span>' + tag('2 HIGH SEVERITY', 'rose') + '</span><span class="sep"></span><span>OPERATOR: MIRA SEN</span><span class="sep"></span><span>EXERCISE MODE</span>',
    actions: btn('Incident record', 'open-drawer-incident', { cls: 'ghost optional', icon: 'database' }) +
      btn('Open transit console', 'goto-transit', { cls: 'ghost', icon: 'arrowRight' }) +
      btn('Create simulated incident', 'open-incident-modal', { cls: 'danger', icon: 'plus' })
  });
  var topNotice = notice('rose', 'SIMULATION ONLY — DOES NOT CONTACT EMERGENCY SERVICES',
    '<b>No calls, messages, dispatch signals, vehicles, or facilities are real.</b> Every incident, unit, and communication below is a synthetic exercise record governed by safety rule SR-06.');

  var list = D.incidents.filter(function (i) {
    return o.filter === 'all' ? true : o.filter === 'active' ? i.stageIndex < 6 : i.stageIndex >= 6;
  });
  var queueBody = '<div style="padding:9px 10px;border-bottom:1px solid var(--line)"><div class="seg" style="display:flex">' +
    [['active', 'Active'], ['all', 'All'], ['resolved', 'Resolved']].map(function (f) {
      return '<button style="flex:1" data-action="op-filter" data-arg="' + f[0] + '" class="' + (o.filter === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
    }).join('') + '</div></div>' +
    (list.length ? list.map(function (i) {
      return '<button class="queue-item' + (o.selected === i.id ? ' active' : '') + '" data-action="select-incident" data-arg="' + i.id + '">' +
        '<div class="q-top"><span class="q-id">' + esc(i.id) + '</span>' + severityTag(i.severity) + '</div>' +
        '<div class="q-name">' + esc(i.type) + '</div>' +
        '<div class="q-sub">' + esc(i.location) + '</div>' +
        '<div class="q-bottom"><span class="fs-10 c-muted">' + esc(i.status) + '</span><span class="sla">' + ago(i.reportedAt) + '</span></div>' +
        '<div class="row between"><span class="mono fs-10 c-muted">' + esc(i.patientId) + '</span><span class="mono fs-10 c-muted">' + esc(i.assignedUnit || 'NO UNIT') + '</span></div></button>';
    }).join('') : emptyState('No incidents in this filter', 'Switch to “All” to review every simulated incident or create a new exercise record.', btn('Show all', 'op-show-all', { cls: 'ghost tiny' })));
  var queuePanel = panel({ title: 'Incident queue', idx: 'QUEUE', tone: 'rose', flush: true,
    meta: tag(list.length + ' SHOWN', 'muted'), body: queueBody,
    foot: '<span>Sorted by severity, then report time.</span>' + tag('SR-06 LABELLED', 'amber') });

  var elapsed = Math.max(0, Math.round((S.now - Date.parse(inc.reportedAt)) / 60000));
  var headerPanel = '<section class="panel"><header class="panel-head"><div class="panel-title tone-rose"><span class="accent"></span><span>INCIDENT ' + esc(inc.id) + '</span></div>' +
    '<div class="panel-meta">' + severityTag(inc.severity) + statusTag(inc.status) + tag('ELAPSED ' + duration(elapsed), 'amber') + '</div></header>' +
    '<div class="panel-body">' +
    '<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:10px">' +
      statTile('Patient', inc.patientName + ' · ' + inc.patientId) + statTile('Location', inc.location) +
      statTile('Channel', inc.channel) + statTile('Caller', inc.caller) + '</div>' +
    '<div class="hr-label">STATUS PIPELINE · ' + (inc.stageIndex + 1) + ' OF ' + D.incidentStages.length + '</div>' +
    '<div class="stepper">' + D.incidentStages.map(function (s, idx) {
      return '<div class="step ' + (idx < inc.stageIndex ? 'done' : idx === inc.stageIndex ? 'active' : '') + '">' +
        '<div class="node"></div><div class="lbl">' + esc(s.toUpperCase()) + '</div></div>';
    }).join('') + '</div>' +
    '<div class="row between mt-16"><div class="row tight">' + tag('CONSENT ' + (inc.consentVerified ? 'VERIFIED' : 'PENDING'), inc.consentVerified ? 'emerald' : 'rose') +
      tag('SIMULATED EXERCISE', 'amber') + tag(inc.grid, 'cyan') + '</div>' +
      '<div class="btn-row">' + btn('Open transit', 'goto-transit', { cls: 'ghost tiny' }) +
      btn(inc.stageIndex >= 6 ? 'Incident resolved' : 'Advance status', 'advance-status', { cls: 'primary tiny', icon: 'arrowRight',
        disabled: inc.stageIndex >= 6 || (!inc.assignedUnit && inc.stageIndex >= 2), loading: o.advanceBusy }) + '</div></div>' +
    (!inc.assignedUnit && inc.stageIndex >= 2 ? '<div class="form-hint mt-8 c-amber">Advance disabled: assign a unit before moving beyond dispatch requested.</div>' : '') +
    '</div></section>';

  var mapPanel = panel({ title: 'Operational area · simulated grid', idx: 'MAP', tone: 'cyan', flush: true,
    meta: '<span>' + dot('cyan', true) + ' UNIT</span><span>' + dot('rose') + ' PATIENT</span><span>' + dot('emerald') + ' FACILITY</span>',
    body: '<div class="map-wrap"><div class="map-overlay">' + tag('GRID ' + esc(inc.grid), 'cyan') + tag('SANDBOX MAP · NOT GEOGRAPHIC', 'amber') +
      tag(inc.stageIndex >= 4 ? 'UNIT IN TRANSIT' : 'UNIT AT STATION', 'violet') + '</div>' + operatorMap(inc) +
      '<div class="map-legend"><span class="item tone-cyan"><span class="key"></span>Assigned unit</span>' +
      '<span class="item tone-rose"><span class="key"></span>Patient location</span>' +
      '<span class="item tone-emerald"><span class="key"></span>Receiving facility</span>' +
      '<span class="item"><span class="key" style="background:var(--cyan);border-radius:0;height:2px;width:14px"></span>Planned route</span>' +
      '<span class="item" style="margin-left:auto">POSITION VALUES ARE SYNTHETIC</span></div></div>' });

  var logPanel = panel({ title: 'Incident status log', idx: 'LOG', tone: 'emerald', flush: true,
    actions: btn('Export incident', 'export-incident', { cls: 'ghost tiny', icon: 'download' }),
    body: '<div class="table-wrap"><table class="table compact"><thead><tr><th>Stage</th><th>Time</th><th>Actor</th><th>State</th></tr></thead><tbody>' +
      inc.log.slice().reverse().map(function (l, idx) {
        return '<tr><td class="strong">' + esc(l.label) + '</td><td class="mono">' + isoTime(l.at) + '</td>' +
          '<td class="mono fs-10">' + esc(l.actor) + '</td><td>' + (idx === 0 ? tag('CURRENT', 'cyan') : tag('COMPLETE', 'emerald')) + '</td></tr>';
      }).join('') + '</tbody></table></div>' });

  var unitsBody = '<div class="table-wrap"><table class="table compact units-table"><thead><tr><th></th><th>Unit</th><th>Capability</th><th>Status</th><th>ETA</th></tr></thead><tbody>' +
    D.units.map(function (u) {
      var disabled = !!u.disabledReason;
      return '<tr class="clickable' + (o.selectedUnit === u.id ? ' selected' : '') + '" data-action="select-unit" data-arg="' + u.id + '"' +
        (disabled ? ' style="opacity:.5;cursor:not-allowed"' : '') + '>' +
        '<td><span style="display:inline-block;width:10px;height:10px;border:1px solid ' + (o.selectedUnit === u.id ? 'var(--cyan)' : 'var(--line-3)') + ';border-radius:50%;background:' + (o.selectedUnit === u.id ? 'var(--cyan)' : 'transparent') + '"></span></td>' +
        '<td><div class="strong mono">' + esc(u.id) + '</div><div class="cell-meta">' + esc(u.crew.join(' / ')) + '</div></td>' +
        '<td class="fs-10">' + esc(u.capability) + '</td>' +
        '<td>' + tag(u.status, u.status === 'Available' ? 'emerald' : u.status === 'Unavailable' ? 'rose' : 'amber') +
          (disabled ? '<div class="cell-meta">Off-shift</div>' : '') + '</td>' +
        '<td class="mono">' + (u.etaMinutes === null ? '—' : u.etaMinutes + 'm') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="btn-row mt-12">' + btn(o.assignBusy ? 'Assigning…' : 'Assign selected unit', 'assign-unit', { cls: 'primary',
      loading: o.assignBusy, disabled: o.assignBusy || !o.selectedUnit || !!find(D.units, 'id', o.selectedUnit).disabledReason || inc.assignedUnit === o.selectedUnit }) +
      btn('Clear selection', 'clear-unit', { cls: 'ghost tiny' }) + '</div>' +
    '<div class="form-hint">' + (inc.assignedUnit === o.selectedUnit ? 'Selected unit is already assigned to this incident.'
      : find(D.units, 'id', o.selectedUnit) && find(D.units, 'id', o.selectedUnit).disabledReason ? 'Selected unit is unavailable: ' + esc(find(D.units, 'id', o.selectedUnit).disabledReason) + '.'
      : 'Assignment writes a dispatch event to the simulated incident log only.') + '</div>';
  var unitsPanel = panel({ title: 'Dispatch units', idx: 'FLEET', tone: 'cyan', body: unitsBody,
    foot: '<span>6 simulated units · 2 available</span>' + tag('NO REAL DISPATCH', 'amber') });

  var done = inc.protocol.filter(function (p) { return p.done; }).length;
  var protocolBody = '<div class="row between mb-12"><span class="fs-11 c-muted">Dispatch readiness checklist</span><span class="mono fs-10" style="color:var(--cyan)">' + done + ' / ' + inc.protocol.length + '</span></div>' +
    '<div class="progress-track" style="margin-bottom:14px"><div class="progress-fill tone-emerald" style="width:' + (done / inc.protocol.length * 100) + '%"></div></div>' +
    '<div class="protocol-list">' + inc.protocol.map(function (p) {
      return '<label class="check"><input type="checkbox" data-action="op-protocol" data-arg="' + p.id + '" ' + (p.done ? 'checked' : '') + '>' +
        '<span>' + esc(p.label) + '<span class="check-meta">' + esc(p.rule) + ' · ' + (p.done ? 'COMPLETE' : 'PENDING') + '</span></span></label>';
    }).join('') + '</div>' +
    (done < inc.protocol.length ? '<div class="callout tone-amber mt-12"><b>' + (inc.protocol.length - done) + ' protocol items outstanding.</b> Status can still be advanced in this exercise, but the audit log records an incomplete checklist.</div>' :
      '<div class="mt-12">' + stateBox({ tone: 'emerald', icon: 'check', title: 'Protocol checklist complete', sub: 'All SR-06 simulation disclosures and capability checks are recorded.' }) + '</div>');
  var protocolPanel = panel({ title: 'Emergency protocol', idx: 'SAFETY', tone: 'amber', body: protocolBody });

  var commsBody = '<div class="comm-log">' + inc.comms.slice().reverse().map(function (m) {
    return '<div class="comm-item ' + m.kind + '"><div class="comm-head"><b>' + esc(m.from) + '</b><span>' + isoTime(m.at) + '</span></div>' +
      '<div class="comm-text">' + esc(m.text) + '</div></div>';
  }).join('') + '</div>' +
    '<div class="divider"></div><div class="field"><div class="field-label">Post internal update <span class="hint">simulation-labelled</span></div>' +
    '<textarea class="textarea" style="min-height:56px" data-model="operator.commDraft" placeholder="Write an exercise update…">' + esc(o.commDraft) + '</textarea></div>' +
    '<div class="btn-row">' + btn('Post update', 'op-comms-submit', { cls: 'primary', icon: 'send', disabled: !o.commDraft.trim() }) +
    btn('Clear', 'op-comms-clear', { cls: 'ghost tiny' }) + '</div>';
  var commsPanel = panel({ title: 'Communications log', idx: 'COMMS', tone: 'violet', body: commsBody,
    foot: '<span>Internal exercise channel only.</span>' + tag('NO OUTBOUND MESSAGES', 'rose') });

  return head + topNotice + '<div class="grid g-operator">' +
    queuePanel +
    '<div class="stack">' + headerPanel + mapPanel + logPanel + '</div>' +
    '<div class="stack">' + unitsPanel + protocolPanel + commsPanel + '</div>' + '</div>';
}

/* ==========================================================================
   04 — AMBULANCE TRANSIT TRACKING
   ========================================================================== */
function viewTransit() {
  var tr = D.transit, t = S.transit;
  var eta = Math.max(0, Math.round(tr.etaMinutes * (1 - t.progress)));
  var head = screenHead({
    eyebrow: 'WORKSPACE 04 / AMBULANCE TEAM',
    title: 'Ambulance transit tracking',
    sub: 'In-transit telemetry, route progress, receiving facility pre-alert, and structured SBAR handoff for a simulated transfer.',
    meta: '<span>' + tag('UNIT AMB-07', 'cyan') + '</span><span>' + tag('INC-2026-1048', 'rose') + '</span><span class="sep"></span><span>CREW: ' + esc(tr.crew.join(' · ').toUpperCase()) + '</span><span class="sep"></span><span>ALL TELEMETRY SIMULATED</span>',
    actions: btn('Handoff record', 'open-handoff', { cls: 'ghost optional', icon: 'file' }) +
      btn(t.signalLost ? 'Recover signal' : 'Simulate signal loss', 'transit-signal-toggle', { cls: t.signalLost ? 'amber' : 'ghost', icon: 'wifi' }) +
      btn('Operator console', 'goto-operator', { cls: 'ghost', icon: 'arrowRight' })
  });
  var topNotice = notice('amber', 'SIMULATED TRANSIT · NO VEHICLE OR PATIENT IS BEING TRACKED',
    'Every coordinate, waveform, crew action, and facility acknowledgement below is synthetic. This interface is not connected to any emergency medical service.');

  var strip = '<div class="patient-strip strip-transit">' +
    '<div class="strip-cell primary"><div class="lbl">UNIT / CREW</div><div class="val mono">' + esc(tr.unitId) + '</div><div class="sub">' + esc(tr.crew.join(' · ')) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">PATIENT</div><div class="val">' + esc(tr.patientName) + '</div><div class="sub mono">' + esc(tr.patientId) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">STATUS</div><div class="val"><span class="tone-cyan" style="display:inline-flex;align-items:center;gap:6px;color:var(--cyan)">' + dot('cyan', true) + 'IN TRANSIT</span></div><div class="sub">Departed ' + isoTime(tr.departedAt) + '</div></div>' +
    '<div class="strip-cell"><div class="lbl">ETA / DISTANCE</div><div class="val mono">' + eta + ' min</div><div class="sub">' + tr.destination.distanceKm + ' km · ' + Math.round(t.progress * 100) + '% complete</div></div>' +
    '<div class="strip-cell"><div class="lbl">SIGNAL QUALITY</div><div class="val"><span class="tone-' + (t.signalLost ? 'rose' : 'emerald') + '" style="display:inline-flex;align-items:center;gap:6px;color:var(--' + (t.signalLost ? 'rose' : 'emerald') + ')">' +
      dot(t.signalLost ? 'rose' : 'emerald', !t.signalLost) + (t.signalLost ? 'LOST · CACHED' : 'LIVE · GOOD') + '</span></div><div class="sub">Simulated device link · 10 mm/mV</div></div></div>';

  var telemetryBody = (t.signalLost ? stateBox({ tone: 'rose', icon: 'x', title: 'Telemetry link lost', sub: 'No samples received for 42s. The values below are the last cached readings, not live measurements.', actions: btn('Retry link', 'transit-retry', { cls: 'tiny' }) }) + '<div class="mt-12"></div>' : '') +
    '<div class="panel-sub">ECG TRACE · SYNTHETIC WAVEFORM</div>' +
    '<div class="wave-box"><svg class="wave-svg' + (t.signalLost ? ' lost' : '') + '" viewBox="0 0 300 96" preserveAspectRatio="none" aria-label="Simulated ECG waveform">' +
    '<path id="wavePath" d="' + ecgPath(t.wavePhase, t.signalLost) + '"/></svg>' +
    '<div class="wave-caption"><span>' + esc(tr.waveform.rhythm) + '</span><span>' + esc(tr.waveform.gain) + ' · ' + esc(tr.waveform.speed) + '</span></div></div>' +
    '<div class="mini-list mt-12">' + tr.telemetry.map(function (v) {
      return '<div class="mini-row"><span class="k">' + esc(v.label) + '</span><span class="v" data-transit-value="' + v.id + '">' + esc(v.value) + ' ' + esc(v.unit) +
        ' <span class="' + (v.delta > 0 ? 'c-rose' : 'c-emerald') + ' fs-10">' + (v.delta > 0 ? '+' : '') + v.delta + '</span></span></div>';
    }).join('') + '</div>' +
    '<div class="callout tone-amber mt-12"><b>Signal quality note.</b> Derived values from wearable sensors may be unreliable. Confirm with a direct measurement before acting on any reading.</div>';
  var telemetryPanel = panel({ title: 'In-transit telemetry', idx: 'TELEMETRY', tone: 'cyan',
    meta: tag(t.signalLost ? 'CACHED' : 'LIVE · SIMULATED', t.signalLost ? 'rose' : 'cyan'), body: telemetryBody,
    foot: '<span>Last sample ' + ago(new Date(S.patient.telemetry.lastSync).toISOString()) + '</span>' + tag('NO MEDICAL DEVICE CONNECTED', 'amber') });

  var interventionsPanel = panel({ title: 'Interventions & equipment', idx: 'CREW', tone: 'emerald',
    body: tr.interventions.map(function (x, idx) {
      return '<div class="mini-row"><span class="k">' + esc(x) + '</span><span class="v">' + (idx === 2 ? tag('NOT PERFORMED', 'muted') : tag('SIM', 'amber')) + '</span></div>';
    }).join('') + '<div class="panel-note">Intervention records are placeholders for the exercise. No clinical action was taken.</div>' });

  var mapPanel = panel({ title: 'Transit route · simulated grid', idx: 'ROUTE', tone: 'cyan', flush: true,
    actions: btn('Advance route', 'transit-advance', { cls: 'ghost tiny', icon: 'arrowRight', disabled: t.progress >= 1 }),
    body: '<div class="map-wrap"><div class="map-overlay">' + tag('AMB-07 · IN TRANSIT', 'cyan') + tag('ETA ' + eta + ' MIN', 'violet') +
      tag('ROUTE ' + Math.round(t.progress * 100) + '%', 'emerald') + '</div>' + transitMap() +
      '<div class="map-legend"><span class="item tone-amber"><span class="key"></span>Scene</span>' +
      '<span class="item tone-cyan"><span class="key"></span>Unit position</span>' +
      '<span class="item tone-emerald"><span class="key"></span>Receiving facility</span>' +
      '<span class="item"><span class="key" style="background:var(--cyan);border-radius:0;height:2px;width:14px"></span>Route</span>' +
      '<span class="item" style="margin-left:auto">SYNTHETIC COORDINATES</span></div></div>',
    foot: '<span>Route progress is a simulation control, not GPS data.</span>' + tag('SIMULATED EXERCISE', 'amber') });

  var preAlert = t.preAlert;
  var preAlertBody = '<div class="grid" style="grid-template-columns:1fr 1fr;gap:9px">' +
    statTile('Facility', tr.destination.name) + statTile('Bay', tr.destination.bay) +
    statTile('Contact', tr.destination.contact) + statTile('Pre-alert', preAlert === 'sent' ? 'SENT · ' + isoTime(tr.destination.preAlertAt) : 'NOT SENT') + '</div>' +
    '<div class="mt-12">' + (preAlert === 'sent'
      ? stateBox({ tone: t.acknowledged ? 'emerald' : 'amber', icon: t.acknowledged ? 'check' : 'info',
          title: t.acknowledged ? 'Pre-alert acknowledged by receiving desk' : 'Pre-alert sent — awaiting acknowledgement',
          sub: 'Simulated SBAR summary transmitted to ' + esc(tr.destination.name) + '. No real facility has been notified.' })
      : stateBox({ tone: 'rose', icon: 'alert', title: 'Pre-alert not sent', sub: 'Receiving facility has no advance notice of this simulated transfer.' })) + '</div>' +
    '<div class="btn-row mt-12">' + btn(preAlert === 'sent' ? 'Pre-alert sent' : 'Send pre-alert', 'transit-prealert', { cls: 'primary', disabled: preAlert === 'sent', icon: 'send' }) +
      btn(t.acknowledged ? 'Acknowledged' : 'Mark acknowledged', 'transit-ack', { cls: 'ghost', disabled: t.acknowledged || preAlert !== 'sent' }) +
      btn(t.arrivalMarked ? 'Arrival marked' : 'Mark arrived', 'transit-arrived', { cls: 'ghost', disabled: t.arrivalMarked || t.progress < .85 }) + '</div>' +
    (t.progress < .85 ? '<div class="form-hint">Mark arrived is disabled until route progress reaches 85%.</div>' : '');
  var preAlertPanel = panel({ title: 'Receiving facility pre-alert', idx: 'HANDOFF-PREP', tone: 'violet', body: preAlertBody });

  var stagesPanel = panel({ title: 'Transit stages', idx: 'STAGES', tone: 'emerald',
    body: '<div class="stepper">' + tr.stages.map(function (s, i) {
      var done = i < 2 || (i === 2 && t.progress >= 1) || (i === 3 && t.arrivalMarked) || (i === 4 && t.handoff === 'complete');
      var active = (i === 2 && t.progress < 1) || (i === 3 && t.arrivalMarked && t.handoff !== 'complete');
      return '<div class="step ' + (active ? 'active' : done ? 'done' : '') + '"><div class="node"></div>' +
        '<div class="lbl">' + esc(s.label.toUpperCase()) + '<br>' + (s.at ? isoTime(s.at) : '—') + '</div></div>';
    }).join('') + '</div>' +
    '<div class="hr-label">TRANSIT EVENT LOG</div><div class="timeline">' +
    tr.log.slice().reverse().map(function (l) {
      return '<div class="tl-item accent tone-cyan"><div class="tl-head"><span class="tl-title">' + esc(l.label) + '</span><span class="tl-time">' + isoTime(l.at) + '</span></div>' +
        '<div class="tl-actor">' + esc(l.actor) + '</div></div>';
    }).join('') + '</div>' });

  var sbarDone = tr.sbar.filter(function (s) { return t.sbar[s.id]; }).length;
  var sbarBody = (t.handoff === 'complete'
    ? stateBox({ tone: 'emerald', icon: 'check', title: 'SBAR handoff complete', sub: 'All four sections confirmed. Handoff record HND-2048 written to the simulated incident log.', actions: btn('View record', 'open-handoff', { cls: 'tiny' }) }) + '<div class="divider"></div>'
    : '') +
    '<div class="row between mb-12"><span class="fs-11 c-muted">Confirm each section before handoff</span><span class="mono fs-10 c-cyan">' + sbarDone + ' / 4</span></div>' +
    '<div class="protocol-list">' + tr.sbar.map(function (s) {
      return '<label class="check"><input type="checkbox" data-action="transit-sbar" data-arg="' + s.id + '" ' + (t.sbar[s.id] ? 'checked' : '') + '>' +
        '<span><b class="mono">' + s.id + '</b> · ' + esc(s.label) + '<span class="check-meta">' + esc(s.detail) + '</span></span></label>';
    }).join('') + '</div>' +
    '<div class="divider"></div>' +
    btn(t.handoff === 'complete' ? 'Handoff complete' : 'Complete handoff', 'transit-handoff', { cls: 'primary block', icon: 'check',
      disabled: sbarDone < 4 || t.handoff === 'complete' }) +
    '<div class="form-hint">' + (sbarDone < 4 ? 'Disabled: ' + (4 - sbarDone) + ' SBAR section(s) remaining.' : 'Ready to complete simulated handoff.') + '</div>';
  var sbarPanel = panel({ title: 'Structured handoff · SBAR', idx: 'SBAR', tone: 'emerald', body: sbarBody,
    foot: '<span>Handoff is an exercise record.</span>' + tag('NOT A CLINICAL DOCUMENT', 'amber') });

  var notesPanel = panel({ title: 'Crew notes', idx: 'NOTES', tone: 'violet',
    body: '<div class="field"><div class="field-label">Transit observations <span class="hint">local draft</span></div>' +
      '<textarea class="textarea" data-model="transit.notes" placeholder="Document exercise observations…">' + esc(t.notes) + '</textarea></div>' +
      '<div class="btn-row">' + btn('Save note', 'transit-save-note', { cls: 'primary', disabled: !t.notes.trim() }) +
      btn('Clear', 'transit-clear-note', { cls: 'ghost tiny' }) + '</div>' +
      '<div class="panel-note">Notes are stored only in this browser session and are not sent anywhere.</div>' });

  return head + topNotice + strip + '<div class="grid g-transit">' +
    '<div class="stack">' + telemetryPanel + interventionsPanel + '</div>' +
    '<div class="stack">' + mapPanel + preAlertPanel + stagesPanel + '</div>' +
    '<div class="stack">' + sbarPanel + notesPanel + '</div>' + '</div>';
}

/* ==========================================================================
   05 — ADMIN GOVERNANCE
   ========================================================================== */
function viewAdmin() {
  var a = S.admin, m = D.metrics;
  var head = screenHead({
    eyebrow: 'WORKSPACE 05 / ADMINISTRATION',
    title: 'System governance & audit',
    sub: 'Operational metrics, model registry, safety-rule controls, and tamper-evident audit activity for the simulated platform.',
    meta: '<span>' + tag('SANDBOX METRICS', 'amber') + '</span><span>' + tag('INTEGRITY ' + (a.integrity === 'success' ? 'VERIFIED' : 'LAST CHECK ' + isoTime(m.integrityLastCheck)), a.integrity === 'error' ? 'rose' : 'emerald') + '</span><span class="sep"></span><span>' + num(m.auditEventsToday, 0) + ' AUDIT EVENTS TODAY</span>',
    actions: btn('State library', 'states', { cls: 'ghost optional', icon: 'layers' }) +
      btn(a.integrity === 'loading' ? 'Checking…' : 'Run integrity check', 'admin-integrity', { cls: 'ghost', icon: 'shield', loading: a.integrity === 'loading' }) +
      btn(a.exportBusy ? 'Preparing…' : 'Export audit bundle', 'admin-export', { cls: 'primary', icon: 'download', loading: a.exportBusy })
  });
  var topNotice = notice('violet', 'GOVERNANCE DATA IS SYNTHETIC',
    'All metrics, hashes, model versions, approvals, and safety-rule evaluations are generated for interface demonstration. <b>No production system is described or controlled here.</b>');

  var kpis = '<div class="kpi-strip">' + m.kpis.map(function (k) {
    return '<div class="kpi tone-' + k.tone + '"><div class="kpi-label">' + esc(k.label.toUpperCase()) + '</div>' +
      '<div class="kpi-main"><div class="kpi-value">' + esc(k.value) + '</div>' +
      '<div class="kpi-side"><span class="kpi-delta">' + esc(k.delta) + '</span>' + sparkline(k.spark, k.tone === 'neutral' ? 'cyan' : k.tone, 54, 20) + '</div></div>' +
      '<div class="kpi-sub">' + esc(k.sub) + '</div></div>';
  }).join('') + '</div>';

  var volumePanel = panel({ title: 'Case volume & escalation rate · 24h', idx: 'OPS-01', tone: 'cyan',
    meta: tag('SANDBOX CLOCK', 'amber'),
    body: '<div class="chart-box">' + volumeChart() +
      '<div class="legend"><span class="item tone-cyan"><span class="swatch"></span>Cases / hour</span>' +
      '<span class="item tone-rose"><span class="swatch"></span>Escalations × 4 (scaled)</span>' +
      '<span class="item"><span class="swatch box" style="background:var(--cyan)"></span>Confidence band</span>' +
      '<span class="item" style="margin-left:auto">UPDATED ' + isoTime(m.updatedAt) + '</span></div></div>',
    foot: '<span>Escalation line is scaled ×4 for visual comparison against case volume.</span>' + tag('SIMULATED AGGREGATES', 'amber') });

  var segBody = '<div class="panel-sub">MODEL DISCRIMINATION BY COHORT SEGMENT</div>' +
    '<div class="seg-bars">' + m.segments.map(function (s) {
      return '<div class="seg-row tone-' + s.tone + '"><span class="seg-label">' + esc(s.label) + '</span>' +
        '<div class="seg-track"><div class="seg-fill" style="width:' + (s.value * 100) + '%"></div>' +
        '<div class="seg-target" style="left:' + (s.target * 100) + '%" title="Target ' + num(s.target * 100, 0) + '%"></div></div>' +
        '<span class="seg-val">' + num(s.value * 100, 0) + '%</span></div>';
    }).join('') + '</div>' +
    '<div class="hr-label">GOVERNANCE NOTES</div>' +
    '<div class="callout tone-amber"><b>3 segments below target.</b> Older cohorts and sparse-data records show reduced simulated performance. SR-07 requires human sign-off when feature drift exceeds 0.18.</div>' +
    '<div class="mini-list mt-12">' + statRow('Evaluated on', 'Synthetic cohort only') + statRow('Target threshold', '0.85 / 0.80 sparse') +
      statRow('Last calibration', '2026-09-30') + statRow('Drift control', 'SR-07 · ENABLED') + '</div>';
  var segPanel = panel({ title: 'Performance by segment', idx: 'OPS-02', tone: 'violet',
    meta: tag('TARGET MARKED', 'muted'), body: segBody });

  var modelRows = D.models.map(function (mo) {
    var tone = mo.status === 'Production' ? 'emerald' : mo.status === 'Candidate' ? 'amber' : 'rose';
    var driftTone = mo.drift > .18 ? 'rose' : mo.drift > .12 ? 'amber' : 'emerald';
    return '<tr><td><div class="strong mono">' + esc(mo.id) + '</div><div class="cell-meta">v' + esc(mo.version) + ' · ' + esc(mo.owner) + '</div></td>' +
      '<td>' + esc(mo.purpose) + '</td><td>' + statusTag(mo.status) + '</td>' +
      '<td class="mono">' + (mo.deployedAt ? isoDate(mo.deployedAt).slice(0, 10) : '—') + '</td>' +
      '<td>' + tag(num(mo.drift, 2), driftTone) + '</td><td class="mono">' + num(mo.coverage * 100, 0) + '%</td>' +
      '<td class="mono ' + (mo.approval === 'PENDING' ? 'c-amber' : mo.approval === 'REVOKED' ? 'c-rose' : '') + '">' + esc(mo.approval) + '</td>' +
      '<td>' + (mo.status === 'Production'
        ? '<button class="link" data-action="admin-rollback" data-arg="' + esc(mo.id + '|' + mo.version) + '">Rollback</button>'
        : '<button class="link" data-action="admin-review" data-arg="' + esc(mo.id + '|' + mo.version) + '">Review</button>') + '</td></tr>';
  }).join('');
  var modelsPanel = panel({ title: 'Model registry', idx: 'GOV-01', tone: 'violet', flush: true,
    meta: tag(D.models.length + ' VERSIONS', 'muted'),
    body: '<div class="table-wrap"><table class="table compact"><thead><tr><th>Model</th><th>Purpose</th><th>Status</th><th>Deployed</th><th>Drift</th><th>Coverage</th><th>Approval</th><th>Action</th></tr></thead><tbody>' + modelRows + '</tbody></table></div>',
    foot: '<span>Rollback requires a second administrator in a real deployment; simulated here.</span>' + tag('SYNTHETIC REGISTRY', 'amber') });

  var ruleRows = D.safetyRules.map(function (r) {
    var busy = a.ruleBusy === r.id;
    var err = r.evaluation === 'error';
    return '<tr><td class="mono c-cyan">' + esc(r.id) + '</td><td><div class="strong">' + esc(r.name) + '</div>' +
      '<div class="cell-meta">' + esc(r.condition) + '</div></td>' +
      '<td>' + tag(r.severity.toUpperCase(), r.severity === 'critical' ? 'rose' : r.severity === 'high' ? 'amber' : 'muted') + '</td>' +
      '<td class="mono fs-10">' + esc(r.owner) + '</td>' +
      '<td class="mono">' + r.hits24h + '</td>' +
      '<td>' + (err ? '<span class="row tight c-rose">' + icon('x') + tag('EVAL ERROR', 'rose') +
          '<button class="link" data-action="admin-rule-retry" data-arg="' + r.id + '">Retry</button></span>' : tag('PASS', 'emerald')) + '</td>' +
      '<td><label class="switch' + (busy ? ' busy' : '') + '"><input type="checkbox" data-action="admin-rule-toggle" data-arg="' + r.id + '" ' + (r.enabled ? 'checked' : '') + (busy ? ' disabled' : '') +
        '><span class="track"></span></label></td></tr>';
  }).join('');
  var rulesPanel = panel({ title: 'Safety rules & evaluation', idx: 'GOV-02', tone: 'amber', flush: true,
    meta: tag(D.safetyRules.filter(function (r) { return r.enabled; }).length + ' / ' + D.safetyRules.length + ' ENABLED', 'amber'),
    body: (a.ruleRetry ? stateBox({ tone: 'emerald', icon: 'check', title: 'Rule ' + esc(a.ruleRetry) + ' re-evaluated', sub: 'Evaluation pipeline recovered. Last 24h hits recalculated; no records were changed.' }) + '<div style="padding:0 11px">' : '') +
      '<div class="table-wrap"><table class="table compact rules-table"><thead><tr><th>ID</th><th>Rule / condition</th><th>Severity</th><th>Owner</th><th>Hits 24h</th><th>Eval</th><th>Enabled</th></tr></thead><tbody>' + ruleRows + '</tbody></table></div>' + (a.ruleRetry ? '</div>' : ''),
    foot: '<span>Rule owners and 24h hit counts are in the JSON export.</span>' + tag('SIMULATED CONTROLS', 'amber') });

  var auditFilters = [['all', 'All'], ['success', 'Success'], ['error', 'Errors'], ['unverified', 'Unverified'], ['blocked', 'Blocked']];
  var auditList = D.audit.filter(function (e) {
    if (a.auditFilter === 'all') return true;
    if (a.auditFilter === 'unverified') return !e.verified;
    if (a.auditFilter === 'error') return e.outcome === 'error';
    if (a.auditFilter === 'blocked') return e.outcome === 'blocked';
    return e.outcome === 'success';
  });
  var auditBody = '<div class="row between" style="padding:9px 11px;border-bottom:1px solid var(--line)">' +
    '<div class="seg">' + auditFilters.map(function (f) {
      return '<button data-action="admin-audit-filter" data-arg="' + f[0] + '" class="' + (a.auditFilter === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="btn-row">' + btn(a.verifyBusy ? 'Verifying…' : 'Verify hash chain', 'admin-verify', { cls: 'ghost tiny', icon: 'shield', loading: a.verifyBusy }) +
      btn('Export JSON', 'admin-export', { cls: 'ghost tiny', icon: 'download' }) + '</div></div>' +
    (a.integrity === 'loading' ? skeletonRows(5)
      : auditList.length ? '<div class="table-wrap"><table class="table compact"><thead><tr><th>Event</th><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Resource</th><th>Outcome</th><th>Hash</th></tr></thead><tbody>' +
        auditList.map(function (e) {
          return '<tr><td class="mono c-cyan">' + esc(e.id) + '</td><td class="mono">' + isoDate(e.at) + '</td>' +
            '<td class="mono fs-10">' + esc(e.actor) + '</td><td class="fs-10">' + esc(e.role) + '</td>' +
            '<td class="mono fs-10">' + esc(e.action) + '</td><td class="mono fs-10">' + esc(e.resource) + '</td>' +
            '<td>' + tag(e.outcome.toUpperCase(), e.outcome === 'success' ? 'emerald' : 'rose') + '</td>' +
            '<td class="mono fs-10">' + (e.hash ? esc(e.hash) + ' ' + tag('VERIFIED', 'emerald') : tag('UNHASHED', 'rose')) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : emptyState(a.auditFilter === 'blocked' ? 'No policy blocks recorded' : 'No events in this filter',
          a.auditFilter === 'blocked' ? 'No access or safety policy has blocked an action in this simulated window. This is a healthy empty state.' : 'No audit event matches the selected view. Switch back to All events to continue.',
          btn('Show all events', 'admin-audit-all', { cls: 'ghost tiny' }))) +
    (a.integrity === 'success' ? '<div style="padding:10px 11px;border-top:1px solid var(--line)">' +
      stateBox({ tone: 'emerald', icon: 'check', title: 'Integrity check passed', sub: '7 of 7 hashed events verified against the simulated chain head 7e12…b0aa. 1 error event is intentionally unhashed and remains excluded.' }) + '</div>' : '') +
    (a.integrity === 'error' ? '<div style="padding:10px 11px;border-top:1px solid var(--line)">' +
      stateBox({ tone: 'rose', icon: 'x', title: 'Hash chain verification failed', sub: 'Event AUD-91819 has no hash. Retry after the simulated writer recovers.', actions: btn('Retry check', 'admin-integrity', { cls: 'tiny' }) }) + '</div>' : '');
  var auditPanel = panel({ title: 'Audit activity', idx: 'GOV-03', tone: 'emerald', flush: true,
    meta: tag(auditList.length + ' EVENTS', 'muted'), body: auditBody,
    foot: '<span>Append-only simulated ledger · hashes are illustrative.</span>' + tag('NO REAL PHI', 'emerald') });

  var approvalBody;
  if (!a.approvals.length) {
    approvalBody = emptyState('No open approval requests', 'Model changes, rule exceptions, and access requests appear here for governance review.',
      btn('Create review request', 'admin-approval-request', { cls: 'ghost tiny', icon: 'plus' }));
  } else {
    approvalBody = a.approvals.map(function (ap) {
      return '<div class="evidence-item"><div class="ev-top"><div class="ev-title">' + esc(ap.title) + '</div>' +
        tag(ap.status === 'approved' ? 'APPROVED' : ap.status === 'rejected' ? 'REJECTED' : 'PENDING', ap.status === 'approved' ? 'emerald' : ap.status === 'rejected' ? 'rose' : 'amber') + '</div>' +
        '<div class="ev-meta">' + esc(ap.id) + ' · requested by ' + esc(ap.actor) + ' · ' + esc(ap.scope) + '</div>' +
        '<div class="ev-excerpt">' + esc(ap.detail) + '</div>' +
        (ap.status === 'pending' ? '<div class="ev-actions">' + btn('Approve', 'admin-approval', { cls: 'primary tiny', arg: ap.id + '|approve' }) +
          btn('Reject', 'admin-approval', { cls: 'ghost tiny', arg: ap.id + '|reject' }) + '</div>' : '') + '</div>';
    }).join('') + '<div class="btn-row mt-12">' + btn('New review request', 'admin-approval-request', { cls: 'ghost tiny', icon: 'plus' }) + '</div>';
  }
  var approvalPanel = panel({ title: 'Governance approval queue', idx: 'GOV-04', tone: 'violet', body: approvalBody,
    foot: '<span>Empty state is intentional — no pending work.</span>' + tag('SIMULATED WORKFLOW', 'amber') });

  // Two independent columns keep the tall rules table from creating dead space
  // under the shorter registry. The audit ledger gets the full content width.
  return head + topNotice + kpis +
    '<div class="grid g-admin">' + volumePanel + segPanel + '</div>' +
    '<div class="grid g-admin mt-12">' +
      '<div class="stack">' + modelsPanel + approvalPanel + '</div>' +
      '<div class="stack">' + rulesPanel + '</div>' +
    '</div>' +
    '<div class="mt-12">' + auditPanel + '</div>';
}
