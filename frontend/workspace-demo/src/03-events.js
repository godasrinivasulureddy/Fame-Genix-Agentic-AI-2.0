
/* ============================================================================
   FAME-GENIX 2.0 — Interaction layer, simulated state transitions, tickers
   ========================================================================== */
function setPath(obj, path, value) {
  var parts = path.split('.'), cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function applyModel(path, value) {
  if (path === 'searchQuery') { S.searchQuery = value; return; }
  if (path.indexOf('intake.') === 0) { setPath(S.patient, path, value); return; }
  if (path.indexOf('consult.') === 0 || path.indexOf('emergency.') === 0) { setPath(S.modalState, path, value); return; }
  setPath(S, path, value);
}
function later(ms, fn) { return setTimeout(fn, ms); }
function nowIso() { return new Date(S.now).toISOString(); }
function randomHash() {
  var h = Math.random().toString(16).slice(2, 6);
  var t = Math.random().toString(16).slice(2, 6);
  return h + '…' + t;
}
function addAudit(action, resource, actor, role, outcome) {
  D.audit.unshift({
    id: 'AUD-' + (91824 + D.audit.length), at: nowIso(), actor: actor, role: role,
    action: action, resource: resource, outcome: outcome || 'success',
    hash: outcome === 'error' ? null : randomHash(), verified: outcome !== 'error'
  });
}
function makeIncident(opts) {
  var n = 1049 + D.incidents.filter(function (i) { return /1049|1050|1051|1052/.test(i.id); }).length;
  var at = nowIso();
  var gridMatch = (opts.location.match(/Grid (\d+)/) || [])[1];
  var inc = {
    id: 'INC-2026-' + n, type: opts.type + ' — simulated', severity: opts.severity,
    status: 'Reported', stageIndex: 0, location: opts.location, grid: 'G' + (gridMatch || '12') + '-NEW',
    caller: opts.caller, channel: opts.channel, reportedAt: at,
    patientId: D.patient.id, patientName: D.patient.legalName,
    coords: { patient: { x: 186, y: 176 }, unit: { x: 186, y: 176 }, hospital: { x: 520, y: 92 } },
    assignedUnit: null, consentVerified: true, simulated: true,
    protocol: D.incidents[0].protocol.map(function (p) {
      return { id: p.id, label: p.label, done: false, rule: p.rule };
    }),
    comms: [{ at: at, from: 'System', text: 'Simulated incident created. SR-06 exercise label applied to all downstream events.', kind: 'internal' }],
    log: [{ at: at, label: 'Reported', actor: opts.caller }]
  };
  D.incidents.unshift(inc);
  S.operator.selected = inc.id;
  S.operator.filter = 'active';
  S.operator.selectedUnit = 'AMB-07';
  return inc;
}

/* ------------------------------------------------------- live UI syncing --- */
function syncIntakeUi() {
  var i = S.patient.intake;
  var ready = i.description.trim().length >= 12 && i.status !== 'loading';
  $$('button[data-action="intake-submit"].btn').forEach(function (b) {
    if (!b.classList.contains('tiny')) b.disabled = !ready;
  });
  var hint = $('[data-intake-hint]');
  if (hint) hint.textContent = ready ? 'Ready to submit · evaluated against 8 safety rules.' : 'Disabled: enter at least 12 characters in the description to enable submission.';
}
function syncDecisionUi() {
  var d = S.doctor, c = activeCase();
  if (!c) return;
  var needsOverride = (d.disposition === 'Monitor' || d.disposition === 'Close') && c.risk >= 60;
  var canSign = d.note.trim().length >= 20 && !!d.disposition && d.acknowledged &&
    (!needsOverride || d.override.trim().length >= 8) && d.decisionStatus !== 'loading';
  $$('button[data-action="doctor-submit"]').forEach(function (b) {
    if (b.classList.contains('primary')) b.disabled = !canSign;
  });
  var count = $('[data-note-count]');
  if (count) count.textContent = d.note.trim().length + ' / 20 characters minimum · stored locally in this sandbox.';
  var hint = $('[data-decision-hint]');
  if (hint) hint.textContent = !d.note.trim() || d.note.trim().length < 20 ? 'Disabled: add an assessment note of at least 20 characters.'
    : !d.disposition ? 'Disabled: choose a disposition.'
    : needsOverride && d.override.trim().length < 8 ? 'Disabled: document the override rationale.'
    : !d.acknowledged ? 'Disabled: confirm the acknowledgement checkbox.'
    : 'Ready to sign · writes DEC record and audit event.';
}
function syncDraftButtons() {
  $$('button[data-action="op-comms-submit"]').forEach(function (b) { b.disabled = !S.operator.commDraft.trim(); });
  $$('button[data-action="transit-save-note"]').forEach(function (b) { b.disabled = !S.transit.notes.trim(); });
}
function copyText(text) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard', 'JSON copied from the sandbox inspector.', 'emerald'); }
    catch (err) { toast('Copy unavailable', 'Use Download JSON instead in this browser.', 'amber'); }
    ta.remove();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      toast('Copied to clipboard', 'JSON copied from the sandbox inspector.', 'emerald');
    }).catch(fallback);
  } else fallback();
}

