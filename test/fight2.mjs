import { Game } from '../src/game.js';
let wins = [0, 0];
for (let s = 0; s < 6; s++) {
  const g = new Game({}); g.ai.update = () => {};
  const A = [], B = [];
  for (let k = 0; k < 9; k++) { A.push(g.spawnUnit(k < 6 ? 'footman' : 'archer', 0, 20 + (k % 5) * 0.9 + s * 0.1, 30 + Math.floor(k / 5))); B.push(g.spawnUnit(k < 6 ? 'footman' : 'archer', 1, 20 + (k % 5) * 0.9, 38 - Math.floor(k / 5))); }
  for (const u of A) g.order(u, { type: 'amove', x: 22, z: 40 });
  for (const u of B) g.order(u, { type: 'amove', x: 22, z: 28 });
  for (let k = 0; k < 600; k++) g.update(0.1);
  const a = A.filter(u => !u.dead).length, b = B.filter(u => !u.dead).length;
  console.log('seed', s, 'A', a, 'B', b, 'killed', g.stats.killed);
}
