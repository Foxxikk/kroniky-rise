// Hledání cest po mřížce: A* (8 směrů, bez řezání rohů) + vyhlazení přímou viditelností.
// Mřížka: block[i] != 0 = neprůchodné (strom, budova, důl, skála).

const SQ2 = Math.SQRT2;

export class PathFinder {
  constructor(w, h, block) {
    this.w = w; this.h = h; this.block = block;
    const n = w * h;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 1;
    this.heap = new Int32Array(n * 2);
    this.goal = new Uint32Array(n);
    this.goalGen = 1;
  }
  free(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h && this.block[z * this.w + x] === 0; }
  /** Nejbližší volné políčko k (x, z) (BFS po spirále). */
  nearestFree(x, z, maxR = 12) {
    x = Math.max(0, Math.min(this.w - 1, Math.floor(x)));
    z = Math.max(0, Math.min(this.h - 1, Math.floor(z)));
    if (this.free(x, z)) return [x, z];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (!this.free(x + dx, z + dz)) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = [x + dx, z + dz]; }
      }
      if (best) return best;
    }
    return null;
  }
  /** Volná políčka kolem obdélníku (budova, důl, strom) – cíle, odkud se dá „dosáhnout“. */
  ringTiles(x0, z0, w, h) {
    const out = [];
    for (let z = z0 - 1; z <= z0 + h; z++) for (let x = x0 - 1; x <= x0 + w; x++) {
      if (x >= x0 && x < x0 + w && z >= z0 && z < z0 + h) continue;
      if (this.free(x, z)) out.push(z * this.w + x);
    }
    return out;
  }
  /**
   * A* z bodu (sx, sz) do libovolného z cílových políček (pole indexů).
   * Vrací pole bodů [x, z] (středy políček) nebo null. Když cíl není dosažitelný, vrátí cestu k nejbližšímu místu.
   */
  find(sx, sz, goals, maxExpand = 5000) {
    const W = this.w;
    const st = this.nearestFree(sx, sz, 4);
    if (!st || !goals.length) return null;
    const s = st[1] * W + st[0];
    this.gen++; this.goalGen++;
    const gen = this.gen, gg = this.goalGen;
    let hx = 0, hz = 0;
    for (const gi of goals) { this.goal[gi] = gg; hx += gi % W; hz += (gi / W) | 0; }
    hx /= goals.length; hz /= goals.length;
    // heuristika k nejbližšímu cíli (pro menší počet cílů přesná, jinak k těžišti)
    const few = goals.length <= 24;
    const gx = goals.map((i) => i % W), gz = goals.map((i) => (i / W) | 0);
    const H = (i) => {
      const x = i % W, z = (i / W) | 0;
      if (few) {
        let best = 1e9;
        for (let k = 0; k < gx.length; k++) {
          const dx = Math.abs(x - gx[k]), dz = Math.abs(z - gz[k]);
          const d = dx + dz + (SQ2 - 2) * Math.min(dx, dz);
          if (d < best) best = d;
        }
        return best;
      }
      const dx = Math.abs(x - hx), dz = Math.abs(z - hz);
      return dx + dz + (SQ2 - 2) * Math.min(dx, dz);
    };
    const heap = this.heap, g = this.g, f = this.f, from = this.from, stamp = this.stamp, closed = this.closed;
    let hn = 0;
    const push = (i) => {
      let k = hn++;
      heap[k] = i;
      while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[i]) break; heap[k] = heap[p]; heap[p] = i; k = p; }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap[--hn];
      let k = 0;
      if (hn > 0) {
        heap[0] = last;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < hn && f[heap[l]] < f[heap[m]]) m = l;
          if (r < hn && f[heap[r]] < f[heap[m]]) m = r;
          if (m === k) break;
          const t = heap[k]; heap[k] = heap[m]; heap[m] = t; k = m;
        }
      }
      return top;
    };
    stamp[s] = gen; g[s] = 0; f[s] = H(s); from[s] = -1;
    push(s);
    let bestI = s, bestH = f[s], found = -1, exp = 0;
    while (hn > 0) {
      const cur = pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (this.goal[cur] === gg) { found = cur; break; }
      const hc = f[cur] - g[cur];
      if (hc < bestH) { bestH = hc; bestI = cur; }
      if (++exp > maxExpand) break;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.free(nx, nz)) continue;
        if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (closed[ni] === gen) continue;
        const ng = g[cur] + (dx && dz ? SQ2 : 1);
        if (stamp[ni] !== gen || ng < g[ni]) {
          stamp[ni] = gen; g[ni] = ng; f[ni] = ng + H(ni); from[ni] = cur;
          push(ni);
        }
      }
    }
    const end = found >= 0 ? found : bestI;
    const tiles = [];
    for (let i = end; i >= 0; i = from[i]) tiles.push(i);
    tiles.reverse();
    return { pts: this.smooth(tiles), reached: found >= 0 };
  }
  /** Přímá průchodnost mezi středy dvou políček (s rezervou kolem rohů). */
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) * 3);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = ax + dx * t, z = az + dz * t;
      // vzorkujeme i kousek do stran, ať jednotky neřežou rohy překážek
      if (!this.free(Math.floor(x), Math.floor(z))) return false;
      if (!this.free(Math.floor(x + 0.28), Math.floor(z + 0.28)) || !this.free(Math.floor(x - 0.28), Math.floor(z - 0.28))) return false;
      if (!this.free(Math.floor(x + 0.28), Math.floor(z - 0.28)) || !this.free(Math.floor(x - 0.28), Math.floor(z + 0.28))) return false;
    }
    return true;
  }
  smooth(tiles) {
    const W = this.w;
    const P = tiles.map((i) => [(i % W) + 0.5, ((i / W) | 0) + 0.5]);
    if (P.length <= 2) return P.slice(1);
    const out = [];
    let a = 0;
    while (a < P.length - 1) {
      let b = P.length - 1;
      while (b > a + 1 && !this.los(P[a][0], P[a][1], P[b][0], P[b][1])) b--;
      out.push(P[b]);
      a = b;
    }
    return out;
  }
}
