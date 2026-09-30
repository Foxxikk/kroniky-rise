// Načítání CC0 modelů KayKit (Kay Lousberg, kaylousberg.com):
//  - Character Pack: Adventurers → Aliance Svítání (dělník, pěšák, lučištník, válečník, hrdina)
//  - Character Pack: Skeletons   → Klan Popela (nemrtví)
//  - Medieval Hexagon Pack       → budovy (modré / červené), důl, lešení, trosky, stromy, skály, hory
// Paletové textury převádíme na barvy vrcholů → jeden sdílený materiál, slučování geometrií.
// Animace postav se zapečou do textury (VAT) → celá armáda = 1 instancovaná síť na typ a tým.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = './assets/models/';
export const ASSETS = { ready: false, hex: {}, parts: {}, units: {}, error: null };

// budova → model (modrá = hráč, červená = soupeř)
export const BUILDING_MODELS = {
  townhall: 'building_castle', farm: 'building_windmill', barracks: 'building_barracks', altar: 'building_church',
  stable: 'building_blacksmith', tower: 'building_tower_A',
};
const HEX_NAMES = [
  ...Object.values(BUILDING_MODELS).flatMap((n) => [n + '_blue', n + '_red']),
  'building_mine_yellow', 'building_scaffolding', 'building_destroyed',
  'tree_single_A', 'tree_single_B', 'tree_single_A_cut', 'tree_single_B_cut',
  'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E',
  'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass',
  'barrel', 'crate_A_big', 'sack', 'resource_lumber', 'weaponrack',
];
// jednotka → [model hráče, model soupeře]; clips: idle/walk/attack/death (+cast), výška v políčkách
const C = (walk, attack, extra = {}) => ({ idle: 'Idle', walk, attack, death: 'Death_A', ...extra });
export const UNIT_MODELS = {
  worker: [
    { file: 'a_worker', weapons: [['handslot.r', 'w_axe']], clips: C('Walking_A', '1H_Melee_Attack_Chop'), height: 1.05 },
    { file: 's_worker', weapons: [['handslot.r', 'w_saxe']], clips: C('Walking_D_Skeletons', '1H_Melee_Attack_Chop'), height: 1.05 },
  ],
  footman: [
    { file: 'a_footman', weapons: [], clips: C('Walking_A', '1H_Melee_Attack_Slice_Diagonal'), height: 1.2 },
    { file: 's_footman', weapons: [['handslot.r', 'w_sblade'], ['handslot.l', 'w_sshield_small_a']], clips: C('Walking_A', '1H_Melee_Attack_Slice_Diagonal'), height: 1.2 },
  ],
  archer: [
    { file: 'a_archer', weapons: [], clips: C('Walking_A', '2H_Ranged_Shoot'), height: 1.15 },
    { file: 's_archer', weapons: [['handslot.r', 'w_scrossbow']], clips: C('Walking_A', '2H_Ranged_Shoot'), height: 1.15 },
  ],
  knight: [
    { file: 'a_knight', weapons: [], clips: C('Walking_A', '2H_Melee_Attack_Chop'), height: 1.45 },
    { file: 's_footman', weapons: [['handslot.r', 'w_saxe'], ['handslot.l', 'w_sshield_large_a']], clips: C('Walking_A', '2H_Melee_Attack_Chop'), height: 1.45 },
  ],
  hero: [
    { file: 'a_hero', weapons: [], clips: C('Walking_A', '1H_Melee_Attack_Chop', { cast: 'Spellcast_Shoot' }), height: 1.6 },
    { file: 's_hero', weapons: [['handslot.r', 'w_sstaff']], clips: C('Walking_A', '1H_Melee_Attack_Chop', { cast: 'Spellcast_Shoot' }), height: 1.65 },
  ],
};
// počet snímků animace (mezi snímky se v shaderu plynule prolíná)
export const SEGS = { idle: { n: 8, loop: true }, walk: { n: 12, loop: true }, attack: { n: 10, loop: false }, death: { n: 10, loop: false }, cast: { n: 10, loop: false } };
export const VAT_W = 2048;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const load = (url) => { if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, rej))); return cache.get(url); };

