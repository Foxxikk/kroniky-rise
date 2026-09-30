import { Game } from '../src/game.js';
import { EnemyAI } from '../src/ai.js';
const g = new Game({});
const bot = new EnemyAI(g, 0, { gather: 1, firstWave: 9999, waveGrow: 1, army: 99, think: 1 });
bot.rally = (base) => { const p = g.pf.nearestFree(base.cx + 5, base.cz - 5, 6); return [p[0] + 0.5, p[1] + 0.5]; };
while (g.time < 480 && !g.over) {
  g.update(0.1); bot.update(0.1);
  if (g.ai.wave >= 1 && Math.round(g.time * 10) % 50 == 0) {
    const P = g.units.filter(u => u.team === 0 && !u.def.worker).map(u => `${u.type[0]}${Math.round(u.hp)}@${u.x.toFixed(0)},${u.z.toFixed(0)}:${u.order.type}${u.engage ? '*' : ''}`).join(' ');
    const E = g.units.filter(u => u.team === 1 && !u.def.worker).map(u => `${u.type[0]}${Math.round(u.hp)}@${u.x.toFixed(0)},${u.z.toFixed(0)}:${u.order.type}${u.engage ? '*' + (g.ents.get(u.engage)?.type||'') : ''}`).join(' ');
    console.log(g.time.toFixed(0), 'P', P, '\n    E', E);
  }
}
