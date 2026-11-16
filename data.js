'use strict';
/* ============================================================
   KART TO CROWN — static game data
   ============================================================ */

const TIERS = [
  {
    id: 0, name: 'Backyard Karts', short: 'CLUB', vehicle: 'kart', cls: '60cc Cadet',
    races: 4, field: 8, laps: 3, ratingMin: 30, ratingMax: 44, aiMachine: [0.05, 0.25],
    baseSpeed: 290, baseAcc: 250, baseTurn: 3.0, width: 124, runoff: 56, radius: 820,
    view: 620, kmh: 0.30, items: true, prize: 300, fansBase: 8, upgradeMult: 1,
    color: '#7bd88f',
    desc: 'Weekend club races at the local track. Everyone starts somewhere.',
    tracks: ['Maple Lane Kartway', 'Rusty Pines Circuit', 'Harbor Lot Speedway', 'Cornfield Ring', 'Duckpond Raceway']
  },
  {
    id: 1, name: 'Regional Kart Series', short: 'REG', vehicle: 'kart', cls: '100cc Junior',
    races: 5, field: 10, laps: 3, ratingMin: 40, ratingMax: 54, aiMachine: [0.2, 0.45],
    baseSpeed: 320, baseAcc: 270, baseTurn: 3.0, width: 128, runoff: 58, radius: 900,
    view: 660, kmh: 0.30, items: true, prize: 700, fansBase: 20, upgradeMult: 1.6,
    color: '#5cc8ff',
    desc: 'Bigger grids, travelling teams and the first scouts in the paddock.',
    tracks: ['Lakeside Kart Park', 'Granite Hill Raceway', 'Sunset Mesa', 'Riverbend Kartdrome', 'Old Mill Circuit', 'Foxglove Fields']
  },
  {
    id: 2, name: 'National Kart Championship', short: 'NAT', vehicle: 'kart', cls: '125cc Shifter',
    races: 5, field: 10, laps: 4, ratingMin: 48, ratingMax: 62, aiMachine: [0.4, 0.7],
    baseSpeed: 350, baseAcc: 290, baseTurn: 3.0, width: 130, runoff: 60, radius: 980,
    view: 700, kmh: 0.31, items: true, prize: 1500, fansBase: 45, upgradeMult: 2.4,
    color: '#ffd166',
    desc: 'The best karters in the country. Win here and the formula teams call.',
    tracks: ['Thunder Valley', 'Coastline Kart Center', 'Ironwood Raceway', 'Silver Creek', 'Desert Bloom Kartplex', 'Blackrock Bowl']
  },
  {
    id: 3, name: 'Formula Junior', short: 'FJR', vehicle: 'formula', cls: 'Single-seater',
    races: 6, field: 12, laps: 4, ratingMin: 55, ratingMax: 69, aiMachine: null,
    baseSpeed: 420, baseAcc: 320, baseTurn: 2.75, width: 150, runoff: 76, radius: 1250,
    view: 820, kmh: 0.52, items: false, prize: 4000, fansBase: 110, salary: 1500,
    color: '#ff9f43',
    desc: 'Your first real race car. Wings, slicks and team engineers.',
    tracks: ['Ashford Park', 'Montvale Ring', 'Port Lorne', 'Velden Circuit', 'Sierra Alta', 'Kingsbridge', 'Cedar Falls Raceway']
  },
  {
    id: 4, name: 'Formula Rising', short: 'FRS', vehicle: 'formula', cls: 'Junior Formula',
    races: 6, field: 12, laps: 5, ratingMin: 62, ratingMax: 76, aiMachine: null,
    baseSpeed: 460, baseAcc: 340, baseTurn: 2.7, width: 150, runoff: 78, radius: 1320,
    view: 860, kmh: 0.56, items: false, prize: 8000, fansBase: 260, salary: 4000,
    color: '#ff6b6b',
    desc: 'The feeder series where future champions are made — or broken.',
    tracks: ['Circuit Valtora', 'Marisol Bay', 'Nordhavn Ring', 'Lakemont', 'Hakone Ridge', 'Autodromo Serrano', 'Ostrava Grand Circuit']
  },
  {
    id: 5, name: 'Formula Elite', short: 'FEL', vehicle: 'formula', cls: 'Second tier',
    races: 7, field: 12, laps: 5, ratingMin: 68, ratingMax: 83, aiMachine: null,
    baseSpeed: 500, baseAcc: 360, baseTurn: 2.65, width: 152, runoff: 80, radius: 1400,
    view: 900, kmh: 0.6, items: false, prize: 15000, fansBase: 600, salary: 10000,
    color: '#c77dff',
    desc: 'One step from the top. Every Apex team boss is watching.',
    tracks: ['Al Qamar Circuit', 'Sao Bento', 'Kingsbridge Park', 'Port Lorne Street Circuit', 'Montvale GP', 'Velden Ring', 'Ashford National', 'Sierra Alta GP']
  },
  {
    id: 6, name: 'Apex Grand Prix', short: 'APEX', vehicle: 'formula', cls: 'World Championship',
    races: 8, field: 12, laps: 5, ratingMin: 75, ratingMax: 93, aiMachine: null,
    baseSpeed: 540, baseAcc: 380, baseTurn: 2.6, width: 156, runoff: 84, radius: 1480,
    view: 940, kmh: 0.6, items: false, prize: 40000, fansBase: 1500, salary: 40000,
    color: '#f9f871',
    desc: 'The pinnacle. Twelve of the fastest humans alive. One crown.',
    tracks: ['Grand Prix of Valtora', 'Marisol Bay GP', 'Nordhavn GP', 'Hakone Ridge GP', 'Autodromo Serrano GP', 'Al Qamar Night Race', 'Sao Bento GP', 'Kingsbridge Grand Prix', 'Ostrava GP', 'Lakemont GP']
  }
];

