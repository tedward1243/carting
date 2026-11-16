'use strict';
/* ============================================================
   Career state & progression (no DOM in here)
   ============================================================ */

const SAVE_KEY = 'kartToCrown.save.v1';
const HOF_KEY = 'kartToCrown.hof.v1';
const Store = {
  load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

let S = null; // the live career

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
const fmtMoney = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));

function ovr(st) {
  return Math.round(st.spd * 0.2 + st.acc * 0.15 + st.hnd * 0.2 + st.foc * 0.15 + st.rc * 0.15 + st.fit * 0.15);
}
function codeOf(name) { const parts = name.trim().split(/\s+/); return (parts[parts.length - 1] || 'DRV').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X'); }
function xpNeeded(level) { return 200 + level * 60; }
function skillCost(v) { return v < 60 ? 1 : v < 80 ? 2 : 3; }
function tier() { return TIERS[S.tier]; }
function agentMult() { return 1 + 0.25 * (S.perks.agent || 0); }

function save() { if (S) Store.save(SAVE_KEY, S); }
function loadSave() { const s = Store.load(SAVE_KEY); if (s && s.v === 1 && s.driver) { S = s; return true; } return false; }

function randomName(used) {
  for (let i = 0; i < 50; i++) {
    const n = pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
    if (!used.has(n)) { used.add(n); return n; }
  }
  return 'Driver ' + randi(10, 99);
}
function statsAround(r, spread = 6) {
  const o = {};
  for (const k of STAT_KEYS) o[k] = clamp(Math.round(r + gauss() * spread), 20, 99);
  return o;
}

/* ---------------- new career ---------------- */
function newCareer(opt) {
  const bg = BACKGROUNDS.find(b => b.id === opt.bg) || BACKGROUNDS[0];
  const used = new Set([opt.name]);
  const rivalName = randomName(used);
  S = {
    v: 1, created: Date.now(), id: Math.random().toString(36).slice(2),
    driver: {
      name: opt.name, number: opt.number, nation: opt.nation, color: opt.color, helmet: opt.helmet, bg: bg.id,
      age: 12, stats: opt.stats, xp: 0, level: 1, skillPts: 0, energy: 100, morale: bg.morale || 70, fans: bg.fans, rep: 10
    },
    money: bg.money,
    tier: 0, season: 1,
    kart: { eng: bg.kart || 0, chas: bg.kart || 0, tire: bg.kart || 0 },
    perks: { coach: 0, simrig: 0, trainer: 0, agent: 0 },
    team: null, teamRel: 50, sponsor: null,
    rival: { name: rivalName, code: codeOf(rivalName), nation: pick(NATIONS), color: '#ff4d6d', helmet: '#111111', number: randi(2, 99) },
    buffs: [], flags: {},
    week: null, seasonData: null, lastRace: null, offers: null,
    history: [], trophies: [],
    totals: { starts: 0, wins: 0, podiums: 0, fastest: 0, titles: 0, poles: 0, bestTier: 0 },
    news: [], recentEvents: [],
    settings: Object.assign({ difficulty: 'normal', chaos: false, sound: true }, opt.settings || {})
  };
  startSeason();
  addNews(`${opt.name}, age 12, enters the ${TIERS[0].name}. The road to the Apex starts today.`, 'story');
  addNews(`Meet your rival: ${rivalName}. Same age, same dream, zero friendship.`, 'rival');
  save();
}

function addNews(text, kind = 'info') {
  S.news.unshift({ text, kind, season: S.season, tier: S.tier });
  if (S.news.length > 40) S.news.length = 40;
}

/* ---------------- teams ---------------- */
function genTeams(tierId) {
  const T = TIERS[tierId];
  const n = T.field / 2;
  const teams = shuffle(FORMULA_TEAMS.slice()).slice(0, n);
  teams.forEach((t, i) => { t.car = clamp(0.95 - i * (0.62 / (n - 1)) + rand(-0.05, 0.05), 0.2, 1); });
  return teams.map(t => ({ name: t.name, color: t.color, car: +t.car.toFixed(2) }));
}

/* ---------------- seasons ---------------- */
function startSeason() {
  const T = tier();
  const used = new Set([S.driver.name, S.rival.name]);
  const grid = [];
  const isF = T.vehicle === 'formula';
  let teams = null;
  if (isF) {
    teams = S.nextTeams && S.nextTeams.tier === S.tier ? S.nextTeams.list : genTeams(S.tier);
    if (!S.team) { const sorted = teams.slice().sort((a, b) => a.car - b.car); S.team = Object.assign({}, sorted[0], { salary: T.salary * 0.6 }); }
    const i = teams.findIndex(t => t.name === S.team.name);
    if (i >= 0) teams[i] = { name: S.team.name, color: S.team.color, car: S.team.car };
    else { teams.sort((a, b) => a.car - b.car); teams[0] = { name: S.team.name, color: S.team.color, car: S.team.car }; }
  }
  S.nextTeams = null;

  // rival: always near the top of whatever series you are in
  const rivalRating = clamp(T.ratingMax - 3 + randi(-1, 3), 20, 97);
  grid.push({ id: 'rival', name: S.rival.name, code: S.rival.code, nation: S.rival.nation, rating: rivalRating, stats: statsAround(rivalRating, 4), color: S.rival.color, helmet: S.rival.helmet, isRival: true });
  for (let i = 0; i < T.field - 2; i++) {
    const name = randomName(used);
    const r = Math.round(rand(T.ratingMin, T.ratingMax));
    grid.push({ id: 'ai' + i, name, code: codeOf(name), nation: pick(NATIONS), rating: r, stats: statsAround(r), color: pick(BODY_COLORS), helmet: pick(HELMET_COLORS) });
  }
  // machines / seats
  if (isF) {
    const seats = [];
    for (const t of teams) { if (t.name === S.team.name) seats.push(t); else { seats.push(t); seats.push(t); } }
    seats.sort((a, b) => b.car - a.car);
    const ais = grid.slice().sort((a, b) => (b.rating + gauss() * 6) - (a.rating + gauss() * 6));
    ais.forEach((d, i) => { const t = seats[i]; d.team = t.name; d.teamColor = t.color; d.color = t.color; d.machine = { eng: t.car, chas: t.car, tire: t.car }; });
  } else {
    for (const d of grid) { const m = rand(T.aiMachine[0], T.aiMachine[1]); d.machine = { eng: m, chas: m + rand(-0.05, 0.05), tire: m + rand(-0.05, 0.05) }; }
  }
  const points = { player: 0 };
  grid.forEach(d => points[d.id] = 0);
  const tracks = shuffle(T.tracks.slice());
  while (tracks.length < T.races) tracks.push(pick(T.tracks));
  S.seasonData = { tier: S.tier, tracks: tracks.slice(0, T.races), round: 0, grid, points, wins: {}, podiums: {}, results: [], teams };
  S.sponsor = null;
  S.offers = null;
  S.seasonOver = false;
  S.totals.bestTier = Math.max(S.totals.bestTier, S.tier);
  newWeek(true);
}

function newWeek(first) {
  if (!first) S.driver.energy = clamp(S.driver.energy + 30, 0, 100);
  let event = null;
  if (!first && Math.random() < 0.65) {
    const pool = EVENTS.filter(e => (!e.cond || e.cond(S)) && !S.recentEvents.includes(e.id));
    if (pool.length) { event = pick(pool); S.recentEvents.push(event.id); if (S.recentEvents.length > 6) S.recentEvents.shift(); }
  }
  let sponsorOffer = null;
  const T = tier();
  if (!S.sponsor && (first ? S.driver.fans > 60 : Math.random() < 0.35)) {
    const fansF = clamp(Math.log10(Math.max(10, S.driver.fans)) / 3, 0.5, 2.2);
    sponsorOffer = {
      name: pick(SPONSOR_NAMES),
      perRace: Math.round(T.prize * rand(0.12, 0.25) * fansF * agentMult() / 10) * 10,
      podiumBonus: Math.round(T.prize * rand(0.3, 0.6) / 10) * 10
    };
  }
  S.week = { used: [], event: event ? event.id : null, eventResult: null, sponsorOffer, log: [] };
}

/* ---------------- performance helpers ---------------- */
function playerMachine() {
  const T = tier();
  let m;
  if (T.vehicle === 'formula') { const c = S.team ? S.team.car : 0.3; m = { eng: c, chas: c, tire: c }; }
  else m = { eng: S.kart.eng / 5, chas: S.kart.chas / 5, tire: S.kart.tire / 5 };
  const b = S.buffs.filter(b => b.type === 'machine').reduce((a, b) => a + b.value, 0);
  for (const k in m) m[k] = clamp(m[k] + b, 0, 1.2);
  return m;
}
function playerPerf() {
  const d = S.driver;
  const pb = S.buffs.filter(b => b.type === 'perf').reduce((a, b) => a + b.value, 0);
  return (0.93 + 0.07 * d.energy / 100) * (0.98 + 0.02 * d.morale / 100) * (1 + pb);
}
function machineAvg(m) { return (m.eng + m.chas + m.tire) / 3; }

function buildRacers() {
  const sd = S.seasonData, T = tier(), d = S.driver;
  const pm = playerMachine();
  const racers = [{
    id: 'player', name: d.name, code: codeOf(d.name), isPlayer: true,
    color: T.vehicle === 'formula' ? S.team.color : d.color, helmet: d.helmet, team: T.vehicle === 'formula' ? S.team.color : null,
    stats: Object.assign({}, d.stats), machine: pm, perf: playerPerf()
  }];
  for (const g of sd.grid) {
    racers.push({
      id: g.id, name: g.name, code: g.code, isRival: !!g.isRival, color: g.color, helmet: g.helmet, team: g.teamColor || null,
      stats: g.stats, machine: g.machine, perf: 1
    });
  }
  // qualifying
  for (const r of racers) r.q = ovr(r.stats) * r.perf + machineAvg(r.machine) * 18 + gauss() * 5 + (r.isPlayer ? 2 : 0);
  racers.sort((a, b) => b.q - a.q);
  return racers;
}

function simulateRace(racers) {
  const scored = racers.map(r => ({ r, s: ovr(r.stats) * r.perf + machineAvg(r.machine) * 20 + gauss() * 9 - racers.indexOf(r) * 0.4 }));
  scored.sort((a, b) => b.s - a.s);
  const results = scored.map((x, i) => ({ id: x.r.id, pos: i + 1, finished: true, time: 0, best: 0, grid: racers.indexOf(x.r) + 1 }));
  const fl = results[Math.floor(Math.random() * Math.min(4, results.length))].id;
  return { results, fastestLap: fl, simulated: true };
}

/* ---------------- after the race ---------------- */
function applyRaceResult(out) {
  const sd = S.seasonData, T = tier(), d = S.driver;
  const track = sd.tracks[sd.round];
  const field = out.results.length;
  const nameOf = id => id === 'player' ? d.name : (sd.grid.find(g => g.id === id) || {}).name || id;
  const rows = [];
  for (const r of out.results) {
    let pts = r.dnf ? 0 : (POINTS[r.pos - 1] || 0);
    const fl = out.fastestLap === r.id && r.pos <= 10 && !r.dnf;
    if (fl) pts += 1;
    sd.points[r.id] = (sd.points[r.id] || 0) + pts;
    if (r.pos === 1 && !r.dnf) sd.wins[r.id] = (sd.wins[r.id] || 0) + 1;
    if (r.pos <= 3 && !r.dnf) sd.podiums[r.id] = (sd.podiums[r.id] || 0) + 1;
    rows.push({ id: r.id, name: nameOf(r.id), pos: r.pos, pts, fl, time: r.time, best: r.best, grid: r.grid, dnf: r.dnf });
  }
  const me = out.results.find(r => r.id === 'player');
  const rv = out.results.find(r => r.id === 'rival');
  const pos = me.pos, dnf = !!me.dnf;
  const won = pos === 1 && !dnf, podium = pos <= 3 && !dnf;
  const beatRival = rv && me.pos < rv.pos;
  const gotFL = out.fastestLap === 'player';

  const rewards = [];
  // money
  let money = dnf ? 0 : Math.round(T.prize * (PRIZE_SHARE[pos - 1] || 0.05));
  rewards.push(['Prize money', fmtMoney(money)]);
  if (S.team && T.vehicle === 'formula') { money += S.team.salary; rewards.push(['Team salary', fmtMoney(S.team.salary)]); }
  if (S.sponsor) {
    money += S.sponsor.perRace; rewards.push([S.sponsor.name, fmtMoney(S.sponsor.perRace)]);
    if (podium) { money += S.sponsor.podiumBonus; rewards.push(['Podium bonus', fmtMoney(S.sponsor.podiumBonus)]); }
  }
  S.money += money;

  // xp
  let xp = 60 + (field - pos) * 18;
  if (won) xp += 120; else if (podium) xp += 50;
  if (beatRival) xp += 40;
  if (gotFL) xp += 30;
  if (dnf) xp = 30;
  if (out.simulated) xp = Math.round(xp * 0.75);
  d.xp += xp;
  let levels = 0;
  while (d.xp >= xpNeeded(d.level)) { d.xp -= xpNeeded(d.level); d.level++; d.skillPts += 3; levels++; }

  // fans, morale, rep
  let fans = Math.round(T.fansBase * (field - pos + 1) * (won ? 2 : 1) * agentMult());
  if (dnf) fans = 0;
  let morale = won ? 12 : podium ? 7 : pos > field / 2 ? -5 : 1;
  let rep = won ? 4 : podium ? 2 : 0;
  const notes = [];
  if (S.flags.scout && podium) { rep += 12; notes.push('The scout was impressed. Reputation +12.'); addNews(`Scouts are talking about ${d.name} after a podium at ${track}.`, 'story'); }
  if (S.flags.boldWin) {
    if (won) { fans *= 2; morale += 10; notes.push('You called the win — and delivered. Fans doubled!'); }
    else { morale -= 10; fans = Math.round(fans * 0.5); rep -= 3; notes.push('Your win prediction backfired. Morale hit.'); }
  }
  if (S.flags.rivalHeat) {
    if (beatRival) { morale += 10; fans += Math.round(T.fansBase * 6); notes.push(`You backed up the talk against ${S.rival.name}.`); }
    else { morale -= 6; notes.push(`${S.rival.name} got the last laugh this time.`); }
  }
  d.fans += fans;
  d.morale = clamp(d.morale + morale, 0, 100);
  d.rep = clamp(d.rep + rep, 0, 100);
  d.energy = clamp(d.energy - 15, 0, 100);
  rewards.push(['XP', '+' + xp], ['Fans', '+' + fmtNum(fans)]);

  // totals
  S.totals.starts++;
  if (won) S.totals.wins++;
  if (podium) S.totals.podiums++;
  if (gotFL) S.totals.fastest++;
  if (me.grid === 1) S.totals.poles++;

  // buffs/flags expire
  S.buffs.forEach(b => b.races--);
  S.buffs = S.buffs.filter(b => b.races > 0);
  S.flags = {};

  // headline
  let hl;
  if (dnf) hl = `${d.name} retires from the ${track} race. A weekend to forget.`;
  else if (won) hl = pick([`${d.name} storms to victory at ${track}!`, `Unstoppable! ${d.name} wins at ${track}.`, `${d.name} takes the chequered flag first at ${track}.`]);
  else if (podium) hl = `${d.name} grabs P${pos} and a podium at ${track}.`;
  else if (pos <= field / 2) hl = `Solid points for ${d.name}: P${pos} at ${track}.`;
  else hl = `Tough day for ${d.name}, P${pos} at ${track}.`;
  addNews(hl, won ? 'win' : podium ? 'podium' : 'race');
  if (rv) {
    if (beatRival) addNews(`${d.name} finishes ahead of rival ${S.rival.name} (P${rv.pos}).`, 'rival');
    else if (rv.pos === 1) addNews(`${S.rival.name} wins at ${track}. Your rival is not slowing down.`, 'rival');
  }

  sd.results.push({ track, rows });
  sd.round++;
  S.lastRace = { track, round: sd.round, rows, pos, rewards, notes, levels, beatRival, rivalPos: rv ? rv.pos : null, simulated: !!out.simulated, fastest: out.fastestLap, dnf };
  if (sd.round >= T.races) { S.seasonOver = true; prepareSeasonEnd(); }
  else newWeek(false);
  save();
}

function standings() {
  const sd = S.seasonData;
  const rows = [{ id: 'player', name: S.driver.name, code: codeOf(S.driver.name), team: S.team ? S.team.name : null, teamColor: S.team ? S.team.color : S.driver.color, isPlayer: true }]
    .concat(sd.grid.map(g => ({ id: g.id, name: g.name, code: g.code, team: g.team || null, teamColor: g.teamColor || g.color, isRival: g.isRival, rating: g.rating })));
  rows.forEach(r => { r.pts = sd.points[r.id] || 0; r.wins = sd.wins[r.id] || 0; r.podiums = sd.podiums[r.id] || 0; });
  rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.podiums - a.podiums);
  rows.forEach((r, i) => r.pos = i + 1);
  return rows;
}

