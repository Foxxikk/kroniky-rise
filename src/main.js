// Kroniky Říše – aplikace: renderer, režimy (menu / PC / VR / MR), vstupy, kamera, UI a herní smyčka.
import * as THREE from 'three';
import { Game } from './game.js';
import { World } from './world.js';
import { Env } from './env.js';
import { Sfx } from './audio.js';
import { HandVisuals } from './hands.js';
import { buildCard, CardPanel, BannerPanel, MenuPanel, DesktopHUD, fmtTime } from './ui.js';
import { UNITS, BUILDINGS, ABILITIES, MAP_W, MAP_H, DIFFICULTY } from './config.js';
import { part, merge } from './models.js';
import { loadAssets, ASSETS } from './assets.js';
import { Graphics } from './gfx.js';

const W = MAP_W, H = MAP_H;
const VR_SCALE = 0.027; // 48 políček ≈ 1,3 m
const TABLE_TOP = 0.77;
const BOARD_BOTTOM = 1.62; // tloušťka podstavce desky (v políčkách)
const SCALE_MIN = 0.012, SCALE_MAX = 0.14;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _ray = new THREE.Ray(), _box = new THREE.Box3();
const BH = { townhall: 3.3, tower: 3.4, altar: 2.0, barracks: 2.0, stable: 1.9, farm: 1.2 };

function loadSettings() {
  const def = { slowmo: true, lefty: false, shadows: true, difficulty: 'normal' };
  try { return { ...def, ...JSON.parse(localStorage.getItem('kr-settings') || '{}') }; } catch (e) { return def; }
}

