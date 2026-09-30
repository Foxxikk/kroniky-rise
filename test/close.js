(() => { const a = window.__app, g = a.game; g.revealAll = true; g.updateVisibility();
  const b = g.buildings.find(b => b.team === 1 && b.type === 'townhall');
  for (const t of ['barracks','altar','stable','tower','farm']) { const x = { barracks: 30, altar: 34, stable: 38, tower: 42, farm: 30 }[t]; g.addBuilding(t, 0, x, t === 'farm' ? 22 : 18, true); }
  g.spawnUnit('knight', 0, 31, 24); g.spawnUnit('hero', 0, 33, 24); g.spawnUnit('footman', 0, 35, 24); g.spawnUnit('archer', 0, 36, 24); g.spawnUnit('hero', 1, 38, 24); g.spawnUnit('footman', 1, 39, 24); g.spawnUnit('knight', 1, 40, 24);
  a.lookAt(36, 21); a.cam.dist = 13; a.cam.pitch = 0.7; return 'ok'; })()
