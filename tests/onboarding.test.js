const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const onboarding = require('../utils/onboarding.js');

// 是否显示引导
assert.strictEqual(onboarding.shouldShowOnboarding({}), true);
assert.strictEqual(onboarding.shouldShowOnboarding({ done: true }), false);
assert.strictEqual(onboarding.shouldShowOnboarding({ trainingDates: ['2026-10-16'] }), false, 'existing users skip');
assert.strictEqual(onboarding.shouldShowOnboarding({ nutritionDates: ['2026-10-16'] }), false);
assert.strictEqual(onboarding.shouldShowOnboarding({ plans: [{ type: 'builtin' }, { type: 'custom' }] }), false);
assert.strictEqual(onboarding.shouldShowOnboarding({ plans: [{ type: 'builtin' }] }), true);

// 推荐计划
assert.strictEqual(onboarding.recommendPlan('muscle', 'experienced').planId, 'builtin_air_split_foundation');
assert.strictEqual(onboarding.recommendPlan('muscle', 'beginner').planId, 'builtin_healthy_fat_loss');
assert.strictEqual(onboarding.recommendPlan('fatloss', 'experienced').planId, 'builtin_healthy_fat_loss');
assert(onboarding.recommendPlan('health', 'beginner').reason);

// 基本信息：填全且合理才生成营养资料
assert.deepStrictEqual(onboarding.buildProfile('fatloss', { gender: 'female', height: '165', weight: '58', age: '30' }),
  { height: 165, weight: 58, age: 30, gender: 'female', activityLevel: 'light', goal: 'fat_loss' });
assert.strictEqual(onboarding.buildProfile('muscle', { height: '170', weight: '', age: '25' }), null);
assert.strictEqual(onboarding.buildProfile('muscle', { height: '17', weight: '60', age: '25' }), null);

// 引导页走完：启用推荐计划、写入营养资料、标记已看过
const storage = {};
const copy = value => JSON.parse(JSON.stringify(value));
global.wx = {
  getStorageSync(key) { return storage[key] === undefined ? '' : copy(storage[key]); },
  setStorageSync(key, value) { storage[key] = copy(value); },
  switchTab(options) { storage.__switched = options.url; }
};
const workoutPlan = require('../utils/workout-plan.js');
let activated = '';
const file = path.join(__dirname, '../pages/welcome/welcome.js');
let page;
vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
  Page(value) { page = value; },
  getApp() { return { activateTrainingPlan(id) { activated = id; workoutPlan.setActivePlanId(id); } }; },
  require: createRequire(file),
  wx: global.wx
});
page.data = copy(page.data);
page.setData = function(update) {
  Object.entries(update).forEach(([key, value]) => {
    const keys = key.split('.');
    let target = this.data;
    keys.slice(0, -1).forEach(part => { target = target[part]; });
    target[keys[keys.length - 1]] = value;
  });
};
page.chooseGoal({ currentTarget: { dataset: { value: 'muscle' } } });
page.chooseLevel({ currentTarget: { dataset: { value: 'experienced' } } });
assert.strictEqual(page.data.step, 2);
['height', 'weight', 'age'].forEach((field, index) => page.onInfoInput({ currentTarget: { dataset: { field } }, detail: { value: ['178', '75', '27'][index] } }));
page.showPlan();
assert.strictEqual(page.data.step, 3);
assert.strictEqual(page.data.plan.id, 'builtin_air_split_foundation');
assert.strictEqual(page.data.plan.title, '凯圣王和谭成义三分化训练');
page.finish();
assert.strictEqual(activated, 'builtin_air_split_foundation');
assert.strictEqual(storage.nutrition_goal_profile.goal, 'muscle_gain');
assert.strictEqual(storage[onboarding.ONBOARDING_KEY], true);
assert.strictEqual(storage.__switched, '/pages/today/today');

console.log('onboarding tests passed');