/* ---------------- season end ---------------- */
function prepareSeasonEnd() {
  const T = tier();
  const st = standings();
  const me = st.find(r => r.isPlayer);
  const rv = st.find(r => r.isRival);
  const champ = me.pos === 1;
  S.history.push({ season: S.season, age: S.driver.age, tier: S.tier, tierName: T.name, pos: me.pos, pts: me.pts, wins: me.wins, podiums: me.podiums, team: S.team ? S.team.name : null, rivalPos: rv ? rv.pos : null });
  if (champ) {
    S.trophies.push({ name: T.name + ' Champion', season: S.season, tier: S.tier });
    S.totals.titles++;
    S.driver.fans += T.fansBase * 60;
    S.driver.rep = clamp(S.driver.rep + 15, 0, 100);
    addNews(`CHAMPION! ${S.driver.name} wins the ${T.name} title!`, 'win');
  } else addNews(`${S.driver.name} finishes the ${T.name} season P${me.pos}. ${rv && rv.pos < me.pos ? S.rival.name + ' ends up ahead (P' + rv.pos + ').' : ''}`, 'story');
  const bonus = Math.round(T.prize * [3, 2, 1.5, 1, 0.6][me.pos - 1] || 0);
  if (bonus) { S.money += bonus; }
  S.seasonEnd = { pos: me.pos, pts: me.pts, champ, bonus, standings: st.slice(0, 12), rivalPos: rv ? rv.pos : null, tierName: T.name };
  S.offers = makeOffers(me.pos);
}