/* ----------------------------------------------------------------- actions --- */
function handleAction(action, arg, el) {
  var i, v, c, inc, u, r, file;
  switch (action) {

    /* ---- global --------------------------------------------------------- */
    case 'noop': return;
    case 'nav':
      S.view = arg; S.search = null; render(); return;
    case 'states': openModal('states'); return;
    case 'close-modal': closeModal(); return;
    case 'close-drawer': S.drawerOpen = false; renderOverlay(); return;
    case 'open-drawer': S.drawerOpen = true; renderOverlay(); return;
    case 'open-drawer-case': S.drawerTab = 'cases'; S.drawerOpen = true; renderOverlay(); return;
    case 'open-drawer-risk': S.drawerTab = 'risk'; S.drawerOpen = true; renderOverlay(); return;
    case 'open-drawer-incident': S.drawerTab = 'incident'; S.drawerOpen = true; renderOverlay(); return;
    case 'drawer-tab': S.drawerTab = arg; renderOverlay(); return;
    case 'copy-json': copyText(JSON.stringify(drawerData(), null, 2)); return;
    case 'download-json':
      downloadJson('fgx-' + S.drawerTab + '-SIMULATED.json', drawerData());
      toast('JSON downloaded', 'Synthetic ' + S.drawerTab + ' data exported from the inspector.', 'emerald'); return;
    case 'search': S.search = true; S.searchQuery = ''; renderOverlay(); return;
    case 'search-goto': S.search = null; S.view = arg; render(); return;
    case 'search-case':
      S.search = null; S.view = 'doctor'; S.doctor.selected = arg; resetDecisionDraft(); render(); return;
    case 'search-incident':
      S.search = null; S.view = 'operator'; S.operator.selected = arg; S.operator.filter = 'all'; render(); return;
    case 'search-evidence': S.search = null; renderOverlay(); openModal('evidence', { id: arg }); return;
    case 'state-retry':
      S.modalState.retried = true; renderOverlay();
      toast('Request retried', 'Evidence service responded within 240 ms. No partial results were written.', 'emerald'); return;
    case 'modal-attach': closeModal(); openModal('upload', {}, { phase: 'select' }); return;
    case 'nav-doctor-cases': S.view = 'doctor'; S.doctor.selected = 'CASE-4417'; S.doctor.filter = 'all'; render(); return;
    case 'goto-doctor': closeModal(); S.view = 'doctor'; render(); return;
    case 'goto-operator': closeModal(); S.view = 'operator'; render(); return;
    case 'goto-transit': S.view = 'transit'; render(); return;
    case 'goto-admin-rules': S.view = 'admin'; render(); toast('Governance view', 'Safety-rule controls are in the GOV-02 panel.', 'cyan'); return;
    case 'goto-admin-audit': S.view = 'admin'; S.admin.auditFilter = 'all'; render(); return;

    /* ---- patient -------------------------------------------------------- */
    case 'export-summary':
      downloadJson('fgx-patient-summary-SIMULATED.json', {
        _notice: D.meta.notice, exportedAt: nowIso(), patient: D.patient,
        vitals: D.vitals, riskAssessment: D.risk, careLevel: D.careLevels[2],
        safetyRules: D.safetyRules, careTimeline: D.timeline, reports: S.patient.reports
      });
      toast('Summary exported', 'A synthetic patient summary JSON was generated locally.', 'emerald'); return;
    case 'open-consult': openModal('consult', {}, { phase: 'form' }); return;
    case 'open-emergency': openModal('emergency', {}, { phase: 'form' }); return;
    case 'intake-chip':
      i = S.patient.intake.symptoms.indexOf(arg);
      if (i >= 0) S.patient.intake.symptoms.splice(i, 1); else S.patient.intake.symptoms.push(arg);
      render(); return;
    case 'intake-submit':
      S.patient.intake.status = 'loading'; render();
      later(850, function () {
        S.patient.intake.status = 'success';
        S.patient.intake.recordId = uid('INT');
        D.timeline.unshift({
          id: uid('TL'), at: nowIso(), actor: 'Patient', type: 'intake',
          title: 'Structured intake submitted', detail: S.patient.intake.description.slice(0, 60) + ' · severity ' + S.patient.intake.severity + '/10',
          status: 'triaged'
        });
        addAudit('INTAKE_SUBMITTED', S.patient.intake.recordId, 'patient.20418', 'Patient');
        render();
        toast('Intake ' + S.patient.intake.recordId + ' saved', 'Safety rules SR-02 and SR-03 evaluated. No diagnosis was produced.', 'emerald');
      }); return;
    case 'intake-fail':
      S.patient.intake.status = 'error'; render();
      toast('Intake save failed', 'Simulated triage timeout E-INT-503. Draft preserved.', 'rose'); return;
    case 'intake-reset':
      S.patient.intake = {
        description: '', onset: '1–2 days', duration: '2', durationUnit: 'days', severity: 5,
        symptoms: [], measurements: { hr: '108', spo2: '93', temp: '37.9' },
        status: 'idle', recordId: null, report: null
      };
      render(); return;
    case 'open-upload': openModal('upload', {}, { phase: 'select' }); return;
    case 'pick-file': S.modalState.file = arg; S.modalState.phase = 'select'; renderOverlay(); return;
    case 'upload-run':
      S.modalState.phase = 'uploading'; renderOverlay();
      later(560, function () {
        S.modalState.phase = 'parsing'; renderOverlay();
        later(720, function () { S.modalState.phase = 'success'; renderOverlay(); });
      }); return;
    case 'upload-error': S.modalState.phase = 'error'; renderOverlay(); return;
    case 'upload-reset': S.modalState.phase = 'select'; renderOverlay(); return;
    case 'upload-attach':
      file = (D.evidence.length && [{ id: 'RPT-1', name: 'pulmonary_function_summary.pdf' }, { id: 'RPT-2', name: 'device_export_24h.csv' }].filter(function (f) { return f.id === S.modalState.file; })[0]) || { id: 'RPT-2291', name: 'synthetic_report.pdf' };
      S.patient.reports.push({ id: uid('RPT'), name: file.name, parsedAt: nowIso(), confidence: 0.68 });
      D.timeline.unshift({ id: uid('TL'), at: nowIso(), actor: 'Document parser (SIM)', type: 'report', title: 'Report parsed and attached', detail: esc(file.name) + ' · 4 values extracted · verification required', status: 'parsed' });
      closeModal(); render();
      toast('Report attached', '4 synthetic values extracted and flagged for clinician verification.', 'emerald'); return;
    case 'vital-detail': openModal('vital', { id: arg }); return;
    case 'telemetry-toggle':
      S.patient.telemetry.live = !S.patient.telemetry.live;
      if (S.patient.telemetry.live) S.patient.telemetry.error = false;
      render();
      toast(S.patient.telemetry.live ? 'Telemetry resumed' : 'Telemetry paused', 'Simulated device stream only; no real sensor is connected.', S.patient.telemetry.live ? 'emerald' : 'amber'); return;
    case 'telemetry-error':
      S.patient.telemetry.error = true; S.patient.telemetry.live = false; render();
      toast('Feed error simulated', 'Displaying last cached samples with a persistent error banner.', 'rose'); return;
    case 'telemetry-retry':
      S.patient.telemetry.error = false; S.patient.telemetry.live = true;
      S.patient.telemetry.lastSync = S.now; render();
      toast('Feed restored', 'Cached values replaced with new simulated samples.', 'emerald'); return;
    case 'chart-toggle':
      i = S.patient.chart.indexOf(arg);
      if (i >= 0) { if (S.patient.chart.length > 1) S.patient.chart.splice(i, 1); }
      else S.patient.chart.push(arg);
      if (S.patient.chart.length === 1 && $('#trendChart')) { $('#trendChart').innerHTML = trendChart(); }
      render(); return;
    case 'view-evidence': openModal('evidence', { id: arg }); return;
    case 'evidence-appraise':
      closeModal(); toast('Appraisal requested', 'Evidence Ops will review synthetic citation ' + arg + '.', 'violet'); return;
    case 'rerun-risk':
      S.patient.risk.loading = true; render();
      later(900, function () {
        var scores = [64, 60, 61, 62];
        S.patient.risk.runCount++;
        S.patient.risk.score = scores[S.patient.risk.runCount % scores.length];
        S.patient.risk.band = S.patient.risk.score >= 70 ? 'High' : S.patient.risk.score >= 40 ? 'Moderate' : 'Low';
        S.patient.risk.computedAt = nowIso();
        S.patient.risk.loading = false;
        addAudit('RISK_ASSESSMENT_CREATED', 'RA-' + (90215 + S.patient.risk.runCount), 'model.fgx-risk', 'Service account');
        render();
        toast('Assessment recomputed', 'Simulated score ' + S.patient.risk.score + '/100 · clinician review still required.', 'violet');
      }); return;
    case 'consult-consent': S.modalState.consent = el.checked; renderOverlay(); return;
    case 'consult-submit':
      S.modalState.phase = 'loading'; renderOverlay();
      later(780, function () {
        var slotEl = $('#consultSlot');
        var slot = slotEl ? slotEl.value : D.consultation.slot;
        S.patient.consult.slot = slot;
        S.modalState = { phase: 'success', id: uid('CONS'), slot: slot, consent: true };
        render();
        toast(S.modalState.id + ' requested', 'Simulated consultation slot reserved. No clinician was contacted.', 'emerald');
      }); return;
    case 'emergency-consent': S.modalState.consent = el.checked; renderOverlay(); return;
    case 'emergency-submit':
      S.modalState.phase = 'loading';
      S.modalState.scenario = ($('#emScenario') || {}).value || 'Breathing difficulty';
      renderOverlay();
      later(880, function () {
        var inc2 = makeIncident({
          type: S.modalState.scenario, severity: 'High', location: D.patient.addressLabel,
          caller: 'Patient app (simulated)', channel: 'In-app emergency button'
        });
        addAudit('SIMULATED_EMERGENCY_TRIGGERED', inc2.id, 'patient.20418', 'Patient');
        S.modalState = { phase: 'success', id: inc2.id, scenario: S.modalState.scenario, consent: true };
        render();
        toast(inc2.id + ' created', 'Simulated incident queued for operator verification. No emergency service contacted.', 'rose');
      }); return;

    /* ---- doctor --------------------------------------------------------- */
    case 'doctor-filter': S.doctor.filter = arg; render(); return;
    case 'doctor-clear-filters': S.doctor.filter = 'all'; S.doctor.query = ''; S.doctor.myQueue = true; render(); return;
    case 'doctor-myqueue': S.doctor.myQueue = el.checked; render(); return;
    case 'doctor-verified': S.doctor.verifiedOnly = el.checked; render(); return;
    case 'refresh-queue':
      S.doctor.refreshBusy = true; render();
      later(720, function () { S.doctor.refreshBusy = false; render(); toast('Queue refreshed', '7 simulated cases · 2 urgent · SLA unchanged.', 'cyan'); }); return;
    case 'select-case':
      S.doctor.selected = arg; S.doctor.loading = true; resetDecisionDraft(); render();
      later(360, function () { S.doctor.loading = false; render(); }); return;
    case 'select-first-case':
      var first = doctorFilteredCases()[0] || D.cases[0];
      S.doctor.selected = first.id; S.doctor.filter = 'all'; S.doctor.query = ''; S.doctor.myQueue = true;
      S.doctor.loading = false; resetDecisionDraft(); render(); return;
    case 'assign-case':
      c = activeCase(); if (!c) return;
      c.assignedTo = 'Dr. Isha Raman'; c.status = 'In review';
      c.audit.unshift({ at: nowIso(), actor: 'Dr. Isha Raman', action: 'Accepted case', result: 'In review' });
      addAudit('CASE_ACCEPTED', c.id, 'dr.iraman', 'Doctor');
      render(); toast('Case accepted', c.id + ' assigned to Dr. Isha Raman.', 'emerald'); return;
    case 'doctor-disposition': S.doctor.disposition = arg; render(); return;
    case 'doctor-ack': S.doctor.acknowledged = el.checked; syncDecisionUi(); return;
    case 'doctor-submit':
      S.doctor.decisionStatus = 'loading'; render();
      later(860, function () {
        c = activeCase(); if (!c) return;
        S.doctor.decisionStatus = 'success';
        S.doctor.decisionId = uid('DEC');
        c.decisionId = S.doctor.decisionId; c.disposition = S.doctor.disposition;
        c.note = S.doctor.note; c.status = 'Ready to close';
        c.audit.unshift({ at: nowIso(), actor: 'Dr. Isha Raman', action: 'Signed decision', result: S.doctor.disposition });
        addAudit('DECISION_SIGNED', S.doctor.decisionId, 'dr.iraman', 'Doctor');
        render();
        toast(S.doctor.decisionId + ' signed', 'Case ' + c.id + ' moved to Ready to close. Audit hash written.', 'emerald');
      }); return;
    case 'doctor-fail': S.doctor.decisionStatus = 'error'; render(); toast('Sign-off failed', 'Simulated audit writer error E-SIGN-409. Draft preserved.', 'rose'); return;
    case 'doctor-dismiss-error': S.doctor.decisionStatus = 'idle'; render(); return;

    /* ---- operator ------------------------------------------------------- */
    case 'op-filter': S.operator.filter = arg; render(); return;
    case 'op-show-all': S.operator.filter = 'all'; render(); return;
    case 'select-incident':
      S.operator.selected = arg;
      inc = activeIncident();
      S.operator.selectedUnit = inc.assignedUnit || D.units[0].id;
      render(); return;
    case 'open-incident-modal': openModal('incident', {}, { phase: 'form' }); return;
    case 'incident-submit':
      S.modalState.phase = 'loading'; renderOverlay();
      later(760, function () {
        var inc3 = makeIncident({
          type: ($('#incType') || {}).value || 'Breathing difficulty',
          severity: ($('#incSeverity') || {}).value || 'High',
          location: ($('#incGrid') || {}).value || D.patient.addressLabel,
          caller: 'Operator M. Sen · drill', channel: ($('#incChannel') || {}).value || 'Operator drill console'
        });
        addAudit('SIMULATED_INCIDENT_CREATED', inc3.id, 'operator.msen', 'Emergency operator');
        closeModal(); render();
        toast(inc3.id + ' created', 'Exercise incident awaiting verification. SR-06 label applied.', 'rose');
      }); return;
    case 'select-unit':
      u = find(D.units, 'id', arg);
      if (!u || u.disabledReason) { toast('Unit unavailable', u ? u.disabledReason : 'Unknown unit.', 'rose'); return; }
      S.operator.selectedUnit = arg; render(); return;
    case 'clear-unit': S.operator.selectedUnit = null; render(); return;
    case 'assign-unit':
      inc = activeIncident(); u = find(D.units, 'id', S.operator.selectedUnit);
      if (!inc || !u || u.disabledReason) return;
      S.operator.assignBusy = true; render();
      later(620, function () {
        inc.assignedUnit = u.id;
        u.status = u.status === 'Available' ? 'Assigned' : u.status;
        if (inc.stageIndex < 3) { inc.stageIndex = 3; inc.status = 'Unit assigned'; }
        inc.log.push({ at: nowIso(), label: 'Unit assigned', actor: 'Operator M. Sen' });
        inc.comms.push({ at: nowIso(), from: 'Dispatch (SIM)', text: u.id + ' assigned to ' + inc.id + '. Simulation label applied.', kind: 'outbound' });
        addAudit('INCIDENT_UNIT_ASSIGNED', inc.id, 'operator.msen', 'Emergency operator');
        S.operator.assignBusy = false; render();
        toast(u.id + ' assigned', inc.id + ' updated. No real dispatch signal was sent.', 'emerald');
      }); return;
    case 'advance-status':
      inc = activeIncident();
      if (!inc || inc.stageIndex >= 6 || (!inc.assignedUnit && inc.stageIndex >= 2)) return;
      S.operator.advanceBusy = true; render();
      later(560, function () {
        inc.stageIndex++;
        inc.status = D.incidentStages[inc.stageIndex];
        inc.log.push({ at: nowIso(), label: inc.status, actor: 'Operator M. Sen' });
        inc.comms.push({ at: nowIso(), from: 'Operator M. Sen', text: 'Status advanced to ' + inc.status + ' (simulated exercise).', kind: 'internal' });
        addAudit('INCIDENT_STATUS_CHANGED', inc.id, 'operator.msen', 'Emergency operator');
        S.operator.advanceBusy = false; render();
        toast('Status → ' + inc.status, 'Incident log and audit trail updated.', 'cyan');
      }); return;
    case 'op-protocol':
      inc = activeIncident(); if (!inc) return;
      var pr = find(inc.protocol, 'id', arg); if (pr) pr.done = el.checked;
      render(); return;
    case 'op-comms-submit':
      inc = activeIncident(); if (!inc || !S.operator.commDraft.trim()) return;
      inc.comms.push({ at: nowIso(), from: 'Operator M. Sen', text: S.operator.commDraft.trim(), kind: 'internal' });
      S.operator.commDraft = ''; render();
      toast('Update posted', 'Internal exercise channel only. No external message sent.', 'violet'); return;
    case 'op-comms-clear': S.operator.commDraft = ''; render(); return;
    case 'export-incident':
      inc = activeIncident();
      downloadJson('fgx-' + inc.id + '-SIMULATED.json', { _notice: D.meta.notice, exportedAt: nowIso(), incident: inc, stages: D.incidentStages });
      toast('Incident exported', inc.id + ' written as a synthetic JSON exercise record.', 'emerald'); return;

    /* ---- transit -------------------------------------------------------- */
    case 'transit-signal-toggle':
      S.transit.signalLost = !S.transit.signalLost; render();
      toast(S.transit.signalLost ? 'Telemetry lost' : 'Telemetry recovered',
        S.transit.signalLost ? 'Showing cached values with an explicit error state.' : 'Live simulated samples resumed.',
        S.transit.signalLost ? 'rose' : 'emerald'); return;
    case 'transit-retry':
      S.transit.signalLost = false; render();
      toast('Link restored', 'Cached samples discarded. Simulated telemetry resumed.', 'emerald'); return;
    case 'transit-advance':
      S.transit.progress = clamp(S.transit.progress + .15, 0, 1); render();
      if (S.transit.progress >= 1) toast('Route complete', 'Unit has reached the simulated receiving facility.', 'emerald'); return;
    case 'transit-prealert':
      S.transit.preAlert = 'sent'; render();
      toast('Pre-alert sent', 'Simulated SBAR summary sent to a fictional receiving desk.', 'violet'); return;
    case 'transit-ack':
      S.transit.acknowledged = true; render();
      toast('Acknowledged', 'Receiving desk acknowledged the simulated pre-alert.', 'emerald'); return;
    case 'transit-arrived':
      S.transit.arrivalMarked = true; S.transit.progress = 1; render();
      toast('Arrival recorded', 'Transit stage updated in the exercise log.', 'emerald'); return;
    case 'transit-sbar': S.transit.sbar[arg] = el.checked; render(); return;
    case 'transit-handoff':
      S.transit.handoff = 'complete';
      addAudit('SBAR_HANDOFF_COMPLETED', 'HND-2048', 'paramedic.rnair', 'Paramedic');
      render(); openModal('handoff');
      toast('Handoff complete', 'Structured SBAR record written to the simulated incident log.', 'emerald'); return;
    case 'transit-save-note':
      toast('Note saved locally', 'Crew note stored in session state only; nothing was transmitted.', 'emerald'); return;
    case 'transit-clear-note': S.transit.notes = ''; render(); return;
    case 'open-handoff': openModal('handoff'); return;

    /* ---- admin ---------------------------------------------------------- */
    case 'admin-integrity':
      var nextIntegrity = S.admin.integrity === 'success' ? 'error' : 'success';
      S.admin.integrity = 'loading'; render();
      later(950, function () {
        S.admin.integrity = nextIntegrity;
        render();
        if (nextIntegrity === 'error') toast('Integrity check failed', 'Event AUD-91819 has no hash. Retry from the audit panel.', 'rose');
        else toast('Integrity verified', '7 of 8 sampled hashes match; 1 error event is intentionally unhashed.', 'emerald');
      }); return;
    case 'admin-export':
      S.admin.exportBusy = true; render();
      later(680, function () {
        downloadJson('fgx-audit-bundle-SIMULATED.json', {
          _notice: D.meta.notice, exportedAt: nowIso(), environment: D.meta.environment,
          auditEvents: D.audit, models: D.models, safetyRules: D.safetyRules,
          metrics: D.metrics, integrityLastCheck: D.metrics.integrityLastCheck
        });
        addAudit('AUDIT_BUNDLE_EXPORTED', 'AUDIT-BUNDLE', 'admin.kroy', 'Administrator');
        S.admin.exportBusy = false; render();
        toast('Audit bundle exported', 'Synthetic audit events, models, and rules written to JSON.', 'emerald');
      }); return;
    case 'admin-rule-toggle':
      S.admin.ruleBusy = arg; render();
      later(640, function () {
        r = find(D.safetyRules, 'id', arg);
        r.enabled = !r.enabled;
        addAudit('SAFETY_RULE_' + (r.enabled ? 'ENABLED' : 'DISABLED'), r.id, 'admin.kroy', 'Administrator');
        S.admin.ruleBusy = null; render();
        toast(r.id + (r.enabled ? ' enabled' : ' disabled'), 'Rule change recorded in the simulated audit log.', r.enabled ? 'emerald' : 'amber');
      }); return;
    case 'admin-rule-retry':
      r = find(D.safetyRules, 'id', arg);
      r.evaluation = 'pass';
      S.admin.ruleRetry = arg;
      addAudit('SAFETY_RULE_REEVALUATED', r.id, 'admin.kroy', 'Administrator');
      render(); toast(r.id + ' re-evaluated', 'Evaluation pipeline recovered; no records changed.', 'emerald'); return;
    case 'admin-audit-filter': S.admin.auditFilter = arg; render(); return;
    case 'admin-audit-all': S.admin.auditFilter = 'all'; render(); return;
    case 'admin-verify':
      S.admin.verifyBusy = true; render();
      later(820, function () {
        S.admin.verifyBusy = false; render();
        toast('Hash chain verified', '7 events verified · 1 intentionally unhashed error event excluded.', 'emerald');
      }); return;
    case 'admin-rollback':
      S.modal = { kind: 'confirm', payload: {
        title: 'Roll back model version?',
        sub: 'MODEL REGISTRY · SIMULATED GOVERNANCE ACTION',
        message: '<b>You are about to roll back ' + esc(arg.split('|')[0]) + ' v' + esc(arg.split('|')[1]) + '.</b> In a real deployment this would freeze automated outputs and require dual authorisation.',
        detail: '<div class="callout tone-amber">All model versions and approvals in this sandbox are synthetic. This action only appends an audit event.</div>',
        confirmLabel: 'Roll back version', confirmClass: 'danger', confirmAction: 'admin-rollback-confirm', arg: arg
      } };
      renderOverlay(); return;
    case 'admin-rollback-confirm':
      closeModal();
      addAudit('MODEL_ROLLBACK_INITIATED', arg, 'admin.kroy', 'Administrator');
      toast('Rollback recorded', arg.replace('|', ' v') + ' · simulated governance event written.', 'amber');
      render(); return;
    case 'admin-review':
      toast('Review opened', arg.replace('|', ' v') + ' · no pending approvals in the queue.', 'violet'); return;
    case 'admin-approval-request':
      S.admin.approvals.unshift({
        id: uid('GOV'), title: 'Candidate model FGX-Risk v2.5.0-rc1 — approval request',
        actor: 'ML Governance', scope: 'Model registry', status: 'pending',
        detail: 'Requesting simulated clinical safety sign-off for a candidate model with coverage 0.63 and drift 0.04.'
      });
      render(); toast('Review request created', 'Governance queue now has 1 pending item.', 'amber'); return;
    case 'admin-approval':
      var bits = arg.split('|'), ap = find(S.admin.approvals, 'id', bits[0]);
      if (!ap) return;
      ap.status = bits[1] === 'approve' ? 'approved' : 'rejected';
      addAudit('GOVERNANCE_REQUEST_' + (bits[1] === 'approve' ? 'APPROVED' : 'REJECTED'), ap.id, 'admin.kroy', 'Administrator');
      render(); toast('Request ' + ap.status, ap.id + ' · audit event written.', ap.status === 'approved' ? 'emerald' : 'rose'); return;

    default:
      // Unknown action: fail quietly in the UI rather than throwing.
      return;
  }
}
function resetDecisionDraft() {
  S.doctor.note = ''; S.doctor.disposition = ''; S.doctor.override = '';
  S.doctor.acknowledged = false; S.doctor.decisionStatus = 'idle'; S.doctor.decisionId = null;
}

