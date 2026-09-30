// Simulace zápasu bez grafiky: hráčský „bot“ vs AI. Hledá chyby a vypisuje průběh.
import { Game } from '../src/game.js';
const diff = process.argv[2] || 'normal';
const botLevel = process.argv[3] || 'good';
const g = new Game({ difficulty: diff });
const t0 = Date.now();
let last = 0, ticks = 0;
// jednoduchý bot hráče: kopíruje logiku AI (stejná třída, tým 0)
import { EnemyAI } from '../src/ai.js';
const bot = new EnemyAI(g, 0, botLevel === 'good' ? { gather: 1, firstWave: 480, waveGrow: 1.3, army: 10, think: 1 } : { gather: 1, firstWave: 9999, waveGrow: 1, army: 99, think: 3 });
bot.rally = function (base) { const p = g.pf.nearestFree(base.cx + 5, base.cz - 5, 6); return [p[0] + 0.5, p[1] + 0.5]; };
bot.playerTarget = function (from) { let best = null, bd = 1e9; for (const b of g.buildings) { if (b.team !== 1 || b.dead) continue; const d = (b.cx - from[0]) ** 2 + (b.cz - from[1]) ** 2; if (d < bd) { bd = d; best = b; } } return best; };
while (!g.over && g.time < 1500) {
  g.update(0.1); bot.update(0.1); ticks++;
  if (g.time - last >= 60) {
    last = g.time;
    const f0 = g.food(0), f1 = g.food(1);
    const cnt = (t) => { const o = {}; for (const u of g.units) if (u.team === t) o[u.type] = (o[u.type] || 0) + 1; return JSON.stringify(o); };
    const bc = (t) => g.buildings.filter((b) => b.team === t).map((b) => b.type[0] + (b.done ? '' : '*')).join('');
    console.log(`t=${g.time.toFixed(0)} P ${Math.round(g.res[0].gold)}g ${Math.round(g.res[0].wood)}w food ${f0.used}/${f0.cap} ${cnt(0)} [${bc(0)}] | E ${Math.round(g.res[1].gold)}g ${Math.round(g.res[1].wood)}w ${f1.used}/${f1.cap} ${cnt(1)} [${bc(1)}] wave ${g.ai.wave}`);
  }
}
console.log('KONEC', g.over, 't=', g.time.toFixed(0), 'stats', JSON.stringify(g.stats), 'ms', Date.now() - t0, 'ms/tick', ((Date.now() - t0) / ticks).toFixed(3));
