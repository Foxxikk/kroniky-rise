import { Game } from '../src/game.js';
const g = new Game({}); g.ai.update = () => {};
const a = [], b = [];
for (let k = 0; k < 5; k++) { a.push(g.spawnUnit('footman', 0, 22 + k * 0.8, 32)); b.push(g.spawnUnit('footman', 1, 22 + k * 0.8, 38)); }
for (const u of b) g.order(u, { type: 'amove', x: 24, z: 30 });
for (let k = 0; k < 200; k++) { g.update(0.1); if (k % 20 == 0) { const u = a[4], e = g.ents.get(u.engage); console.log(g.time.toFixed(1), u.x.toFixed(2), u.z.toFixed(2), 'eng', e && e.id, e && g.gap(u,e).toFixed(2), 'path', JSON.stringify(u.path), 'stuck', u.stuckT.toFixed(1), 'E5', b[4].x.toFixed(1), b[4].z.toFixed(1), b[4].order.type, b[4].engage); } }
