const assert = require('assert');
const progression = require('../utils/progression');
const insights = require('../utils/training-insights');
const schedule = require('../utils/schedule');
const foods = require('../utils/food-shortcuts');
const view = require('../utils/records-view');
const card = require('../utils/share-card');
const reminders = require('../utils/reminders');
const plans = require('../utils/workout-plan');
const clone = value => JSON.parse(JSON.stringify(value));
const storage = {};
global.wx = { getStorageSync: key => clone(storage[key] === undefined ? null : storage[key]), setStorageSync: (key, value) => { storage[key] = clone(value); } };
const set = (weight, reps = 10, type) => ({ weight, reps, done: true, ...(type ? { type } : {}) });
const exercise = (weight, extra = {}) => ({ id: 'legacy', name: '测试动作', sets: [set(weight)], ...extra });
const record = (date, weight, extra) => ({ date, exercises: [exercise(weight, extra)] });

// Warmups cannot alter a record or progression; drop sets contribute volume but
// cannot hide an unfinished working set or shift pyramid targets.
const mixed = exercise(60, { sets: [set(200, 1, 'warmup'), set(60, 12), set(40, 20, 'drop'), set(70, 10)] });
assert.strictEqual(progression.findPersonalRecords([{ date: '2026-10-01', exercises: [mixed] }], 'legacy').bestWeight.weight, 70);
assert.strictEqual(insights.volumeOf(mixed), 2220);
const suggestion = progression.suggestNextTarget({ planReps: '12, 10', planSets: 2, history: [mixed] });
assert.strictEqual(suggestion.type, 'increase');
assert.deepStrictEqual(suggestion.weights, [62.5, 72.5]);
assert.strictEqual(progression.suggestNextTarget({ planReps: '10', planSets: 1, history: [exercise(0, { sets: [set(100, 1, 'warmup')] })] }).type, 'none');
assert.strictEqual(progression.completedSets({ sets: [set(-1), set(Infinity), set(30, 1.5), set(0, 12), { ...set(50), done: false }] }).length, 1);

// Reused IDs with conflicting explicit library identities remain separate.
const known = [{ id: 'legacy', libraryId: '0025' }];
const records = [record('2026-10-01', 60), record('2026-10-08', 70, { libraryId: '0025' }), record('2026-10-09', 250, { libraryId: '0085' })];
assert.deepStrictEqual(insights.exerciseHistory(records, '0025', known).map(point => point.maxWeight), [70]);
assert.deepStrictEqual(insights.exerciseHistory(records.map((item, index) => index === 2 ? { ...item, exercises: [{ ...item.exercises[0], id: 'other' }] } : item), '0025', known).map(point => point.maxWeight), [60, 70]);
assert.strictEqual(insights.exerciseHistory([record('2026-10-01', 0)], 'legacy')[0].e1rm, null);
assert.strictEqual(insights.exerciseHistory([record('bad-date', 50)], 'legacy').length, 0);
assert.strictEqual(progression.resolveExerciseKey(exercise(60), known), '0025');
assert.strictEqual(progression.resolveExerciseKey(exercise(60), known.concat({ id: 'legacy', libraryId: '0085' })), 'legacy');
assert.strictEqual(insights.newRecordsFor(record('2026-10-08', 70), [record('2026-10-01', 60)], known).length, 3);

// ISO week boundaries and absent data must not turn into fake improvements.
assert.deepStrictEqual(insights.previousWeek('2026-01-05'), { start: '2025-12-29', end: '2026-01-04' });
const week = insights.weeklyReport({ today: '2026-01-05', records: [record('2025-12-28', 50), record('2025-12-29', 60), record('2026-01-02', 65),
  { date: '2026-01-03', type: 'rest' }, record('2026-01-04', 0, { sets: [set(100, 1, 'warmup')] }), record('2026-01-05', 300)],
  nutritionByDate: { '2025-12-29': [{ calories: 1800, protein: 100 }], '2025-12-30': [], '2026-01-02': [{ calories: 2200, protein: 140 }], '2026-01-05': [{ calories: 9999 }] },
  weights: [{ date: '2025-12-28', weight: 100 }, { date: '2025-12-29', weight: 80 }, { date: '2026-01-04', weight: 79.3 }] });
assert.strictEqual(week.trainingCount, 2);
assert.strictEqual(week.volume, 1250);
assert.strictEqual(week.newRecords.length, 6);
assert.strictEqual(week.avgCalories, 2000);
assert.strictEqual(week.avgProtein, 120);
assert.strictEqual(week.nutritionDays, 2);
assert.strictEqual(week.weightChange, -.7);
const empty = insights.weeklyReport({ today: '2026-01-05', weights: [{ date: '2026-01-01', weight: 80 }] });
assert.strictEqual(empty.avgCalories, null);
assert.strictEqual(empty.weightChange, null);
assert.strictEqual(insights.weeklyReport({ today: '2026-01-05' }).hasData, false);

