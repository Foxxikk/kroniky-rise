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
    R.inputSource = { handedness: 'right' }; R.isHand = false; R.controller.matrixAutoUpdate = true; // ovladač
    const aim = (x, z) => {
      const p = a.world.map.localToWorld(new cam.position.constructor(x, 0.3, z));
      R.controller.position.set(0.18, 1.25, -0.2);
      R.controller.lookAt(p); R.controller.rotateY(Math.PI); R.controller.updateMatrixWorld();
      a.updateXR(0.016);
    };
    a.updateXR(0.016);
    const w = g.units.find(u => u.team === 0 && u.def.worker);
    aim(w.x, w.z);
    out.hoverEnt = a.hover && a.hover.type;
    a.press(R, 'select'); aim(w.x, w.z); a.release(R, 'select');
    out.sel1 = [...a.selection].map(id => g.get(id)?.type);
    // rozkaz: pohyb
    aim(14, 33); a.press(R, 'select'); a.release(R, 'select');
    out.order = w.order.type + ' ' + (w.order.x||0).toFixed(1);
    // štětec přes dělníky u dolu
    const ws = g.units.filter(u => u.team === 0 && u.def.worker);
    const xs = ws.map(u => u.x), zs = ws.map(u => u.z);
    aim(Math.min(...xs) - 1, Math.min(...zs)); a.press(R, 'select');
    for (let k = 0; k <= 10; k++) aim(Math.min(...xs) - 1 + k * (Math.max(...xs) - Math.min(...xs) + 2) / 10, Math.min(...zs) + k * (Math.max(...zs) - Math.min(...zs)) / 10);
    out.brushMode = R.mode;
    a.release(R, 'select');
    out.sel2 = a.selection.size;
    // karta: stavba farmy tlačítkem přes activateButton
    const card = (window.__buildCard || null);
    a.startPlacing('farm');
    aim(13, 41.5); a.press(R, 'select'); a.release(R, 'select');
    out.sites = (g.sites || []).length;
    // grip = posun desky
    const p0 = a.world.board.position.clone();
    a.press(R, 'squeeze'); R.controller.position.x += 0.1; R.controller.updateMatrixWorld(); a.updateXR(0.016); a.release(R, 'squeeze');
    out.panDx = +(a.world.board.position.x - p0.x).toFixed(3);
    a.openMenu('pause'); a.updateXR(0.016);
    out.menu = a.menu.mesh.visible;
    a.closeMenu();
  } catch (e) { out.errs.push(String(e.stack)); }
  return out;
})()
