// Procedurální low-poly modely (vlastní, bez externích assetů). Vše sloučené do jedné geometrie s barvami ve vrcholech
// → jeden sdílený materiál, málo draw callů (důležité pro Quest). Jednotky koukají po +z, stojí na y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TEAM_INFO } from './config.js';

const _c = new THREE.Color();

/** Díl modelu: geometrie + barva + transformace → nezaindexovaná geometrie s atributy position/normal/color. */
export function part(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], jitter = 0 } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...(typeof scale === 'number' ? [scale, scale, scale] : scale)),
  );
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i += 3) {
    // drobné kolísání barvy po plochách = ručně malovaný vzhled
    const k = jitter ? 1 + (Math.sin(i * 12.9898 + n) * 0.5) * jitter : 1;
    for (let v = 0; v < 3 && i + v < n; v++) {
      col[(i + v) * 3] = _c.r * k; col[(i + v) * 3 + 1] = _c.g * k; col[(i + v) * 3 + 2] = _c.b * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
export function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dod = (r) => new THREE.DodecahedronGeometry(r, 0);

const SKIN = ['#f0c29a', '#9bb07e', '#d9b48a'];
const STEEL = '#aab3c0', STEEL_D = '#6c7482', WOOD = '#7a4f2c', WOOD_D = '#553520', LEATHER = '#6e4a2e', GOLD = '#f3c640';

// ------------------------------------------------------------------ jednotky
function legs(h, col, sp = 0.07, w = 0.07) {
  return [
    part(box(w, h, w * 1.1), col, { pos: [-sp, h / 2, 0] }),
    part(box(w, h, w * 1.1), col, { pos: [sp, h / 2, 0] }),
  ];
}
export function unitGeo(type, team) {
  const T = TEAM_INFO[team];
  const tc = T.color, td = T.dark;
  const skin = SKIN[team] || SKIN[0];
  const orc = team === 1;
  const P = [];
  switch (type) {
    case 'worker': {
      P.push(...legs(0.2, '#5a4632', 0.06, 0.07));
      P.push(part(cyl(0.12, 0.15, 0.26, 7), '#b9925e', { pos: [0, 0.33, 0] }));
      P.push(part(box(0.24, 0.12, 0.05), tc, { pos: [0, 0.3, 0.12] })); // zástěra
      P.push(part(sph(0.1, 8, 6), skin, { pos: [0, 0.54, 0] }));
      P.push(part(cyl(0.06, 0.12, 0.08, 7), tc, { pos: [0, 0.63, 0] })); // čepice
      if (orc) P.push(part(cone(0.025, 0.08, 4), '#efe6cf', { pos: [0.05, 0.5, 0.08], rot: [0.5, 0, 0] }), part(cone(0.025, 0.08, 4), '#efe6cf', { pos: [-0.05, 0.5, 0.08], rot: [0.5, 0, 0] }));
      // krumpáč přes rameno
      P.push(part(cyl(0.015, 0.015, 0.42, 5), WOOD, { pos: [0.13, 0.48, -0.02], rot: [0.4, 0, -0.5] }));
      P.push(part(box(0.26, 0.035, 0.04), STEEL_D, { pos: [0.22, 0.66, -0.1], rot: [0.4, 0, -0.5] }));
      break;
    }
    case 'footman': {
      P.push(...legs(0.22, STEEL_D, 0.07, 0.08));
      P.push(part(cyl(0.14, 0.17, 0.3, 8), STEEL, { pos: [0, 0.37, 0] }));
      P.push(part(box(0.22, 0.28, 0.04), tc, { pos: [0, 0.34, 0.14] })); // tunika se znakem
      P.push(part(box(0.06, 0.06, 0.02), GOLD, { pos: [0, 0.38, 0.165] }));
      P.push(part(sph(0.1, 8, 6), skin, { pos: [0, 0.59, 0] }));
      P.push(part(sph(0.115, 8, 5), STEEL, { pos: [0, 0.62, 0], scale: [1, 0.85, 1] })); // helma
      if (orc) {
        P.push(part(cone(0.035, 0.14, 5), '#e8dfc8', { pos: [0.1, 0.72, 0], rot: [0, 0, -0.7] }), part(cone(0.035, 0.14, 5), '#e8dfc8', { pos: [-0.1, 0.72, 0], rot: [0, 0, 0.7] }));
      } else P.push(part(box(0.03, 0.12, 0.16), tc, { pos: [0, 0.74, -0.02] })); // chochol
      // štít vlevo, meč vpravo
      P.push(part(cyl(0.15, 0.15, 0.04, 10), tc, { pos: [-0.2, 0.38, 0.05], rot: [0, 0, Math.PI / 2] }));
      P.push(part(cyl(0.06, 0.06, 0.05, 8), GOLD, { pos: [-0.225, 0.38, 0.05], rot: [0, 0, Math.PI / 2] }));
      P.push(part(box(0.035, 0.4, 0.06), '#dfe5ee', { pos: [0.2, 0.45, 0.1], rot: [0.35, 0, 0] }));
      P.push(part(box(0.12, 0.03, 0.04), GOLD, { pos: [0.2, 0.27, 0.04], rot: [0.35, 0, 0] }));
      break;
    }
    case 'archer': {
      P.push(...legs(0.22, LEATHER, 0.06, 0.07));
      P.push(part(cyl(0.11, 0.14, 0.28, 7), orc ? '#7b6048' : '#6f8f4e', { pos: [0, 0.36, 0] }));
      P.push(part(cone(0.2, 0.46, 7), tc, { pos: [0, 0.34, -0.03] })); // plášť
      P.push(part(sph(0.095, 8, 6), skin, { pos: [0, 0.57, 0] }));
      P.push(part(cone(0.12, 0.2, 7), td, { pos: [0, 0.66, -0.02] })); // kápě
      // luk
      P.push(part(new THREE.TorusGeometry(0.22, 0.014, 4, 10, Math.PI), WOOD, { pos: [-0.17, 0.42, 0.08], rot: [0, Math.PI / 2, Math.PI / 2] }));
      P.push(part(cyl(0.004, 0.004, 0.44, 3), '#eeeeee', { pos: [-0.17, 0.42, 0.08] }));
      P.push(part(cyl(0.05, 0.05, 0.26, 6), LEATHER, { pos: [0.08, 0.45, -0.12], rot: [0.3, 0, 0.2] })); // toulec
      break;
    }
    case 'knight': {
      const horse = orc ? '#4a3d33' : '#e8e2d6';
      P.push(part(box(0.3, 0.3, 0.72), horse, { pos: [0, 0.52, 0] }));
      for (const [x, z] of [[-0.1, 0.26], [0.1, 0.26], [-0.1, -0.26], [0.1, -0.26]]) P.push(part(box(0.08, 0.38, 0.08), horse, { pos: [x, 0.19, z] }));
      P.push(part(box(0.14, 0.34, 0.16), horse, { pos: [0, 0.74, 0.36], rot: [0.5, 0, 0] })); // krk
      P.push(part(box(0.13, 0.13, 0.28), horse, { pos: [0, 0.86, 0.5], rot: [0.2, 0, 0] })); // hlava
      P.push(part(box(0.34, 0.2, 0.6), tc, { pos: [0, 0.5, -0.02] })); // čabraka
      P.push(part(box(0.05, 0.2, 0.08), td, { pos: [0, 0.78, 0.2] })); // hříva
      // jezdec
      P.push(part(cyl(0.12, 0.14, 0.28, 8), STEEL, { pos: [0, 0.84, -0.05] }));
      P.push(part(box(0.2, 0.22, 0.04), tc, { pos: [0, 0.82, 0.08] }));
      P.push(part(sph(0.1, 8, 6), STEEL, { pos: [0, 1.05, -0.05] }));
      if (orc) P.push(part(cone(0.03, 0.12, 5), '#e8dfc8', { pos: [0.09, 1.13, -0.05], rot: [0, 0, -0.7] }), part(cone(0.03, 0.12, 5), '#e8dfc8', { pos: [-0.09, 1.13, -0.05], rot: [0, 0, 0.7] }));
      P.push(part(cyl(0.018, 0.03, 0.95, 5), WOOD, { pos: [0.16, 0.92, 0.25], rot: [Math.PI / 2 - 0.15, 0, 0] })); // kopí
      P.push(part(cone(0.035, 0.14, 5), '#dfe5ee', { pos: [0.16, 0.99, 0.76], rot: [Math.PI / 2 - 0.15, 0, 0] }));
      P.push(part(box(0.03, 0.12, 0.14), tc, { pos: [0.16, 1.03, 0.6] })); // praporek
      break;
    }
    case 'hero': {
      P.push(...legs(0.28, orc ? '#3f3a36' : '#c9a24a', 0.08, 0.1));
      P.push(part(cyl(0.18, 0.21, 0.38, 8), orc ? '#555049' : '#e2c46a', { pos: [0, 0.47, 0] }));
      P.push(part(box(0.5, 0.16, 0.26), orc ? '#6b645c' : GOLD, { pos: [0, 0.64, 0] })); // ramena
      P.push(part(box(0.34, 0.54, 0.03), tc, { pos: [0, 0.42, -0.17], rot: [-0.12, 0, 0] })); // plášť
      P.push(part(sph(0.12, 8, 6), skin, { pos: [0, 0.8, 0] }));
      if (orc) {
        P.push(part(box(0.2, 0.06, 0.2), '#3a3028', { pos: [0, 0.9, 0] }));
        P.push(part(cone(0.04, 0.2, 5), '#efe6cf', { pos: [0.13, 0.97, 0], rot: [0, 0, -0.8] }), part(cone(0.04, 0.2, 5), '#efe6cf', { pos: [-0.13, 0.97, 0], rot: [0, 0, 0.8] }));
      } else {
        P.push(part(cyl(0.11, 0.12, 0.06, 8), GOLD, { pos: [0, 0.9, 0] })); // koruna
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; P.push(part(cone(0.025, 0.07, 4), GOLD, { pos: [Math.sin(a) * 0.1, 0.95, Math.cos(a) * 0.1] })); }
      }
      // válečné kladivo / sekera
      P.push(part(cyl(0.022, 0.022, 0.62, 6), WOOD_D, { pos: [0.26, 0.55, 0.12], rot: [0.25, 0, 0] }));
      P.push(part(box(orc ? 0.07 : 0.2, orc ? 0.24 : 0.14, orc ? 0.2 : 0.14), orc ? '#b8bec8' : STEEL, { pos: [0.26, 0.85, 0.2], rot: [0.25, 0, 0] }));
      break;
    }
    case 'wolf': {
      P.push(part(box(0.24, 0.22, 0.55), '#7d7f86', { pos: [0, 0.34, 0] }));
      for (const [x, z] of [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]]) P.push(part(box(0.06, 0.24, 0.06), '#5d5f66', { pos: [x, 0.12, z] }));
      P.push(part(box(0.2, 0.18, 0.2), '#8a8c93', { pos: [0, 0.46, 0.3] }));
      P.push(part(box(0.1, 0.08, 0.14), '#9fa1a8', { pos: [0, 0.42, 0.44] }));
      P.push(part(cone(0.04, 0.09, 4), '#5d5f66', { pos: [0.06, 0.6, 0.28] }), part(cone(0.04, 0.09, 4), '#5d5f66', { pos: [-0.06, 0.6, 0.28] }));
      P.push(part(box(0.06, 0.06, 0.26), '#6d6f76', { pos: [0, 0.4, -0.36], rot: [-0.6, 0, 0] }));
      P.push(part(box(0.1, 0.03, 0.02), '#ffdb4a', { pos: [0, 0.49, 0.405] }));
      break;
    }
    case 'golem': {
      P.push(part(dod(0.34), '#8b8f86', { pos: [0, 0.7, 0], scale: [1.2, 1, 0.9] }));
      P.push(part(dod(0.2), '#7a7e75', { pos: [0, 1.08, 0.05] }));
      P.push(part(dod(0.16), '#8b8f86', { pos: [-0.44, 0.72, 0.05] }), part(dod(0.16), '#8b8f86', { pos: [0.44, 0.72, 0.05] }));
      P.push(part(dod(0.14), '#6f736a', { pos: [-0.46, 0.38, 0.1] }), part(dod(0.14), '#6f736a', { pos: [0.46, 0.38, 0.1] }));
      P.push(part(box(0.14, 0.38, 0.16), '#6f736a', { pos: [-0.16, 0.19, 0] }), part(box(0.14, 0.38, 0.16), '#6f736a', { pos: [0.16, 0.19, 0] }));
      P.push(part(box(0.22, 0.05, 0.02), '#7ff0ff', { pos: [0, 1.1, 0.2] }));
      P.push(part(dod(0.12), '#5f8b4a', { pos: [0.18, 0.98, -0.12] })); // mech
      break;
    }
  }
  return merge(P);
}