/* ----------------------------------------------------------- event wiring --- */
document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-action]') : null;
  if (el && !el.disabled) {
    e.preventDefault();
    handleAction(el.getAttribute('data-action'), el.getAttribute('data-arg'), el);
    return;
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-backdrop')) {
    if (S.search) { S.search = null; renderOverlay(); }
    else if (S.modal) { closeModal(); }
    else if (S.drawerOpen) { S.drawerOpen = false; renderOverlay(); }
  }
});
document.addEventListener('input', function (e) {
  var el = e.target;
  if (!el.hasAttribute || !el.hasAttribute('data-model')) return;
  var path = el.getAttribute('data-model');
  applyModel(path, el.value);
  if (path === 'searchQuery') { renderOverlay(); return; }
  if (path.indexOf('intake.') === 0) {
    if (path === 'intake.severity') {
      var h = el.closest('.field').querySelector('.hint');
      if (h) h.textContent = el.value + ' / 10';
    }
    if (path === 'intake.description') syncIntakeUi();
    return;
  }
  if (path.indexOf('doctor.') === 0) {
    if (path === 'doctor.query') {
      var pos = el.selectionStart;
      render();
      var again = $('#caseSearchInput');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {} }
    } else syncDecisionUi();
    return;
  }
  if (path === 'operator.commDraft' || path === 'transit.notes') { syncDraftButtons(); return; }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-model')) {
    applyModel(el.getAttribute('data-model'), el.value);
  }
  if (!el.hasAttribute || !el.hasAttribute('data-action')) return;
  handleAction(el.getAttribute('data-action'), el.getAttribute('data-arg'), el);
});
document.addEventListener('keydown', function (e) {
  var typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '').toUpperCase());
  if (e.key === 'Escape') {
    if (S.search) { S.search = null; renderOverlay(); }
    else if (S.modal) closeModal();
    else if (S.drawerOpen) { S.drawerOpen = false; renderOverlay(); }
    return;
  }
  if (e.key === '/' && !typing && !S.modal && !S.drawerOpen) {
    e.preventDefault(); S.search = true; S.searchQuery = ''; renderOverlay(); return;
  }
  if (e.key === 'Enter' && S.search && e.target.id === 'searchInput') {
    e.preventDefault();
    var first = searchResults(S.searchQuery)[0];
    if (first) handleAction(first.action, first.arg, e.target);
  }
});

