(async () => {
  const a = window.__app, d = window.__xrdev, g = a.game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  // namiř pravou rukou na tlačítko „Do boje!“ a štípni
  const btn = a.menu.buttons.find((b) => b.id === 'go');
  out.btn = !!btn;
  const m = a.menu.mesh; m.updateMatrixWorld();
  const W = a.menu.canvas.width, H = a.menu.canvas.height, gp = m.geometry.parameters;
  const lp = new m.position.constructor((btn.x + btn.w / 2) / W * gp.width - gp.width / 2, gp.height / 2 - (btn.y + btn.h / 2) / H * gp.height, 0);
  const target = m.localToWorld(lp);
  const hand = d.hands.right;
  hand.position.set(0.15, 1.35, -0.25);
  // natočit ruku tak, aby paprsek (target ray) mířil na tlačítko
  const dir = target.clone().sub(hand.position).normalize();
  const q = new m.quaternion.constructor().setFromUnitVectors(new m.position.constructor(0, 0, -1), dir);
  hand.quaternion.set(q.x, q.y, q.z, q.w);
  await wait(600);
  out.hoverBefore = a.menu.hoverId || a.pointers.map((p) => p.hover && p.hover.type + ':' + (p.hover.btn && p.hover.btn.id)).join('|');
  hand.updatePinchValue(1); await wait(500);
  hand.updatePinchValue(0); await wait(600);
  out.menuOpen = a.menuOpen;
  await wait(3000);
  out.t = +g.time.toFixed(1);
  out.moving = g.units.filter((u) => u.team === 0 && (u.moving || u.hidden || u.carry)).length;
  return out;
})()