// Schedule preferences survive builtin regeneration; missing/deleted weekdays
// resolve to rest, and switching back removes the virtual rest day.
const custom = plans.upsertCustomPlan({ id: 'schedule_test', title: '我的计划', days: [{ id: 'push', name: '胸', exercises: [] }, { id: 'pull', name: '背', exercises: [] }] });
plans.savePlanSchedule(custom.id, { mode: 'weekday', weekdays: { 1: 'push', 3: 'pull', 5: 'deleted' } });
plans.setActivePlanId(custom.id);
const state = plans.ensureWorkoutPlanState();
assert.strictEqual(schedule.resolveDay(state.activePlan, [], '2026-10-12').id, 'push');
assert.strictEqual(schedule.resolveDay(state.activePlan, [], '2026-10-14').id, 'pull');
assert.strictEqual(schedule.resolveDay(state.activePlan, [], '2026-10-16').type, 'rest');
assert.strictEqual(plans.getPlanById(custom.id).schedule.mode, 'weekday');
assert.strictEqual(schedule.upcoming(state.activePlan, [], '2026-10-12', 7).filter(day => !day.isRest).length, 2);
const { buildOverview } = require('../pages/today/today-model');
assert.strictEqual(buildOverview(state.activePlan, [{ date: '2026-10-12', dayId: 'pull', planId: custom.id }], '2026-10-12').selected.id, 'pull');
plans.savePlanSchedule(custom.id, { mode: 'cycle' });
assert.strictEqual(plans.ensureWorkoutPlanState().activePlan.days.length, 2);

// Copy just the chosen meal, retain portion/meal time, generate fresh IDs, and
// never mutate yesterday. Explicit favorites take precedence over frequency.
const yesterday = [{ id: 'old1', name: '燕麦', calories: 300, protein: 10, estimatedWeight: 80, time: new Date('2026-10-15T08:05:00').toISOString() },
  { id: 'old2', name: '米饭', calories: 200, time: new Date('2026-10-15T12:05:00').toISOString() }];
const before = JSON.stringify(yesterday);
let next = 0;
const copies = foods.copyMeal(yesterday, [0], '2026-10-16', () => 'fresh' + next++);
assert.strictEqual(copies.length, 1);
assert.strictEqual(copies[0].calories, 300);
assert.notStrictEqual(copies[0].id, 'old1');
assert.strictEqual(new Date(copies[0].time).getDate(), 16);
assert.strictEqual(view.buildMealGroups(copies)[0].key, 'breakfast');
assert.strictEqual(JSON.stringify(yesterday), before);
assert.deepStrictEqual(foods.combine([{ name: '燕麦', calories: 111 }], yesterday).map(food => food.calories), [111, 200]);
const oldFavorite = { name: '收藏牛奶', estimatedWeight: 250, calories: 150, protein: 8, fat: 5, carbs: 12 };
const upgradedFavorite = foods.combine([oldFavorite], [])[0];
const foodSuggest = require('../utils/food-suggest');
const favoriteSuggestion = foodSuggest.suggestFoods('收藏牛奶', [upgradedFavorite])[0];
const halfPortion = foodSuggest.applySuggestion(favoriteSuggestion, 125);
assert.strictEqual(halfPortion.calories, '75');
assert.strictEqual(halfPortion.protein, '4');
assert.strictEqual(oldFavorite.per100, undefined, 'old favorite values are upgraded without mutating storage objects');

// Image and mini-program share snapshots have identical metrics, bounded text,
// no user records/food details, and retain nulls instead of inventing zeros.
const texts = [];
const canvas = { getContext: () => ({ fillRect() {}, fillText(value) { texts.push(value); } }) };
const image = card.render(canvas, week);
assert.strictEqual(canvas.width, 750); assert.strictEqual(canvas.height, 1120);
assert(texts.includes('2 次') && texts.includes('2000 kcal') && texts.includes('-0.7 kg'));
assert.deepStrictEqual(card.parse(decodeURIComponent(card.sharePath(week).split('shared=')[1])), image);
assert.strictEqual(card.snapshot(empty).weightChange, null);
assert.strictEqual(card.parse('{bad'), null);
assert.strictEqual(card.parse('[]'), null);
assert(!JSON.stringify(image).includes('exercises'));
assert.strictEqual(card.snapshot({ title: 'x'.repeat(500), volume: Infinity }).title.length, 36);

assert.strictEqual(reminders.load().time, '20:00');
reminders.save({ enabled: true, time: '19:30' });
assert.strictEqual(reminders.load().enabled, true);
assert.strictEqual(reminders.load().time, '19:30');
assert.strictEqual(reminders.normalize({ time: '25:00' }).time, '20:00');
reminders.markScheduleChanged(); assert.strictEqual(reminders.load().scheduleChanged, true);
console.log('training growth calculations, schedule, food copy, reminder preferences and share image tests passed');
