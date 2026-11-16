'use strict';
/* ============================================================
   UI — screens, hub tabs, race launching
   ============================================================ */

const $ = s => document.querySelector(s);
const appEl = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { tab: 'home', create: null, engine: null, raceCfg: null, quick: { tier: 0, difficulty: 'normal' }, quickRacers: null };

/* ---------- helpers ---------- */
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function tierBadge(t) { const T = TIERS[t]; return `<span class="tier-badge" style="background:${T.color}">${T.short}</span>`; }
function helmet(color, num, size = 40) {
  const light = ['#ffffff', '#ffd60a', '#f1f1f1', '#4cc9f0', '#06d6a0', '#ff8500', '#c77dff'].includes(color);
  return `<div class="helmet" style="background:${color};width:${size}px;height:${size}px;color:${light ? '#000' : '#fff'}">${esc(num)}</div>`;
}
function meter(v, color) { return `<div class="meter"><i style="width:${clamp(v, 0, 100)}%;background:${color}"></i></div>`; }
function energyColor(v) { return v > 60 ? 'var(--good)' : v > 30 ? 'var(--accent2)' : 'var(--bad)'; }
function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
let confirmCb = null;
function confirmModal(title, text, yesLabel, cb, danger) {
  confirmCb = cb;
  openModal(`<h2 style="text-align:left">${esc(title)}</h2><p class="muted">${esc(text)}</p>
    <div class="btn-row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn" data-act="modal-close">Cancel</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-yes">${esc(yesLabel)}</button></div>`);
}
function drawPreviews() {
  document.querySelectorAll('canvas[data-track]').forEach(cv => {
    const t = +cv.dataset.tier;
    drawTrackPreview(cv, buildTrack(cv.dataset.track, TIERS[t]), TIERS[t].color);
  });
}
function drawKartPreview(canvas, color, helmetCol, vehicle = 'kart', teamColor = null) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const isKart = vehicle === 'kart';
  const car = { x: 0, y: 0, h: -Math.PI / 2, len: isKart ? 28 : 40, wid: 18, color, helmet: helmetCol, team: teamColor, shield: 0, slow: 0 };
  ctx.save();
  ctx.translate(w / 2, h / 2);
  const sc = Math.min(w, h) / (isKart ? 40 : 52);
  ctx.scale(sc, sc);
  RaceEngine.prototype.drawCar.call({ isKart, clock: 0 }, ctx, car);
  ctx.restore();
}

/* ---------- action dispatcher ---------- */
const ACTIONS = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset.arg, el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field && UI.create) {
    const f = el.dataset.field;
    UI.create[f] = f === 'number' ? clamp(parseInt(el.value) || 1, 1, 99) : el.value;
    if (f === 'number') { const hp = $('#create-helmet'); if (hp) hp.outerHTML = helmet(UI.create.helmet, UI.create.number, 56).replace('class="helmet"', 'class="helmet" id="create-helmet"'); }
    if (f === 'name') { const n = $('#preview-name'); if (n) n.textContent = el.value || 'Your Name'; }
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.field === 'nation' && UI.create) UI.create.nation = el.value;
  if (el.dataset.qfield) { UI.quick[el.dataset.qfield] = el.dataset.qfield === 'tier' ? +el.value : el.value; renderQuick(); }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

ACTIONS['modal-close'] = closeModal;
ACTIONS['confirm-yes'] = () => { closeModal(); if (confirmCb) { const cb = confirmCb; confirmCb = null; cb(); } };
ACTIONS['menu'] = () => renderTitle();
ACTIONS['help'] = () => showHelp();

/* ============================================================
   Title
   ============================================================ */
function renderTitle() {
  hideRace();
  const has = !!Store.load(SAVE_KEY);
  appEl.innerHTML = `
  <div class="title-screen">
    <div class="checker top"></div>
    <div class="logo"><span class="k">KART</span><span class="to">TO</span><span class="c">CROWN</span></div>
    <p class="tagline">Create your driver. Start in backyard karts. Climb all the way to the <b style="color:#fff">Apex Grand Prix</b> and take the crown.</p>
    <div class="title-menu">
      ${has ? `<button class="btn primary big" data-act="continue">Continue career</button>` : ''}
      <button class="btn ${has ? '' : 'primary big'}" data-act="new">New career</button>
      <button class="btn" data-act="quick">Quick race</button>
      <button class="btn" data-act="hof">Hall of Fame</button>
      <button class="btn ghost" data-act="help">How to play</button>
    </div>
    <div class="ladder-mini">${TIERS.map(t => `<span>${t.name}</span>`).join('')}</div>
    <div class="checker bottom"></div>
  </div>`;
}
ACTIONS['continue'] = () => { if (loadSave()) { UI.tab = 'home'; S.seasonOver && S.offers ? renderSeasonEnd() : renderHub(); } };
ACTIONS['new'] = () => {
  if (Store.load(SAVE_KEY)) confirmModal('Start a new career?', 'Your current career save will be overwritten.', 'Start new', () => { UI.create = null; renderCreate(); }, true);
  else { UI.create = null; renderCreate(); }
};

/* ============================================================
   Driver creation
   ============================================================ */
