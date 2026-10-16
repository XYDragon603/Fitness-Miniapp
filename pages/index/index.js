const app = getApp();
const util = require('../../utils/util.js');
const workoutPlan = require('../../utils/workout-plan.js');
const { sanitizeGuideUrl } = require('../../utils/mvp-core.js');
const ui = require('../../utils/ui-helpers.js');
const { buildOverview } = require('../today/today-model.js');

const VISIBLE_WEEK = 1;
const BUILTIN_PLAN_ID = 'builtin_air_split_foundation';
const BUILTIN_PLAN_TITLE = '凯圣王和谭成义三分化训练';
// “我的计划”卡片封面轮换
const PLAN_COVERS = ['dumbbell-rack', 'incline', 'rack', 'dumbbell'];

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

function createDraftExercise(source) {
  const week = source && source.weeks && source.weeks[1] || {};
  return {
    ...(source && source.id && !source.libraryPick ? { id: source.id } : {}),
    name: source && source.name || '',
    targetPart: source && source.targetPart || '',
    sets: String(week.sets || 3),
    reps: week.reps || '10-12',
    note: week.note || '',
    videoUrl: source && source.guide && source.guide.videoUrl || '',
    ...(source && /^\d{4}$/.test(source.libraryId || '') ? { libraryId: source.libraryId, guide: source.guide } : {})
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

// 已保存的计划 -> 编辑草稿
function planToDraft(plan) {
  return {
    title: plan.title || '',
    notice: plan.notice || '',
    days: (plan.days || []).map(day => (day.type === 'rest'
      ? { ...createDraftRestDay(), id: day.id, name: day.name, icon: day.icon, color: day.color, focus: day.focus || '', description: day.description || '', note: day.note || '' }
      : { type: 'training', id: day.id, name: day.name, icon: day.icon, color: day.color, exercises: (day.exercises || []).map(exercise => createDraftExercise(exercise)) }))
  };
}

function decorateDraft(draft) {
  return {
    ...draft,
    days: draft.days.map(day => ({
      ...day,
      shortName: ui.compactDayName(day),
      exercises: (day.exercises || []).map(exercise => ({
        ...exercise,
        image: ui.equipmentImage(exercise.name),
        thumb: (ui.exerciseMedia(exercise) || {}).thumb || '',
        repsLabel: `${exercise.sets || 3} 组 × ${String(exercise.reps || '10-12').replace(/\s*-\s*/, '–')} 次`
      }))
    }))
  };
}

function stripDraft(draft) {
  return {
    ...draft,
    days: draft.days.map(day => ({
      ...day,
      exercises: (day.exercises || []).map(exercise => {
        const { image, thumb, repsLabel, ...rest } = exercise;
        return rest;
      })
    })).map(({ shortName, ...day }) => day)
  };
}

function dayCountLabel(plan) {
  const days = Array.isArray(plan.days) ? plan.days : [];
  const exerciseTotal = days.reduce((sum, day) => sum + (Array.isArray(day.exercises) ? day.exercises.length : 0), 0);
  return `${days.length}天 · ${exerciseTotal}个动作`;
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
    planDraft: createPlanDraft(),
    dateLabel: '',
    selectedDayIndex: 0,
    planSummary: '',
    activePlanCard: null,
    otherPlans: [],
    editingPlanId: '',
    editorTitle: '创建训练计划',
    editorDayIndex: 0,
    subpageOn: true,
    drag: null,
    exerciseSheet: null,
    daySheet: null
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
      selected: 2,
      hidden: !!(this.data.createPlanVisible || this.data.planManagerVisible)
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
      focus: ui.dayFocus(day),
      shortName: ui.compactDayName(day),
      restFocus: day.focus || '',
      restDescription: day.description || '',
      restNote: day.note || '',
      exercises: Array.isArray(day.exercises)
        ? day.exercises.map(exercise => ({
            ...exercise,
            currentPlan: exercise.weeks[VISIBLE_WEEK] || {},
            image: ui.equipmentImage(exercise.name),
            thumb: (ui.exerciseMedia(exercise) || {}).thumb || '',
            repsLabel: `${(exercise.weeks[VISIBLE_WEEK] || {}).sets || 3} 组 × ${String((exercise.weeks[VISIBLE_WEEK] || {}).reps || '').replace(/\s*-\s*/, '–')} 次`
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

    // 默认选中“今天该练的那天”，用户手动切换后保持
    if (this._planIdShown !== plan.id || this.data.selectedDayIndex >= trainingDays.length) {
      const today = util.getToday();
      const records = util.getTrainingDates().map(date => util.getTrainingRecord(date));
      const overview = buildOverview(plan, records, today, '');
      this._planIdShown = plan.id;
      this.setData({ selectedDayIndex: Math.max(0, overview.selectedIndex) });
    }

    const planCard = item => {
      const days = Array.isArray(item.days) ? item.days : [];
      const firstExercise = days.reduce((found, day) => found || (day.exercises || [])[0], null);
      return {
        id: item.id,
        title: getDisplayPlanTitle(item),
        type: item.type,
        summary: dayCountLabel(item),
        notice: item.notice || '',
        image: ui.equipmentImage(firstExercise ? firstExercise.name : '卧推'),
        pills: days.slice(0, 4).map((day, index) => ({ id: day.id, label: `第${index + 1}天`, focus: ui.dayFocus(day) }))
      };
    };

    this.setData({
      dateLabel: util.formatDateCN(util.getToday()).replace(' ', '  '),
      planSummary: dayCountLabel(plan),
      activePlanCard: planCard(plan),
      otherPlans: state.plans.filter(item => item.id !== state.activePlanId).map((item, index) => ({
        ...planCard(item),
        image: `/images/equipment/${PLAN_COVERS[index % PLAN_COVERS.length]}.png`
      })),
      trainingDays,
      notice: plan.notice,
      planTitle: getDisplayPlanTitle(plan),
      planBadge: plan.type === 'builtin' ? '内置参考计划' : '当前启用计划',
      dayCount: trainingDays.length,
      exerciseTotal,
      trainingPlans,
      customPlanCount: state.plans.filter(item => item.type === 'custom').length,
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
      editingPlanId: '',
      editorTitle: '创建训练计划',
      editorDayIndex: 0,
      planDraft: decorateDraft(createPlanDraft())
    });
    this.markDraftClean();
    this.setCustomTabBarHidden(true);
  },

  // 编辑：自定义计划原地修改；内置计划另存为一份自定义计划
  openEditPlan(e) {
    const planId = e.currentTarget.dataset.planId;
    const plan = workoutPlan.getPlanById(planId);
    if (!plan) return;
    const draft = planToDraft(plan);
    if (plan.type === 'builtin') {
      draft.title = `${getDisplayPlanTitle(plan)}（我的）`;
      draft.days = draft.days.map(day => ({ ...day, id: undefined, exercises: (day.exercises || []).map(({ id, ...rest }) => rest) }));
    }
    this.setData({
      planManagerVisible: false,
      createPlanVisible: true,
      editingPlanId: plan.type === 'custom' ? plan.id : '',
      editorTitle: plan.type === 'custom' ? '编辑训练计划' : '另存为我的计划',
      editorDayIndex: 0,
      planDraft: decorateDraft(draft)
    });
    this.markDraftClean();
    this.setCustomTabBarHidden(true);
    if (plan.type === 'builtin') wx.showToast({ title: '内置计划将另存为你的计划', icon: 'none' });
  },

  closeCreatePlan() {
    this.setData({
      subpageOn: true,
      createPlanVisible: false,
      exerciseSheet: null,
      daySheet: null,
      planDraft: createPlanDraft()
    });
    this.setCustomTabBarHidden(false);
  },

  // ---------- 编辑中的计划：关闭前确认，避免侧滑返回丢掉改动 ----------
  markDraftClean() {
    this._draftOrigin = JSON.stringify(stripDraft(this.data.planDraft));
  },

  isDraftDirty() {
    return !!this.data.createPlanVisible && JSON.stringify(stripDraft(this.data.planDraft)) !== this._draftOrigin;
  },

  confirmDiscardDraft(onKeep) {
    wx.showModal({
      title: '放弃编辑？',
      content: '计划的改动还没有保存。',
      confirmText: '放弃',
      confirmColor: '#E06A5F',
      cancelText: '继续编辑',
      success: result => {
        if (result.confirm) this.closeCreatePlan();
        else if (onKeep) onKeep();
      },
      fail: () => { if (onKeep) onKeep(); }
    });
  },

  // 导航栏返回
  requestCloseEditor() {
    if (this.isDraftDirty()) this.confirmDiscardDraft();
    else this.closeCreatePlan();
  },

  // page-container 被侧滑或系统返回关闭：有改动就先确认，选“继续编辑”时重新显示
  onSubpageLeave() {
    if (this.data.createPlanVisible) {
      if (this.isDraftDirty()) {
        this.setData({ subpageOn: false });
        this.confirmDiscardDraft(() => this.setData({ subpageOn: true }));
        return;
      }
      this.closeCreatePlan();
    }
    if (this.data.planManagerVisible) this.closePlanManager();
  },

  selectPlanDay(e) {
    this.setData({ selectedDayIndex: Number(e.currentTarget.dataset.index) });
  },

  startSelectedDay() {
    this.startTraining({ currentTarget: { dataset: { dayIndex: this.data.selectedDayIndex } } });
  },

  selectEditorDay(e) {
    this.setData({ editorDayIndex: Number(e.currentTarget.dataset.index) });
  },

  setDraftDays(days, extra) {
    this.setData({ planDraft: decorateDraft({ ...this.data.planDraft, days }), ...(extra || {}) });
  },

  exerciseMenu(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const exerciseIndex = Number(e.currentTarget.dataset.exerciseIndex);
    wx.showActionSheet({
      itemList: ['上移', '下移', '删除'],
      success: result => {
        if (result.tapIndex === 2) {
          this.removeDraftExercise({ currentTarget: { dataset: { dayIndex, exerciseIndex } } });
          return;
        }
        this.moveDraftExercise(dayIndex, exerciseIndex, result.tapIndex === 0 ? -1 : 1);
      }
    });
  },

  moveDraftExercise(dayIndex, exerciseIndex, delta) {
    const days = stripDraft(this.data.planDraft).days;
    const list = days[dayIndex].exercises;
    const target = exerciseIndex + delta;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(exerciseIndex, 1);
    list.splice(target, 0, item);
    this.setDraftDays(days);
  },

  // ---------- 拖动排序：按住左侧手柄上下拖 ----------
  onGripStart(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const from = Number(e.currentTarget.dataset.exerciseIndex);
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    this._dragStartY = touch.clientY;
    this._dragCount = this.data.planDraft.days[dayIndex].exercises.length;
    this.setData({ drag: { dayIndex, from, to: from, offset: 0, rowH: this._rowH || 76 } });
    if (!this._rowH && typeof wx.createSelectorQuery === 'function') {
      wx.createSelectorQuery().selectAll('.draft-ex').boundingClientRect(rects => {
        if (rects && rects.length > 1) this._rowH = rects[1].top - rects[0].top;
        else if (rects && rects[0]) this._rowH = rects[0].height + 7;
        if (this._rowH && this.data.drag) this.setData({ 'drag.rowH': this._rowH });
      }).exec();
    }
  },

  onGripMove(e) {
    const drag = this.data.drag;
    const touch = e.touches && e.touches[0];
    if (!drag || !touch) return;
    const offset = touch.clientY - this._dragStartY;
    const to = Math.max(0, Math.min(this._dragCount - 1, drag.from + Math.round(offset / drag.rowH)));
    if (Math.abs(offset - drag.offset) < 2 && to === drag.to) return;
    this.setData({ 'drag.offset': offset, 'drag.to': to });
  },

  onGripEnd() {
    const drag = this.data.drag;
    this.setData({ drag: null });
    if (drag && drag.to !== drag.from) this.moveDraftExercise(drag.dayIndex, drag.from, drag.to - drag.from);
  },

  openExerciseSheet(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const exerciseIndex = Number(e.currentTarget.dataset.exerciseIndex);
    const exercise = this.data.planDraft.days[dayIndex].exercises[exerciseIndex];
    this.setData({ exerciseSheet: { dayIndex, exerciseIndex, isNew: false, name: exercise.name, targetPart: exercise.targetPart, sets: exercise.sets, reps: exercise.reps, note: exercise.note, videoUrl: exercise.videoUrl, fromLibrary: !!exercise.libraryId } });
  },

  addManualExercise(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    this.setData({ exerciseSheet: { dayIndex, exerciseIndex: -1, isNew: true, name: '', targetPart: '', sets: '3', reps: '10-12', note: '', videoUrl: '', fromLibrary: false } });
  },

  onExerciseSheetInput(e) {
    this.setData({ [`exerciseSheet.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  stepSheetSets(e) {
    const next = Math.max(1, Math.min(10, (Number(this.data.exerciseSheet.sets) || 3) + Number(e.currentTarget.dataset.delta)));
    this.setData({ 'exerciseSheet.sets': String(next) });
  },

  closeExerciseSheet() {
    this.setData({ exerciseSheet: null });
  },

  saveExerciseSheet() {
    const sheet = this.data.exerciseSheet;
    if (!sheet) return;
    if (!String(sheet.name || '').trim()) {
      wx.showToast({ title: '请填写动作名称', icon: 'none' });
      return;
    }
    const days = stripDraft(this.data.planDraft).days;
    const list = days[sheet.dayIndex].exercises;
    const fields = { name: sheet.name.trim(), targetPart: (sheet.targetPart || '').trim(), sets: String(sheet.sets || 3), reps: (sheet.reps || '').trim() || '10-12', note: sheet.note || '', videoUrl: sheet.videoUrl || '' };
    if (sheet.isNew) {
      if (list.length === 1 && !String(list[0].name || '').trim()) list[0] = { ...createDraftExercise(), ...fields };
      else list.push({ ...createDraftExercise(), ...fields });
    } else {
      list[sheet.exerciseIndex] = { ...list[sheet.exerciseIndex], ...fields };
    }
    this.setDraftDays(days, { exerciseSheet: null });
  },

  openDaySheet(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const day = this.data.planDraft.days[dayIndex];
    this.setData({ daySheet: { dayIndex, type: day.type, name: day.name, focus: day.focus || '', description: day.description || '', note: day.note || '' } });
  },

  onDaySheetInput(e) {
    this.setData({ [`daySheet.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  closeDaySheet() {
    this.setData({ daySheet: null });
  },

  saveDaySheet() {
    const sheet = this.data.daySheet;
    if (!sheet) return;
    const days = stripDraft(this.data.planDraft).days;
    days[sheet.dayIndex] = { ...days[sheet.dayIndex], name: sheet.name, focus: sheet.focus, description: sheet.description, note: sheet.note };
    this.setDraftDays(days, { daySheet: null });
  },

  deleteDaySheet() {
    const sheet = this.data.daySheet;
    if (!sheet) return;
    if (this.data.planDraft.days.length <= 1) {
      wx.showToast({ title: '至少保留 1 个计划日', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除这一天？',
      content: '这一天里的动作也会一起删除。',
      confirmText: '删除',
      confirmColor: '#E06A5F',
      success: result => {
        if (!result.confirm) return;
        const days = stripDraft(this.data.planDraft).days;
        days.splice(sheet.dayIndex, 1);
        this.setDraftDays(days, { daySheet: null, editorDayIndex: Math.max(0, Math.min(this.data.editorDayIndex, days.length - 1)) });
      }
    });
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
      'planDraft.days': days,
      editorDayIndex: days.length - 1
    });
  },

  addDraftRestDay() {
    const days = this.data.planDraft.days.slice();
    days.push(createDraftRestDay());
    this.setData({
      'planDraft.days': days,
      editorDayIndex: days.length - 1
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

  pickLibraryExercise(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const draft = this.data.planDraft;
    if (!draft.days[dayIndex] || draft.days[dayIndex].type === 'rest') return;
    if (app && app.globalData) app.globalData.pickContext = `加入第 ${dayIndex + 1} 天 · ${draft.days[dayIndex].name || '训练日'}`;
    wx.navigateTo({
      url: '/packageExercise/pages/library/library?mode=pick',
      events: {
        exercisePicked: (exercise) => {
          // Ignore events after the editor has been closed or replaced.
          if (!this.data.createPlanVisible || this.data.planDraft !== draft) return;
          const day = draft.days[dayIndex];
          if (!day || day.type === 'rest' || !exercise || !exercise.name) return;
          const exercises = day.exercises.slice();
          const picked = { ...createDraftExercise({ ...exercise, libraryPick: true }), image: ui.equipmentImage(exercise.name), thumb: (ui.exerciseMedia(exercise) || {}).thumb || '', repsLabel: `${(exercise.weeks && exercise.weeks[1] && exercise.weeks[1].sets) || 3} 组 × ${String((exercise.weeks && exercise.weeks[1] && exercise.weeks[1].reps) || '10-12').replace(/\s*-\s*/, '–')} 次` };
          if (exercises.length === 1 && !exercises[0].name.trim()) exercises[0] = picked;
          else exercises.push(picked);
          this.setData({ [`planDraft.days[${dayIndex}].exercises`]: exercises });
        }
      }
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
      exercises: (Array.isArray(day.exercises) ? day.exercises : []).filter(exercise => String(exercise.name || '').trim()).map((exercise, exerciseIndex) => ({
        id: exercise.id || `custom_${dayIndex + 1}_${exerciseIndex + 1}_${util.generateId()}`,
        ...(typeof exercise.libraryId === 'string' && /^\d{4}$/.test(exercise.libraryId) ? { libraryId: exercise.libraryId } : {}),
        name: (exercise.name || '').trim(),
        targetPart: (exercise.targetPart || '').trim(),
        weeks: {
          1: {
            sets: Number(exercise.sets) || 3,
            reps: (exercise.reps || '').trim() || '10-12',
            note: (exercise.note || '').trim()
          }
        },
        guide: exercise.guide ? { ...exercise.guide, videoUrl: sanitizeGuideUrl(exercise.videoUrl) } : {
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
      id: this.data.editingPlanId || `custom_${util.generateId()}`,
      type: 'custom',
      title,
      notice: (draft.notice || '').trim() || '这是你的自定义训练计划，建议按动作质量和恢复节奏持续记录。',
      days
    });

    const wasEditing = !!this.data.editingPlanId;
    app.activateTrainingPlan(savedPlan.id);
    this.setData({
      createPlanVisible: false,
      planManagerVisible: false,
      editingPlanId: '',
      planDraft: createPlanDraft()
    });
    this.setCustomTabBarHidden(false);
    this.loadPlanData();

    wx.showToast({
      title: wasEditing ? '计划已更新' : '自定义计划已启用',
      icon: 'success'
    });
  },

  startTraining(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const day = this.data.trainingDays[dayIndex];

    app.globalData.selectedDayIndex = dayIndex;
    app.globalData.selectedDayId = day ? day.id : '';
    app.globalData.selectedWeek = VISIBLE_WEEK;

    wx.navigateTo({
      url: '/pages/record/record'
    });
  },

  openGuide(e) {
    const dayIndex = Number(e.currentTarget.dataset.dayIndex);
    const exerciseIndex = Number(e.currentTarget.dataset.exerciseIndex);
    const trainingDay = this.data.trainingDays[dayIndex];
    const exercise = trainingDay && trainingDay.exercises ? trainingDay.exercises[exerciseIndex] : null;
    if (exercise && /^\d{4}$/.test(exercise.libraryId || '')) {
      wx.navigateTo({ url: `/packageExercise/pages/detail/detail?id=${exercise.libraryId}` });
      return;
    }
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