const FORMULA_TEAMS = [
  { name: 'Vortex Racing', color: '#e63946' },
  { name: 'Halcyon GP', color: '#4cc9f0' },
  { name: 'Ironclad Motorsport', color: '#adb5bd' },
  { name: 'Lumen Racing', color: '#ffd60a' },
  { name: 'Corsa Nova', color: '#06d6a0' },
  { name: 'Sable Works', color: '#7b2cbf' },
  { name: 'Kestrel Racing', color: '#ff8500' },
  { name: 'Zenith Racing', color: '#f72585' }
];

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const PRIZE_SHARE = [1, 0.7, 0.5, 0.4, 0.33, 0.27, 0.22, 0.18, 0.15, 0.12, 0.1, 0.08];

const FIRST_NAMES = ['Leo', 'Mateo', 'Kai', 'Nico', 'Aria', 'Zane', 'Luca', 'Mila', 'Ravi', 'Theo', 'Ines', 'Felix', 'Sora', 'Yuki', 'Omar', 'Jonas', 'Elena', 'Dario', 'Ivy', 'Remy', 'Taro', 'Lena', 'Bruno', 'Noa', 'Callum', 'Enzo', 'Freya', 'Hugo', 'Anya', 'Malik', 'Sven', 'Tomas', 'Rhea', 'Pablo', 'Kira', 'Oscar', 'Niamh', 'Arjun', 'Wren', 'Esme', 'Joaquin', 'Hana', 'Idris', 'Vera'];
const LAST_NAMES = ['Varga', 'Castell', 'Moreau', 'Okafor', 'Lindqvist', 'Brandt', 'Tanaka', 'Rossi', 'Novak', 'Haddad', 'Sato', 'Ferreira', 'Kowalski', 'Dubois', 'Reyes', 'Hale', 'Petrov', 'Marin', 'Quinn', 'Adeyemi', 'Larsen', 'Cruz', 'Fontaine', 'Ibarra', 'Kane', 'Nakamura', 'Orlov', 'Stroud', 'Valente', 'Wilder', 'Ashby', 'Bianchi', 'Duarte', 'Engel', 'Faulk', 'Grimaldi', 'Holt', 'Jansen', 'Kovac', 'Ueda', 'Silva', 'Mbeki'];
const NATIONS = ['USA', 'GBR', 'ITA', 'GER', 'FRA', 'ESP', 'BRA', 'JPN', 'MEX', 'NED', 'AUS', 'CAN', 'FIN', 'NGA', 'IND', 'KOR', 'ARG', 'SWE', 'NZL', 'RSA'];

