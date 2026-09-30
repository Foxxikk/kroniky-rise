import { Game } from '../src/game.js';
const g = new Game({}); g.ai.update = () => {};
const us = []; for (let k = 0; k < 10; k++) us.push(g.spawnUnit('footman', 0, 15 + (k % 4), 32 + Math.floor(k / 4)));
console.log('ok?', g.orderLine(us.map(u => u.id), [[13, 27], [16, 26.5], [19, 27]]));
for (let k = 0; k < 200; k++) g.update(0.1);
console.log(us.map(u => `${u.x.toFixed(1)},${u.z.toFixed(1)} f${u.facing.toFixed(2)} ${u.order.type}`).join(' | '));
console.log('short', g.orderLine(us.map(u => u.id), [[15, 29], [17, 29]]));
for (let k = 0; k < 200; k++) g.update(0.1);
console.log(us.map(u => `${u.x.toFixed(1)},${u.z.toFixed(1)}`).join(' | '));
