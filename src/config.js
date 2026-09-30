// Kroniky Říše – data hry (jednotky, budovy, mapa, obtížnost). Vše data-driven, logika v game.js.
// Souřadnice: 1 políčko = 1 jednotka, mapa W×H, x doprava, z „dolů“ (k hráči).

export const MAP_W = 48;
export const MAP_H = 48;

export const TEAM = { PLAYER: 0, ENEMY: 1, NEUTRAL: 2 };
export const TEAM_INFO = [
  { name: 'Aliance Svítání', color: '#3f74f0', dark: '#223f94', light: '#9ec0ff' },
  { name: 'Klan Popela', color: '#d8432f', dark: '#7c2016', light: '#ffab8f' },
  { name: 'Divočina', color: '#8a8f7a', dark: '#4d5245', light: '#cdd3bd' },
];

export const START_RES = { gold: 500, wood: 150 };
export const FOOD_MAX = 60;

// size = poloměr jednotky (políčka), speed = políčka/s, range = dosah útoku od okraje k okraji
export const UNITS = {
  worker: {
    name: 'Dělník', icon: '⛏', hp: 220, armor: 0, dmg: 5, cd: 1.3, range: 0.2, speed: 2.6, size: 0.3, sight: 6,
    cost: { gold: 75, wood: 0 }, food: 1, time: 12, hot: 'W', worker: true,
    desc: 'Těží zlato, kácí dřevo a staví budovy.',
  },
  footman: {
    name: 'Pěšák', icon: '🛡', hp: 420, armor: 2, dmg: 12, cd: 1.35, range: 0.2, speed: 2.7, size: 0.34, sight: 7,
    cost: { gold: 135, wood: 0 }, food: 2, time: 16, hot: 'P',
    desc: 'Odolný bojovník na blízko.',
  },
  archer: {
    name: 'Lučištník', icon: '🏹', hp: 290, armor: 0, dmg: 16, cd: 1.5, range: 5.5, speed: 2.7, size: 0.3, sight: 8,
    cost: { gold: 120, wood: 30 }, food: 2, time: 18, hot: 'L', projectile: 'arrow',
    desc: 'Střílí na dálku, i na letce.',
  },
  knight: {
    name: 'Rytíř', icon: '🐎', hp: 800, armor: 4, dmg: 26, cd: 1.4, range: 0.3, speed: 3.5, size: 0.45, sight: 7,
    cost: { gold: 245, wood: 60 }, food: 4, time: 26, hot: 'R',
    desc: 'Rychlá těžká jízda.',
  },
  hero: {
    name: 'Strážce', icon: '👑', hp: 700, armor: 3, dmg: 24, cd: 1.3, range: 0.3, speed: 3.0, size: 0.42, sight: 9,
    cost: { gold: 270, wood: 80 }, food: 5, time: 30, hot: 'H', hero: true, mana: 200, manaRegen: 1.2,
    desc: 'Hrdina – sílí s úrovní, léčí a drtí nepřátele.',
    abilities: ['heal', 'thunder'],
  },
  // neutrální obránci pokladů
  wolf: { name: 'Vlk', icon: '🐺', hp: 260, armor: 1, dmg: 11, cd: 1.1, range: 0.2, speed: 3.3, size: 0.32, sight: 5, creep: true, xp: 40, bounty: 18 },
  golem: { name: 'Kamenný strážce', icon: '🗿', hp: 1100, armor: 4, dmg: 34, cd: 1.8, range: 0.3, speed: 2.2, size: 0.55, sight: 5, creep: true, xp: 160, bounty: 90 },
};

export const ABILITIES = {
  heal: {
    name: 'Svaté světlo', icon: '✚', hot: 'Q', mana: 60, cd: 6, range: 8, target: 'ally',
    desc: (lvl) => `Vyléčí spojence o ${130 + lvl * 45} životů.`,
    amount: (lvl) => 130 + lvl * 45,
  },
  thunder: {
    name: 'Hromový úder', icon: '⚡', hot: 'E', mana: 80, cd: 11, range: 7, target: 'point', radius: 2.4,
    desc: (lvl) => `Úder do oblasti: ${80 + lvl * 35} poškození a zpomalení.`,
    amount: (lvl) => 80 + lvl * 35,
  },
};
// Aura hrdiny: spojenci v okolí mají +brnění.
export const HERO_AURA = { radius: 6, armor: 2 };
export const HERO_XP = [0, 180, 460, 850, 1350]; // práh úrovní 1..5
export const HERO_REVIVE = { gold: 200, time: 25 };

