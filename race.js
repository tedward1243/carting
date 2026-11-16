'use strict';
/* ============================================================
   Race engine — physics, AI, items, rendering, HUD
   ============================================================ */

const ITEM_DEFS = {
  nitro: { icon: '🚀', name: 'Nitro' },
  bolt: { icon: '⚡', name: 'Bolt' },
  oil: { icon: '🛢️', name: 'Oil Slick' },
  shield: { icon: '🛡️', name: 'Shield' },
  storm: { icon: '🌩️', name: 'Storm' }
};
const ITEM_KEYS = Object.keys(ITEM_DEFS);

/* ---------- tiny synth ---------- */
class Sfx {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
  }
  init() {
    if (!this.enabled || this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      this.eng = this.ctx.createOscillator(); this.eng.type = 'sawtooth';
      this.eng2 = this.ctx.createOscillator(); this.eng2.type = 'square';
      this.engFilter = this.ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 700;
      this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
      this.eng.connect(this.engFilter); this.eng2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.eng.start(); this.eng2.start();
    } catch (e) { this.ctx = null; }
  }
  engine(speedFrac, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 55 + speedFrac * 170;
    this.eng.frequency.setTargetAtTime(f, t, 0.05);
    this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.05 + speedFrac * 0.05 : 0, t, 0.1);
  }
  beep(freq, dur, type = 'square', vol = 0.15) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) { }
  }
  whoosh() { this.beep(220, 0.35, 'sawtooth', 0.12); setTimeout(() => this.beep(440, 0.25, 'sawtooth', 0.08), 60); }
  hit() { this.beep(90, 0.3, 'square', 0.25); }
  pickup() { this.beep(880, 0.08, 'triangle', 0.15); setTimeout(() => this.beep(1320, 0.1, 'triangle', 0.12), 70); }
  stop() { if (this.ctx) { try { this.ctx.close(); } catch (e) { } this.ctx = null; } }
}

