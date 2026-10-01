(async () => {
  const a = window.__app, s = a.sfx; await s.ctx.resume();
  for (let k = 0; k < 40; k++) { await new Promise((q) => setTimeout(q, 500)); if ([...(s.music.cache?.values() || [])].filter(Boolean).length) break; }
  let err = null; try { s.music.update(1); } catch (e) { err = String(e.stack).slice(0, 400); }
  return { err, cur: s.music.cur?.key, musicOn: s.musicOn, mode: a.mode, paused: a.paused, menuOpen: a.menuOpen };
})()
