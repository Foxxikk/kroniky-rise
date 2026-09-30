import { Game } from '../src/game.js';
import { EnemyAI } from '../src/ai.js';
const g = new Game({});
const bot = new EnemyAI(g, 0, { gather: 1, firstWave: 9999, waveGrow: 1, army: 99, think: 1 });
bot.rally = (base) => { const p = g.pf.nearestFree(base.cx + 5, base.cz - 5, 6); return [p[0] + 0.5, p[1] + 0.5]; };
let shown = 0;
while (g.time < 420 && !g.over) {
  g.update(0.1); bot.update(0.1);
  if (g.time > 408 && shown++ < 6) {
    for (const u of g.units.filter(u => u.team === 0 && !u.def.worker)) { const t = g.ents.get(u.engage); console.log(g.time.toFixed(1), u.id, 'hp', Math.round(u.hp), 'cool', u.cool.toFixed(2), 'eng', t && t.type, t && t.team, t && g.gap(u, t).toFixed(2), 'guard', u.guard && Math.hypot(u.x-u.guard.x,u.z-u.guard.z).toFixed(1), 'moving', u.path && u.path.length); }
  }
}
