// Kroniky Říše – herní logika. Počítá se jen v lokálních souřadnicích mapy (1 políčko = 1),
// takže stejně funguje na PC, ve VR i v MR. Žádná grafika – jen stav, události a rozkazy.
import {
  MAP_W, MAP_H, TEAM, UNITS, BUILDINGS, UPGRADES, ABILITIES, HERO_AURA, HERO_XP, HERO_REVIVE, GATHER, START_RES, FOOD_MAX, MAP, DIFFICULTY,
} from './config.js';
import { PathFinder } from './pathfind.js';
import { EnemyAI } from './ai.js';

const W = MAP_W, H = MAP_H;
const B_FREE = 0, B_TREE = 1, B_BUILD = 2, B_MINE = 3, B_ROCK = 4;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const armorFactor = (a) => (a >= 0 ? 1 - (a * 0.06) / (1 + a * 0.06) : 2 - Math.pow(0.94, -a));

export class Game {
  constructor(opts = {}) {
    this.diffKey = opts.difficulty || 'normal';
    this.diff = DIFFICULTY[this.diffKey];
    this.test = !!opts.test;
    this.time = 0;
    this.speed = 1;
    this.over = null; // 'win' | 'lose'
    this.nextId = 1;
    this.ents = new Map();
    this.units = [];
    this.buildings = [];
    this.mines = [];
    this.trees = [];
    this.projectiles = [];
    this.events = [];
    this.messages = [];
    this.block = new Uint8Array(W * H);
    this.occ = new Int32Array(W * H).fill(0); // id budovy/dolu na políčku
    this.treeAt = new Int32Array(W * H).fill(-1);
    this.blockVer = 1;
    this.pf = new PathFinder(W, H, this.block);
    this.vis = new Uint8Array(W * H); // hráčova viditelnost: 0 neprozkoumáno, 1 prozkoumáno, 2 vidět
    this.visDirty = true;
    this.visT = 0;
    this.res = [{ ...START_RES }, { ...START_RES }, { gold: 0, wood: 0 }];
    if (this.test) this.res[0] = { gold: 99999, wood: 99999 };
    this.stats = { trained: 0, killed: 0, lost: 0, gold: 0, wood: 0 };
    this.camps = [];
    this.upg = [{ weapon: 0, armor: 0, bow: 0 }, { weapon: 0, armor: 0, bow: 0 }, { weapon: 0, armor: 0, bow: 0 }];
    this.pathBudget = 0;
    this.buildMap();
    this.ai = new EnemyAI(this, TEAM.ENEMY, this.diff);
    this.updateVisibility();
  }

