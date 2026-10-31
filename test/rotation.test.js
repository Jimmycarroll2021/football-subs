const test = require('node:test');
const assert = require('node:assert');
const R = require('../rotation.js');

const FUTSAL = ['Goalie', 'Defender', 'Right Wing', 'Left Wing', 'Striker'];
const squad = (n, gk = () => true) =>
  ['Ruby', 'Erin', 'Eva', 'Emily', 'Niya', 'Elly', 'Parker', 'Matilda', 'Ava', 'Zoe']
    .slice(0, n)
    .map((name, i) => ({ name, gk: gk(i) }));

function check(cols, players, positions, rotations) {
  assert.strictEqual(cols.length, rotations);
  cols.forEach((col) => {
    assert.strictEqual(col.length, players.length);
    assert.strictEqual(new Set(col).size, players.length, 'everyone appears once per rotation');
  });
}

test('8 players, 5 rotations: fair time, no back-to-back sits, no repeat keepers', () => {
  const players = squad(8);
  const { cols } = R.generate({ players, positions: FUTSAL, rotations: 5, seed: 1 });
  check(cols, players, FUTSAL, 5);
  const a = R.analyse(cols, FUTSAL, players);
  assert.ok(a.spread <= 1);
  assert.deepStrictEqual(a.issues, []);
});

test('only marked kids go in goal', () => {
  const players = squad(8, (i) => i < 3);
  const { cols } = R.generate({ players, positions: FUTSAL, rotations: 6, seed: 7 });
  const keepers = new Set(cols.map((c) => c[0]));
  keepers.forEach((k) => assert.ok(['Ruby', 'Erin', 'Eva'].includes(k), k));
  assert.ok(R.analyse(cols, FUTSAL, players).spread <= 1);
});

test('formats without a goalie and exact squad size', () => {
  const pos = ['Defender', 'Left', 'Right', 'Striker'];
  const players = squad(4);
  const { cols } = R.generate({ players, positions: pos, rotations: 4, seed: 3 });
  check(cols, players, pos, 4);
});

test('works across seeds and squad sizes', () => {
  for (let n = 5; n <= 10; n++) {
    for (let seed = 0; seed < 5; seed++) {
      const players = squad(n);
      const { cols } = R.generate({ players, positions: FUTSAL, rotations: 6, seed });
      check(cols, players, FUTSAL, 6);
      assert.ok(R.analyse(cols, FUTSAL, players).spread <= 1, `n=${n} seed=${seed}`);
    }
  }
});

test('too few players throws a clear error', () => {
  assert.throws(() => R.generate({ players: squad(3), positions: FUTSAL, rotations: 3 }), /at least 5 players/);
});

test('same seed gives the same plan', () => {
  const players = squad(8);
  const a = R.generate({ players, positions: FUTSAL, rotations: 5, seed: 42 });
  const b = R.generate({ players, positions: FUTSAL, rotations: 5, seed: 42 });
  assert.deepStrictEqual(a.cols, b.cols);
});
