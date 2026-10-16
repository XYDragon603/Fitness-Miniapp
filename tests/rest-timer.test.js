const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const timer = require('../utils/rest-timer.js');

const started = timer.createTimer(90, 1000);
assert.deepStrictEqual(started, { durationSec: 90, startedAt: 1000, endsAt: 91000 });
assert.strictEqual(timer.getRemaining(started, 1001), 90);
assert.strictEqual(timer.getRemaining(started, 90001), 1);
assert.strictEqual(timer.getRemaining(started, 92000), 0);
assert.strictEqual(timer.isFinished(started, 91000), true);
assert.strictEqual(timer.isFinished(started, 90999), false);
assert.strictEqual(timer.getRemaining(started, 31000), 60, 'background time must count');
assert.strictEqual(timer.adjust(started, 15).endsAt, 106000);
assert.strictEqual(timer.adjust(started, -150).durationSec, 0);
assert.strictEqual(timer.adjust(started, -15, 90000).endsAt, 90000);
assert.strictEqual(started.endsAt, 91000, 'adjust must not mutate its input');
assert.strictEqual(timer.createTimer(-10, 0).endsAt, 0);
assert.strictEqual(timer.createTimer(Infinity, 0).durationSec, 90);
assert.strictEqual(timer.getRemaining(null, 0), 0);
assert.deepStrictEqual(timer.REST_PRESETS, [60, 90, 120, 180]);

// Exercise the actual page with a deterministic clock and fake WeChat lifecycle.
let now = 100000;
let page;
let sequence = 0;
let vibrations = 0;
const intervals = new Map();
const timeouts = new Map();
const screen = [];
const writes = [];
const storage = { rest_timer_default_sec: 120 };
const tab = { setData(value) { Object.assign(this, value); } };
const util = require('../utils/util.js');
const plan = { id: 'plan', title: '计划', days: [{ id: 'push', name: '推', color: '#000', exercises: [
  { id: 'bench', name: '卧推', weeks: { 1: { sets: 3, reps: '10-12' } } }
] }, { id: 'rest', type: 'rest', name: '休息', exercises: [] }] };
const app = { globalData: {}, getActiveTrainingPlan() { return plan; } };
const previous = { date: '2026-10-12', exercise: { sets: [{ weight: '60', reps: '10', done: true }] } };
const sandbox = {
  Page(value) { page = value; },
  getApp() { return app; },
  require(file) {
    if (file.endsWith('/util.js')) return { ...util, getToday: () => '2026-10-16',
      getTrainingRecord: () => null, saveTrainingRecord: () => {}, getPreviousExerciseRecord: () => previous,
      getPreviousExerciseRecords: () => [previous],
      getProgressiveOverloadSuggestion: () => ({ show: false }) };
    return require(path.resolve(__dirname, '../pages/record', file));
  },
  Date: class extends Date { static now() { return now; } },
  setInterval(fn) { const id = sequence++; intervals.set(id, fn); return id; },
  clearInterval(id) { intervals.delete(id); },
  setTimeout(fn, delay) { const id = sequence++; timeouts.set(id, { fn, delay }); return id; },
  clearTimeout(id) { timeouts.delete(id); },
  wx: {
    getStorageSync(key) { return storage[key]; },
    setStorageSync(key, value) { storage[key] = value; },
    setKeepScreenOn(value) { screen.push(value.keepScreenOn); },
    vibrateLong() { vibrations++; },
    showActionSheet(options) { options.success({ tapIndex: 0 }); }
  }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pages/record/record.js'), 'utf8'), sandbox);
page.data = JSON.parse(JSON.stringify(page.data));
page.setData = (value, callback) => { writes.push(value); Object.assign(page.data, value); if (callback) callback(); };
page.getTabBar = () => tab;
page.onLoad();
page.onShow();
page.selectDay({ currentTarget: { dataset: { index: 0 } } });
assert.strictEqual(page.data.exercises[0].sets[0].previousSetLabel, '上次 60kg × 10');
assert.strictEqual(page.data.exercises[0].sets[1].previousSetLabel, '');
assert(page.data.exercises[0].previousDateLabel.includes('10月12日'));
const toggle = index => { page.data.exercises[0].sets[index].reps = '10'; page.toggleSetDone({ currentTarget: { dataset: { exIndex: 0, setIndex: index } } }); };
toggle(0);
assert.strictEqual(page.data.restTimerLabel, '02:00');
assert.strictEqual(tab.hidden, true);
assert.strictEqual(screen.at(-1), true);
now += 10000;
Array.from(intervals.values())[0]();
assert.deepStrictEqual(Object.keys(writes.at(-1)), ['restTimerLabel', 'restProgress']);
assert.strictEqual(page.data.restTimerLabel, '01:50');
page.onHide();
assert.strictEqual(intervals.size, 0);
assert.strictEqual(screen.at(-1), false);
now += 10000;
page.onShow();
assert.strictEqual(page.data.restTimerLabel, '01:40');
assert.strictEqual(page.data.exercises[0].sets[0].done, true, 'unsaved input survives onShow');
assert.strictEqual(intervals.size, 1);
page.adjustRestTimer({ currentTarget: { dataset: { delta: 15 } } });
assert.strictEqual(page.data.restTimerLabel, '01:55');
page.chooseRestPreset();
assert.strictEqual(storage.rest_timer_default_sec, 60);
assert.strictEqual(page.data.restTimerLabel, '01:00');
now += 60000;
Array.from(intervals.values())[0]();
assert.strictEqual(vibrations, 1);
assert.strictEqual(page.data.restTimerLabel, '休息结束 · 开始下一组');
assert.strictEqual(screen.at(-1), false);
assert.strictEqual(intervals.size, 0);
assert.strictEqual(Array.from(timeouts.values())[0].delay, 3000);
page.onHide();
now += 4000;
page.onShow();
assert.strictEqual(page.data.restTimerVisible, false);
assert.strictEqual(tab.hidden, false);
toggle(2);
assert.strictEqual(page.data.restTimerVisible, false, 'last set does not start rest');
page.startRestTimer('卧推');
page.skipRestTimer();
assert.strictEqual(page.data.restTimerVisible, false);
assert.strictEqual(intervals.size, 0);
assert.strictEqual(tab.hidden, false);
page.startRestTimer('卧推');
now += 55000;
page.adjustRestTimer({ currentTarget: { dataset: { delta: -15 } } });
assert.strictEqual(page.data.restTimerFinished, true, 'subtracting beyond remaining time finishes immediately');
page.skipRestTimer();
toggle(1);
page.onHide();
now += 70000;
page.onShow();
assert.strictEqual(vibrations, 3, 'expired background timer finishes once on return');
page.onShow();
assert.strictEqual(vibrations, 3);
page.selectDay({ currentTarget: { dataset: { index: 1 } } });
page.startRestTimer('休息日');
assert.strictEqual(page.data.restTimerVisible, false);
assert.strictEqual(timeouts.size, 0);
page.onUnload();
assert.strictEqual(intervals.size, 0);
assert.strictEqual(screen.at(-1), false);
page.data.isRestDay = false;
page.startRestTimer('卧推');
page.onUnload();
assert.strictEqual(intervals.size, 0);
assert.strictEqual(timeouts.size, 0);
assert.strictEqual(screen.at(-1), false);
console.log('rest timer and record page lifecycle tests passed');
