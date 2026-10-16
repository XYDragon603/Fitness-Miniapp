const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const plan = require('../utils/workout-plan');
const previousWx = global.wx;
const state = {};
const copy = value => JSON.parse(JSON.stringify(value));
global.wx = {
  getStorageSync(key) { return state[key] ? copy(state[key]) : undefined; },
  setStorageSync(key, value) { state[key] = copy(value); }
};
try {
  const source = {
    id: 'lib_0025_example', libraryId: '0025', name: '杠铃平板卧推', targetPart: '胸部',
    weeks: { 1: { sets: 3, reps: '10-12', note: '' } },
    guide: { summary: '躺在平板凳上', targetMuscles: ['胸肌', '肱三头肌'], commonMistakes: [], tips: ['稳定肩胛'], videoUrl: '', videoTitle: '' }
  };
  assert.strictEqual(plan.normalizeExercise(source, 0).libraryId, '0025');
  for (const libraryId of [25, '25', '00025', 'abcd', null, '', '0025\n']) {
    assert(!Object.hasOwn(plan.normalizeExercise({ ...source, libraryId }, 0), 'libraryId'));
  }
  plan.upsertCustomPlan({ id: 'custom_roundtrip', title: '测试', days: [{ name: '胸部', exercises: [source] }] });
  const read = plan.getPlanById('custom_roundtrip').days[0].exercises[0];
  assert.strictEqual(read.libraryId, source.libraryId);
  assert.deepStrictEqual(read.guide.tips, source.guide.tips);
  assert.strictEqual(read.guide.summary, source.guide.summary);
  const pagePath = path.resolve(__dirname, '../pages/index/index.js');
  let page;
  let navigation;
  let savedPlan;
  const tab = { data: {}, setData(update) { Object.assign(this.data, update); } };
  const app = {
    globalData: {},
    refreshTrainingPlanState() { return plan.ensureWorkoutPlanState(); },
    saveCustomTrainingPlan(value) { savedPlan = plan.upsertCustomPlan(value); return savedPlan; },
    activateTrainingPlan(id) { plan.setActivePlanId(id); }
  };
  vm.runInNewContext(fs.readFileSync(pagePath, 'utf8'), {
    Page(value) { page = value; }, getApp() { return app; }, require: createRequire(pagePath),
    wx: { ...global.wx, navigateTo(options) { navigation = options; }, showToast() {} }
  });
  page.data = copy(page.data);
  page.getTabBar = () => tab;
  page.setData = function(update) {
    Object.entries(update).forEach(([key, value]) => {
      const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = this.data;
      keys.slice(0, -1).forEach(part => { target = target[part]; });
      target[keys[keys.length - 1]] = value;
    });
  };
  page.openCreatePlan();
  page.pickLibraryExercise({ currentTarget: { dataset: { dayIndex: 0 } } });
  assert.strictEqual(navigation.url, '/packageExercise/pages/library/library?mode=pick');
  navigation.events.exercisePicked(source);
  assert.strictEqual(page.data.planDraft.days[0].exercises.length, 1, 'replace sole empty row');
  navigation.events.exercisePicked(source);
  navigation.events.exercisePicked(source);
  assert.strictEqual(page.data.planDraft.days[0].exercises.length, 3);
  page.onShow();
  assert.strictEqual(tab.data.hidden, true, 'return from subpackage keeps editor tab hidden');
  page.data.planDraft.title = '动作库计划';
  page.data.planDraft.days[0].name = '胸部训练';
  page.submitCustomPlan();
  assert.strictEqual(savedPlan.days[0].exercises.length, 3);
  savedPlan.days[0].exercises.forEach(exercise => {
    assert.strictEqual(exercise.libraryId, '0025');
    assert.strictEqual(exercise.guide.summary, source.guide.summary);
  });
  assert.strictEqual(plan.getActivePlanId(), savedPlan.id);
  assert.strictEqual(tab.data.hidden, false);
  page.openGuide({ currentTarget: { dataset: { dayIndex: 0, exerciseIndex: 0 } } });
  assert.strictEqual(navigation.url, '/packageExercise/pages/detail/detail?id=0025');
  console.log('workout plan library tests passed');
} finally { global.wx = previousWx; }
