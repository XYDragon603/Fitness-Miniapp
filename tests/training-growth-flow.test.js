const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const util = require('../utils/util');
const clone = value => JSON.parse(JSON.stringify(value));
const store = {};
let action;
let redirect;
let preview;
const toasts = [];
global.wx = {
  getStorageSync: key => store[key] === undefined ? undefined : clone(store[key]),
  setStorageSync: (key, value) => { store[key] = clone(value); },
  removeStorageSync: key => { delete store[key]; },
  showToast: options => toasts.push(options.title),
  showActionSheet: options => { action = options; },
  vibrateShort() {}, setKeepScreenOn() {}, setNavigationBarColor() {}, showShareMenu() {},
  redirectTo: options => { redirect = options.url; },
  navigateBack() {},
  saveImageToPhotosAlbum: options => options.fail(),
  previewImage: options => { preview = options.urls; },
  canvasToTempFilePath: options => options.success({ tempFilePath: '/tmp/share.png' })
};
function loadPage(relative, app = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  let page;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Page: value => { page = value; }, getApp: () => app, wx: global.wx,
    require: file => file.endsWith('/util.js') ? { ...util, getToday: () => '2026-10-16' } : createRequire(filename)(file),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, Date
  });
  page.data = clone(page.data);
  page.setData = (update, callback) => {
    Object.entries(update).forEach(([key, value]) => {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = page.data; parts.slice(0, -1).forEach(part => { target = target[part]; });
      target[parts.at(-1)] = value;
    });
    if (callback) callback();
  };
  return page;
}
const tap = (exIndex, setIndex) => ({ currentTarget: { dataset: { exIndex, setIndex } } });
const plan = { id: 'pair_plan', title: '超级组计划', days: [{ id: 'push', name: '胸背', exercises: ['A', 'B'].map(id => ({
  id, name: '动作' + id, weeks: { 1: { sets: 2, reps: '10' } }
})) }] };
const app = { globalData: {}, getActiveTrainingPlan: () => plan };
const page = loadPage('pages/record/record.js', app);
page.onLoad(); page.selectDay({ currentTarget: { dataset: { index: 0 } } });
page.pairSuperset({ currentTarget: { dataset: { index: 1 } } });
assert.strictEqual(page.data.exercises[0].sets[0].type, 'superset');
assert.strictEqual(page.data.exercises[0].supersetId, page.data.exercises[1].supersetId);
page.data.exercises.forEach(exercise => exercise.sets.forEach(set => { set.weight = '50'; }));
page.toggleSetDone(tap(0, 0));
assert.strictEqual(page.data.currentExIndex, 1);
assert.strictEqual(page.data.restTimerVisible, false, 'A -> B immediately');
page.toggleSetDone(tap(1, 0));
assert.strictEqual(page.data.currentExIndex, 0);
assert.strictEqual(page.data.restTimerVisible, true, 'rest only after one round');
assert.strictEqual(page.data.restNext.name, '动作A');
page.skipRestTimer();
page.toggleSetDone(tap(0, 1));
assert.strictEqual(page.data.currentExIndex, 1);
assert.strictEqual(page.data.targetView, null, 'do not interrupt the last paired round');
page.toggleSetDone(tap(1, 1));
assert.strictEqual(page.data.targetView.name, '动作A');
page.keepCurrentTarget();
assert.strictEqual(page.data.targetView.name, '动作B', 'both exercises get next-session targets');
page.keepCurrentTarget();
assert.strictEqual(redirect, '/pages/report/report?date=2026-10-16');
assert(store.exercise_next_targets.A && store.exercise_next_targets.B);
assert.strictEqual(store['training_2026-10-16'].exercises[0].sets[0].type, 'superset');

// Add/convert a warmup, save, and reconstruct the actual page. This verifies
// types and extra rows survive the narrow serializer and restore path.
page.addSet(); action.success({ tapIndex: 1 });
assert.strictEqual(page.data.exercises[1].sets[0].type, 'warmup');
page.data.exercises[1].sets[0].reps = '5';
page.data.exercises[1].sets[0].weight = '20';
page.toggleSetDone(tap(1, 0));
const restored = loadPage('pages/record/record.js', app);
restored.onLoad();
assert.strictEqual(restored.data.exercises[1].sets.length, 3);
assert.strictEqual(restored.data.exercises[1].sets[0].type, 'warmup');
assert.strictEqual(restored.data.exercises[1].sets[0].weight, '20');
restored.setTypeMenu(tap(1, 0)); action.success({ tapIndex: 2 });
assert.strictEqual(restored.data.exercises[1].sets[0].type, 'drop');
restored.setTypeMenu(tap(1, 0)); action.success({ tapIndex: 3 });
assert.strictEqual(restored.data.exercises[1].sets.length, 2);
restored.pairSuperset({ currentTarget: { dataset: { index: -1 } } });
assert(restored.data.exercises.every(exercise => !exercise.supersetId));
assert(restored.data.exercises.every(exercise => exercise.sets.every(set => set.type === 'working')));
restored.data.exercises[0].sets[0] = { weight: 'bad', reps: '10', done: false };
restored.toggleSetDone(tap(0, 0));
assert.strictEqual(restored.data.exercises[0].sets[0].done, false);
assert(toasts.includes('请填写有效重量和次数'));

