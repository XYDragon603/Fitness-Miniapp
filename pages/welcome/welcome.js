const app = getApp();
const util = require('../../utils/util.js');
const workoutPlan = require('../../utils/workout-plan.js');
const ui = require('../../utils/ui-helpers.js');
const onboarding = require('../../utils/onboarding.js');

Page({
  data: {
    step: 0,
    goal: '',
    level: '',
    info: { gender: 'male', height: '', weight: '', age: '' },
    plan: null
  },

  chooseGoal(e) {
    this.setData({ goal: e.currentTarget.dataset.value, step: 1 });
  },

  chooseLevel(e) {
    this.setData({ level: e.currentTarget.dataset.value, step: 2 });
  },

  chooseGender(e) {
    this.setData({ 'info.gender': e.currentTarget.dataset.value });
  },

  onInfoInput(e) {
    this.setData({ [`info.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  back() {
    if (this.data.step > 0) this.setData({ step: this.data.step - 1 });
  },

  showPlan() {
    const pick = onboarding.recommendPlan(this.data.goal, this.data.level);
    const plan = workoutPlan.getPlanById(pick.planId) || workoutPlan.buildDefaultPlan();
    const exerciseTotal = plan.days.reduce((sum, day) => sum + (day.exercises || []).length, 0);
    const firstExercise = plan.days.reduce((found, day) => found || (day.exercises || [])[0], null);
    this.setData({
      step: 3,
      plan: {
        id: plan.id,
        title: plan.id === 'builtin_air_split_foundation' ? '凯圣王和谭成义三分化训练' : plan.title,
        summary: `${plan.days.length} 天一轮 · ${exerciseTotal} 个动作`,
        reason: pick.reason,
        image: ui.equipmentImage(firstExercise ? firstExercise.name : '卧推'),
        days: plan.days.slice(0, 7).map((day, index) => ({ id: day.id, label: `第${index + 1}天`, focus: ui.dayFocus(day) }))
      }
    });
  },

  finish() {
    const { plan, goal, info } = this.data;
    if (plan) app.activateTrainingPlan(plan.id);
    const profile = onboarding.buildProfile(goal, info);
    if (profile && !util.getNutritionGoalProfile()) util.saveNutritionGoalProfile(profile);
    wx.setStorageSync(onboarding.ONBOARDING_KEY, true);
    wx.switchTab({ url: '/pages/today/today' });
  },

  skip() {
    wx.setStorageSync(onboarding.ONBOARDING_KEY, true);
    wx.switchTab({ url: '/pages/today/today' });
  }
});