// ------------------------------------------------------------------ budovy (střed půdorysu v počátku)
export function buildingGeo(type, team) {
  const T = TEAM_INFO[team];
  const tc = T.color, td = T.dark;
  const orc = team === 1;
  const wall = orc ? '#8c7560' : '#e8dcc4', stone = orc ? '#6e6259' : '#9ea3a8', beam = orc ? '#4a3527' : WOOD_D;
  const P = [];
  const roof = (w, d, h, y, col) => part(cone(Math.SQRT1_2, 1, 4), col, { pos: [0, y + h / 2, 0], rot: [0, Math.PI / 4, 0], scale: [w, h, d] });
  // sedlová střecha: trojboký hranol, hřeben podél osy z (délka d), šířka w, výška h, spodek v y
  const gable = (w, d, h, y, col) => {
    const hw = w / 2, hd = d / 2;
    const A = [-hw, y, -hd], B = [hw, y, -hd], C = [0, y + h, -hd], A2 = [-hw, y, hd], B2 = [hw, y, hd], C2 = [0, y + h, hd];
    const one = [A, C, B, A2, B2, C2, A, A2, C2, A, C2, C, B, C, C2, B, C2, B2, A, B, B2, A, B2, A2];
    // obě orientace trojúhelníků – ať je střecha vidět zvenku bez ohledu na pořadí vrcholů
    const tris = [...one];
    for (let i = 0; i < one.length; i += 3) tris.push(one[i], one[i + 2], one[i + 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    return part(g, col);
  };

  switch (type) {
    case 'townhall': {
      P.push(part(box(3.7, 0.3, 3.7), stone, { pos: [0, 0.15, 0], jitter: 0.1 }));
      P.push(part(box(3.0, 1.1, 2.6), wall, { pos: [0, 0.85, 0.2] }));
      P.push(roof(3.4, 3.0, 1.1, 1.4, tc));
      P.push(part(cyl(0.55, 0.62, 2.6, 8), stone, { pos: [-0.9, 1.3, -0.9], jitter: 0.1 }));
      P.push(part(cone(0.75, 1.1, 8), tc, { pos: [-0.9, 3.15, -0.9] }));
      P.push(part(box(0.6, 0.8, 0.1), beam, { pos: [0, 0.7, 1.52] })); // vrata
      for (const x of [-1.2, 1.2]) P.push(part(box(0.12, 1.1, 0.12), beam, { pos: [x, 0.85, 1.52] }));
      P.push(part(box(0.05, 0.6, 0.5), tc, { pos: [-0.9, 3.9, -0.9] })); // vlajka
      P.push(part(cyl(0.02, 0.02, 0.9, 4), beam, { pos: [-0.9, 3.9, -1.17] }));
      if (orc) for (const [x, z] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6]]) P.push(part(cone(0.08, 0.6, 5), '#e8dfc8', { pos: [x, 0.5, z], rot: [0.2, 0, 0] }));
      break;
    }
    case 'farm': {
      P.push(part(box(1.9, 0.05, 1.9), '#8a6b3c', { pos: [0, 0.025, 0] }));
      for (let k = 0; k < 4; k++) P.push(part(box(0.7, 0.14, 0.12), '#e3c35a', { pos: [0.5, 0.1, -0.7 + k * 0.28] }));
      P.push(part(box(0.9, 0.6, 0.8), wall, { pos: [-0.35, 0.35, 0.35] }));
      P.push(gable(1.05, 0.95, 0.5, 0.65, tc).applyMatrix4(new THREE.Matrix4().makeTranslation(-0.35, 0, 0.35)));
      P.push(part(box(0.22, 0.34, 0.05), beam, { pos: [-0.35, 0.2, 0.77] }));
      P.push(part(cyl(0.18, 0.2, 0.5, 8), '#d9b24a', { pos: [0.55, 0.25, 0.55] })); // kupka
      P.push(part(cone(0.22, 0.25, 8), '#d9b24a', { pos: [0.55, 0.62, 0.55] }));
      break;
    }
    case 'barracks': {
      P.push(part(box(2.8, 0.2, 2.8), stone, { pos: [0, 0.1, 0] }));
      P.push(part(box(2.4, 0.95, 1.7), wall, { pos: [0, 0.67, -0.2] }));
      P.push(gable(1.9, 2.6, 0.8, 1.14, tc).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2)).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.2)));
      for (const x of [-1.2, -0.4, 0.4, 1.2]) P.push(part(box(0.1, 0.95, 0.1), beam, { pos: [x, 0.67, 0.66] }));
      P.push(part(box(0.5, 0.7, 0.06), beam, { pos: [0, 0.55, 0.67] }));
      // stojany se zbraněmi a prapory
      for (const x of [-0.9, 0.9]) {
        P.push(part(cyl(0.03, 0.03, 1.4, 4), beam, { pos: [x, 0.9, 1.15] }));
        P.push(part(box(0.35, 0.55, 0.03), tc, { pos: [x + 0.18, 1.3, 1.15] }));
      }
      P.push(part(box(0.9, 0.08, 0.08), beam, { pos: [0, 0.5, 1.2] }));
      for (const x of [-0.3, 0, 0.3]) P.push(part(box(0.03, 0.45, 0.03), STEEL, { pos: [x, 0.62, 1.22] }));
      break;
    }
    case 'altar': {
      P.push(part(cyl(1.4, 1.45, 0.25, 8), stone, { pos: [0, 0.12, 0], jitter: 0.12 }));
      P.push(part(cyl(1.0, 1.05, 0.25, 8), stone, { pos: [0, 0.37, 0], jitter: 0.12 }));
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        P.push(part(box(0.22, 1.5, 0.22), orc ? '#5b5049' : '#d8d2c2', { pos: [Math.sin(a) * 1.05, 1.0, Math.cos(a) * 1.05] }));
        P.push(part(box(0.3, 0.12, 0.3), tc, { pos: [Math.sin(a) * 1.05, 1.8, Math.cos(a) * 1.05] }));
      }
      P.push(part(cyl(0.3, 0.4, 0.4, 6), stone, { pos: [0, 0.7, 0] }));
      P.push(part(new THREE.OctahedronGeometry(0.32, 0), orc ? '#ff7a4a' : '#9fe8ff', { pos: [0, 1.25, 0], scale: [1, 1.6, 1] }));
      break;
    }
    case 'stable': {
      P.push(part(box(2.8, 0.15, 2.8), '#8a6b3c', { pos: [0, 0.075, 0] }));
      P.push(part(box(2.2, 0.9, 1.5), orc ? '#6d4a33' : '#a0522d', { pos: [-0.1, 0.6, -0.4] }));
      P.push(gable(1.7, 2.4, 0.75, 1.05, tc).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2)).applyMatrix4(new THREE.Matrix4().makeTranslation(-0.1, 0, -0.4)));
      P.push(part(box(0.7, 0.7, 0.05), '#f0e6d0', { pos: [-0.1, 0.5, 0.36] }));
      P.push(part(box(0.7, 0.05, 0.05), beam, { pos: [-0.1, 0.5, 0.39], rot: [0, 0, 0.78] }));
      // ohrada
      for (let k = 0; k < 5; k++) P.push(part(box(0.06, 0.4, 0.06), beam, { pos: [-1.2 + k * 0.6, 0.2, 1.25] }));
      P.push(part(box(2.5, 0.05, 0.04), beam, { pos: [0, 0.32, 1.25] }));
      P.push(part(cyl(0.2, 0.22, 0.3, 8), '#e3c35a', { pos: [1.05, 0.15, 0.6] }));
      break;
    }
    case 'tower': {
      P.push(part(cyl(0.72, 0.85, 0.3, 8), stone, { pos: [0, 0.15, 0], jitter: 0.12 }));
      P.push(part(cyl(0.55, 0.68, 2.0, 8), stone, { pos: [0, 1.2, 0], jitter: 0.12 }));
      P.push(part(cyl(0.72, 0.68, 0.3, 8), stone, { pos: [0, 2.35, 0] }));
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P.push(part(box(0.2, 0.22, 0.14), stone, { pos: [Math.sin(a) * 0.64, 2.6, Math.cos(a) * 0.64], rot: [0, a, 0] })); }
      P.push(part(cone(0.6, 0.9, 8), tc, { pos: [0, 3.1, 0] }));
      P.push(part(box(0.18, 0.3, 0.05), '#2a2420', { pos: [0, 1.5, 0.62] }));
      break;
    }
  }
  return merge(P);
}

