const TYPES = ['working', 'warmup', 'drop', 'superset'];
const LABELS = { working: '正式', warmup: '热身', drop: '递减', superset: '超级' };
function typeOf(set) { return TYPES.includes(set && set.type) ? set.type : 'working'; }
function countsForRecord(set) { return typeOf(set) !== 'warmup'; }
function countsForProgression(set) { return !['warmup', 'drop'].includes(typeOf(set)); }
function nextSupersetExercise(exercises, currentIndex) {
  const current = exercises[currentIndex];
  if (!current || !current.supersetId) return -1;
  const group = exercises.map((exercise, index) => ({ exercise, index }))
    .filter(item => item.exercise.supersetId === current.supersetId && item.index !== currentIndex);
  const partner = group.find(item => (item.exercise.sets || []).some(set => !set.done));
  return partner ? partner.index : -1;
}
module.exports = { TYPES, LABELS, typeOf, countsForRecord, countsForProgression, nextSupersetExercise };
