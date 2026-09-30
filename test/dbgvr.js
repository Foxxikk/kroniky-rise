(() => {
  const a = window.__app, g = a.game;
  a.mode = 'vr';
  const cam = a.camera; cam.position.set(0, 1.62, 0); cam.lookAt(0, 0.7, -0.95); cam.updateMatrixWorld();
  a.renderer.xr.getCamera = () => cam;
  a.placedXR = false; a.updateXR(0.016);
  const R = a.pointers[1]; R.inputSource = { handedness: 'right' }; R.isHand = false;
  const w = g.units.find(u => u.team === 0 && u.def.worker);
  const p = a.world.map.localToWorld(new cam.position.constructor(w.x, 0.3, w.z));
  R.controller.position.set(0.18, 1.25, -0.2); R.controller.lookAt(p); R.controller.rotateY(Math.PI); R.controller.updateMatrixWorld();
  a.pointerRay(R);
  const r = a.pickRay(R.origin, R.dir);
  const h = a.computeHover(R);
  return { p: p.toArray(), o: R.origin.toArray(), d: R.dir.toArray(), r: r && [r.x, r.z, r.ent && r.ent.type], h: h && h.type, w: [w.x, w.z], hv: a.handles.visible, menu: a.menuOpen, bs: a.world.board.scale.x };
})()
