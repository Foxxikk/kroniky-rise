(async () => {
  const a = window.__app, d = window.__xrdev, g = a.game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const V = a.camera.position.constructor, Q = a.camera.quaternion.constructor;
  const R = d.controllers.right, L = d.controllers.left;
  const aimAt = (ctrl, p) => { const q = new Q().setFromUnitVectors(new V(0, 0, -1), p.clone().sub(ctrl.position).normalize()); ctrl.quaternion.set(q.x, q.y, q.z, q.w); };
  const trig = async (ctrl) => { ctrl.updateButtonValue('trigger', 1); await wait(350); ctrl.updateButtonValue('trigger', 0); await wait(400); };
  const out = { inputs: a.pointers.map((p) => p.inputSource?.handedness + ':' + p.isHand) };
  R.position.set(0.2, 1.25, -0.25); L.position.set(-0.2, 1.25, -0.25);
  // zavřít úvod tlačítkem „Hrát rovnou“
  const m = a.menu, btn = m.buttons.find((b) => b.id === 'go');
  const gp = m.mesh.geometry.parameters; m.mesh.updateMatrixWorld();
  aimAt(R, m.mesh.localToWorld(new V((btn.x + btn.w / 2) / m.canvas.width * gp.width - gp.width / 2, gp.height / 2 - (btn.y + btn.h / 2) / m.canvas.height * gp.height, 0)));
  await wait(400); await trig(R);
  out.menuAfter = a.menuOpen;
  // vybrat radnici spouští (míření na hrad)
  const th = g.buildings.find((b) => b.team === 0 && b.type === 'townhall');
  aimAt(R, a.world.map.localToWorld(new V(th.cx, 1.5, th.cz))); await wait(400); await trig(R);
  out.sel = a.selectedEnts().map((e) => e.type).join(',');
  // karta nad levým ovladačem je vidět
  await wait(300); out.card = a.card.mesh.visible;
  // vycvičit dělníka tlačítkem na kartě
  const cb = a.card.buttons.find((b) => b.id === 't-worker');
  if (cb) { const cg = a.card.mesh.geometry.parameters; a.card.mesh.updateMatrixWorld();
    aimAt(R, a.card.mesh.localToWorld(new V((cb.x + cb.w / 2) / a.card.canvas.width * cg.width - cg.width / 2, cg.height / 2 - (cb.y + cb.h / 2) / a.card.canvas.height * cg.height, 0)));
    await wait(400); await trig(R); }
  out.queue = th.queue.length;
  // Y = menu
  L.updateButtonValue('y-button', 1); await wait(300); L.updateButtonValue('y-button', 0); await wait(400);
  out.pause = a.menuOpen;
  a.closeMenu();
  // vítězství
  for (const b of [...g.buildings]) if (b.team === 1) g.destroy(b, null);
  g.endT = 0; await wait(3500);
  out.end = a.menuOpen; out.stars = a.score?.stars;
  const q = new Q().setFromAxisAngle(new V(1, 0, 0), -0.15); d.quaternion.set(q.x, q.y, q.z, q.w);
  await wait(800);
  return out;
})()
