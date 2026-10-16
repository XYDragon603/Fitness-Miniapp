const assert = require('assert');
const { suggestNextTarget: suggest, estimateOneRepMax, findPersonalRecords: prs, detectNewRecords } = require('../utils/progression.js');

const set = (weight, reps, done = true) => ({ weight, reps, done });
const entry = (sets, extra = {}) => ({ date: '2026-10-12', exercise: { id: 'bench', sets, ...extra } });
const target = (sets, extra = {}) => suggest({ planReps: '10-12', planSets: 3, history: [entry(sets)], ...extra });
let result = target([set('60', '12'), set(60, 13), set(60, 12)]);
assert.strictEqual(result.type, 'increase');
assert.strictEqual(result.weight, 62.5);
assert.strictEqual(result.reps, 10);
assert.deepStrictEqual(result.weights, [62.5, 62.5, 62.5]);
assert.deepStrictEqual(result.repsBySet, [10, 10, 10]);
assert(result.message.includes('62.5kg'));
assert.strictEqual(target([set(60, 12), set(60, 12), set(60, 12)], { increment: '1.23' }).weight, 61.2);
assert.strictEqual(target([set(60, 12), set(60, 12), set(60, 12)], { increment: -5 }).weight, 62.5);

result = target([set(60, 10), set(60, 11), set(60, 12)]);
assert.strictEqual(result.type, 'hold');
assert.strictEqual(result.weight, 60);
assert.deepStrictEqual(result.repsBySet, [11, 12, 12]);
assert.strictEqual(target([set(60, 12), set(60, 12), set(60, 12, false)]).type, 'hold', 'partial sessions cannot prove readiness to add weight');
assert.strictEqual(target([set(60, 12), set(60, 12), set(60, '')]).type, 'hold');
assert.strictEqual(target([set(60, 12, false)]).type, 'none');
assert.strictEqual(target([]).type, 'none');
assert.strictEqual(suggest().type, 'none');

const below = entry([set(61, 9), set(61, 10), set(61, 11)]);
result = suggest({ planReps: '10-12', planSets: 3, history: [below, below] });
assert.strictEqual(result.type, 'deload');
assert.strictEqual(result.weight, 55, '61 × 0.9 = 54.9 rounds to 55kg');
assert(result.message.includes('连续两次'));
assert.strictEqual(suggest({ planReps: '10-12', planSets: 3, history: [below, entry([set(61, 9, false)])] }).type, 'hold');
assert.strictEqual(suggest({ planReps: '10-12', planSets: 3, history: [below] }).type, 'hold');

result = target([set('', 12), set(0, 12), set('0', '12')]);
assert.strictEqual(result.type, 'reps');
assert.strictEqual(result.weight, 0);
assert.strictEqual(result.reps, 13);
const bodyFailure = entry([set(0, 8), set('', 9), set(0, 10)]);
result = suggest({ planReps: '10-12', planSets: 3, history: [bodyFailure, bodyFailure] });
assert.strictEqual(result.type, 'reps');
assert.strictEqual(result.reps, 10);

result = suggest({ planReps: '15, 12, 10, 8', planSets: 4,
  history: [entry([set(30, 15), set(35, 12), set(40, 10), set(45, 8)])] });
assert.strictEqual(result.type, 'increase');
assert.deepStrictEqual(result.weights, [32.5, 37.5, 42.5, 47.5]);
assert.deepStrictEqual(result.repsBySet, [15, 12, 10, 8]);
assert.strictEqual(result.weight, 32.5);
assert.strictEqual(result.reps, 15);
result = suggest({ planReps: '15, 12, 10, 8', planSets: 4,
  history: [entry([set(30, 15, false), set(35, 11), set(40, 10), set(45, 8)])] });
assert.strictEqual(result.type, 'hold', 'pyramid comparison retains original set indexes');
assert.deepStrictEqual(result.repsBySet, [15, 12, 10, 8]);
assert.strictEqual(target([set(60, 12), set(60, 12), set(60, 12)], { planReps: '12' }).type, 'increase');
assert.strictEqual(target([set(60, 12)], { planReps: '力竭' }).type, 'none');
assert.strictEqual(target([set(60, 12)], { planReps: '0' }).type, 'none');

