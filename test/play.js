(() => {
  const a = window.__app, g = a.game;
  const errs = [];
  try {
    // dělníci postaví kasárna a farmu, radnice cvičí
    const ws = g.units.filter(u => u.team === 0 && u.def.worker);
    a.select([ws[0]]); a.startPlacing('barracks'); a.useArmed(14.5, 35.5, null);
    a.select([ws[1]]); a.startPlacing('farm'); a.useArmed(13, 41.5, null);
    a.selectAll('townhall'); a.trainAt('worker');
    for (let k = 0; k < 900; k++) g.update(0.1);
    const b = g.buildings.find(b => b.team === 0 && b.type === 'barracks');
    a.select([b]); a.trainAt('footman'); a.trainAt('archer');
    for (let k = 0; k < 500; k++) g.update(0.1);
    a.selectAll('army');
    const army = a.selectedEnts();
    a.orderAt(20, 24, null);
    for (let k = 0; k < 60; k++) g.update(0.1);
    a.lookAt(18, 30); a.cam.dist = 20;
  } catch (e) { errs.push(String(e.stack)); }
  return { t: g.time, res: g.res[0], b: g.buildings.filter(b=>b.team===0).map(b => b.type + (b.done?'':'*')), u: g.units.filter(u=>u.team===0).map(u=>u.type).join(','), errs, e: g.buildings.filter(b=>b.team===1).map(b=>b.type).join(',') };
})()