function makeOffers(pos) {
  const t = S.tier, T = TIERS[t], d = S.driver;
  const next = t + 1 < TIERS.length ? t + 1 : null;
  const offers = [];
  const wildcard = pos <= 5 && (d.rep >= 45 || d.fans >= T.fansBase * 350);
  const promote = next !== null && (pos <= 3 || wildcard);
  if (promote) {
    const NT = TIERS[next];
    if (NT.vehicle === 'formula') {
      const teams = genTeams(next).sort((a, b) => b.car - a.car);
      S.pendingTeams = { [next]: teams };
      const range = pos === 1 ? [0, 2] : pos <= 3 ? [1, 4] : [3, 5];
      const cands = shuffle(teams.slice(range[0], range[1] + 1)).slice(0, pos <= 3 ? 2 : 1);
      for (const tm of cands) offers.push({ type: 'promote', tier: next, team: tm, salary: Math.round(NT.salary * (0.6 + tm.car * 0.8) / 100) * 100, label: `${tm.name} (${NT.name})`, wild: pos > 3 });
    } else {
      offers.push({ type: 'promote', tier: next, team: null, label: `Move up to the ${NT.name}`, wild: pos > 3 });
    }
  }
  // stay in current series
  if (T.vehicle === 'formula') {
    const teams = genTeams(t).sort((a, b) => b.car - a.car);
    S.pendingTeams = Object.assign(S.pendingTeams || {}, { [t]: teams });
    const cur = teams.find(x => x.name === S.team.name) || Object.assign({}, S.team);
    const idx = clamp(Math.floor((pos - 1) / 2), 0, teams.length - 1);
    const better = teams[clamp(idx - 1, 0, teams.length - 1)];
    const stay = [cur];
    if (better && better.name !== cur.name && better.car > cur.car) stay.push(better);
    for (const tm of stay) offers.push({ type: 'stay', tier: t, team: tm, salary: Math.round(T.salary * (0.6 + tm.car * 0.8) / 100) * 100, label: tm.name === S.team.name ? `Re-sign with ${tm.name}` : `Switch to ${tm.name}`, });
  } else {
    offers.push({ type: 'stay', tier: t, team: null, label: `Another season in the ${T.name}` });
  }
  if (d.age >= 34) offers.push({ type: 'retire', label: 'Retire and enter the Hall of Fame' });
  return offers;
}

