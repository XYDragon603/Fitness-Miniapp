const progression = require('./progression.js');
const schedule = require('./schedule.js');
const LABELS = { bestWeight: '最大重量', bestE1RM: '估算 1RM', bestVolume: '训练量' };
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && schedule.dateKey(new Date(value + 'T12:00:00')) === value; }
function finite(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }
function round(value) { return Math.round(value * 10) / 10; }
function volumeOf(exercise) { return round(progression.completedSets(exercise).reduce((sum, set) => sum + set.weight * set.reps, 0)); }
function exerciseHistory(records, key, knownExercises) {
  const grouped = {};
  progression.recordsForExercise(records, key, knownExercises).forEach(({ date, exercise }) => {
    if (!validDate(date)) return;
    const sets = progression.completedSets(exercise);
    if (!sets.length) return;
    const point = grouped[date] || { date, maxWeight: 0, e1rm: null, volume: 0, setCount: 0 };
    sets.forEach(set => {
      point.maxWeight = Math.max(point.maxWeight, set.weight);
      const estimate = progression.estimateOneRepMax(set.weight, set.reps);
      if (estimate !== null) point.e1rm = Math.max(point.e1rm || 0, estimate);
      point.volume += set.weight * set.reps;
      point.setCount += 1;
    });
    point.volume = round(point.volume);
    grouped[date] = point;
  });
  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}
function mondayOf(date) { return schedule.addDays(date, -(schedule.weekday(date) - 1)); }
function previousWeek(date) { const start = schedule.addDays(mondayOf(date), -7); return { start, end: schedule.addDays(start, 6) }; }
function newRecordsFor(record, previousRecords, knownExercises) {
  return (record && record.exercises || []).flatMap(exercise => progression.detectNewRecords(exercise,
    progression.findPersonalRecords(previousRecords, exercise.libraryId || exercise.id, knownExercises))
    .map(pr => ({ ...pr, exerciseKey: exercise.libraryId || exercise.id, name: exercise.name || '训练动作', label: LABELS[pr.type] })));
}
function sessionReport(record, allRecords, knownExercises) {
  if (!record || record.type === 'rest') return null;
  const exercises = record.exercises || [];
  const sets = exercises.flatMap(exercise => progression.completedSets(exercise));
  const previous = (allRecords || []).filter(item => item && item.date < record.date);
  return { kind: 'session', date: record.date, title: record.dayName || '今日训练',
    trainingCount: 1, volume: round(sets.reduce((sum, set) => sum + set.weight * set.reps, 0)),
    setCount: sets.length, exerciseCount: exercises.filter(exercise => progression.completedSets(exercise).length).length,
    durationMin: finite(record.durationMin), newRecords: newRecordsFor(record, previous, knownExercises) };
}
function weeklyReport({ records = [], nutritionByDate = {}, weights = [], start, today, knownExercises } = {}) {
  const from = validDate(start) ? mondayOf(start) : previousWeek(today).start;
  const end = schedule.addDays(from, 6);
  const ordered = records.filter(record => record && validDate(record.date) && record.date <= end).slice().sort((a, b) => a.date.localeCompare(b.date));
  let volume = 0;
  let setCount = 0;
  let trainingCount = 0;
  const newRecords = [];
  const previous = [];
  ordered.forEach(record => {
    if (record.date >= from && record.type !== 'rest') {
      const sets = (record.exercises || []).flatMap(exercise => progression.completedSets(exercise));
      if (sets.length) {
        trainingCount += 1;
        setCount += sets.length;
        volume += sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
        newRecords.push(...newRecordsFor(record, previous, knownExercises));
      }
    }
    previous.push(record);
  });
  const nutrition = Object.keys(nutritionByDate).filter(date => date >= from && date <= end
    && Array.isArray(nutritionByDate[date]) && nutritionByDate[date].length);
  const totalCalories = nutrition.reduce((sum, date) => sum + nutritionByDate[date].reduce((daySum, food) => daySum + finite(food && food.calories), 0), 0);
  const totalProtein = nutrition.reduce((sum, date) => sum + nutritionByDate[date].reduce((daySum, food) => daySum + finite(food && food.protein), 0), 0);
  const within = weights.filter(item => item && validDate(item.date) && item.date >= from && item.date <= end && finite(item.weight) > 0)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = within.length >= 2 ? round(Number(within[within.length - 1].weight) - Number(within[0].weight)) : null;
  return { kind: 'week', start: from, end, title: '我的训练周报', trainingCount, volume: round(volume), setCount,
    newRecords, nutritionDays: nutrition.length, avgCalories: nutrition.length ? Math.round(totalCalories / nutrition.length) : null,
    avgProtein: nutrition.length ? round(totalProtein / nutrition.length) : null, weightChange,
    hasData: !!(trainingCount || nutrition.length || within.length) };
}
module.exports = { validDate, volumeOf, exerciseHistory, mondayOf, previousWeek, newRecordsFor, sessionReport, weeklyReport };