for (const invalid of ['NaN', 'Infinity', -1, {}, true]) {
  assert.strictEqual(target([set(invalid, 12)]).type, 'none');
  assert.strictEqual(target([set(60, invalid)]).type, 'none');
}
assert.strictEqual(target([set(60, 10.5)]).type, 'none');
assert.strictEqual(estimateOneRepMax('60', '10'), 80);
assert.strictEqual(estimateOneRepMax(100, 12), 140);
for (const reps of [13, 0, '', Infinity, 1.5]) assert.strictEqual(estimateOneRepMax(60, reps), null);
assert.strictEqual(estimateOneRepMax(0, 10), null);
assert.strictEqual(estimateOneRepMax(1e308, 12), null);

const records = [
  { date: '2026-10-10', exercises: [{ id: 'old-plan-id', libraryId: '0025', sets: [set('60', '10'), set(500, 1, false)] }] },
  { date: '2026-10-12', exercises: [{ id: 'new-plan-id', libraryId: '0025', sets: [set(65, 8), set(60, 10), set(60, 13), set('bad', 5)] }] },
  { date: '2026-10-14', exercises: [{ id: '0025', libraryId: 'other-library-id', sets: [set(999, 1)] }] }
];
const best = prs(records, '0025');
const mixed = [
  { date: '2026-10-01', exercises: [{ id: 'same-id', sets: [set(80, 10)] }] },
  { date: '2026-10-02', exercises: [{ id: 'same-id', libraryId: '0025', sets: [set(60, 10)] }] }
];
assert.strictEqual(prs(mixed, '0025').bestWeight.weight, 80, 'include identifiable legacy PRs');
assert.strictEqual(prs(mixed.slice(0, 1), '0025', [mixed[1].exercises[0]]).bestWeight.weight, 80, 'first library save compares against legacy baseline');
assert.strictEqual(prs(mixed.concat({ date: '2026-10-03', exercises: [{ id: 'same-id', libraryId: '0085', sets: [set(50, 10)] }] }), '0025').bestWeight.weight, 60, 'ambiguous legacy ids are not guessed');
assert.deepStrictEqual(best.bestWeight, { weight: 65, reps: 8, date: '2026-10-12' });
assert.deepStrictEqual(best.bestE1RM, { weight: 65, reps: 8, e1rm: 82.3, date: '2026-10-12' });
assert.deepStrictEqual(best.bestVolume, { volume: 1900, date: '2026-10-12' });
assert.deepStrictEqual(prs(records, 'old-plan-id'), { bestWeight: null, bestE1RM: null, bestVolume: null });
assert.strictEqual(prs([entry([set(20, 5)])], 'bench').bestWeight.weight, 20);
assert.strictEqual(prs([{ id: 'legacy', date: '2026-10-01', sets: [set(10, 10)] }], 'legacy').bestVolume.volume, 100);
assert.deepStrictEqual(prs([entry([set(60, 10, false)], { completed: true })], 'bench'), { bestWeight: null, bestE1RM: null, bestVolume: null });
assert.strictEqual(prs([entry([set(80, 13)])], 'bench').bestE1RM, null);
assert.deepStrictEqual(prs(null, 'bench'), { bestWeight: null, bestE1RM: null, bestVolume: null });
assert.deepStrictEqual(prs([entry([set(0, 15)])], 'bench'), { bestWeight: null, bestE1RM: null, bestVolume: null });

const today = { id: 'today-plan-id', libraryId: '0025', date: '2026-10-16', sets: [set(70, 10), set(70, 10), set(70, 10)] };
const broken = detectNewRecords(today, best);
assert.deepStrictEqual(broken.map(item => item.type), ['bestWeight', 'bestE1RM', 'bestVolume']);
assert.strictEqual(broken[0].weight, 70);
assert.strictEqual(broken[1].e1rm, 93.3);
assert.strictEqual(broken[2].volume, 2100);
assert.strictEqual(broken[0].date, '2026-10-16');
assert.deepStrictEqual(detectNewRecords(today, prs([today], '0025')), [], 'equal PRs do not trigger');
assert.deepStrictEqual(detectNewRecords(today, null), [], 'first workout establishes a baseline');
assert.deepStrictEqual(detectNewRecords(today, { bestWeight: null, bestE1RM: null, bestVolume: null }), []);
assert.deepStrictEqual(detectNewRecords({ ...today, sets: [set(999, 10, false)] }, best), []);
assert.deepStrictEqual(detectNewRecords(null, best), []);
const snapshot = JSON.stringify(records);
prs(records, '0025');
suggest({ planReps: '10-12', history: [entry([set('60', '12')])], planSets: 1 });
assert.strictEqual(JSON.stringify(records), snapshot);
console.log('progression and personal record tests passed');
