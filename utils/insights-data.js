const util = require('./util.js');
const plan = require('./workout-plan.js');
const ui = require('./ui-helpers.js');
const insights = require('./training-insights.js');
function allRecords() { return util.getTrainingDates().map(date => {
  const record = util.getTrainingRecord(date); return record ? { ...record, date } : null;
}).filter(Boolean); }
function knownExercises(records) {
  const sources = (records || []).flatMap(record => record.exercises || []).concat(
    plan.getWorkoutPlans().flatMap(item => item.days.flatMap(day => day.exercises || [])));
  return sources.map(exercise => ({ ...exercise, libraryId: exercise.libraryId || (/^\d{4}$/.test(ui.exerciseKey(exercise)) ? ui.exerciseKey(exercise) : '') }));
}
function loadWeek(start, today) {
  const records = allRecords();
  const range = start || insights.previousWeek(today || util.getToday()).start;
  const nutritionByDate = {};
  util.getNutritionDates().filter(date => date >= range && date <= require('./schedule.js').addDays(range, 6))
    .forEach(date => { nutritionByDate[date] = util.getNutritionRecords(date); });
  return insights.weeklyReport({ records, nutritionByDate, weights: util.getFatLossWeightRecords(),
    start: range, today: today || util.getToday(), knownExercises: knownExercises(records) });
}
function latestWeek(today) {
  const report = loadWeek('', today);
  if (report.hasData) wx.setStorageSync('weekly_report_' + report.start, report);
  return report;
}
function loadSession(date) { const records = allRecords(); const record = util.getTrainingRecord(date);
  return insights.sessionReport(record ? { ...record, date } : null, records, knownExercises(records)); }
module.exports = { allRecords, knownExercises, loadWeek, latestWeek, loadSession };