// ------------------------------------------------------------ paleta textury → barvy vrcholů
const palCache = new WeakMap();
function palette(tex) {
  if (!tex?.image) return null;
  if (palCache.has(tex)) return palCache.get(tex);
  const img = tex.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const p = { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data, flipY: tex.flipY };
  palCache.set(tex, p);
  return p;
}
const _c = new THREE.Color();
function cp(a) {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.BufferAttribute(out, a.itemSize);
}
function sample(p, u, v, out) {
  u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
  const x = Math.min(p.w - 1, Math.floor(u * p.w));
  const y = Math.min(p.h - 1, Math.floor((p.flipY ? 1 - v : v) * p.h));
  const i = (y * p.w + x) * 4;
  return out.setRGB(p.data[i] / 255, p.data[i + 1] / 255, p.data[i + 2] / 255, THREE.SRGBColorSpace);
}
/** Barvy vrcholů z palety/materiálu (geometrie v lokálu sítě). */
function colorGeo(mesh) {
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', cp(src.attributes.position));
  if (src.attributes.normal) g.setAttribute('normal', cp(src.attributes.normal));
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const pal = palette(mat?.map);
  const uv = src.attributes.uv, n = src.attributes.position.count;
  const col = new Float32Array(n * 3);
  const base = mat?.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
  const emis = mat?.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.5 ? mat.emissive : null;
  for (let i = 0; i < n; i++) {
    if (emis) _c.copy(emis);
    else if (pal && uv) sample(pal, uv.getX(i), uv.getY(i), _c).multiply(base);
    else _c.copy(base);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  if (src.index) g.setIndex(src.index.clone());
  else g.setIndex([...Array(n).keys()]);
  return g;
}

// ------------------------------------------------------------ statické modely (budovy, příroda)
const MOVABLE = new Set(['building_windmill_top_fan_blue', 'building_windmill_top_fan_red']);
const _inv = new THREE.Matrix4();
async function loadHex(name) {
  const gl = await load(`${BASE}hex/${name}.glb`);
  gl.scene.updateMatrixWorld(true);
  const parts = [], mov = {};
  gl.scene.traverse((o) => {
    if (!o.isMesh) return;
    let a = o;
    while (a && !MOVABLE.has(a.name)) a = a.parent;
    let g = colorGeo(o).toNonIndexed();
    if (a) {
      _inv.copy(a.matrixWorld).invert().multiply(o.matrixWorld);
      g.applyMatrix4(_inv);
      (mov[name] ||= { parts: [], pivot: new THREE.Vector3().setFromMatrixPosition(a.matrixWorld) }).parts.push(g);
    } else { g.applyMatrix4(o.matrixWorld); parts.push(g); }
  });
  const geo = mergeGeometries(parts, false);
  geo.computeBoundingBox();
  ASSETS.hex[name] = geo;
  for (const [k, m] of Object.entries(mov)) {
    const g = mergeGeometries(m.parts, false);
    ASSETS.parts[k] = { geo: g, pivot: m.pivot };
  }
}

// ------------------------------------------------------------ postavy → VAT (zapečené animace)
async function loadUnit(type, team) {
  const def = UNIT_MODELS[type][team];
  const gl = await load(`${BASE}units/${def.file}.glb`);
  // kopie scény (stejný soubor může sloužit dvěma typům s jinými zbraněmi)
  const root = gl.scene;
  root.updateMatrixWorld(true);
  const bones = {};
  root.traverse((o) => { if (o.name) bones[o.name] = o; });
  const findBone = (n) => bones[n] || bones[THREE.PropertyBinding.sanitizeNodeName(n)] || bones[n.replace(/\./g, '')];
  const parts = [];
  root.traverse((o) => { if (o.isMesh && o.visible) parts.push({ mesh: o, geo: colorGeo(o) }); });
  for (const [bone, file] of def.weapons) {
    const b = findBone(bone);
    if (!b) continue;
    try {
      const w = await load(`${BASE}units/${file}.glb`);
      w.scene.updateMatrixWorld(true);
      const ws = [];
      w.scene.traverse((o) => { if (!o.isMesh) return; const g = colorGeo(o); g.applyMatrix4(o.matrixWorld); ws.push(g); });
      parts.push({ bone: b, geo: mergeGeometries(ws, false) });
    } catch (e) { /* zbraň chybí – nevadí */ }
  }
  const geo = mergeGeometries(parts.map((p) => p.geo), false);
  const N = geo.attributes.position.count;
  const vid = new Float32Array(N);
  for (let i = 0; i < N; i++) vid[i] = i;
  geo.setAttribute('aVid', new THREE.BufferAttribute(vid, 1));
  const segs = {};
  let F = 0;
  for (const k of Object.keys(SEGS)) {
    const name = def.clips[k];
    if (!name) continue;
    const clip = gl.animations.find((a) => a.name === name) || gl.animations.find((a) => a.name === def.clips.idle) || gl.animations[0];
    segs[k] = { start: F, n: SEGS[k].n, loop: SEGS[k].loop, dur: clip.duration, clip };
    F += SEGS[k].n;
  }
  const data = new Float32Array(F * N * 8);
  const mixer = new THREE.AnimationMixer(root);
  const M = new THREE.Matrix4(), Wm = [];
  let scale = 1, minY = 0;
  for (const k of Object.keys(segs)) {
    const sg = segs[k];
    mixer.stopAllAction();
    const action = mixer.clipAction(sg.clip);
    action.reset();
    action.setLoop(sg.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.play();
    for (let f = 0; f < sg.n; f++) {
      const t = sg.loop ? (f / sg.n) * sg.dur : (f / (sg.n - 1)) * sg.dur * 0.995;
      mixer.setTime(t);
      root.updateMatrixWorld(true);
      let off = (sg.start + f) * N;
      for (const p of parts) {
        const pos = p.geo.attributes.position, nor = p.geo.attributes.normal, n = pos.count;
        const m = p.mesh;
        if (m && m.isSkinnedMesh) {
          const sk = m.skeleton;
          for (let b = 0; b < sk.bones.length; b++) {
            M.multiplyMatrices(sk.bones[b].matrixWorld, sk.boneInverses[b]);
            M.premultiply(m.bindMatrixInverse).multiply(m.bindMatrix).premultiply(m.matrixWorld);
            (Wm[b] = Wm[b] || new Float32Array(16)).set(M.elements);
          }
          const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
          for (let i = 0; i < n; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
            let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
            for (let j = 0; j < 4; j++) {
              const w = sw.getComponent(i, j);
              if (w === 0) continue;
              const a = Wm[si.getComponent(i, j)];
              px += w * (a[0] * x + a[4] * y + a[8] * z + a[12]);
              py += w * (a[1] * x + a[5] * y + a[9] * z + a[13]);
              pz += w * (a[2] * x + a[6] * y + a[10] * z + a[14]);
              qx += w * (a[0] * nx + a[4] * ny + a[8] * nz);
              qy += w * (a[1] * nx + a[5] * ny + a[9] * nz);
              qz += w * (a[2] * nx + a[6] * ny + a[10] * nz);
            }
            const L = Math.hypot(qx, qy, qz) || 1;
            const o = (off + i) * 8;
            data[o] = px; data[o + 1] = py; data[o + 2] = pz;
            data[o + 4] = qx / L; data[o + 5] = qy / L; data[o + 6] = qz / L;
          }
        } else {
          const a = (m ? m.matrixWorld : p.bone.matrixWorld).elements;
          for (let i = 0; i < n; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
            const qx = a[0] * nx + a[4] * ny + a[8] * nz, qy = a[1] * nx + a[5] * ny + a[9] * nz, qz = a[2] * nx + a[6] * ny + a[10] * nz;
            const L = Math.hypot(qx, qy, qz) || 1;
            const o = (off + i) * 8;
            data[o] = a[0] * x + a[4] * y + a[8] * z + a[12];
            data[o + 1] = a[1] * x + a[5] * y + a[9] * z + a[13];
            data[o + 2] = a[2] * x + a[6] * y + a[10] * z + a[14];
            data[o + 4] = qx / L; data[o + 5] = qy / L; data[o + 6] = qz / L;
          }
        }
        off += n;
      }
      if (k === 'idle' && f === 0) {
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < N; i++) { const y = data[i * 8 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
        minY = lo;
        scale = def.height / Math.max(0.01, hi - lo);
      }
    }
  }
  mixer.stopAllAction();
  const P = geo.attributes.position, Nn = geo.attributes.normal;
  for (let i = 0; i < F * N; i++) {
    const o = i * 8;
    data[o] *= scale; data[o + 1] = (data[o + 1] - minY) * scale; data[o + 2] *= scale;
  }
  for (let i = 0; i < N; i++) {
    P.setXYZ(i, data[i * 8], data[i * 8 + 1], data[i * 8 + 2]);
    Nn.setXYZ(i, data[i * 8 + 4], data[i * 8 + 5], data[i * 8 + 6]);
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const texels = F * N * 2;
  const H = Math.ceil(texels / VAT_W);
  const half = new Uint16Array(VAT_W * H * 4);
  for (let i = 0; i < texels * 4; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const tex = new THREE.DataTexture(half, VAT_W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  for (const sg of Object.values(segs)) delete sg.clip;
  ASSETS.units[type + team] = { geo, tex, N, segs };
}

/** Snímky animace pro instanci: [f0, f1, míchání]. */
export function animFrames(segs, name, t, out) {
  const sg = segs[name] || segs.idle;
  let fr = (t / sg.dur) * (sg.loop ? sg.n : sg.n - 1);
  let f0, f1;
  if (sg.loop) {
    fr = ((fr % sg.n) + sg.n) % sg.n;
    f0 = Math.floor(fr);
    f1 = (f0 + 1) % sg.n;
  } else {
    fr = Math.max(0, Math.min(sg.n - 1, fr));
    f0 = Math.floor(fr);
    f1 = Math.min(sg.n - 1, f0 + 1);
  }
  out[0] = sg.start + f0; out[1] = sg.start + f1; out[2] = fr - Math.floor(fr);
  return out;
}

let _promise = null;
export function loadAssets(onProgress = () => {}) {
  if (_promise) return _promise;
  _promise = (async () => {
    const jobs = [];
    for (const n of HEX_NAMES) jobs.push(() => loadHex(n));
    for (const t of Object.keys(UNIT_MODELS)) for (const team of [0, 1]) jobs.push(() => loadUnit(t, team));
    let done = 0;
    const N = jobs.length;
    // postupně po skupinách (zapékání animací je náročné, ať prohlížeč nezamrzne)
    for (let k = 0; k < N; k += 4) {
      await Promise.all(jobs.slice(k, k + 4).map((j) => j().catch((e) => { console.warn('asset', e); ASSETS.error = e; }).finally(() => onProgress(++done / N))));
      await new Promise((r) => setTimeout(r, 0));
    }
    ASSETS.ready = Object.keys(ASSETS.hex).length > 15 && Object.keys(ASSETS.units).length >= 8;
    return ASSETS;
  })();
  return _promise;
}
