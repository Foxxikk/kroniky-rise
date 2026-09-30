import { Game } from '../src/game.js';
const g = new Game({});
for (let k = 0; k < 400; k++) { g.update(0.1); if (k % 40 == 0) { const u = g.units.find(u=>u.team===0); const m=g.mines[0]; console.log(g.time.toFixed(1), u.order.type, u.gatherState, u.hidden, u.x.toFixed(2), u.z.toFixed(2), u.carry, u.path && u.path.length, 'mine', m.gold, m.inside, 'gold', g.res[0].gold); } }
