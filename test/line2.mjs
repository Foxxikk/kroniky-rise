import { Game } from '../src/game.js';
const g = new Game({}); g.ai.update = () => {};
const us = []; for (let k = 0; k < 10; k++) us.push(g.spawnUnit('footman', 0, 15 + (k % 4), 32 + Math.floor(k / 4)));
g.orderLine(us.map(u => u.id), [[13, 27], [16, 26.5], [19, 27]]);
const u = us[1];
console.log('target', u.order);
for (let k = 0; k < 120; k++) { g.update(0.1); if (k % 10 == 0) console.log(k, u.x.toFixed(1), u.z.toFixed(1), u.order.type, u.engage, u.engage && g.ents.get(u.engage)?.type, u.guard && JSON.stringify(u.guard)); }