// Existing nutrition quick-entry receives explicit favorites; copying a selected
// meal appends records with new IDs and keeps yesterday byte-for-byte unchanged.
store['nutrition_2026-10-15'] = [{ id: 'y1', name: '牛奶', calories: 150, protein: 8, estimatedWeight: 250, time: new Date('2026-10-15T08:00:00').toISOString() },
  { id: 'y2', name: '午饭', calories: 600, time: new Date('2026-10-15T12:00:00').toISOString() }];
store.nutrition_dates = ['2026-10-15'];
const yesterday = JSON.stringify(store['nutrition_2026-10-15']);
const nutrition = loadPage('pages/nutrition/nutrition.js');
nutrition.data.todayStr = '2026-10-16';
nutrition.loadTodayRecords = () => {
  nutrition.data.mealGroups = require('../utils/records-view').buildMealGroups(util.getNutritionRecords('2026-10-16'));
};
nutrition.copyYesterday(); assert.strictEqual(action.itemList.length, 2); action.success({ tapIndex: 0 });
assert.strictEqual(store['nutrition_2026-10-16'].length, 1);
assert.strictEqual(store['nutrition_2026-10-16'][0].name, '牛奶');
assert.strictEqual(JSON.stringify(store['nutrition_2026-10-15']), yesterday);
nutrition.openMealSheet({ currentTarget: { dataset: { index: 0 } } });
nutrition.toggleFavorite({ currentTarget: { dataset: { index: 0 } } });
assert.strictEqual(store.favorite_foods[0].name, '牛奶');
assert.strictEqual(nutrition.data.mealSheet.items[0].favorite, true);
nutrition.toggleFavorite({ currentTarget: { dataset: { index: 0 } } });
assert.strictEqual(store.favorite_foods.length, 0);

// Sharing has a usable preview fallback when album permission is denied; the
// recipient sees a snapshot without any writes to their training records.
const report = loadPage('pages/report/report.js');
report.onLoad({ date: '2026-10-16' });
assert.strictEqual(report.data.report.volume, 2000);
const text = [];
const canvas = { getContext: () => ({ fillRect() {}, fillText: value => text.push(value) }) };
report.createSelectorQuery = () => ({ select() { return this; }, fields() { return this; }, exec(callback) { callback([{ node: canvas }]); } });
report.saveImage();
assert.strictEqual(report.data.saving, false);
assert.deepStrictEqual(clone(preview), ['/tmp/share.png']);
const beforeShared = JSON.stringify(store);
const shared = report.onShareAppMessage().path.split('shared=')[1];
const recipient = loadPage('pages/report/report.js'); recipient.onLoad({ shared });
assert.strictEqual(recipient.data.isShared, true);
assert.strictEqual(recipient.data.report.volume, 2000);
assert.strictEqual(JSON.stringify(store), beforeShared);

// The actual weekday editor updates the active plan and reminder preview using
// the same resolver, with the local-only reminder state retained across reloads.
const workoutPlans = require('../utils/workout-plan');
workoutPlans.upsertCustomPlan({ ...plan, type: 'custom' });
workoutPlans.setActivePlanId(plan.id);
const scheduleApp = { refreshTrainingPlanState: () => workoutPlans.ensureWorkoutPlanState() };
const editor = loadPage('pages/schedule/schedule.js', scheduleApp); editor.onLoad();
editor.selectMode({ currentTarget: { dataset: { mode: 'weekday' } } });
editor.changeDay({ currentTarget: { dataset: { day: 1 } }, detail: { value: 1 } });
editor.changeDay({ currentTarget: { dataset: { day: 3 } }, detail: { value: 1 } });
editor.save();
assert.strictEqual(workoutPlans.getPlanById(plan.id).schedule.mode, 'weekday');
assert.strictEqual(workoutPlans.getPlanById(plan.id).schedule.weekdays[3], 'push');
const reminderPage = loadPage('pages/reminders/reminders.js', scheduleApp); reminderPage.onShow();
assert.strictEqual(reminderPage.data.settings.time, '20:00');
assert(reminderPage.data.preview.every(item => !item.isRest));
reminderPage.changeTime({ detail: { value: '19:15' } });
reminderPage.changeEnabled({ detail: { value: true } }); reminderPage.save();
const reloadedReminder = loadPage('pages/reminders/reminders.js', scheduleApp); reloadedReminder.onShow();
assert.strictEqual(reloadedReminder.data.settings.time, '19:15');
assert.strictEqual(reloadedReminder.data.settings.enabled, true);
console.log('super-set alternation, type persistence, meal shortcuts, and report export flow tests passed');