  // ------------------------------------------------------------------ mapa
  buildMap() {
    const r = rng(1234);
    const reserved = new Uint8Array(W * H); // místa, kde nesmí růst les (základny, cesty)
    const reserve = (x0, z0, w, h, pad = 0) => {
      for (let z = z0 - pad; z < z0 + h + pad; z++) for (let x = x0 - pad; x < x0 + w + pad; x++) if (x >= 0 && z >= 0 && x < W && z < H) reserved[z * W + x] = 1;
    };
    for (const s of MAP.start) { reserve(s.th[0], s.th[1], 4, 4, 5); reserve(s.mine[0], s.mine[1], 3, 3, 2); }
    for (const m of MAP.mines) reserve(m[0], m[1], 3, 3, 2);
    for (const c of MAP.camps) reserve(c.at[0] - 2, c.at[1] - 2, 5, 5, 1);
    // skály
    for (const [x0, z0, w, h] of MAP.rocks) for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) {
      const i = z * W + x; this.block[i] = B_ROCK;
    }
    this.rocks = MAP.rocks.map(([x, z, w, h]) => ({ x, z, w, h }));
    // lesy (obdélníky s roztřepeným okrajem)
    const plant = (x, z) => {
      if (x < 0 || z < 0 || x >= W || z >= H) return;
      const i = z * W + x;
      if (reserved[i] || this.block[i]) return;
      this.block[i] = B_TREE;
      this.treeAt[i] = this.trees.length;
      this.trees.push({ i, x: x + 0.5, z: z + 0.5, wood: GATHER.woodPerTree, alive: true, s: 0.8 + r() * 0.45, rot: r() * 6.28, v: (r() * 3) | 0 });
    };
    const forest = ([x0, z0, w, h]) => {
      for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || z === z0 || x === x0 + w - 1 || z === z0 + h - 1;
        if (edge && r() < 0.35) continue;
        plant(x, z);
      }
    };
    for (const f of MAP.forests) forest(f);
    for (const s of MAP.start) for (const f of s.trees) forest(f);
    // okraj mapy lemovaný stromy (ať mapa nekončí „ve vzduchu“)
    for (let k = 0; k < W; k++) { if (r() < 0.7) plant(k, 0); if (r() < 0.7) plant(k, H - 1); if (r() < 0.7) plant(0, k); if (r() < 0.7) plant(W - 1, k); }
    // doly
    MAP.start.forEach((s) => this.addMine(s.mine[0], s.mine[1], GATHER.goldPerMine));
    for (const m of MAP.mines) this.addMine(m[0], m[1], GATHER.goldPerMineExp);
    // základny
    MAP.start.forEach((s, team) => {
      const th = this.addBuilding('townhall', team, s.th[0], s.th[1], true);
      // 5 dělníků kolem radnice, rovnou těží
      const mine = this.nearestMine(th.cx, th.cz);
      for (let k = 0; k < 5; k++) {
        const p = this.pf.nearestFree(th.x - 1 + (k % 3) * 2, th.z + (team === 0 ? -1 : th.h), 3) || [th.x, th.z - 1];
        const u = this.spawnUnit('worker', team, p[0] + 0.5, p[1] + 0.5);
        if (mine) this.order(u, { type: 'gather', target: mine.id });
      }
    });
    // tábory divočiny
    MAP.camps.forEach((c, ci) => {
      const camp = { id: ci, x: c.at[0] + 0.5, z: c.at[1] + 0.5, units: [], treasure: c.treasure || 0, cleared: false };
      c.units.forEach((t, k) => {
        const a = (k / c.units.length) * Math.PI * 2;
        const p = this.pf.nearestFree(c.at[0] + Math.cos(a) * 1.3, c.at[1] + Math.sin(a) * 1.3, 3);
        const u = this.spawnUnit(t, TEAM.NEUTRAL, p[0] + 0.5, p[1] + 0.5);
        u.camp = camp; u.home = { x: u.x, z: u.z };
        u.facing = Math.atan2(camp.x - u.x, camp.z - u.z) + Math.PI;
        camp.units.push(u.id);
      });
      this.camps.push(camp);
    });
  }
  addMine(x, z, gold) {
    const m = { id: this.nextId++, kind: 'mine', x, z, w: 3, h: 3, cx: x + 1.5, cz: z + 1.5, gold, max: gold, inside: 0 };
    for (let zz = z; zz < z + 3; zz++) for (let xx = x; xx < x + 3; xx++) { this.block[zz * W + xx] = B_MINE; this.occ[zz * W + xx] = m.id; }
    this.ents.set(m.id, m);
    this.mines.push(m);
    return m;
  }

  // ------------------------------------------------------------------ entity
  spawnUnit(type, team, x, z) {
    const d = UNITS[type];
    const u = {
      id: this.nextId++, kind: 'unit', type, team, x, z, facing: team === 0 ? Math.PI : 0, hp: d.hp, maxHp: d.hp, def: d,
      order: { type: 'idle' }, path: null, cool: Math.random() * 0.5, carry: null, moving: false, anim: 0, atkAnim: 0,
      slow: 0, hidden: false, dead: false, deathT: 0, stuckT: 0, lastX: x, lastZ: z, scanT: Math.random() * 0.3, born: this.time,
    };
    if (d.hero) {
      u.level = 1; u.xp = 0; u.mana = d.mana * 0.6; u.maxMana = d.mana; u.cds = {};
      u.name = team === 0 ? 'Strážce Aldren' : 'Náčelník Vargoš';
      this.heroOf = this.heroOf || {};
      this.heroOf[team] = u.id;
    }
    this.ents.set(u.id, u);
    this.units.push(u);
    return u;
  }
  addBuilding(type, team, x, z, done = false) {
    const d = BUILDINGS[type];
    const b = {
      id: this.nextId++, kind: 'building', type, team, def: d, x, z, w: d.w, h: d.h, cx: x + d.w / 2, cz: z + d.h / 2,
      hp: done ? d.hp : d.hp * 0.1, maxHp: d.hp, done, progress: done ? 1 : 0, queue: [], qt: 0, cool: 0, rally: null, dead: false, builders: 0,
    };
    for (let zz = z; zz < z + d.h; zz++) for (let xx = x; xx < x + d.w; xx++) { this.block[zz * W + xx] = B_BUILD; this.occ[zz * W + xx] = b.id; }
    this.ents.set(b.id, b);
    this.buildings.push(b);
    this.visDirty = true;
    this.blockVer++;
    this.pushUnitsOut(b);
    return b;
  }
  /** Jednotky stojící v nové budově odsuneme ven. */
  pushUnitsOut(b) {
    for (const u of this.units) {
      if (u.dead || u.hidden) continue;
      if (u.x > b.x - 0.2 && u.x < b.x + b.w + 0.2 && u.z > b.z - 0.2 && u.z < b.z + b.h + 0.2) {
        const p = this.pf.nearestFree(u.x, u.z, 6);
        if (p) { u.x = p[0] + 0.5; u.z = p[1] + 0.5; u.path = null; }
      }
    }
  }
  get(id) { const e = this.ents.get(id); return e && !e.dead ? e : null; }
  hero(team) { const id = this.heroOf?.[team]; const h = id && this.ents.get(id); return h && !h.dead ? h : null; }

  food(team) {
    let used = 0, cap = 0;
    for (const u of this.units) if (u.team === team && !u.dead) used += u.def.food || 0;
    for (const b of this.buildings) {
      if (b.team !== team || b.dead) continue;
      if (b.done) cap += b.def.food || 0;
      for (const q of b.queue) used += (q.type && UNITS[q.type]?.food) || 0;
    }
    return { used, cap: Math.min(FOOD_MAX, cap) };
  }
  canAfford(team, cost) { const r = this.res[team]; return r.gold >= (cost.gold || 0) && r.wood >= (cost.wood || 0); }
  pay(team, cost, sign = 1) { const r = this.res[team]; r.gold -= (cost.gold || 0) * sign; r.wood -= (cost.wood || 0) * sign; }
  hasBuilding(team, type, done = true) { return this.buildings.some((b) => !b.dead && b.team === team && b.type === type && (!done || b.done)); }
  /** Proč nejde budovu postavit (text), nebo null. */
  buildBlocker(team, type) {
    const d = BUILDINGS[type];
    if (d.requires && !this.hasBuilding(team, d.requires)) return `Nejdřív postav: ${BUILDINGS[d.requires].name}`;
    if (!this.canAfford(team, d.cost)) return 'Nedostatek surovin';
    return null;
  }
  trainBlocker(b, type) {
    const d = UNITS[type];
    if (!b.done) return 'Budova se ještě staví';
    if (d.hero) {
      if (this.hero(b.team)) return 'Hrdina už žije';
      if (this.buildings.some((o) => o.team === b.team && o.queue.some((q) => q.type && UNITS[q.type].hero))) return 'Hrdina se už povolává';
    }
    if (b.queue.length >= 5) return 'Fronta je plná';
    const f = this.food(b.team);
    if (f.used + d.food > f.cap) return 'Málo jídla – postav farmu';
    const cost = this.heroCost(b.team, type);
    if (!this.canAfford(b.team, cost)) return 'Nedostatek surovin';
    return null;
  }
  heroCost(team, type) {
    const d = UNITS[type];
    if (d.hero && this.heroOf?.[team]) return { gold: HERO_REVIVE.gold, wood: 0 }; // oživení
    return d.cost;
  }
  train(b, type) {
    const why = this.trainBlocker(b, type);
    if (why) { this.msg(b.team, why, 'deny'); return false; }
    const cost = this.heroCost(b.team, type);
    this.pay(b.team, cost);
    const revive = UNITS[type].hero && this.heroOf?.[b.team];
    b.queue.push({ type, t: 0, total: this.test && b.team === 0 ? 1.5 : revive ? HERO_REVIVE.time : UNITS[type].time, cost });
    this.event('queue', b);
    return true;
  }
  /** Úroveň vylepšení včetně rozpracovaných (aby nešlo zkoumat dvakrát totéž). */
  upgLevel(team, key, pending = true) {
    let l = this.upg[team][key];
    if (pending) for (const b of this.buildings) if (b.team === team && !b.dead) l += b.queue.filter((q) => q.research === key).length;
    return l;
  }
  researchBlocker(b, key) {
    const U = UPGRADES[key];
    if (!b.done) return 'Budova se ještě staví';
    const l = this.upgLevel(b.team, key);
    if (l >= U.max) return 'Už vylepšeno na maximum';
    if (b.queue.length >= 5) return 'Fronta je plná';
    if (!this.canAfford(b.team, U.cost[l])) return 'Nedostatek surovin';
    return null;
  }
  research(b, key) {
    const why = this.researchBlocker(b, key);
    if (why) { this.msg(b.team, why, 'deny'); return false; }
    const U = UPGRADES[key], l = this.upgLevel(b.team, key);
    this.pay(b.team, U.cost[l]);
    b.queue.push({ research: key, type: null, t: 0, total: this.test && b.team === 0 ? 1.5 : U.time[l], cost: U.cost[l] });
    this.event('queue', b);
    return true;
  }
  cancelTrain(b, idx = -1) {
    const i = idx < 0 ? b.queue.length - 1 : idx;
    const q = b.queue[i];
    if (!q) return;
    b.queue.splice(i, 1);
    this.pay(b.team, q.cost, -1);
  }
  /** Dá se na (x, z) položit budova typu? */
  canPlace(type, x, z, team = 0) {
    const d = BUILDINGS[type];
    if (x < 1 || z < 1 || x + d.w > W - 1 || z + d.h > H - 1) return false;
    for (let zz = z; zz < z + d.h; zz++) for (let xx = x; xx < x + d.w; xx++) {
      const i = zz * W + xx;
      if (this.block[i]) return false;
      if (team === 0 && this.vis[i] === 0) return false;
    }
    // cizí jednotky v cestě
    for (const u of this.units) {
      if (u.dead || u.hidden || u.team === team) continue;
      if (u.x > x - 0.3 && u.x < x + d.w + 0.3 && u.z > z - 0.3 && u.z < z + d.h + 0.3) return false;
    }
    // radnice ne těsně u dolu (ať jde k dolu dojít)
    for (const m of this.mines) {
      if (x < m.x + m.w + 2 && x + d.w > m.x - 2 && z < m.z + m.h + 2 && z + d.h > m.z - 2) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ rozkazy
  order(u, o, queued = false) {
    if (!u || u.dead) return;
    if (u.building && o.type !== 'build') this.leaveSite(u);
    if (u.hidden && u.inMine) { u.pendingOrder = o; return; } // ještě v dole – rozkaz platí po vyjití
    u.order = { ...o, t0: this.time };
    u.path = null;
    u.engage = null;
    u.gatherState = null;
    if (o.type === 'gather') {
      const t = this.ents.get(o.target);
      if (t?.kind === 'mine') u.gatherState = 'toMine';
      else u.gatherState = 'toTree';
    }
    if (o.type === 'amove' || o.type === 'move') u.order.ox = u.x, u.order.oz = u.z;
  }
  leaveSite(u) {
    const b = this.ents.get(u.building);
    if (b) b.builders = Math.max(0, b.builders - 1);
    u.building = null;
  }
  /** Chytrý rozkaz (pravé tlačítko / štípnutí na mapu): podle cíle pohyb, útok, těžba, stavba, sběr. */
  smartOrder(ids, x, z, target, { attackMove = false } = {}) {
    const units = ids.map((id) => this.get(id)).filter((u) => u && u.kind === 'unit' && u.team === TEAM.PLAYER);
    const bld = ids.map((id) => this.get(id)).filter((b) => b && b.kind === 'building' && b.team === TEAM.PLAYER);
    if (!units.length) {
      // budovy: shromaždiště
      for (const b of bld) if (b.def.trains) b.rally = { x, z, target: target?.id || null };
      if (bld.length) this.event('rally', { x, z, team: 0 });
      return bld.length ? 'rally' : null;
    }
    let kind = 'move';
    if (target && !target.dead) {
      if (target.kind === 'mine' || target.kind === 'tree') kind = 'gather';
      else if (target.team !== TEAM.PLAYER) kind = 'attack';
      else if (target.kind === 'building' && !target.done) kind = 'repair';
      else if (target.kind === 'building' && target.def.dropoff) kind = 'return';
      else kind = 'follow';
    }
    if (attackMove && kind === 'move') kind = 'amove';
    // formace pro pohyb
    const slots = kind === 'move' || kind === 'amove' || kind === 'follow' ? this.formation(units, x, z) : null;
    units.forEach((u, k) => {
      const worker = !!u.def.worker;
      if (kind === 'gather' && worker) {
        if (target.kind === 'tree') this.order(u, { type: 'gather', target: -1, tree: target.idx, tx: target.x, tz: target.z });
        else this.order(u, { type: 'gather', target: target.id });
      } else if (kind === 'repair' && worker) this.order(u, { type: 'build', target: target.id });
      else if (kind === 'return' && worker && u.carry) { this.order(u, { type: 'gather', target: u.lastRes ?? -1, tree: u.lastTree, tx: u.lastTx, tz: u.lastTz }); u.gatherState = 'toDrop'; u.dropTo = target.id; }
      else if (kind === 'attack') this.order(u, { type: 'attack', target: target.id, forced: true });
      else if (kind === 'follow' && target.kind === 'unit') this.order(u, { type: 'follow', target: target.id });
      else {
        const s = slots ? slots.get(u.id) : [x, z];
        this.order(u, { type: kind === 'amove' ? 'amove' : 'move', x: s[0], z: s[1] });
      }
    });
    this.event('order', { x, z, kind, team: 0, unit: units[0] });
    return kind;
  }
  formation(units, x, z) {
    const n = units.length;
    const out = new Map();
    if (n === 1) { out.set(units[0].id, [x, z]); return out; }
    // střed skupiny → směr pochodu; sloty v řadách kolmo na směr
    let cx = 0, cz = 0;
    for (const u of units) { cx += u.x; cz += u.z; }
    cx /= n; cz /= n;
    let fx = x - cx, fz = z - cz;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    const rx = -fz, rz = fx;
    const cols = Math.ceil(Math.sqrt(n * 1.6));
    const sp = 0.95;
    const slots = [];
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / cols), col = k % cols;
      const inRow = Math.min(cols, n - row * cols);
      const off = (col - (inRow - 1) / 2) * sp;
      slots.push([x + rx * off - fx * row * sp, z + rz * off - fz * row * sp]);
    }
    // přiřazení: jednotky vpředu → přední řada (podle projekce na směr), v řadě podle strany
    const us = units.slice().sort((a, b) => ((b.x - cx) * fx + (b.z - cz) * fz) - ((a.x - cx) * fx + (a.z - cz) * fz));
    for (let row = 0; row * cols < n; row++) {
      const part = us.slice(row * cols, row * cols + cols).sort((a, b) => ((a.x * rx + a.z * rz) - (b.x * rx + b.z * rz)));
      part.forEach((u, c) => {
        let s = slots[row * cols + c];
        if (!this.pf.free(Math.floor(s[0]), Math.floor(s[1]))) { const p = this.pf.nearestFree(s[0], s[1], 4); if (p) s = [p[0] + 0.5, p[1] + 0.5]; }
        out.set(u.id, s);
      });
    }
    return out;
  }
  /**
   * Formace podle nakreslené čáry (body mapy): jednotky se rozestaví rovnoměrně podél čáry, čelem kolmo od místa,
   * odkud přicházejí. Když je čára krátká, stojí ve více řadách za sebou.
   */
  orderLine(ids, pts, team = TEAM.PLAYER) {
    const units = ids.map((id) => this.get(id)).filter((u) => u && u.kind === 'unit' && u.team === team);
    if (!units.length || !pts || pts.length < 2) return false;
    const seg = [];
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d < 1e-4) continue;
      seg.push({ a: pts[i - 1], b: pts[i], d, L0: L });
      L += d;
    }
    if (L < 0.6 || !seg.length) return false;
    const at = (s) => {
      let k = seg.findIndex((q) => s <= q.L0 + q.d);
      if (k < 0) k = seg.length - 1;
      const q = seg[k], t = Math.max(0, Math.min(1, (s - q.L0) / q.d));
      return [q.a[0] + (q.b[0] - q.a[0]) * t, q.a[1] + (q.b[1] - q.a[1]) * t];
    };
    const p0 = pts[0], p1 = pts[pts.length - 1];
    let dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    let nx = -dz, nz = dx;
    // čelem pryč od místa, odkud jednotky přicházejí
    let cx = 0, cz = 0;
    for (const u of units) { cx += u.x; cz += u.z; }
    cx /= units.length; cz /= units.length;
    const mid = at(L / 2);
    if ((cx - mid[0]) * nx + (cz - mid[1]) * nz > 0) { nx = -nx; nz = -nz; }
    const face = Math.atan2(nx, nz);
    const sp = 0.9;
    const n = units.length;
    const perRow = Math.max(1, Math.min(n, Math.floor(L / sp) + 1));
    const rows = Math.ceil(n / perRow);
    // přední řada = jednotky nejblíž čáře (nejvíc „vepředu“), v řadě podle pořadí podél čáry
    const byFront = units.slice().sort((a, b) => (b.x * nx + b.z * nz) - (a.x * nx + a.z * nz));
    for (let r = 0; r < rows; r++) {
      const row = byFront.slice(r * perRow, r * perRow + perRow).sort((a, b) => (a.x * dx + a.z * dz) - (b.x * dx + b.z * dz));
      const cnt = row.length;
      row.forEach((u, k) => {
        const s = cnt === 1 ? L / 2 : (k / (cnt - 1)) * L;
        let [x, z] = at(s);
        x -= nx * r * sp; z -= nz * r * sp;
        if (!this.pf.free(Math.floor(x), Math.floor(z))) { const p = this.pf.nearestFree(x, z, 4); if (p) { x = p[0] + 0.5; z = p[1] + 0.5; } }
        this.order(u, { type: 'move', x, z, face });
      });
    }
    this.event('order', { x: mid[0], z: mid[1], kind: 'move', team, unit: units[0] });
    return true;
  }
  /** Dělník(ci) postaví budovu. Suroviny se strhnou hned, při zrušení se vrátí. */
  orderBuild(ids, type, x, z, team = TEAM.PLAYER) {
    const d = BUILDINGS[type];
    const why = this.buildBlocker(team, type);
    if (why) { this.msg(team, why, 'deny'); return false; }
    if (!this.canPlace(type, x, z, team)) { this.msg(team, 'Tady se stavět nedá', 'deny'); return false; }
    const workers = ids.map((id) => this.get(id)).filter((u) => u && u.def.worker && u.team === team);
    if (!workers.length) return false;
    // nejbližší dělník jde stavět, ostatní pomáhají
    workers.sort((a, b) => dist2(a.x, a.z, x + d.w / 2, z + d.h / 2) - dist2(b.x, b.z, x + d.w / 2, z + d.h / 2));
    this.pay(team, d.cost);
    const site = { type, x, z, team, cost: d.cost, id: 'site' + this.nextId++ };
    (this.sites = this.sites || []).push(site);
    workers.forEach((u) => this.order(u, { type: 'build', site }));
    this.event('order', { x: x + d.w / 2, z: z + d.h / 2, kind: 'build', team, unit: workers[0] });
    return true;
  }
  cancelSite(site) {
    if (site.placed) return;
    this.sites = this.sites.filter((s) => s !== site);
    this.pay(site.team, site.cost, -1);
  }
  cancelBuilding(b) {
    // zrušení rozestavěné budovy: vrátí 75 % surovin
    if (b.done || b.dead) return;
    this.pay(b.team, { gold: Math.floor(b.def.cost.gold * 0.75), wood: Math.floor(b.def.cost.wood * 0.75) }, -1);
    this.destroy(b, null, true);
  }
  castAbility(hero, ab, x, z, target) {
    const A = ABILITIES[ab];
    if (!hero || hero.dead || !A) return false;
    if ((hero.cds[ab] || 0) > 0) { this.msg(hero.team, 'Schopnost se ještě nabíjí', 'deny'); return false; }
    if (hero.mana < A.mana) { this.msg(hero.team, 'Málo many', 'deny'); return false; }
    if (A.target === 'ally' && (!target || target.kind !== 'unit' || target.team !== hero.team)) { this.msg(hero.team, 'Vyber spojeneckou jednotku', 'deny'); return false; }
    this.order(hero, { type: 'cast', ab, x, z, target: target?.id });
    return true;
  }

  // ------------------------------------------------------------------ hlavní smyčka
  update(dtReal) {
    if (this.over) return;
    let dt = Math.min(0.1, dtReal) * this.speed;
    while (dt > 1e-4) {
      const s = Math.min(0.05, dt);
      this.step(s);
      dt -= s;
    }
  }
  step(dt) {
    this.time += dt;
    this.pathBudget = 14;
    // kolik jednotek na blízko už útočí na daný cíl (ať se útočníci rozloží a nečekají v tlačenici)
    const at = this.attackers || (this.attackers = new Map());
    at.clear();
    for (const u of this.units) {
      if (u.dead || u.def.range > 1) continue;
      const id = u.engage || (u.order.type === 'attack' ? u.order.target : 0);
      if (id) at.set(id, (at.get(id) || 0) + 1);
    }
    for (const u of this.units) if (!u.dead) this.updateUnit(u, dt);
    this.separate(dt);
    for (const b of this.buildings) if (!b.dead) this.updateBuilding(b, dt);
    this.updateProjectiles(dt);
    this.updateCorpses(dt);
    this.ai.update(dt);
    this.visT -= dt;
    if (this.visT <= 0 || this.visDirty) { this.visT = 0.2; this.updateVisibility(); }
    this.checkEnd();
  }

  // ------------------------------------------------------------------ jednotky
  enemyOf(a, b) { return a !== b; }
  isHostile(u, e) {
    if (!e || e.dead || e.kind === 'mine' || e.team === u.team) return false;
    if (e.hidden) return false;
    return true;
  }
  armorOf(u) {
    let a = u.def.armor || 0;
    if (u.kind === 'unit') {
      if (u.def.hero) a += Math.floor((u.level - 1) * 0.7);
      if (u.team < 2) a += this.upg[u.team].armor;
      const h = this.hero(u.team);
      if (h && dist2(h.x, h.z, u.x, u.z) < HERO_AURA.radius * HERO_AURA.radius) a += HERO_AURA.armor;
    }
    return a;
  }
  dmgOf(u) {
    let d = u.def.dmg;
    if (u.def.hero) d += (u.level - 1) * 5;
    if (u.team < 2) d += (u.def.projectile ? this.upg[u.team].bow : this.upg[u.team].weapon) * 3;
    return d * (0.85 + Math.random() * 0.3);
  }
  radiusOf(e) { return e.kind === 'unit' ? e.def.size : Math.max(e.w, e.h) / 2; }
  /** Vzdálenost okraj–okraj mezi jednotkou a cílem (budovy jako obdélník). */
  gap(u, e) {
    if (e.kind === 'unit') return Math.hypot(u.x - e.x, u.z - e.z) - u.def.size - e.def.size;
    const px = Math.max(e.x, Math.min(u.x, e.x + e.w)), pz = Math.max(e.z, Math.min(u.z, e.z + e.h));
    return Math.hypot(u.x - px, u.z - pz) - u.def.size - 0.35; // rezerva: rohová políčka
  }
  findTarget(u, range) {
    let best = null, bd = range * range;
    const r2 = range * range;
    const melee = u.def.range <= 1, at = this.attackers;
    for (const e of this.units) {
      if (!this.isHostile(u, e)) continue;
      if (e.team === TEAM.NEUTRAL && u.team !== TEAM.NEUTRAL && u.order.type !== 'amove' && !u.order.forced && u.order.type !== 'attack') {
        // neutrály jednotky samy nenapadají, jen když jsou samy napadeny (nebo útočný pochod)
        if (!e.aggro) continue;
      }
      const d0 = dist2(u.x, u.z, e.x, e.z);
      if (d0 >= r2) continue;
      let d = d0;
      // rozložení útočníků na blízko (ať nečekají v tlačenici) + přednost zraněným (dorazit)
      let sc = Math.sqrt(d0) - (1 - e.hp / e.maxHp) * 1.5;
      if (melee && at) { const n = at.get(e.id) || 0; if (n > 1 && u.engage !== e.id) sc += (n - 1) * 0.6; }
      d = Math.max(0, sc) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    if (u.team === TEAM.NEUTRAL) return null;
    for (const b of this.buildings) {
      if (!this.isHostile(u, b)) continue;
      const g = this.gap(u, b);
      if (g * g < bd) { bd = g * g; best = b; }
    }
    return best;
  }
  moveTo(u, x, z, dt, goals = null, arrive = 0.15) {
    // (pře)plánování cesty
    const need = !u.path || u.pathGoal == null || (goals ? u.pathKey !== goals.key : dist2(u.pathGoal[0], u.pathGoal[1], x, z) > 0.8);
    if (need || (u.repathT -= dt) < 0 && u.stuckT > 0.8) {
      if (this.pathBudget <= 0 && u.path) { /* příště */ } else if (this.pathBudget > 0) {
        this.pathBudget--;
        let gl;
        if (goals) gl = goals.tiles;
        else {
          const p = this.pf.nearestFree(x, z, 8);
          gl = p ? [p[1] * W + p[0]] : [];
        }
        const r = this.pf.find(u.x, u.z, gl);
        u.path = r ? r.pts : [];
        u.reach = r ? r.reached : false;
        // konec přesně na cílovém bodě (když je volný)
        if (!goals && u.path.length && r.reached && this.pf.free(Math.floor(x), Math.floor(z))) u.path[u.path.length - 1] = [x, z];
        if (!goals && !u.path.length && this.pf.free(Math.floor(x), Math.floor(z))) u.path = [[x, z]];
        u.pathGoal = [x, z];
        u.pathKey = goals?.key;
        u.repathT = 1.5;
        u.stuckT = 0;
      } else return false;
    }
    if (!u.path.length) { u.moving = false; return true; }
    const [tx, tz] = u.path[0];
    const dx = tx - u.x, dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    const sp = u.def.speed * (u.slow > 0 ? 0.5 : 1) * dt;
    if (d <= Math.max(sp, u.path.length === 1 ? arrive : 0.12)) {
      if (d <= sp) { u.x = tx; u.z = tz; }
      u.path.shift();
      if (!u.path.length) { u.moving = false; return true; }
    } else {
      u.x += (dx / d) * sp; u.z += (dz / d) * sp;
      this.turn(u, Math.atan2(dx, dz), dt);
    }
    u.moving = true;
    return false;
  }
  turn(u, a, dt) {
    let da = a - u.facing;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    u.facing += Math.sign(da) * Math.min(Math.abs(da), dt * 10);
  }
  rectGoals(e) {
    if (e._gv === this.blockVer && e._goals) return e._goals;
    e._gv = this.blockVer;
    e._goals = { tiles: this.pf.ringTiles(e.x, e.z, e.w, e.h), key: 'r' + e.id };
    return e._goals;
  }
  updateUnit(u, dt) {
    u.cool -= dt;
    u.atkAnim = Math.max(0, u.atkAnim - dt * 3);
    if (u.slow > 0) u.slow -= dt;
    if (u.def.hero) {
      u.mana = Math.min(u.maxMana, u.mana + u.def.manaRegen * dt);
      for (const k in u.cds) u.cds[k] = Math.max(0, u.cds[k] - dt);
    }
    // uvíznutí
    const mv = Math.abs(u.x - u.lastX) + Math.abs(u.z - u.lastZ);
    if (u.moving && mv < u.def.speed * dt * 0.25) u.stuckT += dt; else u.stuckT = Math.max(0, u.stuckT - dt * 2);
    u.lastX = u.x; u.lastZ = u.z;
    u.moving = false;
    if (u.hidden) { this.updateInMine(u, dt); return; }
    const o = u.order;
    switch (o.type) {
      case 'idle': this.doIdle(u, dt); break;
      case 'hold': this.doIdle(u, dt, true); break;
      case 'move': if (this.moveTo(u, o.x, o.z, dt)) { if (o.face != null) u.facing = o.face; u.order = { type: 'idle' }; } break;
      case 'follow': {
        const t = this.get(o.target);
        if (!t) { u.order = { type: 'idle' }; break; }
        if (Math.hypot(t.x - u.x, t.z - u.z) > 1.8) this.moveTo(u, t.x, t.z, dt);
        break;
      }
      case 'amove': this.doAttackMove(u, dt); break;
      case 'attack': this.doAttack(u, dt); break;
      case 'gather': this.doGather(u, dt); break;
      case 'build': this.doBuild(u, dt); break;
      case 'cast': this.doCast(u, dt); break;
      default: u.order = { type: 'idle' };
    }
    u.anim += dt * (u.moving ? u.def.speed * 2.2 : 0.8);
  }
  doIdle(u, dt, hold = false) {
    if (u.def.worker) return;
    u.scanT -= dt;
    if (u.scanT > 0 && !u.engage) return;
    u.scanT = 0.35;
    // neutrální: bránit tábor, vracet se domů
    if (u.team === TEAM.NEUTRAL) {
      const t = u.engage && this.get(u.engage);
      const far = dist2(u.x, u.z, u.home.x, u.home.z) > 64;
      if (t && !far && this.isHostile(u, t)) { this.engage(u, t, dt, hold); return; }
      u.engage = null;
      const e = this.findTarget(u, u.def.sight);
      if (e && dist2(e.x, e.z, u.home.x, u.home.z) < 49) { u.engage = e.id; this.alertCamp(u.camp, e); return; }
      if (dist2(u.x, u.z, u.home.x, u.home.z) > 0.3) { this.moveTo(u, u.home.x, u.home.z, dt); if (far) u.hp = Math.min(u.maxHp, u.hp + dt * 40); }
      return;
    }
    let t = u.engage && this.get(u.engage);
    if (t && this.gap(u, t) > u.def.range + 0.3) {
      // cíl mimo dosah (třeba zablokovaný v tlačenici) → vezmi nejbližšího
      const e = this.findTarget(u, 7);
      if (e && e !== t && this.gap(u, e) + 0.6 < this.gap(u, t)) { t = e; u.engage = e.id; u.path = null; }
    }
    if (t && this.isHostile(u, t) && (!hold || this.gap(u, t) <= u.def.range + 0.1)) {
      // pronásleduj max. 10 polí od místa, kde jsi stál
      if (!u.guard) u.guard = { x: u.x, z: u.z };
      if (dist2(u.x, u.z, u.guard.x, u.guard.z) < 100) { this.engage(u, t, dt, hold); return; }
    }
    u.engage = null;
    const e = this.findTarget(u, Math.min(u.def.sight, hold ? u.def.range + 1 : 7));
    if (e) { u.engage = e.id; if (!u.guard) u.guard = { x: u.x, z: u.z }; this.engage(u, e, dt, hold); return; }
    if (u.guard && !hold) {
      if (dist2(u.x, u.z, u.guard.x, u.guard.z) > 1.5) { if (this.moveTo(u, u.guard.x, u.guard.z, dt)) u.guard = null; } else u.guard = null;
    }
  }
  alertCamp(camp, e) {
    if (!camp) return;
    for (const id of camp.units) { const c = this.get(id); if (c && !c.engage) c.engage = e.id; }
  }
  /** Přiblíž se a útoč. Vrací true, když cíl padl. */
  engage(u, t, dt, hold = false) {
    const g = this.gap(u, t);
    const rng = u.def.range;
    if (g <= rng + 0.05) {
      u.path = null;
      this.turn(u, Math.atan2(t.x + (t.w ? t.w / 2 : 0) - u.x, t.z + (t.h ? t.h / 2 : 0) - u.z), dt);
      if (u.cool <= 0) {
        u.cool = u.def.cd;
        u.atkAnim = 1; u.atkStart = this.time; u.castAnim = false;
        if (u.def.projectile) this.fire(u, t);
        else this.damage(t, this.dmgOf(u), u);
        this.event('attack', u);
      }
      return false;
    }
    if (hold) return false;
    if (t.kind === 'unit') this.moveTo(u, t.x, t.z, dt, null, rng);
    else this.moveTo(u, t.cx, t.cz, dt, this.rectGoals(t));
    return false;
  }
  doAttack(u, dt) {
    const t = this.get(u.order.target);
    if (!t || t.team === u.team || t.hidden || t.kind === 'mine') { u.order = { type: 'idle' }; u.guard = null; return; }
    if (t.team === TEAM.NEUTRAL) { t.aggro = true; this.alertCamp(t.camp, u); }
    if (u.def.worker && !u.def.dmg) { u.order = { type: 'idle' }; return; }
    this.engage(u, t, dt);
  }
  doAttackMove(u, dt) {
    const o = u.order;
    u.scanT -= dt;
    let t = u.engage && this.get(u.engage);
    if (t && (!this.isHostile(u, t) || this.gap(u, t) > 12)) { t = null; u.engage = null; }
    if (u.scanT <= 0) {
      u.scanT = 0.3;
      const e = this.findTarget(u, 7);
      // přednost mají jednotky blíž než aktuální cíl (nebo když cíl je budova)
      if (e && (!t || (t.kind === 'building' && e.kind === 'unit') || (this.gap(u, t) > u.def.range + 0.3 && this.gap(u, e) + 0.6 < this.gap(u, t)))) { u.engage = e.id; t = e; u.path = null; }
    }
    if (t) {
      if (t.team === TEAM.NEUTRAL) { t.aggro = true; this.alertCamp(t.camp, u); }
      this.engage(u, t, dt);
      return;
    }
    if (u.def.worker) { if (this.moveTo(u, o.x, o.z, dt)) u.order = { type: 'idle' }; return; }
    if (this.moveTo(u, o.x, o.z, dt)) u.order = { type: 'idle' };
  }
  doCast(u, dt) {
    const o = u.order, A = ABILITIES[o.ab];
    let tx = o.x, tz = o.z;
    const t = o.target != null ? this.get(o.target) : null;
    if (A.target === 'ally') { if (!t) { u.order = { type: 'idle' }; return; } tx = t.x; tz = t.z; }
    const d = Math.hypot(tx - u.x, tz - u.z);
    if (d > A.range) { this.moveTo(u, tx, tz, dt, null, A.range * 0.9); return; }
    u.path = null;
    this.turn(u, Math.atan2(tx - u.x, tz - u.z), dt);
    if ((u.cds[o.ab] || 0) > 0 || u.mana < A.mana) { u.order = { type: 'idle' }; return; }
    u.mana -= A.mana;
    u.cds[o.ab] = A.cd;
    u.atkAnim = 1; u.atkStart = this.time; u.castAnim = true;
    const amt = A.amount(u.level);
    if (o.ab === 'heal') {
      t.hp = Math.min(t.maxHp, t.hp + amt);
      this.event('heal', { x: t.x, z: t.z, team: u.team, target: t });
    } else if (o.ab === 'thunder') {
      const r2 = A.radius * A.radius;
      for (const e of this.units) {
        if (e.dead || e.team === u.team || e.hidden) continue;
        if (dist2(e.x, e.z, tx, tz) <= r2) { this.damage(e, amt, u, true); e.slow = 3; if (e.team === TEAM.NEUTRAL) { e.aggro = true; this.alertCamp(e.camp, u); } }
      }
      for (const b of this.buildings) if (!b.dead && b.team !== u.team && dist2(b.cx, b.cz, tx, tz) <= r2 + 2) this.damage(b, amt * 0.5, u, true);
      this.event('thunder', { x: tx, z: tz, team: u.team, r: A.radius });
    }
    u.order = { type: 'idle' };
  }

  // ---- těžba
  nearestMine(x, z) {
    let best = null, bd = 1e9;
    for (const m of this.mines) { if (m.gold <= 0) continue; const d = dist2(x, z, m.cx, m.cz); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  nearestDrop(team, x, z) {
    let best = null, bd = 1e9;
    for (const b of this.buildings) {
      if (b.dead || b.team !== team || !b.done || !b.def.dropoff) continue;
      const d = dist2(x, z, b.cx, b.cz);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  nearestTree(x, z, maxD = 20) {
    let best = -1, bd = maxD * maxD;
    for (let k = 0; k < this.trees.length; k++) {
      const t = this.trees[k];
      if (!t.alive) continue;
      const d = dist2(x, z, t.x, t.z);
      if (d >= bd) continue;
      // musí mít volné políčko vedle sebe
      const tx = Math.floor(t.x), tz = Math.floor(t.z);
      if (!(this.pf.free(tx + 1, tz) || this.pf.free(tx - 1, tz) || this.pf.free(tx, tz + 1) || this.pf.free(tx, tz - 1))) continue;
      bd = d; best = k;
    }
    return best;
  }
  treeGoals(k) {
    const t = this.trees[k];
    if (t._gv === this.blockVer && t._goals) return t._goals;
    t._gv = this.blockVer;
    t._goals = { tiles: this.pf.ringTiles(Math.floor(t.x), Math.floor(t.z), 1, 1), key: 't' + k };
    return t._goals;
  }
  doGather(u, dt) {
    const o = u.order;
    const mult = u.team === TEAM.ENEMY ? this.diff.gather : 1;
    if (u.gatherState === 'toDrop') {
      const drop = (u.dropTo && this.get(u.dropTo)) || this.nearestDrop(u.team, u.x, u.z);
      if (!drop) { u.order = { type: 'idle' }; return; }
      if (this.gap(u, drop) < 0.45) {
        if (u.carry) {
          this.res[u.team][u.carry.res] += u.carry.amt;
          if (u.team === 0) this.stats[u.carry.res] += u.carry.amt;
          this.event('deposit', { x: u.x, z: u.z, team: u.team, res: u.carry.res, amt: u.carry.amt });
          u.carry = null;
        }
        u.dropTo = null;
        u.gatherState = o.target > 0 ? 'toMine' : 'toTree';
        u.path = null;
        return;
      }
      this.moveTo(u, drop.cx, drop.cz, dt, this.rectGoals(drop));
      return;
    }
    if (u.gatherState === 'toMine') {
      let m = this.get(o.target);
      if (!m || m.gold <= 0) { m = this.nearestMine(u.x, u.z); if (!m || dist2(m.cx, m.cz, u.x, u.z) > 400) { u.order = { type: 'idle' }; return; } o.target = m.id; }
      u.lastRes = m.id;
      if (u.carry && u.carry.res === 'gold') { u.gatherState = 'toDrop'; return; }
      if (this.gap(u, m) < 0.45) {
        u.hidden = true; u.inMine = m.id; u.mineT = GATHER.mineTime / mult; m.inside++;
        u.carry = null;
        return;
      }
      this.moveTo(u, m.cx, m.cz, dt, this.rectGoals(m));
      return;
    }
    if (u.gatherState === 'toTree' || u.gatherState === 'chop') {
      if (u.carry && u.carry.res === 'gold') { u.gatherState = 'toDrop'; return; }
      let k = o.tree;
      if (k == null || !this.trees[k]?.alive) {
        k = this.nearestTree(o.tx ?? u.x, o.tz ?? u.z) ;
        if (k < 0) k = this.nearestTree(u.x, u.z, 40);
        if (k < 0) { u.order = { type: 'idle' }; return; }
        o.tree = k; u.path = null;
      }
      const t = this.trees[k];
      o.tx = t.x; o.tz = t.z;
      u.lastTree = k; u.lastTx = t.x; u.lastTz = t.z; u.lastRes = -1;
      const d = Math.max(Math.abs(u.x - t.x), Math.abs(u.z - t.z));
      if (d < 1.15) {
        u.gatherState = 'chop';
        this.turn(u, Math.atan2(t.x - u.x, t.z - u.z), dt);
        u.chopT = (u.chopT || 0) + dt * mult;
        if (u.chopT >= GATHER.chopTime) {
          u.chopT = 0;
          u.atkAnim = 1; if (this.time - (u.atkStart ?? -9) > 1.1) { u.atkStart = this.time; u.castAnim = false; }
          if (!u.carry || u.carry.res !== 'wood') u.carry = { res: 'wood', amt: 0 };
          u.carry.amt++;
          t.wood--;
          if (Math.random() < 0.3) this.event('chop', u);
          if (t.wood <= 0) this.fellTree(k);
          if (u.carry.amt >= GATHER.woodPerTrip) { u.gatherState = 'toDrop'; u.path = null; }
        }
        return;
      }
      u.gatherState = 'toTree';
      this.moveTo(u, t.x, t.z, dt, this.treeGoals(k));
    }
  }
  updateInMine(u, dt) {
    u.mineT -= dt;
    if (u.mineT > 0) return;
    const m = this.ents.get(u.inMine);
    u.hidden = false;
    if (m) {
      m.inside = Math.max(0, m.inside - 1);
      const amt = Math.min(GATHER.goldPerTrip, m.gold);
      m.gold -= amt;
      if (amt > 0) u.carry = { res: 'gold', amt };
      if (m.gold <= 0) this.mineDepleted(m);
    }
    u.inMine = null;
    // vyjdi na straně k radnici
    const drop = this.nearestDrop(u.team, u.x, u.z);
    const tiles = m ? this.pf.ringTiles(m.x, m.z, m.w, m.h) : [];
    let best = null, bd = 1e9;
    for (const i of tiles) {
      const x = (i % W) + 0.5, z = ((i / W) | 0) + 0.5;
      const d = drop ? dist2(x, z, drop.cx, drop.cz) : 0;
      if (d < bd) { bd = d; best = [x, z]; }
    }
    if (best) { u.x = best[0]; u.z = best[1]; }
    u.gatherState = 'toDrop';
    u.path = null;
    if (u.pendingOrder) { const o = u.pendingOrder; u.pendingOrder = null; this.order(u, o); }
  }
  mineDepleted(m) {
    this.msg(TEAM.PLAYER, 'Zlatý důl je vytěžený', 'info');
    for (let zz = m.z; zz < m.z + m.h; zz++) for (let xx = m.x; xx < m.x + m.w; xx++) { this.block[zz * W + xx] = B_FREE; this.occ[zz * W + xx] = 0; }
    m.dead = true;
    this.mines = this.mines.filter((x) => x !== m);
    this.blockVer++;
    this.event('mineGone', m);
  }
  fellTree(k) {
    const t = this.trees[k];
    t.alive = false;
    this.block[t.i] = B_FREE;
    this.treeAt[t.i] = -1;
    this.treesDirty = true;
    this.blockVer++;
    this.event('treeFall', t);
  }

  // ---- stavění
  doBuild(u, dt) {
    const o = u.order;
    let b = o.target ? this.get(o.target) : null;
    if (!b && o.site) {
      const s = o.site;
      if (s.placed) { b = this.get(s.placed); if (!b) { u.order = { type: 'idle' }; return; } o.target = b.id; }
      else {
        if (!this.sites?.includes(s)) { u.order = { type: 'idle' }; return; }
        const d = BUILDINGS[s.type];
        const goals = { tiles: this.pf.ringTiles(s.x, s.z, d.w, d.h), key: s.id };
        const inside = u.x > s.x - 0.6 && u.x < s.x + d.w + 0.6 && u.z > s.z - 0.6 && u.z < s.z + d.h + 0.6;
        if (inside || (this.moveTo(u, s.x + d.w / 2, s.z + d.h / 2, dt, goals) && u.reach !== false)) {
          if (!this.canPlace(s.type, s.x, s.z, s.team) && !this.onlyOwnUnits(s)) {
            this.msg(u.team, 'Místo je zablokované – stavba zrušena', 'deny');
            this.cancelSite(s);
            u.order = { type: 'idle' };
            return;
          }
          this.sites = this.sites.filter((x) => x !== s);
          b = this.addBuilding(s.type, s.team, s.x, s.z, false);
          s.placed = b.id;
          o.target = b.id;
          this.event('placed', b);
        } else if (u.path && !u.path.length && u.reach === false) {
          this.msg(u.team, 'Na místo stavby se nedá dojít', 'deny');
          this.cancelSite(s);
          u.order = { type: 'idle' };
        }
        return;
      }
    }
    if (!b || b.done || b.team !== u.team) {
      u.order = { type: 'idle' };
      if (u.building) this.leaveSite(u);
      // po stavbě farmy/budovy se dělník vrátí k práci, pokud předtím těžil
      if (u.lastRes != null) {
        if (u.lastRes > 0 && this.get(u.lastRes)) this.order(u, { type: 'gather', target: u.lastRes });
        else if (u.lastTree != null) this.order(u, { type: 'gather', target: -1, tree: u.lastTree, tx: u.lastTx, tz: u.lastTz });
      }
      return;
    }
    if (this.gap(u, b) < 0.5) {
      if (!u.building) { u.building = b.id; b.builders++; }
      u.path = null;
      this.turn(u, Math.atan2(b.cx - u.x, b.cz - u.z), dt);
      if ((u.hammerT = (u.hammerT || 0) - dt) < 0) { u.hammerT = 0.5; u.atkAnim = 1; if (this.time - (u.atkStart ?? -9) > 1.1) { u.atkStart = this.time; u.castAnim = false; } if (Math.random() < 0.35) this.event('hammer', u); }
      return;
    }
    this.moveTo(u, b.cx, b.cz, dt, this.rectGoals(b));
  }
  onlyOwnUnits(s) {
    const d = BUILDINGS[s.type];
    for (let zz = s.z; zz < s.z + d.h; zz++) for (let xx = s.x; xx < s.x + d.w; xx++) if (this.block[zz * W + xx]) return false;
    for (const u of this.units) {
      if (u.dead || u.hidden || u.team === s.team) continue;
      if (u.x > s.x - 0.3 && u.x < s.x + d.w + 0.3 && u.z > s.z - 0.3 && u.z < s.z + d.h + 0.3) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ budovy
  updateBuilding(b, dt) {
    const d = b.def;
    if (!b.done) {
      if (b.builders > 0) {
        const rate = (this.test && b.team === 0 ? 8 : 1) * (1 + (b.builders - 1) * 0.6) / d.time;
        const before = b.progress;
        b.progress = Math.min(1, b.progress + rate * dt);
        b.hp = Math.min(b.maxHp, b.hp + (b.progress - before) * d.hp * 0.9);
        if (b.progress >= 1) {
          b.done = true;
          this.event('built', b);
          if (b.team === 0) this.msg(0, `Hotovo: ${d.name}`, 'good');
          this.visDirty = true;
          if (b.def.food) this.event('food', b);
        }
      }
      return;
    }
    // výcvik
    const q = b.queue[0];
    if (q) {
      q.t += dt;
      if (q.t >= q.total && q.research) {
        b.queue.shift();
        this.upg[b.team][q.research]++;
        if (b.team === 0) this.msg(0, `Vylepšeno: ${UPGRADES[q.research].name} ${this.upg[0][q.research]}/2`, 'good');
        this.event('upgrade', { team: b.team, key: q.research, x: b.cx, z: b.cz });
      } else if (q.t >= q.total) {
        const u = this.spawnFrom(b, q.type);
        b.queue.shift();
        if (u) {
          if (b.team === 0) { this.stats.trained++; this.msg(0, `${u.def.hero ? (this.heroRevived ? 'Hrdina se vrátil' : 'Hrdina přichází') : 'Připraven'}: ${u.def.hero ? u.name : u.def.name}`, 'good'); }
          this.event('trained', u);
        }
      }
    }
    // věž
    if (d.dmg) {
      b.cool -= dt;
      if (b.cool <= 0) {
        let best = null, bd = (d.range + 0.3) ** 2;
        for (const e of this.units) {
          if (e.dead || e.hidden || e.team === b.team) continue;
          if (e.team === TEAM.NEUTRAL && !e.aggro) continue;
          const dd = dist2(e.x, e.z, b.cx, b.cz);
          if (dd < bd) { bd = dd; best = e; }
        }
        if (best) { b.cool = d.cd; this.fire(b, best); this.event('attack', b); }
      }
    }
  }
  spawnFrom(b, type) {
    const d = UNITS[type];
    const rally = b.rally;
    // volné místo u budovy směrem ke shromaždišti
    const tiles = this.pf.ringTiles(b.x, b.z, b.w, b.h);
    let best = null, bd = 1e9;
    const tx = rally ? rally.x : b.cx, tz = rally ? rally.z : b.z + b.h + 3;
    for (const i of tiles) {
      const x = (i % W) + 0.5, z = ((i / W) | 0) + 0.5;
      const dd = dist2(x, z, tx, tz);
      if (dd < bd) { bd = dd; best = [x, z]; }
    }
    if (!best) { const p = this.pf.nearestFree(b.cx, b.z + b.h + 1, 8); if (!p) return null; best = [p[0] + 0.5, p[1] + 0.5]; }
    let u;
    if (d.hero && this.heroOf?.[b.team]) {
      // oživení: tentýž hrdina se stejnou úrovní
      u = this.ents.get(this.heroOf[b.team]);
      u.dead = false; u.hp = u.maxHp; u.mana = u.maxMana * 0.5; u.x = best[0]; u.z = best[1]; u.deathT = 0; u.order = { type: 'idle' }; u.path = null;
      this.corpses = (this.corpses || []).filter((c) => c !== u);
      this.units.push(u);
      this.heroRevived = true;
    } else u = this.spawnUnit(type, b.team, best[0], best[1]);
    u.facing = Math.atan2(best[0] - b.cx, best[1] - b.cz);
    if (rally) {
      const t = rally.target && this.get(rally.target);
      if (t && t.kind === 'mine' && u.def.worker) this.order(u, { type: 'gather', target: t.id });
      else if (rally.tree != null && u.def.worker) this.order(u, { type: 'gather', target: -1, tree: rally.tree, tx: rally.x, tz: rally.z });
      else this.order(u, { type: 'move', x: rally.x, z: rally.z });
    } else if (u.def.worker && b.team === 0) {
      // bez shromaždiště jde dělník rovnou těžit zlato (když je důl blízko)
      const m = this.nearestMine(u.x, u.z);
      if (m && dist2(m.cx, m.cz, u.x, u.z) < 144) this.order(u, { type: 'gather', target: m.id });
    }
    return u;
  }

  // ------------------------------------------------------------------ boj
  fire(from, t) {
    const y0 = from.kind === 'building' ? 2.2 : 0.6;
    const x0 = from.kind === 'building' ? from.cx : from.x, z0 = from.kind === 'building' ? from.cz : from.z;
    const dmg = from.kind === 'building' ? (from.def.dmg + this.upg[from.team].bow * 3) * (0.85 + Math.random() * 0.3) : this.dmgOf(from);
    this.projectiles.push({ x: x0, y: y0, z: z0, sx: x0, sz: z0, sy: y0, target: t.id, dmg, from: from.id, team: from.team, speed: 13, t: 0, dead: false });
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const t = this.get(p.target);
      if (!t) { p.dead = true; continue; }
      const tx = t.kind === 'unit' ? t.x : t.cx, tz = t.kind === 'unit' ? t.z : t.cz, ty = t.kind === 'unit' ? 0.45 : 0.9;
      const dx = tx - p.x, dy = ty - p.y, dz = tz - p.z;
      const d = Math.hypot(dx, dy, dz);
      const s = p.speed * dt;
      p.t += dt;
      if (d <= s + 0.15) {
        p.dead = true;
        this.damage(t, p.dmg, this.ents.get(p.from) || { team: p.team, id: p.from, kind: 'gone' });
        continue;
      }
      p.x += (dx / d) * s; p.z += (dz / d) * s;
      // oblouček
      const total = Math.hypot(tx - p.sx, tz - p.sz) || 1;
      const k = Math.min(1, Math.hypot(p.x - p.sx, p.z - p.sz) / total);
      p.y = p.sy + (ty - p.sy) * k + Math.sin(k * Math.PI) * Math.min(1.4, total * 0.12);
      p.dx = dx / d; p.dz = dz / d;
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }
  damage(t, amount, src, magic = false) {
    if (!t || t.dead) return;
    const a = magic ? 0 : this.armorOf(t);
    const dmg = amount * armorFactor(a);
    t.hp -= dmg;
    t.hitT = 0.25;
    if (t.team === 0 || src?.team === 0) this.lastCombat = this.time;
    if (t.team === TEAM.NEUTRAL && src && src.team !== TEAM.NEUTRAL) { t.aggro = true; if (!t.engage) t.engage = src.id; this.alertCamp(t.camp, src); }
    // bránit se: nečinná jednotka odpoví útočníkovi
    if (t.kind === 'unit' && src?.kind === 'unit' && !src.dead && t.order.type === 'idle' && !t.def.worker && !t.engage) t.engage = src.id;
    if (t.team === TEAM.PLAYER && src && src.team === TEAM.ENEMY) this.underAttack(t);
    if (t.team === TEAM.ENEMY && src) this.ai.onAttacked?.(t, src);
    this.event('hit', { x: t.kind === 'unit' ? t.x : t.cx, z: t.kind === 'unit' ? t.z : t.cz, team: t.team, target: t, magic });
    if (t.hp <= 0) this.destroy(t, src);
  }
  underAttack(t) {
    if (this.time - (this.lastAlert || -99) < 12) return;
    this.lastAlert = this.time;
    const x = t.kind === 'unit' ? t.x : t.cx, z = t.kind === 'unit' ? t.z : t.cz;
    this.msg(0, t.kind === 'building' ? 'Naše základna je pod útokem!' : 'Naše jednotky jsou pod útokem!', 'alert', { x, z });
  }
  destroy(e, src, silent = false) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    if (e.kind === 'unit') {
      e.deathT = 0;
      (this.corpses = this.corpses || []).push(e);
      this.units = this.units.filter((u) => u !== e);
      if (e.building) this.leaveSite(e);
      if (e.inMine) { const m = this.ents.get(e.inMine); if (m) m.inside--; }
      if (e.team === 0) this.stats.lost++;
      if (src && src.team === 0 && e.team !== 0) this.stats.killed++;
      // zkušenosti hrdinům v okolí
      for (const team of [0, 1]) {
        if (team === e.team) continue;
        const h = this.hero(team);
        if (h && dist2(h.x, h.z, e.x, e.z) < 12 * 12) this.giveXp(h, e.def.xp || (e.def.hero ? 100 + e.level * 50 : 10 + (e.def.food || 1) * 10));
      }
      if (e.def.bounty && src && src.team !== TEAM.NEUTRAL && src.team != null) {
        this.res[src.team].gold += e.def.bounty;
        this.event('bounty', { x: e.x, z: e.z, amt: e.def.bounty, team: src.team });
      }
      if (e.camp) this.checkCamp(e.camp, src);
      if (e.def.hero && e.team === 0) this.msg(0, 'Hrdina padl! Oživíš ho v Oltáři hrdinů.', 'alert');
      this.event('death', e);
    } else if (e.kind === 'building') {
      for (let zz = e.z; zz < e.z + e.h; zz++) for (let xx = e.x; xx < e.x + e.w; xx++) { this.block[zz * W + xx] = B_FREE; this.occ[zz * W + xx] = 0; }
      // vrátit peníze za frontu
      if (!silent) for (const q of e.queue) this.pay(e.team, q.cost, -1);
      e.queue = [];
      this.buildings = this.buildings.filter((b) => b !== e);
      this.blockVer++;
      (this.ruins = this.ruins || []).push({ x: e.cx, z: e.cz, w: e.w, h: e.h, t: 0, type: e.type, team: e.team });
      for (const u of this.units) if (u.building === e.id) this.leaveSite(u);
      if (!silent) this.event('collapse', e);
      this.visDirty = true;
    }
  }
  giveXp(h, xp) {
    h.xp += xp;
    while (h.level < HERO_XP.length && h.xp >= HERO_XP[h.level]) {
      h.level++;
      h.maxHp += 90; h.hp = Math.min(h.maxHp, h.hp + 250); h.maxMana += 25; h.mana = h.maxMana;
      this.event('levelup', h);
      if (h.team === 0) this.msg(0, `${h.name} dosáhl úrovně ${h.level}!`, 'good');
    }
  }
  checkCamp(camp, src) {
    if (camp.cleared) return;
    if (camp.units.some((id) => this.get(id))) return;
    camp.cleared = true;
    if (camp.treasure && src && src.team !== TEAM.NEUTRAL) {
      this.res[src.team].gold += camp.treasure;
      this.event('treasure', { x: camp.x, z: camp.z, team: src.team, amt: camp.treasure });
      if (src.team === 0) this.msg(0, `Poklad! +${camp.treasure} zlata`, 'good');
    }
  }
  updateCorpses(dt) {
    if (this.corpses) {
      for (const c of this.corpses) c.deathT += dt;
      this.corpses = this.corpses.filter((c) => c.deathT < 4 || (c.def.hero && c.deathT < 4));
    }
    if (this.ruins) { for (const r of this.ruins) r.t += dt; this.ruins = this.ruins.filter((r) => r.t < 30); }
  }
  separate() {
    // měkké odtlačování jednotek (prostorová mřížka 2×2)
    const cell = 2, cw = Math.ceil(W / cell);
    const grid = new Map();
    for (const u of this.units) {
      if (u.hidden) continue;
      const k = Math.floor(u.x / cell) + Math.floor(u.z / cell) * cw;
      let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u);
    }
    for (const u of this.units) {
      if (u.hidden) continue;
      const cx = Math.floor(u.x / cell), cz = Math.floor(u.z / cell);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const a = grid.get(cx + dx + (cz + dz) * cw);
        if (!a) continue;
        for (const v of a) {
          if (v.id <= u.id) continue;
          const rr = (u.def.size + v.def.size) * 0.95;
          const ddx = v.x - u.x, ddz = v.z - u.z;
          const d2 = ddx * ddx + ddz * ddz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.01;
          const push = (rr - d) * 0.5;
          const nx = d2 > 1e-6 ? ddx / d : Math.random() - 0.5, nz = d2 > 1e-6 ? ddz / d : Math.random() - 0.5;
          // stojící (a těžící) jednotky uhýbají víc než ty v pohybu; nepřátelé se odtlačují méně
          const wu = u.moving ? 0.3 : 1, wv = v.moving ? 0.3 : 1;
          const s = wu + wv;
          u.x -= nx * push * (wu / s) * 1.6; u.z -= nz * push * (wu / s) * 1.6;
          v.x += nx * push * (wv / s) * 1.6; v.z += nz * push * (wv / s) * 1.6;
        }
      }
    }
    // ven z překážek
    for (const u of this.units) {
      if (u.hidden) continue;
      u.x = Math.max(0.3, Math.min(W - 0.3, u.x)); u.z = Math.max(0.3, Math.min(H - 0.3, u.z));
      const tx = Math.floor(u.x), tz = Math.floor(u.z);
      if (!this.pf.free(tx, tz)) {
        const p = this.pf.nearestFree(u.x, u.z, 4);
        if (p) { const nx = p[0] + 0.5, nz = p[1] + 0.5; u.x += (nx - u.x) * 0.5; u.z += (nz - u.z) * 0.5; if (!this.pf.free(Math.floor(u.x), Math.floor(u.z))) { u.x = nx; u.z = nz; } }
      } else {
        // odtlač od hran sousedních překážek
        const r = u.def.size * 0.8;
        const fx = u.x - tx, fz = u.z - tz;
        if (fx < r && !this.pf.free(tx - 1, tz)) u.x = tx + r;
        if (fx > 1 - r && !this.pf.free(tx + 1, tz)) u.x = tx + 1 - r;
        if (fz < r && !this.pf.free(tx, tz - 1)) u.z = tz + r;
        if (fz > 1 - r && !this.pf.free(tx, tz + 1)) u.z = tz + 1 - r;
      }
    }
  }

  // ------------------------------------------------------------------ viditelnost (mlha války hráče)
  updateVisibility() {
    this.visDirty = false;
    const v = this.vis;
    for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
    if (this.revealAll) { v.fill(2); return; }
    const mark = (x, z, r) => {
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
      const z0 = Math.max(0, Math.floor(z - r)), z1 = Math.min(H - 1, Math.ceil(z + r));
      for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
        if (dist2(xx + 0.5, zz + 0.5, x, z) <= r2) v[zz * W + xx] = 2;
      }
    };
    for (const u of this.units) if (u.team === 0 && !u.dead) mark(u.x, u.z, u.def.sight);
    for (const b of this.buildings) if (b.team === 0 && !b.dead) mark(b.cx, b.cz, b.done ? b.def.sight : 3);
    this.visVersion = (this.visVersion || 0) + 1;
  }
  /** Vidí hráč bod / entitu? */
  visibleAt(x, z) {
    const xx = Math.floor(x), zz = Math.floor(z);
    if (xx < 0 || zz < 0 || xx >= W || zz >= H) return false;
    return this.vis[zz * W + xx] === 2;
  }
  exploredAt(x, z) {
    const xx = Math.floor(x), zz = Math.floor(z);
    if (xx < 0 || zz < 0 || xx >= W || zz >= H) return false;
    return this.vis[zz * W + xx] >= 1;
  }
  seen(e) {
    if (e.team === 0) return true;
    if (e.kind === 'unit') return !e.hidden && this.visibleAt(e.x, e.z);
    // budovy: stačí prozkoumaná místa
    for (let zz = e.z; zz < e.z + e.h; zz++) for (let xx = e.x; xx < e.x + e.w; xx++) if (this.vis[zz * W + xx] >= 1) return true;
    return false;
  }

  // ------------------------------------------------------------------ výběr / dotazy
  /** Entita pod bodem (x, z) mapy: jednotka (nejbližší v poloměru), budova, důl, strom. */
  pick(x, z, r = 0.55) {
    let best = null, bd = 1e9;
    for (const u of this.units) {
      if (u.hidden || u.dead || !this.seen(u)) continue;
      const rr = Math.max(r, u.def.size + 0.15);
      const d = dist2(u.x, u.z, x, z);
      if (d < rr * rr && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    const xx = Math.floor(x), zz = Math.floor(z);
    if (xx < 0 || zz < 0 || xx >= W || zz >= H) return null;
    const i = zz * W + xx;
    const id = this.occ[i];
    if (id) { const e = this.ents.get(id); if (e && !e.dead && (e.kind === 'mine' || this.seen(e))) return e; }
    if (this.treeAt[i] >= 0 && this.vis[i] >= 1) { const t = this.trees[this.treeAt[i]]; return { kind: 'tree', idx: this.treeAt[i], x: t.x, z: t.z, wood: t.wood, id: 'tree' + this.treeAt[i] }; }
    return null;
  }
  unitsInCircle(x, z, r, team = 0) {
    const r2 = r * r;
    return this.units.filter((u) => u.team === team && !u.hidden && !u.dead && dist2(u.x, u.z, x, z) <= (r + u.def.size) ** 2 && dist2(u.x, u.z, x, z) <= r2 + 1);
  }
  unitsInRect(x0, z0, x1, z1, team = 0) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    return this.units.filter((u) => u.team === team && !u.hidden && !u.dead && u.x >= ax - u.def.size && u.x <= bx + u.def.size && u.z >= az - u.def.size && u.z <= bz + u.def.size);
  }

  // ------------------------------------------------------------------ konec hry, zprávy
  checkEnd() {
    if ((this.endT = (this.endT || 0) - 0.05) > 0) return;
    this.endT = 1;
    const alive = (t) => this.buildings.some((b) => b.team === t && !b.dead);
    if (!alive(TEAM.PLAYER)) { this.over = 'lose'; this.event('end', { result: 'lose' }); }
    else if (!alive(TEAM.ENEMY)) { this.over = 'win'; this.event('end', { result: 'win' }); }
  }
  event(type, data) { this.events.push({ type, data, t: this.time }); if (this.events.length > 400) this.events.splice(0, 200); }
  msg(team, text, kind = 'info', at = null) {
    if (team !== TEAM.PLAYER) return;
    this.messages.push({ text, kind, t: this.time, at });
    if (this.messages.length > 6) this.messages.shift();
    this.event('msg', { text, kind, at });
  }
  /** Průměrná síla armády (součet ceny bojových jednotek). */
  armyValue(team) {
    let v = 0;
    for (const u of this.units) if (u.team === team && !u.def.worker && !u.dead) v += (u.def.cost?.gold || 0) + (u.def.cost?.wood || 0);
    return v;
  }
}
