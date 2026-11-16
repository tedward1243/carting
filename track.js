'use strict';
/* ============================================================
   Track generation — every circuit is built from its name (seed)
   ============================================================ */

const TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const TRACK_CACHE = {};

function buildTrack(name, tier) {
  const key = name + '|' + tier.id;
  if (TRACK_CACHE[key]) return TRACK_CACHE[key];
  const rnd = mulberry32(hashStr(name));
  const R = tier.radius, W = tier.width, runoff = tier.runoff;
  const spacing = 10;
  const AMP = [0, 0, 0.26, 0.2, 0.13, 0.08, 0.05];
  let scale = 1, best = null;

  for (let attempt = 0; attempt < 16; attempt++) {
    const harm = [];
    for (let k = 2; k <= 6; k++) harm.push({ k, a: (0.35 + rnd() * 0.65) * AMP[k] * scale, p: rnd() * TAU });
    const sx = 1 + rnd() * 0.45, rot = rnd() * TAU;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    // raw polyline
    const N = 1600, rx = new Float64Array(N), ry = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const th = i / N * TAU;
      let r = 1;
      for (const h of harm) r += h.a * Math.sin(h.k * th + h.p);
      r = R * Math.max(0.4, r);
      const x = Math.cos(th) * r * sx, y = Math.sin(th) * r;
      rx[i] = x * cr - y * sr; ry[i] = x * sr + y * cr;
    }
    const pts = resample(rx, ry, spacing);
    computeGeometry(pts, spacing);
    const ok = validate(pts, spacing, W, runoff);
    if (ok) { best = pts; break; }
    scale *= 0.85;
    best = pts;
  }

  const pts = best;
  const n = pts.length;
  // Start line: end of the straightest stretch
  let bestI = 0, bestSum = Infinity;
  const win = 60;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < win; j++) s += Math.abs(pts[(i + j) % n].k);
    if (s < bestSum) { bestSum = s; bestI = i; }
  }
  const startIdx = (bestI + 32) % n;
  const rot = pts.slice(startIdx).concat(pts.slice(0, startIdx));
  computeGeometry(rot, spacing);
  computeRacingLine(rot, W);

  const L = n * spacing;
  // bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of rot) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }

  const path = new Path2D();
  rot.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
  path.closePath();
  const linePath = new Path2D();
  rot.forEach((p, i) => {
    const x = p.x + p.nx * p.line, y = p.y + p.ny * p.line;
    i ? linePath.lineTo(x, y) : linePath.moveTo(x, y);
  });
  linePath.closePath();

  // decorations
  const drng = mulberry32(hashStr(name + 'deco'));
  const trees = [], tires = [];
  const clear = W / 2 + runoff + 34;
  const margin = 500;
  let tries = 0;
  while (trees.length < 260 && tries < 3000) {
    tries++;
    const x = minX - margin + drng() * (maxX - minX + margin * 2);
    const y = minY - margin + drng() * (maxY - minY + margin * 2);
    let md = Infinity;
    for (let i = 0; i < n; i += 4) { const dx = rot[i].x - x, dy = rot[i].y - y; const d = dx * dx + dy * dy; if (d < md) md = d; }
    if (Math.sqrt(md) > clear + 10) trees.push({ x, y, r: 16 + drng() * 22, shade: drng() });
  }
  // tyre stacks on the outside of fast corners
  for (let i = 0; i < n; i += 6) {
    const p = rot[i];
    if (Math.abs(p.k) > 1 / (W * 2.6)) {
      const side = p.k > 0 ? -1 : 1; // outside
      const d = W / 2 + runoff + 10;
      tires.push({ x: p.x + p.nx * d * side, y: p.y + p.ny * d * side });
    }
  }
  // grandstand next to start
  const sp = rot[Math.floor(n * 0.98)];
  const stand = { x: sp.x - sp.nx * (W / 2 + runoff + 70), y: sp.y - sp.ny * (W / 2 + runoff + 70), a: sp.a };

  // item box rows
  const boxRows = [Math.floor(n * 0.3), Math.floor(n * 0.68)];

  const track = { name, pts: rot, n, spacing, L, W, runoff, path, linePath, trees, tires, stand, boxRows, bounds: { minX, minY, maxX, maxY } };
  TRACK_CACHE[key] = track;
  return track;
}

