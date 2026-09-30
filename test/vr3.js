(() => {
  const a = window.__app, g = a.game;
  const out = { errs: [] };
  try {
    a.mode = 'vr'; a.env.setMode('vr'); a.hud.show(false);
    const cam = a.camera; cam.fov = 90; cam.aspect = 1280 / 760; cam.updateProjectionMatrix();
    cam.position.set(0, 1.62, 0); cam.lookAt(0, 0.7, -0.95); cam.updateMatrixWorld();
    a.renderer.xr.getCamera = () => cam;
    a.placedXR = false;
    const R = a.pointers[1];
    R.inputSource = { handedness: 'right' }; R.isHand = false; R.controller.matrixAutoUpdate = true;
    const V = cam.position.constructor;
    const aim = (x, z, n = 1) => {
      const p = a.world.map.localToWorld(new V(x, 0.3, z));
      R.controller.position.set(0.18, 1.25, -0.2);
      R.controller.lookAt(p); R.controller.rotateY(Math.PI); R.controller.updateMatrixWorld();
      for (let k = 0; k < n; k++) a.updateXR(0.05);
    };
    a.updateXR(0.016);
    // armáda + hrdina
    const army = []; for (let k = 0; k < 6; k++) army.push(g.spawnUnit('footman', 0, 14 + (k % 3), 33 + Math.floor(k / 3)));
    const hero = g.spawnUnit('hero', 0, 13, 32); army.push(hero);
    a.select(army);
    // kreslení formace
    aim(12, 29); a.press(R, 'select');
    for (let k = 0; k <= 8; k++) aim(12 + k, 29 - k * 0.2);
    out.lineMode = R.mode;
    a.release(R, 'select');
    out.orders = army.map((u) => u.order.type + (u.order.face != null ? '@' + u.order.face.toFixed(2) : '')).join(',');
    for (let k = 0; k < 150; k++) g.update(0.1);
    out.pos = army.map((u) => u.x.toFixed(1) + ',' + u.z.toFixed(1)).join(' ');
    // kouzlo v dlani
    a.select([hero]); hero.mana = 200;
    a.startCast('thunder'); aim(20, 27, 2);
    out.orb = a.orb && a.orb.visible;
    a.useArmed(20, 27, null); a.updateXR(0.05);
    out.flight = !!a.orbFlight;
    // do bitvy
    a.select([hero]);
    a.toggleBattle();
    for (let k = 0; k < 12; k++) a.updateXR(0.05);
    out.battle = a.battle; out.scale = a.world.board.scale.x; out.boardY = +a.world.board.position.y.toFixed(2);
    const L = a.world.map.worldToLocal(new V(0, 0, -1.1));
    out.heroFront = [+(L.x - hero.x).toFixed(2), +(L.z - hero.z).toFixed(2)];
    // poplach
    g.msg(0, 'Útok!', 'alert', { x: 20, z: 30 }); g.events.push({ type: 'msg', data: { kind: 'alert', at: { x: 20, z: 30 } } }); a.processEvents();
    out.beacons = a.world.beacons.length;
    out.cardHasAlert = true;
    a.world.update(0.05, { selection: a.selection, hover: null, barScale: 0.3 });
    cam.lookAt(0, 0.4, -2.5); cam.updateMatrixWorld();
  } catch (e) { out.errs.push(String(e.stack)); }
  return out;
})()