// w×h = rozměr v políčkách
export const BUILDINGS = {
  townhall: {
    name: 'Radnice', icon: '🏰', w: 4, h: 4, hp: 1600, armor: 4, cost: { gold: 385, wood: 185 }, time: 60, food: 12, sight: 9,
    trains: ['worker'], dropoff: true, hot: 'T', desc: 'Srdce říše. Cvičí dělníky, sem se nosí suroviny.',
  },
  farm: {
    name: 'Farma', icon: '🌾', w: 2, h: 2, hp: 500, armor: 1, cost: { gold: 80, wood: 20 }, time: 18, food: 8, sight: 4,
    hot: 'F', desc: '+8 jídla (limit armády).',
  },
  barracks: {
    name: 'Kasárna', icon: '⚔', w: 3, h: 3, hp: 1100, armor: 3, cost: { gold: 160, wood: 60 }, time: 38, sight: 6,
    trains: ['footman', 'archer'], hot: 'K', desc: 'Cvičí pěšáky a lučištníky.',
  },
  altar: {
    name: 'Oltář hrdinů', icon: '✦', w: 3, h: 3, hp: 900, armor: 3, cost: { gold: 180, wood: 50 }, time: 34, sight: 6,
    trains: ['hero'], hot: 'O', desc: 'Povolá hrdinu (a oživí ho).',
  },
  stable: {
    name: 'Rytířská síň', icon: '🐴', w: 3, h: 3, hp: 1000, armor: 3, cost: { gold: 200, wood: 120 }, time: 45, sight: 6,
    trains: ['knight'], requires: 'barracks', hot: 'N', desc: 'Cvičí rytíře. Vyžaduje kasárna.',
  },
  tower: {
    name: 'Strážní věž', icon: '🗼', w: 2, h: 2, hp: 700, armor: 5, cost: { gold: 110, wood: 70 }, time: 30, sight: 9,
    dmg: 16, cd: 1.1, range: 6.5, projectile: 'arrow', hot: 'V', desc: 'Sama střílí na nepřátele.',
  },
};
export const BUILD_ORDER = ['farm', 'barracks', 'altar', 'tower', 'stable', 'townhall'];

export const GATHER = {
  goldPerTrip: 10, mineTime: 3.5, woodPerTrip: 10, chopTime: 0.65, woodPerTree: 40, goldPerMine: 7000, goldPerMineExp: 5000,
};

export const DIFFICULTY = {
  easy: { name: 'Lehká', gather: 0.8, firstWave: 600, waveGrow: 1.25, army: 5, think: 1.6 },
  normal: { name: 'Střední', gather: 1.0, firstWave: 450, waveGrow: 1.35, army: 7, think: 1.0 },
  hard: { name: 'Těžká', gather: 1.3, firstWave: 330, waveGrow: 1.45, army: 9, think: 0.7 },
};

// ------------------------------------------------------------ mapa „Rozcestí dvou řek“ (vlastní)
// Hráč vlevo dole, soupeř vpravo nahoře, uprostřed a v rozích tábory divočiny s poklady/doly.
export const MAP = {
  name: 'Údolí Rozcestí',
  start: [
    { th: [7, 36], mine: [2, 30], trees: [[0, 42, 10, 6], [12, 44, 10, 4]] },
    { th: [37, 8], mine: [43, 14], trees: [[38, 0, 10, 6], [26, 0, 10, 4]] },
  ],
  mines: [[8, 7, 'exp'], [37, 37, 'exp']],
  camps: [
    { at: [11, 11], units: ['wolf', 'wolf', 'wolf'] },
    { at: [36, 36], units: ['wolf', 'wolf', 'wolf'] },
    { at: [24, 24], units: ['golem', 'wolf', 'wolf'], treasure: 250 },
  ],
  rocks: [[18, 18, 3, 2], [27, 28, 3, 2], [15, 30, 2, 3], [31, 15, 2, 3], [22, 10, 2, 2], [24, 36, 2, 2]],
  forests: [
    [0, 0, 6, 20], [0, 0, 20, 5], [42, 28, 6, 20], [28, 43, 20, 5],
    [14, 14, 4, 3], [30, 31, 4, 3], [20, 26, 3, 3], [25, 19, 3, 3], [4, 20, 5, 4], [39, 24, 5, 4],
    [19, 40, 4, 3], [25, 5, 4, 3],
  ],
};