export class App {
  constructor() {
    this.settings = loadSettings();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.02, 400);
    this.env = new Env(this.scene);
    this.gfx = new Graphics(this);
    this.sfx = new Sfx();
    this.mode = 'menu';
    this.selection = new Set();
    this.groups = [[], [], []];
    this.placing = null;
    this.casting = null;
    this.attackMoveArmed = false;
    this.pointers = [];
    this.lastT = 0;
    this.cam = { x: 14, z: 34, dist: 26, yaw: 0, pitch: 0.95 };
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: null, inside: false };
    this.hud = new DesktopHUD(this);
    this.card = new CardPanel();
    this.banner = new BannerPanel();
    this.menu = new MenuPanel();
    this.card.mesh.visible = false; this.banner.mesh.visible = false; this.menu.mesh.visible = false;
    this.scene.add(this.card.mesh, this.banner.mesh, this.menu.mesh);
    this.menuOpen = null;
    this.raycaster = new THREE.Raycaster();
    this.setupXR();
    this.setupDesktop();
    this.buildHandles();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop((t, f) => this.loop(t, f));
    window.__app = this;
    // modely se začnou načítat hned (zapékání animací chvíli trvá)
    this.assetsP = loadAssets((p) => this.onAssetProgress?.(p));
  }
  saveSettings() { try { localStorage.setItem('kr-settings', JSON.stringify(this.settings)); } catch (e) { /* bez úložiště */ } }
  get xr() { return this.mode === 'vr' || this.mode === 'ar'; }
  resize() {
    if (this.renderer.xr.isPresenting) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ================================================================== hra
  newGame(opts = {}) {
    if (this.world) this.scene.remove(this.world.board);
    this.game = new Game({ difficulty: this.settings.difficulty, test: !!opts.test });
    window.__game = this.game;
    if (opts.test) this.game.revealAll = false;
    this.world = new World(this.game);
    this.scene.add(this.world.board);
    this.selection.clear();
    this.groups = [[], [], []];
    this.placing = this.casting = null;
    this.attackMoveArmed = false;
    this.ended = false;
    const th = this.game.buildings.find((b) => b.team === 0);
    this.cam.x = th.cx + 4; this.cam.z = th.cz - 3;
    this.selectAll('townhall');
    this.setShadows();
  }
  setShadows() { this.gfx.apply(); }

  async startDesktop(opts) {
    this.sfx.init();
    await this.assetsP;
    this.mode = 'desktop';
    this.newGame(opts);
    this.env.setMode('desktop');
    this.setShadows();
    this.world.board.position.set(0, 0, 0);
    this.world.board.scale.setScalar(1);
    this.world.board.rotation.set(0, 0, 0);
    document.getElementById('start').classList.add('hidden');
    this.hud.show(true);
    this.paused = false;
  }
  async startXR(kind, opts) {
    this.sfx.init(); // AudioContext vznikne hned (v rámci kliknutí), zvuky se dopočítají na pozadí
    const sessionMode = kind === 'ar' ? 'immersive-ar' : 'immersive-vr';
    const optional = ['hand-tracking', 'bounded-floor', 'layers'];
    let session;
    try {
      session = await navigator.xr.requestSession(sessionMode, { requiredFeatures: ['local-floor'], optionalFeatures: optional });
    } catch (e) {
      alert('Nepodařilo se spustit ' + (kind === 'ar' ? 'MR' : 'VR') + ': ' + e.message);
      return;
    }
    await this.assetsP;
    this.mode = kind;
    this.newGame(opts);
    this.env.setMode(kind);
    this.setShadows();
    this.gfx.beforeSession();
    await this.renderer.xr.setSession(session);
    this.gfx.applySession();
    this.placedXR = false;
    this.hud.show(false);
    document.getElementById('start').classList.add('hidden');
    session.addEventListener('end', () => this.onXREnd());
    // v brýlích začni pauzou s krátkým návodem
    this.openMenu('intro');
  }
  onXREnd() {
    this.mode = 'desktop';
    this.env.setMode('desktop');
    this.card.mesh.visible = this.banner.mesh.visible = this.menu.mesh.visible = false;
    this.handles.visible = false;
    this.menuOpen = null;
    this.world.board.position.set(0, 0, 0);
    this.world.board.scale.setScalar(1);
    this.world.board.rotation.set(0, 0, 0);
    this.setShadows();
    this.resize();
    this.hud.show(true);
    this.paused = false;
  }
  /** Po prvním snímku v XR: deska na stůl před hráče. */
  placeBoardXR() {
    const cam = this.renderer.xr.getCamera();
    cam.updateMatrixWorld();
    const head = _v.setFromMatrixPosition(cam.matrixWorld);
    const fwd = _v2.set(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(_q)); fwd.y = 0; fwd.normalize();
    if (fwd.lengthSq() < 0.1) fwd.set(0, 0, -1);
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    const c = head.clone().addScaledVector(fwd, 0.92);
    const b = this.world.board;
    b.scale.setScalar(VR_SCALE);
    b.rotation.set(0, yaw, 0);
    b.position.set(c.x, (this.mode === 'ar' ? Math.max(0.55, Math.min(1.0, head.y - 0.72)) : TABLE_TOP) + BOARD_BOTTOM * VR_SCALE, c.z);
    this.env.tent.position.set(c.x, 0, c.z);
    this.env.tent.rotation.y = yaw;
    this.placedXR = true;
  }

  // ================================================================== výběr a rozkazy (sdílené)
  selectedEnts() {
    const g = this.game;
    const out = [];
    for (const id of this.selection) {
      const e = g.get(id);
      if (e && !(e.kind === 'unit' && e.team !== 0 && !g.seen(e))) out.push(e);
    }
    if (!out.length && this.infoTree) { const t = g.trees[this.infoTree.idx]; if (t?.alive) out.push({ ...this.infoTree, wood: t.wood }); }
    return out;
  }
  select(ents, add = false) {
    ents = ents.filter(Boolean);
    this.infoTree = null;
    const own = ents.filter((e) => e.team === 0 && e.kind === 'unit');
    let pick;
    if (own.length) pick = own;
    else if (ents.some((e) => e.team === 0 && e.kind === 'building')) { const b = ents.find((e) => e.team === 0 && e.kind === 'building'); pick = ents.filter((e) => e.team === 0 && e.kind === 'building' && e.type === b.type); }
    else if (ents[0]?.kind === 'tree') { this.selection.clear(); this.infoTree = ents[0]; return; }
    else pick = ents.slice(0, 1);
    if (add) {
      const cur = this.selectedEnts();
      if (cur.length && cur[0].team === 0 && cur[0].kind === 'unit' && pick[0]?.kind === 'unit' && pick[0].team === 0) {
        for (const e of pick) { if (this.selection.has(e.id) && pick.length === 1) this.selection.delete(e.id); else this.selection.add(e.id); }
        this.afterSelect();
        return;
      }
    }
    this.selection.clear();
    for (const e of pick.slice(0, 36)) this.selection.add(e.id);
    this.placing = this.casting = null;
    this.attackMoveArmed = false;
    this.afterSelect();
  }
  afterSelect() {
    const e = this.selectedEnts();
    if (!e.length) return;
    const f = e[0];
    if (f.team === 0) {
      this.sfx.play(f.kind === 'unit' ? 'select' : 'click', { pos: this.worldPos(f) });
      if (f.kind === 'unit' && !f.def.worker) this.sfx.play('ack', { vol: 0.5, minGap: 0.4, pos: this.worldPos(f) });
    } else this.sfx.play('selectEnemy');
  }
  deselect() { this.selection.clear(); this.infoTree = null; this.placing = this.casting = null; this.attackMoveArmed = false; }
  selectAll(kind) {
    const g = this.game;
    let ents = [];
    if (kind === 'army') ents = g.units.filter((u) => u.team === 0 && !u.def.worker);
    else if (kind === 'idleWorkers') { ents = g.units.filter((u) => u.team === 0 && u.def.worker && u.order.type === 'idle' && !u.hidden); if (!ents.length) { this.deny('Žádní nečinní dělníci'); return; } }
    else if (kind === 'workers') ents = g.units.filter((u) => u.team === 0 && u.def.worker && !u.hidden);
    else if (kind === 'hero') { const h = g.hero(0); if (h) ents = [h]; }
    else if (kind === 'townhall') ents = g.buildings.filter((b) => b.team === 0 && b.type === 'townhall').slice(0, 1);
    if (!ents.length) return;
    this.select(ents);
    if (this.mode === 'desktop' && kind !== 'army') this.lookAt(ents[0].x ?? ents[0].cx, ents[0].z ?? ents[0].cz);
  }
  selectSameType(e) {
    const g = this.game;
    const near = g.units.filter((u) => u.team === 0 && u.type === e.type && !u.hidden && Math.hypot(u.x - e.x, u.z - e.z) < 14);
    this.select(near);
  }
  groupTap(k) {
    const g = this.game;
    const ids = (this.groups[k] || []).filter((id) => g.get(id));
    if (!ids.length) { this.groupSave(k); return; }
    this.groups[k] = ids;
    this.select(ids.map((id) => g.get(id)));
  }
  groupSave(k) {
    const ents = this.selectedEnts().filter((e) => e.team === 0 && e.kind === 'unit');
    if (!ents.length) { this.deny('Nejdřív vyber jednotky'); return; }
    this.groups[k] = ents.map((e) => e.id);
    this.game.msg(0, `Skupina ${k + 1} uložena (${ents.length})`, 'info');
    this.sfx.play('order');
  }
  groupsKey() { return this.groups.map((g) => g.length).join(','); }
  deny(why) { this.sfx.play('deny'); if (why) this.game.msg(0, why, 'deny'); this.hapticAll(0.5, 60); }
  worldPos(e) {
    if (!e || !this.world) return null;
    const x = e.kind === 'building' || e.kind === 'mine' ? e.cx : e.x, z = e.kind === 'building' || e.kind === 'mine' ? e.cz : e.z;
    return this.world.map.localToWorld(new THREE.Vector3(x, 0.5, z));
  }
  ownUnitsSel() { return this.selectedEnts().filter((e) => e.team === 0 && e.kind === 'unit'); }
  /** Rozkaz na bod mapy (pravé tlačítko / štípnutí). */
  orderAt(x, z, target, queued = false) {
    const g = this.game;
    if (this.attackMoveArmed) {
      this.attackMoveArmed = false;
      const ids = this.ownUnitsSel().map((u) => u.id);
      if (!ids.length) return;
      if (target && target.team !== 0 && target.kind !== 'mine' && target.kind !== 'tree') g.smartOrder(ids, x, z, target);
      else g.smartOrder(ids, x, z, null, { attackMove: true });
      this.sfx.play('attackOrder');
      this.hapticAll(0.3, 40);
      return;
    }
    const ids = [...this.selection];
    const sel = this.selectedEnts();
    if (!sel.length || sel[0].team !== 0) return;
    const kind = g.smartOrder(ids, x, z, target && target.kind === 'tree' ? { ...target, dead: false } : target);
    if (!kind) return;
    const u = sel.find((e) => e.kind === 'unit');
    this.sfx.play(kind === 'attack' ? 'attackOrder' : 'order', { pos: u ? this.worldPos(u) : null });
    if (u && !u.def.worker && Math.random() < 0.5) this.sfx.play('ack', { vol: 0.4, minGap: 0.6 });
  }
  command(cmd) {
    const g = this.game;
    for (const u of this.ownUnitsSel()) {
      if (cmd === 'stop') { g.order(u, { type: 'idle' }); u.guard = null; }
      if (cmd === 'hold') g.order(u, { type: 'hold' });
    }
    this.sfx.play('order');
  }
  armAttackMove() {
    if (!this.ownUnitsSel().length) return;
    this.attackMoveArmed = !this.attackMoveArmed;
    this.placing = this.casting = null;
    if (this.attackMoveArmed) this.game.msg(0, this.xr ? 'Štípni do mapy – kam zaútočit' : 'Klikni do mapy – kam zaútočit', 'info');
  }
  startPlacing(type) {
    if (this.placing === type) { this.placing = null; return; }
    const why = this.game.buildBlocker(0, type);
    if (why) { this.deny(why); return; }
    this.placing = type;
    this.casting = null;
    this.attackMoveArmed = false;
    this.game.msg(0, `${BUILDINGS[type].name}: ${this.xr ? 'štípni na místo na mapě' : 'klikni na místo (Shift = víc)'}`, 'info');
  }
  startCast(ab) {
    if (this.casting === ab) { this.casting = null; return; }
    const h = this.ownUnitsSel().find((u) => u.def.hero);
    if (!h) return;
    const A = ABILITIES[ab];
    if ((h.cds[ab] || 0) > 0) { this.deny('Schopnost se ještě nabíjí'); return; }
    if (h.mana < A.mana) { this.deny('Málo many'); return; }
    this.casting = ab;
    this.placing = null;
    this.attackMoveArmed = false;
    this.game.msg(0, A.target === 'ally' ? `${A.name}: vyber spojence` : `${A.name}: vyber místo`, 'info');
  }
  trainAt(type) {
    const g = this.game;
    const bs = this.selectedEnts().filter((b) => b.kind === 'building' && b.team === 0 && b.def.trains?.includes(type) && b.done);
    if (!bs.length) return;
    // nejkratší fronta
    bs.sort((a, b) => a.queue.length - b.queue.length);
    const why = g.trainBlocker(bs[0], type);
    if (why) { this.deny(why); return; }
    g.train(bs[0], type);
    this.sfx.play('click');
  }
  /** Stisk na mapě s rozkazem v přípravě (stavba / kouzlo). Vrací true, pokud byl spotřebován. */
  useArmed(x, z, target) {
    const g = this.game;
    if (this.placing) {
      const d = BUILDINGS[this.placing];
      const bx = Math.round(x - d.w / 2), bz = Math.round(z - d.h / 2);
      const workers = this.ownUnitsSel().filter((u) => u.def.worker).map((u) => u.id);
      if (!workers.length) { this.placing = null; return true; }
      if (g.orderBuild(workers, this.placing, bx, bz)) {
        this.sfx.play('hammer');
        this.hapticAll(0.4, 50);
        if (!(this.keys.has('Shift'))) this.placing = null;
      } else this.deny();
      return true;
    }
    if (this.casting) {
      const h = this.ownUnitsSel().find((u) => u.def.hero);
      const A = ABILITIES[this.casting];
      if (h) {
        const t = A.target === 'ally' ? (target?.kind === 'unit' && target.team === 0 ? target : null) : null;
        if (A.target === 'ally' && !t) { this.deny('Vyber spojeneckou jednotku'); return true; }
        if (g.castAbility(h, this.casting, x, z, t)) this.sfx.play('order');
      }
      this.casting = null;
      return true;
    }
    return false;
  }

  // ================================================================== vyhledání pod paprskem (lokálně v mapě)
  /** Paprsek ve světě → { x, z, ent, dist } v souřadnicích mapy. */
  pickRay(originW, dirW) {
    const g = this.game, map = this.world.map;
    map.updateMatrixWorld();
    const O = map.worldToLocal(_v.copy(originW));
    const D = map.worldToLocal(_v2.copy(originW).add(dirW)).sub(O).normalize();
    let best = null, bt = Infinity;
    for (const u of g.units) {
      if (u.hidden || !g.seen(u)) continue;
      const h = u.type === 'knight' || u.type === 'hero' || u.type === 'golem' ? 0.9 : 0.55;
      _v3.set(u.x - O.x, h - O.y, u.z - O.z);
      const t = _v3.dot(D);
      if (t < 0) continue;
      const d = Math.sqrt(Math.max(0, _v3.lengthSq() - t * t));
      const r = u.def.size + 0.28 + (this.xr ? 0.2 : 0);
      if (d < r && t < bt) { bt = t - (r - d) * 0.3; best = u; }
    }
    _ray.origin.copy(O); _ray.direction.copy(D);
    for (const b of g.buildings) {
      if (!g.seen(b)) continue;
      _box.min.set(b.x + 0.15, 0, b.z + 0.15); _box.max.set(b.x + b.w - 0.15, (BH[b.type] || 2) * (b.done ? 1 : 0.2 + 0.8 * b.progress), b.z + b.h - 0.15);
      const p = _ray.intersectBox(_box, _v3);
      if (p) { const t = p.distanceTo(O); if (t < bt) { bt = t; best = b; } }
    }
    for (const m of g.mines) {
      _box.min.set(m.x + 0.2, 0, m.z + 0.2); _box.max.set(m.x + m.w - 0.2, 1.5, m.z + m.h - 0.2);
      const p = _ray.intersectBox(_box, _v3);
      if (p) { const t = p.distanceTo(O); if (t < bt) { bt = t; best = m; } }
    }
    // průsečík se zemí
    let gx = null, gz = null;
    if (D.y < -1e-4) { const t = -O.y / D.y; gx = O.x + D.x * t; gz = O.z + D.z * t; if (!best) { const e = g.pick(gx, gz, 0.4); if (e) best = e; } }
    if (best && gx == null) { gx = best.x ?? best.cx; gz = best.z ?? best.cz; }
    if (gx == null) return null;
    return { x: gx, z: gz, ent: best };
  }

  // ================================================================== PC ovládání
  setupDesktop() {
    const el = this.renderer.domElement;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'desktop' || !this.game) return;
      el.setPointerCapture(e.pointerId);
      this.mouse.down = { x: e.clientX, y: e.clientY, b: e.button, t: performance.now(), yaw: this.cam.yaw, pitch: this.cam.pitch };
      if (e.button === 0) {
        const h = this.mouseHit(e.clientX, e.clientY);
        this.mouse.down.hit = h;
        if (h && (this.placing || this.casting || this.attackMoveArmed)) {
          if (this.attackMoveArmed) { this.orderAt(h.x, h.z, h.ent); this.mouse.down = null; return; }
          this.useArmed(h.x, h.z, h.ent);
          this.mouse.down = null;
        }
      }
    });
    el.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      const d = this.mouse.down;
      if (d && d.b === 1) { this.cam.yaw = d.yaw - (e.clientX - d.x) * 0.006; this.cam.pitch = THREE.MathUtils.clamp(d.pitch + (e.clientY - d.y) * 0.004, 0.45, 1.45); }
    });
    el.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    el.addEventListener('pointerup', (e) => {
      const d = this.mouse.down;
      this.mouse.down = null;
      if (!d || this.mode !== 'desktop' || !this.game) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (d.b === 0) {
        if (moved > 6) {
          // obdélník
          const a = this.groundAt(d.x, d.y), b = this.groundAt(e.clientX, e.clientY);
          if (a && b) {
            const us = this.unitsInScreenRect(d.x, d.y, e.clientX, e.clientY);
            if (us.length) this.select(us, e.shiftKey); else if (!e.shiftKey) this.deselect();
          }
        } else {
          const h = this.mouseHit(e.clientX, e.clientY);
          const now = performance.now();
          if (h?.ent) {
            if (h.ent.kind === 'unit' && h.ent.team === 0 && (e.ctrlKey || (this.lastClick && this.lastClick.id === h.ent.id && now - this.lastClick.t < 350))) this.selectSameType(h.ent);
            else this.select([h.ent], e.shiftKey);
            this.lastClick = { id: h.ent.id, t: now };
          } else if (!e.shiftKey) this.deselect();
        }
      } else if (d.b === 2) {
        if (this.placing || this.casting || this.attackMoveArmed) { this.placing = this.casting = null; this.attackMoveArmed = false; return; }
        const h = this.mouseHit(e.clientX, e.clientY);
        if (h) this.orderAt(h.x, h.z, h.ent, e.shiftKey);
      }
    });
    el.addEventListener('wheel', (e) => {
      if (this.mode !== 'desktop') return;
      e.preventDefault();
      this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 9, 60);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'desktop' || !this.game) return;
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      if (e.key === 'Shift') return;
      if (e.key === 'Escape') {
        if (this.placing || this.casting || this.attackMoveArmed) { this.placing = this.casting = null; this.attackMoveArmed = false; }
        else if (this.domMenuOpen) this.closeDomMenu();
        else if (this.selection.size) {
          const b = this.selectedEnts()[0];
          if (b?.kind === 'building' && b.team === 0 && b.queue?.length) this.game.cancelTrain(b);
          else if (b?.kind === 'building' && b.team === 0 && !b.done) this.game.cancelBuilding(b);
          else this.deselect();
        } else this.openDomMenu('pause');
        return;
      }
      if (e.key === 'F10' || e.key === 'p') { e.preventDefault(); this.openDomMenu('pause'); return; }
      if (e.key === 'F1') { e.preventDefault(); this.selectAll('idleWorkers'); return; }
      if (e.key === 'F2') { e.preventDefault(); this.selectAll('army'); return; }
      if (e.key === 'F3') { e.preventDefault(); this.selectAll('hero'); return; }
      if (e.key === 'F4') { e.preventDefault(); this.selectAll('townhall'); return; }
      if (e.key === ' ') {
        e.preventDefault();
        const al = [...this.game.messages].reverse().find((m) => m.at);
        const s = this.selectedEnts()[0];
        if (al && this.game.time - al.t < 8) this.lookAt(al.at.x, al.at.z); else if (s) this.lookAt(s.x ?? s.cx, s.z ?? s.cz);
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.groupSave(n - 1); }
        else { this.groupTap(n - 1); const f = this.selectedEnts()[0]; if (f && this.lastGroupKey === n && performance.now() - this.lastGroupT < 350) this.lookAt(f.x, f.z); this.lastGroupKey = n; this.lastGroupT = performance.now(); }
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (this.hud.hotkey(k)) return;
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
    window.addEventListener('blur', () => this.keys.clear());
  }
  mouseRay(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray;
  }
  mouseHit(cx, cy) { const r = this.mouseRay(cx, cy); return this.pickRay(r.origin, r.direction); }
  groundAt(cx, cy) {
    const r = this.mouseRay(cx, cy);
    if (r.direction.y >= -1e-4) return null;
    const t = -r.origin.y / r.direction.y;
    return [r.origin.x + r.direction.x * t + W / 2, r.origin.z + r.direction.z * t + H / 2];
  }
  unitsInScreenRect(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const r = this.renderer.domElement.getBoundingClientRect();
    const out = [];
    for (const u of this.game.units) {
      if (u.team !== 0 || u.hidden) continue;
      _v.set(u.x - W / 2, 0.4, u.z - H / 2).project(this.camera);
      const sx = (_v.x + 1) / 2 * r.width + r.left, sy = (1 - _v.y) / 2 * r.height + r.top;
      if (sx >= ax - 6 && sx <= bx + 6 && sy >= ay - 6 && sy <= by + 6) out.push(u);
    }
    // přednost bojovým jednotkám
    const army = out.filter((u) => !u.def.worker);
    return army.length ? army : out;
  }
  lookAt(x, z) { this.cam.x = x; this.cam.z = z; }
  viewCorners() {
    if (this.mode !== 'desktop') return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const pts = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]].map(([x, y]) => this.groundAt(x, y) || [this.cam.x, this.cam.z]);
    return pts;
  }
  updateDesktop(dt) {
    const c = this.cam;
    // posun: WASD/šipky (když nejsou klávesovou zkratkou) a okraj obrazovky
    let mx = 0, mz = 0;
    const k = this.keys;
    if (k.has('ArrowLeft')) mx -= 1; if (k.has('ArrowRight')) mx += 1; if (k.has('ArrowUp')) mz -= 1; if (k.has('ArrowDown')) mz += 1;
    if (this.mouse.inside && !this.mouse.down) {
      const m = 8;
      if (this.mouse.x < m) mx -= 1; if (this.mouse.x > window.innerWidth - m) mx += 1;
      if (this.mouse.y < m) mz -= 1; if (this.mouse.y > window.innerHeight - m) mz += 1;
    }
    if (k.has('PageUp') || k.has('[')) c.yaw += dt * 1.5; if (k.has('PageDown') || k.has(']')) c.yaw -= dt * 1.5;
    const sp = c.dist * 0.9 * dt;
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    c.x += (mx * co + mz * s) * sp; c.z += (-mx * s + mz * co) * sp;
    c.x = THREE.MathUtils.clamp(c.x, 0, W); c.z = THREE.MathUtils.clamp(c.z, 0, H);
    const tx = c.x - W / 2, tz = c.z - H / 2;
    this.camera.position.set(tx + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, Math.sin(c.pitch) * c.dist, tz + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
    this.camera.lookAt(tx, 0, tz);
    // hover, ghost, obdélník
    const h = this.mouse.inside ? this.mouseHit(this.mouse.x, this.mouse.y) : null;
    this.hover = h?.ent || null;
    this.updateArmedVisuals(h);
    const d = this.mouse.down;
    const sr = this.world.selRect;
    if (d && d.b === 0 && Math.hypot(this.mouse.x - d.x, this.mouse.y - d.y) > 6) {
      const a = this.groundAt(d.x, d.y), b = this.groundAt(this.mouse.x, this.mouse.y);
      document.getElementById('selbox').style.cssText = `display:block;left:${Math.min(d.x, this.mouse.x)}px;top:${Math.min(d.y, this.mouse.y)}px;width:${Math.abs(this.mouse.x - d.x)}px;height:${Math.abs(this.mouse.y - d.y)}px`;
      sr.visible = false;
      void a; void b;
    } else document.getElementById('selbox').style.display = 'none';
    this.renderer.domElement.style.cursor = this.placing || this.casting || this.attackMoveArmed ? 'crosshair' : this.hover && this.hover.team === 1 && this.selection.size ? 'crosshair' : 'default';
  }
  /** Ghost stavby, kruh kouzla, kurzor – podle bodu pod ukazatelem. */
  updateArmedVisuals(h) {
    const w = this.world;
    if (this.placing && h) {
      const d = BUILDINGS[this.placing];
      const bx = Math.round(h.x - d.w / 2), bz = Math.round(h.z - d.h / 2);
      w.showGhost(this.placing, bx, bz, this.game.canPlace(this.placing, bx, bz, 0) && !this.game.buildBlocker(0, this.placing));
    } else w.showGhost(null);
    if (this.casting && h) {
      const A = ABILITIES[this.casting];
      w.aoe.visible = true;
      const r = A.radius || 0.7;
      w.aoe.scale.set(r, 1, r);
      w.aoe.position.set(h.ent && A.target === 'ally' ? h.ent.x : h.x, 0.06, h.ent && A.target === 'ally' ? h.ent.z : h.z);
      w.aoe.material.color.set(A.target === 'ally' ? '#aaffc8' : '#9fd8ff');
    } else w.aoe.visible = false;
  }

  // ================================================================== DOM menu (PC)
  openDomMenu(kind) {
    const m = document.getElementById('menu');
    const g = this.game;
    this.domMenuOpen = kind;
    this.paused = true;
    let html = '';
    if (kind === 'pause') {
      html = `<h2>Pauza</h2>
        <button class="big" data-a="resume">▶ Pokračovat</button>
        <button class="big" data-a="restart">↻ Nová hra</button>
        <button class="big" data-a="gfx">${this.gfx.label()}<small>Nízká · Střední · Vysoká · Ultra</small></button>
        <button class="big" data-a="fps">Ukazatel FPS: ${this.gfx.s.fps ? 'zapnutý' : 'vypnutý'}</button>
        <button class="big" data-a="vol">Hlasitost: ${Math.round(this.sfx.volume * 100)} %</button>
        <button class="big" data-a="quit">⌂ Hlavní menu</button>
        <div class="controls">${CONTROLS_PC}</div>`;
    } else {
      const win = kind === 'win';
      html = `<h2>${win ? '🏆 Vítězství!' : '💀 Porážka'}</h2>
        <p class="sub">${win ? 'Klan Popela je poražen. Říše slaví!' : 'Tvá základna padla. Zkus to znovu.'}</p>
        <div class="stats">Čas ${fmtTime(g.time)} · vycvičeno ${g.stats.trained} · padlých nepřátel ${g.stats.killed} · ztráty ${g.stats.lost}<br>vytěženo 🪙 ${g.stats.gold} · 🪵 ${g.stats.wood}</div>
        <button class="big" data-a="restart">↻ Hrát znovu</button>
        <button class="big" data-a="quit">⌂ Hlavní menu</button>`;
    }
    m.innerHTML = `<div class="card">${html}</div>`;
    m.classList.add('on');
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.menuAction(b.dataset.a)));
  }
  closeDomMenu() { document.getElementById('menu').classList.remove('on'); this.domMenuOpen = null; this.paused = false; }
  menuAction(a) {
    this.sfx.play('click');
    if (a === 'resume') this.closeDomMenu();
    else if (a === 'restart') { this.closeDomMenu(); this.newGame({ test: this.game.test }); }
    else if (a === 'gfx') { this.gfx.cycle(); this.openDomMenu('pause'); }
    else if (a === 'fps') { this.gfx.toggleFps(); this.openDomMenu('pause'); }
    else if (a === 'vol') { const v = [0, 0.4, 0.8, 1][([0, 0.4, 0.8, 1].indexOf(this.sfx.volume) + 1) % 4] ?? 0.8; this.sfx.setVolume(v); this.openDomMenu('pause'); }
    else if (a === 'quit') { this.closeDomMenu(); this.mode = 'menu'; this.hud.show(false); document.getElementById('start').classList.remove('hidden'); }
  }

  // ================================================================== VR / MR vstupy
  setupXR() {
    const r = this.renderer;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const wandGeo = merge([
      part(new THREE.CylinderGeometry(0.008, 0.011, 0.14, 6), '#6b4a2b', { pos: [0, 0, -0.02], rot: [Math.PI / 2, 0, 0] }),
      part(new THREE.OctahedronGeometry(0.014, 0), '#bff6ff', { pos: [0, 0, -0.1], scale: [1, 1, 1.6] }),
    ]);
    for (let i = 0; i < 2; i++) {
      const c = r.xr.getController(i);
      this.scene.add(c);
      const ptr = {
        index: i, controller: c, inputSource: null, origin: new THREE.Vector3(), dir: new THREE.Vector3(), mode: null, src: null,
        pinching: false, pinchPoint: new THREE.Vector3(), hasJoints: false, panLast: new THREE.Vector3(), hover: null, press: null,
      };
      const wand = new THREE.Mesh(wandGeo, new THREE.MeshStandardMaterial({ vertexColors: true }));
      wand.visible = false; c.add(wand);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.7, toneMapped: false }));
      line.visible = false; c.add(line);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff6c8', toneMapped: false, depthTest: false }));
      dot.renderOrder = 45; dot.visible = false; this.scene.add(dot);
      const pinchDot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshBasicMaterial({ color: '#5ff4ff', toneMapped: false, transparent: true, opacity: 0.9 }));
      pinchDot.visible = false; this.scene.add(pinchDot);
      Object.assign(ptr, { wand, line, dot, pinchDot });
      c.addEventListener('connected', (ev) => {
        ptr.inputSource = ev.data;
        ptr.isHand = !!ev.data.hand;
        ptr.hand = r.xr.getHand(i);
        wand.visible = !ptr.isHand;
        line.visible = true;
      });
      c.addEventListener('disconnected', () => {
        if (ptr.mode) this.release(ptr);
        ptr.inputSource = null; ptr.hasJoints = false; ptr.pinching = false; ptr.sysSelect = false;
        wand.visible = line.visible = dot.visible = pinchDot.visible = false;
      });
      c.addEventListener('selectstart', () => {
        if (ptr.isHand) { ptr.sysSelect = true; ptr.sysSeen = true; ptr.sysEdge = (ptr.sysEdge || 0) + 1; }
        if (!(ptr.isHand && ptr.hasJoints)) this.press(ptr, 'select');
      });
      c.addEventListener('selectend', () => {
        if (ptr.isHand) ptr.sysSelect = false;
        if (!(ptr.isHand && ptr.hasJoints) || ptr.src === 'select') this.release(ptr, 'select');
      });
      // u rukou squeeze ignorujeme (Quest ho hlásí i při sevření pěsti)
      c.addEventListener('squeezestart', () => { if (!ptr.isHand) this.press(ptr, 'squeeze'); });
      c.addEventListener('squeezeend', () => { if (!ptr.isHand) this.release(ptr, 'squeeze'); });
      const hand = r.xr.getHand(i);
      this.scene.add(hand);
      ptr.hand = hand;
      this.pointers.push(ptr);
    }
    this.handsFx = new HandVisuals(this);
  }
  buildHandles() {
    // zlatá madla na bližší hraně desky: jedno = posun, obě = zoom + otočení
    this.handles = new THREE.Group();
    this.handles.visible = false;
    this.scene.add(this.handles);
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#7a4a00', emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.5 });
    const geo = merge([
      part(new THREE.CylinderGeometry(0.03, 0.036, 0.012, 16), '#2b3c63', { pos: [0, 0.006, 0] }),
      part(new THREE.CapsuleGeometry(0.013, 0.06, 4, 10), '#ffcf4a', { pos: [0, 0.055, 0] }),
      part(new THREE.SphereGeometry(0.018, 12, 8), '#ffe27a', { pos: [0, 0.1, 0] }),
    ]);
    this.handleObjs = [0, 1].map(() => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#6a4000', emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.4 }));
      this.handles.add(m);
      return { m, holder: null, hover: 0 };
    });
    void gold;
  }
  placeHandles() {
    const b = this.world.board;
    const cam = this.renderer.xr.getCamera();
    const head = _v.setFromMatrixPosition(cam.matrixWorld);
    // bližší hrana: podle směru k hlavě v lokálu desky
    const loc = b.worldToLocal(head.clone());
    const half = W / 2 + 1.0;
    let ex, ez, ax, az;
    if (Math.abs(loc.z) >= Math.abs(loc.x)) { ex = 0; ez = Math.sign(loc.z || 1) * half; ax = 1; az = 0; } else { ex = Math.sign(loc.x) * half; ez = 0; ax = 0; az = 1; }
    const s = b.scale.x;
    const off = Math.min(W / 2 * 0.85, 0.42 / s);
    const p0 = b.localToWorld(new THREE.Vector3(ex - ax * off, 0.2, ez - az * off));
    const p1 = b.localToWorld(new THREE.Vector3(ex + ax * off, 0.2, ez + az * off));
    // levé madlo vlevo z pohledu hráče
    const right = _v2.set(1, 0, 0).applyQuaternion(cam.getWorldQuaternion(_q));
    const swap = p1.clone().sub(p0).dot(right) < 0;
    this.handleObjs[0].pos = swap ? p1 : p0;
    this.handleObjs[1].pos = swap ? p0 : p1;
  }
  pointerRay(ptr) {
    ptr.controller.updateMatrixWorld();
    ptr.origin.setFromMatrixPosition(ptr.controller.matrixWorld);
    ptr.dir.set(0, 0, -1).transformDirection(ptr.controller.matrixWorld);
  }
  pointerPos(ptr) { return ptr.isHand && ptr.hasJoints ? ptr.pinchPoint : ptr.origin; }
  /** Klouby ruky → bod štípnutí + detekce (hystereze + systémové select). Převzato z Obrany Království. */
  updateHand(ptr, dt) {
    const j = ptr.hand?.joints;
    const tt = j?.['thumb-tip'], it = j?.['index-finger-tip'];
    const ok = ptr.isHand && tt && it && tt.visible && it.visible;
    if (!ok) {
      if (ptr.hasJoints && ptr.pinching) {
        ptr.lostT = (ptr.lostT || 0) + dt;
        if (ptr.lostT < 0.4) return;
        ptr.pinching = false;
        if (ptr.src === 'pinch') this.release(ptr, 'pinch');
      }
      ptr.hasJoints = false; ptr.pinchDot.visible = false; ptr.fp = null;
      return;
    }
    ptr.lostT = 0;
    ptr.hasJoints = true;
    const a = tt.getWorldPosition(_v), b = it.getWorldPosition(_v2);
    const d = a.distanceTo(b);
    const raw = a.clone().add(b).multiplyScalar(0.5);
    if (!ptr.fp) { ptr.fp = raw.clone(); ptr.fv = 0; }
    const sp = raw.distanceTo(ptr.fp) / Math.max(dt, 1e-3);
    ptr.fv += (sp - ptr.fv) * 0.5;
    const tau = 1 / (2 * Math.PI * (1.4 + 7 * ptr.fv));
    ptr.fp.lerp(raw, 1 / (1 + tau / Math.max(dt, 1e-3)));
    ptr.pinchPoint.copy(ptr.fp);
    ptr.pinchDot.visible = true;
    ptr.pinchDot.position.copy(ptr.pinchPoint);
    ptr.pinchDot.material.color.set(ptr.pinching ? '#ffe066' : '#5ff4ff');
    ptr.tip = it.getWorldPosition(ptr.tip || new THREE.Vector3());
    const rad = (tt.jointRadius || 0.008) + (it.jointRadius || 0.008);
    const edge = (ptr.sysEdge || 0) !== (ptr.sysEdgeSeen || 0);
    ptr.sysEdgeSeen = ptr.sysEdge || 0;
    const on = ptr.sysSeen ? ptr.sysSelect || edge || d < (rad + 0.008) * 0.8 : d < rad + 0.008;
    const off = ptr.sysSeen ? !ptr.sysSelect && d > rad + 0.018 : d > rad + 0.026;
    if (ptr.pinching && d > rad + 0.05) ptr.openT = (ptr.openT || 0) + dt; else ptr.openT = 0;
    if (ptr.openT > 0.3) { ptr.sysSelect = false; ptr.openT = 0; }
    if (!ptr.pinching && on) { ptr.pinching = true; this.press(ptr, 'pinch'); }
    else if (ptr.pinching && off) { ptr.pinching = false; this.release(ptr, 'pinch'); }
    if (ptr.mode && !ptr.pinching && ptr.src === 'pinch') this.release(ptr, 'pinch');
  }
  /** Co je pod ukazatelem: panel, madlo, nebo místo na desce. */
  computeHover(ptr) {
    const P = this.pointerPos(ptr);
    // panely (paprskem; u ruky i šťouchnutím)
    const panels = [];
    if (this.menu.mesh.visible) panels.push(this.menu);
    if (this.card.mesh.visible && this.cardHand !== ptr) panels.push(this.card);
    if (panels.length) {
      this.raycaster.set(ptr.origin, ptr.dir);
      this.raycaster.far = 3;
      const hits = this.raycaster.intersectObjects(panels.map((p) => p.mesh), false);
      if (hits.length && hits[0].uv) {
        const panel = hits[0].object.userData.panel;
        return { type: 'panel', panel, btn: panel.hitUV(hits[0].uv.x, hits[0].uv.y), point: hits[0].point, dist: hits[0].distance };
      }
      if (this.menu.mesh.visible) return null; // při menu nic jiného
    }
    if (this.menuOpen) return null;
    // madla
    if (this.handles.visible) {
      for (let k = 0; k < 2; k++) {
        const h = this.handleObjs[k];
        if (h.holder && h.holder !== ptr) continue;
        const c = _v3.copy(h.pos).setY(h.pos.y + 0.06);
        if (ptr.isHand && ptr.hasJoints && P.distanceTo(c) < 0.07) return { type: 'handle', k, point: c.clone() };
        const t = _v.subVectors(c, ptr.origin).dot(ptr.dir);
        if (t > 0 && _v2.copy(ptr.origin).addScaledVector(ptr.dir, t).distanceTo(c) < 0.05) return { type: 'handle', k, point: c.clone(), dist: t };
      }
    }
    // deska: přímý dotek (ruka těsně nad stolem) nebo paprsek
    const map = this.world.map;
    if (ptr.isHand && ptr.hasJoints) {
      const L = map.worldToLocal(_v.copy(P));
      if (L.x > -0.5 && L.x < W + 0.5 && L.z > -0.5 && L.z < H + 0.5 && L.y > -1 && L.y < 2.6) {
        const r = this.pickRay(_v2.copy(P).addScaledVector(this.upWorld(), 0.12), _v3.copy(this.upWorld()).negate());
        if (r) return { type: 'board', ...r, touch: true, point: P.clone() };
      }
    }
    const r = this.pickRay(ptr.origin, ptr.dir);
    if (r) {
      const wp = map.localToWorld(new THREE.Vector3(r.x, 0.05, r.z));
      if (r.x < -2 || r.x > W + 2 || r.z < -2 || r.z > H + 2) return null;
      return { type: 'board', ...r, touch: false, point: wp, dist: wp.distanceTo(ptr.origin) };
    }
    return null;
  }
  upWorld() { return new THREE.Vector3(0, 1, 0); } // deska se naklání jen kolem svislé osy
  press(ptr, src) {
    if (ptr.mode) return;
    ptr.src = src;
    const h = this.computeHover(ptr);
    ptr.pressHover = h;
    this.haptic(ptr, 0.2, 20);
    if (src === 'squeeze') {
      ptr.mode = 'pan'; ptr.panLast.copy(this.pointerPos(ptr)); this.snapshotPan();
      return;
    }
    if (!h) return;
    if (h.type === 'panel') {
      ptr.mode = 'ui';
      ptr.uiBtn = h.btn; ptr.uiPanel = h.panel; ptr.uiT = performance.now();
      if (h.btn) { h.panel.pressId = h.btn.id; this.sfx.play('click'); }
      return;
    }
    if (h.type === 'handle') {
      ptr.mode = 'pan'; ptr.panHandle = h.k; this.handleObjs[h.k].holder = ptr;
      ptr.panLast.copy(this.pointerPos(ptr)); this.snapshotPan();
      this.sfx.play('grab');
      return;
    }
    if (h.type === 'board') {
      if (this.placing || this.casting) { this.useArmed(h.x, h.z, h.ent); return; }
      if (this.attackMoveArmed) { this.orderAt(h.x, h.z, h.ent); return; }
      ptr.mode = 'pending';
      ptr.start = { x: h.x, z: h.z, ent: h.ent, wp: this.pointerPos(ptr).clone(), t: performance.now(), touch: h.touch };
    }
  }
  release(ptr, src) {
    const m = ptr.mode;
    ptr.mode = null;
    ptr.src = null;
    if (m === 'ui') {
      const h = this.computeHover(ptr);
      const held = performance.now() - ptr.uiT;
      if (ptr.uiPanel) ptr.uiPanel.pressId = null;
      if (h?.type === 'panel' && h.btn && ptr.uiBtn && h.btn.id === ptr.uiBtn.id) this.activateButton(h.btn, held > 600);
      ptr.uiBtn = null;
      return;
    }
    if (m === 'pan') {
      if (ptr.panHandle != null) { this.handleObjs[ptr.panHandle].holder = null; ptr.panHandle = null; }
      this.snapshotPan();
      return;
    }
    if (m === 'brush') {
      const n = this.brushSet?.size || 0;
      if (n) this.select([...this.brushSet].map((id) => this.game.get(id)));
      else this.deselect();
      this.brushSet = null;
      this.world.brush.visible = false;
      this.haptic(ptr, 0.3, 40);
      return;
    }
    if (m === 'pending') {
      const s = ptr.start;
      const e = s.ent;
      const now = performance.now();
      const sel = this.selectedEnts();
      const ownSel = sel.length && sel[0].team === 0;
      if (e && e.team === 0 && (e.kind === 'unit' || e.kind === 'building')) {
        // opravit/pomoct stavět: dělníci + rozestavěná budova
        if (e.kind === 'building' && !e.done && ownSel && sel.some((u) => u.kind === 'unit' && u.def.worker)) { this.orderAt(s.x, s.z, e); return; }
        if (e.kind === 'unit' && this.lastTap && this.lastTap.id === e.id && now - this.lastTap.t < 450) this.selectSameType(e);
        else this.select([e]);
        this.lastTap = { id: e.id, t: now };
        return;
      }
      if (ownSel) { this.orderAt(s.x, s.z, e); this.haptic(ptr, 0.25, 30); return; }
      if (e) this.select([e]);
    }
  }
  activateButton(b, held) {
    if (held && b.hold) { b.hold(); return; }
    if (b.disabled) { this.deny(b.why); return; }
    b.action?.();
  }
  snapshotPan() {
    const pans = this.pointers.filter((p) => p.mode === 'pan');
    for (const p of pans) p.panLast.copy(this.pointerPos(p));
    const b = this.world.board;
    if (pans.length >= 2) {
      this.pan2 = { a: this.pointerPos(pans[0]).clone(), b: this.pointerPos(pans[1]).clone(), pa: pans[0], pb: pans[1], p0: b.position.clone(), yaw0: b.rotation.y, s0: b.scale.x };
    } else this.pan2 = null;
  }
  applyPan() {
    const pans = this.pointers.filter((p) => p.mode === 'pan');
    const board = this.world.board;
    if (pans.length >= 2 && this.pan2) {
      const P2 = this.pan2;
      const A = this.pointerPos(P2.pa), B = this.pointerPos(P2.pb);
      const d0 = Math.max(0.03, P2.a.distanceTo(P2.b)), d1 = A.distanceTo(B);
      let ratio = d1 / d0;
      const DZ = 0.07;
      ratio = ratio > 1 + DZ ? ratio / (1 + DZ) : ratio < 1 - DZ ? ratio / (1 - DZ) : 1;
      const s = THREE.MathUtils.clamp(P2.s0 * ratio, SCALE_MIN, SCALE_MAX);
      const ang = (x, z) => Math.atan2(x, z);
      let da = ang(B.x - A.x, B.z - A.z) - ang(P2.b.x - P2.a.x, P2.b.z - P2.a.z);
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const RZ = 0.12;
      da = Math.abs(da) < RZ ? 0 : da - Math.sign(da) * RZ;
      const yaw = P2.yaw0 + da;
      const mid0 = _v.addVectors(P2.a, P2.b).multiplyScalar(0.5);
      const mid1 = _v2.addVectors(A, B).multiplyScalar(0.5);
      const dx = mid0.x - P2.p0.x, dy = mid0.y - P2.p0.y, dz = mid0.z - P2.p0.z;
      const c0 = Math.cos(-P2.yaw0), s0 = Math.sin(-P2.yaw0);
      const lx = (dx * c0 + dz * s0) / P2.s0, ly = dy / P2.s0, lz = (-dx * s0 + dz * c0) / P2.s0;
      const c1 = Math.cos(yaw), s1 = Math.sin(yaw);
      board.position.set(mid1.x - (lx * c1 + lz * s1) * s, mid1.y - ly * s, mid1.z - (-lx * s1 + lz * c1) * s);
      board.rotation.y = yaw;
      board.scale.setScalar(s);
    } else if (pans.length === 1) {
      const p = pans[0];
      const cur = this.pointerPos(p);
      const d = _v.subVectors(cur, p.panLast);
      board.position.add(d);
      p.panLast.copy(cur);
    }
  }
  haptic(ptr, intensity, ms) {
    try { ptr.inputSource?.gamepad?.hapticActuators?.[0]?.pulse(intensity, ms); } catch (e) { /* bez haptiky */ }
  }
  hapticAll(i, ms) { for (const p of this.pointers) this.haptic(p, i, ms); }

  /** Velitelská karta: levá dlaň otočená k obličeji (ruce) / nad levým ovladačem. */
  updateCard(dt, head) {
    const lefty = this.settings.lefty;
    const cardSide = lefty ? 'right' : 'left';
    const ptr = this.pointers.find((p) => p.inputSource?.handedness === cardSide);
    let show = false;
    const card = this.card.mesh;
    if (ptr && !this.menuOpen) {
      if (ptr.isHand && ptr.hasJoints) {
        const j = ptr.hand.joints;
        const wr = j.wrist, im = j['index-finger-metacarpal'], pm = j['pinky-finger-metacarpal'], mm = j['middle-finger-phalanx-proximal'];
        if (wr?.visible && im && pm && mm) {
          const w = wr.getWorldPosition(new THREE.Vector3());
          const a = im.getWorldPosition(new THREE.Vector3()).sub(w), b = pm.getWorldPosition(new THREE.Vector3()).sub(w);
          const n = new THREE.Vector3().crossVectors(a, b).normalize();
          if (cardSide === 'right') n.negate();
          const toHead = head.clone().sub(w).normalize();
          const facing = n.dot(toHead);
          this.cardFacing = facing > (this.cardShown ? 0.25 : 0.5);
          if (this.cardFacing && ptr.mode == null) {
            show = true;
            const fing = mm.getWorldPosition(new THREE.Vector3());
            const target = w.clone().lerp(fing, 0.5).addScaledVector(n, 0.07).add(new THREE.Vector3(0, 0.1, 0));
            if (!this.cardShown) card.position.copy(target); else card.position.lerp(target, Math.min(1, dt * 14));
            card.lookAt(head);
          }
        }
      } else if (!ptr.isHand && ptr.inputSource) {
        show = !this.cardHidden;
        const target = _v.copy(ptr.origin).add(new THREE.Vector3(0, 0.17, 0)).addScaledVector(ptr.dir, 0.05);
        card.position.lerp(target, this.cardShown ? Math.min(1, dt * 16) : 1);
        card.lookAt(head);
      }
    }
    this.cardShown = show;
    this.cardHand = show ? ptr : null;
    card.visible = show;
    if (show) this.card.draw(this, buildCard(this));
  }
  updateXR(dt, frame) {
    if (!this.placedXR) this.placeBoardXR();
    const cam = this.renderer.xr.getCamera();
    cam.updateMatrixWorld();
    const head = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    for (const ptr of this.pointers) {
      if (!ptr.inputSource) continue;
      this.pointerRay(ptr);
      if (ptr.isHand) this.updateHand(ptr, dt);
      this.readGamepad(ptr, dt);
    }
    this.updateCard(dt, head);
    // taktický čas: karta otevřená → zpomalit
    this.slowmo = this.settings.slowmo && !!this.cardShown && this.cardHand?.isHand;
    // madla
    this.handles.visible = !this.menuOpen;
    if (this.handles.visible) {
      this.placeHandles();
      for (const h of this.handleObjs) {
        const P = h.holder ? this.pointerPos(h.holder) : null;
        if (P) h.m.position.set(P.x, P.y - 0.06, P.z); else h.m.position.copy(h.pos);
        h.m.scale.setScalar(1 + h.hover * 0.2);
        h.m.material.emissiveIntensity = 0.5 + h.hover * 1.2;
        h.hover *= 0.85;
      }
    }
    // ukazatele
    let aimH = null;
    this.hover = null;
    this.card.hoverId = null;
    let menuHover = null;
    for (const ptr of this.pointers) {
      if (!ptr.inputSource) continue;
      const h = this.computeHover(ptr);
      ptr.hover = h;
      // poke: špička ukazováčku u tlačítka panelu
      if (ptr.isHand && ptr.hasJoints && ptr.tip && ptr.mode == null) this.checkPoke(ptr);
      let len = 1.2;
      if (h?.type === 'panel') { len = h.dist; if (h.panel === this.card) this.card.hoverId = h.btn?.id || null; else menuHover = h.btn?.id || null; }
      else if (h?.type === 'handle') { this.handleObjs[h.k].hover = 1; len = h.dist || 0.3; }
      else if (h?.type === 'board') { len = h.touch ? 0.05 : h.dist; if (!aimH || ptr.inputSource.handedness === (this.settings.lefty ? 'left' : 'right')) aimH = h; }
      ptr.line.scale.z = Math.max(0.02, len);
      // u ruky schovej paprsek, když ruka „sahá“ přímo na stůl
      ptr.line.visible = !(h?.touch) && !(this.cardHand === ptr);
      ptr.dot.visible = !!h && !h.touch && h.type !== 'panel';
      if (ptr.dot.visible) ptr.dot.position.copy(h.point);
      // režimy
      if (ptr.mode === 'pending') {
        const s = ptr.start;
        const moved = this.pointerPos(ptr).distanceTo(s.wp);
        const movedMap = h?.type === 'board' ? Math.hypot(h.x - s.x, h.z - s.z) : 0;
        if ((s.touch && moved > 0.022) || (!s.touch && movedMap > 1.1)) {
          ptr.mode = 'brush';
          this.brushSet = new Set();
          this.sfx.play('grab');
        }
      }
      if (ptr.mode === 'brush' && h?.type === 'board') {
        const r = Math.max(0.9, 0.028 / this.world.board.scale.x);
        for (const u of this.game.unitsInCircle(h.x, h.z, r, 0)) if (!this.brushSet.has(u.id)) { this.brushSet.add(u.id); this.haptic(ptr, 0.15, 12); this.sfx.play('pinch', { minGap: 0.04 }); }
        // pokud štětec obsahuje bojové jednotky, dělníky vynech (pokud je nechceš explicitně)
        const b = this.world.brush;
        b.visible = true; b.position.set(h.x, 0.08, h.z); b.scale.set(r, 1, r);
      }
    }
    if (this.pointers.some((p) => p.mode === 'pan')) this.applyPan();
    // náhled výběru štětcem
    this.previewSel = this.brushSet ? new Set(this.brushSet) : null;
    this.hover = aimH?.ent || null;
    this.aimHit = aimH;
    this.updateArmedVisuals(aimH);
    // kurzor na mapě podle toho, co by se stalo
    const cur = this.world.cursor;
    if (aimH && !this.placing) {
      cur.visible = true;
      cur.position.set(aimH.x, 0.07, aimH.z);
      const s = Math.max(0.5, 0.012 / this.world.board.scale.x);
      cur.scale.set(s, 1, s);
      const e = aimH.ent, sel = this.selectedEnts(), own = sel.length && sel[0].team === 0 && sel[0].kind === 'unit';
      cur.material.color.set(this.attackMoveArmed ? '#ff7a5a' : !own ? '#ffffff' : e && e.team === 1 ? '#ff5a4a' : e && (e.kind === 'mine' || e.kind === 'tree') ? '#ffd84a' : e && e.team === 0 ? '#6dff7a' : '#9fffc0');
    } else cur.visible = false;
    // banner a menu
    this.placeBanner(head);
    if (this.menuOpen) this.drawMenu(menuHover);
    this.handsFx.update(dt);
  }
  checkPoke(ptr) {
    const panels = [this.menu, this.card].filter((p) => p.mesh.visible && !(p === this.card && this.cardHand === ptr));
    for (const p of panels) {
      const L = p.mesh.worldToLocal(_v.copy(ptr.tip));
      const gp = p.mesh.geometry.parameters;
      const inside = Math.abs(L.x) < gp.width / 2 && Math.abs(L.y) < gp.height / 2;
      const near = inside && L.z < 0.012 && L.z > -0.03;
      if (near && !ptr.poked) {
        const b = p.hitUV(L.x / gp.width + 0.5, L.y / gp.height + 0.5);
        ptr.poked = true;
        if (b && performance.now() - (this.lastPoke || 0) > 300) {
          this.lastPoke = performance.now();
          this.haptic(ptr, 0.4, 30);
          this.sfx.play('click');
          this.activateButton(b, false);
        }
      } else if (!inside || L.z > 0.03) ptr.poked = false;
    }
  }
  readGamepad(ptr, dt) {
    const gp = ptr.inputSource?.gamepad;
    if (!gp || ptr.isHand) return;
    const ax = gp.axes || [];
    const x = ax[2] || 0, y = ax[3] || 0;
    const b = this.world.board;
    if (ptr.inputSource.handedness === 'right') {
      // pravá páčka: otáčení desky po krocích, nahoru/dolů zoom
      if (Math.abs(x) > 0.7 && !ptr.snapLock) { ptr.snapLock = true; b.rotation.y -= Math.sign(x) * Math.PI / 6; }
      if (Math.abs(x) < 0.3) ptr.snapLock = false;
      if (Math.abs(y) > 0.3) {
        const s0 = b.scale.x, s = THREE.MathUtils.clamp(s0 * (1 - y * dt * 1.2), SCALE_MIN, SCALE_MAX);
        // zoom kolem bodu pod paprskem
        const pivot = this.aimHit ? this.world.map.localToWorld(new THREE.Vector3(this.aimHit.x, 0, this.aimHit.z)) : b.position.clone();
        b.position.sub(pivot).multiplyScalar(s / s0).add(pivot);
        b.scale.setScalar(s);
      }
      const B = gp.buttons || [];
      if (B[4]?.pressed && !ptr.aLock) { ptr.aLock = true; this.deselect(); } // A = zrušit výběr
      if (!B[4]?.pressed) ptr.aLock = false;
    } else {
      // levá páčka: posun desky
      if (Math.abs(x) > 0.2 || Math.abs(y) > 0.2) {
        const cam = this.renderer.xr.getCamera();
        const f = _v.set(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(_q)); f.y = 0; f.normalize();
        const r = _v2.set(-f.z, 0, f.x);
        b.position.addScaledVector(r, -x * dt * 0.6).addScaledVector(f, y * dt * 0.6);
      }
      const B = gp.buttons || [];
      if (B[4]?.pressed && !ptr.xLock) { ptr.xLock = true; this.cardHidden = !this.cardHidden; } // X = karta
      if (!B[4]?.pressed) ptr.xLock = false;
      if (B[5]?.pressed && !ptr.yLock) { ptr.yLock = true; this.openMenu(); } // Y = menu
      if (!B[5]?.pressed) ptr.yLock = false;
    }
  }
  placeBanner(head) {
    const b = this.world.board;
    const m = this.banner.mesh;
    m.visible = !this.menuOpen || this.menuOpen === 'pause';
    // nad protější hranou desky
    const loc = b.worldToLocal(head.clone());
    const dir = new THREE.Vector3(loc.x, 0, loc.z).normalize();
    const far = new THREE.Vector3(-dir.x * (W / 2 + 2), 0, -dir.z * (H / 2 + 2));
    const wp = b.localToWorld(far);
    wp.y += 0.22;
    m.position.copy(wp);
    m.lookAt(head.x, wp.y, head.z);
    const s = Math.max(0.8, Math.min(1.6, b.scale.x / VR_SCALE));
    m.scale.setScalar(s);
    this.banner.draw(this);
  }

  // ---- VR menu
  openMenu(kind = 'pause') {
    if (!this.xr) { this.openDomMenu('pause'); return; }
    this.menuOpen = kind;
    const cam = this.renderer.xr.getCamera();
    cam.updateMatrixWorld();
    const head = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(_q)); f.y = 0; f.normalize();
    this.menu.mesh.position.copy(head).addScaledVector(f, 0.62);
    this.menu.mesh.position.y = head.y - 0.08;
    this.menu.mesh.lookAt(head);
    this.menu.mesh.visible = true;
    this.menu.key = '';
  }
  closeMenu() { this.menuOpen = null; this.menu.mesh.visible = false; }
  menuModel() {
    const g = this.game, s = this.settings;
    const k = this.menuOpen;
    const settingsItems = [
      { id: 'slow', label: `Taktický čas: ${s.slowmo ? 'zapnutý' : 'vypnutý'}`, sub: 'Při otevřené kartě na dlani se hra zpomalí', on: s.slowmo, action: () => { s.slowmo = !s.slowmo; this.saveSettings(); } },
      { id: 'lefty', label: `Karta na ${s.lefty ? 'pravé' : 'levé'} ruce`, sub: 'Pro leváky přepni na pravou', action: () => { s.lefty = !s.lefty; this.saveSettings(); } },
      { id: 'hands', label: this.handsFx.label(), action: () => this.handsFx.cycle() },
      { id: 'vol', label: `Hlasitost: ${Math.round(this.sfx.volume * 100)} %`, action: () => { const L = [0, 0.4, 0.8, 1]; this.sfx.setVolume(L[(L.indexOf(this.sfx.volume) + 1) % 4] ?? 0.8); } },
      { id: 'gfx', label: this.gfx.label(), sub: 'Nízká · Střední · Vysoká · Ultra (stíny, tráva, rozlišení)', action: () => this.gfx.cycle() },
      { id: 'fps', label: `Ukazatel FPS: ${this.gfx.s.fps ? 'zapnutý' : 'vypnutý'}`, action: () => this.gfx.toggleFps() },
    ];
    if (k === 'intro') return {
      title: 'Kroniky Říše',
      text: 'Štípni jednotku = výběr. Táhni prsty po stole = štětec výběru. S výběrem štípni do mapy = rozkaz. Otoč levou dlaň k sobě = velitelská karta (stavby, výcvik, kouzla). Zlatá madla u stolu = posun, obě = zoom a otočení.',
      items: [{ id: 'go', label: '▶ Do boje!', primary: true, sub: `Obtížnost: ${DIFFICULTY[s.difficulty].name}`, action: () => this.closeMenu() }, ...settingsItems.slice(0, 2)],
    };
    if (k === 'win' || k === 'lose') return {
      title: k === 'win' ? '🏆 Vítězství!' : '💀 Porážka',
      text: `Čas ${fmtTime(g.time)} · vycvičeno ${g.stats.trained} · padlých nepřátel ${g.stats.killed} · ztráty ${g.stats.lost} · vytěženo ${g.stats.gold} zlata a ${g.stats.wood} dřeva.`,
      items: [
        { id: 'again', label: '↻ Hrát znovu', primary: true, action: () => { this.closeMenu(); const m = this.mode; this.newGame({ test: g.test }); this.placedXR = false; this.mode = m; } },
        { id: 'exit', label: '⏏ Ukončit VR', action: () => this.renderer.xr.getSession()?.end() },
      ],
    };
    return {
      title: 'Pauza',
      items: [
        { id: 'resume', label: '▶ Pokračovat', primary: true, action: () => this.closeMenu() },
        { id: 'recenter', label: '⌖ Vrátit stůl před sebe', action: () => { this.placedXR = false; this.closeMenu(); } },
        ...settingsItems,
        { id: 'restart', label: '↻ Nová hra', action: () => { this.closeMenu(); this.newGame({ test: g.test }); this.placedXR = false; } },
        { id: 'exit', label: '⏏ Ukončit VR', action: () => this.renderer.xr.getSession()?.end() },
      ],
    };
  }
  drawMenu(hoverId) { this.menu.draw(this.menuModel(), hoverId); }

  // ================================================================== události → zvuk a haptika
  processEvents() {
    const g = this.game;
    const evs = g.events;
    if (!evs.length) return;
    g.events = [];
    for (const ev of evs) {
      this.world.onEvent(ev);
      const d = ev.data;
      const visible = (x, z) => g.visibleAt(x, z);
      const at = (x, z, y = 0.5) => (this.world ? this.world.map.localToWorld(new THREE.Vector3(x, y, z)) : null);
      switch (ev.type) {
        case 'attack': {
          const x = d.x ?? d.cx, z = d.z ?? d.cz;
          if (!visible(x, z)) break;
          this.sfx.play(d.def?.projectile ? 'bow' : 'sword', { vol: 0.35, pos: at(x, z), minGap: 0.07 });
          break;
        }
        case 'death': if (visible(d.x, d.z)) this.sfx.play('death', { vol: 0.5, pos: at(d.x, d.z), minGap: 0.1 }); break;
        case 'collapse': if (g.exploredAt(d.cx, d.cz)) this.sfx.play('collapse', { pos: at(d.cx, d.cz) }); break;
        case 'chop': if (d.team === 0) this.sfx.play('chop', { vol: 0.25, pos: at(d.x, d.z), minGap: 0.2 }); break;
        case 'hammer': if (d.team === 0) this.sfx.play('hammer', { vol: 0.25, pos: at(d.x, d.z), minGap: 0.2 }); break;
        case 'deposit': if (d.team === 0) this.sfx.play('coin', { vol: 0.25, minGap: 0.15 }); break;
        case 'built': if (d.team === 0) { this.sfx.play('built'); this.hapticAll(0.3, 60); } break;
        case 'trained': if (d.team === 0) this.sfx.play('trained', { pos: at(d.x, d.z) }); break;
        case 'heal': this.sfx.play('heal', { pos: at(d.x, d.z) }); break;
        case 'thunder': this.sfx.play('thunder', { pos: at(d.x, d.z) }); if (d.team === 0) this.hapticAll(0.8, 120); break;
        case 'levelup': if (d.team === 0) this.sfx.play('levelup'); break;
        case 'treasure': if (d.team === 0) this.sfx.play('coin'); break;
        case 'msg': if (d.kind === 'alert') { this.sfx.play('alert'); this.hapticAll(0.7, 150); } break;
        case 'end': this.onEnd(d.result); break;
      }
    }
  }
  onEnd(result) {
    if (this.ended) return;
    this.ended = true;
    this.sfx.play(result === 'win' ? 'win' : 'lose');
    try { if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') window.va?.('event', { name: 'game_end', data: { result, mode: this.mode, difficulty: this.settings.difficulty, minutes: Math.round(this.game.time / 60) } }); } catch (e) { /* ignore */ }
    setTimeout(() => { if (this.xr) this.openMenu(result); else this.openDomMenu(result); }, 1800);
  }

  // ================================================================== smyčka
  loop(t, frame) {
    this.gfx.beginFrame();
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, this.lastT ? now - this.lastT : 0.016);
    this.lastT = now;
    if (!this.game) { this.renderer.render(this.scene, this.camera); return; }
    const running = this.mode !== 'menu' && !this.paused && !this.menuOpen && !this.game.over;
    if (this.mode === 'vr' || this.mode === 'ar') this.updateXR(dt, frame);
    else if (this.mode === 'desktop') { this.updateDesktop(dt); this.hud.update(dt); }
    if (running) {
      this.game.speed = this.slowmo ? 0.35 : 1;
      this.game.update(dt);
    }
    // vybrané jednotky, které zemřely, pryč z výběru
    for (const id of this.selection) if (!this.game.get(id)) this.selection.delete(id);
    this.processEvents();
    const sel = this.previewSel || this.selection;
    const scale = this.world.board.scale.x;
    this.world.update(dt, { selection: sel, hover: this.hover, barScale: this.xr ? Math.max(1, 0.03 / scale) * scale : 1, showBars: this.keys.has('Alt') });
    this.sfx.listener(this.xr ? this.renderer.xr.getCamera() : this.camera);
    this.gfx.fitShadow(this.world.board);
    this.renderer.render(this.scene, this.camera);
    this.gfx.endFrame();
  }
}

const CONTROLS_PC = `<b>Levé tlačítko</b> výběr (tažením obdélník, dvojklik = všechny stejné) · <b>Pravé</b> rozkaz (pohyb, útok, těžba, stavba) ·
<b>A</b> útočný pochod · <b>S</b> stůj · <b>D</b> drž pozici · <b>Q/E</b> kouzla hrdiny · <b>Šipky / okraj</b> posun · <b>Kolečko</b> zoom · <b>Prostřední tlačítko, [ ]</b> natočení ·
<b>Ctrl+1–3</b> uložit skupinu · <b>1–3</b> vybrat · <b>F1</b> nečinní dělníci · <b>F2</b> armáda · <b>F3</b> hrdina · <b>Mezerník</b> k poslednímu poplachu · <b>Alt</b> všechny životy · <b>Esc</b> zrušit / pauza`;
export { CONTROLS_PC };
