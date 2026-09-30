(() => { const a = window.__app, g = a.game; g.revealAll = true; g.updateVisibility();
  for (let k = 0; k < 4000; k++) g.update(0.1);
  a.world.update(0.016, { selection: a.selection });
  a.cam.dist = 60; a.cam.x = 24; a.cam.z = 24; a.updateDesktop(0.016);
  a.renderer.info.autoReset = false; a.renderer.info.reset(); a.renderer.render(a.scene, a.camera);
  const t0 = performance.now(); for (let k = 0; k < 100; k++) g.update(0.016); const upd = (performance.now() - t0) / 100;
  return { calls: a.renderer.info.render.calls, tris: a.renderer.info.render.triangles, units: g.units.length, t: g.time, over: g.over, updMs: upd.toFixed(2) }; })()
