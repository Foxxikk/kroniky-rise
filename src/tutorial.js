// Interaktivní výuka: krok za krokem, každý krok sám pozná splnění podle stavu hry.
// Ve VR: panel s úkolem vedle stolu + zlatá šipka na stole (nebo zvýrazněná karta na dlani). Na PC: okno vlevo nahoře.
// Během výuky Klan Popela nezaútočí (AI stojí) a hráč dostane malou zásobu surovin navíc.
import * as THREE from 'three';
import { CanvasPanel } from './ui.js';

const t = (vr, pc) => (app) => (app.xr ? vr : pc);
const near = (g, x, z, r) => g.units.some((u) => u.team === 0 && !u.def.worker && Math.hypot(u.x - x, u.z - z) < r);
const count = (g, type) => g.units.filter((u) => u.team === 0 && u.type === type).length + g.buildings.reduce((n, b) => n + (b.team === 0 ? b.queue.filter((q) => q.type === type).length : 0), 0);
const has = (g, type) => g.buildings.some((b) => b.team === 0 && b.type === type) || (g.sites || []).some((s) => s.team === 0 && s.type === type);

export const STEPS = [
  {
    title: 'Vítej, veliteli!',
    text: t('Tohle je tvoje říše na válečném stole. Hrad přímo před tebou je tvoje radnice, vedle je zlatý důl. Klan Popela sídlí na protějším rohu stolu.',
      'Tohle je tvoje říše. Hrad je tvoje radnice, vedle je zlatý důl. Klan Popela sídlí v protějším rohu mapy.'),
    target: (g) => { const b = g.buildings.find((x) => x.team === 0 && x.type === 'townhall'); return b && { x: b.cx, z: b.cz, h: 3.6 }; },
    next: true,
  },
  {
    title: 'Vyber dělníka',
    text: t('Štípni palcem a ukazováčkem jednoho z dělníků u dolu (ukazuje na něj šipka). Na dálku můžeš mířit paprskem z ruky.',
      'Klikni levým tlačítkem na jednoho z dělníků u dolu (ukazuje na něj šipka).'),
    target: (g) => { const u = g.units.find((x) => x.team === 0 && x.def.worker && !x.hidden); return u && { x: u.x, z: u.z, h: 1.4 }; },
    done: (g, app) => app.selectedEnts().some((e) => e.team === 0 && e.def?.worker),
  },
  {
    title: 'Velitelská karta',
    text: t('Otoč levou dlaň k obličeji – objeví se velitelská karta. Pravým ukazováčkem na ní klepni na 🌾 Farma (farmy zvyšují limit armády).',
      'Vpravo dole je velitelská karta. Klikni na 🌾 Farma (nebo klávesa F) – farmy zvyšují limit armády.'),
    card: 'b-farm',
    done: (g, app) => app.placing === 'farm' || has(g, 'farm'),
  },
  {
    title: 'Postav farmu',
    text: t('Štípni na volné místo vedle radnice (zelený náhled = jde to, červený = nejde). Dělník tam doběhne a postaví ji.',
      'Klikni na volné místo vedle radnice (zelený náhled = jde to). Dělník tam doběhne a postaví ji.'),
    target: (g) => { const b = g.buildings.find((x) => x.team === 0 && x.type === 'townhall'); return b && { x: b.cx + 4.5, z: b.cz + 1, h: 0.6 }; },
    done: (g) => has(g, 'farm'),
  },
  {
    title: 'Kasárna',
    text: t('Stejně postav ⚔ Kasárna: vyber dělníka, na kartě klepni Kasárna a štípni místo. Víc dělníků = rychlejší stavba.',
      'Stejně postav ⚔ Kasárna: vyber dělníka, klikni Kasárna (K) a umísti je. Víc dělníků staví rychleji.'),
    card: 'b-barracks',
    done: (g) => has(g, 'barracks'),
  },
  {
    title: 'Počkej na stavbu',
    text: t('Zatímco se staví, mrkni na suroviny nad stolem: 🪙 zlato, 🪵 dřevo, 🍖 jídlo. Dělníci těží sami.',
      'Zatímco se staví, mrkni na suroviny nahoře: 🪙 zlato, 🪵 dřevo, 🍖 jídlo. Dělníci těží sami.'),
    target: (g) => { const b = g.buildings.find((x) => x.team === 0 && x.type === 'barracks'); return b && { x: b.cx, z: b.cz, h: 2.4 }; },
    done: (g) => g.buildings.some((b) => b.team === 0 && b.type === 'barracks' && b.done),
  },
  {
    title: 'Vycvič vojáky',
    text: t('Štípni kasárna a na kartě klepni dvakrát na 🛡 Pěšák. Vojáci se objeví u kasáren.',
      'Klikni na kasárna a dvakrát na 🛡 Pěšák (P). Vojáci se objeví u kasáren.'),
    target: (g) => { const b = g.buildings.find((x) => x.team === 0 && x.type === 'barracks'); return b && { x: b.cx, z: b.cz, h: 2.4 }; },
    done: (g) => count(g, 'footman') >= 2,
  },
  {
    title: 'Vyber armádu',
    text: t('Až budou vojáci venku: štípni nad stolem a táhni prsty přes ně – to je štětec výběru. Kdo je pod ním, je vybraný.',
      'Až budou vojáci venku, táhni přes ně obdélník levým tlačítkem.'),
    target: (g) => { const u = g.units.find((x) => x.team === 0 && x.type === 'footman'); return u && { x: u.x, z: u.z, h: 1.4 }; },
    done: (g, app) => app.selectedEnts().filter((e) => e.team === 0 && e.type === 'footman').length >= 2,
  },
  {
    title: 'Rozkaz a formace',
    text: t('S vybranou armádou štípni kamkoli do mapy = pohyb. Nebo pravou rukou táhni čáru – vojáci se na ni seřadí do formace.',
      'Pravým tlačítkem klikni do mapy = pohyb. Táhnutím pravým tlačítkem nakreslíš formaci.'),
    target: (g) => { const b = g.buildings.find((x) => x.team === 0 && x.type === 'townhall'); return b && { x: b.cx + 6, z: b.cz - 6, h: 0.6 }; },
    done: (g, app, st) => g.units.some((u) => u.team === 0 && u.type === 'footman' && (u.order.type === 'move' || u.order.type === 'amove') && u.order.t0 >= st.t0),
  },
  {
    title: 'Hotovo – do boje!',
    text: t('Výborně! Šipka ukazuje tábor vlků: poraz je pro zlato a zkušenosti hrdiny (povoláš ho v Oltáři hrdinů). Klan Popela teď začne stavět – první útok čekej asi za 7 minut. Karta má i 👁 Do bitvy.',
      'Výborně! Šipka ukazuje tábor vlků: poraz je pro zlato a zkušenosti hrdiny (Oltář hrdinů). Klan Popela teď začne stavět – první útok čekej asi za 7 minut.'),
    target: (g) => { const c = g.camps[0]; return c && { x: c.x, z: c.z, h: 1.4 }; },
    next: true, last: true,
  },
];

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.i = 0;
    this.panel = new CanvasPanel(720, 300, 0.42);
    this.panel.mesh.visible = false;
    this.panel.mesh.renderOrder = 41;
    app.scene.add(this.panel.mesh);
    // šipka na stole (v souřadnicích mapy)
    const g = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: '#ffd84a', toneMapped: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 16).rotateX(Math.PI), gold);
    cone.position.y = 0.45;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), gold);
    stem.position.y = 1.3;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    g.add(cone, stem);
    this.arrow = g;
    this.ring = ring;
    this.arrow.visible = this.ring.visible = false;
    this.el = document.getElementById('tut');
  }
  get step() { return STEPS[this.i]; }
  static seen() { try { return localStorage.getItem('kr-tut') === '1'; } catch (e) { return false; } }
  start() {
    const a = this.app;
    this.active = true;
    this.i = 0;
    a.game.res[0].gold += 300; a.game.res[0].wood += 200; // zásoba navíc pro výuku
    a.game.ai.paused = true;
    a.world.map.add(this.arrow, this.ring);
    this.enter();
  }
  enter() {
    this.st = { t0: this.app.game.time, real: performance.now() };
    this.key = '';
    this.app.sfx.play('trained');
    this.app.hapticAll?.(0.3, 40);
  }
  stop(done = true) {
    const a = this.app;
    this.active = false;
    if (a.game?.ai) a.game.ai.paused = false;
    this.arrow.visible = this.ring.visible = false;
    this.panel.mesh.visible = false;
    if (this.el) this.el.style.display = 'none';
    if (done) try { localStorage.setItem('kr-tut', '1'); } catch (e) { /* bez úložiště */ }
  }
  advance() {
    if (this.step?.last) { this.stop(true); this.app.game.msg(0, 'Výuka dokončena. Hodně štěstí!', 'good'); this.app.sfx.play('levelup'); return; }
    this.i++;
    this.enter();
  }
  /** Tlačítka panelu (VR) / okna (PC). */
  buttons() {
    const s = this.step;
    return s.next ? [{ id: 'tut-next', label: s.last ? 'Hrát!' : 'Dál ▶', action: () => this.advance() }, { id: 'tut-skip', label: 'Přeskočit výuku', action: () => this.stop(true) }]
      : [{ id: 'tut-skip', label: 'Přeskočit výuku', action: () => this.stop(true) }];
  }
  update(dt, head) {
    if (!this.active) return;
    const a = this.app, g = a.game, s = this.step;
    if (!s) { this.stop(true); return; }
    if (s.done && s.done(g, a, this.st)) { this.advance(); return; }
    // šipka
    const tg = s.target?.(g);
    this.arrow.visible = this.ring.visible = !!tg;
    if (tg) {
      const k = a.xr ? Math.max(1, 0.11 / (1.75 * a.world.board.scale.x)) : 1.6; // ve VR ~11 cm vysoká bez ohledu na zoom
      const bob = Math.abs(Math.sin(performance.now() / 260)) * 0.5;
      this.arrow.position.set(tg.x, tg.h + bob * k, tg.z);
      this.arrow.scale.setScalar(k);
      this.ring.position.set(tg.x, 0.08, tg.z);
      this.ring.scale.setScalar(k * (0.9 + bob * 0.3));
    }
    // zvýraznění tlačítka na kartě
    a.cardHighlight = s.card || null;
    const text = s.text(a);
    if (a.xr) {
      if (this.el) this.el.style.display = 'none';
      const m = this.panel.mesh;
      // vlevo nahoře od středu pohledu, líně následuje
      const cam = a.renderer.xr.getCamera();
      const q = cam.getWorldQuaternion(new THREE.Quaternion());
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); f.y = 0; f.normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const target = head.clone().addScaledVector(f, 0.8).addScaledVector(r, -0.28); target.y = head.y - 0.02;
      if (!m.visible || m.position.distanceTo(target) > 0.45) this.moving = true;
      if (this.moving) { m.position.lerp(target, m.visible ? 0.07 : 1); if (m.position.distanceTo(target) < 0.02) this.moving = false; }
      m.lookAt(head);
      m.visible = !a.menuOpen;
      this.draw(s, text);
    } else if (this.el) {
      this.panel.mesh.visible = false;
      const key = this.i + text;
      if (key !== this.key) {
        this.key = key;
        this.el.innerHTML = `<div class="n">Výuka ${this.i + 1}/${STEPS.length}</div><b>${s.title}</b><p>${text}</p><div class="b">${this.buttons().map((b) => `<button data-id="${b.id}">${b.label}</button>`).join('')}</div>`;
        this.el.querySelectorAll('button').forEach((el) => el.addEventListener('click', () => { const b = this.buttons().find((x) => x.id === el.dataset.id); a.sfx.play('click'); b?.action(); }));
      }
      this.el.style.display = 'block';
    }
  }
  draw(s, text) {
    const P = this.panel, key = this.i + text + P.hoverId;
    if (key === P.key) return;
    P.key = key;
    const c = P.ctx, W = P.canvas.width, H = P.canvas.height;
    c.clearRect(0, 0, W, H);
    P.buttons = [];
    P.rr(4, 4, W - 8, H - 8, 28, 'rgba(18,24,42,0.95)', '#ffd84a', 5);
    P.text(`🎓 Výuka ${this.i + 1}/${STEPS.length}`, 28, 36, 22, '#ffd84a', 'left', 800);
    P.text(s.title, 28, 74, 34, '#ffe9a8', 'left', 900, W - 56);
    P.wrap(text, 28, 116, 23, W - 56, 29, '#e3e9f8', 4);
    const bs = this.buttons();
    let x = W - 24;
    for (const b of bs.slice().reverse()) {
      const w = b.id === 'tut-next' ? 170 : 230;
      x -= w;
      const hov = P.hoverId === b.id;
      P.rr(x, H - 70, w, 52, 18, b.id === 'tut-next' ? (hov ? '#4cc25c' : '#3aa84a') : hov ? 'rgba(120,200,255,0.3)' : 'rgba(255,255,255,0.1)', hov ? '#8ff4ff' : 'rgba(255,255,255,0.2)', 3);
      P.text(b.label, x + w / 2, H - 44, 22, '#fff', 'center', 800);
      P.buttons.push({ ...b, x, y: H - 70, w, h: 52 });
      x -= 14;
    }
    P.tex.needsUpdate = true;
  }
}