function acceptOffer(i) {
  const o = S.offers[i];
  if (o.type === 'retire') return 'retire';
  const prevTier = S.tier;
  S.tier = o.tier;
  if (o.team) {
    S.team = { name: o.team.name, color: o.team.color, car: o.team.car, salary: o.salary };
    const list = (S.pendingTeams || {})[o.tier];
    if (list) S.nextTeams = { tier: o.tier, list };
  } else if (TIERS[o.tier].vehicle === 'kart') S.team = null;
  S.pendingTeams = null;
  S.season++;
  S.driver.age++;
  S.driver.energy = 100;
  S.driver.morale = clamp(S.driver.morale + 10, 0, 100);
  if (S.tier > prevTier) {
    addNews(`PROMOTED! ${S.driver.name} moves up to the ${TIERS[S.tier].name}${o.team ? ' with ' + o.team.name : ''}.`, 'win');
    addNews(`${S.rival.name} also steps up to the ${TIERS[S.tier].name}. The rivalry continues.`, 'rival');
  } else addNews(`${S.driver.name} commits to another season in the ${TIERS[S.tier].name}.`, 'story');
  S.seasonEnd = null;
  S.lastRace = null;
  startSeason();
  if (S.driver.age >= 40) { save(); return 'retire'; }
  save();
  return 'ok';
}

