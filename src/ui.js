// UI: data „velitelské karty“ (sdílená pro PC i VR), canvas panely pro VR a DOM rozhraní pro PC.
import * as THREE from 'three';
import { UNITS, BUILDINGS, ABILITIES, BUILD_ORDER, TEAM_INFO, HERO_XP } from './config.js';

const FONT = 'Nunito, "Segoe UI", system-ui, sans-serif';
export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const costText = (c) => [c.gold ? `${c.gold}🪙` : '', c.wood ? `${c.wood}🪵` : ''].filter(Boolean).join(' ');

/** VR tlačítka navíc: velitelský pohled a skok k poplachu. */
function xrExtras(app, btn) {
  if (!app.xr) return;
  btn({ id: 'battle', icon: app.battle ? '🗺' : '👁', label: app.battle ? 'Zpět ke stolu' : 'Do bitvy', desc: app.battle ? 'Vrátí tě k válečnému stolu.' : 'Staneš přímo na bojišti mezi svými jednotkami (sleduje hrdinu).', action: () => app.toggleBattle() });
  if (app.recentAlert()) btn({ id: 'alert', icon: '⚠', label: 'K poplachu', desc: app.battle ? 'Přenese tě k místu útoku.' : 'Přiblíží místo útoku na stole.', action: () => app.jumpToAlert() });
}
/** Co ukázat na velitelské kartě podle výběru. */
export function buildCard(app) {
  const g = app.game;
  const sel = app.selectedEnts();
  const card = { title: '', sub: '', rows: [], buttons: [], info: null, portrait: null };
  const btn = (b) => card.buttons.push(b);
  const own = sel.filter((e) => e.team === 0);
  if (!sel.length) {
    card.title = 'Nic nevybráno';
    card.sub = app.xr ? 'Štípni jednotku, nebo táhni štětcem přes armádu' : 'Klikni na jednotku nebo táhni obdélník';
    btn({ id: 'selArmy', icon: '⚔', label: 'Celá armáda', hot: 'F2', action: () => app.selectAll('army') });
    btn({ id: 'selIdle', icon: '💤', label: 'Nečinní dělníci', hot: 'F1', action: () => app.selectAll('idleWorkers') });
    btn({ id: 'selHero', icon: '👑', label: 'Hrdina', hot: 'F3', action: () => app.selectAll('hero'), disabled: !g.hero(0) });
    btn({ id: 'selTh', icon: '🏰', label: 'Radnice', hot: 'F4', action: () => app.selectAll('townhall') });
    xrExtras(app, btn);
    return card;
  }
  if (!own.length) {
    const e = sel[0];
    if (e.kind === 'mine') { card.title = 'Zlatý důl'; card.sub = `Zbývá ${Math.round(e.gold)} zlata`; card.portrait = { icon: '⛰', hp: e.gold / e.max, color: '#ffd84a' }; }
    else if (e.kind === 'tree') { card.title = 'Strom'; card.sub = `${e.wood} dřeva – pošli dělníky`; card.portrait = { icon: '🌲' }; }
    else {
      const d = e.def;
      card.title = e.def.hero ? e.name : d.name;
      card.sub = `${TEAM_INFO[e.team].name} · ${Math.ceil(e.hp)}/${e.maxHp} životů`;
      card.portrait = { icon: d.icon, hp: e.hp / e.maxHp, color: TEAM_INFO[e.team].color };
    }
    return card;
  }
  const units = own.filter((e) => e.kind === 'unit');
  const blds = own.filter((e) => e.kind === 'building');
  if (units.length) {
    const first = units[0];
    const counts = {};
    for (const u of units) counts[u.type] = (counts[u.type] || 0) + 1;
    if (units.length === 1) {
      card.title = first.def.hero ? `${first.name} · úr. ${first.level}` : first.def.name;
      const st = first.carry ? ` · nese ${first.carry.amt} ${first.carry.res === 'gold' ? 'zlata' : 'dřeva'}` : '';
      card.sub = first.def.hero
        ? `${Math.ceil(first.hp)}/${first.maxHp} ❤ · ${Math.floor(first.mana)}/${first.maxMana} mana · ${first.level < HERO_XP.length ? `XP ${first.xp}/${HERO_XP[first.level]}` : 'max. úroveň'}`
        : `${Math.ceil(first.hp)}/${first.maxHp} ❤ · útok ${first.def.dmg} · brnění ${g.armorOf(first)}${st}`;
      card.portrait = { icon: first.def.icon, hp: first.hp / first.maxHp, color: TEAM_INFO[0].color, mana: first.def.hero ? first.mana / first.maxMana : null };
    } else {
      card.title = `Vybráno: ${units.length}`;
      card.sub = Object.entries(counts).map(([t, n]) => `${UNITS[t].icon}${n}`).join('  ');
      card.rows = Object.entries(counts).map(([t, n]) => ({ icon: UNITS[t].icon, n, type: t }));
    }
    const workers = units.filter((u) => u.def.worker);
    const hero = units.find((u) => u.def.hero);
    if (hero) {
      for (const ab of hero.def.abilities) {
        const A = ABILITIES[ab];
        const cd = hero.cds[ab] || 0;
        btn({ id: 'ab-' + ab, icon: A.icon, label: A.name, hot: A.hot, desc: A.desc(hero.level), cost: `${A.mana} many`,
          disabled: cd > 0 || hero.mana < A.mana, why: cd > 0 ? `Nabíjí se (${Math.ceil(cd)} s)` : hero.mana < A.mana ? 'Málo many' : null,
          cooldown: cd > 0 ? cd / A.cd : 0, active: app.casting === ab, action: () => app.startCast(ab) });
      }
    }
    if (workers.length && workers.length === units.length) {
      for (const type of BUILD_ORDER) {
        const d = BUILDINGS[type];
        const why = g.buildBlocker(0, type);
        btn({ id: 'b-' + type, icon: d.icon, label: d.name, hot: d.hot, desc: d.desc, cost: costText(d.cost), disabled: !!why, why, active: app.placing === type, action: () => app.startPlacing(type) });
      }
    }
    if (!(workers.length && workers.length === units.length)) btn({ id: 'amove', icon: '🗡', label: 'Útočný pochod', hot: 'A', desc: 'Jdou na místo a útočí na vše po cestě.', active: app.attackMoveArmed, action: () => app.armAttackMove() });
    btn({ id: 'stop', icon: '✋', label: 'Stůj', hot: 'S', desc: 'Zastaví jednotky.', action: () => app.command('stop') });
    if (!workers.length || workers.length < units.length) btn({ id: 'hold', icon: '⛨', label: 'Drž pozici', hot: 'D', desc: 'Nehnou se z místa, bojují jen v dosahu.', action: () => app.command('hold') });
    xrExtras(app, btn);
    if (app.xr) btn({ id: 'desel', icon: '✖', label: 'Zrušit výběr', desc: 'Nic nebude vybráno.', action: () => app.deselect() });
    return card;
  }
  // budovy
  const b = blds[0];
  const d = b.def;
  card.title = blds.length > 1 ? `${d.name} ×${blds.length}` : d.name;
  card.portrait = { icon: d.icon, hp: b.hp / b.maxHp, color: TEAM_INFO[0].color };
  if (!b.done) {
    card.sub = `Staví se… ${Math.floor(b.progress * 100)} %`;
    btn({ id: 'cancelB', icon: '✖', label: 'Zrušit stavbu', hot: 'Esc', desc: 'Vrátí 75 % surovin.', action: () => app.game.cancelBuilding(b) });
    return card;
  }
  const f = g.food(0);
  card.sub = `${Math.ceil(b.hp)}/${b.maxHp} ❤${d.food ? ` · +${d.food} jídla` : ''}${d.dmg ? ` · útok ${d.dmg}` : ''}`;
  card.queue = b.queue.map((q) => ({ icon: UNITS[q.type].icon, p: q.t / q.total }));
  for (const type of d.trains || []) {
    const u = UNITS[type];
    const why = g.trainBlocker(b, type);
    const revive = u.hero && g.heroOf?.[0];
    btn({ id: 't-' + type, icon: u.icon, label: revive ? 'Oživit hrdinu' : u.name, hot: u.hot, desc: u.desc, cost: `${costText(g.heroCost(0, type))} · ${u.food}🍖`, disabled: !!why, why, action: () => app.trainAt(type) });
  }
  if (b.queue.length) btn({ id: 'cancelQ', icon: '↩', label: 'Zrušit poslední', hot: 'Esc', desc: 'Vrátí suroviny.', action: () => { for (const x of blds) if (x.queue.length) { g.cancelTrain(x); break; } } });
  if (d.trains) card.hint = app.xr ? 'Štípnutím do mapy nastavíš shromaždiště' : 'Pravým klikem nastavíš shromaždiště';
  return card;
}

