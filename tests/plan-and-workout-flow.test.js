const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const copy = value => JSON.parse(JSON.stringify(value));
const storage = {};
const modals = [];
const redirects = [];
const toasts = [];

global.wx = {
  getStorageSync(key) { return storage[key] === undefined ? undefined : copy(storage[key]); },
  setStorageSync(key, value) { storage[key] = copy(value); },
  removeStorageSync(key) { delete storage[key]; },
  showModal(options) { modals.push(options); },
  showToast(options) { toasts.push(options.title); },
  showActionSheet() {},
  navigateTo() {},
  redirectTo(options) { redirects.push(options.url); },
  vibrateShort() {},
  vibrateLong() {},
  setKeepScreenOn() {},
  setNavigationBarColor() {}
};

function setDataImpl(update, callback) {
  Object.entries(update).forEach(([key, value]) => {
    const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
    let target = this.data;
    keys.slice(0, -1).forEach(part => { target = target[part]; });
    target[keys[keys.length - 1]] = value;
  });
  if (callback) callback();
}

function loadPage(relative, app, extra) {
  const file = path.join(root, relative);
  let page;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    Page(value) { page = value; },
    getApp() { return app; },
    require: createRequire(file),
    wx: global.wx,
    console,
    Date,
    setTimeout: fn => fn(),
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    ...(extra || {})
  });
  page.data = copy(page.data);
  page.setData = setDataImpl;
  page.getTabBar = () => ({ setData() {} });
  return page;
}

const workoutPlan = require('../utils/workout-plan.js');

// ---------- 计划编辑：侧滑返回不丢改动 ----------
{
  workoutPlan.upsertCustomPlan({ id: 'custom_guard', title: '我的计划', days: [{ id: 'd1', name: '胸', exercises: [
    { id: 'ex1', name: '杠铃卧推', weeks: { 1: { sets: 3, reps: '10', note: '' } } }
  ] }] });
  const app = {
    globalData: {},
    refreshTrainingPlanState() { return workoutPlan.ensureWorkoutPlanState(); },
    saveCustomTrainingPlan(value) { return workoutPlan.upsertCustomPlan(value); },
    activateTrainingPlan(id) { workoutPlan.setActivePlanId(id); }
  };
  const page = loadPage('pages/index/index.js', app);
  const openEdit = () => page.openEditPlan({ currentTarget: { dataset: { planId: 'custom_guard' } } });

  // 没改动：直接关闭，不弹确认
  openEdit();
  assert.strictEqual(page.data.editorTitle, '编辑训练计划');
  page.onSubpageLeave();
  assert.strictEqual(page.data.createPlanVisible, false);
  assert.strictEqual(modals.length, 0);

  // 有改动 + 侧滑：先隐藏子页并确认；选“继续编辑”恢复显示，草稿还在
  openEdit();
  page.onDraftPlanInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: '改过的名字' } });
  page.onSubpageLeave();
  assert.strictEqual(modals.length, 1);
  assert.strictEqual(page.data.createPlanVisible, true, 'editor stays open while confirming');
  assert.strictEqual(page.data.subpageOn, false);
  modals[0].success({ confirm: false, cancel: true });
  assert.strictEqual(page.data.subpageOn, true);
  assert.strictEqual(page.data.planDraft.title, '改过的名字');

  // 导航栏返回 + 确认放弃
  page.requestCloseEditor();
  assert.strictEqual(modals.length, 2);
  modals[1].success({ confirm: true });
  assert.strictEqual(page.data.createPlanVisible, false);
  assert.strictEqual(workoutPlan.getPlanById('custom_guard').title, '我的计划', 'discarding never saves');

  // 拖动排序：第 1 个拖到第 3 个
  workoutPlan.upsertCustomPlan({ id: 'custom_drag', title: '拖动', days: [{ id: 'd1', name: '胸', exercises: ['A', 'B', 'C'].map(name => (
    { id: `ex_${name}`, name, weeks: { 1: { sets: 3, reps: '10', note: '' } } })) }] });
  page.openEditPlan({ currentTarget: { dataset: { planId: 'custom_drag' } } });
  const grip = { currentTarget: { dataset: { dayIndex: 0, exerciseIndex: 0 } } };
  page.onGripStart({ ...grip, touches: [{ clientY: 100 }] });
  page.onGripMove({ ...grip, touches: [{ clientY: 100 + 76 * 2 + 10 }] });
  assert.strictEqual(page.data.drag.to, 2);
  page.onGripEnd();
  assert.strictEqual(page.data.drag, null);
  assert.deepStrictEqual(page.data.planDraft.days[0].exercises.map(item => item.name), ['B', 'C', 'A']);
  assert(page.isDraftDirty(), 'reordering counts as an unsaved change');
  page.onGripStart({ ...grip, touches: [{ clientY: 100 }] });
  page.onGripMove({ ...grip, touches: [{ clientY: 90 }] });
  page.onGripEnd();
  assert.deepStrictEqual(page.data.planDraft.days[0].exercises.map(item => item.name), ['B', 'C', 'A'], 'small moves keep the order');
  page.closeCreatePlan();

  // 内置计划另存
  page.openEditPlan({ currentTarget: { dataset: { planId: 'builtin_air_split_foundation' } } });
  assert.strictEqual(page.data.editorTitle, '另存为我的计划');
  page.closeCreatePlan();
}

// ---------- 训练：做完最后一组 -> 下一组目标 -> 保存并跳到当天详情 ----------
{
  Object.keys(storage).forEach(key => delete storage[key]);
  modals.length = 0;
  const plan = { id: 'p', title: '计划', days: [{ id: 'push', name: '推', color: '#000', exercises: [
    { id: 'bench', name: '杠铃卧推', weeks: { 1: { sets: 2, reps: '10' } } }
  ] }] };
  const app = { globalData: {}, getActiveTrainingPlan() { return plan; }, refreshTrainingPlanState() { return { activePlan: plan }; } };
  const page = loadPage('pages/record/record.js', app);
  page.onLoad();
  page.selectDay({ currentTarget: { dataset: { index: 0 } } });
  const today = page.data.todayStr;
  assert.strictEqual(page.data.exercises[0].sets.length, 2);

  page.stepValue({ currentTarget: { dataset: { exIndex: 0, setIndex: 0, field: 'weight', delta: 1 } } });
  assert.strictEqual(page.data.exercises[0].sets[0].weight, '2.5');
  page.completeCurrentSet();
  assert.strictEqual(page.data.restTimerVisible, true, 'rest starts after a non-final set');
  assert(storage[`training_${today}`], 'each completed set is auto-saved');
  page.skipRestTimer();

  page.completeCurrentSet();
  assert(page.data.targetView, 'next-target view opens after the final set');
  assert.strictEqual(page.data.restTimerVisible, false);

  page.keepCurrentTarget();
  assert.deepStrictEqual(redirects, [`/pages/history/day?date=${today}`]);
  const saved = storage[`training_${today}`];
  assert.strictEqual(saved.dayId, 'push');
  assert(saved.exercises[0].sets.every(set => set.done));
  assert(saved.startedAt && saved.finishedAt && saved.durationMin >= 1);
  assert(storage.exercise_next_targets.bench, '“保持当前重量” stores the next target');
}

console.log('plan editor guard and workout finish flow tests passed');