/* ---------------- week planner ---------------- */
function trainGain(v, perkLvl) {
  let base = v < 50 ? 2 : v < 70 ? 1.5 : v < 85 ? 1 : 0.55;
  base += perkLvl * 0.45;
  return Math.max(v >= 99 ? 0 : 0, Math.floor(base + Math.random()));
}

function doWeekAction(id) {
  const a = WEEK_ACTIONS.find(x => x.id === id);
  const d = S.driver, T = tier();
  if (S.week.used.length >= 3) return { ok: false, msg: 'No more time this week.' };
  if (a.energy > 0 && d.energy < a.energy) return { ok: false, msg: 'Too tired for that. Try a Rest Day.' };
  d.energy = clamp(d.energy - a.energy, 0, 100);
  let text = '';
  if (a.stats.length) {
    const k = pick(a.stats);
    const g = Math.min(99 - d.stats[k], trainGain(d.stats[k], S.perks[a.perk] || 0));
    d.stats[k] += g;
    d.xp += 10;
    text = g > 0 ? `${STAT_INFO[k].name} +${g}` : `${STAT_INFO[k].name} — no gain this time`;
  } else if (id === 'media') {
    const f = Math.round(T.fansBase * rand(3, 6) * agentMult());
    const m = Math.round(T.prize * 0.12 / 10) * 10;
    d.fans += f; S.money += m; d.morale = clamp(d.morale + 2, 0, 100);
    text = `+${fmtNum(f)} fans, +${fmtMoney(m)}`;
  } else if (id === 'rest') {
    d.morale = clamp(d.morale + 6, 0, 100);
    text = 'Energy restored, morale +6';
  }
  while (d.xp >= xpNeeded(d.level)) { d.xp -= xpNeeded(d.level); d.level++; d.skillPts += 3; text += ' • LEVEL UP!'; }
  S.week.used.push({ id, text });
  save();
  return { ok: true, msg: `${a.name}: ${text}` };
}

