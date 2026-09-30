(async () => {
  const m = await import('/src/assets.js');
  const t0 = performance.now();
  const A = await m.loadAssets();
  const hex = {}; for (const [k, g] of Object.entries(A.hex)) { const b = g.boundingBox; hex[k] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z, b.min.y].map(v => +v.toFixed(2)); }
  const units = {}; for (const [k, u] of Object.entries(A.units)) units[k] = { N: u.N, texH: u.tex.image.height, segs: Object.keys(u.segs).join('/') };
  return { ms: Math.round(performance.now() - t0), ready: A.ready, err: String(A.error || ''), hex, units, parts: Object.keys(A.parts) };
})()
