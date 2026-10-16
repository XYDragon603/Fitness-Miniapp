const workoutPlan = require('./utils/workout-plan.js');
const cloudBackup = require('./utils/cloud-backup.js');
const cloudConfig = require('./config/cloud.js');

App({
  onLaunch() {
    this.initCloud();
    this.refreshTrainingPlanState();
  },

  // 离开小程序时：数据有变化且距上次超过 6 小时，静默备份到云端
  onHide() {
    cloudBackup.autoBackup();
  },

  globalData: {
    trainingPlan: null,
    trainingPlans: [],
    activePlanId: '',
    cloudEnvId: '',
    selectedDayIndex: null,
    selectedDayId: '',
    selectedWeek: 1,
    themeColor: '#D97878',
    secondaryColor: '#19353B'
  },

  initCloud() {
    if (!wx.cloud) {
      return;
    }

    try {
      wx.cloud.init({
        env: cloudConfig.envId,
        traceUser: true
      });
      this.globalData.cloudEnvId = cloudConfig.envId;
    } catch (error) {
      console.warn('wx.cloud.init failed', error);
    }
  },

  refreshTrainingPlanState() {
    const state = workoutPlan.ensureWorkoutPlanState();

    this.globalData.trainingPlan = state.activePlan;
    this.globalData.trainingPlans = state.plans;
    this.globalData.activePlanId = state.activePlanId;
    this.globalData.dayTypes = state.activePlan.days.map(day => day.name);
    return state;
  },

  getActiveTrainingPlan() {
    if (!this.globalData.trainingPlan) {
      this.refreshTrainingPlanState();
    }

    return this.globalData.trainingPlan;
  },

  getTrainingPlans() {
    if (!this.globalData.trainingPlans || this.globalData.trainingPlans.length === 0) {
      this.refreshTrainingPlanState();
    }

    return this.globalData.trainingPlans;
  },

  activateTrainingPlan(planId) {
    workoutPlan.setActivePlanId(planId);
    return this.refreshTrainingPlanState();
  },

  saveCustomTrainingPlan(plan) {
    const savedPlan = workoutPlan.upsertCustomPlan(plan);
    this.refreshTrainingPlanState();
    return savedPlan;
  }
});
