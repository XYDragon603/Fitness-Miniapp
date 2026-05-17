const app = getApp();
const util = require('../../utils/util.js');
const workoutPlan = require('../../utils/workout-plan.js');
const { sanitizeGuideUrl } = require('../../utils/mvp-core.js');

const VISIBLE_WEEK = 1;
const BUILTIN_PLAN_ID = 'builtin_air_split_foundation';
const BUILTIN_PLAN_TITLE = '凯圣王和谭成义三分化训练';

function getDisplayPlanTitle(plan) {
  if (plan && plan.id === BUILTIN_PLAN_ID) {
    return BUILTIN_PLAN_TITLE;
  }

  return plan && plan.title ? plan.title : '';
}

function getDefaultGuide(exerciseName) {
  return {
    exerciseName: exerciseName || '',
    summary: '教学说明会结合动作逐步补充，当前版本可先按记录卡中的训练建议完成。',
    targetMuscles: [],
    commonMistakes: [],
    tips: [],
    videoTitle: '教学内容稍后补充',
    videoUrl: ''
  };
}

function createDraftExercise() {
  return {
    name: '',
    targetPart: '',
    sets: '3',
    reps: '10-12',
    note: '',
    videoUrl: ''
  };
}

function createDraftTrainingDay(index) {
  return {
    type: 'training',
    name: '',
    icon: ['🏋️', '💪', '🔥', '🏃', '🏆'][index] || '🏋️',
    color: ['#C96565', '#4F9CC4', '#4EAE7D', '#C89155', '#7286DA'][index] || '#C96565',
    exercises: [createDraftExercise()]
  };
}

function createDraftRestDay() {
  return {
    type: 'rest',
    name: '休息日',
    icon: '🌿',
    color: workoutPlan.DEFAULT_REST_DAY_COLOR || '#5F9A88',
    focus: '恢复',
    description: '用于安排恢复、拉伸或轻度活动。',
    note: '',
    exercises: []
  };
}

function createPlanDraft() {
  return {
    title: '',
    notice: '',
    days: [createDraftTrainingDay(0)]
  };
}

function getDraftTrainingFallback(index) {
  return createDraftTrainingDay(index);
}