function resample(rx, ry, spacing) {
  const N = rx.length;
  const cum = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    cum[i + 1] = cum[i] + Math.hypot(rx[j] - rx[i], ry[j] - ry[i]);
  }
  const total = cum[N];
  const n = Math.round(total / spacing);
  const step = total / n;
  const pts = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const d = k * step;
    while (cum[seg + 1] < d) seg++;
    const t = (d - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
    const j = (seg + 1) % N;
    pts.push({ x: rx[seg] + (rx[j] - rx[seg]) * t, y: ry[seg] + (ry[j] - ry[seg]) * t });
  }
  return pts;
}

function computeGeometry(pts, spacing) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    pts[i].a = Math.atan2(b.y - a.y, b.x - a.x);
  }
  let k = new Float64Array(n);
  for (let i = 0; i < n; i++) k[i] = angDiff(pts[(i + 1) % n].a, pts[(i - 1 + n) % n].a) / (2 * spacing);
  for (let pass = 0; pass < 4; pass++) {
    const k2 = new Float64Array(n);
    for (let i = 0; i < n; i++) k2[i] = (k[(i - 1 + n) % n] + 2 * k[i] + k[(i + 1) % n]) / 4;
    k = k2;
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    p.k = k[i];
    p.nx = -Math.sin(p.a); p.ny = Math.cos(p.a);
  }
}

function validate(pts, spacing, W, runoff) {
  const n = pts.length;
  let maxK = 0;
  for (const p of pts) maxK = Math.max(maxK, Math.abs(p.k));
  if (1 / maxK < W * 0.8) return false;
  const minSep = W + runoff * 2 + 24;
  const skip = Math.ceil(minSep * 1.7 / spacing);
  const ms2 = minSep * minSep;
  for (let i = 0; i < n; i += 2) {
    for (let j = i + skip; j < n; j += 2) {
      const sep = Math.min(j - i, n - (j - i));
      if (sep <= skip) continue;
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
      if (dx * dx + dy * dy < ms2) return false;
    }
  }
  return true;
}

function computeRacingLine(pts, W) {
  const n = pts.length;
  // wide curvature average
  const win = 22;
  const kw = new Float64Array(n);
  let acc = 0;
  for (let j = -win; j <= win; j++) acc += pts[(j + n) % n].k;
  for (let i = 0; i < n; i++) {
    kw[i] = acc / (win * 2 + 1);
    acc -= pts[(i - win + n) % n].k;
    acc += pts[(i + win + 1) % n].k;
  }
  let line = new Float64Array(n);
  for (let i = 0; i < n; i++) line[i] = clamp(kw[i] * W * 75, -0.3 * W, 0.3 * W);
  for (let pass = 0; pass < 6; pass++) {
    const l2 = new Float64Array(n);
    for (let i = 0; i < n; i++) l2[i] = (line[(i - 2 + n) % n] + line[(i - 1 + n) % n] + line[i] + line[(i + 1) % n] + line[(i + 2) % n]) / 5;
    line = l2;
  }
  for (let i = 0; i < n; i++) pts[i].line = line[i];
}

/* Small preview of a track drawn into a canvas element */
function drawTrackPreview(canvas, track, color) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 200, h = canvas.clientHeight || 140;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const b = track.bounds;
  const s = Math.min((w - 24) / (b.maxX - b.minX), (h - 24) / (b.maxY - b.minY));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(s, s);
  ctx.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = track.W * 2.2;
  ctx.stroke(track.path);
  ctx.strokeStyle = color || '#fff';
  ctx.lineWidth = Math.max(track.W * 0.7, 3 / s);
  ctx.stroke(track.path);
  const p = track.pts[0];
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(p.x, p.y, 7 / s, 0, TAU); ctx.fill();
  ctx.restore();
}
