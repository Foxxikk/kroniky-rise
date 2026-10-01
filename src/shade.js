// Úpravy shaderů standardních materiálů (jedna funkce, řetězí se přes onBeforeCompile):
//  mlha války (textura hráčovy viditelnosti), stíny plujících mraků, vítr (stromy, tráva),
//  obrysové světlo (rim) a zapečené animace postav (VAT).
import * as THREE from 'three';
import { MAP_W, MAP_H } from './config.js';

export const shared = {
  uTime: { value: 0 },
  uFog: { value: null },
  uFogOn: { value: 1 },
  uMapInv: { value: new THREE.Matrix4() },
  uClouds: { value: 1 },
};

const NOISE = `
  float cHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(cHash(i), cHash(i+vec2(1,0)), u.x), mix(cHash(i+vec2(0,1)), cHash(i+vec2(1,1)), u.x), u.y); }
`;

/**
 * opts: fog (mlha války), clouds (stíny mraků), wind (síla), windFrom (výška, odkud se ohýbá), rim (obrys),
 *       vat: { tex, N, W } (zapečená animace; instance mají atribut aAnim = (snímek0, snímek1, prolnutí))
 */
export function shade(mat, { fog = true, clouds = true, wind = 0, windFrom = 0.2, rim = 0, vat = null } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    let vs = sh.vertexShader;
    let head = 'uniform float uTime;\nuniform mat4 uMapInv;\nvarying vec2 vMapPos;\n';
    if (vat) {
      sh.uniforms.uVat = { value: vat.tex };
      sh.uniforms.uVatN = { value: vat.N };
      head += `uniform highp sampler2D uVat;\nuniform float uVatN;\nattribute float aVid;\nattribute vec3 aAnim;
        vec3 vatFetch(float frame, int k) {
          int i = (int(frame + 0.5) * int(uVatN + 0.5) + int(aVid + 0.5)) * 2 + k;
          return texelFetch(uVat, ivec2(i % ${vat.W}, i / ${vat.W}), 0).xyz;
        }\n`;
      vs = vs.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(vatFetch(aAnim.x, 1), vatFetch(aAnim.y, 1), aAnim.z));');
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = mix(vatFetch(aAnim.x, 0), vatFetch(aAnim.y, 0), aAnim.z);');
    }
    if (wind) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float wh = max(0.0, transformed.y - ${windFrom.toFixed(3)});
        vec2 wp = transformed.xz;
        #ifdef USE_INSTANCING
          wp += vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #endif
        transformed.x += sin(uTime * 1.6 + wp.x * 0.7 + wp.y * 0.5) * wh * ${wind.toFixed(3)};
        transformed.z += cos(uTime * 1.2 + wp.x * 0.4 + wp.y * 0.9) * wh * ${(wind * 0.7).toFixed(3)}; }`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        vMapPos = (uMapInv * (modelMatrix * wp)).xz; }`);
    sh.vertexShader = head + vs;
    let fs = 'uniform float uTime;\nuniform sampler2D uFog;\nuniform float uFogOn;\nuniform float uClouds;\nvarying vec2 vMapPos;\n' + NOISE + sh.fragmentShader;
    let post = '';
    if (clouds) post += `
      { float n = cNoise(vMapPos * 0.09 + uTime * vec2(0.035, 0.015)) * 0.65 + cNoise(vMapPos * 0.23 - uTime * vec2(0.015, 0.03)) * 0.35;
        outgoingLight *= mix(1.0, 0.72, smoothstep(0.52, 0.72, n) * uClouds); }`;
    if (rim) post += `
      { float rr = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
        outgoingLight += vec3(1.0, 0.93, 0.78) * pow(rr, 2.5) * ${rim.toFixed(3)}; }`;
    if (fog) post += `
      { float fv = texture2D(uFog, vMapPos / vec2(${MAP_W.toFixed(1)}, ${MAP_H.toFixed(1)})).r;
        fv = mix(1.0, fv, uFogOn);
        float lum = dot(outgoingLight, vec3(0.3, 0.55, 0.15));
        vec3 dim = mix(vec3(lum) * vec3(0.82, 0.86, 1.0), outgoingLight, 0.5) * 0.62;
        vec3 dark = mix(vec3(lum) * vec3(0.5, 0.52, 0.62), outgoingLight, 0.15) * 0.42 + vec3(0.02, 0.022, 0.04);
        outgoingLight = fv < 0.5 ? mix(dark, dim, fv * 2.0) : mix(dim, outgoingLight, (fv - 0.5) * 2.0); }`;
    fs = fs.replace('#include <opaque_fragment>', post + '\n#include <opaque_fragment>');
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `sh${fog}${clouds}${wind}${windFrom}${rim}${vat ? 'v' + vat.N : ''}`;
  return mat;
}

/** Stínový materiál pro VAT postavy (stín podle animace). */
export function vatDepth(vat) {
  const m = new THREE.MeshDepthMaterial();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uVat = { value: vat.tex };
    sh.uniforms.uVatN = { value: vat.N };
    sh.vertexShader = `uniform highp sampler2D uVat;\nuniform float uVatN;\nattribute float aVid;\nattribute vec3 aAnim;
      vec3 vatFetch(float frame, int k) {
        int i = (int(frame + 0.5) * int(uVatN + 0.5) + int(aVid + 0.5)) * 2 + k;
        return texelFetch(uVat, ivec2(i % ${vat.W}, i / ${vat.W}), 0).xyz;
      }\n` + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = mix(vatFetch(aAnim.x, 0), vatFetch(aAnim.y, 0), aAnim.z);');
  };
  m.customProgramCacheKey = () => 'vatd' + vat.N;
  return m;
}

// ------------------------------------------------------------ textury
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Jemná kresba trávy (šedotónová – násobí barvy vrcholů terénu). */
export function grassDetailTexture() {
  const t = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#e9e9e9';
    ctx.fillRect(0, 0, s, s);
    const r = rng(3);
    for (let k = 0; k < 2600; k++) {
      const x = r() * s, y = r() * s, l = 3 + r() * 7, v = 200 + Math.floor(r() * 55);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - l); ctx.stroke();
    }
    for (let k = 0; k < 400; k++) {
      const v = 150 + Math.floor(r() * 50);
      ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      ctx.beginPath(); ctx.arc(r() * s, r() * s, 1 + r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  });
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
