(async () => {
  const a = window.__app, d = window.__xrdev, g = a.game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const V = a.camera.position.constructor, Q = a.camera.quaternion.constructor;
  const press = async (panel, id) => {
    const btn = panel.buttons.find((b) => b.id === id); if (!btn) return 'nobtn:' + id;
    const m = panel.mesh; m.updateMatrixWorld();
    const W = panel.canvas.width, H = panel.canvas.height, gp = m.geometry.parameters;
    const target = m.localToWorld(new V((btn.x + btn.w / 2) / W * gp.width - gp.width / 2, gp.height / 2 - (btn.y + btn.h / 2) / H * gp.height, 0));
    const hand = d.hands.right; hand.position.set(0.15, 1.3, -0.2);
    const q = new Q().setFromUnitVectors(new V(0, 0, -1), target.clone().sub(hand.position).normalize());
    hand.quaternion.set(q.x, q.y, q.z, q.w);
    await wait(500); hand.updatePinchValue(1); await wait(400); hand.updatePinchValue(0); await wait(500);
    return 'ok';
  };
  const out = {};
  out.p1 = await press(a.menu, 'tut');
  out.tut = a.tutorial.active; out.step = a.tutorial.i; out.menu = a.menuOpen;
  out.p2 = await press(a.tutorial.panel, 'tut-next');
  out.step2 = a.tutorial.i;
  // podívej se dolů na stůl
  const q = new Q().setFromAxisAngle(new V(1, 0, 0), -0.6); d.quaternion.set(q.x, q.y, q.z, q.w);
  d.hands.right.position.set(0.3, 0.9, 0.3);
  await wait(1500);
  out.arrow = a.tutorial.arrow.visible; out.panel = a.tutorial.panel.mesh.visible;
  return out;
})()