/* --------------------------------------------------------------- tickers --- */
function tickClock() {
  S.now += 1000;
  var el = $('#clock');
  if (el) el.textContent = new Date(S.now).toISOString().slice(11, 19) + ' UTC';
}
function tickTelemetry() {
  var t = S.patient.telemetry;
  if (!t.live || t.error) return;
  var specs = {
    hr: { min: 88, max: 122, step: 3, precision: 0 },
    spo2: { min: 91, max: 97, step: 1, precision: 0 },
    rr: { min: 17, max: 25, step: 1, precision: 0 },
    temp: { min: 37.2, max: 38.3, step: .1, precision: 1 }
  };
  Object.keys(specs).forEach(function (id) {
    var v = find(D.vitals, 'id', id), s = specs[id];
    if (!v || typeof v.value !== 'number') return;
    var next = clamp(v.value + (Math.random() - .5) * 2 * s.step, s.min, s.max);
    next = s.precision ? Math.round(next * 10) / 10 : Math.round(next);
    v.delta1h = clamp(v.delta1h + (next > v.value ? 1 : next < v.value ? -1 : 0), -8, 14);
    v.value = next;
    v.history.push({ t: nowIso(), v: next });
    if (v.history.length > 24) v.history.shift();
  });
  t.lastSync = S.now;
  // Targeted DOM updates: no full re-render, so text inputs keep focus.
  $$('[data-vital-value]').forEach(function (el) {
    var v = find(D.vitals, 'id', el.getAttribute('data-vital-value'));
    if (v) el.textContent = v.value;
  });
  $$('[data-vital-spark]').forEach(function (el) {
    var v = find(D.vitals, 'id', el.getAttribute('data-vital-spark'));
    if (v) el.innerHTML = sparkline(v.history.map(function (h) { return h.v; }), v.status === 'stable' ? 'emerald' : 'amber');
  });
  $$('[data-vital-delta]').forEach(function (el) {
    var v = find(D.vitals, 'id', el.getAttribute('data-vital-delta'));
    if (v) {
      el.textContent = (v.delta1h > 0 ? '+' : '') + v.delta1h;
      el.className = 'mono ' + (v.delta1h > 0 ? 'trend-up' : v.delta1h < 0 ? 'trend-down' : 'trend-flat');
    }
  });
  $$('[data-sync-label]').forEach(function (el) { el.textContent = 'just now'; });
  var chart = $('#trendChart'); if (chart) chart.innerHTML = trendChart();
  $$('[data-transit-value]').forEach(function (el) {
    var id = el.getAttribute('data-transit-value');
    var tv = find(D.transit.telemetry, 'id', id), pv = find(D.vitals, 'id', id);
    if (tv && pv) {
      tv.value = pv.value;
      el.innerHTML = pv.value + ' ' + esc(tv.unit) + ' <span class="' + (tv.delta > 0 ? 'c-rose' : 'c-emerald') + ' fs-10">' + (tv.delta > 0 ? '+' : '') + tv.delta + '</span>';
    }
  });
}
function tickWave() {
  if (!S.transit.signalLost) S.transit.wavePhase = (S.transit.wavePhase + 3.4) % 1000;
  var path = $('#wavePath');
  if (path) path.setAttribute('d', ecgPath(S.transit.wavePhase, S.transit.signalLost));
}

/* ------------------------------------------------------------------- init --- */
function init() {
  D.transit.sbar.forEach(function (s) { if (s.done) S.transit.sbar[s.id] = true; });
  render();
  $('#clock').textContent = new Date(S.now).toISOString().slice(11, 19) + ' UTC';
  setInterval(tickClock, 1000);
  setInterval(tickTelemetry, 3000);
  setInterval(tickWave, 130);
}
init();

})();
