(() => {
  const a = window.__app, g = a.game, T = a.world.board.parent && window.THREE_NS;
  const errs = [];
  const mk = (o) => { const obj = a.scene.children[0].clone ? new a.camera.constructor().constructor : null; return o; };
  try {
    a.mode = 'vr'; a.env.setMode('vr'); a.setShadows(); a.hud.show(false);
    const cam = a.camera; cam.fov = 90; cam.aspect = 1280 / 760; cam.updateProjectionMatrix();
    cam.position.set(0, 1.62, 0); cam.lookAt(0, 0.7, -0.95); cam.updateMatrixWorld();
    a.renderer.xr.getCamera = () => cam;
    a.placedXR = false;
    const V = cam.position.constructor;
    const Obj = a.world.map.constructor; // THREE.Group
    const hand = (pts) => { const h = new Obj(); h.joints = {}; for (const [n, p] of Object.entries(pts)) { const j = new Obj(); j.position.set(...p); j.visible = true; j.jointRadius = 0.008; h.add(j); h.joints[n] = j; } a.scene.add(h); h.updateMatrixWorld(true); return h; };
    const L = a.pointers[0], R = a.pointers[1];
    // levá dlaň k obličeji
    const w = [-0.22, 1.12, -0.32];
    L.inputSource = { handedness: 'left', hand: {} }; L.isHand = true;
    L.hand = hand({ wrist: w, 'index-finger-metacarpal': [w[0] + 0.025, w[1], w[2] - 0.07], 'pinky-finger-metacarpal': [w[0] - 0.02, w[1], w[2] - 0.06], 'middle-finger-phalanx-proximal': [w[0] + 0.005, w[1], w[2] - 0.1], 'thumb-tip': [w[0] + 0.06, w[1] + 0.03, w[2] - 0.08], 'index-finger-tip': [w[0] + 0.02, w[1] + 0.02, w[2] - 0.16] });
    // pravá ruka míří na stůl
    const rp = [0.18, 1.2, -0.25];
    R.inputSource = { handedness: 'right', hand: {} }; R.isHand = true;
    R.hand = hand({ wrist: rp, 'thumb-tip': [rp[0] - 0.02, rp[1], rp[2] - 0.12], 'index-finger-tip': [rp[0] - 0.02, rp[1] + 0.05, rp[2] - 0.13] });
    R.controller.position.set(...rp); R.controller.lookAt(-0.1, 0.78, -0.95); R.controller.updateMatrixWorld();
    L.controller.position.set(...w); L.controller.updateMatrixWorld();
    // vyber dělníky
    a.selectAll('workers');
    for (let k = 0; k < 3; k++) a.updateXR(0.016);
    a.world.update(0.016, { selection: a.selection, hover: a.hover, barScale: 0.03 });
    window.__keepVR = true;
  } catch (e) { errs.push(String(e.stack)); }
  return { errs, card: a.card.mesh.visible, cardPos: a.card.mesh.position.toArray().map(v => +v.toFixed(2)), board: a.world.board.position.toArray().map(v => +v.toFixed(2)), hover: a.aimHit && [a.aimHit.x.toFixed(1), a.aimHit.z.toFixed(1)], slow: a.slowmo };
})()