class RaceEngine {
  /* opts: { tier, track, laps, racers, items, ers, difficulty, sound, onEnd } */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.o = opts;
    this.tier = opts.tier;
    this.track = opts.track;
    this.laps = opts.laps;
    this.isKart = this.tier.vehicle === 'kart';
    this.itemsOn = opts.items;
    this.ersOn = opts.ers;
    this.driftOn = this.isKart || opts.items;
    this.sfx = new Sfx(opts.sound);
    this.keys = {};
    this.touch = {};
    this.tilt = opts.tilt || null; // shared { on, steer } object updated by the UI
    this.time = 0;          // race clock (after green)
    this.clock = 0;         // total time since start
    this.state = 'countdown';
    this.lights = 0;
    this.goAt = 3.2 + Math.random() * 0.7;
    this.paused = false;
    this.particles = [];
    this.skids = [];
    this.hazards = [];
    this.shots = [];
    this.flashes = [];
    this.stormFlash = 0;
    this.shake = 0;
    this.endTimer = -1;
    this.done = false;
    this.messages = [];
    this.cam = { x: 0, y: 0, z: 1 };
    this.diffK = { easy: 0.8, normal: 0.88, hard: 0.95 }[opts.difficulty] || 0.88;
    this.cars = opts.racers.map((r, i) => this.makeCar(r, i));
    this.player = this.cars.find(c => c.isPlayer);
    this.computeOrder();
    this.boxes = [];
    if (this.itemsOn) {
      for (const idx of this.track.boxRows) {
        const p = this.track.pts[idx];
        for (const f of [-0.32, -0.11, 0.11, 0.32]) {
          this.boxes.push({ x: p.x + p.nx * f * this.track.W, y: p.y + p.ny * f * this.track.W, active: true, t: 0 });
        }
      }
    }
    this.grassPattern = this.makeGrass();
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.cam.z = this.targetZoom(0);
    this.throttlePressAt = -10;
    this.bindInput();
    this.resize();
    this.last = performance.now();
    this.acc = 0;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  makeGrass() {
    const c = document.createElement('canvas');
    c.width = 160; c.height = 160;
    const g = c.getContext('2d');
    const dark = this.isKart ? '#3f7a3a' : '#3b6f3f';
    const light = this.isKart ? '#468541' : '#427a45';
    g.fillStyle = dark; g.fillRect(0, 0, 160, 160);
    g.fillStyle = light; g.fillRect(0, 0, 160, 80);
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 160, Math.random() * 160, 2, 2);
    return this.ctx.createPattern(c, 'repeat');
  }

  makeCar(r, slot) {
    const T = this.tier, tr = this.track, s = r.stats, m = r.machine;
    const perf = r.perf || 1;
    const kart = this.isKart;
    const row = Math.floor(slot / 2), side = slot % 2 ? -1 : 1;
    const back = (kart ? 34 : 46) + row * (kart ? 40 : 56) + (slot % 2) * (kart ? 14 : 20);
    let idx = tr.n - Math.round(back / tr.spacing);
    idx = (idx + tr.n) % tr.n;
    const p = tr.pts[idx];
    const lat = side * tr.W * 0.22;
    const c = Object.assign({}, r, {
      maxSpeed: T.baseSpeed * (0.86 + 0.12 * s.spd / 100 + 0.07 * m.eng) * perf,
      accel: T.baseAcc * (0.75 + 0.35 * s.acc / 100 + 0.12 * m.chas) * perf,
      turn: T.baseTurn * (0.86 + 0.16 * s.hnd / 100 + 0.06 * m.tire),
      grip: 5.5 + 4 * s.hnd / 100 + 1.5 * m.tire,
      brake: T.baseAcc * 1.7,
      len: kart ? 28 : 40, wid: kart ? 18 : 18, rad: kart ? 13 : 15,
      x: p.x + p.nx * lat, y: p.y + p.ny * lat, h: p.a, vx: 0, vy: 0,
      idx, s: idx * tr.spacing, total: idx * tr.spacing - tr.L, maxLap: -1, lapStart: 0, lapTimes: [], best: Infinity,
      finished: false, finishTime: 0, pos: slot + 1, grid: slot + 1,
      item: null, itemRoll: 0, rollItem: null, boost: 0, shield: 0, spin: 0, spinDir: 1, slow: 0,
      drift: false, driftDir: 0, driftCharge: 0, ers: 1, ersActive: false, slip: 0, offroad: false, wear: 0,
      lat: 0, laneOff: (Math.random() - 0.5) * tr.W * 0.24, lanePref: (Math.random() - 0.5) * tr.W * 0.24,
      mistake: 0, mistakeSteer: 0, recover: 0, recoverDir: 1, itemHold: 0, startDelay: 0.08 + Math.random() * 0.35, stuck: 0,
      aiK: clamp(this.diffK + (s.rc - 60) / 100 * 0.04 + (s.foc - 60) / 100 * 0.02, 0.7, 0.985),
      rubber: 1, prevItemKey: false, lastHitBy: null, wrongWay: 0, auto: false, bog: 0
    });
    return c;
  }

  /* ---------- input ---------- */
  bindInput() {
    this.onKeyDown = e => {
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (!this.keys[k] && (k === 'ArrowUp' || k === 'KeyW')) this.throttlePressAt = this.clock;
      this.keys[k] = true;
      this.sfx.init();
      if ((k === 'Escape' || k === 'KeyP') && !this.done) this.togglePause();
      if (k === 'KeyR' && this.state === 'race' && !this.paused) this.resetToTrack(this.player);
    };
    this.onKeyUp = e => { this.keys[e.code] = false; };
    this.onResize = () => this.resize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }
  setTouch(key, on) {
    if (key === 'thr' && on && !this.touch.thr) this.throttlePressAt = this.clock;
    this.touch[key] = on;
    this.sfx.init();
  }
  playerInput() {
    const k = this.keys, t = this.touch;
    let steer = 0;
    if (k.ArrowLeft || k.KeyA || t.left) steer -= 1;
    if (k.ArrowRight || k.KeyD || t.right) steer += 1;
    if (steer === 0 && this.tilt && this.tilt.on) steer = this.tilt.steer; // analog phone tilt
    return {
      thr: !!(k.ArrowUp || k.KeyW || t.thr),
      brk: !!(k.ArrowDown || k.KeyS || t.brk),
      steer,
      drift: !!(k.ShiftLeft || k.ShiftRight || k.KeyX || t.drift),
      item: !!(k.Space || k.KeyE || t.item)
    };
  }
  togglePause() {
    this.paused = !this.paused;
    if (this.o.onPause) this.o.onPause(this.paused);
    this.sfx.engine(0, false);
    if (!this.paused) this.last = performance.now();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = this.canvas.clientWidth; this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.sfx.stop();
    this.done = true;
  }

  /* ---------- main loop ---------- */
  loop(now) {
    if (this.done) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      this.acc += dt;
      const step = 1 / 120;
      let n = 0;
      while (this.acc >= step && n < 10 && !this.done) { this.update(step); this.acc -= step; n++; }
      if (n >= 10) this.acc = 0;
    }
    if (!this.done) this.render();
  }

  update(dt) {
    this.clock += dt;
    const tr = this.track;
    if (this.state === 'countdown') {
      this.lights = Math.min(5, Math.floor(this.clock / 0.6));
      if (this.lights !== this.prevLights) { if (this.lights > 0) this.sfx.beep(440, 0.15); this.prevLights = this.lights; }
      if (this.clock >= this.goAt) {
        this.state = 'race';
        this.sfx.beep(880, 0.4);
        this.flash('GO!', '#7CFF6B', 1.2, 64);
        // rocket start
        const pi = this.playerInput();
        const since = this.clock - this.throttlePressAt;
        if (pi.thr && since < 0.45) { this.player.boost = 1.1; this.flash('ROCKET START!', '#ffd166', 1.5); this.sfx.whoosh(); }
        else if (pi.thr && since > 2.2) { this.player.bog = 0.6; this.flash('Bogged down…', '#ff6b6b', 1.2); }
      }
    } else if (this.state === 'race') {
      this.time += dt;
    }
    if (this.state === 'race' && this.time < 0.25 && this.throttlePressAt > this.goAt && this.throttlePressAt - this.goAt < 0.12 && !this.player.rocketChecked) {
      this.player.rocketChecked = true; this.player.boost = 0.9; this.flash('ROCKET START!', '#ffd166', 1.5); this.sfx.whoosh();
    }

    const racing = this.state === 'race';
    // rubber banding & order
    this.computeOrder();
    for (const c of this.cars) {
      let inp;
      if (!racing) inp = { thr: false, brk: true, steer: 0, drift: false, item: false };
      else if (c.isPlayer && !c.auto) inp = this.playerInput();
      else inp = this.aiInput(c, dt);
      if (!c.isPlayer && racing && this.time < c.startDelay) inp.thr = false;
      if (c.bog > 0) { c.bog -= dt; inp.thr = false; }
      if (!c.isPlayer) this.updateRubber(c, dt);
      this.updateCar(c, dt, inp);
    }
    this.collideCars();
    this.updateSlipstream(dt);
    if (this.itemsOn) this.updateItems(dt);
    this.updateParticles(dt);

    // end of race
    if (this.player.finished) {
      if (this.endTimer < 0) this.endTimer = 0;
      this.endTimer += dt;
      if (this.endTimer > 7 || this.cars.every(c => c.finished)) this.finish(false);
    }
    // camera
    const p = this.player;
    const lead = 0.35;
    const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    const sp = Math.hypot(p.vx, p.vy);
    this.cam.z += (this.targetZoom(sp) - this.cam.z) * Math.min(1, dt * 2);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.stormFlash = Math.max(0, this.stormFlash - dt * 2);
    for (const f of this.flashes) f.t -= dt;
    this.flashes = this.flashes.filter(f => f.t > 0);
    // engine sound
    this.sfx.engine(clamp(sp / (this.tier.baseSpeed * 1.1), 0, 1.2), !this.paused);
  }

  targetZoom(speed) {
    const base = Math.min(this.w || 1000, (this.h || 700) * 1.35) / this.tier.view;
    return base * (1 - 0.18 * clamp(speed / this.tier.baseSpeed, 0, 1.2));
  }

  flash(text, color = '#fff', t = 1.5, size = 40) { this.flashes.push({ text, color, t, max: t, size }); }

  computeOrder() {
    const ord = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.total - a.total;
    });
    ord.forEach((c, i) => c.pos = i + 1);
    this.order = ord;
  }

  updateRubber(c, dt) {
    const gap = this.player.total - c.total; // positive: AI behind
    let target = 1;
    const strength = { easy: 1.3, normal: 1, hard: 0.6 }[this.o.difficulty] || 1;
    if (gap > 500) target = 1 + 0.035 * strength;
    else if (gap < -800) target = 1 - 0.03 * strength;
    c.rubber += (target - c.rubber) * Math.min(1, dt * 0.5);
  }

  /* ---------- physics ---------- */
  updateCar(c, dt, inp) {
    const tr = this.track, T = this.tier;
    const raceFrac = clamp(c.total / (tr.L * this.laps), 0, 1);
    const fade = (1 - c.stats.fit / 100) * (this.isKart ? 0.025 : 0.05) * raceFrac;
    let cs = Math.cos(c.h), sn = Math.sin(c.h);
    let vF = c.vx * cs + c.vy * sn;

    let maxS = c.maxSpeed * (1 - fade) * c.rubber;
    if (c.offroad) maxS *= 0.5 + 0.12 * c.stats.foc / 100;
    if (c.boost > 0) maxS *= 1.32;
    if (c.ersActive) maxS *= 1.1;
    if (c.slip > 0.35) maxS *= 1.04 + 0.04 * c.stats.rc / 100;
    if (c.slow > 0) maxS *= 0.62;

    // ERS
    c.ersActive = false;
    if (this.ersOn && !this.itemsOn) {
      if (inp.item && c.ers > 0.02 && c.spin <= 0) { c.ersActive = true; c.ers -= 0.2 * dt; }
      else c.ers += (inp.brk ? 0.16 : 0.025) * dt;
      c.ers = clamp(c.ers, 0, 1);
    }

    // drift (only player — AI doesn't drift)
    if (this.driftOn && c.isPlayer && !c.auto) {
      if (!c.drift && inp.drift && Math.abs(inp.steer) > 0.3 && vF > 130 && !c.offroad && c.spin <= 0) {
        c.drift = true; c.driftDir = Math.sign(inp.steer); c.driftCharge = 0;
      }
      if (c.drift) {
        if (!inp.drift || vF < 90 || c.spin > 0) {
          const lvl = c.driftCharge > 2.4 ? 3 : c.driftCharge > 1.5 ? 2 : c.driftCharge > 0.75 ? 1 : 0;
          if (lvl && !c.offroad && c.spin <= 0) {
            c.boost = Math.max(c.boost, [0, 0.45, 0.85, 1.3][lvl]);
            this.sfx.whoosh();
            if (lvl === 3) this.flash('ULTRA BOOST', '#d38cff', 0.8, 30);
          }
          c.drift = false;
        } else {
          if (c.offroad) c.driftCharge = Math.max(0, c.driftCharge - dt * 2);
          else c.driftCharge += dt * (0.7 + 0.7 * Math.max(0, inp.steer * c.driftDir));
        }
      }
    }

    // steering
    const spd = Math.abs(vF);
    if (c.spin > 0) {
      c.spin -= dt;
      c.h += c.spinDir * 9 * dt;
      inp = { thr: false, brk: false, steer: 0 };
    } else {
      let omega = c.turn * Math.min(1, spd / 50) * Math.max(0.35, 1 - 0.45 * spd / T.baseSpeed);
      omega *= 1 - 0.1 * c.wear;
      let steer = inp.steer;
      if (c.drift) { steer = clamp(c.driftDir * 0.6 + inp.steer * 0.55, -1.25, 1.25); omega *= 1.12; }
      c.h += steer * omega * dt * (vF < -5 ? -1 : 1);
      if (inp.pivot) c.h += clamp(inp.pivot, -3.2 * dt, 3.2 * dt);
    }

    cs = Math.cos(c.h); sn = Math.sin(c.h);
    vF = c.vx * cs + c.vy * sn;
    let vL = -c.vx * sn + c.vy * cs;

    // longitudinal
    let acc = c.accel * (c.boost > 0 ? 1.7 : 1) * (c.ersActive ? 1.25 : 1);
    if (inp.thr) {
      if (vF < maxS) {
        const f = Math.max(0, vF) / maxS;
        vF += acc * (1 - f * f) * dt;
      }
    } else if (inp.brk) {
      if (vF > 15) vF -= c.brake * dt;
      else vF = Math.max(vF - c.accel * 0.5 * dt, -80);
    } else {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), 80 * dt);
    }
    if (vF > maxS) vF -= (vF - maxS) * (c.offroad ? 3 : 1.4) * dt;

    // lateral grip
    let g = c.drift ? 2.3 : c.grip;
    if (c.spin > 0) g = 1.5;
    if (c.offroad) g *= 0.7;
    g *= 1 - 0.25 * c.wear;
    vL *= Math.exp(-g * dt);

    c.vx = cs * vF - sn * vL;
    c.vy = sn * vF + cs * vL;
    c.x += c.vx * dt;
    c.y += c.vy * dt;

    c.boost = Math.max(0, c.boost - dt);
    c.shield = Math.max(0, c.shield - dt);
    c.slow = Math.max(0, c.slow - dt);
    if (!this.isKart) c.wear = clamp(raceFrac * 0.9, 0, 1);

    // effects
    if (c.boost > 0 && Math.random() < 0.7) this.addParticle(c.x - cs * c.len * 0.6, c.y - sn * c.len * 0.6, -cs * 80 + (Math.random() - 0.5) * 60, -sn * 80 + (Math.random() - 0.5) * 60, 0.3, Math.random() < 0.5 ? '#ffb703' : '#fb5607', 5);
    if (c.drift) {
      const lvl = c.driftCharge > 2.4 ? 3 : c.driftCharge > 1.5 ? 2 : c.driftCharge > 0.75 ? 1 : 0;
      const col = ['#cccccc', '#4cc9f0', '#ff9f1c', '#d38cff'][lvl];
      for (const sd of [-1, 1]) {
        if (Math.random() < 0.6) this.addParticle(c.x - cs * c.len * 0.45 + -sn * sd * c.wid * 0.5, c.y - sn * c.len * 0.45 + cs * sd * c.wid * 0.5, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.25, col, lvl ? 3.5 : 2.5);
      }
    }
    if ((c.drift || Math.abs(vL) > 70) && this.skids.length < 900) {
      for (const sd of [-1, 1]) {
        const x = c.x - cs * c.len * 0.4 - sn * sd * c.wid * 0.45, y = c.y - sn * c.len * 0.4 + cs * sd * c.wid * 0.45;
        this.skids.push({ x, y, a: 0.35 });
      }
    }

    this.trackFollow(c, dt);
  }

  trackFollow(c, dt) {
    const tr = this.track, pts = tr.pts, n = tr.n;
    let best = c.idx, bd = Infinity;
    for (let j = -12; j <= 30; j++) {
      const i = (c.idx + j + n) % n;
      const dx = pts[i].x - c.x, dy = pts[i].y - c.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > (tr.W * 2) * (tr.W * 2)) { // lost: full search
      for (let i = 0; i < n; i++) {
        const dx = pts[i].x - c.x, dy = pts[i].y - c.y;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
    }
    c.idx = best;
    const p = pts[best];
    const dx = c.x - p.x, dy = c.y - p.y;
    const lat = dx * p.nx + dy * p.ny;
    c.lat = lat;
    const half = tr.W / 2;
    c.offroad = Math.abs(lat) > half + 4;
    const wall = half + tr.runoff;
    if (Math.abs(lat) > wall) {
      const sd = Math.sign(lat);
      c.x -= p.nx * (Math.abs(lat) - wall) * sd;
      c.y -= p.ny * (Math.abs(lat) - wall) * sd;
      const vn = c.vx * p.nx + c.vy * p.ny;
      if (vn * sd > 0) {
        c.vx -= p.nx * vn * 1.3; c.vy -= p.ny * vn * 1.3;
        const impact = Math.abs(vn);
        c.vx *= 0.82; c.vy *= 0.82;
        if (c.isPlayer && impact > 60) { this.shake = Math.min(1, impact / 250); this.sfx.hit(); }
        if (c.drift) c.drift = false;
      }
    }
    if (c.offroad && Math.random() < 0.3 && Math.hypot(c.vx, c.vy) > 60) {
      this.addParticle(c.x, c.y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.5, this.isKart ? 'rgba(220,200,150,0.7)' : 'rgba(200,190,170,0.7)', 6);
    }
    // progress
    const along = clamp(dx * Math.cos(p.a) + dy * Math.sin(p.a), -tr.spacing, tr.spacing);
    let s = best * tr.spacing + along;
    s = (s + tr.L) % tr.L;
    let ds = s - c.s;
    if (ds < -tr.L / 2) ds += tr.L;
    if (ds > tr.L / 2) ds -= tr.L;
    c.s = s;
    if (c.finished) return;
    c.total += ds;
    // wrong way
    if (c.isPlayer && this.state === 'race') {
      const fwd = Math.cos(c.h) * Math.cos(p.a) + Math.sin(c.h) * Math.sin(p.a);
      c.wrongWay = (fwd < -0.4 && Math.hypot(c.vx, c.vy) > 30) ? c.wrongWay + dt : 0;
    }
    const lap = Math.floor(c.total / tr.L);
    if (lap > c.maxLap && this.state === 'race') {
      if (c.maxLap >= 0) {
        const lt = this.time - c.lapStart;
        c.lapTimes.push(lt);
        if (lt < c.best) c.best = lt;
        if (c.isPlayer && lap < this.laps) {
          if (lap === this.laps - 1) this.flash('FINAL LAP', '#ffd166', 2);
          else this.flash('LAP ' + (lap + 1), '#ffffff', 1.2);
        }
      }
      c.maxLap = lap;
      c.lapStart = this.time;
      if (lap >= this.laps) {
        c.finished = true;
        c.finishTime = this.time;
        if (c.isPlayer) {
          this.computeOrder();
          const pos = c.pos;
          this.flash(pos === 1 ? 'VICTORY!' : 'FINISHED P' + pos, pos === 1 ? '#ffd166' : '#ffffff', 6, 60);
          c.auto = true;
          this.sfx.beep(660, 0.2); setTimeout(() => this.sfx.beep(990, 0.4), 200);
        }
      }
    }
    // stuck detection (AI)
    if (!c.isPlayer || c.auto) {
      if (this.state === 'race' && this.time > 2 && Math.hypot(c.vx, c.vy) < 25 && c.spin <= 0) c.stuck += dt; else c.stuck = 0;
      if (c.stuck > 3) this.resetToTrack(c);
    }
  }

  resetToTrack(c) {
    const tr = this.track;
    const p = tr.pts[c.idx];
    c.x = p.x; c.y = p.y; c.h = p.a; c.vx = Math.cos(p.a) * 40; c.vy = Math.sin(p.a) * 40;
    c.spin = 0; c.drift = false; c.stuck = 0;
    if (c.isPlayer) { c.bog = 0.8; this.flash('RESET', '#aaa', 0.8, 28); }
  }

  collideCars() {
    const cars = this.cars;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.rad + b.rad;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.0001) {
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          const push = (rr - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            const j2 = -rv * 0.65;
            a.vx -= nx * j2; a.vy -= ny * j2;
            b.vx += nx * j2; b.vy += ny * j2;
            if ((a.isPlayer || b.isPlayer) && -rv > 80) { this.shake = Math.max(this.shake, 0.3); this.sfx.beep(140, 0.08, 'square', 0.1); }
          }
        }
      }
    }
  }

  updateSlipstream(dt) {
    for (const c of this.cars) {
      const cs = Math.cos(c.h), sn = Math.sin(c.h);
      let inSlip = false;
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.x - c.x, dy = o.y - c.y;
        const ahead = dx * cs + dy * sn;
        if (ahead < 20 || ahead > (this.isKart ? 130 : 180)) continue;
        const lat = Math.abs(-dx * sn + dy * cs);
        if (lat < 22) { inSlip = true; break; }
      }
      c.slip = clamp(c.slip + (inSlip ? dt * 1.5 : -dt * 2), 0, 1);
      if (c.isPlayer && c.slip > 0.35 && Math.random() < 0.25) {
        this.addParticle(c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 30, -c.vx * 0.3, -c.vy * 0.3, 0.3, 'rgba(255,255,255,0.5)', 1.5);
      }
    }
  }

  /* ---------- AI ---------- */
  aiInput(c, dt) {
    const tr = this.track, pts = tr.pts, n = tr.n, W = tr.W;
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    const v = Math.max(0, c.vx * cs + c.vy * sn);
    const k = c.auto ? 0.84 : c.aiK;

    // lane management
    let blocker = null, bd = Infinity;
    for (const o of this.cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const ahead = dx * cs + dy * sn;
      if (ahead < 0 || ahead > 95) continue;
      const lat = Math.abs(-dx * sn + dy * cs);
      if (lat < c.rad * 2.3 && ahead < bd) { bd = ahead; blocker = o; }
    }
    const pAhead = pts[(c.idx + 10) % n];
    let target = c.lanePref * 0.6;
    if (blocker) {
      const myLat = c.lat - pAhead.line, oLat = blocker.lat - pAhead.line;
      target = oLat > myLat ? oLat - W * 0.32 : oLat + W * 0.32;
      if (Math.abs(target + pAhead.line) > W * 0.42) target = oLat > myLat ? oLat + W * 0.32 : oLat - W * 0.32;
    }
    c.laneOff += (clamp(target, -W * 0.4, W * 0.4) - c.laneOff) * Math.min(1, dt * 1.6);

    const la = Math.round(7 + v * 0.045);
    const tp = pts[(c.idx + la) % n];
    const off = clamp(tp.line + c.laneOff, -W * 0.42, W * 0.42);
    const tx = tp.x + tp.nx * off, ty = tp.y + tp.ny * off;
    const desired = Math.atan2(ty - c.y, tx - c.x);
    const diff = angDiff(desired, c.h);
    let steer = clamp(diff * 3, -1, 1);

    // speed planning
    const Vt = this.tier.baseSpeed;
    const turn = c.turn * (1 - 0.1 * c.wear);
    let tgt = c.maxSpeed * 1.5;
    let maxK = 0;
    for (let j = 2; j <= 70; j += 2) {
      const q = pts[(c.idx + j) % n];
      const kap = Math.abs(q.k) + 1e-6;
      if (j < 30) maxK = Math.max(maxK, kap);
      const vc = k * turn / (kap + 0.45 * k * turn / Vt);
      const allowed = Math.sqrt(vc * vc + 2 * c.brake * 0.72 * j * tr.spacing);
      if (allowed < tgt) tgt = allowed;
    }
    let thr = v < tgt - 4, brk = v > tgt + 14;

    // recovery when facing the wrong way: commit to a pivot turn until roughly aligned
    if (c.recover > 0 || (Math.abs(diff) > 1.6 && v < 50)) {
      if (c.recover <= 0) { c.recover = 2.5; c.recoverDir = Math.sign(diff) || 1; }
      c.recover -= dt;
      if (Math.abs(diff) < 0.45) c.recover = 0;
      const d = Math.abs(diff) > 2.6 ? c.recoverDir * Math.abs(diff) : diff;
      return { thr: Math.abs(diff) < 1.2, brk: false, steer: Math.sign(d), pivot: d, drift: false, item: false };
    }

    // mistakes
    if (!c.auto) {
      if (c.mistake > 0) { c.mistake -= dt; steer = clamp(steer + c.mistakeSteer, -1, 1); }
      else if (this.time > 3 && Math.random() < dt * (1 - c.stats.foc / 100) * 0.05) {
        c.mistake = 0.3 + Math.random() * 0.3; c.mistakeSteer = (Math.random() < 0.5 ? -1 : 1) * 0.6;
      }
    }

    // ERS / items
    let item = false;
    if (this.ersOn && !this.itemsOn) item = maxK < 1 / 900 && c.ers > 0.25;
    if (this.itemsOn && c.item && !c.auto) c.itemHold += dt; // item use decided in _aiItemWant
    return { thr, brk, steer, drift: false, item };
  }

  /* ---------- items ---------- */
  rollItem(c) {
    const N = this.cars.length;
    let frac = (c.pos - 1) / Math.max(1, N - 1);
    frac = clamp(frac + 0.12 * (c.stats.rc / 100) - 0.04, 0, 1);
    const w = {
      nitro: 1 + 3 * frac,
      bolt: 0.6 + 2.2 * frac,
      oil: 2.6 - 1.8 * frac,
      shield: 1.4,
      storm: frac > 0.6 ? (frac - 0.6) * 4 : 0
    };
    let tot = 0; for (const k in w) tot += w[k];
    let r = Math.random() * tot;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'nitro';
  }

  useItem(c) {
    const it = c.item;
    c.item = null; c.itemHold = 0;
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    if (it === 'nitro') { c.boost = Math.max(c.boost, 1.4); if (c.isPlayer) this.sfx.whoosh(); }
    else if (it === 'shield') { c.shield = 8; }
    else if (it === 'oil') { this.hazards.push({ x: c.x - cs * (c.len + 8), y: c.y - sn * (c.len + 8), life: 30, owner: c, born: this.time }); }
    else if (it === 'bolt') {
      const sp = Math.max(0, c.vx * cs + c.vy * sn) + 380;
      this.shots.push({ x: c.x + cs * c.len * 0.7, y: c.y + sn * c.len * 0.7, h: c.h, v: sp, life: 2.6, owner: c, trail: [] });
      if (c.isPlayer) this.sfx.beep(1200, 0.12, 'sawtooth', 0.1);
    } else if (it === 'storm') {
      this.stormFlash = 1;
      this.sfx.beep(60, 0.6, 'sawtooth', 0.3);
      for (const o of this.cars) {
        if (o === c || o.pos > c.pos || o.finished) continue;
        if (o.shield > 0) { o.shield = 0; continue; }
        o.slow = 2.4;
        if (o.isPlayer) this.flash('STRUCK BY ' + c.code + '\'s STORM', '#c77dff', 1.4, 26);
      }
      if (c.isPlayer) this.flash('STORM UNLEASHED', '#c77dff', 1.2, 28);
    }
  }

  hitCar(c, by, kind) {
    if (c.shield > 0) { c.shield = 0; this.burst(c.x, c.y, '#4cc9f0'); return; }
    c.spin = 0.7 + 0.5 * (1 - c.stats.foc / 100);
    c.spinDir = Math.random() < 0.5 ? -1 : 1;
    c.vx *= 0.45; c.vy *= 0.45;
    c.drift = false;
    this.burst(c.x, c.y, kind === 'oil' ? '#222' : '#ffd60a');
    if (c.isPlayer) { this.shake = 0.6; this.sfx.hit(); this.flash(by && by !== c ? 'HIT BY ' + by.code : 'SPUN OUT', '#ff6b6b', 1.2, 30); }
    else if (by && by.isPlayer) { this.flash('HIT ' + c.code + '!', '#7CFF6B', 1, 30); this.sfx.beep(520, 0.12, 'triangle', 0.15); }
  }

  updateItems(dt) {
    // boxes
    for (const b of this.boxes) {
      if (!b.active) { b.t -= dt; if (b.t <= 0) b.active = true; continue; }
      for (const c of this.cars) {
        if (c.item || c.itemRoll > 0) continue;
        const dx = c.x - b.x, dy = c.y - b.y;
        if (dx * dx + dy * dy < (c.rad + 12) * (c.rad + 12)) {
          b.active = false; b.t = 2.5;
          c.itemRoll = c.isPlayer ? 1.0 : 0.6;
          c.rollItem = this.rollItem(c);
          if (c.isPlayer) this.sfx.pickup();
          this.burst(b.x, b.y, '#ffffff');
          break;
        }
      }
    }
    // item rolls & use
    for (const c of this.cars) {
      if (c.itemRoll > 0) { c.itemRoll -= dt; if (c.itemRoll <= 0) { c.item = c.rollItem; c.itemHold = 0; } }
      const inp = c.isPlayer && !c.auto ? this.playerInput() : null;
      if (c.isPlayer && !c.auto) {
        if (inp.item && !c.prevItemKey && c.item && this.state === 'race' && c.spin <= 0) this.useItem(c);
        c.prevItemKey = inp.item;
      } else if (c.item && this.state === 'race') {
        const ai = this._aiItemWant(c);
        if (ai) this.useItem(c);
      }
    }
    // hazards
    for (const hz of this.hazards) {
      hz.life -= dt;
      for (const c of this.cars) {
        if (c.spin > 0) continue;
        if (c === hz.owner && this.time - hz.born < 0.8) continue;
        const dx = c.x - hz.x, dy = c.y - hz.y;
        if (dx * dx + dy * dy < (c.rad + 13) * (c.rad + 13)) { this.hitCar(c, hz.owner, 'oil'); hz.life = 0; break; }
      }
    }
    this.hazards = this.hazards.filter(h => h.life > 0);
    // projectiles
    const tr = this.track;
    for (const s of this.shots) {
      s.life -= dt;
      // home on nearest car ahead in cone
      let tgt = null, td = 420;
      for (const c of this.cars) {
        if (c === s.owner) continue;
        const dx = c.x - s.x, dy = c.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < td && Math.abs(angDiff(Math.atan2(dy, dx), s.h)) < 0.7) { td = d; tgt = c; }
      }
      if (tgt) s.h += clamp(angDiff(Math.atan2(tgt.y - s.y, tgt.x - s.x), s.h), -3.2 * dt, 3.2 * dt);
      else {
        // follow the track direction gently
        let bi = 0, bd = Infinity;
        for (let i = 0; i < tr.n; i += 3) { const dx = tr.pts[i].x - s.x, dy = tr.pts[i].y - s.y; const d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
        const p = tr.pts[(bi + 6) % tr.n];
        s.h += clamp(angDiff(Math.atan2(p.y - s.y, p.x - s.x), s.h), -2 * dt, 2 * dt);
      }
      s.x += Math.cos(s.h) * s.v * dt; s.y += Math.sin(s.h) * s.v * dt;
      s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 10) s.trail.shift();
      for (const c of this.cars) {
        if (c === s.owner || c.spin > 0) continue;
        const dx = c.x - s.x, dy = c.y - s.y;
        if (dx * dx + dy * dy < (c.rad + 8) * (c.rad + 8)) { this.hitCar(c, s.owner, 'bolt'); s.life = 0; break; }
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
  }

  _aiItemWant(c) {
    // reuse the AI decision computed in aiInput by re-running only the item part cheaply
    const cs = Math.cos(c.h), sn = Math.sin(c.h);
    const it = c.item;
    if (it === 'shield' || it === 'storm') return c.itemHold > 0.8;
    if (it === 'nitro') {
      let maxK = 0; const pts = this.track.pts, n = this.track.n;
      for (let j = 2; j < 30; j += 2) maxK = Math.max(maxK, Math.abs(pts[(c.idx + j) % n].k));
      return maxK < 1 / 500 || c.itemHold > 6;
    }
    for (const o of this.cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const ahead = dx * cs + dy * sn, lat = Math.abs(-dx * sn + dy * cs);
      if (it === 'bolt' && ahead > 40 && ahead < 380 && lat < ahead * 0.3) return true;
      if (it === 'oil' && ahead < -25 && ahead > -170 && lat < 40) return true;
    }
    return c.itemHold > (it === 'bolt' ? 8 : 7);
  }

  /* ---------- particles ---------- */
  addParticle(x, y, vx, vy, life, color, size) {
    if (this.particles.length > 500) return;
    this.particles.push({ x, y, vx, vy, life, max: life, color, size });
  }
  burst(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * TAU, s = 60 + Math.random() * 160;
      this.addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5, color, 4);
    }
  }
  updateParticles(dt) {
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const s of this.skids) s.a -= dt * 0.035;
    if (this.skids.length > 0 && this.skids[0].a <= 0) this.skids = this.skids.filter(s => s.a > 0);
  }

  /* ---------- finish ---------- */
  finish(retired) {
    if (this.done) return;
    this.computeOrder();
    const results = this.order.map(c => ({
      id: c.id, pos: c.pos, finished: c.finished, time: c.finishTime, best: c.best, grid: c.grid,
      dnf: retired && c.isPlayer
    }));
    if (retired) {
      const pr = results.find(r => r.dnf);
      results.splice(results.indexOf(pr), 1);
      results.push(pr);
      results.forEach((r, i) => r.pos = i + 1);
    }
    let fl = null;
    for (const c of this.cars) if (c.best < Infinity && (!fl || c.best < fl.best)) fl = c;
    const out = { results, fastestLap: fl ? fl.id : null, fastestTime: fl ? fl.best : null };
    this.destroy();
    this.o.onEnd(out);
  }

  /* ============================================================
     Rendering
     ============================================================ */
  render() {
    const ctx = this.ctx, w = this.w, h = this.h, tr = this.track;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const z = this.cam.z;
    const shx = (Math.random() - 0.5) * this.shake * 14, shy = (Math.random() - 0.5) * this.shake * 14;
    ctx.save();
    ctx.translate(w / 2 + shx, h / 2 + shy);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);
    const vx0 = this.cam.x - w / 2 / z - 50, vy0 = this.cam.y - h / 2 / z - 50, vx1 = this.cam.x + w / 2 / z + 50, vy1 = this.cam.y + h / 2 / z + 50;
    const inView = (x, y, m = 0) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    // grass
    ctx.fillStyle = this.grassPattern;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // barrier + runoff
    ctx.strokeStyle = this.isKart ? '#2b2b2b' : '#d9dde3';
    ctx.lineWidth = tr.W + tr.runoff * 2 + 14;
    ctx.stroke(tr.path);
    ctx.strokeStyle = this.isKart ? '#c8ad78' : '#b9ad95';
    ctx.lineWidth = tr.W + tr.runoff * 2;
    ctx.stroke(tr.path);
    // curbs
    ctx.strokeStyle = '#f4f4f4';
    ctx.lineWidth = tr.W + 20;
    ctx.stroke(tr.path);
    ctx.setLineDash([24, 24]);
    ctx.strokeStyle = '#d62828';
    ctx.stroke(tr.path);
    ctx.setLineDash([]);
    // asphalt
    ctx.strokeStyle = '#3a3e46';
    ctx.lineWidth = tr.W;
    ctx.stroke(tr.path);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = tr.W * 0.3;
    ctx.stroke(tr.linePath);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([30, 40]);
    ctx.stroke(tr.path);
    ctx.restore();

    // start line + grid boxes
    const sp = tr.pts[0];
    ctx.save();
    ctx.translate(sp.x, sp.y); ctx.rotate(sp.a);
    const sq = 8, cols = Math.ceil(tr.W / sq);
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(-sq + j * sq, -tr.W / 2 + i * sq, sq, Math.min(sq, tr.W / 2 - (-tr.W / 2 + i * sq)));
    }
    ctx.restore();

    // skids
    ctx.fillStyle = '#111';
    for (const s of this.skids) {
      if (!inView(s.x, s.y)) continue;
      ctx.globalAlpha = Math.max(0, s.a);
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // stand + tyres
    const st = tr.stand;
    if (inView(st.x, st.y, 200)) {
      ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.a);
      ctx.fillStyle = '#555c66'; ctx.fillRect(-150, -30, 300, 60);
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 28; i++) {
          ctx.fillStyle = ['#e63946', '#ffd60a', '#4cc9f0', '#f1f1f1', '#06d6a0'][(i * 7 + r * 3) % 5];
          ctx.fillRect(-145 + i * 10.5, -25 + r * 13, 7, 8);
        }
      }
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-155, -36, 310, 8);
      ctx.restore();
    }
    for (const t of tr.tires) {
      if (!inView(t.x, t.y)) continue;
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = '#1b1b1b';
        ctx.beginPath(); ctx.arc(t.x + i * 9, t.y, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = i ? '#e63946' : '#f1f1f1';
        ctx.beginPath(); ctx.arc(t.x + i * 9, t.y, 2.4, 0, TAU); ctx.fill();
      }
    }

    // item boxes
    const tt = this.clock;
    for (const b of this.boxes) {
      if (!b.active || !inView(b.x, b.y)) continue;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(tt * 1.6);
      const hue = (tt * 120 + b.x) % 360;
      ctx.fillStyle = `hsla(${hue},90%,60%,0.85)`;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-10, -10, 20, 20); ctx.fill(); ctx.stroke();
      ctx.rotate(-tt * 1.6);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
      ctx.restore();
    }
    // hazards
    for (const hz of this.hazards) {
      if (!inView(hz.x, hz.y)) continue;
      ctx.fillStyle = 'rgba(10,10,15,0.9)';
      ctx.beginPath(); ctx.ellipse(hz.x, hz.y, 16, 12, 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,80,200,0.35)';
      ctx.beginPath(); ctx.ellipse(hz.x - 4, hz.y - 3, 6, 4, 0.4, 0, TAU); ctx.fill();
    }

    // cars
    for (const c of this.cars) if (inView(c.x, c.y, 60)) this.drawCar(ctx, c);

    // shots
    for (const s of this.shots) {
      ctx.strokeStyle = 'rgba(255,214,10,0.6)'; ctx.lineWidth = 5;
      ctx.beginPath(); s.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.fillStyle = '#fff6a0';
      ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2; ctx.stroke();
    }
    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + p.life / p.max * 0.5), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // trees
    for (const t of tr.trees) {
      if (!inView(t.x, t.y, t.r)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(t.x + 8, t.y + 8, t.r, 0, TAU); ctx.fill();
      ctx.fillStyle = t.shade < 0.5 ? '#1f5a2a' : '#256b33';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();

    if (this.stormFlash > 0) { ctx.fillStyle = `rgba(200,160,255,${this.stormFlash * 0.35})`; ctx.fillRect(0, 0, w, h); }
    this.drawHUD(ctx, w, h);
  }

  drawCar(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.h);
    const L = c.len, W = c.wid;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 4, L * 0.55, W * 0.6, 0, 0, TAU); ctx.fill();
    if (this.isKart) {
      ctx.fillStyle = '#111';
      for (const [x, y] of [[-L * 0.32, -W * 0.55], [-L * 0.32, W * 0.55], [L * 0.3, -W * 0.5], [L * 0.3, W * 0.5]]) {
        ctx.fillRect(x - 4.5, y - 3, 9, 6);
      }
      ctx.fillStyle = c.color;
      roundRect(ctx, -L * 0.5, -W * 0.42, L * 0.95, W * 0.84, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(L * 0.38, -W * 0.38, 4, W * 0.76);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-L * 0.3, -W * 0.15, L * 0.55, W * 0.3);
      // driver
      ctx.fillStyle = c.helmet;
      ctx.beginPath(); ctx.arc(-L * 0.08, 0, 5.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(-L * 0.08 + 1.5, -3.5, 2.8, 7);
    } else {
      ctx.fillStyle = '#111';
      for (const [x, y] of [[-L * 0.32, -W * 0.62], [-L * 0.32, W * 0.62], [L * 0.27, -W * 0.58], [L * 0.27, W * 0.58]]) ctx.fillRect(x - 6, y - 3.5, 12, 7);
      // rear wing
      ctx.fillStyle = c.team || c.color;
      ctx.fillRect(-L * 0.52, -W * 0.6, 6, W * 1.2);
      // body
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(-L * 0.45, -W * 0.38); ctx.lineTo(L * 0.05, -W * 0.36); ctx.lineTo(L * 0.5, -W * 0.12);
      ctx.lineTo(L * 0.5, W * 0.12); ctx.lineTo(L * 0.05, W * 0.36); ctx.lineTo(-L * 0.45, W * 0.38); ctx.closePath(); ctx.fill();
      // front wing
      ctx.fillStyle = c.team || c.color;
      ctx.fillRect(L * 0.42, -W * 0.62, 5, W * 1.24);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-L * 0.12, -W * 0.2, L * 0.25, W * 0.4);
      ctx.fillStyle = c.helmet;
      ctx.beginPath(); ctx.arc(-L * 0.02, 0, 4.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (c.shield > 0) {
      ctx.strokeStyle = `rgba(76,201,240,${0.5 + 0.3 * Math.sin(this.clock * 10)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.len * 0.75, 0, TAU); ctx.stroke();
    }
    if (c.slow > 0) {
      ctx.strokeStyle = 'rgba(199,125,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const a = this.clock * 8 + i; ctx.lineTo(c.x + Math.cos(a) * 18, c.y + Math.sin(a * 1.3) * 18); }
      ctx.stroke();
    }
    if (c.isPlayer) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(c.x, c.y - c.len * 0.9); ctx.lineTo(c.x - 6, c.y - c.len * 0.9 - 9); ctx.lineTo(c.x + 6, c.y - c.len * 0.9 - 9); ctx.closePath(); ctx.fill();
    } else if (c.isRival) {
      ctx.fillStyle = '#ff4d6d'; ctx.font = 'bold 11px Rajdhani, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('RIVAL', c.x, c.y - c.len * 0.85);
    }
  }

  drawHUD(ctx, w, h) {
    const p = this.player, tr = this.track;
    const font = (s, wgt = 700) => `${wgt} ${s}px Rajdhani, "Segoe UI", sans-serif`;
    const small = w < 700;
    ctx.textBaseline = 'alphabetic';

    // position + lap
    const lap = clamp(Math.floor(p.total / tr.L) + 1, 1, this.laps);
    panel(ctx, 14, 14, small ? 150 : 190, small ? 92 : 108);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.font = font(small ? 40 : 52);
    ctx.fillText('P' + p.pos, 26, small ? 56 : 66);
    ctx.font = font(18, 600); ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('/' + this.cars.length, small ? 80 : 100, small ? 56 : 66);
    ctx.font = font(small ? 15 : 18, 600); ctx.fillStyle = '#ffd166';
    ctx.fillText(`LAP ${p.finished ? this.laps : lap}/${this.laps}`, 26, small ? 80 : 92);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(fmtTime(p.finished ? p.finishTime : this.time), small ? 92 : 112, small ? 80 : 92);

    // timing tower
    if (!small) {
      const tx = 14, ty = 132, rowH = 22;
      panel(ctx, tx, ty, 190, rowH * this.order.length + 12);
      const leader = this.order[0];
      this.order.forEach((c, i) => {
        const y = ty + 8 + i * rowH;
        if (c.isPlayer) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(tx + 4, y, 182, rowH - 2); }
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = font(14, 700); ctx.textAlign = 'right';
        ctx.fillText(String(i + 1), tx + 26, y + 15);
        ctx.fillStyle = c.team || c.color; ctx.fillRect(tx + 32, y + 3, 4, rowH - 8);
        ctx.fillStyle = c.isPlayer ? '#ffd166' : c.isRival ? '#ff8fa3' : '#fff'; ctx.textAlign = 'left';
        ctx.fillText(c.code, tx + 42, y + 15);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right'; ctx.font = font(13, 600);
        let gap = '';
        if (i === 0) gap = 'Leader';
        else if (c.finished && leader.finished) gap = '+' + (c.finishTime - leader.finishTime).toFixed(1);
        else gap = '+' + Math.max(0, (leader.total - c.total) / (c.maxSpeed * 0.78)).toFixed(1);
        if (c.spin > 0) gap = 'SPIN';
        ctx.fillText(gap, tx + 182, y + 15);
      });
    }

    // minimap
    const ms = small ? 120 : 180;
    const mx = w - ms - 14, my = 14;
    panel(ctx, mx, my, ms, ms);
    const b = tr.bounds;
    const s = Math.min((ms - 24) / (b.maxX - b.minX), (ms - 24) / (b.maxY - b.minY));
    ctx.save();
    ctx.translate(mx + ms / 2, my + ms / 2);
    ctx.scale(s, s);
    ctx.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 5 / s;
    ctx.stroke(tr.path);
    const sp = tr.pts[0];
    ctx.fillStyle = '#fff'; ctx.fillRect(sp.x - 6 / s, sp.y - 6 / s, 12 / s, 12 / s);
    for (const c of this.cars) {
      if (c.isPlayer) continue;
      ctx.fillStyle = c.isRival ? '#ff4d6d' : (c.team || c.color);
      ctx.beginPath(); ctx.arc(c.x, c.y, 4.5 / s, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2 / s;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7 / s, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();

    // speed
    const spd = Math.hypot(p.vx, p.vy);
    panel(ctx, 14, h - 86, 150, 72);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = font(44);
    ctx.fillText(Math.round(spd * this.tier.kmh), 26, h - 36);
    ctx.font = font(15, 600); ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('KM/H', 110, h - 36);
    if (p.best < Infinity) { ctx.font = font(13, 600); ctx.fillText('BEST ' + fmtTime(p.best), 26, h - 20); }

    // item / ERS
    const cx = w / 2;
    if (this.itemsOn) {
      panel(ctx, cx - 40, h - 96, 80, 80);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '42px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      if (p.itemRoll > 0) {
        const k = ITEM_KEYS[Math.floor(this.clock * 14) % ITEM_KEYS.length];
        ctx.globalAlpha = 0.7; ctx.fillText(ITEM_DEFS[k].icon, cx, h - 54); ctx.globalAlpha = 1;
      } else if (p.item) {
        ctx.fillText(ITEM_DEFS[p.item].icon, cx, h - 54);
        ctx.font = font(12, 700); ctx.fillStyle = '#fff'; ctx.fillText('SPACE', cx, h - 22);
      } else {
        ctx.font = font(13, 600); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillText('NO ITEM', cx, h - 56);
      }
      ctx.textBaseline = 'alphabetic';
    }
    if (this.ersOn && !this.itemsOn) {
      const bw = 220;
      panel(ctx, cx - bw / 2 - 10, h - 70, bw + 20, 56);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = font(12, 700); ctx.textAlign = 'left';
      ctx.fillText('ERS  (HOLD SPACE)', cx - bw / 2, h - 52);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - bw / 2, h - 44, bw, 10);
      ctx.fillStyle = p.ersActive ? '#f9f871' : '#4cc9f0'; ctx.fillRect(cx - bw / 2, h - 44, bw * p.ers, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('TYRES', cx - bw / 2, h - 20);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - bw / 2 + 50, h - 28, bw - 50, 8);
      const tw = 1 - p.wear;
      ctx.fillStyle = tw > 0.6 ? '#7bd88f' : tw > 0.3 ? '#ffd166' : '#ff6b6b';
      ctx.fillRect(cx - bw / 2 + 50, h - 28, (bw - 50) * tw, 8);
    }
    if (p.slip > 0.35) {
      ctx.fillStyle = '#7CFF6B'; ctx.font = font(16, 700); ctx.textAlign = 'center';
      ctx.fillText('SLIPSTREAM', cx, h - (this.itemsOn ? 108 : 82));
    }
    if (p.drift) {
      const lvl = p.driftCharge > 2.4 ? 3 : p.driftCharge > 1.5 ? 2 : p.driftCharge > 0.75 ? 1 : 0;
      ctx.fillStyle = ['#ccc', '#4cc9f0', '#ff9f1c', '#d38cff'][lvl]; ctx.font = font(16, 700); ctx.textAlign = 'center';
      ctx.fillText('DRIFT ' + '●'.repeat(lvl) + '○'.repeat(3 - lvl), cx, h - (this.itemsOn ? 128 : 102));
    }

    // countdown lights
    if (this.state === 'countdown' || this.time < 1) {
      const lw = 5 * 46 + 20;
      const lx = cx - lw / 2, ly = 20;
      panel(ctx, lx, ly, lw, 64);
      for (let i = 0; i < 5; i++) {
        const on = this.state === 'countdown' && i < this.lights;
        ctx.fillStyle = on ? '#ff2d2d' : '#2a2a2a';
        ctx.beginPath(); ctx.arc(lx + 33 + i * 46, ly + 32, 16, 0, TAU); ctx.fill();
        if (on) { ctx.fillStyle = 'rgba(255,80,80,0.3)'; ctx.beginPath(); ctx.arc(lx + 33 + i * 46, ly + 32, 22, 0, TAU); ctx.fill(); }
      }
      if (this.state === 'countdown') {
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = font(small ? 26 : 36);
        ctx.fillText(tr.name.toUpperCase(), cx, h * 0.33);
        ctx.font = font(18, 600); ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(`Starting P${p.grid}  •  ${this.laps} laps  •  Time the GO for a rocket start`, cx, h * 0.33 + 30);
      }
    }

    // wrong way
    if (p.wrongWay > 1) {
      ctx.fillStyle = '#ff6b6b'; ctx.textAlign = 'center'; ctx.font = font(40);
      ctx.fillText('WRONG WAY  —  press R to reset', cx, h * 0.28);
    }

    // flashes
    let fy = h * 0.42;
    for (const f of this.flashes) {
      const a = clamp(f.t / Math.min(0.4, f.max), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color; ctx.textAlign = 'center'; ctx.font = font(small ? f.size * 0.7 : f.size);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5;
      ctx.strokeText(f.text, cx, fy); ctx.fillText(f.text, cx, fy);
      fy += f.size + 6;
    }
    ctx.globalAlpha = 1;

    // controls hint
    if (this.time < 6 && !small) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = font(14, 600); ctx.textAlign = 'right';
      const hint = this.itemsOn || this.isKart
        ? '↑↓←→ / WASD drive  •  SHIFT drift (release for boost)  •  SPACE item  •  R reset  •  ESC pause'
        : '↑↓←→ / WASD drive  •  hold SPACE for ERS  •  R reset  •  ESC pause';
      ctx.fillText(hint, w - 16, h - 16);
    }
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function fmtTime(t) {
  if (!isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
}
