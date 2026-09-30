import { Game } from '../src/game.js';
const g = new Game({});
g.ai.update = () => {};
const a = [], b = [];
for (let k = 0; k < 5; k++) { a.push(g.spawnUnit('footman', 0, 22 + k * 0.8, 32)); b.push(g.spawnUnit('footman', 1, 22 + k * 0.8, 38)); }
for (const u of b) g.order(u, { type: 'amove', x: 24, z: 30 });
for (let k = 0; k < 300; k++) { g.update(0.1); if (k % 30 == 0) console.log(g.time.toFixed(1), a.map(u => (u.dead ? 'X' : Math.round(u.hp)) + ':' + u.order.type + (u.engage ? '*' : '')).join(' '), '|', b.map(u => (u.dead ? 'X' : Math.round(u.hp))).join(' ')); }
// dřevo
const w = g.units.find(u => u.team === 0 && u.def.worker);
g.order(w, { type: 'gather', target: -1, tx: 5, tz: 44 });
for (let k = 0; k < 300; k++) { g.update(0.1); if (k % 30 == 0) console.log('W', g.time.toFixed(1), w.gatherState, w.x.toFixed(1), w.z.toFixed(1), JSON.stringify(w.carry), w.order.tree, w.path && w.path.length, g.res[0].wood); }
