(() => {
  const a = window.__app; a.newGame({ tutorial: true }); const g = a.game, T = a.tutorial;
  const tick = (n) => { for (let k = 0; k < n; k++) { g.update(0.1); a.tutorial.update(0.1, null); } };
  T.advance(); tick(2);
  const w = g.units.find((u) => u.team === 0 && u.def.worker); a.select([w]); tick(2);
  const r = { i: T.i, sel: a.selection.size, hidden: w.hidden };
  a.startPlacing('farm'); r.placing = a.placing; tick(2); r.i2 = T.i; r.placing2 = a.placing;
  const ok = a.useArmed(16.5, 38, null); r.ok = ok; r.sites = (g.sites || []).length; r.msgs = g.messages.map((m) => m.text); tick(2); r.i3 = T.i;
  return r;
})()
