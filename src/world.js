// Vykreslení bojiště („deska“): terén, lesy, doly, budovy, jednotky (InstancedMesh), výběr, zdraví, střely, efekty, mlha války.
// Vše je v lokálních souřadnicích mapy (skupina `map`), celou desku (`board`) posouvá/škáluje main.js.
import * as THREE from 'three';
import { MAP_W, MAP_H, UNITS, BUILDINGS, TEAM_INFO, ABILITIES } from './config.js';
import { part, merge, unitGeo, buildingGeo, mineGeo, treeGeo, stumpGeo, rockGeo, carryGeo, arrowGeo, flagGeo } from './models.js';

const W = MAP_W, H = MAP_H;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const UNIT_VIS = 1.35; // jednotky vizuálně větší než jejich „fyzický“ poloměr (čitelnost na stole ve VR)

// ------------------------------------------------------------------ mlha války v shaderu (sdílené uniformy)
export const fogUniforms = {
  uFog: { value: null },
  uMapInv: { value: new THREE.Matrix4() },
  uFogOn: { value: 1 },
};
export function fogMaterial(mat, { fog = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, fogUniforms);
    sh.vertexShader = 'uniform mat4 uMapInv;\nvarying vec2 vMapPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        vMapPos = (uMapInv * (modelMatrix * wp)).xz; }`);
    let fs = 'uniform sampler2D uFog;\nuniform float uFogOn;\nvarying vec2 vMapPos;\n' + sh.fragmentShader;
    if (fog) fs = fs.replace('#include <opaque_fragment>', `
      { float fv = texture2D(uFog, vMapPos / vec2(${W.toFixed(1)}, ${H.toFixed(1)})).r;
        fv = mix(1.0, fv, uFogOn);
        float lum = dot(outgoingLight, vec3(0.3, 0.55, 0.15));
        vec3 dim = mix(vec3(lum) * vec3(0.8, 0.85, 1.0), outgoingLight, 0.45) * 0.55;
        vec3 dark = lum * vec3(0.16, 0.18, 0.26) + vec3(0.03, 0.035, 0.06);
        outgoingLight = fv < 0.5 ? mix(dark, dim, fv * 2.0) : mix(dim, outgoingLight, (fv - 0.5) * 2.0); }
      #include <opaque_fragment>`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'fog' + fog;
  return mat;
}

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _dot;
export const dotTexture = () => (_dot = _dot || softDot());

function noise2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = noise2(xi, zi), b = noise2(xi + 1, zi), c = noise2(xi, zi + 1), d = noise2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export class World {
  constructor(game) {
    this.game = game;
    this.board = new THREE.Group();
    this.board.name = 'board';
    this.map = new THREE.Group();
    this.map.position.set(-W / 2, 0, -H / 2);
    this.board.add(this.map);
    this.mat = fogMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02, flatShading: true }));
    this.unitMat = fogMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, flatShading: true }), { fog: false });
    this.fogData = new Uint8Array(W * H * 4);
    this.fogF = new Float32Array(W * H);
    this.fogTex = new THREE.DataTexture(this.fogData, W, H, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter; this.fogTex.minFilter = THREE.LinearFilter;
    this.fogTex.needsUpdate = true;
    fogUniforms.uFog.value = this.fogTex;
    this.buildTerrain();
    this.buildTrees();
    this.buildStatic();
    this.buildUnits();
    this.buildOverlays();
    this.buildFx();
    this.bmeshes = new Map();
    this.mineMeshes = new Map();
    this.siteMeshes = new Map();
    this.ruinMeshes = [];
    this.updateFog(1, true);
  }

  // ------------------------------------------------------------------ terén a stůl
  buildTerrain() {
    const g = this.game;
    const seg = 2;
    const geo = new THREE.PlaneGeometry(W, H, W * seg, H * seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(W / 2, 0, H / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const grassA = new THREE.Color('#79a64b'), grassB = new THREE.Color('#5f8f3c'), dirt = new THREE.Color('#a88a5c'), dark = new THREE.Color('#4c7534'), rock = new THREE.Color('#8b8d80');
    const bases = [...g.buildings.map((b) => [b.cx, b.cz, 7]), ...g.mines.map((m) => [m.cx, m.cz, 3])];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = smoothNoise(x * 0.18, z * 0.18) * 0.7 + smoothNoise(x * 0.6, z * 0.6) * 0.3;
      _c.copy(grassA).lerp(grassB, n);
      // udusaná hlína u základen a dolů, cesta středem mapy
      let d = 0;
      for (const [bx, bz, r] of bases) d = Math.max(d, 1 - Math.hypot(x - bx, z - bz) / r);
      const road = Math.max(0, 1 - Math.abs((x - z)) / 2.2) * (smoothNoise(x * 0.3, z * 0.3) * 0.6 + 0.4);
      const road2 = Math.max(0, 1 - Math.abs((x + z) - 48) / 1.8) * 0.5 * (smoothNoise(x * 0.4, z * 0.2) > 0.45 ? 1 : 0.3);
      _c.lerp(dirt, Math.min(0.85, Math.max(d * 0.9, road * 0.7, road2 * 0.4)));
      // pod lesem tmavší, u skal šedivější
      const tx = Math.min(W - 1, Math.floor(x)), tz = Math.min(H - 1, Math.floor(z));
      let forest = 0, rk = 0;
      for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
        const xx = tx + dx, zz = tz + dz;
        if (xx < 0 || zz < 0) continue;
        const b = g.block[zz * W + xx];
        if (b === 1) forest++;
        if (b === 4) rk++;
      }
      _c.lerp(dark, forest * 0.18);
      _c.lerp(rock, rk * 0.2);
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      pos.setY(i, (smoothNoise(x * 0.9, z * 0.9) - 0.5) * 0.04);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, fogMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })));
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    this.map.add(terrain);
    this.terrain = terrain;
    // podstavec desky (dřevěný rám jako stolní hra)
    const fr = 1.4, th = 1.6;
    const frame = merge([
      part(new THREE.BoxGeometry(W + fr * 2, th, H + fr * 2), '#5b3a22', { pos: [W / 2, -th / 2 - 0.02, H / 2] }),
      part(new THREE.BoxGeometry(W + fr * 2, 0.35, fr), '#7a4f2c', { pos: [W / 2, 0.1, -fr / 2] }),
      part(new THREE.BoxGeometry(W + fr * 2, 0.35, fr), '#7a4f2c', { pos: [W / 2, 0.1, H + fr / 2] }),
      part(new THREE.BoxGeometry(fr, 0.35, H), '#7a4f2c', { pos: [-fr / 2, 0.1, H / 2] }),
      part(new THREE.BoxGeometry(fr, 0.35, H), '#7a4f2c', { pos: [W + fr / 2, 0.1, H / 2] }),
      ...[[-fr / 2, -fr / 2], [W + fr / 2, -fr / 2], [-fr / 2, H + fr / 2], [W + fr / 2, H + fr / 2]].map(([x, z]) => part(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 8), '#d4a64a', { pos: [x, 0.2, z] })),
    ]);
    this.frame = new THREE.Mesh(frame, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }));
    this.map.add(this.frame);
  }
  buildTrees() {
    const g = this.game;
    this.treeVar = [0, 1, 2].map((v) => {
      const n = g.trees.filter((t) => t.v === v).length;
      const im = new THREE.InstancedMesh(treeGeo(v), this.mat, Math.max(1, n));
      im.castShadow = true;
      this.map.add(im);
      return im;
    });
    this.stumps = new THREE.InstancedMesh(stumpGeo(), this.mat, g.trees.length);
    this.map.add(this.stumps);
    this.refreshTrees();
  }
  refreshTrees() {
    const g = this.game;
    const cnt = [0, 0, 0];
    let sc = 0;
    for (const t of g.trees) {
      _e.set(0, t.rot, 0); _q.setFromEuler(_e);
      if (t.alive) {
        const s = t.s * (t.wood < 40 ? 0.85 + 0.15 * (t.wood / 40) : 1);
        _m.compose(_p.set(t.x + Math.sin(t.rot * 3) * 0.12, 0, t.z + Math.cos(t.rot * 5) * 0.12), _q, _s.set(s, s * (0.9 + (t.rot % 0.4)), s));
        this.treeVar[t.v].setMatrixAt(cnt[t.v]++, _m);
      } else {
        _m.compose(_p.set(t.x, 0, t.z), _q, _s.set(1, 1, 1));
        this.stumps.setMatrixAt(sc++, _m);
      }
    }
    this.treeVar.forEach((im, v) => { im.count = cnt[v]; im.instanceMatrix.needsUpdate = true; });
    this.stumps.count = sc;
    this.stumps.instanceMatrix.needsUpdate = true;
    g.treesDirty = false;
  }
  buildStatic() {
    for (const r of this.game.rocks) {
      const m = new THREE.Mesh(rockGeo(r.w, r.h), this.mat);
      m.position.set(r.x + r.w / 2, 0, r.z + r.h / 2);
      m.castShadow = true;
      this.map.add(m);
    }
    this.mineGeo = mineGeo();
  }

  // ------------------------------------------------------------------ jednotky
  buildUnits() {
    this.unitIM = new Map();
    const make = (type, team, cap) => {
      const im = new THREE.InstancedMesh(unitGeo(type, team), this.unitMat, cap);
      im.count = 0; im.frustumCulled = false; im.castShadow = true;
      this.map.add(im);
      this.unitIM.set(type + team, im);
    };
    for (const type of ['worker', 'footman', 'archer', 'knight', 'hero']) for (const team of [0, 1]) make(type, team, type === 'hero' ? 2 : 70);
    make('wolf', 2, 16); make('golem', 2, 4);
    this.carryIM = { gold: new THREE.InstancedMesh(carryGeo('gold'), this.unitMat, 80), wood: new THREE.InstancedMesh(carryGeo('wood'), this.unitMat, 80) };
    for (const k in this.carryIM) { this.carryIM[k].frustumCulled = false; this.map.add(this.carryIM[k]); }
    this.arrows = new THREE.InstancedMesh(arrowGeo(), this.unitMat, 160);
    this.arrows.frustumCulled = false;
    this.map.add(this.arrows);
  }

  // ------------------------------------------------------------------ překryvy: výběr, zdraví, ghost, značky
  buildOverlays() {
    // kroužky výběru
    const ring = new THREE.RingGeometry(0.82, 1, 28).rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), 260);
    this.rings.frustumCulled = false; this.rings.renderOrder = 5;
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(260 * 3), 3);
    this.map.add(this.rings);
    // ukazatele zdraví: billboardy v prostoru kamery (1 draw call)
    const N = 260;
    const q = new THREE.PlaneGeometry(1, 1);
    const bg = new THREE.InstancedBufferGeometry();
    bg.index = q.index; bg.attributes.position = q.attributes.position; bg.attributes.uv = q.attributes.uv;
    this.barPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.barData = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); // fill, width, kind, mana
    bg.setAttribute('iPos', this.barPos); bg.setAttribute('iData', this.barData);
    bg.instanceCount = 0;
    this.barUniforms = { uScale: { value: 1 } };
    const barMat = new THREE.ShaderMaterial({
      uniforms: this.barUniforms, transparent: true, depthWrite: false, depthTest: true,
      vertexShader: `
        attribute vec3 iPos; attribute vec4 iData; uniform float uScale;
        varying vec2 vUv; varying vec4 vData;
        void main() {
          vUv = uv; vData = iData;
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          float h = iData.w > 0.0 ? 0.2 : 0.13;
          mv.xy += position.xy * vec2(iData.y, h) * uScale;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec2 vUv; varying vec4 vData;
        void main() {
          vec2 px = vUv;
          float border = step(px.x, 0.03) + step(0.97, px.x) + step(px.y, 0.12) + step(0.88, px.y);
          bool manaRow = vData.w > 0.0 && px.y < 0.4;
          float fill = manaRow ? vData.w - 1.0 : vData.x;
          vec3 c;
          if (manaRow) c = vec3(0.3, 0.55, 1.0);
          else if (vData.z > 1.5) c = vec3(0.35, 0.7, 1.0);
          else c = mix(vec3(0.95, 0.2, 0.15), mix(vec3(1.0, 0.85, 0.2), vec3(0.3, 0.9, 0.3), smoothstep(0.45, 0.7, fill)), smoothstep(0.2, 0.45, fill));
          if (vData.z > 0.5 && vData.z < 1.5 && !manaRow) c = mix(c, vec3(1.0, 0.35, 0.3), 0.35);
          vec3 col = px.x < fill ? c : vec3(0.08, 0.09, 0.12);
          if (border > 0.0) col = vec3(0.02);
          gl_FragColor = vec4(col, 0.95);
        }`,
    });
    this.bars = new THREE.Mesh(bg, barMat);
    this.bars.frustumCulled = false; this.bars.renderOrder = 20;
    this.map.add(this.bars);
    // ukazatel hrdiny (kosočtverec nad hlavou)
    this.heroGems = [0, 1].map((t) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: t === 0 ? '#ffd84a' : '#ff5a3a', toneMapped: false }));
      m.visible = false; this.map.add(m); return m;
    });
    // ghost stavby
    this.ghost = new THREE.Group();
    this.ghost.visible = false;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#7dff8a', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
    this.ghostTiles = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4dff6a', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
    this.ghostTiles.position.y = 0.05;
    this.ghost.add(this.ghostTiles);
    this.map.add(this.ghost);
    this.ghostGeos = {};
    // plánované stavby (před příchodem dělníka)
    this.siteMat = new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
    // kurzor / štětec výběru (VR)
    this.brush = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    this.brush.visible = false; this.brush.renderOrder = 6;
    this.map.add(this.brush);
    this.cursor = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    this.cursor.visible = false; this.cursor.renderOrder = 7;
    this.map.add(this.cursor);
    // obdélník výběru (PC)
    this.selRect = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dff8a', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
    this.selRect.visible = false; this.selRect.renderOrder = 6;
    this.map.add(this.selRect);
    // praporek shromaždiště
    this.rallyFlag = new THREE.Mesh(flagGeo(TEAM_INFO[0].color), this.unitMat);
    this.rallyFlag.visible = false;
    this.map.add(this.rallyFlag);
    // dosah schopnosti
    this.aoe = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    this.aoe.visible = false; this.aoe.renderOrder = 6;
    this.map.add(this.aoe);
  }

  // ------------------------------------------------------------------ efekty
  buildFx() {
    const tex = dotTexture();
    this.sparks = [];
    this.sparkPool = [];
    for (let k = 0; k < 140; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.visible = false; s.renderOrder = 12;
      this.map.add(s);
      this.sparkPool.push(s);
    }
    this.pulses = [];
    this.pulsePool = [];
    const rg = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
    for (let k = 0; k < 24; k++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }));
      m.visible = false; m.renderOrder = 8;
      this.map.add(m);
      this.pulsePool.push(m);
    }
    this.texts = [];
    this.textCache = new Map();
    this.textPool = [];
    for (let k = 0; k < 16; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
      s.visible = false; s.renderOrder = 25;
      this.map.add(s);
      this.textPool.push(s);
    }
  }
  spark(x, y, z, color, n = 6, speed = 2, size = 0.25, life = 0.6, up = 1) {
    for (let k = 0; k < n; k++) {
      const s = this.sparkPool.pop();
      if (!s) return;
      s.visible = true;
      s.material.color.set(color);
      s.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      this.sparks.push({ s, vx: Math.cos(a) * v, vy: (Math.random() * 0.8 + 0.4) * speed * up, vz: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.7) });
    }
  }
  pulse(x, z, color, r0, r1, life = 0.5, y = 0.06) {
    const m = this.pulsePool.pop();
    if (!m) return;
    m.visible = true;
    m.material.color.set(color);
    m.position.set(x, y, z);
    this.pulses.push({ m, r0, r1, life, max: life });
  }
  floatText(x, y, z, text, color = '#ffe066') {
    const s = this.textPool.pop();
    if (!s) return;
    const key = text + color;
    let tex = this.textCache.get(key);
    if (!tex) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      g.font = '900 44px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(text, 128, 34);
      g.fillStyle = color; g.fillText(text, 128, 34);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      if (this.textCache.size > 40) this.textCache.clear();
      this.textCache.set(key, tex);
    }
    s.material.map = tex; s.material.needsUpdate = true;
    s.visible = true;
    s.position.set(x, y, z);
    s.scale.set(2.4, 0.6, 1);
    this.texts.push({ s, life: 1.4, max: 1.4 });
  }
  /** Reakce na herní události (efekty). Zvuky řeší main.js. */
  onEvent(ev) {
    const d = ev.data, g = this.game;
    switch (ev.type) {
      case 'hit': if (g.visibleAt(d.x, d.z)) this.spark(d.x, 0.5, d.z, d.magic ? '#8fd8ff' : '#ffd08a', d.magic ? 4 : 3, 1.5, 0.22, 0.35); break;
      case 'death': if (g.visibleAt(d.x, d.z)) this.spark(d.x, 0.4, d.z, '#c8c0b0', 8, 1.2, 0.35, 0.8, 0.6); break;
      case 'collapse': if (g.exploredAt(d.cx, d.cz)) this.spark(d.cx, 0.6, d.cz, '#b09070', 24, 3, 0.8, 1.4, 0.8); this.pulse(d.cx, d.cz, '#d0b090', 0.5, Math.max(d.w, d.h), 0.8); break;
      case 'heal': this.spark(d.x, 0.3, d.z, '#aaffc8', 14, 0.8, 0.35, 1.0, 1.6); this.pulse(d.x, d.z, '#aaffc8', 0.2, 1.1, 0.6); break;
      case 'thunder': this.spark(d.x, 0.3, d.z, '#9fd8ff', 30, 4, 0.5, 0.7, 0.5); this.pulse(d.x, d.z, '#bfe8ff', 0.3, d.r, 0.5); this.pulse(d.x, d.z, '#ffffff', 0.2, d.r * 0.7, 0.35); break;
      case 'levelup': this.spark(d.x, 0.2, d.z, '#ffe066', 26, 1, 0.4, 1.4, 2.2); this.pulse(d.x, d.z, '#ffe066', 0.3, 1.6, 0.9); this.floatText(d.x, 1.8, d.z, `Úroveň ${d.level}!`, '#ffe066'); break;
      case 'built': if (g.seen(d)) this.spark(d.cx, 0.5, d.cz, '#fff2b0', 18, 2, 0.4, 0.9, 1.2); break;
      case 'trained': if (g.visibleAt(d.x, d.z)) this.pulse(d.x, d.z, TEAM_INFO[d.team].light, 0.2, 1, 0.5); break;
      case 'deposit': if (d.team === 0) this.floatText(d.x, 1.2, d.z, `+${d.amt}`, d.res === 'gold' ? '#ffd84a' : '#c8f08a'); break;
      case 'bounty': case 'treasure': if (d.team === 0) this.floatText(d.x, 1.6, d.z, `+${d.amt} zlata`, '#ffd84a'); if (ev.type === 'treasure') this.spark(d.x, 0.4, d.z, '#ffd84a', 30, 2.5, 0.4, 1.2, 1.5); break;
      case 'order': {
        if (d.team !== 0) break;
        const c = { move: '#7dff8a', amove: '#ff7a5a', attack: '#ff5a4a', gather: '#ffd84a', build: '#9fd0ff', repair: '#9fd0ff', follow: '#7dff8a', return: '#ffd84a' }[d.kind] || '#ffffff';
        this.pulse(d.x, d.z, c, 0.9, 0.2, 0.45);
        break;
      }
      case 'rally': this.pulse(d.x, d.z, '#9fd0ff', 0.9, 0.2, 0.45); break;
      case 'treeFall': this.spark(d.x, 0.5, d.z, '#6aa04a', 8, 1.5, 0.3, 0.7, 0.6); break;
    }
  }

  // ------------------------------------------------------------------ mlha
  updateFog(dt, instant = false) {
    const g = this.game, v = g.vis, f = this.fogF, data = this.fogData;
    const k = instant ? 1 : Math.min(1, dt * 5);
    let changed = instant;
    for (let i = 0; i < v.length; i++) {
      const target = v[i] === 2 ? 1 : v[i] === 1 ? 0.5 : 0;
      const cur = f[i];
      if (cur === target) continue;
      let n = cur + (target - cur) * k;
      if (Math.abs(n - target) < 0.01) n = target;
      f[i] = n;
      const b = Math.round(n * 255);
      if (data[i * 4] !== b) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = b; data[i * 4 + 3] = 255; changed = true; }
    }
    if (changed) this.fogTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ snímek
  update(dt, ctx) {
    const g = this.game;
    this.map.updateMatrixWorld();
    fogUniforms.uMapInv.value.copy(this.map.matrixWorld).invert();
    fogUniforms.uFogOn.value = g.revealAll ? 0 : 1;
    this.fogT = (this.fogT || 0) - dt;
    if (this.fogT <= 0) { this.updateFog(0.08); this.fogT = 0.08; }
    if (g.treesDirty) this.refreshTrees();
    this.syncBuildings(dt);
    this.syncUnits(dt, ctx);
    this.syncProjectiles();
    this.syncOverlays(dt, ctx);
    this.syncFx(dt);
  }
  syncBuildings(dt) {
    const g = this.game;
    const live = new Set();
    for (const b of g.buildings) {
      if (!g.seen(b)) continue;
      live.add(b.id);
      let rec = this.bmeshes.get(b.id);
      if (!rec) {
        const key = b.type + b.team;
        this.bgeo = this.bgeo || {};
        const geo = this.bgeo[key] || (this.bgeo[key] = buildingGeo(b.type, b.team));
        const mesh = new THREE.Mesh(geo, this.mat);
        mesh.position.set(b.cx, 0, b.cz);
        mesh.castShadow = true;
        mesh.rotation.y = b.team === 1 ? Math.PI : 0;
        this.map.add(mesh);
        // lešení u rozestavěné budovy
        const scaf = new THREE.Mesh(this.scaffoldGeo(b.w, b.h), this.mat);
        scaf.position.copy(mesh.position);
        this.map.add(scaf);
        rec = { mesh, scaf, shake: 0 };
        this.bmeshes.set(b.id, rec);
      }
      const p = b.done ? 1 : b.progress;
      rec.mesh.scale.set(1, 0.08 + 0.92 * p, 1);
      rec.scaf.visible = !b.done;
      if (b.hitT > 0) { b.hitT -= dt; rec.mesh.position.x = b.cx + Math.sin(g.time * 60) * 0.03; } else rec.mesh.position.x = b.cx;
    }
    for (const [id, rec] of this.bmeshes) {
      if (live.has(id)) continue;
      const b = g.ents.get(id);
      this.map.remove(rec.mesh); this.map.remove(rec.scaf);
      this.bmeshes.delete(id);
      if (b && b.dead && g.exploredAt(b.cx, b.cz)) this.addRuin(b);
    }
    // doly
    for (const m of g.mines) {
      if (!this.mineMeshes.has(m.id)) {
        const mesh = new THREE.Mesh(this.mineGeo, this.mat);
        mesh.position.set(m.cx, 0, m.cz);
        mesh.rotation.y = m.cz < H / 2 ? Math.PI : 0;
        mesh.castShadow = true;
        this.map.add(mesh);
        this.mineMeshes.set(m.id, mesh);
      }
    }
    for (const [id, mesh] of this.mineMeshes) if (!g.mines.some((m) => m.id === id)) { this.map.remove(mesh); this.mineMeshes.delete(id); }
    // plánované stavby hráče
    const sites = (g.sites || []).filter((s) => s.team === 0);
    for (const s of sites) {
      if (this.siteMeshes.has(s.id)) continue;
      const d = BUILDINGS[s.type];
      const m = new THREE.Mesh(this.ghostGeo(s.type), this.siteMat);
      m.position.set(s.x + d.w / 2, 0, s.z + d.h / 2);
      this.map.add(m);
      this.siteMeshes.set(s.id, m);
    }
    for (const [id, m] of this.siteMeshes) if (!sites.some((s) => s.id === id)) { this.map.remove(m); this.siteMeshes.delete(id); }
    // trosky
    for (const r of this.ruinMeshes) { r.t += dt; if (r.t > 25) r.m.position.y -= dt * 0.05; }
    this.ruinMeshes = this.ruinMeshes.filter((r) => { if (r.t > 30) { this.map.remove(r.m); return false; } return true; });
  }
  scaffoldGeo(w, h) {
    this._scaf = this._scaf || {};
    const k = w + 'x' + h;
    if (this._scaf[k]) return this._scaf[k];
    const P = [];
    const hw = w / 2 - 0.15, hh = h / 2 - 0.15;
    for (const [x, z] of [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]) P.push(part(new THREE.BoxGeometry(0.08, 1.4, 0.08), '#8a5a33', { pos: [x, 0.7, z] }));
    P.push(part(new THREE.BoxGeometry(w - 0.2, 0.06, 0.08), '#8a5a33', { pos: [0, 0.9, -hh] }), part(new THREE.BoxGeometry(w - 0.2, 0.06, 0.08), '#8a5a33', { pos: [0, 0.9, hh] }));
    P.push(part(new THREE.BoxGeometry(0.08, 0.06, h - 0.2), '#8a5a33', { pos: [-hw, 0.5, 0] }), part(new THREE.BoxGeometry(0.08, 0.06, h - 0.2), '#8a5a33', { pos: [hw, 0.5, 0] }));
    P.push(part(new THREE.BoxGeometry(w - 0.1, 0.05, h - 0.1), '#b89b72', { pos: [0, 0.03, 0] }));
    return (this._scaf[k] = merge(P));
  }
  ghostGeo(type) {
    return this.ghostGeos[type] || (this.ghostGeos[type] = buildingGeo(type, 0));
  }
  addRuin(b) {
    const P = [];
    for (let k = 0; k < b.w * b.h; k++) {
      const x = ((k * 0.618) % 1 - 0.5) * b.w * 0.8, z = ((k * 0.37 + 0.2) % 1 - 0.5) * b.h * 0.8;
      P.push(part(new THREE.DodecahedronGeometry(0.25 + (k % 3) * 0.08, 0), k % 2 ? '#5a4d42' : '#3f3833', { pos: [x, 0.1, z], rot: [k, k, 0], scale: [1, 0.5, 1] }));
    }
    P.push(part(new THREE.BoxGeometry(b.w * 0.9, 0.04, b.h * 0.9), '#2e2a27', { pos: [0, 0.02, 0] }));
    const m = new THREE.Mesh(merge(P), this.mat);
    m.position.set(b.cx, 0, b.cz);
    this.map.add(m);
    this.ruinMeshes.push({ m, t: 0 });
  }
  syncUnits(dt, ctx) {
    const g = this.game;
    for (const im of this.unitIM.values()) im.count = 0;
    let gc = 0, wc = 0;
    const put = (u, dying) => {
      const im = this.unitIM.get(u.type + u.team);
      if (!im || im.count >= im.instanceMatrix.count) return;
      let y = 0, tiltX = 0, tiltZ = 0, fwd = 0;
      const bob = u.moving ? Math.abs(Math.sin(u.anim * Math.PI)) * 0.06 : 0;
      y += bob;
      if (u.atkAnim > 0) { const a = Math.sin(u.atkAnim * Math.PI); fwd = a * 0.12; tiltX = a * 0.25; }
      let sc = UNIT_VIS;
      if (dying) {
        const t = u.deathT;
        tiltZ = Math.min(1, t * 3) * 1.4;
        y = -Math.max(0, t - 2) * 0.3;
        sc = UNIT_VIS * (t > 3 ? Math.max(0.01, 1 - (t - 3)) : 1);
      }
      // zrození: vyrůst ze země
      const age = g.time - (u.born || 0);
      if (age < 0.4 && !dying) sc = UNIT_VIS * (0.3 + age * 1.75);
      _e.set(tiltX, u.facing, tiltZ, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p.set(u.x + Math.sin(u.facing) * fwd, y, u.z + Math.cos(u.facing) * fwd), _q, _s.set(sc, sc, sc));
      im.setMatrixAt(im.count++, _m);
      if (!dying && u.carry && u.carry.amt > 0) {
        const cim = this.carryIM[u.carry.res];
        const c = u.carry.res === 'gold' ? gc++ : wc++;
        if (c < 80) {
          _m.compose(_p.set(u.x - Math.sin(u.facing) * 0.2, 0.66 + bob, u.z - Math.cos(u.facing) * 0.2), _q, _s.set(UNIT_VIS, UNIT_VIS, UNIT_VIS));
          cim.setMatrixAt(c, _m);
        }
      }
    };
    for (const u of g.units) {
      if (u.hidden || !g.seen(u)) continue;
      put(u, false);
    }
    for (const u of g.corpses || []) if (g.visibleAt(u.x, u.z)) put(u, true);
    for (const im of this.unitIM.values()) im.instanceMatrix.needsUpdate = true;
    this.carryIM.gold.count = Math.min(80, gc); this.carryIM.wood.count = Math.min(80, wc);
    this.carryIM.gold.instanceMatrix.needsUpdate = this.carryIM.wood.instanceMatrix.needsUpdate = true;
    // hrdinové – ukazatel
    [0, 1].forEach((t) => {
      const h = g.hero(t), m = this.heroGems[t];
      m.visible = !!(h && !h.hidden && g.seen(h));
      if (m.visible) { m.position.set(h.x, 1.9 + Math.sin(g.time * 3) * 0.08, h.z); m.rotation.y = g.time * 2; }
    });
  }
  syncProjectiles() {
    const g = this.game;
    let n = 0;
    for (const p of g.projectiles) {
      if (n >= 160) break;
      if (!g.visibleAt(p.x, p.z)) continue;
      const ang = Math.atan2(p.dx || 0, p.dz || 1);
      _e.set(0, ang, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(1, 1, 1));
      this.arrows.setMatrixAt(n++, _m);
    }
    this.arrows.count = n;
    this.arrows.instanceMatrix.needsUpdate = true;
  }
  syncOverlays(dt, ctx) {
    const g = this.game;
    const sel = ctx.selection || new Set();
    let rn = 0, bn = 0;
    const ringCol = (team) => (team === 0 ? '#6dff7a' : team === 1 ? '#ff5a4a' : '#ffd84a');
    const addRing = (x, z, r, col, op = 1) => {
      if (rn >= 260) return;
      _m.compose(_p.set(x, 0.04, z), _q.identity(), _s.set(r, 1, r));
      this.rings.setMatrixAt(rn, _m);
      _c.set(col).multiplyScalar(op);
      this.rings.setColorAt(rn, _c);
      rn++;
    };
    const addBar = (x, y, z, fill, width, kind = 0, mana = 0) => {
      if (bn >= 260) return;
      this.barPos.setXYZ(bn, x, y, z);
      this.barData.setXYZW(bn, Math.max(0, Math.min(1, fill)), width, kind, mana ? 1 + Math.max(0, Math.min(1, mana)) : 0);
      bn++;
    };
    const hover = ctx.hover;
    const showAll = ctx.showBars;
    for (const u of g.units) {
      if (u.hidden || !g.seen(u)) continue;
      const selected = sel.has(u.id);
      if (selected) addRing(u.x, u.z, u.def.size + 0.14, ringCol(u.team));
      else if (hover === u) addRing(u.x, u.z, u.def.size + 0.14, ringCol(u.team), 0.5);
      if (selected || u.hp < u.maxHp || hover === u || u.def.hero || showAll) {
        const hgt = ({ knight: 1.35, hero: 1.28, golem: 1.4 }[u.type] || 0.95) * UNIT_VIS;
        addBar(u.x, hgt, u.z, u.hp / u.maxHp, u.def.hero ? 0.95 : 0.7, u.team === 0 ? 0 : 1, u.def.hero && (selected || u.team === 0) ? u.mana / u.maxMana : 0);
      }
    }
    for (const b of g.buildings) {
      if (!g.seen(b)) continue;
      const selected = sel.has(b.id);
      if (selected || hover === b) addRing(b.cx, b.cz, Math.max(b.w, b.h) * 0.72, ringCol(b.team), selected ? 1 : 0.5);
      const top = { townhall: 3.2, tower: 3.0, altar: 2.1, barracks: 2.1, stable: 2.0, farm: 1.3 }[b.type] || 2;
      if (!b.done) addBar(b.cx, top * (0.3 + 0.7 * b.progress) + 0.3, b.cz, b.progress, b.w * 0.5, 2);
      else if (b.queue.length && b.team === 0) addBar(b.cx, top + 0.55, b.cz, b.queue[0].t / b.queue[0].total, b.w * 0.45, 2);
      if (b.done && (b.hp < b.maxHp || selected || hover === b)) addBar(b.cx, top + 0.3, b.cz, b.hp / b.maxHp, b.w * 0.5, b.team === 0 ? 0 : 1);
    }
    for (const m of g.mines) if (sel.has(m.id) || hover === m) addRing(m.cx, m.cz, 2.1, '#ffd84a', sel.has(m.id) ? 1 : 0.5);
    this.rings.count = rn;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    this.bars.geometry.instanceCount = bn;
    this.barPos.needsUpdate = true; this.barData.needsUpdate = true;
    this.barUniforms.uScale.value = ctx.barScale || 1;
    // shromaždiště vybrané budovy
    const rb = [...sel].map((id) => g.get(id)).find((b) => b && b.kind === 'building' && b.team === 0 && b.rally);
    this.rallyFlag.visible = !!rb;
    if (rb) this.rallyFlag.position.set(rb.rally.x, 0, rb.rally.z);
  }
  /** Ghost stavby: typ + levý horní roh (x, z) + platnost. */
  showGhost(type, x, z, ok) {
    if (!type) { this.ghost.visible = false; return; }
    const d = BUILDINGS[type];
    if (this.ghost.userData.type !== type) {
      if (this.ghost.userData.mesh) this.ghost.remove(this.ghost.userData.mesh);
      const m = new THREE.Mesh(this.ghostGeo(type), this.ghostMat);
      this.ghost.add(m);
      this.ghost.userData = { type, mesh: m };
    }
    this.ghost.visible = true;
    this.ghost.position.set(x + d.w / 2, 0, z + d.h / 2);
    this.ghostTiles.scale.set(d.w, 1, d.h);
    this.ghostMat.color.set(ok ? '#7dff8a' : '#ff6a5a');
    this.ghostTiles.material.color.set(ok ? '#4dff6a' : '#ff4a3a');
  }
  syncFx(dt) {
    const keep = [];
    for (const p of this.sparks) {
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.sparkPool.push(p.s); continue; }
      p.vy -= dt * 3;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      if (p.s.position.y < 0.05) { p.s.position.y = 0.05; p.vy *= -0.3; }
      const k = p.life / p.max;
      p.s.material.opacity = Math.min(1, k * 2);
      p.s.scale.setScalar(p.size * (0.4 + k));
      keep.push(p);
    }
    this.sparks = keep;
    this.pulses = this.pulses.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; this.pulsePool.push(p.m); return false; }
      const k = 1 - p.life / p.max;
      const r = p.r0 + (p.r1 - p.r0) * k;
      p.m.scale.set(r, 1, r);
      p.m.material.opacity = (1 - k) * 0.9;
      return true;
    });
    this.texts = this.texts.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) { t.s.visible = false; this.textPool.push(t.s); return false; }
      t.s.position.y += dt * 0.7;
      t.s.material.opacity = Math.min(1, t.life / t.max * 2.5);
      return true;
    });
  }
}
