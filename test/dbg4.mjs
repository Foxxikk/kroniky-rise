import { Game } from '../src/game.js';
import { EnemyAI } from '../src/ai.js';
const g = new Game({});
const bot = new EnemyAI(g, 0, { gather: 1, firstWave: 9999, waveGrow: 1, army: 99, think: 1 });
bot.rally = (base) => { const p = g.pf.nearestFree(base.cx + 5, base.cz - 5, 6); return [p[0] + 0.5, p[1] + 0.5]; };
const dealt = { 0: 0, 1: 0 }, heals = [];
const orig = g.damage.bind(g);
g.damage = (t, a, src, m) => { const hp = t.hp; orig(t, a, src, m); if (src && t.kind==='unit' && !t.def.worker) dealt[src.team] = (dealt[src.team]||0) + (hp - Math.max(0,t.hp)); };
g.events.push = function (e) { if (e.type === 'heal' || e.type === 'thunder') heals.push(e.type + '@' + g.time.toFixed(0)); return Array.prototype.push.call(this, e); };
while (g.time < 425 && !g.over) { g.update(0.1); bot.update(0.1); }
console.log(dealt, heals.join(' '));
const E = g.units.filter(u => u.team === 1 && !u.def.worker); console.log(E.map(u=>u.type+Math.round(u.hp)+'/'+u.maxHp).join(' '));