const BODY_COLORS = ['#e63946', '#ff8500', '#ffd60a', '#06d6a0', '#118ab2', '#4361ee', '#7b2cbf', '#f72585', '#f1f1f1', '#222831'];
const HELMET_COLORS = ['#ffffff', '#ffd60a', '#e63946', '#4cc9f0', '#06d6a0', '#ff8500', '#c77dff', '#111111'];

const STAT_KEYS = ['spd', 'acc', 'hnd', 'foc', 'rc', 'fit'];
const STAT_INFO = {
  spd: { name: 'Speed', desc: 'Top speed on the straights.' },
  acc: { name: 'Acceleration', desc: 'How fast you get up to speed out of corners.' },
  hnd: { name: 'Handling', desc: 'Steering response and grip in the corners.' },
  foc: { name: 'Focus', desc: 'Less time lost off-track and after spins.' },
  rc: { name: 'Racecraft', desc: 'Slipstream strength and better item luck.' },
  fit: { name: 'Fitness', desc: 'Stay sharp late in the race. Matters most in formula cars.' }
};

const BACKGROUNDS = [
  { id: 'family', name: 'Racing Family', desc: 'Your mum raced. You grew up in the paddock.', mods: { hnd: 4, rc: 4 }, money: 1500, fans: 80 },
  { id: 'natural', name: 'Natural Talent', desc: 'Raw pace nobody can teach.', mods: { spd: 5, acc: 4 }, money: 600, fans: 40 },
  { id: 'underdog', name: 'Underdog', desc: 'Second-hand kart, first-class grit.', mods: { foc: 5, fit: 4 }, money: 250, fans: 20, morale: 90 },
  { id: 'rich', name: 'Rich Kid', desc: 'Best equipment money can buy. Talent sold separately.', mods: { foc: -3 }, money: 6000, fans: 60, kart: 1 },
  { id: 'sim', name: 'Sim Prodigy', desc: 'Thousands of hours in the simulator.', mods: { rc: 5, hnd: 4, fit: -2 }, money: 800, fans: 150 }
];

const WEEK_ACTIONS = [
  { id: 'track', name: 'Track Practice', icon: '🏁', energy: 22, desc: 'Laps, laps, laps. Builds Speed or Acceleration.', stats: ['spd', 'acc'], perk: 'coach' },
  { id: 'sim', name: 'Simulator', icon: '🎮', energy: 12, desc: 'Learn the lines. Builds Handling or Racecraft.', stats: ['hnd', 'rc'], perk: 'simrig' },
  { id: 'gym', name: 'Gym Session', icon: '💪', energy: 20, desc: 'Neck, core, cardio. Builds Fitness.', stats: ['fit'], perk: 'trainer' },
  { id: 'mental', name: 'Mental Coaching', icon: '🧠', energy: 8, desc: 'Visualisation and calm. Builds Focus.', stats: ['foc'], perk: 'trainer' },
  { id: 'media', name: 'Media Day', icon: '📸', energy: 10, desc: 'Interviews, socials, autographs. Fans and a little cash.', stats: [] },
  { id: 'rest', name: 'Rest Day', icon: '😴', energy: -35, desc: 'Sleep in. Restores energy and morale.', stats: [] }
];

const PERKS = [
  { id: 'coach', name: 'Driving Coach', desc: 'Track Practice gives bigger gains.', cost: [1500, 6000, 25000] },
  { id: 'simrig', name: 'Pro Sim Rig', desc: 'Simulator sessions give bigger gains.', cost: [1200, 5000, 20000] },
  { id: 'trainer', name: 'Performance Trainer', desc: 'Gym and Mental Coaching give bigger gains.', cost: [1200, 5000, 20000] },
  { id: 'agent', name: 'PR Agent', desc: 'More fans from everything, bigger sponsor offers.', cost: [2500, 10000, 40000] }
];

const KART_PARTS = [
  { id: 'eng', name: 'Engine', desc: 'Raises top speed.' },
  { id: 'chas', name: 'Chassis', desc: 'Faster acceleration.' },
  { id: 'tire', name: 'Tyres', desc: 'More grip and sharper turn-in.' }
];

const SPONSOR_NAMES = ['VoltCharge Energy', 'Nimbus Telecom', 'Crispy Crunch Snacks', 'Atlas Tools', 'Polar Fizz', 'Stellar Bank', 'Rocket Pizza', 'Quantum Gear', 'Blaze Watches', 'Harbor Insurance', 'Pixel Arcade', 'Summit Outdoors'];

