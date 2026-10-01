(() => {
  const a = window.__app; a.newGame({ tutorial: true }); const g = a.game, T = a.tutorial;
  const log = []; const st = () => log.push(T.active ? T.i : 'end');
  const tick = (n) => { for (let k = 0; k < n; k++) { g.update(0.1); a.tutorial.update(0.1, null); } };
  tick(2); st();
  T.advance(); tick(2); st();                          // vítej -> dál
  const w = g.units.find((u) => u.team === 0 && u.def.worker); a.select([w]); tick(2); st();
  a.startPlacing('farm'); tick(2); st();
  a.useArmed(16.5, 38, null); tick(2); st();
  a.select([w]); a.startPlacing('barracks'); a.useArmed(13.5, 41.5, null); tick(2); st();
  tick(700); st();
  const b = g.buildings.find((x) => x.team === 0 && x.type === 'barracks'); a.select([b]); a.trainAt('footman'); a.trainAt('footman'); tick(2); st();
  tick(400); a.select(g.units.filter((u) => u.type === 'footman')); tick(2); st();
  a.orderAt(20, 30, null); tick(2); st();
  const aiPaused = g.ai.paused; T.advance(); tick(2); st();
  a.lookAt(14, 34); a.cam.dist = 18;
  return { log: log.join(','), aiPaused, aiAfter: g.ai.paused, enemyB: g.buildings.filter((b) => b.team === 1).length };
})()
