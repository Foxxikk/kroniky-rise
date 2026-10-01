// Umělá inteligence soupeře (Klan Popela). Postupuje po krocích jako hráč: těží → staví → cvičí → útočí ve vlnách.
// Nečte mlhu války (vidí vše) – obtížnost ladí rychlost těžby, velikost a načasování vln.
import { UNITS, BUILDINGS, ABILITIES, TEAM, MAP_W } from './config.js';

const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;

export class EnemyAI {
  constructor(game, team, diff) {
    this.g = game; this.team = team; this.diff = diff;
    this.t = 2;
    this.wave = 0;
    this.attacking = false;
    this.attackStart = 0;
    this.creepT = 0;
    this.defendT = 0;
    this.trainToggle = 0;
  }
  base() { return this.g.buildings.find((b) => b.team === this.team && b.type === 'townhall' && !b.dead) || this.g.buildings.find((b) => b.team === this.team && !b.dead); }
  count(type, pending = true) {
    let n = this.g.buildings.filter((b) => b.team === this.team && b.type === type && !b.dead).length;
    if (pending) n += (this.g.sites || []).filter((s) => s.team === this.team && s.type === type).length;
    return n;
  }
  army() { return this.g.units.filter((u) => u.team === this.team && !u.def.worker && !u.dead); }
  workers() { return this.g.units.filter((u) => u.team === this.team && u.def.worker && !u.dead); }
  update(dt) {
    if (this.paused) return; // během výuky Klan Popela čeká
    this.defendT -= dt;
    this.t -= dt;
    this.heroTick(dt);
    if (this.t > 0) return;
    this.t = this.diff.think;
    const g = this.g, base = this.base();
    if (!base) { for (const u of this.army()) if (u.order.type === 'idle') this.attackNearest(u); return; }
    this.economy(base);
    this.construct(base);
    this.trainArmy();
    this.military(base);
  }
  economy(base) {
    const g = this.g;
    const ws = this.workers();
    let gold = 0, wood = 0;
    for (const u of ws) { if (u.order.type !== 'gather') continue; if (u.order.target > 0) gold++; else wood++; }
    const wantGold = 5, wantWood = g.time > 300 ? 6 : 4;
    for (const u of ws) {
      if (u.order.type !== 'idle' || u.hidden) continue;
      const m = g.nearestMine(base.cx, base.cz);
      if (gold < wantGold && m && dist2(m.cx, m.cz, base.cx, base.cz) < 200) { g.order(u, { type: 'gather', target: m.id }); gold++; }
      else { g.order(u, { type: 'gather', target: -1, tx: u.x, tz: u.z }); wood++; }
    }
    const th = g.buildings.find((b) => b.team === this.team && b.type === 'townhall' && b.done && !b.dead);
    if (th && th.queue.length < 1 && ws.length < wantGold + wantWood && !g.trainBlocker(th, 'worker')) g.train(th, 'worker');
  }
  construct(base) {
    const g = this.g, T = g.time;
    const f = g.food(this.team);
    const pendingFarm = (g.sites || []).some((s) => s.team === this.team && s.type === 'farm') || g.buildings.some((b) => b.team === this.team && b.type === 'farm' && !b.done);
    if (f.cap < 60 && f.used + 4 >= f.cap && !pendingFarm) { this.build('farm', base); return; }
    const plan = [
      ['barracks', 35, 1], ['altar', 80, 1], ['farm', 120, 2], ['tower', 200, 1], ['stable', 300, 1], ['barracks', 420, 2], ['tower', 480, 2],
    ];
    for (const [type, at, n] of plan) {
      if (T < at * (this.diff.think > 1 ? 1.3 : 1)) continue;
      if (this.count(type) >= n) continue;
      if (BUILDINGS[type].requires && !g.hasBuilding(this.team, BUILDINGS[type].requires)) continue;
      this.build(type, base);
      return;
    }
  }
  build(type, base) {
    const g = this.g, d = BUILDINGS[type];
    if (!g.canAfford(this.team, d.cost)) return false;
    const spot = this.findSpot(type, base);
    if (!spot) return false;
    // stavitel: dělník na dřevě (nebo kdokoli)
    const ws = this.workers().filter((u) => !u.hidden && u.order.type !== 'build');
    if (!ws.length) return false;
    ws.sort((a, b) => ((a.order.target > 0) - (b.order.target > 0)) || dist2(a.x, a.z, spot[0], spot[1]) - dist2(b.x, b.z, spot[0], spot[1]));
    return g.orderBuild([ws[0].id], type, spot[0], spot[1], this.team);
  }
  findSpot(type, base) {
    const g = this.g, d = BUILDINGS[type];
    const mine = g.nearestMine(base.cx, base.cz);
    // věže směrem ke středu mapy, ostatní kolem radnice
    const cx = type === 'tower' ? base.cx + (MAP_W / 2 - base.cx) * 0.25 : base.cx;
    const cz = type === 'tower' ? base.cz + (MAP_W / 2 - base.cz) * 0.25 : base.cz;
    const cand = [];
    for (let r = 3; r <= 13; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = Math.round(cx + dx - d.w / 2), z = Math.round(cz + dz - d.h / 2);
        if (!this.roomy(type, x, z)) continue;
        if (mine && dist2(x + d.w / 2, z + d.h / 2, mine.cx, mine.cz) < 22) continue;
        // nestavět do cesty mezi radnicí a dolem
        if (mine && this.segDist(x + d.w / 2, z + d.h / 2, base.cx, base.cz, mine.cx, mine.cz) < 2.8) continue;
        cand.push([x, z]);
      }
      if (cand.length) return cand[(Math.random() * Math.min(cand.length, 6)) | 0];
    }
    return null;
  }
  roomy(type, x, z) {
    const g = this.g, d = BUILDINGS[type];
    if (!g.canPlace(type, x, z, this.team)) return false;
    // okraj 1 políčko volný (ať se budovy neslepí a nezavřou cesty)
    for (let zz = z - 1; zz <= z + d.h; zz++) for (let xx = x - 1; xx <= x + d.w; xx++) {
      if (xx >= x && xx < x + d.w && zz >= z && zz < z + d.h) continue;
      if (!g.pf.free(xx, zz)) return false;
    }
    if ((g.sites || []).some((s) => { const e = BUILDINGS[s.type]; return x < s.x + e.w + 1 && x + d.w + 1 > s.x && z < s.z + e.h + 1 && z + d.h + 1 > s.z; })) return false;
    return true;
  }
  segDist(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(px - ax - vx * t, pz - az - vz * t);
  }
  trainArmy() {
    const g = this.g;
    const need = Math.round(this.diff.army * Math.pow(this.diff.waveGrow, this.wave));
    const capped = !this.attacking && this.army().length >= Math.ceil(need * 1.25);
    for (const b of g.buildings) {
      if (b.team !== this.team || !b.done || b.dead || !b.def.trains || b.type === 'townhall') continue;
      if (b.queue.length >= 1) continue;
      let type;
      if (b.type === 'altar') { if (!g.hero(this.team)) type = 'hero'; else continue; }
      else if (capped) continue;
      else if (b.type === 'stable') type = 'knight';
      else type = (this.trainToggle++ % 5) < 3 ? 'footman' : 'archer';
      // rezerva na farmu
      const d = UNITS[type];
      const r = g.res[this.team];
      if (type !== 'hero' && r.gold - (d.cost.gold || 0) < 60 && g.food(this.team).cap < 60) continue;
      if (!g.trainBlocker(b, type)) g.train(b, type);
    }
  }
  rally(base) {
    const cx = MAP_W / 2, cz = MAP_W / 2;
    const dx = cx - base.cx, dz = cz - base.cz, l = Math.hypot(dx, dz) || 1;
    const p = this.g.pf.nearestFree(base.cx + (dx / l) * 7, base.cz + (dz / l) * 7, 6);
    return p ? [p[0] + 0.5, p[1] + 0.5] : [base.cx, base.cz];
  }
  playerTarget(from) {
    const g = this.g;
    let best = null, bd = 1e9;
    for (const b of g.buildings) {
      if (b.team !== TEAM.PLAYER || b.dead) continue;
      const d = dist2(b.cx, b.cz, from[0], from[1]) * (b.type === 'tower' ? 1.4 : 1);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  attackNearest(u) {
    const t = this.playerTarget([u.x, u.z]);
    if (t) this.g.order(u, { type: 'amove', x: t.cx, z: t.cz });
  }
  military(base) {
    const g = this.g;
    const army = this.army();
    const rally = this.rally(base);
    if (this.defendT > 0) return;
    if (this.attacking) {
      const alive = army.filter((u) => u.attackWave === this.wave);
      if (alive.length <= Math.max(1, this.waveSize * 0.3)) {
        // ústup
        this.attacking = false;
        for (const u of alive) g.order(u, { type: 'move', x: rally[0], z: rally[1] });
        return;
      }
      for (const u of alive) {
        if (u.order.type === 'idle' || (u.order.type === 'amove' && !u.engage && Math.random() < 0.15)) {
          const t = this.playerTarget([u.x, u.z]);
          if (t) g.order(u, { type: 'amove', x: t.cx, z: t.cz });
        }
      }
      // posily se přidají
      for (const u of army) if (u.attackWave !== this.wave && u.order.type === 'idle' && g.time - u.born > 3) { u.attackWave = this.wave; this.attackNearest(u); }
      return;
    }
    // shromaždiště
    for (const u of army) if (u.order.type === 'idle' && dist2(u.x, u.z, rally[0], rally[1]) > 16 && !u.engage) g.order(u, { type: 'amove', x: rally[0] + (Math.random() - 0.5) * 3, z: rally[1] + (Math.random() - 0.5) * 3 });
    const need = Math.round(this.diff.army * Math.pow(this.diff.waveGrow, this.wave));
    if (g.time >= this.diff.firstWave && army.length >= need) {
      this.wave++;
      this.attacking = true;
      this.waveSize = army.length;
      const t = this.playerTarget(rally);
      if (!t) return;
      for (const u of army) { u.attackWave = this.wave; g.order(u, { type: 'amove', x: t.cx, z: t.cz }); }
      g.msg(TEAM.PLAYER, this.wave === 1 ? 'Klan Popela vyrazil do útoku!' : `Blíží se ${this.wave}. vlna Klanu Popela!`, 'alert', { x: rally[0], z: rally[1] });
      return;
    }
    // mezi vlnami: čištění táborů divočiny pro zkušenosti hrdiny
    const h = g.hero(this.team);
    if (h && army.length >= 4 && g.time > 150) {
      const camp = g.camps.filter((c) => !c.cleared && c.units.length && !c.treasure).sort((a, b) => dist2(a.x, a.z, base.cx, base.cz) - dist2(b.x, b.z, base.cx, base.cz))[0];
      if (camp && dist2(camp.x, camp.z, base.cx, base.cz) < 30 * 30 && !army.some((u) => u.order.type === 'amove' && u.order.creep)) {
        for (const u of army) g.order(u, { type: 'amove', x: camp.x, z: camp.z, creep: true });
      }
    }
  }
  onAttacked(t, src) {
    const g = this.g;
    if (!src || src.team !== TEAM.PLAYER || src.dead) return;
    const base = this.base();
    if (!base || this.defendT > 0) return;
    const x = src.x ?? src.cx, z = src.z ?? src.cz;
    if (dist2(x, z, base.cx, base.cz) > 16 * 16) return;
    this.defendT = 6;
    for (const u of this.army()) if (!u.attackWave || !this.attacking || dist2(u.x, u.z, base.cx, base.cz) < 20 * 20) g.order(u, { type: 'amove', x, z });
  }
  heroTick(dt) {
    const g = this.g, h = g.hero(this.team);
    if (!h || (this.heroT = (this.heroT || 0) - dt) > 0) return;
    this.heroT = 0.5;
    const heal = ABILITIES.heal, th = ABILITIES.thunder;
    if (h.mana >= heal.mana && !h.cds.heal) {
      let best = null, bh = 0.5;
      for (const u of g.units) {
        if (u.team !== this.team || u.dead || u.hidden) continue;
        const f = u.hp / u.maxHp;
        if (f < bh && dist2(u.x, u.z, h.x, h.z) < heal.range * heal.range) { bh = f; best = u; }
      }
      if (best) { g.castAbility(h, 'heal', best.x, best.z, best); return; }
    }
    if (h.mana >= th.mana && !h.cds.thunder) {
      let best = null, bn = 2;
      for (const e of g.units) {
        if (e.team === this.team || e.dead || e.hidden) continue;
        if (dist2(e.x, e.z, h.x, h.z) > th.range * th.range) continue;
        let n = 0;
        for (const o of g.units) if (o.team !== this.team && !o.dead && dist2(o.x, o.z, e.x, e.z) < th.radius * th.radius) n++;
        if (n > bn) { bn = n; best = e; }
      }
      if (best) g.castAbility(h, 'thunder', best.x, best.z, null);
    }
  }
}
