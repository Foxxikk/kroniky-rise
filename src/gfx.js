// Nastavení grafiky + ukazatel FPS. Předvolby Nízká / Střední / Vysoká / Ultra (rozlišení, foveace, frekvence,
// stíny, hustota trávy a efektů, stíny mraků). Na Questu musí hra stíhat 72/90 snímků – jinak se obraz trhá.
import { shared } from './shade.js';

export const PRESETS = {
  nizka: { name: 'Nízká', res: 0.8, fov: 1, hz: 72, shadow: 0, every: 1, fx: 0.35, clouds: false },
  stredni: { name: 'Střední', res: 1, fov: 1, hz: 72, shadow: 1024, every: 2, fx: 0.65, clouds: true },
  vysoka: { name: 'Vysoká', res: 1, fov: 0.6, hz: 72, shadow: 2048, every: 1, fx: 1, clouds: true },
  ultra: { name: 'Ultra', res: 1.25, fov: 0.3, hz: 90, shadow: 2048, every: 1, fx: 1, clouds: true },
};
const ORDER = ['nizka', 'stredni', 'vysoka', 'ultra'];
const isQuest = () => /OculusBrowser|Quest|Pico/i.test(navigator.userAgent || '');

export class Graphics {
  constructor(app) {
    this.app = app;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('kr-gfx') || 'null'); } catch (e) { /* bez úložiště */ }
    this.s = { preset: isQuest() ? 'stredni' : 'vysoka', fps: false, ...(saved || {}) };
    if (!PRESETS[this.s.preset]) this.s.preset = 'stredni';
    this.frames = 0; this.acc = 0; this.last = performance.now(); this.drops = []; this.fpsNow = 0; this.cpuNow = 0; this.cpuAcc = 0; this.frameNo = 0;
    this.el = document.getElementById('fps');
  }
  get p() { return PRESETS[this.s.preset]; }
  get xr() { return this.app.mode === 'vr' || this.app.mode === 'ar'; }
  save() { try { localStorage.setItem('kr-gfx', JSON.stringify(this.s)); } catch (e) { /* */ } }
  label() { return `Grafika: ${this.p.name}`; }
  cycle() {
    this.s.preset = ORDER[(ORDER.indexOf(this.s.preset) + 1) % ORDER.length];
    this.save();
    this.apply();
    if (this.xr) this.app.game?.msg(0, 'Rozlišení se změní až při dalším vstupu do VR, zbytek hned.', 'info');
  }
  toggleFps() { this.s.fps = !this.s.fps; this.save(); this.apply(); }
  /** Vše, co jde měnit za běhu. */
  apply() {
    const a = this.app, r = a.renderer, p = this.p;
    const sun = a.env.sun;
    const on = p.shadow > 0;
    if (r.shadowMap.enabled !== on) { r.shadowMap.enabled = on; a.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); }
    sun.castShadow = on;
    if (on && sun.shadow.mapSize.x !== p.shadow) { sun.shadow.mapSize.set(p.shadow, p.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } r.shadowMap.needsUpdate = true; }
    r.shadowMap.autoUpdate = true;
    shared.uClouds.value = p.clouds ? 1 : 0;
    a.world?.setDensity(p.fx);
    if (!r.xr.isPresenting) {
      r.setPixelRatio(Math.min(window.devicePixelRatio, p.res >= 1.25 ? 2 : p.res >= 1 ? 1.5 : 1));
      r.setSize(window.innerWidth, window.innerHeight);
    }
    this.applySession();
    if (this.el) this.el.style.display = this.s.fps && a.mode === 'desktop' ? 'block' : 'none';
  }
  beforeSession() { try { this.app.renderer.xr.setFramebufferScaleFactor(this.p.res); } catch (e) { /* */ } }
  applySession() {
    const r = this.app.renderer, ses = r.xr.getSession?.();
    if (!ses) return;
    try { r.xr.setFoveation(this.p.fov); } catch (e) { /* */ }
    const rates = ses.supportedFrameRates;
    if (ses.updateTargetFrameRate && rates?.length) {
      let hz = this.p.hz;
      if (![...rates].includes(hz)) hz = [...rates].reduce((b, x) => (Math.abs(x - hz) < Math.abs(b - hz) ? x : b), rates[0]);
      if (ses.frameRate !== hz) ses.updateTargetFrameRate(hz).catch(() => {});
    }
  }
  /** Stíny: kamera slunce obepne desku (ve VR se deska hýbe a zmenšuje). */
  fitShadow(board) {
    const sun = this.app.env.sun;
    if (!sun.castShadow) return;
    const s = board.scale.x, half = 27 * s;
    const c = board.position;
    sun.position.set(c.x - 10 * half / 27 * 1.2, c.y + 24 * s, c.z + 7 * s);
    sun.target.position.copy(c);
    const cam = sun.shadow.camera;
    if (cam.right !== half) { cam.left = -half * 1.15; cam.right = half * 1.15; cam.top = half * 1.15; cam.bottom = -half * 1.15; cam.near = 0.1 * s; cam.far = 60 * s; cam.updateProjectionMatrix(); }
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02 * s;
    // úsporné stíny: přepočet jen každý druhý snímek
    const r = this.app.renderer;
    if (this.p.every > 1) { r.shadowMap.autoUpdate = false; if (this.frameNo % this.p.every === 0 || !sun.shadow.map) r.shadowMap.needsUpdate = true; }
  }
  beginFrame() {
    const now = performance.now();
    this.t0 = now;
    const dt = now - this.last;
    this.last = now;
    this.frameNo++;
    const target = this.xr ? (this.app.renderer.xr.getSession?.()?.frameRate || this.p.hz) : 60;
    if (dt > 0 && dt < 1000) { this.frames++; this.acc += dt; if (dt > 1.5 * (1000 / target)) this.drops.push(now); }
    if (this.acc >= 500) {
      this.fpsNow = (this.frames * 1000) / this.acc;
      this.cpuNow = this.cpuAcc / Math.max(1, this.frames);
      this.frames = 0; this.acc = 0; this.cpuAcc = 0;
      this.drops = this.drops.filter((t) => now - t < 10000);
      this.target = target;
      if (this.el && this.s.fps) {
        const ok = this.fpsNow > target * 0.95 ? '#7dff8a' : this.fpsNow > target * 0.8 ? '#ffd84a' : '#ff6a5a';
        this.el.innerHTML = `<b style="color:${ok}">${Math.round(this.fpsNow)} FPS</b> / ${target} · ${this.cpuNow.toFixed(1)} ms · výpadky ${this.drops.length}/10 s`;
      }
    }
  }
  endFrame() { this.cpuAcc += performance.now() - this.t0; }
  /** Krátký text pro VR (nápis nad stolem). */
  text() { return this.s.fps ? `${Math.round(this.fpsNow)} FPS · ${this.cpuNow.toFixed(1)} ms · výpadky ${this.drops.length}` : ''; }
}