/* Story events. {rival} and {name} are replaced. cond(state) decides eligibility. */
const EVENTS = [
  {
    id: 'party', title: 'Party Invite',
    text: 'Your friends are throwing a huge party the night before the race. Everyone will be there.',
    choices: [
      { label: 'Go (just for a bit)', fx: { morale: 15, energy: -25, fans: 15 }, result: 'Great night. Rough morning.' },
      { label: 'Stay home and rest', fx: { energy: 10, morale: -5 }, result: 'Early night. Your legs feel fresh.' }
    ]
  },
  {
    id: 'trash', title: 'Trash Talk',
    text: '{rival} posted that you are "a backmarker with a good haircut". The clip is everywhere.',
    choices: [
      { label: 'Fire back online', fx: { fans: 60, morale: 5, rep: -3, flag: 'rivalHeat' }, result: 'The internet loves it. {rival} does not.' },
      { label: 'Let the racing talk', fx: { rep: 5, stats: { foc: 1 } }, result: 'You stay quiet. Respect earned.' }
    ]
  },
  {
    id: 'mechanic', title: 'Late-Night Tune',
    text: 'A veteran mechanic offers to stay late and squeeze extra power out of your machine — for a fee.',
    cond: s => s.money >= 200,
    choices: [
      { label: 'Pay for the tune', fx: { moneyPct: -0.12, moneyMin: 200, buff: { type: 'machine', value: 0.12, races: 1 } }, result: 'It sounds angrier already. +machine for the next race.' },
      { label: 'No thanks', fx: {}, result: 'You save the money.' }
    ]
  },
  {
    id: 'exam', title: 'Big Exam',
    text: 'You have a big school exam the same week. Your parents are not thrilled about racing right now.',
    cond: s => s.driver.age < 18,
    choices: [
      { label: 'Study hard', fx: { energy: -10, stats: { foc: 2 }, morale: -3 }, result: 'Passed. Your concentration is sharper.' },
      { label: 'Skip study, go practise', fx: { stats: { spd: 1 }, morale: -8, rep: -2 }, result: 'Faster on track. Grounded at home.' }
    ]
  },
  {
    id: 'interview', title: 'Newspaper Interview',
    text: 'A reporter asks what you expect from this weekend.',
    choices: [
      { label: '"I am going to win it."', fx: { flag: 'boldWin', fans: 20 }, result: 'Bold. Now you have to back it up (win to cash in).' },
      { label: '"One step at a time."', fx: { rep: 4 }, result: 'Humble and professional.' },
      { label: '"Ask {rival} how slow they are."', fx: { fans: 40, rep: -4, flag: 'rivalHeat' }, result: 'The headline writes itself.' }
    ]
  },
  {
    id: 'rain', title: 'Wet Track Day',
    text: 'It is pouring at the practice track. Nobody else showed up.',
    choices: [
      { label: 'Practise in the wet', fx: { energy: -15, stats: { hnd: 2 } }, result: 'Car control improved massively.' },
      { label: 'Go home', fx: { energy: 5 }, result: 'Warm and dry.' }
    ]
  },
  {
    id: 'job', title: 'Money Is Tight',
    text: 'Racing is expensive. A local garage offers you weekend work.',
    cond: s => s.tier <= 2 && s.money < 1500,
    choices: [
      { label: 'Take the shifts', fx: { money: 450, energy: -15, stats: { foc: 1 } }, result: 'Grease under the nails, cash in the pocket.' },
      { label: 'Focus on racing', fx: { morale: 3 }, result: 'All in on the dream.' }
    ]
  },
  {
    id: 'scout', title: 'Scout in the Paddock',
    text: 'Word is a scout from a top team will be watching this weekend.',
    choices: [
      { label: 'Extra prep session', fx: { energy: -10, flag: 'scout', stats: { rc: 1 } }, result: 'Podium this weekend and they will remember you.' },
      { label: 'Treat it like any race', fx: { flag: 'scout', morale: 4 }, result: 'Podium this weekend and they will remember you.' }
    ]
  },
  {
    id: 'engine', title: 'Strange Noise',
    text: 'Your engine made a horrible noise at the end of practice.',
    choices: [
      { label: 'Full rebuild', fx: { moneyPct: -0.1, moneyMin: 150 }, result: 'Good as new.' },
      { label: 'Risk it', fx: { buff: { type: 'machine', value: -0.1, races: 1 }, morale: -3 }, result: 'It will probably hold... (−machine next race)' }
    ]
  },
  {
    id: 'viral', title: 'Viral Moment',
    text: 'An onboard clip of your last race just hit a million views.',
    choices: [
      { label: 'Ride the wave', fx: { fans: 150, energy: -10 }, result: 'New followers pour in.' },
      { label: 'Stay focused', fx: { fans: 50, stats: { foc: 1 } }, result: 'Nice, but there is work to do.' }
    ]
  },
  {
    id: 'charity', title: 'Charity Kart Day',
    text: 'A children\'s hospital is hosting a charity kart day and asked for you.',
    choices: [
      { label: 'Of course', fx: { fans: 80, rep: 8, morale: 10, energy: -15 }, result: 'Best day of the year.' },
      { label: 'Too busy', fx: { rep: -3 }, result: 'Maybe next time.' }
    ]
  },
  {
    id: 'telemetry', title: 'Leaked Data',
    text: 'Someone offers you {rival}\'s telemetry on a USB stick.',
    choices: [
      { label: 'Use it', fx: { stats: { rc: 2, hnd: 1 }, rep: -12 }, result: 'Useful data. People are whispering though.' },
      { label: 'Report it', fx: { rep: 10, morale: 2 }, result: 'Integrity intact. Even {rival} nods at you.' }
    ]
  },
  {
    id: 'coachtip', title: 'Coach\'s Focus',
    text: 'Your coach wants to spend the week on one thing.',
    choices: [
      { label: 'Braking points', fx: { stats: { hnd: 2 }, energy: -8 }, result: 'You brake later and harder.' },
      { label: 'Launches', fx: { stats: { acc: 2 }, energy: -8 }, result: 'Rocket starts incoming.' }
    ]
  },
  {
    id: 'wrist', title: 'Sore Wrist',
    text: 'Your wrist is aching after a big crash in practice.',
    choices: [
      { label: 'Rest it', fx: { energy: 15, stats: { fit: -1 } }, result: 'It feels better, but you lost a little conditioning.' },
      { label: 'Tape it and push on', fx: { buff: { type: 'perf', value: -0.02, races: 1 }, morale: 5 }, result: 'Tough. Slightly slower this weekend.' }
    ]
  },
  {
    id: 'usedparts', title: 'Garage Sale',
    text: 'A retiring racer is selling high-end parts cheap.',
    cond: s => s.tier <= 2 && s.money >= 400,
    choices: [
      { label: 'Buy them ($400)', fx: { money: -400, kartUp: 1 }, result: 'Free upgrade level on a random part!' },
      { label: 'Pass', fx: {}, result: 'Maybe they were junk anyway.' }
    ]
  },
  {
    id: 'teamorders', title: 'Team Orders',
    text: 'Your team boss wants you to let your teammate past if you are running behind them this weekend.',
    cond: s => s.tier >= 3,
    choices: [
      { label: 'Agree', fx: { rep: 6, money: 0, teamRel: 10 }, result: 'The team appreciates a team player.' },
      { label: 'Refuse', fx: { fans: 60, rep: -4, teamRel: -10, morale: 5 }, result: 'Fans love the fire. The team boss does not.' }
    ]
  },
  {
    id: 'docu', title: 'Documentary Crew',
    text: 'A streaming documentary wants to follow you this season.',
    cond: s => s.tier >= 2,
    choices: [
      { label: 'Sign up', fx: { fans: 200, money: 800, energy: -10, morale: -3 }, result: 'Cameras everywhere. Fame rising.' },
      { label: 'Keep it private', fx: { morale: 5, stats: { foc: 1 } }, result: 'Peace and quiet.' }
    ]
  },
  {
    id: 'rivaltalk', title: 'Unexpected Visitor',
    text: '{rival} finds you in the paddock: "Whatever happens this year — may the best driver win."',
    choices: [
      { label: 'Shake hands', fx: { rep: 6, morale: 6 }, result: 'Respect between rivals.' },
      { label: '"It will be me."', fx: { fans: 30, flag: 'rivalHeat' }, result: '{rival} smirks. Game on.' }
    ]
  }
];
