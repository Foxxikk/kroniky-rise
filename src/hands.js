// Modely rukou pro Quest (sledování rukou) + efekty štípnutí.
// Model: WebXR Input Profiles „generic-hand“ (MIT, Amazon) – kostra se řídí klouby, které posílá Quest.
// Styly: „rukavice“ (tmavě modrá kožená se zlatým lemem – hlavně VR), „kouzelné“ (průsvitná zářící ruka –
// hodí se do MR, kde vidíš i své skutečné ruce), „vypnuté“. Výchozí „auto“ = VR rukavice, MR kouzelné.
// Interakce: při přibližování prstů roste mezi nimi světelná kulička (ukazuje, jak blízko je štípnutí),
// štípnutí = jiskry + cvaknutí, tažení stavby / nepřítele / mapy = kouzelný prach, špička ukazováčku svítí
// u tlačítka (tyrkysově) nebo u nepřítele, kterého jde chytit (oranžově).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { dotTexture as softDotTexture } from './world.js';
const patchMaterial = (m) => m;

const JOINTS = [
  'wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];
export const HAND_STYLES = ['auto', 'glove', 'spirit', 'off'];
const STYLE_LABEL = { auto: 'Ruce: auto', glove: 'Ruce: rukavice', spirit: 'Ruce: kouzelné', off: 'Ruce: vypnuté' };
const GOLD = new THREE.Color('#ffd84a'), CYAN = new THREE.Color('#6ff6ff'), ORANGE = new THREE.Color('#ff9a3a');
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class HandVisuals {
  constructor(app) {
    this.app = app;
    let st = 'auto';
    try { st = localStorage.getItem('kr-hands') || 'auto'; } catch (e) { /* bez úložiště */ }
    this.style = HAND_STYLES.includes(st) ? st : 'auto';
    this.src = {};
    this.hands = new Map(); // ptr → { root, bones, mesh }
    // materiály (každá ruka má vlastní, aby žhnutí při chycení bylo jen na jedné)
    this.makeGlove = () => patchMaterial(new THREE.MeshStandardMaterial({ color: '#2d3f86', roughness: 0.55, metalness: 0.15, emissive: '#000000' }), { clouds: false, rim: 0.9 });
    this.makeSpirit = () => {
      const m = patchMaterial(new THREE.MeshStandardMaterial({ color: '#74e8ff', emissive: '#2aa8ff', emissiveIntensity: 0.55, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.4 }), { clouds: false, rim: 1.4 });
      return m;
    };
    // efekty
    const tex = softDotTexture();
    const spr = (col, size) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.scale.setScalar(size);
      s.renderOrder = 31;
      s.visible = false;
      app.scene.add(s);
      return s;
    };
    this.spr = spr;
    this.orbs = new Map();
    this.sparks = [];
    this.pool = [];
    for (let k = 0; k < 90; k++) this.pool.push(spr('#ffffff', 0.01));
    const loader = new GLTFLoader();
    for (const h of ['left', 'right']) {
      loader.load(`./assets/models/hands/${h}.glb`, (gl) => { this.src[h] = gl; }, undefined, (e) => console.warn('hand model', e));
    }
  }
  label() { return STYLE_LABEL[this.style]; }
  cycle() {
    this.style = HAND_STYLES[(HAND_STYLES.indexOf(this.style) + 1) % HAND_STYLES.length];
    try { localStorage.setItem('kr-hands', this.style); } catch (e) { /* bez úložiště */ }
    return this.style;
  }
  /** Jaký styl se teď opravdu kreslí. */
  current() {
    if (this.style !== 'auto') return this.style;
    return this.app.mode === 'ar' ? 'spirit' : 'glove';
  }
  /** Je pro tuto ruku načtený model (→ koule kloubů se schovají)? */
  ready(ptr) { return !!this.hands.get(ptr) && this.current() !== 'off'; }

  build(ptr) {
    const h = ptr.inputSource?.handedness;
    const gl = this.src[h];
    if (!gl || !ptr.hand) return null;
    const root = cloneSkinned(gl.scene.children[0]);
    const mesh = root.getObjectByProperty('type', 'SkinnedMesh');
    if (!mesh) return null;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.renderOrder = 2;
    const bones = JOINTS.map((n) => { const b = root.getObjectByName(n); if (b) b.jointName = n; return b; });
    ptr.hand.add(root);
    const rec = { root, mesh, bones, hand: h, glove: this.makeGlove(), spirit: this.makeSpirit() };
    this.hands.set(ptr, rec);
    return rec;
  }

  burst(p, col, n, speed = 0.35, size = 0.012) {
    for (let k = 0; k < n; k++) {
      const s = this.pool.pop();
      if (!s) return;
      s.visible = true;
      s.material.color.copy(col);
      s.position.copy(p);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.sparks.push({ s, v, life: 0.35 + Math.random() * 0.35, max: 0.7, size: size * (0.6 + Math.random() * 0.8) });
    }
  }

  update(dt) {
    const a = this.app;
    const xr = a.mode === 'vr' || a.mode === 'ar';
    const style = this.current();
    const t = performance.now() / 1000;
    for (const ptr of a.pointers) {
      let rec = this.hands.get(ptr);
      const tracked = xr && ptr.isHand && ptr.hasJoints && ptr.inputSource;
      if (tracked && !rec) rec = this.build(ptr);
      if (rec && rec.hand !== ptr.inputSource?.handedness && tracked) { rec.root.removeFromParent(); this.hands.delete(ptr); rec = this.build(ptr); }
      const show = !!(tracked && rec && style !== 'off');
      if (rec) {
        rec.root.visible = show;
        if (show) {
          const joints = ptr.hand.joints;
          for (const b of rec.bones) {
            const j = b && joints[b.jointName];
            if (j && j.visible) { b.position.copy(j.position); b.quaternion.copy(j.quaternion); }
          }
          const mat = style === 'spirit' ? rec.spirit : rec.glove;
          if (rec.mesh.material !== mat) rec.mesh.material = mat;
        }
      }
      // --- efekty (i bez modelu, stačí klouby)
      let orb = this.orbs.get(ptr);
      if (!orb) { orb = { core: this.spr('#6ff6ff', 0.01), tip: this.spr('#6ff6ff', 0.02), was: false, trailT: 0 }; this.orbs.set(ptr, orb); }
      const fxOn = tracked && style !== 'off';
      orb.core.visible = orb.tip.visible = false;
      if (!fxOn) { orb.was = false; continue; }
      const j = ptr.hand.joints;
      const tt = j['thumb-tip'], it = j['index-finger-tip'];
      if (!tt || !it) continue;
      tt.getWorldPosition(_a);
      it.getWorldPosition(_b);
      const d = _a.distanceTo(_b);
      const P = ptr.pinchPoint;
      // světelná kulička mezi prsty: roste, jak se prsty blíží; při štípnutí zlatě pulzuje
      const k = THREE.MathUtils.clamp((0.075 - d) / 0.055, 0, 1);
      if (ptr.pinching) {
        orb.core.visible = true;
        orb.core.position.copy(P);
        orb.core.material.color.copy(GOLD);
        orb.core.material.opacity = 0.95;
        orb.core.scale.setScalar(0.026 + Math.sin(t * 14) * 0.004);
      } else if (k > 0.05) {
        orb.core.visible = true;
        orb.core.position.copy(_a).lerp(_b, 0.5);
        orb.core.material.color.copy(CYAN).lerp(GOLD, k * k);
        orb.core.material.opacity = 0.25 + k * 0.6;
        orb.core.scale.setScalar(0.006 + k * 0.016);
      }
      // štípnutí začalo / skončilo
      if (ptr.pinching && !orb.was) {
        this.burst(P, GOLD, 10, 0.4);
        a.sfx.play('pinch');
      } else if (!ptr.pinching && orb.was) {
        this.burst(P, CYAN, 5, 0.2, 0.009);
        a.sfx.play('unpinch');
      }
      orb.was = ptr.pinching;
      // kouzelný prach při tažení
      if (ptr.mode === 'brush' || ptr.mode === 'pan') {
        orb.trailT -= dt;
        if (orb.trailT <= 0) {
          orb.trailT = 0.035;
          this.burst(P, ptr.mode === 'brush' ? GOLD : CYAN, 1, 0.06, 0.01);
        }
      }
      // špička ukazováčku: svítí u tlačítka nebo chytitelného nepřítele
      let tipCol = null;
      if (!ptr.mode) {
        const near = a.panelAt?.(ptr, _b, 0.06);
        if (near?.button) tipCol = CYAN;
        
      }
      if (ptr.mode === 'grab') tipCol = ORANGE;
      if (tipCol) {
        orb.tip.visible = true;
        orb.tip.position.copy(_b);
        orb.tip.material.color.copy(tipCol);
        orb.tip.material.opacity = 0.7 + Math.sin(t * 8) * 0.2;
        orb.tip.scale.setScalar(0.022);
      }
      // držený nepřítel: ruka žhne
      if (rec && show) {
        const m = rec.mesh.material;
        if (ptr.mode === 'grab') m.emissive?.setRGB(0.5 + Math.sin(t * 10) * 0.2, 0.22, 0.05);
        else if (m === rec.glove) m.emissive?.setRGB(0, 0, 0);
        else m.emissive?.set('#2aa8ff');
      }
    }
    // jiskry
    const keep = [];
    for (const p of this.sparks) {
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.pool.push(p.s); continue; }
      p.v.y -= dt * 0.25;
      p.v.multiplyScalar(1 - dt * 2.5);
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.opacity = Math.min(1, p.life / p.max * 2);
      p.s.scale.setScalar(p.size * (0.5 + p.life / p.max));
      keep.push(p);
    }
    this.sparks = keep;
  }
}