function fill(str) { return str.replace(/\{rival\}/g, S.rival.name).replace(/\{name\}/g, S.driver.name); }

function resolveEvent(choiceIdx) {
  const ev = EVENTS.find(e => e.id === S.week.event);
  if (!ev) return;
  const ch = ev.choices[choiceIdx];
  applyFx(ch.fx);
  S.week.eventResult = fill(ch.result);
  S.week.event = null;
  save();
  return S.week.eventResult;
}

function applyFx(fx) {
  const d = S.driver;
  if (fx.energy) d.energy = clamp(d.energy + fx.energy, 0, 100);
  if (fx.morale) d.morale = clamp(d.morale + fx.morale, 0, 100);
  if (fx.rep) d.rep = clamp(d.rep + fx.rep, 0, 100);
  if (fx.fans) d.fans += Math.round(fx.fans * Math.max(1, tier().fansBase / 8) * agentMult());
  if (fx.money) S.money = Math.max(0, S.money + fx.money * (fx.money > 0 ? Math.max(1, tier().prize / 700) : 1));
  if (fx.moneyPct) S.money = Math.max(0, S.money - Math.max(fx.moneyMin || 0, S.money * -fx.moneyPct));
  if (fx.stats) for (const k in fx.stats) d.stats[k] = clamp(d.stats[k] + fx.stats[k], 1, 99);
  if (fx.buff) S.buffs.push(Object.assign({}, fx.buff));
  if (fx.flag) S.flags[fx.flag] = true;
  if (fx.teamRel) S.teamRel = clamp(S.teamRel + fx.teamRel, 0, 100);
  if (fx.kartUp) { const parts = ['eng', 'chas', 'tire'].filter(p => S.kart[p] < 5); if (parts.length) S.kart[pick(parts)]++; }
}

