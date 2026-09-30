import { Game } from '../src/game.js';
for (const swap of [false, true]) {
  let res = [];
  for (let s = 0; s < 4; s++) {
    const g = new Game({}); g.ai.update = () => {}; g.ai.onAttacked = () => {};
    for (let z = 12; z < 36; z++) for (let x = 12; x < 36; x++) { const i = z * 48 + x; if (g.block[i] === 1 || g.block[i] === 4) { g.block[i] = 0; if (g.treeAt[i] >= 0) { g.trees[g.treeAt[i]].alive = false; g.treeAt[i] = -1; } } }
    g.units = g.units.filter(u => u.team !== 2);
    const A = [], B = [];
    for (let k = 0; k < 9; k++) {
      const ta = swap ? 1 : 0, tb = swap ? 0 : 1;
      A.push(g.spawnUnit(k < 6 ? 'footman' : 'archer', ta, 22 + (k % 5) * 0.9 + s * 0.1, 18 + Math.floor(k / 5) * (k < 6 ? 1 : -1)));
      B.push(g.spawnUnit(k < 6 ? 'footman' : 'archer', tb, 22 + (k % 5) * 0.9, 27 - Math.floor(k / 5) * (k < 6 ? 1 : -1)));
    }
    for (const u of A) g.order(u, { type: 'amove', x: 24, z: 32 });
    for (const u of B) g.order(u, { type: 'amove', x: 24, z: 14 });
    for (let k = 0; k < 600; k++) g.update(0.1);
    res.push(`N(${A[0].team}):${A.filter(u => !u.dead).length} S(${B[0].team}):${B.filter(u => !u.dead).length}`);
  }
  console.log('swap', swap, res.join(' | '));
}