const CREATE_POOL = 8;
function createStats(c) {
  const bg = BACKGROUNDS.find(b => b.id === c.bg);
  const o = {};
  for (const k of STAT_KEYS) o[k] = 35 + (bg.mods[k] || 0) + c.alloc[k];
  return o;
}
function renderCreate() {
  hideRace();
  if (!UI.create) UI.create = { name: '', number: randi(2, 99), nation: 'USA', bg: 'family', color: BODY_COLORS[0], helmet: HELMET_COLORS[0], alloc: { spd: 0, acc: 0, hnd: 0, foc: 0, rc: 0, fit: 0 }, difficulty: 'normal' };
  const c = UI.create;
  const used = STAT_KEYS.reduce((a, k) => a + c.alloc[k], 0);
  const st = createStats(c);
  const bg = BACKGROUNDS.find(b => b.id === c.bg);
  appEl.innerHTML = `
  <div class="page">
    <div class="card-title"><h2>Create your driver</h2><button class="btn ghost sm" data-act="menu">← Menu</button></div>
    <div class="create-grid">
      <div class="stack">
        <div class="card">
          <h3>Identity</h3>
          <div class="row2">
            <div><label class="f">Driver name</label><input type="text" maxlength="22" data-field="name" value="${esc(c.name)}" placeholder="e.g. Alex Storm"></div>
            <div><label class="f">Number</label><input type="number" min="1" max="99" data-field="number" value="${c.number}"></div>
            <div><label class="f">Nation</label><select data-field="nation">${NATIONS.map(n => `<option ${n === c.nation ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          </div>
          <label class="f">Kart colour</label>
          <div class="swatches">${BODY_COLORS.map(col => `<button class="sw ${col === c.color ? 'sel' : ''}" style="background:${col}" data-act="c-color" data-arg="${col}" aria-label="colour ${col}"></button>`).join('')}</div>
          <label class="f">Helmet colour</label>
          <div class="swatches">${HELMET_COLORS.map(col => `<button class="sw ${col === c.helmet ? 'sel' : ''}" style="background:${col}" data-act="c-helmet" data-arg="${col}" aria-label="helmet ${col}"></button>`).join('')}</div>
        </div>
        <div class="card">
          <h3>Background</h3>
          <div class="bgs">${BACKGROUNDS.map(b => `
            <button class="bgc ${b.id === c.bg ? 'sel' : ''}" data-act="c-bg" data-arg="${b.id}">
              <b>${b.name}</b><span>${b.desc}</span>
              <em>${Object.entries(b.mods).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${STAT_INFO[k].name}`).join(', ')}${Object.keys(b.mods).length ? ' • ' : ''}${fmtMoney(b.money)}</em>
            </button>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-title"><h3>Starting skills</h3><span class="${used < CREATE_POOL ? 'gold' : 'muted'}"><b>${CREATE_POOL - used}</b> points left</span></div>
          ${STAT_KEYS.map(k => `
            <div class="alloc-row">
              <div><b>${STAT_INFO[k].name}</b></div>
              <div class="bar"><i style="width:${st[k]}%"></i></div>
              <button class="btn sm plus" data-act="c-minus" data-arg="${k}" ${c.alloc[k] <= 0 ? 'disabled' : ''}>−</button>
              <button class="btn sm plus" data-act="c-plus" data-arg="${k}" ${used >= CREATE_POOL || c.alloc[k] >= 5 ? 'disabled' : ''}>+</button>
              <div class="stat-val">${st[k]}</div>
            </div>`).join('')}
          <p class="muted small" style="margin:10px 0 0">${STAT_KEYS.map(k => `<b>${STAT_INFO[k].name}</b>: ${STAT_INFO[k].desc}`).join(' ')}</p>
        </div>
      </div>
      <div class="card preview-card">
        <canvas id="kart-preview"></canvas>
        <div style="display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0 4px">
          ${helmet(c.helmet, c.number, 56).replace('class="helmet"', 'class="helmet" id="create-helmet"')}
          <div style="text-align:left"><div id="preview-name" style="font-family:var(--head);font-weight:700;font-size:24px">${esc(c.name || 'Your Name')}</div>
          <div class="muted small">Age 12 • ${bg.name}</div></div>
        </div>
        <div class="ovr-big" style="margin:14px 0 0">${ovr(st)}</div>
        <div class="muted small">OVERALL</div>
        <label class="f" style="text-align:left">Difficulty</label>
        <div class="seg" style="width:100%;justify-content:space-between">${['easy', 'normal', 'hard'].map(d => `<button class="${c.difficulty === d ? 'on' : ''}" style="flex:1" data-act="c-diff" data-arg="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div>
        <button class="btn primary big" style="width:100%;margin-top:18px" data-act="c-start">Start career</button>
        <p class="muted small" style="margin-bottom:0">You start in <b>${TIERS[0].name}</b> with ${fmtMoney(bg.money)}.</p>
      </div>
    </div>
  </div>`;
  drawKartPreview($('#kart-preview'), c.color, c.helmet);
}
ACTIONS['c-color'] = a => { UI.create.color = a; renderCreate(); };
ACTIONS['c-helmet'] = a => { UI.create.helmet = a; renderCreate(); };
ACTIONS['c-bg'] = a => { UI.create.bg = a; renderCreate(); };
ACTIONS['c-diff'] = a => { UI.create.difficulty = a; renderCreate(); };
ACTIONS['c-plus'] = k => { UI.create.alloc[k]++; renderCreate(); };
ACTIONS['c-minus'] = k => { UI.create.alloc[k]--; renderCreate(); };
ACTIONS['c-start'] = () => {
  const c = UI.create;
  const name = (c.name || '').trim();
  if (name.length < 2) { toast('Give your driver a name first.', 'bad'); return; }
  newCareer({ name, number: c.number, nation: c.nation, color: c.color, helmet: c.helmet, bg: c.bg, stats: createStats(c), settings: { difficulty: c.difficulty } });
  UI.create = null;
  UI.tab = 'home';
  renderHub();
  setTimeout(() => showHelp(true), 200);
};

/* ============================================================
   Hub
   ============================================================ */
const TAB_LIST = [['home', 'Home'], ['driver', 'Driver'], ['garage', 'Garage'], ['standings', 'Standings'], ['career', 'Career'], ['settings', 'Settings']];
function renderHub() {
  hideRace();
  const fns = { home: tabHome, driver: tabDriver, garage: tabGarage, standings: tabStandings, career: tabCareer, settings: tabSettings };
  appEl.innerHTML = topbar() + `<main class="page">${fns[UI.tab]()}</main>`;
  drawPreviews();
  const kp = $('#garage-preview');
  if (kp) { const T = tier(); drawKartPreview(kp, T.vehicle === 'formula' ? S.team.color : S.driver.color, S.driver.helmet, T.vehicle, T.vehicle === 'formula' ? S.team.color : null); }
}
ACTIONS['tab'] = t => { UI.tab = t; renderHub(); window.scrollTo(0, 0); };

function topbar() {
  const d = S.driver, T = tier();
  const dots = { home: !!(S.week && (S.week.event || S.week.sponsorOffer)) || S.seasonOver, driver: d.skillPts > 0 };
  return `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="brand" data-act="menu" title="Main menu">K<span>2</span>C</div>
      <div class="driver-chip">
        ${helmet(d.helmet, d.number)}
        <div><div class="nm">${esc(d.name)}</div><div class="sub">Age ${d.age} • Lvl ${d.level} • OVR ${ovr(d.stats)} • ${esc(d.nation)}</div></div>
      </div>
      <div class="top-stats">
        <div class="tstat"><b>${tierBadge(S.tier)}</b><small>S${S.season}</small></div>
        <div class="tstat"><b>${fmtMoney(S.money)}</b><small>Money</small></div>
        <div class="tstat"><b>${fmtNum(d.fans)}</b><small>Fans</small></div>
        <div class="tstat"><b>${Math.round(d.energy)}</b><small>Energy</small>${meter(d.energy, energyColor(d.energy))}</div>
        <div class="tstat"><b>${Math.round(d.morale)}</b><small>Morale</small>${meter(d.morale, 'var(--blue)')}</div>
      </div>
    </div>
    <nav class="tabs">${TAB_LIST.map(([id, nm]) => `<button class="tab ${UI.tab === id ? 'active' : ''}" data-act="tab" data-arg="${id}">${nm}${dots[id] ? '<span class="dot"></span>' : ''}</button>`).join('')}</nav>
  </div>`;
}

/* ---------- Home ---------- */
function tabHome() {
  const sd = S.seasonData, T = tier();
  if (S.seasonOver) {
    return `<div class="card result-hero">
      <div class="trophy">${S.seasonEnd && S.seasonEnd.champ ? '🏆' : '🏁'}</div>
      <h2 style="font-size:34px">Season ${S.season} complete</h2>
      <p class="muted">You finished <b style="color:#fff">P${S.seasonEnd ? S.seasonEnd.pos : '?'}</b> in the ${T.name}. Teams are calling.</p>
      <button class="btn primary big" data-act="season-end">Season review & offers</button></div>`;
  }
  const track = sd.tracks[sd.round];
  const ev = S.week.event ? EVENTS.find(e => e.id === S.week.event) : null;
  const items = T.items || S.settings.chaos;
  const perf = Math.round(playerPerf() * 100);
  const st = standings();
  const me = st.find(r => r.isPlayer);
  const buffs = S.buffs.map(b => `${b.type === 'machine' ? 'Machine' : 'Performance'} ${b.value > 0 ? '+' : ''}${Math.round(b.value * 100)}%`);
  const flags = Object.keys(S.flags).map(f => ({ scout: '👀 Scout watching', boldWin: '🎤 Promised a win', rivalHeat: '🔥 Rivalry heated' }[f])).filter(Boolean);

  const left = `
    <div class="card next-race">
      <div class="round">ROUND ${sd.round + 1} OF ${T.races} &nbsp;${tierBadge(S.tier)}</div>
      <h2>${esc(track)}</h2>
      <div class="next-race-body">
        <div>
          <div class="race-meta"><span><b>${T.laps}</b> laps</span><span><b>${T.field}</b> drivers</span><span>${T.cls}</span><span>${items ? '🎁 Items on' : '⚡ ERS + slipstream'}</span></div>
          <div class="race-meta"><span>Championship <b>P${me.pos}</b> (${me.pts} pts)</span><span>Race-day form <b class="${perf >= 98 ? 'good' : perf < 95 ? 'bad' : ''}">${perf}%</b></span></div>
          ${buffs.concat(flags).length ? `<div class="race-meta">${buffs.concat(flags).map(x => `<span>${x}</span>`).join('')}</div>` : ''}
          ${ev ? `<p class="gold small" style="margin:0 0 10px">Make a decision on this week's event before you race.</p>` : ''}
          <div class="btn-row">
            <button class="btn primary big" data-act="race" ${ev ? 'disabled' : ''}>🏁 Race</button>
            <button class="btn" data-act="sim" ${ev ? 'disabled' : ''} title="Skip driving — result is based on ratings (75% XP)">Simulate</button>
          </div>
        </div>
        <canvas class="track-preview" data-track="${esc(track)}" data-tier="${S.tier}"></canvas>
      </div>
    </div>
    ${ev ? eventCard(ev) : ''}
    ${S.week.eventResult ? `<div class="card"><span class="muted small">THIS WEEK</span><p style="margin:4px 0 0">${esc(S.week.eventResult)}</p></div>` : ''}
    ${S.week.sponsorOffer ? sponsorCard(S.week.sponsorOffer) : ''}
    ${plannerCard()}`;

  const right = `
    ${rivalCard()}
    <div class="card">
      <div class="card-title"><h3>Championship</h3><button class="btn ghost sm" data-act="tab" data-arg="standings">Full table</button></div>
      ${miniStandings(st)}
    </div>
    <div class="card">
      <h3>Paddock news</h3>
      <ul class="news">${S.news.slice(0, 7).map(n => `<li class="${n.kind}">${esc(n.text)}</li>`).join('')}</ul>
    </div>`;
  return `<div class="grid2"><div class="stack">${left}</div><div class="stack">${right}</div></div>`;
}

function eventCard(ev) {
  return `<div class="card event-card">
    <div class="tagline-s">DECISION</div>
    <h3>${esc(ev.title)}</h3>
    <p>${esc(fill(ev.text))}</p>
    <div class="choices">${ev.choices.map((c, i) => `<button class="btn" data-act="event" data-arg="${i}">${esc(fill(c.label))}</button>`).join('')}</div>
  </div>`;
}
ACTIONS['event'] = i => { const r = resolveEvent(+i); toast(r); renderHub(); };

function sponsorCard(o) {
  return `<div class="card" style="border-color:rgba(76,201,240,0.4)">
    <div class="tagline-s" style="font-family:var(--head);font-weight:700;color:var(--blue);letter-spacing:.1em;font-size:13px">SPONSOR OFFER</div>
    <h3>${esc(o.name)}</h3>
    <p class="muted" style="margin:4px 0 12px">${fmtMoney(o.perRace)} every race + ${fmtMoney(o.podiumBonus)} for each podium, until the end of the season.</p>
    <div class="btn-row"><button class="btn primary" data-act="sponsor" data-arg="1">Sign deal</button><button class="btn" data-act="sponsor" data-arg="0">Decline</button></div>
  </div>`;
}
ACTIONS['sponsor'] = a => { acceptSponsor(a === '1'); toast(a === '1' ? 'Deal signed!' : 'Offer declined.', a === '1' ? 'good' : ''); renderHub(); };

function plannerCard() {
  const used = S.week.used;
  const d = S.driver;
  const slots = [0, 1, 2].map(i => {
    const u = used[i];
    if (!u) return `<div class="slot">Free slot</div>`;
    const a = WEEK_ACTIONS.find(x => x.id === u.id);
    return `<div class="slot filled"><span class="s-name">${a.icon} ${a.name}</span><span class="small">${esc(u.text)}</span></div>`;
  }).join('');
  const full = used.length >= 3;
  return `<div class="card">
    <div class="card-title"><h3>Week planner</h3><span class="muted small">Energy <b style="color:${energyColor(d.energy)}">${Math.round(d.energy)}</b>/100</span></div>
    <div class="slots">${slots}</div>
    <div class="actions">${WEEK_ACTIONS.map(a => {
      const cant = full || (a.energy > 0 && d.energy < a.energy);
      const perk = a.perk && S.perks[a.perk] ? ` • Perk Lv${S.perks[a.perk]}` : '';
      return `<button class="action" data-act="week" data-arg="${a.id}" ${cant ? 'disabled' : ''}>
        <div class="a-top"><span>${a.icon} ${a.name}</span><span class="energy-cost ${a.energy < 0 ? 'gain' : ''}">${a.energy < 0 ? '+' + (-a.energy) : '−' + a.energy}⚡</span></div>
        <div class="a-desc">${a.desc}${perk}</div></button>`;
    }).join('')}</div>
    <p class="muted small" style="margin:10px 0 0">Up to 3 activities per week. Low energy hurts race-day pace, so balance training and rest.</p>
  </div>`;
}
ACTIONS['week'] = id => { const r = doWeekAction(id); toast(r.msg, r.ok ? 'good' : 'bad'); renderHub(); };

function rivalCard() {
  const sd = S.seasonData;
  const rv = sd.grid.find(g => g.isRival);
  let me = 0, them = 0;
  for (const r of sd.results) {
    const a = r.rows.find(x => x.id === 'player'), b = r.rows.find(x => x.id === 'rival');
    if (a && b) a.pos < b.pos ? me++ : them++;
  }
  return `<div class="card" style="border-color:rgba(255,77,109,0.35)">
    <div class="card-title"><h3>Rival</h3><span class="tag rival">NEMESIS</span></div>
    <div style="display:flex;align-items:center;gap:12px">
      ${helmet(S.rival.helmet, S.rival.number, 46)}
      <div style="flex:1"><div style="font-family:var(--head);font-weight:700;font-size:20px">${esc(S.rival.name)}</div>
      <div class="muted small">${esc(S.rival.nation)} • OVR ${rv ? ovr(rv.stats) : '?'}${rv && rv.team ? ' • ' + esc(rv.team) : ''}</div></div>
      <div style="text-align:right"><div style="font-family:var(--head);font-weight:700;font-size:26px">${me}–${them}</div><div class="muted small">head-to-head</div></div>
    </div>
  </div>`;
}

function miniStandings(st) {
  const top = st.slice(0, 6);
  const me = st.find(r => r.isPlayer);
  if (!top.includes(me)) top.push(me);
  return `<table><tbody>${top.map(r => `<tr class="${r.isPlayer ? 'me' : r.isRival ? 'rival' : ''}">
    <td class="pos">${r.pos}</td><td><span class="swatch" style="background:${r.teamColor}"></span>${esc(r.name)}${r.isRival ? '<span class="tag rival">RIVAL</span>' : ''}</td><td style="text-align:right"><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
}

/* ---------- Driver ---------- */
function tabDriver() {
  const d = S.driver;
  const need = xpNeeded(d.level);
  const bg = BACKGROUNDS.find(b => b.id === d.bg);
  return `<div class="grid2">
    <div class="card">
      <div class="card-title"><h3>Skills</h3><span class="${d.skillPts ? 'gold' : 'muted'}"><b>${d.skillPts}</b> skill points</span></div>
      ${STAT_KEYS.map(k => {
        const v = d.stats[k], c = skillCost(v);
        return `<div class="stat-row">
          <div class="nm">${STAT_INFO[k].name}<small>${STAT_INFO[k].desc}</small></div>
          <div class="bar"><i style="width:${v}%"></i></div>
          <div class="stat-val">${v}</div>
          <button class="btn sm plus" data-act="skill" data-arg="${k}" ${d.skillPts < c || v >= 99 ? 'disabled' : ''} title="Costs ${c} point${c > 1 ? 's' : ''}">+${c > 1 ? '<small style="font-size:10px">' + c + '</small>' : ''}</button>
        </div>`;
      }).join('')}
      <p class="muted small" style="margin:12px 0 0">Earn XP from races and training. Each level gives 3 skill points. Higher skills cost more points (1 under 60, 2 under 80, 3 above).</p>
    </div>
    <div class="stack">
      <div class="card" style="text-align:center">
        ${helmet(d.helmet, d.number, 72).replace('class="helmet"', 'class="helmet" style="margin:0 auto"')}
        <h2 style="margin-top:10px">${esc(d.name)}</h2>
        <div class="muted">${esc(d.nation)} • Age ${d.age} • ${bg ? bg.name : ''}</div>
        <div class="ovr-big" style="margin-top:12px">${ovr(d.stats)}</div><div class="muted small">OVERALL</div>
        <div style="margin-top:14px;text-align:left"><div class="muted small">Level ${d.level} — ${d.xp}/${need} XP</div><div class="bar" style="margin-top:4px"><i style="width:${d.xp / need * 100}%;background:linear-gradient(90deg,#ffd166,#ff7a3b)"></i></div></div>
      </div>
      <div class="card"><div class="kv">
        <div><small>Fans</small><b>${fmtNum(d.fans)}</b></div>
        <div><small>Reputation</small><b>${Math.round(d.rep)}</b></div>
        <div><small>Morale</small><b>${Math.round(d.morale)}</b></div>
        <div><small>Energy</small><b>${Math.round(d.energy)}</b></div>
      </div></div>
    </div>
  </div>`;
}
ACTIONS['skill'] = k => { if (spendSkill(k)) renderHub(); };

/* ---------- Garage ---------- */
function tabGarage() {
  const T = tier();
  let machine = '';
  if (T.vehicle === 'kart') {
    machine = `<div class="card">
      <div class="card-title"><h3>Your kart</h3><span class="muted small">${T.cls}</span></div>
      <canvas id="garage-preview" style="width:100%;height:160px;display:block"></canvas>
      ${KART_PARTS.map(p => {
        const lvl = S.kart[p.id], cost = kartUpgradeCost(p.id);
        return `<div class="part"><div><b>${p.name}</b> <span class="muted small">— ${p.desc}</span>
          <div class="pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
          ${cost === null ? '<span class="good small"><b>MAXED</b></span>' : `<button class="btn sm ${S.money >= cost ? 'gold' : ''}" data-act="kart-up" data-arg="${p.id}" ${S.money < cost ? 'disabled' : ''}>${fmtMoney(cost)}</button>`}
        </div>`;
      }).join('')}
      <p class="muted small" style="margin:10px 0 0">Kart upgrades carry through the karting tiers. Once you reach formula cars, your team provides the car.</p>
    </div>`;
  } else {
    const sd = S.seasonData;
    const mate = sd.grid.find(g => g.team === S.team.name);
    machine = `<div class="card">
      <div class="card-title"><h3>${esc(S.team.name)}</h3><span class="swatch" style="background:${S.team.color};width:30px"></span></div>
      <canvas id="garage-preview" style="width:100%;height:160px;display:block"></canvas>
      <div class="kv" style="margin-top:10px">
        <div><small>Car rating</small><b>${Math.round(S.team.car * 100)}</b></div>
        <div><small>Salary / race</small><b>${fmtMoney(S.team.salary)}</b></div>
        <div><small>Teammate</small><b style="font-size:16px">${mate ? esc(mate.name) : '—'}</b></div>
        <div><small>Team relationship</small><b>${S.teamRel}</b></div>
      </div>
      <p class="muted small" style="margin:10px 0 0">Better results earn offers from faster teams at the end of the season.</p>
    </div>`;
  }
  const perks = `<div class="card">
    <h3>Support staff & perks</h3>
    ${PERKS.map(p => {
      const lvl = S.perks[p.id] || 0, cost = perkCost(p.id);
      return `<div class="part"><div><b>${p.name}</b> <span class="muted small">— ${p.desc}</span>
        <div class="pips">${[0, 1, 2].map(i => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        ${cost === null ? '<span class="good small"><b>MAXED</b></span>' : `<button class="btn sm ${S.money >= cost ? 'gold' : ''}" data-act="perk" data-arg="${p.id}" ${S.money < cost ? 'disabled' : ''}>${fmtMoney(cost)}</button>`}
      </div>`;
    }).join('')}
  </div>`;
  const sp = S.sponsor ? `<div class="card"><h3>Sponsor</h3><p style="margin:0"><b>${esc(S.sponsor.name)}</b> — ${fmtMoney(S.sponsor.perRace)} per race, ${fmtMoney(S.sponsor.podiumBonus)} podium bonus.</p></div>`
    : `<div class="card"><h3>Sponsor</h3><p class="muted" style="margin:0">No sponsor yet. More fans means more (and bigger) offers.</p></div>`;
  return `<div class="grid2"><div class="stack">${machine}</div><div class="stack">${perks}${sp}</div></div>`;
}
ACTIONS['kart-up'] = p => { if (buyKartUpgrade(p)) { toast('Upgrade installed!', 'good'); renderHub(); } };
ACTIONS['perk'] = p => { if (buyPerk(p)) { toast('Hired!', 'good'); renderHub(); } };

/* ---------- Standings ---------- */
function tabStandings() {
  const st = standings(), T = tier(), sd = S.seasonData;
  const isF = T.vehicle === 'formula';
  const rounds = sd.tracks.map((t, i) => {
    const r = sd.results[i];
    if (!r) return `<tr><td class="pos">${i + 1}</td><td>${esc(t)}</td><td class="muted">—</td><td class="muted">—</td></tr>`;
    const w = r.rows.find(x => x.pos === 1), me = r.rows.find(x => x.id === 'player');
    return `<tr><td class="pos">${i + 1}</td><td>${esc(t)}</td><td>${esc(w.name)}</td><td><b>${me.dnf ? 'DNF' : 'P' + me.pos}</b></td></tr>`;
  }).join('');
  return `<div class="grid2">
    <div class="card"><div class="card-title"><h3>${T.name} — Season ${S.season}</h3>${tierBadge(S.tier)}</div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Driver</th>${isF ? '<th>Team</th>' : ''}<th>Wins</th><th>Pod</th><th style="text-align:right">Pts</th></tr></thead><tbody>
      ${st.map(r => `<tr class="${r.isPlayer ? 'me' : r.isRival ? 'rival' : ''}"><td class="pos">${r.pos}</td>
        <td><span class="swatch" style="background:${r.teamColor}"></span>${esc(r.name)}${r.isPlayer ? '<span class="tag you">YOU</span>' : ''}${r.isRival ? '<span class="tag rival">RIVAL</span>' : ''}</td>
        ${isF ? `<td class="muted small">${esc(r.team || '')}</td>` : ''}<td>${r.wins}</td><td>${r.podiums}</td><td style="text-align:right"><b>${r.pts}</b></td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted small" style="margin:10px 0 0">Points: 25-18-15-12-10-8-6-4-2-1, +1 for fastest lap in the top 10. Top 3 earns promotion. P4–5 can get a wildcard with enough reputation or fans.</p>
    </div>
    <div class="card"><h3>Calendar</h3><div class="table-wrap"><table><thead><tr><th>Rd</th><th>Circuit</th><th>Winner</th><th>You</th></tr></thead><tbody>${rounds}</tbody></table></div></div>
  </div>`;
}

/* ---------- Career ---------- */
function tabCareer() {
  const t = S.totals;
  const ladder = TIERS.map((T, i) => {
    const done = S.history.some(h => h.tier === i) && i < S.tier;
    const cur = i === S.tier;
    const titles = S.trophies.filter(x => x.tier === i).length;
    return `<div class="rung ${cur ? 'current' : done ? 'done' : i > S.tier ? 'locked' : ''}">
      <span class="lvl">${i + 1}</span>
      <div><div class="rn" style="color:${T.color}">${T.name}</div><div class="rd">${T.cls} • ${T.desc}</div></div>
      <span class="st">${titles ? '🏆'.repeat(Math.min(titles, 5)) : cur ? 'YOU ARE HERE' : done ? '✓' : '🔒'}</span>
    </div>`;
  }).join('');
  return `<div class="grid2">
    <div class="card"><h3>Road to the Apex</h3><div class="ladder">${ladder}</div></div>
    <div class="stack">
      <div class="card"><h3>Career totals</h3><div class="kv">
        <div><small>Starts</small><b>${t.starts}</b></div><div><small>Wins</small><b>${t.wins}</b></div>
        <div><small>Podiums</small><b>${t.podiums}</b></div><div><small>Poles</small><b>${t.poles}</b></div>
        <div><small>Fastest laps</small><b>${t.fastest}</b></div><div><small>Titles</small><b>${t.titles}</b></div>
        <div><small>Legacy</small><b>${legacyScore()}</b></div>
      </div></div>
      <div class="card"><h3>Trophy cabinet</h3>${S.trophies.length ? S.trophies.map(x => `<div style="padding:6px 0">🏆 <b>${esc(x.name)}</b> <span class="muted small">Season ${x.season}</span></div>`).join('') : '<p class="muted" style="margin:0">Empty… for now.</p>'}</div>
      <div class="card"><h3>Season history</h3>${S.history.length ? `<div class="table-wrap"><table><thead><tr><th>S</th><th>Series</th><th>Pos</th><th>Wins</th><th>Pts</th></tr></thead><tbody>
        ${S.history.map(h => `<tr><td>${h.season}</td><td>${esc(h.tierName)}${h.team ? '<div class="muted small">' + esc(h.team) + '</div>' : ''}</td><td class="pos">P${h.pos}</td><td>${h.wins}</td><td>${h.pts}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted" style="margin:0">Your first season is under way.</p>'}</div>
    </div>
  </div>`;
}

/* ---------- Settings ---------- */
function tabSettings() {
  const s = S.settings;
  return `<div class="grid2"><div class="card">
    <h3>Settings</h3>
    <div class="toggle"><div><b>Difficulty</b><div class="muted small">How fast the AI drives.</div></div>
      <div class="seg">${['easy', 'normal', 'hard'].map(d => `<button class="${s.difficulty === d ? 'on' : ''}" data-act="set" data-arg="difficulty:${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div></div>
    <div class="toggle"><div><b>Chaos mode</b><div class="muted small">Item boxes and drifting in the formula tiers too.</div></div>
      <div class="seg"><button class="${!s.chaos ? 'on' : ''}" data-act="set" data-arg="chaos:0">Off</button><button class="${s.chaos ? 'on' : ''}" data-act="set" data-arg="chaos:1">On</button></div></div>
    <div class="toggle"><div><b>Sound</b><div class="muted small">Engine and effects.</div></div>
      <div class="seg"><button class="${!s.sound ? 'on' : ''}" data-act="set" data-arg="sound:0">Off</button><button class="${s.sound ? 'on' : ''}" data-act="set" data-arg="sound:1">On</button></div></div>
  </div>
  <div class="stack">
    <div class="card"><h3>Career</h3>
      <div class="btn-row"><button class="btn" data-act="help">How to play</button><button class="btn" data-act="menu">Main menu</button></div>
      <div class="btn-row" style="margin-top:10px"><button class="btn danger" data-act="retire-now">Retire now</button></div>
      <p class="muted small" style="margin:10px 0 0">Your career saves automatically in this browser.</p>
    </div>
  </div></div>`;
}
ACTIONS['set'] = a => {
  const [k, v] = a.split(':');
  S.settings[k] = k === 'difficulty' ? v : v === '1';
  save(); renderHub();
};
ACTIONS['retire-now'] = () => confirmModal('Retire from racing?', 'Your career ends and goes into the Hall of Fame. This cannot be undone.', 'Retire', () => renderLegacy(retire()), true);

/* ============================================================
   Racing
   ============================================================ */
function hideRace() { $('#race-screen').classList.add('hidden'); $('#pause-menu').classList.add('hidden'); }

function launchRace(cfg) {
  UI.raceCfg = cfg;
  closeModal();
  appEl.innerHTML = '';
  $('#race-screen').classList.remove('hidden');
  $('#pause-menu').classList.add('hidden');
  setTiltUI();
  if (TILT.on) setTimeout(() => { TILT.zero = TILT.raw; }, 300); // re-centre at every race start
  const track = buildTrack(cfg.trackName, cfg.tier);
  UI.engine = new RaceEngine($('#race-canvas'), {
    tier: cfg.tier, track, laps: cfg.laps,
    racers: cfg.racers.map(r => Object.assign({}, r)),
    items: cfg.items, ers: cfg.tier.vehicle === 'formula', difficulty: cfg.difficulty, sound: cfg.sound, tilt: TILT,
    onPause: p => $('#pause-menu').classList.toggle('hidden', !p),
    onEnd: out => {
      UI.engine = null;
      hideRace();
      if (cfg.mode === 'career') { applyRaceResult(out); renderResults(); }
      else renderQuickResults(out);
    }
  });
}

ACTIONS['race'] = () => {
  const T = tier(), sd = S.seasonData;
  launchRace({ mode: 'career', tier: T, trackName: sd.tracks[sd.round], laps: T.laps, racers: buildRacers(), items: T.items || S.settings.chaos, difficulty: S.settings.difficulty, sound: S.settings.sound });
};
ACTIONS['sim'] = () => {
  confirmModal('Simulate this race?', 'The result is decided by ratings, machine and form. You earn 75% XP.', 'Simulate', () => {
    applyRaceResult(simulateRace(buildRacers()));
    renderResults();
  });
};
ACTIONS['race-resume'] = () => { if (UI.engine && UI.engine.paused) UI.engine.togglePause(); };
ACTIONS['race-pause'] = () => { if (UI.engine && !UI.engine.paused) UI.engine.togglePause(); };
ACTIONS['race-restart'] = () => { if (UI.engine) { UI.engine.destroy(); UI.engine = null; launchRace(UI.raceCfg); } };
ACTIONS['race-retire'] = () => { if (UI.engine) { UI.engine.paused = false; UI.engine.finish(true); } };

/* ---------- tilt steering (phone gyro) ---------- */
const TILT = { on: false, steer: 0, zero: 0, raw: 0, listening: false };
const TILT_RANGE = 28;  // degrees of tilt for full lock
const TILT_DEAD = 2.5;  // dead zone in degrees
function tiltAngle(e) {
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  if (ang === 90) return e.beta;          // landscape, top of phone to the left
  if (ang === -90 || ang === 270) return -e.beta;
  return e.gamma;                          // portrait
}
function onOrientation(e) {
  if (e.beta == null && e.gamma == null) return;
  TILT.raw = tiltAngle(e) || 0;
  let d = TILT.raw - TILT.zero;
  if (Math.abs(d) < TILT_DEAD) d = 0; else d -= Math.sign(d) * TILT_DEAD;
  TILT.steer = clamp(d / (TILT_RANGE - TILT_DEAD), -1, 1);
  const dot = document.querySelector('.tc-tilt-meter i');
  if (dot) dot.style.left = (50 + TILT.steer * 45) + '%';
}
function setTiltUI() { $('#touch-controls').classList.toggle('tilt-on', TILT.on); }
async function enableTilt() {
  if (!window.DeviceOrientationEvent) { toast('This device has no tilt sensor.', 'bad'); return false; }
  if (!window.isSecureContext) { toast('Tilt needs the game opened from an https:// link.', 'bad'); return false; }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') { // iPhone
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') { toast('Motion access was denied. Allow it in Safari settings.', 'bad'); return false; }
    }
  } catch (err) { toast('Could not access the tilt sensor.', 'bad'); return false; }
  if (!TILT.listening) { window.addEventListener('deviceorientation', onOrientation); TILT.listening = true; }
  return true;
}
ACTIONS['tilt-toggle'] = async () => {
  if (TILT.on) { TILT.on = false; TILT.steer = 0; setTiltUI(); try { localStorage.setItem('k2c.tilt', '0'); } catch (e) { } toast('Tilt off — arrow buttons back'); return; }
  if (!(await enableTilt())) return;
  setTimeout(() => { TILT.zero = TILT.raw; }, 150); // calibrate: however you hold it now = straight
  TILT.on = true; setTiltUI();
  try { localStorage.setItem('k2c.tilt', '1'); } catch (e) { }
  toast('Tilt on! Hold the phone how you like — tap TILT again to turn off.', 'good');
};
window.addEventListener('orientationchange', () => setTimeout(() => { TILT.zero = TILT.raw; }, 400));

// touch controls
document.querySelectorAll('[data-touch]').forEach(b => {
  const key = b.dataset.touch;
  const on = e => { e.preventDefault(); b.classList.add('active'); if (UI.engine) UI.engine.setTouch(key, true); };
  const off = e => { e.preventDefault(); b.classList.remove('active'); if (UI.engine) UI.engine.setTouch(key, false); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
});

/* ---------- results ---------- */
function renderResults() {
  const L = S.lastRace;
  const field = L.rows.length;
  const color = L.dnf ? 'var(--bad)' : L.pos === 1 ? 'var(--accent2)' : L.pos <= 3 ? 'var(--good)' : '#fff';
  const rows = L.rows.slice().sort((a, b) => a.pos - b.pos);
  const sd = S.seasonData;
  const isRival = id => id === 'rival';
  appEl.innerHTML = `
  <div class="page">
    <div class="card result-hero">
      <div class="muted" style="font-family:var(--head);font-weight:700;letter-spacing:.08em">ROUND ${L.round} • ${esc(L.track.toUpperCase())}${L.simulated ? ' • SIMULATED' : ''}</div>
      <div class="pbig" style="color:${color}">${L.dnf ? 'DNF' : 'P' + L.pos}</div>
      <div style="font-size:18px">${L.dnf ? 'Retired from the race.' : L.pos === 1 ? 'Victory! 🏆' : L.pos <= 3 ? 'Podium finish!' : L.pos <= field / 2 ? 'Points in the bag.' : 'Back to work.'}</div>
      ${L.rivalPos ? `<div class="muted" style="margin-top:6px">Rival ${esc(S.rival.name)} finished P${L.rivalPos} — ${L.beatRival ? '<b class="good">you beat them</b>' : '<b class="bad">they beat you</b>'}</div>` : ''}
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="card"><h3>Classification</h3><div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Driver</th><th>Grid</th><th>Best lap</th><th style="text-align:right">Pts</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="${r.id === 'player' ? 'me' : isRival(r.id) ? 'rival' : ''}"><td class="pos">${r.dnf ? 'DNF' : r.pos}</td>
          <td>${esc(r.name)}${r.fl ? '<span class="tag fl">FL</span>' : ''}${isRival(r.id) ? '<span class="tag rival">RIVAL</span>' : ''}</td>
          <td class="muted">${r.grid || '—'}</td><td class="muted">${r.best && isFinite(r.best) ? fmtTime(r.best) : '—'}</td><td style="text-align:right"><b>${r.pts ? '+' + r.pts : ''}</b></td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="stack">
        <div class="card"><h3>Rewards</h3>
          <div class="rewards">${L.rewards.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
          ${L.levels ? `<p class="gold" style="margin:14px 0 0;font-family:var(--head);font-weight:700;font-size:20px">⬆ LEVEL UP! +${L.levels * 3} skill points — spend them in the Driver tab.</p>` : ''}
          ${L.notes.length ? `<ul class="notes">${L.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="card"><h3>Championship</h3>${miniStandings(standings())}</div>
        <button class="btn primary big" style="width:100%" data-act="after-race">${S.seasonOver ? 'Season finale →' : 'Continue →'}</button>
      </div>
    </div>
  </div>`;
  window.scrollTo(0, 0);
}
ACTIONS['after-race'] = () => { if (S.seasonOver) renderSeasonEnd(); else { UI.tab = 'home'; renderHub(); } };

/* ---------- season end ---------- */
function renderSeasonEnd() {
  const E = S.seasonEnd;
  if (!E) { renderHub(); return; }
  appEl.innerHTML = `
  <div class="page">
    <div class="card result-hero">
      <div class="trophy">${E.champ ? '🏆' : E.pos <= 3 ? '🥈' : '🏁'}</div>
      <div class="muted" style="font-family:var(--head);font-weight:700;letter-spacing:.08em">${esc(E.tierName.toUpperCase())} • SEASON ${S.season}</div>
      <h2 style="font-size:40px;margin-top:6px">${E.champ ? 'CHAMPION!' : 'Finished P' + E.pos}</h2>
      <p class="muted">${E.pts} points${E.bonus ? ` • Championship bonus ${fmtMoney(E.bonus)}` : ''}${E.rivalPos ? ` • ${esc(S.rival.name)} finished P${E.rivalPos}` : ''}</p>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="card"><h3>Final standings</h3><div class="table-wrap"><table><tbody>
        ${E.standings.map(r => `<tr class="${r.isPlayer ? 'me' : r.isRival ? 'rival' : ''}"><td class="pos">${r.pos}</td><td><span class="swatch" style="background:${r.teamColor}"></span>${esc(r.name)}</td><td class="muted small">${esc(r.team || '')}</td><td style="text-align:right"><b>${r.pts}</b></td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><h3>Your offers for next season</h3>
        <p class="muted small" style="margin:0">You will be ${S.driver.age + 1} years old next season.</p>
        ${S.offers.map((o, i) => {
          if (o.type === 'retire') return `<div class="offer"><div class="o-main"><div class="o-name">Retire</div><div class="muted small">Hang up the helmet and enter the Hall of Fame.</div></div><button class="btn danger" data-act="offer" data-arg="${i}">Retire</button></div>`;
          const NT = TIERS[o.tier];
          return `<div class="offer ${o.type === 'promote' ? 'promote' : ''}">
            ${o.team ? `<span class="swatch" style="background:${o.team.color};height:46px;width:6px"></span>` : ''}
            <div class="o-main">
              <div class="muted small">${o.type === 'promote' ? (o.wild ? '⭐ WILDCARD PROMOTION' : '⬆ PROMOTION') : 'STAY'} • ${NT.name}</div>
              <div class="o-name">${esc(o.label)}</div>
              ${o.team ? `<div class="muted small">Car rating <b style="color:#fff">${Math.round(o.team.car * 100)}</b> • Salary <b style="color:#fff">${fmtMoney(o.salary)}</b>/race</div>` : `<div class="muted small">${NT.cls} • ${NT.desc}</div>`}
            </div>
            <button class="btn ${o.type === 'promote' ? 'primary' : ''}" data-act="offer" data-arg="${i}">Sign</button>
          </div>`;
        }).join('')}
        ${!S.offers.some(o => o.type === 'promote') && S.tier < TIERS.length - 1 ? `<p class="muted small" style="margin:12px 0 0">No promotion this year — you need a top-3 finish (or top 5 with strong reputation/fans).</p>` : ''}
      </div>
    </div>
  </div>`;
  window.scrollTo(0, 0);
}
ACTIONS['season-end'] = () => renderSeasonEnd();
ACTIONS['offer'] = i => {
  const o = S.offers[+i];
  if (o.type === 'retire') { confirmModal('Retire?', 'Your career goes into the Hall of Fame.', 'Retire', () => renderLegacy(retire()), true); return; }
  const r = acceptOffer(+i);
  if (r === 'retire') { toast('At 40, it is time to hang up the helmet.'); renderLegacy(retire()); return; }
  UI.tab = 'home';
  renderHub();
  toast(o.type === 'promote' ? `Welcome to the ${TIERS[o.tier].name}!` : 'Contract signed.', 'good');
};

/* ---------- legacy ---------- */
function renderLegacy(sum) {
  const t = sum.totals;
  appEl.innerHTML = `<div class="page"><div class="card result-hero">
    <div class="trophy">${sum.apexTitles ? '👑' : sum.trophies.length ? '🏆' : '🏁'}</div>
    <h2 style="font-size:40px">${esc(sum.name)} retires</h2>
    <p class="muted">${sum.apexTitles ? `${sum.apexTitles}× Apex Grand Prix World Champion. A legend of the sport.` : `Reached the ${TIERS[t.bestTier].name}.`}</p>
    <div class="kv" style="max-width:620px;margin:16px auto">
      <div><small>Seasons</small><b>${sum.history.length}</b></div><div><small>Wins</small><b>${t.wins}</b></div>
      <div><small>Podiums</small><b>${t.podiums}</b></div><div><small>Titles</small><b>${t.titles}</b></div>
      <div><small>Legacy score</small><b class="gold">${sum.score}</b></div>
    </div>
    <div class="btn-row" style="justify-content:center"><button class="btn primary" data-act="hof">Hall of Fame</button><button class="btn" data-act="menu">Main menu</button></div>
  </div></div>`;
}
ACTIONS['hof'] = () => {
  hideRace();
  const hof = Store.load(HOF_KEY) || [];
  appEl.innerHTML = `<div class="page"><div class="card">
    <div class="card-title"><h2>Hall of Fame</h2><button class="btn ghost sm" data-act="menu">← Menu</button></div>
    ${hof.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Driver</th><th>Best series</th><th>Seasons</th><th>Wins</th><th>Titles</th><th>Apex 👑</th><th style="text-align:right">Legacy</th></tr></thead><tbody>
      ${hof.map((h, i) => `<tr><td class="pos">${i + 1}</td><td><span class="swatch" style="background:${h.color}"></span><b>${esc(h.name)}</b> <span class="muted small">#${h.number} ${esc(h.nation)}</span></td><td>${TIERS[h.bestTier].name}</td><td>${h.seasons}</td><td>${h.wins}</td><td>${h.titles}</td><td>${h.apexTitles}</td><td style="text-align:right"><b class="gold">${h.score}</b></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">No retired drivers yet. Finish a career to be immortalised here.</p>'}
  </div></div>`;
};

/* ============================================================
   Quick race
   ============================================================ */
function renderQuick() {
  hideRace();
  const q = UI.quick, T = TIERS[q.tier];
  const trackName = q.track && T.tracks.includes(q.track) ? q.track : (q.track = T.tracks[0]);
  appEl.innerHTML = `<div class="page" style="max-width:720px"><div class="card">
    <div class="card-title"><h2>Quick race</h2><button class="btn ghost sm" data-act="menu">← Menu</button></div>
    <label class="f">Series</label>
    <select data-qfield="tier">${TIERS.map((t, i) => `<option value="${i}" ${i === q.tier ? 'selected' : ''}>${t.name} — ${t.cls}</option>`).join('')}</select>
    <label class="f">Circuit</label>
    <select data-qfield="track">${T.tracks.map(t => `<option ${t === trackName ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <label class="f">Difficulty</label>
    <select data-qfield="difficulty">${['easy', 'normal', 'hard'].map(d => `<option ${d === q.difficulty ? 'selected' : ''} value="${d}">${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>
    <canvas class="track-preview" style="margin-top:14px" data-track="${esc(trackName)}" data-tier="${q.tier}"></canvas>
    <p class="muted small">${T.laps} laps • ${T.field} drivers • ${T.items ? 'Item boxes + drift boosts' : 'ERS + slipstream'} • Your driver is rated at the series average.</p>
    <button class="btn primary big" style="width:100%" data-act="quick-go">Start race</button>
  </div></div>`;
  drawPreviews();
}
ACTIONS['quick'] = () => renderQuick();
ACTIONS['quick-go'] = () => {
  const q = UI.quick, T = TIERS[q.tier];
  const mid = Math.round((T.ratingMin + T.ratingMax) / 2);
  const used = new Set();
  const teams = T.vehicle === 'formula' ? genTeams(q.tier) : null;
  const mk = (i, isP) => {
    const name = isP ? 'You' : randomName(used);
    const r = isP ? mid + 2 : Math.round(rand(T.ratingMin, T.ratingMax));
    const tm = teams ? teams[Math.floor(i / 2) % teams.length] : null;
    const m = tm ? tm.car : (T.aiMachine[0] + T.aiMachine[1]) / 2 + (isP ? 0 : rand(-0.1, 0.1));
    return {
      id: isP ? 'player' : 'q' + i, name, code: isP ? 'YOU' : codeOf(name), isPlayer: isP,
      color: tm ? tm.color : isP ? '#e63946' : pick(BODY_COLORS), helmet: isP ? '#ffd60a' : pick(HELMET_COLORS), team: tm ? tm.color : null,
      stats: isP ? statsAround(r, 0) : statsAround(r), machine: { eng: isP && tm ? 0.6 : m, chas: isP && tm ? 0.6 : m, tire: isP && tm ? 0.6 : m }, perf: 1
    };
  };
  const racers = [];
  for (let i = 0; i < T.field; i++) racers.push(mk(i, i === T.field - 1));
  shuffle(racers);
  UI.quickRacers = racers;
  launchRace({ mode: 'quick', tier: T, trackName: q.track, laps: T.laps, racers, items: T.items, difficulty: q.difficulty, sound: S ? S.settings.sound : true });
};
function renderQuickResults(out) {
  const by = Object.fromEntries(UI.quickRacers.map(r => [r.id, r]));
  const me = out.results.find(r => r.id === 'player');
  appEl.innerHTML = `<div class="page" style="max-width:720px">
    <div class="card result-hero"><div class="pbig" style="color:${me.pos === 1 ? 'var(--accent2)' : '#fff'}">${me.dnf ? 'DNF' : 'P' + me.pos}</div>
      <div class="muted">${esc(UI.raceCfg.trackName)}</div></div>
    <div class="card"><table><thead><tr><th>#</th><th>Driver</th><th>Best lap</th></tr></thead><tbody>
      ${out.results.map(r => `<tr class="${r.id === 'player' ? 'me' : ''}"><td class="pos">${r.dnf ? 'DNF' : r.pos}</td><td>${esc(by[r.id].name)}${out.fastestLap === r.id ? '<span class="tag fl">FL</span>' : ''}</td><td class="muted">${isFinite(r.best) ? fmtTime(r.best) : '—'}</td></tr>`).join('')}
    </tbody></table>
    <div class="btn-row" style="margin-top:16px"><button class="btn primary" data-act="quick-again">Race again</button><button class="btn" data-act="quick">Change race</button><button class="btn ghost" data-act="menu">Menu</button></div></div>
  </div>`;
}
ACTIONS['quick-again'] = () => launchRace(UI.raceCfg);

/* ============================================================
   Help
   ============================================================ */
function showHelp(welcome) {
  openModal(`<div class="help">
    <h2 style="text-align:left">${welcome ? 'Welcome to the grid!' : 'How to play'}</h2>
    ${welcome ? `<p class="muted">You are 12 years old with a kart and a dream. Your rival ${S ? esc(S.rival.name) : ''} has the same dream. Only one of you can wear the crown.</p>` : ''}
    <h3>Driving</h3>
    <ul>
      <li><kbd>↑</kbd>/<kbd>W</kbd> gas, <kbd>↓</kbd>/<kbd>S</kbd> brake & reverse, <kbd>←</kbd><kbd>→</kbd>/<kbd>A</kbd><kbd>D</kbd> steer</li>
      <li><b>Karts:</b> hold <kbd>Shift</kbd> while turning to drift. Hold it longer for blue → orange → purple sparks, then release for a boost.</li>
      <li><b>Karts:</b> drive through <b>?</b> boxes for items, use them with <kbd>Space</kbd>: 🚀 Nitro, ⚡ homing Bolt, 🛢️ Oil slick, 🛡️ Shield, 🌩️ Storm (slows everyone ahead).</li>
      <li><b>Formula cars:</b> hold <kbd>Space</kbd> for ERS (battery boost, recharges when braking). Tyres wear out over the race.</li>
      <li>Sit right behind someone for a <b>slipstream</b> speed boost.</li>
      <li><b>Rocket start:</b> press gas just as the five red lights go out. Hold it too early and you will bog down.</li>
      <li><kbd>R</kbd> resets you onto the track, <kbd>Esc</kbd> pauses.</li>
      <li><b>On a phone:</b> tap <b>TILT</b> during a race to steer by tilting (turn the phone sideways for the best feel). Brake is under your left thumb, gas under your right.</li>
    </ul>
    <h3>Career</h3>
    <ul>
      <li>Each week you get <b>3 activities</b>: training raises your stats, Media Day builds fans and money, Rest Day restores energy. <b>Energy and morale affect your race-day pace.</b></li>
      <li>Story events ask you to make decisions. They can change your stats, fans, rival heat and more.</li>
      <li>Races give XP → levels → skill points. Spend money on kart upgrades and support staff in the Garage.</li>
      <li>Finish the season in the <b>top 3</b> to be promoted. Karts → Formula Junior → Formula Rising → Formula Elite → <b>Apex Grand Prix</b>.</li>
      <li>In the formula tiers you drive for a team. Better results mean offers from faster teams.</li>
    </ul>
    <div style="text-align:right;margin-top:16px"><button class="btn primary" data-act="modal-close">Let's go</button></div>
  </div>`);
}

/* ---------- boot ---------- */
renderTitle();