Page({
  data: {
    trainingDays: [],
    notice: '',
    planTitle: '',
    planBadge: '',
    dayCount: 0,
    exerciseTotal: 0,
    guideVisible: false,
    activeGuide: getDefaultGuide(),
    planManagerVisible: false,
    createPlanVisible: false,
    trainingPlans: [],
    activePlanId: '',
    planDraft: createPlanDraft()
  },

  onLoad() {
    this.loadPlanData();
  },

  onShow() {
    this.syncCustomTabBar();
    this.loadPlanData();
  },

  syncCustomTabBar() {
    if (typeof this.getTabBar !== 'function') {
      return;
    }

    const tabBar = this.getTabBar();
    if (!tabBar) {
      return;
    }

    tabBar.setData({
      selected: 0,
      hidden: false
    });
  },

  setCustomTabBarHidden(hidden) {
    if (typeof this.getTabBar !== 'function') {
      return;
    }

    const tabBar = this.getTabBar();
    if (!tabBar) {
      return;
    }

    tabBar.setData({
      hidden: !!hidden
    });
  },

  loadPlanData() {
    const state = app.refreshTrainingPlanState();
    const plan = state.activePlan;

    if (!plan) {
      return;
    }

    const trainingDays = plan.days.map(day => ({
      ...day,
      isRestDay: day.type === 'rest',
      restFocus: day.focus || '',
      restDescription: day.description || '',
      restNote: day.note || '',
      exercises: Array.isArray(day.exercises)
        ? day.exercises.map(exercise => ({
            ...exercise,
            currentPlan: exercise.weeks[VISIBLE_WEEK] || {}
          }))
        : []
    }));

    const exerciseTotal = trainingDays.reduce((total, day) => total + day.exercises.length, 0);
    const trainingPlans = state.plans.map(item => ({
      id: item.id,
      title: getDisplayPlanTitle(item),
      type: item.type,
      dayCount: Array.isArray(item.days) ? item.days.length : 0,
      exerciseTotal: Array.isArray(item.days)
        ? item.days.reduce((sum, day) => sum + (Array.isArray(day.exercises) ? day.exercises.length : 0), 0)
        : 0
    }));

    this.setData({
      trainingDays,
      notice: plan.notice,
      planTitle: getDisplayPlanTitle(plan),
      planBadge: plan.type === 'builtin' ? '内置参考计划' : '当前启用计划',
      dayCount: trainingDays.length,
      exerciseTotal,
      trainingPlans,
      activePlanId: state.activePlanId
    });
  },

  openPlanManager() {
    this.setData({
      planManagerVisible: true,
      createPlanVisible: false
    });
    this.setCustomTabBarHidden(true);
  },

  closePlanManager() {
    this.setData({
      planManagerVisible: false
    });
    this.setCustomTabBarHidden(false);
  },

  activatePlan(e) {
    const planId = e.currentTarget.dataset.planId;
    if (!planId || planId === this.data.activePlanId) {
      return;
    }

    app.activateTrainingPlan(planId);
    this.loadPlanData();
    wx.showToast({
      title: '已切换计划',
      icon: 'success'
    });
  },

  openCreatePlan() {
    this.setData({
      planManagerVisible: false,
      createPlanVisible: true,
      planDraft: createPlanDraft()
    });
    this.setCustomTabBarHidden(true);
  },

  closeCreatePlan() {
    this.setData({
      createPlanVisible: false,
      planDraft: createPlanDraft()
    });
    this.setCustomTabBarHidden(false);
  },

  onDraftPlanInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`planDraft.${field}`]: e.detail.value
    });
  },

  onDraftDayInput(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`planDraft.days[${dayIndex}].${field}`]: e.detail.value
    });
  },

  onDraftExerciseInput(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const exerciseIndex = Number(e.currentTarget.dataset.exerciseIndex);
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`planDraft.days[${dayIndex}].exercises[${exerciseIndex}].${field}`]: e.detail.value
    });
  },

  addDraftTrainingDay() {
    const days = this.data.planDraft.days.slice();
    days.push(createDraftTrainingDay(days.length));
    this.setData({
      'planDraft.days': days
    });
  },

  addDraftRestDay() {
    const days = this.data.planDraft.days.slice();
    days.push(createDraftRestDay());
    this.setData({
      'planDraft.days': days
    });
  },

  removeDraftDay(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const days = this.data.planDraft.days.slice();

    if (days.length <= 1) {
      wx.showToast({
        title: '至少保留 1 个计划日',
        icon: 'none'
      });
      return;
    }

    days.splice(dayIndex, 1);
    this.setData({
      'planDraft.days': days
    });
  },

  addDraftExercise(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const days = this.data.planDraft.days.slice();
    days[dayIndex].exercises.push(createDraftExercise());
    this.setData({
      'planDraft.days': days
    });
  },

  removeDraftExercise(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const exerciseIndex = Number(e.currentTarget.dataset.exerciseIndex);
    const days = this.data.planDraft.days.slice();

    if (days[dayIndex].exercises.length <= 1) {
      wx.showToast({
        title: '每个训练日至少保留 1 个动作',
        icon: 'none'
      });
      return;
    }

    days[dayIndex].exercises.splice(exerciseIndex, 1);
    this.setData({
      'planDraft.days': days
    });
  },

  buildTrainingDay(day, dayIndex) {
    const fallback = getDraftTrainingFallback(dayIndex);
    return {
      id: day.id || `day${dayIndex + 1}`,
      type: 'training',
      name: (day.name || '').trim(),
      icon: day.icon || fallback.icon,
      color: day.color || fallback.color,
      exercises: (Array.isArray(day.exercises) ? day.exercises : []).map((exercise, exerciseIndex) => ({
        id: `custom_${dayIndex + 1}_${exerciseIndex + 1}_${util.generateId()}`,
        name: (exercise.name || '').trim(),
        targetPart: (exercise.targetPart || '').trim(),
        weeks: {
          1: {
            sets: Number(exercise.sets) || 3,
            reps: (exercise.reps || '').trim() || '10-12',
            note: (exercise.note || '').trim()
          }
        },
        guide: {
          summary: `${(exercise.targetPart || '').trim() || '该动作'}练习说明可后续继续补充，当前可先按计划备注稳定完成。`,
          targetMuscles: (exercise.targetPart || '').trim() ? [(exercise.targetPart || '').trim()] : [],
          commonMistakes: [],
          tips: [],
          videoTitle: sanitizeGuideUrl(exercise.videoUrl) ? '查看教学链接' : '教学内容稍后补充',
          videoUrl: sanitizeGuideUrl(exercise.videoUrl)
        }
      }))
    };
  },

  buildRestDay(day, dayIndex) {
    return {
      id: day.id || `custom_rest_${dayIndex + 1}_${util.generateId()}`,
      type: 'rest',
      name: (day.name || '').trim() || '休息日',
      icon: day.icon || '🌿',
      color: day.color || (workoutPlan.DEFAULT_REST_DAY_COLOR || '#5F9A88'),
      focus: (day.focus || '').trim() || '恢复',
      description: (day.description || '').trim() || '用于安排恢复、拉伸或轻度活动。',
      note: (day.note || '').trim(),
      exercises: []
    };
  },

  submitCustomPlan() {
    const draft = this.data.planDraft;
    const title = (draft.title || '').trim();

    if (!title) {
      wx.showToast({
        title: '请先填写计划名称',
        icon: 'none'
      });
      return;
    }

    const days = draft.days.map((day, dayIndex) => (
      day && day.type === 'rest'
        ? this.buildRestDay(day, dayIndex)
        : this.buildTrainingDay(day, dayIndex)
    ));

    const invalidDay = days.find(day => !day.name);
    const invalidTrainingDay = days.find(day => day.type !== 'rest' && (!Array.isArray(day.exercises) || day.exercises.length === 0));
    const invalidExercise = days.find(day => day.type !== 'rest' && day.exercises.some(item => !item.name));

    if (invalidDay) {
      wx.showToast({
        title: '请填写每个计划日名称',
        icon: 'none'
      });
      return;
    }

    if (invalidTrainingDay) {
      wx.showToast({
        title: '训练日需要至少 1 个动作',
        icon: 'none'
      });
      return;
    }

    if (invalidExercise) {
      wx.showToast({
        title: '请填写每个动作名称',
        icon: 'none'
      });
      return;
    }

    const savedPlan = app.saveCustomTrainingPlan({
      id: `custom_${util.generateId()}`,
      type: 'custom',
      title,
      notice: (draft.notice || '').trim() || '这是你的自定义训练计划，建议按动作质量和恢复节奏持续记录。',
      days
    });

    app.activateTrainingPlan(savedPlan.id);
    this.setData({
      createPlanVisible: false,
      planManagerVisible: false,
      planDraft: createPlanDraft()
    });
    this.setCustomTabBarHidden(false);
    this.loadPlanData();

    wx.showToast({
      title: '自定义计划已启用',
      icon: 'success'
    });
  },

  startTraining(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const day = this.data.trainingDays[dayIndex];

    app.globalData.selectedDayIndex = dayIndex;
    app.globalData.selectedDayId = day ? day.id : '';
    app.globalData.selectedWeek = VISIBLE_WEEK;

    wx.switchTab({
      url: '/pages/record/record'
    });
  },

  openGuide(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const exerciseIndex = Number(e.currentTarget.dataset.exerciseIndex);
    const trainingDay = this.data.trainingDays[dayIndex];
    const exercise = trainingDay && trainingDay.exercises ? trainingDay.exercises[exerciseIndex] : null;
    const guide = exercise && exercise.guide ? exercise.guide : {};

    this.setData({
      guideVisible: true,
      activeGuide: {
        exerciseName: exercise ? exercise.name : '',
        summary: guide.summary || '教学说明会结合动作逐步补充，当前版本可以先按记录卡中的训练建议完成。',
        targetMuscles: Array.isArray(guide.targetMuscles) ? guide.targetMuscles : [],
        commonMistakes: Array.isArray(guide.commonMistakes) ? guide.commonMistakes : [],
        tips: Array.isArray(guide.tips) ? guide.tips : [],
        videoTitle: guide.videoTitle || '教学内容稍后补充',
        videoUrl: guide.videoUrl || ''
      }
    });
  },

  closeGuide() {
    this.setData({
      guideVisible: false,
      activeGuide: getDefaultGuide()
    });
  },

  copyGuideVideoUrl() {
    const { activeGuide } = this.data;
    if (!activeGuide.videoUrl) {
      wx.showToast({
        title: '暂时没有可复制的教学链接',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: activeGuide.videoUrl,
      success: () => {
        wx.showToast({
          title: '教学链接已复制',
          icon: 'success'
        });
      }
    });
  },

  noop() {}
});
