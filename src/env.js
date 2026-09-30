// Prostředí: světla, obloha, válečný stan se stolem (VR), podlaha. V MR se stan schová (je vidět skutečný pokoj).
import * as THREE from 'three';
import { part, merge } from './models.js';
import { dotTexture } from './world.js';

export class Env {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight('#fff4dd', '#4a4038', 0.95);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.7);
    this.sun.position.set(-8, 14, 6);
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight('#b9d0ff', 0.5);
    this.fill.position.set(6, 8, -8);
    scene.add(this.fill);
    // pozadí pro PC: gradient
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#1d2744'); gr.addColorStop(0.55, '#2c3a5c'); gr.addColorStop(1, '#141a2c');
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    this.bg = new THREE.CanvasTexture(c); this.bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = this.bg;
    this.buildTent();
  }
  buildTent() {
    // válečný stan: kruhová podlaha, plátěné stěny, stůl pod deskou, lucerny
    const t = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5a4430', roughness: 1 }));
    t.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.9, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7a2a24', roughness: 1 }));
    rug.position.y = 0.005; t.add(rug);
    const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.85, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d6a84a', roughness: 1 }));
    rug2.position.y = 0.007; t.add(rug2);
    // stěny: pruhované plátno (vertex colors)
    const wall = new THREE.CylinderGeometry(4.2, 4.2, 2.6, 24, 1, true);
    const col = new Float32Array(wall.attributes.position.count * 3);
    const a = new THREE.Color('#e9dcc0'), b = new THREE.Color('#b8452f'), cc = new THREE.Color();
    for (let i = 0; i < wall.attributes.position.count; i++) {
      const x = wall.attributes.position.getX(i), z = wall.attributes.position.getZ(i);
      const seg = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 24 + 0.5);
      cc.copy(seg % 2 ? a : b);
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    wall.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const wallM = new THREE.Mesh(wall, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.BackSide, roughness: 1, flatShading: true }));
    wallM.position.y = 1.3; t.add(wallM);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 1.8, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#c9b891', side: THREE.BackSide, roughness: 1, flatShading: true }));
    roof.position.y = 3.5; t.add(roof);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.4, 8), new THREE.MeshStandardMaterial({ color: '#6b4527' }));
    pole.position.set(0, 2.2, 1.9); t.add(pole);
    // stůl (pod deskou: deska se na něj pokládá)
    const table = merge([
      part(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 32), '#6b4527', { pos: [0, 0.74, 0] }),
      part(new THREE.CylinderGeometry(0.75, 0.75, 0.02, 32), '#d4a64a', { pos: [0, 0.715, 0] }),
      part(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 10), '#553520', { pos: [0, 0.35, 0] }),
      part(new THREE.CylinderGeometry(0.45, 0.5, 0.06, 16), '#553520', { pos: [0, 0.03, 0] }),
    ]);
    this.table = new THREE.Mesh(table, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    t.add(this.table);
    // lucerny (bez světel – jen zářící sprity kvůli výkonu)
    const lampGeo = merge([
      part(new THREE.CylinderGeometry(0.07, 0.08, 0.18, 6), '#3a2a1a', { pos: [0, 0, 0] }),
      part(new THREE.ConeGeometry(0.1, 0.1, 6), '#3a2a1a', { pos: [0, 0.14, 0] }),
      part(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 3), '#2a2a2a', { pos: [0, 0.48, 0] }),
    ]);
    const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ff9a3a', emissiveIntensity: 0.25 });
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + 0.3;
      const l = new THREE.Mesh(lampGeo, lampMat);
      l.position.set(Math.cos(ang) * 3.2, 2.1, Math.sin(ang) * 3.2);
      t.add(l);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#ffb35a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      glow.scale.setScalar(0.55);
      glow.position.copy(l.position);
      t.add(glow);
    }
    // truhla a korouhev pro atmosféru
    const chest = merge([part(new THREE.BoxGeometry(0.7, 0.4, 0.45), '#6b4527', { pos: [0, 0.2, 0] }), part(new THREE.BoxGeometry(0.72, 0.06, 0.47), '#d4a64a', { pos: [0, 0.3, 0] })]);
    const ch = new THREE.Mesh(chest, new THREE.MeshStandardMaterial({ vertexColors: true }));
    ch.position.set(2.6, 0, -2.2); ch.rotation.y = 0.8; t.add(ch);
    const banner = merge([part(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 6), '#6b4527', { pos: [0, 1.1, 0] }), part(new THREE.BoxGeometry(0.02, 0.9, 0.55), '#3f74f0', { pos: [0, 1.7, 0.3] }), part(new THREE.BoxGeometry(0.03, 0.2, 0.2), '#ffd84a', { pos: [0, 1.75, 0.3] })]);
    for (const [x, z, r] of [[-2.8, -2.0, 0.6], [2.9, 1.6, -2.4]]) { const m = new THREE.Mesh(banner, new THREE.MeshStandardMaterial({ vertexColors: true })); m.position.set(x, 0, z); m.rotation.y = r; t.add(m); }
    t.visible = false;
    this.tent = t;
    this.scene.add(t);
  }
  sky() {
    if (this._sky) return this._sky;
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5f8fd0'); gr.addColorStop(0.5, '#a9cdea'); gr.addColorStop(0.62, '#e8e2cf'); gr.addColorStop(1, '#6e8a5a');
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
    return (this._sky = t);
  }
  setMode(mode) {
    this.tent.visible = mode === 'vr';
    this.scene.background = mode === 'ar' ? null : mode === 'vr' ? new THREE.Color('#1a1510') : mode === 'battle' ? this.sky() : this.bg;
    this.hemi.intensity = mode === 'vr' ? 0.9 : 0.95;
  }
}
