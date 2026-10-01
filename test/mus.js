(async () => {
  const a = window.__app, s = a.sfx;
  const r = { state0: s.ctx?.state };
  await s.ctx.resume().catch(() => {});
  r.state1 = s.ctx.state;
  const t0 = performance.now();
  for (let k = 0; k < 40; k++) { await new Promise((q) => setTimeout(q, 500)); const n = [...(s.music.cache?.values() || [])].filter(Boolean).length; if (n) { r.renderMs = Math.round(performance.now() - t0); break; } }
  r.cached = [...(s.music.cache?.values() || [])].filter(Boolean).length;
  a.game.lastCombat = 1e9; await new Promise((q) => setTimeout(q, 5000));
  r.cur = s.music.cur?.key; r.intensity = a.musicIntensity();
  return r;
})()
