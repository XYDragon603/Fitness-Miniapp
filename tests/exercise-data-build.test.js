const assert = require('assert');
const { buildExerciseData } = require('../tools/exercise-data/build');
const terms = require('../tools/exercise-data/terms');
const raw = [
  { id: '0001', name: 'row', body_part: 'back', equipment: 'dumbbell', target: 'lats', muscle_group: 'back', secondary_muscles: ['latissimus dorsi', 'biceps', 'biceps', 'delts', 'deltoids'], instruction_steps: { zh: [' 1. 稳住身体 ', '步骤2：拉起哑铃', '第3步：缓慢放下', ' ', '4) 重复'] }, image: 'forbidden', gif_url: 'forbidden' },
  { id: '0002', name: 'press', body_part: 'chest', equipment: 'barbell', target: 'pectorals', muscle_group: 'chest', secondary_muscles: ['triceps'], instruction_steps: { zh: [' 卧推 '] } },
  { id: '0003', name: 'fly', body_part: 'chest', equipment: 'dumbbell', target: 'pectorals', muscle_group: 'chest', secondary_muscles: [], instruction_steps: { zh: [] } }
];
const names = { '0001': '哑铃划船', '0002': '杠铃卧推' };
const before = JSON.stringify(raw);
const { index, detail, warnings } = buildExerciseData(raw, terms, names);
assert.deepStrictEqual(index.fields, ['id', 'name', 'nameEn', 'bodyPart', 'equipment', 'equipmentGroup', 'target']);
assert.deepStrictEqual(index.rows.find(row => row[0] === '0001'), ['0001', '哑铃划船', 'row', 'back', 'dumbbell', 'dumbbell', 'lats']);
assert.strictEqual(index.rows.find(row => row[0] === '0003')[1], 'fly');
assert.deepStrictEqual(warnings, ['0003']);
assert.deepStrictEqual(detail['0001'].secondary, ['biceps', 'delts']);
assert.deepStrictEqual(detail['0001'].steps, ['稳住身体', '拉起哑铃', '缓慢放下', '重复']);
assert.strictEqual(index.bodyParts.find(part => part.key === 'chest').count, 2);
assert.strictEqual(index.equipmentGroups.find(group => group.key === 'dumbbell').count, 2);
assert.strictEqual(index.rows[0][3], 'chest');
assert.strictEqual(JSON.stringify(raw), before, 'must not mutate source');
assert(!JSON.stringify({ index, detail }).includes('forbidden'));
for (const field of ['body_part', 'equipment', 'target', 'muscle_group']) {
  assert.throws(() => buildExerciseData([{ ...raw[0], [field]: 'unknown' }], terms, names), /未知术语/);
}
assert.throws(() => buildExerciseData([{ ...raw[0], secondary_muscles: ['unknown'] }], terms), /次要肌: unknown/);
assert.throws(() => buildExerciseData([raw[0], raw[0]], terms), /重复/);
assert.deepStrictEqual(buildExerciseData([], terms).index.rows, []);
console.log('exercise data build tests passed');
