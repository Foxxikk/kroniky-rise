import { Game } from '../src/game.js';
for (const swap of [false, true]) for (const noAI of [true]) {
  let res = [];
  for (let s = 0; s < 4; s++) {
    const g = new Game({}); g.ai.update = () => {}; g.ai.onAttacked = () => {};
    const A = [], B = [];
    for (let k = 0; k < 9; k++) {
      const ta = swap ? 1 : 0, tb = swap ? 0 : 1;
      A.push(g.spawnUnit(k < 6 ? 'footman' : 'archer', ta, 20 + (k % 5) * 0.9 + s * 0.1, 30 + Math.floor(k / 5)));
      B.push(g.spawnUnit(k < 6 ? 'footman' : 'archer', tb, 20 + (k % 5) * 0.9, 38 - Math.floor(k / 5)));
    }
    for (const u of A) g.order(u, { type: 'amove', x: 22, z: 40 });
    for (const u of B) g.order(u, { type: 'amove', x: 22, z: 28 });
    for (let k = 0; k < 600; k++) g.update(0.1);
    res.push(`north(${A[0].team}):${A.filter(u => !u.dead).length} south(${B[0].team}):${B.filter(u => !u.dead).length}`);
  }
  console.log('swap', swap, res.join(' | '));
}
