const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const util = require('../utils/util');
const previousWx = global.wx;
const dates = ['2026-10-12', '2026-10-10'];
const storage = { training_dates: dates.slice() };
dates.forEach(date => { storage['training_' + date] = { date, exercises: [{
  id: 'old_plan_bench', libraryId: '0025', name: '杠铃平板卧推', planSets: 3, planReps: '10-12',
  sets: Array.from({ length: 3 }, () => ({ weight: '60', reps: '12', done: true }))
}] }; });
const beforeHistory = JSON.stringify(storage['training_2026-10-12']);
let toast;
let navigation;
let confirmation;
const clone = value => JSON.parse(JSON.stringify(value));
global.wx = {
  getStorageSync(key) { return storage[key] === undefined ? undefined : clone(storage[key]); },
  setStorageSync(key, value) { storage[key] = clone(value); },
  showToast(options) { toast = options.title; },
  vibrateShort() {}, setKeepScreenOn() {}, navigateTo(options) { navigation = options.url; },
  showModal(options) { confirmation = options; }
};
function loadPage(relativePath, app) {
  const filename = path.resolve(__dirname, '..', relativePath);
  let page;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Page(value) { page = value; }, getApp() { return app; }, wx: global.wx,
    require(file) {
      return file.endsWith('/util.js') ? { ...util, getToday: () => '2026-10-16' } : createRequire(filename)(file);
    }, setInterval, clearInterval, setTimeout, clearTimeout
  });
  page.data = clone(page.data);
  page.setData = function(update, callback) { Object.assign(this.data, update); if (callback) callback(); };
  return page;
}
try {
  assert.strictEqual(util.getPreviousExerciseRecords('new_plan_bench', '2026-10-16', 2, '0025').length, 2);
  storage.training_dates.unshift('2026-10-14');
  storage['training_2026-10-14'] = { date: '2026-10-14', exercises: [{ id: 'new_plan_bench', libraryId: '0085', sets: [{ weight: '99', reps: '12', done: true }] }] };
  assert.strictEqual(util.getPreviousExerciseRecords('new_plan_bench', '2026-10-16', 2, '0025')[0].date, '2026-10-12', 'explicitly different library ids must not match by id');
  storage.training_dates.shift();
  const legacy = util.getProgressiveOverloadSuggestion('old_plan_bench', '2026-10-16');
  assert.strictEqual(legacy.type, 'increase');
  assert.strictEqual(legacy.weight, 62.5);
  const plan = { id: 'new_plan', title: '新计划', days: [{ id: 'push', name: '胸部', color: '#C96565', exercises: [{
    id: 'new_plan_bench', libraryId: '0025', name: '杠铃平板卧推', guide: {},
    weeks: { 1: { sets: 3, reps: '10-12', note: '' } }
  }] }, { id: 'rest', type: 'rest', name: '恢复日', exercises: [] }] };
  const appState = { globalData: {}, getActiveTrainingPlan() { return plan; } };
  const page = loadPage('pages/record/record.js', appState);
  page.onLoad();
  page.selectDay({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(page.data.exercises[0].overloadSuggestion.type, 'increase');
  assert(page.data.exercises[0].previousSummary.includes('60 x 12'));
  page.data.exercises[0].sets[0] = { weight: '55', reps: '11', done: true };
  page.adoptSuggestion({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(page.data.exercises[0].sets[0].weight, '55', 'do not overwrite completed results');
  assert.strictEqual(page.data.exercises[0].sets[1].weight, '62.5');
  assert.strictEqual(page.data.exercises[0].sets[1].reps, '10');
  page.data.exercises[0].sets.forEach(set => { set.done = true; });
  page.saveRecord();
  assert.strictEqual(toast, '新纪录 🎉');
  assert.strictEqual(storage['training_2026-10-16'].exercises[0].libraryId, '0025');
  page.saveRecord();
  assert.strictEqual(toast, '保存成功', 'saving identical results does not announce PR again');
  page.openGuide({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(navigation, '/packageExercise/pages/detail/detail?id=0025');
  const stats = loadPage('pages/stats/stats.js', {});
  stats.loadPersonalRecords();
  assert.strictEqual(stats.data.personalRecords.length, 1, 'same library exercise aggregates across plan ids');
  assert.strictEqual(stats.data.personalRecords[0].bestWeight.weight, 62.5);
  assert.strictEqual(JSON.stringify(storage['training_2026-10-12']), beforeHistory);
  appState.globalData.selectedDayIndex = 1;
  appState.globalData.selectedDayId = 'rest';
  page.onHide();
  page.onShow();
  assert.strictEqual(page.data.isRestDay, true, 'entry selection wins over a different saved day');
  const savedTraining = JSON.stringify(storage['training_2026-10-16']);
  page.saveRecord();
  assert(confirmation, 'replacement of a different day requires an explicit in-app choice');
  assert.strictEqual(JSON.stringify(storage['training_2026-10-16']), savedTraining);
  confirmation.success({ confirm: false });
  assert.strictEqual(JSON.stringify(storage['training_2026-10-16']), savedTraining);
  page.saveRecord();
  confirmation.success({ confirm: true });
  assert.strictEqual(storage['training_2026-10-16'].type, 'rest');
  page.onUnload();
  console.log('progression integration tests passed');
} finally { global.wx = previousWx; }
