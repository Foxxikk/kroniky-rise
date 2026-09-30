import { Game } from '../src/game.js';
import { EnemyAI } from '../src/ai.js';
const g = new Game({});
const bot = new EnemyAI(g, 0, { gather: 1, firstWave: 9999, waveGrow: 1, army: 99, think: 1 });
bot.rally = (base) => { const p = g.pf.nearestFree(base.cx + 5, base.cz - 5, 6); return [p[0] + 0.5, p[1] + 0.5]; };
let n = 0, zeroBudget = 0, steps = 0; const who = {};
const f = g.pf.find.bind(g.pf); g.pf.find = (...a) => { n++; return f(...a); };
const st = g.step.bind(g); g.step = (dt) => { st(dt); steps++; if (g.pathBudget <= 0) zeroBudget++; };
const mv = g.moveTo.bind(g); g.moveTo = (u, ...a) => { const b = g.pathBudget; const r = mv(u, ...a); if (g.pathBudget < b) { const k = u.type + ':' + u.order.type + (u.engage ? '*' : ''); who[k] = (who[k] || 0) + 1; } return r; };
while (g.time < 425 && !g.over) { g.update(0.1); bot.update(0.1); if (g.time > 400 && g.time < 400.1) { n = 0; zeroBudget = 0; steps = 0; for (const k in who) delete who[k]; } }
console.log('paths/s', n / 25, 'steps with 0 budget', zeroBudget, '/', steps, who);