// ------------------------------------------------------------------ VR panel (canvas → textura)
export class CanvasPanel {
  constructor(w, h, worldW) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * h / w), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.mesh.renderOrder = 40;
    this.mesh.userData.panel = this;
    this.buttons = [];
    this.key = '';
    this.hoverId = null;
    this.pressId = null;
  }
  /** Tlačítko pod UV bodem. */
  hitUV(u, v) {
    const x = u * this.canvas.width, y = (1 - v) * this.canvas.height;
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && !b.dead) || null;
  }
  rr(x, y, w, h, r, fill, stroke, lw = 3) {
    const c = this.ctx;
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  }
  text(t, x, y, size, color = '#fff', align = 'left', weight = 800, maxW = 0) {
    const c = this.ctx;
    c.font = `${weight} ${size}px ${FONT}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    if (maxW) {
      let s = t;
      while (c.measureText(s).width > maxW && s.length > 3) s = s.slice(0, -2);
      if (s !== t) s = s.trimEnd() + '…';
      c.fillText(s, x, y);
    } else c.fillText(t, x, y);
  }
  wrap(t, x, y, size, maxW, lh, color = '#cfd8ee', maxLines = 3) {
    const c = this.ctx;
    c.font = `700 ${size}px ${FONT}`;
    const words = String(t).split(' ');
    let line = '', n = 0;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxW && line) { this.text(line, x, y + n * lh, size, color, 'left', 700); line = w; if (++n >= maxLines) return; }
      else line = test;
    }
    if (line) this.text(line, x, y + n * lh, size, color, 'left', 700);
  }
}

/** Velitelská karta na levé ruce (VR). */
export class CardPanel extends CanvasPanel {
  constructor() { super(600, 720, 0.26); }
  draw(app, card) {
    const g = app.game;
    const f = g.food(0);
    const r = g.res[0];
    const key = JSON.stringify([card.title, card.sub, card.buttons.map((b) => [b.id, b.disabled, b.active, Math.round((b.cooldown || 0) * 20)]), Math.floor(r.gold), Math.floor(r.wood), f.used, f.cap,
      Math.floor(g.time), card.queue?.map((q) => Math.round(q.p * 20)), card.portrait && Math.round((card.portrait.hp || 0) * 30), this.hoverId, this.pressId, app.slowmo, app.groupsKey?.()]);
    if (key === this.key) return;
    this.key = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    this.buttons = [];
    this.rr(4, 4, W - 8, H - 8, 34, 'rgba(18,24,42,0.94)', '#c9a14a', 5);
    // suroviny
    this.rr(18, 16, W - 36, 64, 22, 'rgba(0,0,0,0.35)');
    this.text(`🪙 ${Math.floor(r.gold)}`, 34, 48, 32, '#ffd84a');
    this.text(`🪵 ${Math.floor(r.wood)}`, 214, 48, 32, '#c8f08a');
    this.text(`🍖 ${f.used}/${f.cap}`, 384, 48, 32, f.used >= f.cap ? '#ff8a7a' : '#ffffff');
    this.text(fmtTime(g.time), W - 32, 48, 22, '#9fb0d6', 'right', 700);
    // taktický čas
    if (app.slowmo) { this.rr(W / 2 - 110, 84, 220, 30, 15, 'rgba(90,200,255,0.25)'); this.text('⏳ taktický čas', W / 2, 99, 20, '#9fe8ff', 'center'); }
    // výběr
    let y = 128;
    const P = card.portrait;
    if (P) {
      this.rr(22, y, 96, 96, 20, 'rgba(255,255,255,0.08)', P.color || '#8899bb', 4);
      this.text(P.icon, 70, y + 50, 52, '#fff', 'center');
      if (P.hp != null) { this.rr(22, y + 102, 96, 12, 6, '#222'); this.rr(22, y + 102, 96 * Math.max(0, P.hp), 12, 6, P.hp > 0.6 ? '#4ccf5a' : P.hp > 0.3 ? '#f2c230' : '#ef4a3a'); }
      if (P.mana != null) { this.rr(22, y + 116, 96, 10, 5, '#222'); this.rr(22, y + 116, 96 * P.mana, 10, 5, '#4a8dff'); }
    }
    const tx = P ? 136 : 28;
    this.text(card.title, tx, y + 26, 34, '#ffe9a8', 'left', 900, W - tx - 20);
    this.wrap(card.sub, tx, y + 64, 22, W - tx - 24, 28, '#cfd8ee', 2);
    if (card.queue?.length) {
      card.queue.forEach((q, k) => {
        const x = tx + k * 62, yy = y + 98;
        this.rr(x, yy, 54, 40, 10, 'rgba(255,255,255,0.1)', k === 0 ? '#9fd0ff' : null, 2);
        this.text(q.icon, x + 27, yy + 20, 24, '#fff', 'center');
        if (k === 0) this.rr(x, yy + 36, 54 * q.p, 4, 2, '#9fd0ff');
      });
    }
    // tlačítka (mřížka 3 sloupce)
    y = 270;
    const cols = 3, bw = 180, bh = 118, gap = 12, x0 = (W - (cols * bw + (cols - 1) * gap)) / 2;
    card.buttons.slice(0, 9).forEach((b, k) => {
      const x = x0 + (k % cols) * (bw + gap), yy = y + Math.floor(k / cols) * (bh + gap);
      const hov = this.hoverId === b.id, pr = this.pressId === b.id;
      const fill = b.active ? 'rgba(255,210,90,0.45)' : b.disabled ? 'rgba(255,255,255,0.05)' : pr ? 'rgba(120,200,255,0.5)' : hov ? 'rgba(120,200,255,0.28)' : 'rgba(255,255,255,0.12)';
      this.rr(x, yy, bw, bh, 20, fill, b.active ? '#ffd84a' : hov ? '#8ff4ff' : 'rgba(255,255,255,0.18)', hov || b.active ? 4 : 2);
      this.text(b.icon, x + bw / 2, yy + 38, 40, b.disabled ? '#777' : '#fff', 'center');
      this.text(b.label, x + bw / 2, yy + 80, 21, b.disabled ? '#8088a0' : '#ffffff', 'center', 800, bw - 12);
      if (b.cost) this.text(b.cost, x + bw / 2, yy + 104, 16, b.disabled ? '#707890' : '#ffe39a', 'center', 700, bw - 10);
      if (b.cooldown > 0) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.roundRect(x, yy, bw, bh * b.cooldown, 20); c.fill(); }
      this.buttons.push({ ...b, x, y: yy, w: bw, h: bh });
    });
    // dolní lišta: skupiny + menu
    const by = H - 96;
    const groups = app.groups || [];
    for (let k = 0; k < 3; k++) {
      const x = 22 + k * 118, gid = 'grp' + k;
      const has = groups[k]?.length;
      const hov = this.hoverId === gid;
      this.rr(x, by, 108, 76, 18, hov ? 'rgba(120,200,255,0.28)' : 'rgba(255,255,255,0.1)', has ? '#9fd0ff' : 'rgba(255,255,255,0.15)', 2);
      this.text(`${k + 1}`, x + 26, by + 38, 30, '#fff', 'center', 900);
      this.text(has ? `${groups[k].length}×` : '+', x + 72, by + 38, 22, has ? '#9fd0ff' : '#8090b0', 'center');
      this.buttons.push({ id: gid, x, y: by, w: 108, h: 76, action: () => app.groupTap(k), hold: () => app.groupSave(k), desc: has ? 'Klepni = vyber skupinu, podrž = ulož výběr' : 'Klepni = ulož aktuální výběr jako skupinu' });
    }
    const mx = W - 22 - 190;
    this.rr(mx, by, 190, 76, 18, this.hoverId === 'menu' ? 'rgba(120,200,255,0.28)' : 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)', 2);
    this.text('☰ Menu', mx + 95, by + 38, 26, '#fff', 'center');
    this.buttons.push({ id: 'menu', x: mx, y: by, w: 190, h: 76, action: () => app.openMenu() });
    // popis tlačítka pod paprskem / nápověda
    const hb = card.buttons.find((b) => b.id === this.hoverId) || this.buttons.find((b) => b.id === this.hoverId);
    const tip = hb ? (hb.why ? `⚠ ${hb.why}` : hb.desc || '') : card.hint || '';
    if (tip) this.wrap(tip, 28, H - 148, 21, W - 56, 26, hb?.why ? '#ffb09a' : '#aebbd8', 2);
    this.tex.needsUpdate = true;
  }
}

/** Nápis nad protější hranou stolu: čas, zprávy, upozornění (VR). */
export class BannerPanel extends CanvasPanel {
  constructor() { super(1024, 200, 0.85); }
  draw(app) {
    const g = app.game;
    const m = g.messages.filter((x) => g.time - x.t < 5).slice(-2);
    const r = g.res[0], f = g.food(0);
    const fps = app.gfx?.text() || '';
    const key = [Math.floor(r.gold), Math.floor(r.wood), f.used, f.cap, Math.floor(g.time), m.map((x) => x.text + x.t).join('|'), app.slowmo, fps].join(';');
    if (key === this.key) return;
    this.key = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    this.rr(8, 8, W - 16, 84, 40, 'rgba(18,24,42,0.9)', '#c9a14a', 4);
    this.text(`🪙 ${Math.floor(r.gold)}`, 60, 52, 42, '#ffd84a');
    this.text(`🪵 ${Math.floor(r.wood)}`, 300, 52, 42, '#c8f08a');
    this.text(`🍖 ${f.used}/${f.cap}`, 540, 52, 42, f.used >= f.cap ? '#ff8a7a' : '#fff');
    this.text(`⏱ ${fmtTime(g.time)}`, W - 60, 52, 34, '#9fb0d6', 'right', 700);
    if (fps) this.text(fps, W / 2, 190, 22, '#9fffa8', 'center', 800);
    m.forEach((x, k) => {
      const col = x.kind === 'alert' ? '#ff9a7a' : x.kind === 'good' ? '#9fffa8' : x.kind === 'deny' ? '#ffcf8a' : '#ffffff';
      this.rr(W / 2 - 440, 104 + k * 46, 880, 40, 20, 'rgba(0,0,0,0.55)');
      this.text(x.text, W / 2, 124 + k * 46, 28, col, 'center', 800, 860);
    });
    this.tex.needsUpdate = true;
  }
}

/** Obecné menu (VR): nadpis, text, řádky tlačítek. */
export class MenuPanel extends CanvasPanel {
  constructor() { super(760, 900, 0.5); }
  draw(model, hoverId) {
    const key = JSON.stringify([model.title, model.text, model.items.map((i) => [i.id, i.label, i.on, i.sub]), hoverId]);
    if (key === this.key) return;
    this.key = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    this.buttons = [];
    this.rr(6, 6, W - 12, H - 12, 40, 'rgba(18,24,42,0.96)', '#c9a14a', 6);
    this.text(model.title, W / 2, 70, 52, '#ffe28a', 'center', 900, W - 60);
    let y = 120;
    if (model.text) { this.wrap(model.text, 50, y + 10, 26, W - 100, 34, '#cfd8ee', 5); y += 34 * Math.min(5, Math.ceil(model.text.length / 42)) + 20; }
    for (const it of model.items) {
      if (it.header) { this.text(it.label, 50, y + 22, 24, '#9fb0d6', 'left', 800); y += 44; continue; }
      const h = it.sub ? 96 : 76;
      const hov = hoverId === it.id;
      this.rr(40, y, W - 80, h, 24, it.primary ? (hov ? '#4cc25c' : '#3aa84a') : it.on ? 'rgba(255,210,90,0.35)' : hov ? 'rgba(120,200,255,0.3)' : 'rgba(255,255,255,0.1)', hov ? '#8ff4ff' : it.on ? '#ffd84a' : 'rgba(255,255,255,0.18)', 3);
      this.text(it.label, W / 2, y + (it.sub ? 34 : h / 2), 32, '#fff', 'center', 900, W - 120);
      if (it.sub) this.text(it.sub, W / 2, y + 70, 21, 'rgba(255,255,255,0.75)', 'center', 700, W - 120);
      this.buttons.push({ id: it.id, x: 40, y, w: W - 80, h, action: it.action });
      y += h + 14;
      if (y > H - 80) break;
    }
    this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ PC: DOM rozhraní
export class DesktopHUD {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('hud');
    this.res = document.getElementById('hud-res');
    this.msgs = document.getElementById('hud-msgs');
    this.card = document.getElementById('hud-card');
    this.sel = document.getElementById('hud-sel');
    this.tip = document.getElementById('hud-tip');
    this.mini = document.getElementById('hud-mini');
    this.miniCtx = this.mini.getContext('2d');
    this.key = '';
    this.miniT = 0;
    this.mini.addEventListener('pointerdown', (e) => this.miniClick(e));
    this.mini.addEventListener('pointermove', (e) => { if (e.buttons & 1) this.miniClick(e); });
    this.mini.addEventListener('contextmenu', (e) => { e.preventDefault(); this.miniClick(e, true); });
  }
  show(on) { this.root.classList.toggle('on', on); }
  miniClick(e, right = false) {
    const r = this.mini.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 48, z = (e.clientY - r.top) / r.height * 48;
    if (right || e.button === 2) this.app.orderAt(x, z, null, e.shiftKey);
    else this.app.lookAt(x, z);
  }
  update(dt) {
    const a = this.app, g = a.game;
    const r = g.res[0], f = g.food(0);
    this.res.innerHTML = `<span class="g">🪙 ${Math.floor(r.gold)}</span><span class="w">🪵 ${Math.floor(r.wood)}</span><span class="${f.used >= f.cap ? 'bad' : ''}">🍖 ${f.used}/${f.cap}</span><span class="t">⏱ ${fmtTime(g.time)}</span>${g.test ? '<span class="t">🧪 test</span>' : ''}`;
    const msgs = g.messages.filter((x) => g.time - x.t < 5).slice(-3);
    const mk = msgs.map((m) => m.text + m.t).join('|');
    if (mk !== this.mk) { this.mk = mk; this.msgs.innerHTML = msgs.map((m) => `<div class="m ${m.kind}">${m.text}</div>`).join(''); }
    const card = buildCard(a);
    const key = JSON.stringify([card.title, card.sub, card.buttons.map((b) => [b.id, b.disabled, b.active, b.label, b.cost, Math.round((b.cooldown || 0) * 10)]), card.queue?.map((q) => Math.round(q.p * 20)), card.portrait && Math.round((card.portrait.hp || 0) * 50)]);
    if (key !== this.key) {
      this.key = key;
      const P = card.portrait;
      this.sel.innerHTML = `
        ${P ? `<div class="por" style="border-color:${P.color || '#8899bb'}"><span>${P.icon}</span>${P.hp != null ? `<i style="width:${Math.max(0, P.hp) * 100}%"></i>` : ''}${P.mana != null ? `<b style="width:${P.mana * 100}%"></b>` : ''}</div>` : ''}
        <div class="txt"><div class="ti">${card.title}</div><div class="su">${card.sub || ''}</div>
        ${card.queue?.length ? `<div class="q">${card.queue.map((q, k) => `<span class="${k ? '' : 'cur'}">${q.icon}${k ? '' : `<i style="width:${q.p * 100}%"></i>`}</span>`).join('')}</div>` : ''}
        ${card.hint ? `<div class="hint">${card.hint}</div>` : ''}</div>`;
      this.card.innerHTML = '';
      for (const b of card.buttons) {
        const el = document.createElement('button');
        el.className = 'cb' + (b.disabled ? ' dis' : '') + (b.active ? ' act' : '');
        el.innerHTML = `<span class="ic">${b.icon}</span><span class="lb">${b.label}</span>${b.cost ? `<span class="co">${b.cost}</span>` : ''}${b.hot ? `<span class="hk">${b.hot}</span>` : ''}${b.cooldown > 0 ? `<span class="cd" style="height:${b.cooldown * 100}%"></span>` : ''}`;
        el.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) { a.deny(b.why); return; } a.sfx.play('click'); b.action(); });
        el.addEventListener('mouseenter', () => { this.tip.innerHTML = `<b>${b.label}</b>${b.cost ? ` · ${b.cost}` : ''}<br>${b.why ? `<span class="why">${b.why}</span>` : b.desc || ''}`; this.tip.classList.add('on'); });
        el.addEventListener('mouseleave', () => this.tip.classList.remove('on'));
        this.card.appendChild(el);
      }
      this.cardButtons = card.buttons;
    }
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.25; this.drawMini(); }
  }
  hotkey(k) {
    const b = (this.cardButtons || []).find((x) => x.hot && x.hot.toLowerCase() === k.toLowerCase());
    if (!b) return false;
    if (b.disabled) this.app.deny(b.why); else { this.app.sfx.play('click'); b.action(); }
    return true;
  }
  drawMini() {
    const a = this.app, g = a.game, c = this.miniCtx, S = this.mini.width, k = S / 48;
    const img = c.createImageData(S, S);
    // podklad z viditelnosti a překážek
    for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) {
      const i = z * 48 + x, v = g.vis[i], b = g.block[i];
      let col = b === 1 ? [45, 92, 50] : b === 4 ? [120, 120, 115] : b === 3 ? [200, 170, 60] : [96, 140, 70];
      if (v === 0 && !g.revealAll) col = [14, 16, 24]; else if (v === 1 && !g.revealAll) col = col.map((q) => q * 0.5);
      for (let yy = Math.floor(z * k); yy < Math.floor((z + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) {
        const p = (yy * S + xx) * 4;
        img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    const col = ['#5a8dff', '#ff5a4a', '#e0d080'];
    for (const b of g.buildings) { if (!g.seen(b)) continue; c.fillStyle = col[b.team]; c.fillRect(b.x * k, b.z * k, b.w * k, b.h * k); }
    for (const u of g.units) { if (u.hidden || !g.seen(u)) continue; c.fillStyle = a.selection.has(u.id) ? '#ffffff' : col[u.team]; c.fillRect(u.x * k - 1.5, u.z * k - 1.5, 3, 3); }
    // výhled kamery
    const v = a.viewCorners?.();
    if (v) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); v.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k))); c.closePath(); c.stroke(); }
    for (const m of g.messages) if (m.kind === 'alert' && m.at && g.time - m.t < 4) { c.strokeStyle = '#ff4a3a'; c.lineWidth = 2; c.beginPath(); c.arc(m.at.x * k, m.at.z * k, 6 + (g.time * 20 % 8), 0, 7); c.stroke(); }
  }
}
