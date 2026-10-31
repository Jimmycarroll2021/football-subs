/*
 * Fair rotation generator for kids' futsal.
 *
 * Builds a plan of N rotations. Each rotation fills every on-court position and
 * puts the rest of the squad on the bench. The generator tries many random
 * plans and keeps the one with the best score, where the score rewards:
 *   - equal playing time (nobody plays more than one extra rotation)
 *   - nobody sitting out two rotations in a row
 *   - goalkeeping shared out among the kids happy to go in goal
 *   - kids trying different positions instead of the same one every time
 *
 * Works as a browser global (window.Rotation) and as a Node module.
 */
(function (root) {
  'use strict';

  // Small seeded RNG so "Reshuffle" is repeatable for a given seed.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isGoalie(position) {
    return /goal|keeper|^gk$/i.test(position.trim());
  }

  function permutations(items) {
    if (items.length <= 1) return [items.slice()];
    const out = [];
    items.forEach((item, i) => {
      const rest = items.slice(0, i).concat(items.slice(i + 1));
      permutations(rest).forEach((p) => out.push([item].concat(p)));
    });
    return out;
  }

  // Assign players to outfield positions with the lowest total cost.
  function assignOutfield(players, positions, cost, rand) {
    if (players.length <= 6) {
      let best = null;
      let bestCost = Infinity;
      permutations(players).forEach((perm) => {
        let c = 0;
        for (let i = 0; i < perm.length; i++) c += cost(perm[i], positions[i]) + rand() * 0.5;
        if (c < bestCost) {
          bestCost = c;
          best = perm;
        }
      });
      return best;
    }
    // Larger formats: greedy by position.
    const left = players.slice();
    return positions.map((pos) => {
      let bi = 0;
      let bc = Infinity;
      left.forEach((p, i) => {
        const c = cost(p, pos) + rand() * 0.5;
        if (c < bc) {
          bc = c;
          bi = i;
        }
      });
      return left.splice(bi, 1)[0];
    });
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildOnce(players, positions, rotations, rand) {
    const names = players.map((p) => p.name);
    const canGk = new Set(players.filter((p) => p.gk).map((p) => p.name));
    const gkIndex = positions.findIndex(isGoalie);
    const outfieldPositions = positions.filter((_, i) => i !== gkIndex);

    const plays = {};
    const gkCount = {};
    const posCount = {};
    const lastPos = {};
    names.forEach((n) => {
      plays[n] = 0;
      gkCount[n] = 0;
      posCount[n] = {};
      lastPos[n] = null;
    });
    let satLast = new Set();
    const cols = [];

    for (let r = 0; r < rotations; r++) {
      const order = shuffle(names, rand).sort((a, b) => {
        if (plays[a] !== plays[b]) return plays[a] - plays[b];
        return (satLast.has(b) ? 1 : 0) - (satLast.has(a) ? 1 : 0);
      });
      let on = order.slice(0, positions.length);
      let bench = order.slice(positions.length);

      let keeper = null;
      if (gkIndex >= 0) {
        const pool = canGk.size ? canGk : new Set(names);
        const pickKeeper = (list) =>
          list
            .filter((n) => pool.has(n))
            .sort((a, b) => gkCount[a] - gkCount[b] || (lastPos[a] === positions[gkIndex]) - (lastPos[b] === positions[gkIndex]) || rand() - 0.5)[0];
        keeper = pickKeeper(on);
        if (!keeper) {
          // Nobody willing is on court: bring the best willing kid on.
          keeper = pickKeeper(bench);
          if (keeper) {
            const out = on[on.length - 1];
            on = on.slice(0, -1).concat(keeper);
            bench = bench.filter((n) => n !== keeper).concat(out);
          } else {
            keeper = on[0];
          }
        }
      }

      const outfieldPlayers = on.filter((n) => n !== keeper);
      const cost = (n, pos) => (posCount[n][pos] || 0) * 10 + (lastPos[n] === pos ? 20 : 0);
      const assigned = assignOutfield(outfieldPlayers, outfieldPositions, cost, rand);

      const col = [];
      let k = 0;
      positions.forEach((pos, i) => {
        const n = i === gkIndex ? keeper : assigned[k++];
        col.push(n);
      });
      col.forEach((n, i) => {
        plays[n]++;
        posCount[n][positions[i]] = (posCount[n][positions[i]] || 0) + 1;
        if (i === gkIndex) gkCount[n]++;
        lastPos[n] = positions[i];
      });
      bench.forEach((n) => (lastPos[n] = null));
      satLast = new Set(bench);
      cols.push(col.concat(bench));
    }
    return cols;
  }

  // Per-player stats for a plan. Works on hand-edited plans too.
  function analyse(cols, positions, players) {
    const names = players.map((p) => p.name);
    const canGk = new Set(players.filter((p) => p.gk).map((p) => p.name));
    const gkIndex = positions.findIndex(isGoalie);
    const stats = {};
    names.forEach((n) => (stats[n] = { name: n, on: 0, off: 0, gk: 0, positions: {}, maxSitRun: 0 }));
    const sitRun = {};
    const issues = [];

    cols.forEach((col, r) => {
      col.forEach((n, i) => {
        if (!n || !stats[n]) return;
        const s = stats[n];
        if (i < positions.length) {
          s.on++;
          s.positions[positions[i]] = (s.positions[positions[i]] || 0) + 1;
          if (i === gkIndex) s.gk++;
          sitRun[n] = 0;
        } else {
          s.off++;
          sitRun[n] = (sitRun[n] || 0) + 1;
          s.maxSitRun = Math.max(s.maxSitRun, sitRun[n]);
        }
      });
      if (gkIndex >= 0 && col[gkIndex] && canGk.size && !canGk.has(col[gkIndex])) {
        issues.push(`Rotation ${r + 1}: ${col[gkIndex]} is in goal but isn't marked as happy to keep goal.`);
      }
    });

    const list = names.map((n) => stats[n]);
    const ons = list.map((s) => s.on);
    const spread = ons.length ? Math.max(...ons) - Math.min(...ons) : 0;
    if (spread > 1) issues.push(`Playing time is uneven: some kids play ${spread} more rotations than others.`);
    list.filter((s) => s.maxSitRun > 1).forEach((s) => issues.push(`${s.name} sits out ${s.maxSitRun} rotations in a row.`));
    list.filter((s) => s.gk > 1).forEach((s) => issues.push(`${s.name} keeps goal ${s.gk} times.`));
    return { players: list, spread, issues };
  }

  function score(cols, positions, players) {
    const a = analyse(cols, positions, players);
    const gkIndex = positions.findIndex(isGoalie);
    let s = a.spread * 1000;
    a.players.forEach((p) => {
      s += Math.max(0, p.maxSitRun - 1) * 60;
      s += Math.max(0, p.gk - 1) * 25;
      Object.keys(p.positions).forEach((pos) => {
        s += Math.max(0, p.positions[pos] - 1) * 4;
      });
    });
    // Penalise playing the same position in back-to-back rotations.
    for (let r = 1; r < cols.length; r++) {
      for (let i = 0; i < positions.length; i++) {
        if (i !== gkIndex && cols[r][i] === cols[r - 1][i]) s += 6;
        if (i === gkIndex && cols[r][i] === cols[r - 1][i]) s += 40;
      }
    }
    return s;
  }

  function generate(opts) {
    const players = opts.players.filter((p) => p && p.name);
    const positions = opts.positions;
    const rotations = Math.max(1, opts.rotations | 0);
    if (players.length < positions.length) {
      throw new Error(`You need at least ${positions.length} players for ${positions.length} positions (you have ${players.length}).`);
    }
    const seed = opts.seed == null ? Date.now() : opts.seed;
    const rand = mulberry32(seed);
    const attempts = opts.attempts || 400;
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < attempts; i++) {
      const cols = buildOnce(players, positions, rotations, rand);
      const s = score(cols, positions, players);
      if (s < bestScore) {
        bestScore = s;
        best = cols;
      }
      if (s === 0) break;
    }
    return { seed, cols: best, score: bestScore };
  }

  const api = { generate, analyse, isGoalie, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rotation = api;
})(typeof window !== 'undefined' ? window : this);