function acceptSponsor(yes) {
  const o = S.week.sponsorOffer;
  if (!o) return;
  if (yes) { S.sponsor = o; addNews(`${S.driver.name} signs a sponsorship deal with ${o.name}.`, 'story'); }
  S.week.sponsorOffer = null;
  save();
}

/* ---------------- shop ---------------- */
function kartUpgradeCost(part) {
  const lvl = S.kart[part];
  if (lvl >= 5) return null;
  return Math.round(200 * Math.pow(1.85, lvl) * (tier().upgradeMult || 1) / 10) * 10;
}
function buyKartUpgrade(part) {
  const c = kartUpgradeCost(part);
  if (c === null || S.money < c) return false;
  S.money -= c; S.kart[part]++; save(); return true;
}
function perkCost(id) { const p = PERKS.find(x => x.id === id); const l = S.perks[id] || 0; return l >= 3 ? null : p.cost[l]; }
function buyPerk(id) {
  const c = perkCost(id);
  if (c === null || S.money < c) return false;
  S.money -= c; S.perks[id] = (S.perks[id] || 0) + 1; save(); return true;
}
function spendSkill(k) {
  const d = S.driver;
  const c = skillCost(d.stats[k]);
  if (d.skillPts < c || d.stats[k] >= 99) return false;
  d.skillPts -= c; d.stats[k]++; save(); return true;
}

/* ---------------- retirement ---------------- */
function legacyScore() {
  const t = S.totals;
  return t.titles * 120 + t.wins * 12 + t.podiums * 4 + t.fastest * 2 + S.totals.bestTier * 60 + Math.round(Math.log10(Math.max(10, S.driver.fans)) * 20);
}
function retire() {
  const hof = Store.load(HOF_KEY) || [];
  const apexTitles = S.trophies.filter(t => t.tier === 6).length;
  hof.push({
    name: S.driver.name, number: S.driver.number, nation: S.driver.nation, color: S.driver.color,
    seasons: S.history.length, titles: S.totals.titles, apexTitles, wins: S.totals.wins, podiums: S.totals.podiums,
    bestTier: S.totals.bestTier, score: legacyScore(), date: Date.now()
  });
  hof.sort((a, b) => b.score - a.score);
  Store.save(HOF_KEY, hof.slice(0, 20));
  const summary = { name: S.driver.name, totals: Object.assign({}, S.totals), trophies: S.trophies.slice(), score: legacyScore(), history: S.history.slice(), apexTitles };
  Store.del(SAVE_KEY);
  S = null;
  return summary;
}
