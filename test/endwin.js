(async () => {
  const a = window.__app, g = a.game;
  // vylepšení: síň válečníků + výzkum
  g.res[0].gold = 5000; g.res[0].wood = 5000;
  const st = g.addBuilding('stable', 0, 14, 40, true);
  a.select([st]);
  const card = (await import('/src/ui.js')).buildCard(a);
  const rbtn = card.buttons.filter((b) => b.id.startsWith('r-')).map((b) => b.label + (b.disabled ? '(x)' : ''));
  a.researchAt('weapon'); a.researchAt('weapon'); a.researchAt('weapon');
  for (let k = 0; k < 900; k++) g.update(0.1);
  const upg = JSON.stringify(g.upg[0]);
  // hudba
  const mus = { on: a.sfx.musicOn, bus: !!a.sfx.musicBus, music: !!a.sfx.music };
  await new Promise((r) => setTimeout(r, 4000));
  mus.cached = a.sfx.music?.cache ? [...a.sfx.music.cache.values()].filter(Boolean).length : -1;
  mus.cur = a.sfx.music?.cur?.key || null;
  // vítězství
  for (const b of [...g.buildings]) if (b.team === 1) g.destroy(b, null);
  g.endT = 0; g.update(0.1); a.processEvents();
  await new Promise((r) => setTimeout(r, 2500));
  return { rbtn, upg, mus, over: g.over, score: a.score, menu: document.getElementById('menu').innerText.slice(0, 200) };
})()
