import { Game } from '../src/game.js';
const g = new Game({});
for (const [x,z] of [[16,37],[13,31],[12,38],[14,30]]) console.log(x,z,g.canPlace('farm',x,z,0), g.vis[z*48+x], g.block[z*48+x]);
const th=g.buildings[0]; console.log(th.x,th.z,th.w,th.h);