export function mineGeo() {
  const P = [];
  P.push(part(dod(1.25), '#8a7b68', { pos: [0, 0.55, -0.1], scale: [1.15, 0.75, 1.0], jitter: 0.15 }));
  P.push(part(dod(0.7), '#7c6e5c', { pos: [0.75, 0.45, 0.3], jitter: 0.15 }));
  P.push(part(dod(0.6), '#9a8a74', { pos: [-0.8, 0.35, 0.4], jitter: 0.15 }));
  P.push(part(box(0.8, 0.75, 0.3), '#1d1712', { pos: [0, 0.37, 1.02] }));
  P.push(part(box(0.1, 0.85, 0.12), WOOD, { pos: [-0.44, 0.42, 1.12] }), part(box(0.1, 0.85, 0.12), WOOD, { pos: [0.44, 0.42, 1.12] }));
  P.push(part(box(1.05, 0.12, 0.14), WOOD, { pos: [0, 0.86, 1.12] }));
  for (const [x, y, z, s] of [[0.5, 0.95, 0.5, 0.16], [-0.35, 1.05, 0.3, 0.2], [0.1, 1.25, -0.2, 0.18], [-0.7, 0.7, 0.75, 0.14], [0.9, 0.55, 0.85, 0.15]]) P.push(part(ico(s, 0), GOLD, { pos: [x, y, z] }));
  P.push(part(box(0.35, 0.18, 0.25), WOOD_D, { pos: [0.7, 0.12, 1.3] })); // vozík
  P.push(part(ico(0.1, 0), GOLD, { pos: [0.7, 0.26, 1.3] }));
  return merge(P);
}
export function treeGeo(v) {
  const P = [];
  if (v === 0) {
    P.push(part(cyl(0.07, 0.1, 0.35, 5), '#6b4527', { pos: [0, 0.17, 0] }));
    P.push(part(cone(0.46, 0.62, 7), '#2f6b3a', { pos: [0, 0.6, 0] }));
    P.push(part(cone(0.36, 0.52, 7), '#377a41', { pos: [0, 0.95, 0] }));
    P.push(part(cone(0.24, 0.42, 7), '#40894a', { pos: [0, 1.25, 0] }));
  } else if (v === 1) {
    P.push(part(cyl(0.07, 0.1, 0.45, 5), '#6b4527', { pos: [0, 0.22, 0] }));
    P.push(part(ico(0.38, 0), '#4e8f3e', { pos: [0, 0.75, 0] }));
    P.push(part(ico(0.26, 0), '#5ea447', { pos: [0.18, 0.95, 0.08] }));
    P.push(part(ico(0.24, 0), '#45823a', { pos: [-0.16, 0.9, -0.1] }));
  } else {
    P.push(part(cyl(0.06, 0.09, 0.3, 5), '#6b4527', { pos: [0, 0.15, 0] }));
    P.push(part(cone(0.42, 0.7, 6), '#2a5e36', { pos: [0, 0.6, 0] }));
    P.push(part(cone(0.3, 0.6, 6), '#306a3b', { pos: [0, 1.0, 0] }));
  }
  return merge(P);
}
export function stumpGeo() {
  return merge([part(cyl(0.1, 0.12, 0.12, 6), '#7a5230', { pos: [0, 0.06, 0] }), part(cyl(0.085, 0.085, 0.01, 6), '#c9a36a', { pos: [0, 0.125, 0] })]);
}
export function rockGeo(w, h) {
  const P = [];
  const n = w * h;
  for (let k = 0; k < n + 2; k++) {
    const x = ((k * 0.618) % 1) * w - w / 2, z = ((k * 0.414 + 0.3) % 1) * h - h / 2;
    const s = 0.45 + ((k * 0.73) % 1) * 0.35;
    P.push(part(dod(s), k % 2 ? '#8c8f93' : '#7a7d82', { pos: [x * 0.8, s * 0.6, z * 0.8], scale: [1, 0.8 + (k % 3) * 0.2, 1], rot: [k, k * 2, 0], jitter: 0.12 }));
  }
  return merge(P);
}
export function carryGeo(res) {
  if (res === 'gold') return merge([part(ico(0.09, 0), GOLD, {}), part(ico(0.06, 0), '#ffe27a', { pos: [0.06, 0.03, 0] })]);
  return merge([part(cyl(0.045, 0.045, 0.3, 5), '#8a5a33', { rot: [0, 0, Math.PI / 2] }), part(cyl(0.04, 0.04, 0.28, 5), '#7a4f2c', { pos: [0, 0.07, 0.02], rot: [0, 0, Math.PI / 2] })]);
}
export function arrowGeo() {
  return merge([
    part(cyl(0.012, 0.012, 0.42, 4), '#8a5a33', { rot: [Math.PI / 2, 0, 0] }),
    part(cone(0.03, 0.08, 4), '#cfd6de', { pos: [0, 0, 0.24], rot: [Math.PI / 2, 0, 0] }),
    part(box(0.06, 0.005, 0.08), '#f4f0e6', { pos: [0, 0, -0.18] }),
  ]);
}
export function flagGeo(color) {
  return merge([
    part(cyl(0.02, 0.025, 0.9, 5), WOOD, { pos: [0, 0.45, 0] }),
    part(box(0.02, 0.26, 0.36), color, { pos: [0, 0.76, 0.18] }),
  ]);
}
