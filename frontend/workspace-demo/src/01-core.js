/* ============================================================================
   FAME-GENIX 2.0 — Application core
   Framework-free. One shared IIFE spans 01-core / 02-views / 03-events.
   ========================================================================== */
(function () {
'use strict';

var D = window.FGX_DATA;
var SANDBOX_NOW = Date.parse(D.meta.sandboxNow);

var S = {
  view: 'patient',
  now: SANDBOX_NOW,
  patient: {
    intake: {
      description: '', onset: '1–2 days', duration: '2', durationUnit: 'days', severity: 5,
      symptoms: ['Breathlessness'], measurements: { hr: '108', spo2: '93', temp: '37.9' },
      status: 'idle', recordId: null, report: null
    },
    reports: [],
    telemetry: { live: true, error: false, lastSync: SANDBOX_NOW },
    risk: { loading: false, score: D.risk.score, band: D.risk.band, computedAt: D.risk.computedAt, runCount: 0 },
    chart: ['hr', 'spo2'],
    consult: { status: 'scheduled', slot: D.consultation.slot }
  },
  doctor: {
    filter: 'all', query: '', selected: 'CASE-4417', loading: false, myQueue: true,
    note: '', disposition: '', override: '', acknowledged: false,
    decisionStatus: 'idle', decisionId: null, verifiedOnly: false, refreshBusy: false
  },
  operator: {
    filter: 'active', selected: 'INC-2026-1048', selectedUnit: 'AMB-07',
    protocol: {}, commDraft: '', advanceBusy: false, assignBusy: false, createBusy: false
  },
  transit: {
    signalLost: false, sbar: {}, preAlert: 'sent', acknowledged: false,
    handoff: 'idle', notes: '', progress: D.transit.progress, wavePhase: 0, arrivalMarked: false
  },
  admin: {
    ruleBusy: null, ruleRetry: null, integrity: 'idle', exportBusy: false,
    auditFilter: 'all', verifyBusy: false, approvals: [], approvalBusy: false
  },
  modal: null, modalState: {},
  drawerTab: 'patient', search: null, searchQuery: '',
  toasts: []
};

/* ------------------------------------------------------------- utilities --- */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function num(n, digits) { return Number(n).toFixed(digits === undefined ? 0 : digits); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function isoTime(iso) { return iso ? iso.slice(11, 16) + ' UTC' : '—'; }
function isoDate(iso) { return iso ? iso.slice(0, 10) + ' · ' + iso.slice(11, 16) + ' UTC' : '—'; }
function ago(iso) {
  if (!iso) return '—';
  var m = Math.max(0, Math.round((S.now - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  return h + 'h ' + pad(m % 60) + 'm ago';
}
function duration(minutes) {
  if (minutes < 60) return minutes + ' min';
  return Math.floor(minutes / 60) + 'h ' + pad(minutes % 60) + 'm';
}
function find(arr, key, val) {
  for (var i = 0; i < arr.length; i++) if (arr[i][key] === val) return arr[i];
  return null;
}
function activeCase() { return find(D.cases, 'id', S.doctor.selected); }
function activeIncident() { return find(D.incidents, 'id', S.operator.selected); }
function activeUnit() { return find(D.units, 'id', (activeIncident() || {}).assignedUnit); }
function toneForBand(b) {
  return b === 'High' || b === 'Critical' || b === 'Urgent' ? 'rose'
    : b === 'Moderate' || b === 'Priority' ? 'amber'
    : b === 'Low' || b === 'Routine' ? 'emerald' : 'cyan';
}
function uid(prefix) {
  var n = Math.floor(1000 + Math.random() * 8999);
  return prefix + '-' + n;
}
function jsonHtml(obj) {
  var lines = JSON.stringify(obj, null, 2).split('\n');
  return lines.map(function (line) {
    var e = esc(line);
    var m = e.match(/^(\s*)(&quot;[^&]*?(?:&(?!quot;)[^&]*?)*?&quot;)(:)/);
    if (m) return m[1] + '<span class="key">' + m[2] + '</span>' + e.slice(m[1].length + m[2].length);
    var q = e.match(/^(\s*)(&quot;.*&quot;)(,?)$/);
    if (q) return q[1] + '<span class="str">' + q[2] + '</span>' + q[3];
    return e.replace(/(-?\d+\.?\d*)/g, '<span class="numv">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="bool">$1</span>');
  }).join('\n');
}
function downloadJson(filename, obj) {
  var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
}

/* ----------------------------------------------------------------- icons --- */
var ICONS = {
  patient: '<circle cx="12" cy="8" r="3.3"/><path d="M4.5 20c0-3.5 3.1-5.7 7.5-5.7s7.5 2.2 7.5 5.7"/>',
  doctor: '<path d="M6 3v6a6 6 0 0 0 12 0V3"/><path d="M4 3h4M16 3h4"/><path d="M12 15v3a3 3 0 0 0 6 0v-2"/><circle cx="18" cy="15" r="2"/>',
  operator: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>',
  ambulance: '<path d="M2 7h11v10H2zM13 10h4l4 3v4h-8z"/><circle cx="6" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/><path d="M8 9.5v3M6.5 11h3"/>',
  admin: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="19" r="2" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  activity: '<path d="M2 12h4l3-7 4 14 3-7h6"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 17.3v.2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.7 2.7L16.5 9"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/>',
  upload: '<path d="M12 16V3M7.5 7.5L12 3l4.5 4.5M3 16v4h18v-4"/>',
  file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
  pin: '<path d="M12 22s7-6.1 7-12A7 7 0 0 0 5 10c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4"/>',
  download: '<path d="M12 3v13M7.5 11.5L12 16l4.5-4.5M3 20h18"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  send: '<path d="M21 3L3 10l7 3 3 7 8-17zM10 13l4-4"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.2M3 12h.2M3 18h.2"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="7" cy="18" r="2" fill="currentColor" stroke="none"/>',
  arrowRight: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  wifi: '<path d="M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  terminal: '<rect x="2" y="3" width="20" height="18" rx="1"/><path d="M6 8l3 3-3 3M11 15h6"/>'
};
function icon(name, cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg>';
}

/* ----------------------------------------------------------- primitives --- */
function panel(opts) {
  var tone = opts.tone || 'cyan';
  return '<section class="panel ' + (opts.className || '') + '">' +
    '<header class="panel-head">' +
      '<div class="panel-title tone-' + tone + '"><span class="accent"></span>' +
        (opts.idx ? '<span class="idx">' + esc(opts.idx) + '</span>' : '') +
        '<span>' + esc(opts.title) + '</span></div>' +
      (opts.meta || opts.actions ? '<div class="panel-meta">' + (opts.meta || '') + (opts.actions || '') + '</div>' : '') +
    '</header>' +
    '<div class="panel-body' + (opts.flush ? ' flush' : '') + '">' + (opts.body || '') + '</div>' +
    (opts.foot ? '<footer class="panel-foot">' + opts.foot + '</footer>' : '') +
  '</section>';
}
function tag(text, tone, extra) {
  return '<span class="tag tone-' + (tone || 'muted') + ' ' + (extra || '') + '">' + esc(text) + '</span>';
}
function dot(tone, pulse) { return '<span class="dot tone-' + (tone || 'emerald') + (pulse ? ' pulse' : '') + '"></span>'; }
function btn(label, action, opts) {
  opts = opts || {};
  return '<button type="button" class="btn ' + (opts.cls || '') + (opts.block ? ' block' : '') + '" data-action="' + action + '"' +
    (opts.arg ? ' data-arg="' + esc(opts.arg) + '"' : '') +
    (opts.disabled ? ' disabled' : '') + (opts.title ? ' title="' + esc(opts.title) + '"' : '') + '>' +
    (opts.icon ? icon(opts.icon) : '') + (opts.loading ? '<span class="spin"></span>' : '') + esc(label) + '</button>';
}
function stateBox(opts) {
  var tone = opts.tone || 'cyan';
  return '<div class="state-inline tone-' + tone + '">' + icon(opts.icon || 'info') +
    '<div><div class="st-title">' + esc(opts.title) + '</div>' +
    (opts.sub ? '<div class="st-sub">' + opts.sub + '</div>' : '') + '</div>' +
    (opts.actions ? '<div class="st-actions">' + opts.actions + '</div>' : '') + '</div>';
}
function emptyState(title, sub, actions) {
  return '<div class="empty">' + icon('archive') + '<div class="e-title">' + esc(title) + '</div>' +
    '<div class="e-sub">' + esc(sub) + '</div>' +
    (actions ? '<div class="e-actions">' + actions + '</div>' : '') + '</div>';
}
function skeletonRows(n) {
  var out = '';
  for (var i = 0; i < n; i++) {
    out += '<div class="skel-row"><div class="skeleton" style="width:22px;height:14px"></div>' +
      '<div style="flex:1"><div class="skeleton lg" style="width:' + (48 + (i % 3) * 14) + '%"></div></div>' +
      '<div class="skeleton" style="width:46px"></div></div>';
  }
  return out;
}
function sparkline(values, tone, w, h) {
  w = w || 92; h = h || 26;
  if (!values || !values.length) return '';
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  var span = (max - min) || 1;
  var pts = values.map(function (v, i) {
    return [1 + (i / Math.max(1, values.length - 1)) * (w - 2), h - 2 - ((v - min) / span) * (h - 5)];
  });
  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  var area = line + ' L' + (w - 1) + ' ' + h + ' L1 ' + h + ' Z';
  var last = pts[pts.length - 1];
  return '<svg class="spark tone-' + (tone || 'cyan') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<path class="fill" d="' + area + '"/><path class="line" d="' + line + '"/>' +
    '<circle class="last" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="1.9"/></svg>';
}
function polyPath(values, x0, y0, w, h, min, max) {
  var span = (max - min) || 1;
  return values.map(function (v, i) {
    var x = x0 + (i / Math.max(1, values.length - 1)) * w;
    var y = y0 + h - ((v - min) / span) * h;
    return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');
}
function trendChart() {
  var ids = S.patient.chart;
  var W = 700, H = 172, x0 = 38, y0 = 12, cw = W - 62, ch = H - 34;
  var colors = { hr: '#3fd7e8', spo2: '#a98bff', rr: '#f2b955', temp: '#41d69a' };
  var out = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Simulated 24 hour vital sign trends">';
  for (var g = 0; g <= 4; g++) {
    var y = y0 + (ch / 4) * g;
    out += '<line class="grid-line" x1="' + x0 + '" y1="' + y + '" x2="' + (x0 + cw) + '" y2="' + y + '"/>' +
      '<text class="axis-text" x="2" y="' + (y + 3) + '">' + (100 - g * 25) + '</text>';
  }
  for (var t = 0; t <= 6; t++) {
    var x = x0 + (cw / 6) * t;
    out += '<line class="grid-line" x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + (y0 + ch) + '" style="opacity:.5"/>' +
      '<text class="axis-text" x="' + (x - 10) + '" y="' + (H - 8) + '">' + pad((9 + t * 4) % 24) + ':00</text>';
  }
  ids.forEach(function (id) {
    var v = find(D.vitals, 'id', id);
    if (!v) return;
    var vals = v.history.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var pad2 = (max - min) * .22 || 1;
    min -= pad2; max += pad2;
    var p = polyPath(vals, x0, y0, cw, ch, min, max);
    out += '<path class="series-line" d="' + p + '" stroke="' + colors[id] + '"/>';
    var lastY = y0 + ch - ((vals[vals.length - 1] - min) / (max - min)) * ch;
    out += '<circle cx="' + (x0 + cw) + '" cy="' + lastY.toFixed(1) + '" r="2.6" fill="' + colors[id] + '"/>';
  });
  out += '</svg>';
  return out;
}
function volumeChart() {
  var c = D.metrics.volume, W = 700, H = 172, x0 = 36, y0 = 12, cw = W - 58, ch = H - 34;
  var max = 100;
  var out = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Simulated case volume and escalation chart">';
  for (var g = 0; g <= 4; g++) {
    var y = y0 + (ch / 4) * g;
    out += '<line class="grid-line" x1="' + x0 + '" y1="' + y + '" x2="' + (x0 + cw) + '" y2="' + y + '"/>' +
      '<text class="axis-text" x="0" y="' + (y + 3) + '">' + (100 - g * 25) + '</text>';
  }
  var p1 = polyPath(c.cases, x0, y0, cw, ch, 0, max);
  var p2 = polyPath(c.escalations.map(function (v) { return v * 4; }), x0, y0, cw, ch, 0, max);
  out += '<path class="area" d="' + p1 + ' L' + (x0 + cw) + ' ' + (y0 + ch) + ' L' + x0 + ' ' + (y0 + ch) + ' Z"/>' +
    '<path class="series-line" d="' + p1 + '" stroke="#3fd7e8"/>' +
    '<path class="series-line" d="' + p2 + '" stroke="#fb7185" stroke-dasharray="4 3"/>';
  c.labels.forEach(function (l, i) {
    if (i % 2) return;
    var x = x0 + (cw / (c.labels.length - 1)) * i;
    out += '<text class="axis-text" x="' + (x - 14) + '" y="' + (H - 8) + '">' + l + '</text>';
  });
  out += '</svg>';
  return out;
}
function mapBase() {
  return '<rect x="0" y="0" width="620" height="300" fill="#0a1016"/>' +
    '<path class="block" d="M14 14h80v42H14zM120 14h120v42H120zM266 14h128v42H266zM420 14h105v42H420zM14 84h80v52H14zM120 84h120v52H120zM266 84h128v52H266zM420 84h105v52H420zM14 162h80v52H14zM120 162h120v52H120zM266 162h128v52H266zM420 162h105v52H420zM14 240h80v44H14zM120 240h120v44H120zM266 240h128v44H266zM420 240h105v44H420z"/>' +
    '<path class="water" d="M540 168h80v116h-80z"/>' +
    '<path class="road-major" d="M0 72h620M0 148h620M0 228h620M104 0v300M252 0v300M408 0v300M532 0v300"/>' +
    '<path class="road" d="M0 36h620M0 112h620M0 190h620M0 264h620M52 0v300M180 0v300M330 0v300M470 0v300"/>' +
    '<text class="grid-label" x="18" y="26">G11</text><text class="grid-label" x="128" y="26">G12</text>' +
    '<text class="grid-label" x="274" y="26">G13</text><text class="grid-label" x="428" y="26">G14</text>' +
    '<text class="grid-label" x="18" y="178">G21</text><text class="grid-label" x="274" y="178">G23</text>' +
    '<text class="grid-label" x="18" y="256">G31</text><text class="grid-label" x="428" y="256">G34</text>' +
    '<text class="grid-label" x="556" y="225">CANAL</text>';
}
function svgMarker(x, y, tone, label, sub, shape) {
  var col = { cyan: '#3fd7e8', rose: '#fb7185', emerald: '#41d69a', amber: '#f2b955', violet: '#a98bff' }[tone] || '#3fd7e8';
  var m = shape === 'square'
    ? '<rect x="' + (x - 7) + '" y="' + (y - 7) + '" width="14" height="14" fill="#0a1016" stroke="' + col + '" stroke-width="2"/>'
    : '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#0a1016" stroke="' + col + '" stroke-width="2"/><circle cx="' + x + '" cy="' + y + '" r="2.4" fill="' + col + '"/>';
  // Labels flip to the left edge near the right boundary, and unit labels sit
  // above their marker so they never collide with the road grid labels.
  var above = tone === 'cyan';
  var flip = x > 440;
  var tx = above ? x : (flip ? x - 13 : x + 13);
  var anchor = above ? 'middle' : (flip ? 'end' : 'start');
  var ly = above ? y - 14 : y - 2;
  var sy = above ? y - 4 : y + 10;
  return '<g>' + (tone === 'rose' ? '<circle class="pulse-ring" cx="' + x + '" cy="' + y + '" r="16" stroke="' + col + '"/>' : '') +
    m + '<text class="marker-label" text-anchor="' + anchor + '" x="' + tx + '" y="' + ly + '">' + esc(label) + '</text>' +
    '<text class="marker-sub" text-anchor="' + anchor + '" x="' + tx + '" y="' + sy + '">' + esc(sub) + '</text></g>';
}
function operatorMap(inc) {
  var c = inc.coords;
  var route = 'M' + c.patient.x + ' ' + c.patient.y + ' L' + c.unit.x + ' ' + c.unit.y + ' L' + c.hospital.x + ' ' + c.hospital.y;
  return '<svg class="map-svg" viewBox="0 0 620 300" role="img" aria-label="Simulated operational area map">' + mapBase() +
    '<path class="route" d="' + route + '"/>' +
    (inc.stageIndex >= 4 ? '<path class="route-done" d="M' + c.patient.x + ' ' + c.patient.y + ' L' + c.unit.x + ' ' + c.unit.y + '"/>' : '') +
    svgMarker(c.patient.x, c.patient.y, 'rose', inc.patientId, 'PATIENT · ' + inc.grid) +
    (inc.assignedUnit ? svgMarker(c.unit.x, c.unit.y, 'cyan', inc.assignedUnit, inc.stageIndex >= 5 ? 'ON SCENE' : 'ETA ' + (activeUnit() || {}).etaMinutes + ' MIN') : '') +
    svgMarker(c.hospital.x, c.hospital.y, 'emerald', 'RECEIVING FACILITY', 'SANDBOX NORTH · BAY 3', 'square') +
    '</svg>';
}
function transitMap() {
  var pts = [[112, 228], [180, 228], [252, 148], [330, 148], [408, 148], [500, 92]];
  var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
  var idx = clamp(Math.floor(S.transit.progress * (pts.length - 1)), 0, pts.length - 2);
  var frac = clamp(S.transit.progress * (pts.length - 1) - idx, 0, 1);
  var x = pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * frac;
  var y = pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * frac;
  var done = pts.slice(0, idx + 1).map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ') + ' L' + x.toFixed(1) + ' ' + y.toFixed(1);
  return '<svg class="map-svg" viewBox="0 0 620 300" role="img" aria-label="Simulated ambulance route map">' + mapBase() +
    '<path class="route" d="' + d + '"/><path class="route-done" style="stroke:#41d69a" d="' + done + '"/>' +
    svgMarker(112, 228, 'amber', 'SCENE', 'DEPARTED ' + isoTime(D.transit.departedAt)) +
    svgMarker(x, y, 'cyan', 'AMB-07', Math.round(S.transit.progress * 100) + '% OF ROUTE') +
    svgMarker(500, 92, 'emerald', 'RECEIVING FACILITY', 'BAY 3 · PRE-ALERT SENT', 'square') + '</svg>';
}
function ecgPath(phase, lost) {
  var pts = [], W = 300, H = 96;
  function bump(t, c, w, a) { var z = (t - c) / w; return a * Math.exp(-z * z); }
  for (var x = 0; x <= W; x += 1.5) {
    var t = (((x + phase) % 84) / 84);
    var v = bump(t, .16, .035, 3) - bump(t, .31, .012, 4) - bump(t, .345, .012, 30)
      + bump(t, .385, .016, 8) + bump(t, .60, .06, 6);
    var noise = lost ? (Math.sin(x * 2.1 + phase) * .7) : (Math.sin(x * .9 + phase * .1) * .35);
    pts.push((x).toFixed(1) + ' ' + (H / 2 - v + noise).toFixed(1));
  }
  return 'M' + pts.join(' L');
}
function ringSvg(score) {
  var r = 35, c = 2 * Math.PI * r;
  var off = c * (1 - score / 100);
  return '<svg class="ring" viewBox="0 0 88 88" role="img" aria-label="Simulated risk index ' + score + ' out of 100">' +
    '<circle class="track" cx="44" cy="44" r="' + r + '" fill="none" stroke-width="6"/>' +
    '<circle class="val" cx="44" cy="44" r="' + r + '" fill="none" stroke-width="6" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
    '<text class="score" x="44" y="47" text-anchor="middle">' + score + '</text>' +
    '<text class="denom" x="44" y="60" text-anchor="middle">/ 100</text></svg>';
}

/* ------------------------------------------------------------- main shell --- */
var NAV = [
  { id: 'patient', label: 'Patient intake', icon: 'patient', badge: '01' },
  { id: 'doctor', label: 'Doctor review', icon: 'doctor', badge: '07' },
  { id: 'operator', label: 'Emergency ops', icon: 'operator', badge: '04' },
  { id: 'transit', label: 'Ambulance transit', icon: 'ambulance', badge: '01' },
  { id: 'admin', label: 'Admin governance', icon: 'admin', badge: '05' }
];
var USERS = {
  patient: { name: 'Patient workspace', role: 'FGX-P-20418', initials: 'AM' },
  doctor: { name: 'Dr. Isha Raman', role: 'CLINICIAN · REVIEW', initials: 'IR' },
  operator: { name: 'Mira Sen', role: 'EMERGENCY OPERATOR', initials: 'MS' },
  transit: { name: 'R. Nair', role: 'PARAMEDIC · AMB-07', initials: 'RN' },
  admin: { name: 'K. Roy', role: 'ADMINISTRATOR', initials: 'KR' }
};
function renderNav() {
  $('#nav').innerHTML = NAV.map(function (n) {
    return '<button class="nav-item' + (S.view === n.id ? ' active' : '') + '" data-action="nav" data-arg="' + n.id + '" title="' + esc(n.label) + '">' +
      icon(n.icon) + '<span class="nav-label">' + esc(n.label) + '</span><span class="nav-badge">' + n.badge + '</span></button>';
  }).join('');
  $('#sideTools').innerHTML =
    '<button class="nav-item" data-action="states" title="Component state library">' + icon('layers') + '<span class="nav-label">State library</span></button>' +
    '<button class="nav-item" data-action="open-drawer" title="Inspect data structures">' + icon('database') + '<span class="nav-label">Data inspector</span></button>' +
    '<button class="nav-item" data-action="search" title="Global search (/)">' + icon('search') + '<span class="nav-label">Global search</span></button>';
}
function render() {
  renderNav();
  var n = find(NAV, 'id', S.view);
  $('#crumbs').innerHTML = '<span>FAME-GENIX 2.0</span><span class="slash">/</span><span>WORKSPACES</span><span class="slash">/</span><strong>' + esc(n.label.toUpperCase()) + '</strong>';
  var u = USERS[S.view];
  $('#userChip').innerHTML = '<div class="avatar">' + u.initials + '</div><div class="user-meta"><b>' + esc(u.name) + '</b><span>' + esc(u.role) + '</span></div>';
  $('#statusRight').innerHTML = '<span><b>ENV</b> SANDBOX</span><span><b>BUILD</b> ' + esc(D.meta.version) + '</span><span><b>REGION</b> ' + esc(D.meta.region) + '</span>';
  var views = { patient: viewPatient, doctor: viewDoctor, operator: viewOperator, transit: viewTransit, admin: viewAdmin };
  var scroller = $('#viewInner').parentElement;
  var previousScroll = S._lastRenderedView === S.view ? scroller.scrollTop : 0;
  $('#viewInner').innerHTML = views[S.view]();
  scroller.scrollTop = previousScroll;
  S._lastRenderedView = S.view;
  renderOverlay();
}

/* -------------------------------------------------------------- overlays --- */
function renderOverlay() {
  var root = $('#overlayRoot');
  var html = '';
  if (S.modal) html += modalHtml();
  if (S.drawerOpen) html += drawerHtml();
  if (S.search) html += searchHtml();
  root.innerHTML = html;
  if (S.search) { var inp = $('#searchInput'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
}
function openModal(kind, payload, state) {
  S.modal = { kind: kind, payload: payload || {} };
  S.modalState = state || {};
  renderOverlay();
}
function closeModal() { S.modal = null; S.modalState = {}; renderOverlay(); }
function modalHtml() {
  var m = S.modal, p = m.payload, st = S.modalState, c;
  if (m.kind === 'states') c = statesModal();
  else if (m.kind === 'upload') c = uploadModal(p, st);
  else if (m.kind === 'evidence') c = evidenceModal(p);
  else if (m.kind === 'vital') c = vitalModal(p);
  else if (m.kind === 'consult') c = consultModal(st);
  else if (m.kind === 'emergency') c = emergencyModal(st);
  else if (m.kind === 'incident') c = incidentModal(st);
  else if (m.kind === 'confirm') c = confirmModal(p);
  else if (m.kind === 'handoff') c = handoffModal();
  else c = { title: 'Dialog', body: '' };
  return '<div class="backdrop" data-backdrop="1"><div class="modal ' + (c.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(c.title) + '">' +
    '<header class="modal-head"><div><h2>' + c.title + '</h2>' + (c.sub ? '<div class="mh-sub">' + c.sub + '</div>' : '') + '</div>' +
    '<button class="close-x" data-action="close-modal" aria-label="Close dialog">×</button></header>' +
    '<div class="modal-body">' + (c.body || '') + '</div>' +
    '<footer class="modal-foot"><div class="foot-note">' + (c.note || '') + '</div><div class="btn-row">' + (c.foot || '') + '</div></footer></div></div>';
}
function standardFoot() { return btn('Close', 'close-modal', { cls: 'ghost' }); }

/* states library ----------------------------------------------------------- */
function statesModal() {
  var retried = S.modalState.retried;
  var cells = [
    { label: 'LOADING', tone: 'cyan', body: '<div style="border:1px solid var(--line)">' + skeletonRows(3) + '</div>', foot: 'Skeleton rows preserve layout; never use a bare spinner for a table.' },
    { label: 'EMPTY', tone: 'violet', body: emptyState('No reports attached', 'Upload a synthetic report to populate structured values.', btn('Attach report', 'modal-attach', { cls: 'ghost tiny' })), foot: 'Always pair empty copy with one primary next action.' },
    { label: 'ERROR', tone: retried ? 'emerald' : 'rose', body: retried
      ? stateBox({ tone: 'emerald', icon: 'check', title: 'Telemetry feed restored', sub: 'Last cached sample discarded. Live simulated samples resumed.' })
      : stateBox({ tone: 'rose', icon: 'alert', title: 'Evidence service unavailable', sub: 'Request EV-REQ-4471 failed after 3 attempts. No partial results are shown.', actions: btn('Retry request', 'state-retry', { cls: 'tiny' }) }),
      foot: 'State the failure, its scope, and one recovery action.' },
    { label: 'DISABLED', tone: 'amber', body: '<div class="stack" style="gap:9px"><div class="field"><div class="field-label">Clinician sign-off</div><input class="input" value="Awaiting evidence verification" disabled></div><div class="btn-row">' + btn('Sign decision', 'noop', { disabled: true }) + btn('Request verification', 'noop', { cls: 'ghost' }) + '</div><div class="form-hint">Disabled controls explain the blocker in adjacent copy.</div></div>', foot: 'Disabled ≠ hidden. Show the requirement that unlocks the action.' },
    { label: 'SUCCESS', tone: 'emerald', body: stateBox({ tone: 'emerald', icon: 'check', title: 'Decision DEC-3381 signed', sub: 'Case CASE-4422 moved to Ready to close. Audit hash c0f7…3d68 written.' }) + '<div class="mt-12" style="font-family:var(--mono);font-size:10px;color:var(--text-3)">EVENT → CASE_STATUS_CHANGED → AUDIT_WRITTEN</div>', foot: 'Confirmation includes the resulting state change and record ID.' },
    { label: 'UNCERTAIN / SIMULATED', tone: 'amber', body: stateBox({ tone: 'amber', icon: 'info', title: 'Synthetic citation — appraisal pending', sub: 'EV-1044 is excluded from autonomous decision support until reviewed.' }) + '<div class="mt-12">' + tag('SIMULATED', 'amber') + ' ' + tag('LOW CONFIDENCE', 'amber') + ' ' + tag('NOT A DIAGNOSIS', 'violet') + '</div>', foot: 'Uncertainty is a first-class status, never hidden behind a number.' }
  ];
  var body = '<div class="notice tone-cyan">' + icon('layers') + '<div><span class="notice-title">COMPONENT STATE LIBRARY</span>Every state is designed, not improvised. These patterns are used across all five workspaces.</div></div>' +
    '<div class="state-grid">' + cells.map(function (c) {
      return '<div class="state-cell"><div class="state-cell-head"><span>' + c.label + '</span>' + tag('SPEC', c.tone) + '</div>' +
        '<div class="state-cell-body">' + c.body + '</div><div class="state-cell-foot">' + esc(c.foot) + '</div></div>';
    }).join('') + '</div>';
  return { title: 'Interface state library', sub: 'DESIGN SYSTEM · FAME-GENIX 2.0 · SANDBOX', size: 'wide', body: body, note: 'All states are simulated. No network request is made.', foot: standardFoot() };
}

/* upload modal ------------------------------------------------------------- */
function uploadModal(p, st) {
  var files = [
    { id: 'RPT-1', name: 'pulmonary_function_summary.pdf', size: '184 KB', source: 'Synthetic Diagnostics Lab (SIM)' },
    { id: 'RPT-2', name: 'device_export_24h.csv', size: '42 KB', source: 'SIM-DEVICE/Wearable-04' }
  ];
  var chosen = files.find(function (f) { return f.id === st.file; });
  var phase = st.phase || 'select';
  var progress = phase === 'uploading' ? 34 : phase === 'parsing' ? 78 : phase === 'success' ? 100 : 0;
  var body = '<div class="notice tone-amber">' + icon('alert') + '<div><b>SIMULATED UPLOAD.</b> No file leaves this browser. Parsed values below are synthetic and are not clinical results.</div></div>' +
    '<div class="panel-sub">Available synthetic documents</div>' +
    files.map(function (f) {
      return '<button class="file-row" style="width:100%;text-align:left;background:' + (st.file === f.id ? 'var(--surface-2)' : 'var(--surface-0)') + ';border-color:' + (st.file === f.id ? 'var(--cyan)' : 'var(--line)') + '" data-action="pick-file" data-arg="' + f.id + '">' +
        icon('file') + '<span class="fname">' + esc(f.name) + '</span><span class="mono fs-10 c-muted">' + f.size + '</span>' +
        (st.file === f.id ? tag('SELECTED', 'cyan') : tag('SIM', 'amber')) + '</button>';
    }).join('');
  if (phase === 'idle' || phase === 'select') {
    if (!chosen) body += '<div class="form-hint mt-12">Select a synthetic document to enable parsing.</div>';
  } else if (phase === 'error') {
    body += '<div class="mt-16">' + stateBox({ tone: 'rose', icon: 'x', title: 'Parser rejected document', sub: 'Synthetic error E-PARSE-204: required section “measurements” missing. No values were written to the record.', actions: btn('Retry', 'upload-run', { cls: 'tiny' }) + btn('Cancel', 'upload-reset', { cls: 'tiny ghost' }) }) + '</div>';
  } else {
    body += '<div class="mt-16"><div class="row between"><span class="mono fs-10" style="color:var(--text-3)">' +
      (phase === 'uploading' ? 'UPLOADING…' : phase === 'parsing' ? 'EXTRACTING STRUCTURED VALUES…' : 'PARSE COMPLETE') + '</span>' +
      '<span class="mono fs-10" style="color:var(--cyan)">' + progress + '%</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + progress + '%"></div></div>';
    if (phase === 'success') {
      body += '<div class="mt-16">' + stateBox({ tone: 'emerald', icon: 'check', title: 'Report RPT-2291 attached', sub: '4 structured values extracted. Confidence 0.68 · flagged for clinician verification.' }) +
        '<div class="table-wrap mt-12"><table class="table compact"><thead><tr><th>Field</th><th>Value</th><th>Unit</th><th>Confidence</th></tr></thead><tbody>' +
        '<tr><td>FEV1</td><td class="mono strong">2.61</td><td>L</td><td>' + tag('0.81', 'emerald') + '</td></tr>' +
        '<tr><td>FVC</td><td class="mono strong">3.42</td><td>L</td><td>' + tag('0.79', 'emerald') + '</td></tr>' +
        '<tr><td>FEV1/FVC</td><td class="mono strong">0.76</td><td>ratio</td><td>' + tag('0.74', 'amber') + '</td></tr>' +
        '<tr><td>Peak flow</td><td class="mono strong">418</td><td>L/min</td><td>' + tag('0.38', 'rose') + '</td></tr>' +
        '</tbody></table></div></div>';
    }
  }
  var foot = phase === 'success'
    ? btn('Attach to record', 'upload-attach', { cls: 'primary' }) + standardFoot()
    : btn(phase === 'error' ? 'Retry parse' : 'Parse report', 'upload-run', { cls: 'primary', disabled: !chosen || phase === 'uploading' || phase === 'parsing', loading: phase === 'uploading' || phase === 'parsing' }) +
      (chosen && phase === 'select' ? btn('Simulate parse error', 'upload-error', { cls: 'ghost' }) : '') + standardFoot();
  return { title: 'Attach clinical report', sub: 'PATIENT FGX-P-20418 · SIMULATED DOCUMENT PIPELINE', body: body, note: 'Synthetic documents only. No PHI is accepted.', foot: foot };
}

/* evidence modal ----------------------------------------------------------- */
function evidenceModal(p) {
  var e = find(D.evidence, 'id', p.id) || D.evidence[0];
  var body = '<div class="row tight mb-12">' + tag('SIMULATED CITATION', 'amber') + tag(e.type, 'violet') + tag(e.grade.toUpperCase() + ' GRADE', e.verified ? 'emerald' : 'amber') + '</div>' +
    '<h3 style="margin:0 0 8px;font-size:15px;line-height:1.4;color:var(--white)">' + esc(e.title) + '</h3>' +
    '<div class="mono fs-10" style="color:var(--text-4);line-height:1.8">' + esc(e.source) + ' · ' + e.year + ' · ' + esc(e.identifier) + '</div>' +
    '<div class="hr-label">EXTRACT (SIMULATED)</div>' +
    '<div class="callout tone-violet">' + esc(e.excerpt) + '</div>' +
    '<div class="hr-label">APPRAISAL & LIMITATIONS</div>' +
    '<div class="ev-limit">' + esc(e.limitation) + '</div>' +
    '<div class="grid mt-16" style="grid-template-columns:1fr 1fr;gap:12px">' +
      '<div class="stat-pair"><span class="k">Relevance to case</span><span class="v">' + num(e.relevance * 100, 0) + '%</span></div>' +
      '<div class="stat-pair"><span class="k">Verification</span><span class="v">' + (e.verified ? 'VERIFIED' : 'PENDING') + '</span></div>' +
      '<div class="stat-pair"><span class="k">Linked factors</span><span class="v">' + e.linkedFactors.length + '</span></div>' +
      '<div class="stat-pair"><span class="k">Publication type</span><span class="v">SYNTHETIC</span></div>' +
    '</div>' +
    '<div class="mt-12">' + e.linkedFactors.map(function (f) { return tag(f, 'cyan'); }).join(' ') + '</div>';
  return { title: e.id + ' · Citation detail', sub: 'EVIDENCE PACKET · DECISION SUPPORT ONLY', body: body,
    note: 'Fictional source. Never treat as clinical guidance.', foot: (e.verified ? '' : btn('Request appraisal', 'evidence-appraise', { cls: 'violet', arg: e.id })) + standardFoot() };
}

/* vital modal -------------------------------------------------------------- */
function vitalModal(p) {
  var v = find(D.vitals, 'id', p.id) || D.vitals[0];
  var vals = v.history.map(function (h) { return h.v; });
  var body = '<div class="row between mb-12"><div><div class="mono fs-10 c-muted">' + esc(v.label.toUpperCase()) + '</div>' +
    '<div style="font-family:var(--mono);font-size:26px;color:var(--text);margin-top:4px">' + esc(v.value) + ' <span style="font-size:11px;color:var(--text-4)">' + esc(v.unit) + '</span></div></div>' +
    '<div class="row tight">' + tag('SIMULATED DEVICE FEED', 'amber') + tag(v.quality.toUpperCase() + ' QUALITY', v.quality === 'good' ? 'emerald' : 'amber') + '</div></div>' +
    '<div class="chart-box" style="margin-bottom:14px">' + trendChartSingle(vals, v) + '</div>' +
    '<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:14px">' +
      statTile('24h min', Math.min.apply(null, vals).toFixed(v.precision || 0) + ' ' + v.unit) +
      statTile('24h max', Math.max.apply(null, vals).toFixed(v.precision || 0) + ' ' + v.unit) +
      statTile('Reference', v.refLow + '–' + v.refHigh) +
      statTile('Δ 1h', (v.delta1h > 0 ? '+' : '') + v.delta1h) + '</div>' +
    '<div class="hr-label">SAMPLE LOG · LAST 8</div>' +
    '<div class="table-wrap"><table class="table compact"><thead><tr><th>Timestamp</th><th>Value</th><th>Source</th><th>Quality</th></tr></thead><tbody>' +
    v.history.slice(-8).reverse().map(function (h) {
      return '<tr><td class="mono">' + isoDate(h.t) + '</td><td class="mono strong">' + h.v.toFixed(v.precision || 0) + ' ' + esc(v.unit) + '</td><td class="mono fs-10">' + esc(v.source) + '</td><td>' + tag(v.quality, v.quality === 'good' ? 'emerald' : 'amber') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="notice tone-amber mt-16">' + icon('info') + '<div><b>' + esc(v.note) + '.</b> Reference bands are illustrative and population-level. Individual clinical ranges may differ. This is not a diagnosis.</div></div>';
  return { title: 'Signal history · ' + v.short, sub: 'FGX-P-20418 · 24 HOURS · SANDBOX CLOCK', size: 'wide', body: body, note: 'No real device is connected.', foot: standardFoot() };
}
function statTile(label, value) {
  return '<div style="border:1px solid var(--line);background:var(--surface-0);padding:9px 10px"><div class="mono fs-10 c-muted" style="margin-bottom:5px">' + esc(label.toUpperCase()) + '</div><div class="mono" style="font-size:12px;color:var(--text)">' + esc(value) + '</div></div>';
}
function trendChartSingle(vals, v) {
  var W = 640, H = 160, x0 = 34, y0 = 10, cw = W - 52, ch = H - 30;
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  var p = (max - min) * .25 || 1; min -= p; max += p;
  var out = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
  for (var g = 0; g <= 4; g++) {
    var y = y0 + ch / 4 * g;
    out += '<line class="grid-line" x1="' + x0 + '" y1="' + y + '" x2="' + (x0 + cw) + '" y2="' + y + '"/>' +
      '<text class="axis-text" x="0" y="' + (y + 3) + '">' + (max - (max - min) * g / 4).toFixed(v.precision || 0) + '</text>';
  }
  var path = polyPath(vals, x0, y0, cw, ch, min, max);
  out += '<path class="area" d="' + path + ' L' + (x0 + cw) + ' ' + (y0 + ch) + ' L' + x0 + ' ' + (y0 + ch) + ' Z"/>' +
    '<path class="series-line" d="' + path + '" stroke="#3fd7e8"/></svg>';
  return out;
}

/* consult + emergency + incident + confirm + handoff modals ---------------- */
function consultModal(st) {
  var c = D.consultation;
  var phase = st.phase || 'form';
  var body;
  if (phase === 'success') {
    body = '<div class="notice tone-emerald">' + icon('check') + '<div><b>Consultation ' + esc(st.id || 'CONS-2217') + ' requested.</b> A simulated slot has been reserved. No clinician has been contacted.</div></div>' +
      '<div class="panel-sub mt-16">REQUEST SUMMARY</div>' +
      '<div class="mini-list">' + statRow('Case', c.caseId) + statRow('Clinician', c.clinician) + statRow('Slot', isoDate(st.slot || c.slot)) + statRow('Mode', 'Video (simulated)') + statRow('Consent', c.consentId) + statRow('Status', 'PENDING · SANDBOX') + '</div>';
  } else {
    body = '<div class="notice tone-cyan">' + icon('info') + '<div><b>Scheduled consultation already exists.</b> Requesting an earlier slot creates a second simulated request for review.</div></div>' +
      '<div class="field mt-16"><div class="field-label">Clinician</div><input class="input" value="' + esc(c.clinician) + '" disabled></div>' +
      '<div class="field"><div class="field-label">Preferred slot <span class="hint">sandbox clock</span></div>' +
        '<select class="select" id="consultSlot"><option value="2026-10-26T10:30:00Z">26 Oct 2026 · 10:30 UTC</option><option value="2026-10-26T11:00:00Z">26 Oct 2026 · 11:00 UTC (current)</option><option value="2026-10-26T14:00:00Z">26 Oct 2026 · 14:00 UTC</option></select></div>' +
      '<div class="field"><div class="field-label">Reason for review</div><textarea class="textarea" data-model="consult.reason" placeholder="Describe what the clinician should review…">' + esc(st.reason || '') + '</textarea></div>' +
      '<label class="check"><input type="checkbox" data-action="consult-consent" ' + (st.consent ? 'checked' : '') + '><span>I consent to sharing this simulated intake record and risk summary with the assigned clinician.<span class="check-meta">Consent record ' + esc(c.consentId) + ' · revocable at any time</span></span></label>';
  }
  var foot = phase === 'success'
    ? btn('Open doctor review', 'goto-doctor', { cls: 'primary' }) + standardFoot()
    : btn('Request consultation', 'consult-submit', { cls: 'primary', disabled: !st.consent, loading: phase === 'loading' }) + standardFoot();
  return { title: 'Consultation request', sub: 'CASE CASE-4417 · FGX-P-20418', body: body, note: 'No appointment is created outside this simulation.', foot: foot };
}
function emergencyModal(st) {
  var phase = st.phase || 'form';
  var body;
  if (phase === 'success') {
    body = '<div class="notice tone-rose">' + icon('alert') + '<div><span class="notice-title">SIMULATED INCIDENT CREATED</span><b>' + esc(st.id) + '</b> has been queued in the emergency operator console. No real emergency service, dispatcher, or vehicle has been contacted.</div></div>' +
      '<div class="mini-list mt-16">' + statRow('Scenario', st.scenario || 'Breathing difficulty') + statRow('Patient', 'FGX-P-20418 · Aarav Mehta') + statRow('Location', D.patient.addressLabel) + statRow('Consent', 'CNS-7712 · verified') + statRow('Status', 'REPORTED · awaiting operator verification') + statRow('Data label', 'SIMULATED / EXERCISE') + '</div>';
  } else {
    body = '<div class="notice tone-rose">' + icon('alert') + '<div><span class="notice-title">SIMULATION ONLY — NOT A REAL EMERGENCY SERVICE</span>This control does not call, message, or dispatch anyone. If you are experiencing a real emergency, use your local emergency number immediately.</div></div>' +
      '<div class="field mt-16"><div class="field-label">Exercise scenario</div><select class="select" id="emScenario">' +
        '<option value="Breathing difficulty">Breathing difficulty — simulated</option>' +
        '<option value="Chest discomfort">Chest discomfort — simulated</option>' +
        '<option value="Fall with injury">Fall with injury — simulated</option>' +
        '<option value="Device signal loss">Device signal loss — simulated</option></select></div>' +
      '<div class="field"><div class="field-label">Location <span class="hint">from patient profile</span></div><input class="input mono" value="' + esc(D.patient.addressLabel) + '" disabled></div>' +
      '<div class="field"><div class="field-label">Notes to operator <span class="hint">optional</span></div><textarea class="textarea" data-model="emergency.notes" placeholder="Add context for the simulated drill…">' + esc(st.notes || '') + '</textarea></div>' +
      '<div class="callout tone-amber"><b>Safety rule SR-06</b> requires explicit consent and a persistent simulation label on every downstream event. All communications in this workflow are internal to the sandbox.</div>' +
      '<label class="check mt-16"><input type="checkbox" data-action="emergency-consent" ' + (st.consent ? 'checked' : '') + '><span>I understand this is a simulation and consent to creating a simulated incident for my record.</span></label>';
  }
  var foot = phase === 'success'
    ? btn('Open operator console', 'goto-operator', { cls: 'danger' }) + standardFoot()
    : btn('Trigger simulated incident', 'emergency-submit', { cls: 'danger', disabled: !st.consent, loading: phase === 'loading', icon: 'zap' }) + standardFoot();
  return { title: 'Emergency workflow — simulation', sub: 'PATIENT FGX-P-20418 · SR-06 GUARDED', body: body, note: 'Does not contact emergency services.', foot: foot };
}
function incidentModal(st) {
  var phase = st.phase || 'form';
  var body = '<div class="notice tone-amber">' + icon('info') + '<div><b>Drill incident builder.</b> Records created here are synthetic exercises. No dispatch signal leaves the sandbox.</div></div>' +
    '<div class="field-row mt-16"><div class="field"><div class="field-label">Incident type</div><select class="select" id="incType"><option>Breathing difficulty</option><option>Chest discomfort</option><option>Fall with injury</option><option>Device signal loss</option></select></div>' +
    '<div class="field"><div class="field-label">Severity</div><select class="select" id="incSeverity"><option>High</option><option>Medium</option><option>Low</option></select></div></div>' +
    '<div class="field"><div class="field-label">Grid / location</div><select class="select" id="incGrid"><option>Sandbox Zone 4 · Banjara Hills Grid 12</option><option>Sandbox Zone 2 · Jubilee Hills Grid 07</option><option>Sandbox Zone 6 · Gachibowli Grid 21</option></select></div>' +
    '<div class="field"><div class="field-label">Reporting channel</div><select class="select" id="incChannel"><option>Operator drill console</option><option>Patient app (simulated)</option><option>Voice line (simulated)</option></select></div>';
  return { title: 'Create simulated incident', sub: 'EMERGENCY OPERATIONS · EXERCISE MODE', body: body, note: 'Synthetic incident · SR-06 labelled.',
    foot: btn('Create incident', 'incident-submit', { cls: 'primary', loading: phase === 'loading' }) + standardFoot() };
}
function confirmModal(p) {
  return { title: p.title || 'Confirm action', size: 'narrow', sub: p.sub || 'GOVERNANCE ACTION · SIMULATED',
    body: '<div class="notice tone-amber">' + icon('alert') + '<div>' + (p.message || 'This action will be written to the simulated audit log.') + '</div></div>' +
      (p.detail || ''), note: 'No production system is affected.',
    foot: btn('Cancel', 'close-modal', { cls: 'ghost' }) + btn(p.confirmLabel || 'Confirm', p.confirmAction || 'noop', { cls: p.confirmClass || 'primary', arg: p.arg }) };
}
function handoffModal() {
  return { title: 'Handoff record · SBAR', sub: 'AMB-07 → SANDBOX RECEIVING FACILITY NORTH · SIMULATED',
    body: '<div class="notice tone-emerald">' + icon('check') + '<div><b>Handoff completed in simulation.</b> The receiving facility acknowledged the SBAR summary. No real patient transfer occurred.</div></div>' +
      '<div class="hr-label">STRUCTURED HANDOFF</div>' +
      D.transit.sbar.map(function (s) {
        return '<div class="evidence-item"><div class="ev-top"><div class="ev-title">' + s.id + ' · ' + esc(s.label) + '</div>' + tag('COMPLETE', 'emerald') + '</div><div class="ev-meta">' + esc(s.detail) + '</div></div>';
      }).join('') +
      '<div class="hr-label">TRANSIT SUMMARY</div><div class="mini-list">' +
      statRow('Unit', 'AMB-07') + statRow('Incident', 'INC-2026-1048') + statRow('Patient', 'FGX-P-20418') +
      statRow('Departed', isoDate(D.transit.departedAt)) + statRow('Pre-alert', 'SENT · ' + isoTime(D.transit.destination.preAlertAt)) +
      statRow('Receiving bay', D.transit.destination.bay) + '</div>',
    note: 'Synthetic handoff record. Not a clinical document.', foot: standardFoot() };
}
function statRow(k, v) { return '<div class="mini-row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>'; }

/* drawer ------------------------------------------------------------------- */
var DRAWER_TABS = [
  { id: 'patient', label: 'Patient' }, { id: 'vitals', label: 'Vitals' }, { id: 'risk', label: 'Risk model' },
  { id: 'cases', label: 'Cases' }, { id: 'evidence', label: 'Evidence' }, { id: 'rules', label: 'Safety rules' },
  { id: 'incident', label: 'Incident' }, { id: 'transit', label: 'Transit' }, { id: 'models', label: 'Models' },
  { id: 'audit', label: 'Audit' }, { id: 'metrics', label: 'Metrics' }
];
function drawerData() {
  switch (S.drawerTab) {
    case 'vitals': return D.vitals;
    case 'risk': return D.risk;
    case 'cases': return activeCase() || D.cases[0];
    case 'evidence': return D.evidence;
    case 'rules': return D.safetyRules;
    case 'incident': return activeIncident() || D.incidents[0];
    case 'transit': return D.transit;
    case 'models': return D.models;
    case 'audit': return D.audit;
    case 'metrics': return D.metrics;
    default: return D.patient;
  }
}
function drawerHtml() {
  return '<div class="drawer" role="dialog" aria-modal="true" aria-label="Data inspector"><header class="modal-head">' +
    '<div><h2>Data inspector</h2><div class="mh-sub">LIVE STATE · SANDBOX OBJECT MODEL · READ ONLY</div></div>' +
    '<button class="close-x" data-action="close-drawer" aria-label="Close inspector">×</button></header>' +
    '<div class="drawer-tabs">' + DRAWER_TABS.map(function (t) {
      return '<button data-action="drawer-tab" data-arg="' + t.id + '" class="' + (S.drawerTab === t.id ? 'on' : '') + '">' + t.label + '</button>';
    }).join('') + '</div>' +
    '<div style="padding:9px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px">' +
    '<span class="mono fs-10 c-muted">TYPE: ' + (Array.isArray(drawerData()) ? 'ARRAY' : 'OBJECT') + ' · ' + esc(D.meta.dataClassification) + '</span>' +
    '<div class="btn-row">' + btn('Copy JSON', 'copy-json', { cls: 'ghost tiny', icon: 'copy' }) + btn('Download', 'download-json', { cls: 'ghost tiny', icon: 'download' }) + '</div></div>' +
    '<div style="padding:12px 14px;overflow:auto;flex:1"><pre class="pre" style="max-height:none">' + jsonHtml(drawerData()) + '</pre></div>' +
    '<footer class="modal-foot"><div class="foot-note">All identifiers and values are synthetic. Field shapes mirror the planned API contract.</div>' + standardFoot() + '</footer></div>';
}

/* search ------------------------------------------------------------------- */
function searchResults(q) {
  var out = [];
  var term = q.toLowerCase().trim();
  function add(group, id, label, meta, action, arg) {
    if (!term || (id + ' ' + label + ' ' + meta).toLowerCase().indexOf(term) >= 0) out.push({ group: group, id: id, label: label, meta: meta, action: action, arg: arg });
  }
  add('PATIENT', D.patient.id, D.patient.legalName, 'Level 2 · Enhanced observation', 'search-goto', 'patient');
  D.cases.forEach(function (c) { add('CASES', c.id, c.patientName + ' · ' + c.chiefComplaint, c.priority + ' · risk ' + c.risk, 'search-case', c.id); });
  D.incidents.forEach(function (i) { add('INCIDENTS', i.id, i.type, i.status + ' · ' + i.grid, 'search-incident', i.id); });
  D.models.forEach(function (m) { add('MODELS', m.id + ' ' + m.version, m.purpose, m.status + ' · drift ' + m.drift, 'search-goto', 'admin'); });
  D.evidence.forEach(function (e) { add('EVIDENCE', e.id, e.title, e.source, 'search-evidence', e.id); });
  return out;
}
function searchHtml() {
  var res = searchResults(S.searchQuery);
  var groups = {};
  res.forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });
  var body = '';
  Object.keys(groups).forEach(function (g) {
    body += '<div class="search-group">' + g + ' · ' + groups[g].length + '</div>' + groups[g].slice(0, 6).map(function (r) {
      return '<button class="search-hit" data-action="' + r.action + '" data-arg="' + esc(r.arg) + '"><span><span class="mono c-cyan" style="font-size:10px">' + esc(r.id) + '</span> · ' + esc(r.label) + '</span><span class="sh-meta">' + esc(r.meta) + '</span></button>';
    }).join('');
  });
  if (!res.length) body = emptyState('No matching records', 'Try a case ID, patient name, incident ID, or model version.', '');
  return '<div class="search-overlay" data-backdrop="1"><div class="search-panel" role="dialog" aria-modal="true" aria-label="Global search">' +
    '<div class="search-input-wrap">' + icon('search') + '<input id="searchInput" placeholder="Search cases, patients, incidents, models, evidence…" value="' + esc(S.searchQuery) + '" data-model="searchQuery" autocomplete="off"><span class="kbd">ESC</span></div>' +
    '<div class="search-results">' + body + '</div>' +
    '<div class="search-foot"><span><b>' + res.length + '</b> matches</span><span>↵ open first result</span><span>SANDBOX INDEX ONLY</span></div></div></div>';
}

/* toasts ------------------------------------------------------------------- */
function toast(title, desc, tone) {
  var id = 'T' + Date.now() + Math.random().toString(36).slice(2, 6);
  S.toasts.push({ id: id, title: title, desc: desc, tone: tone || 'cyan' });
  renderToasts();
  setTimeout(function () {
    S.toasts = S.toasts.filter(function (t) { return t.id !== id; });
    renderToasts();
  }, 4600);
}
function renderToasts() {
  $('#toastRoot').innerHTML = S.toasts.map(function (t) {
    return '<div class="toast tone-' + t.tone + '">' + icon(t.tone === 'rose' ? 'alert' : t.tone === 'amber' ? 'info' : 'check') +
      '<div><div class="tt">' + esc(t.title) + '</div><div class="td">' + esc(t.desc) + '</div></div></div>';
  }).join('');
}
