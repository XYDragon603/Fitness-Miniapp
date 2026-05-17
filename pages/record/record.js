const app = getApp();
const util = require('../../utils/util.js');
const workoutPlan = require('../../utils/workout-plan.js');

const REST_DURATION_SECONDS = 90;
const VISIBLE_WEEK = 1;
const DEFAULT_REST_FEELING = '精力不错';

function formatTimerLabel(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const remain = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remain}`;
}

function getDefaultGuide(exerciseName) {
  return {
    exerciseName: exerciseName || '',
    summary: '教学说明会结合动作逐步补充，当前可先按计划备注稳定完成。',
    targetMuscles: [],
    commonMistakes: [],
    tips: [],
    videoTitle: '教学内容稍后补充',
    videoUrl: ''
  };
}

function getDefaultRestTimerData() {
  return {
    restTimerVisible: false,
    restTimerSeconds: REST_DURATION_SECONDS,
    restTimerLabel: formatTimerLabel(REST_DURATION_SECONDS),
    restTimerExerciseName: ''
  };
}

function getDefaultRestForm() {
  return {
    restCompleted: true,
    feeling: DEFAULT_REST_FEELING,
    note: ''
  };
}

function getDefaultRestDayInfo() {
  return {
    id: '',
    name: '休息日',
    description: '恢复也是训练计划的一部分。今天可以轻松活动、拉伸或完全休息。',
    note: '好好恢复，是为了下一次更稳定地训练。',
    color: '#5F9A88'
  };
}

function createEmptySets(setCount) {
  const total = Number.isFinite(setCount) && setCount > 0 ? Math.floor(setCount) : 0;
  return Array.from({ length: total }).map(() => ({
    weight: '',
    reps: '',
    done: false,
    weightInputMode: 'picker',
    repsInputMode: 'picker'
  }));
}

function normalizeValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

function buildPreviousSummary(previousRecord) {
  if (!previousRecord || !previousRecord.exercise || !Array.isArray(previousRecord.exercise.sets)) {
    return '';
  }

  return previousRecord.exercise.sets
    .map(set => {
      const weight = normalizeValue(set && set.weight).trim() || '-';
      const reps = normalizeValue(set && set.reps).trim() || '-';
      return weight === '-' && reps === '-' ? '' : `${weight} x ${reps}`;
    })
    .filter(Boolean)
    .join(' / ');
}

function extractMaxWeightFromSets(sets) {
  return (Array.isArray(sets) ? sets : []).reduce((maxWeight, set) => {
    const value = Number(set && set.weight);
    return Number.isFinite(value) ? Math.max(maxWeight, value) : maxWeight;
  }, 0);
}

function extractWeightAtIndex(sets, index) {
  if (!Array.isArray(sets) || index < 0) {
    return 0;
  }

  const value = Number(sets[index] && sets[index].weight);
  return Number.isFinite(value) ? value : 0;
}

function isRestDay(day) {
  if (typeof util.isRestDay === 'function') {
    return util.isRestDay(day);
  }

  return !!(day && day.type === 'rest');
}

function isRestRecord(record) {
  if (typeof util.isRestRecord === 'function') {
    return util.isRestRecord(record);
  }

  return !!(record && record.type === 'rest');
}

function createRestRecord(day, plan, date, formData) {
  if (typeof util.createRestRecord === 'function') {
    return util.createRestRecord(day, plan, date, formData);
  }

  return {
    date,
    type: 'rest',
    planId: plan && plan.id ? plan.id : '',
    planName: plan && plan.title ? plan.title : '',
    planTitle: plan && plan.title ? plan.title : '',
    dayId: day && day.id ? day.id : '',
    dayType: day && day.id ? day.id : '',
    dayName: day && day.name ? day.name : '休息日',
    dayColor: day && day.color ? day.color : '#5F9A88',
    restCompleted: formData ? !!formData.restCompleted : true,
    feeling: formData && formData.feeling ? formData.feeling : DEFAULT_REST_FEELING,
    note: formData && formData.note ? formData.note : '',
    createdAt: new Date().toISOString(),
    savedAt: new Date().toISOString()
  };
}

Page({
  data: {
    today: '',
    todayStr: '',
    selectedDayIndex: -1,
    selectedDayDisplay: '',
    dayOptions: [],
    currentPlanTitle: '',
    exercises: [],
    currentDayColor: '',
    currentDayInfo: getDefaultRestDayInfo(),
    isRestDay: false,
    restForm: getDefaultRestForm(),
    completedCount: 0,
    progressPercent: 0,
    sessionStatusText: '等待开始',
    sessionProgressText: '0 / 0',
    hasExistingRecord: false,
    previousExerciseMap: {},
    overloadSuggestionMap: {},
    guideVisible: false,
    activeGuide: getDefaultGuide(),
    ...getDefaultRestTimerData()
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.syncCustomTabBar();
    if (this.consumeIncomingSelection()) {
      return;
    }

    this.initPage();
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
      selected: 1,
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

  onHide() {
    this.resetRestTimerState();
    this.setCustomTabBarHidden(false);
  },

  onUnload() {
    this.resetRestTimerState();
    this.setCustomTabBarHidden(false);
  },

  setPagePlan(plan) {
    const safePlan = plan || app.getActiveTrainingPlan();
    this.currentPlan = safePlan;

    const dayOptions = safePlan.days.map(day => ({
      id: day.id,
      name: day.name,
      icon: day.icon,
      color: day.color,
      type: day.type || 'training'
    }));

    this.setData({
      dayOptions,
      currentPlanTitle: safePlan.title || ''
    });
  },

  initPage() {
    const today = util.getToday();
    const existingRecord = util.getTrainingRecord(today);

    this.setData({
      today: util.formatDateCN(today),
      todayStr: today
    });

    if (existingRecord) {
      this.restoreRecord(existingRecord);
      return;
    }

    this.setPagePlan(app.getActiveTrainingPlan());
  },

  consumeIncomingSelection() {
    const selectedDayIndex = app.globalData.selectedDayIndex;
    const selectedDayId = app.globalData.selectedDayId;

    if (selectedDayIndex === undefined || selectedDayIndex === null) {
      return false;
    }

    const existingRecord = util.getTrainingRecord(this.data.todayStr || util.getToday());

    app.globalData.selectedDayIndex = null;
    app.globalData.selectedDayId = '';

    if (existingRecord) {
      this.restoreRecord(existingRecord);
      return true;
    }

    this.setPagePlan(app.getActiveTrainingPlan());
    this.setData({
      selectedDayIndex
    }, () => {
      this.loadExercises(null, selectedDayId);
    });

    return true;
  },

  restoreRecord(record) {
    const plan = workoutPlan.getPlanById(record.planId) || app.getActiveTrainingPlan();
    const dayId = util.getRecordDayId(record);
    const dayIndex = plan.days.findIndex(day => day.id === dayId);

    if (dayIndex < 0) {
      this.setPagePlan(app.getActiveTrainingPlan());
      return;
    }

    this.setPagePlan(plan);
    this.setData({
      selectedDayIndex: dayIndex
    }, () => {
      this.loadExercises(record, dayId);
    });
  },

  selectDay(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      selectedDayIndex: index
    }, () => {
      this.loadExercises();
    });
  },

  getRestProgressData(restForm) {
    const isChecked = !!(restForm && restForm.restCompleted);

    return {
      completedCount: 0,
      progressPercent: isChecked ? 100 : 0,
      sessionProgressText: isChecked ? '已打卡' : '未打卡'
    };
  },

  applyRestForm(nextRestForm) {
    const safeRestForm = {
      ...getDefaultRestForm(),
      ...(nextRestForm || {})
    };

    this.setData({
      restForm: safeRestForm,
      ...this.getRestProgressData(safeRestForm)
    });
  },

  loadRestDayState(day, matchedRecord) {
    const safeDay = {
      ...getDefaultRestDayInfo(),
      ...(day || {})
    };
    const restForm = isRestRecord(matchedRecord)
      ? {
          restCompleted: matchedRecord.restCompleted !== false,
          feeling: matchedRecord.feeling || DEFAULT_REST_FEELING,
          note: matchedRecord.note || ''
        }
      : getDefaultRestForm();

    this.effectiveWeek = VISIBLE_WEEK;
    this.clearRestTimer();

    this.setData({
      isRestDay: true,
      currentDayInfo: safeDay,
      exercises: [],
      currentDayColor: safeDay.color || '#5F9A88',
      selectedDayDisplay: `${safeDay.icon || '🌿'} ${safeDay.name || '休息日'}`,
      sessionStatusText: matchedRecord ? '已保存休息记录' : '等待保存',
      hasExistingRecord: !!matchedRecord,
      previousExerciseMap: {},
      overloadSuggestionMap: {},
      guideVisible: false,
      activeGuide: getDefaultGuide(),
      ...getDefaultRestTimerData(),
      ...this.getRestProgressData(restForm),
      restForm
    });
  },

  loadExercises(savedRecord, preferredDayId) {
    const plan = this.currentPlan || app.getActiveTrainingPlan();
    const dayIndex = this.data.selectedDayIndex;

    if (!plan || dayIndex < 0 || !plan.days[dayIndex]) {
      return;
    }

    const day = plan.days[dayIndex];
    const today = this.data.todayStr || util.getToday();
    const matchedRecord = this.getMatchedRecord(savedRecord, preferredDayId || day.id, today);

    if (isRestDay(day)) {
      this.loadRestDayState(day, matchedRecord);
      return;
    }

    const effectiveWeek = matchedRecord && matchedRecord.week ? matchedRecord.week : VISIBLE_WEEK;
    const savedExerciseMap = this.createSavedExerciseMap(matchedRecord);
    const previousExerciseMap = {};
    const overloadSuggestionMap = {};
    const dayExercises = Array.isArray(day.exercises) ? day.exercises : [];

    const exercises = dayExercises.map(exercisePlan => {
      const weekPlan = exercisePlan.weeks[effectiveWeek] || exercisePlan.weeks[VISIBLE_WEEK];
      const previousRecord = util.getPreviousExerciseRecord(exercisePlan.id, today);
      const overloadSuggestion = util.getProgressiveOverloadSuggestion(exercisePlan.id, today);
      const savedExercise = savedExerciseMap[exercisePlan.id];
      const repsMeta = util.parsePlanRepsMeta(weekPlan.reps, weekPlan.sets);
      const sets = createEmptySets(weekPlan.sets).map((set, setIndex) => {
        const savedSet = savedExercise && Array.isArray(savedExercise.sets) ? savedExercise.sets[setIndex] : null;
        const fallbackReps = repsMeta.suggestedBySet[setIndex] || '';
        const referenceWeight = Math.max(
          extractWeightAtIndex(savedExercise && savedExercise.sets, setIndex),
          extractWeightAtIndex(previousRecord && previousRecord.exercise && previousRecord.exercise.sets, setIndex),
          extractMaxWeightFromSets(savedExercise && savedExercise.sets),
          extractMaxWeightFromSets(previousRecord && previousRecord.exercise && previousRecord.exercise.sets)
        );
        return {
          weight: normalizeValue(savedSet && savedSet.weight),
          reps: normalizeValue(savedSet && savedSet.reps) || fallbackReps,
          done: !!(savedSet && savedSet.done),
          weightOptions: util.buildWeightOptions(referenceWeight),
          weightInputMode: savedSet && savedSet.weightInputMode ? savedSet.weightInputMode : 'picker',
          repsInputMode: savedSet && savedSet.repsInputMode ? savedSet.repsInputMode : (repsMeta.options.length > 0 ? 'picker' : 'input')
        };
      });

      previousExerciseMap[exercisePlan.id] = previousRecord;
      overloadSuggestionMap[exercisePlan.id] = overloadSuggestion;

      return {
        id: exercisePlan.id,
        name: exercisePlan.name,
        targetPart: exercisePlan.targetPart || '',
        planSets: weekPlan.sets,
        planReps: weekPlan.reps,
        note: weekPlan.note,
        guide: exercisePlan.guide || null,
        repsOptions: repsMeta.options,
        previousDate: previousRecord ? previousRecord.date : '',
        previousSummary: buildPreviousSummary(previousRecord),
        overloadSuggestion,
        sets,
        completed: savedExercise
          ? !!savedExercise.completed || (sets.length > 0 && sets.every(set => set.done))
          : false
      };
    });

    this.effectiveWeek = effectiveWeek;
    this.clearRestTimer();

    this.setData({
      isRestDay: false,
      currentDayInfo: getDefaultRestDayInfo(),
      restForm: getDefaultRestForm(),
      exercises,
      currentDayColor: day.color,
      selectedDayDisplay: `${day.icon} ${day.name}`,
      sessionStatusText: matchedRecord ? '已保存记录' : '等待保存',
      hasExistingRecord: !!matchedRecord,
      previousExerciseMap,
      overloadSuggestionMap,
      guideVisible: false,
      activeGuide: getDefaultGuide(),
      ...getDefaultRestTimerData(),
      ...this.getProgressData(exercises)
    });
  },

  getMatchedRecord(candidateRecord, dayId, date) {
    const record = candidateRecord || util.getTrainingRecord(date);
    if (!record) {
      return null;
    }

    return util.getRecordDayId(record) === dayId ? record : null;
  },

  createSavedExerciseMap(record) {
    if (!record || !Array.isArray(record.exercises)) {
      return {};
    }

    return record.exercises.reduce((map, exercise) => {
      if (exercise && exercise.id) {
        map[exercise.id] = exercise;
      }
      return map;
    }, {});
  },

  cloneExercises(exercises) {
    return (exercises || []).map(exercise => ({
      ...exercise,
      sets: Array.isArray(exercise.sets) ? exercise.sets.map(set => ({ ...set })) : []
    }));
  },

  getProgressData(exercises) {
    const completedCount = (exercises || []).filter(item => item.completed).length;
    const total = exercises && exercises.length ? exercises.length : 0;

    return {
      completedCount,
      progressPercent: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      sessionProgressText: `${completedCount} / ${total}`
    };
  },

  commitExercises(exercises) {
    this.setData({
      exercises,
      ...this.getProgressData(exercises)
    });
  },

  onWeightInput(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    exercises[exIndex].sets[setIndex].weight = e.detail.value;
    this.commitExercises(exercises);
  },

  onWeightOptionChange(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const exercise = exercises[exIndex];
    const options = Array.isArray(exercise.sets[setIndex] && exercise.sets[setIndex].weightOptions)
      ? exercise.sets[setIndex].weightOptions
      : [];
    const nextValue = options[Number(e.detail.value)] || '';

    exercise.sets[setIndex].weight = nextValue;
    this.commitExercises(exercises);
  },

  toggleWeightInputMode(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const targetSet = exercises[exIndex].sets[setIndex];

    targetSet.weightInputMode = targetSet.weightInputMode === 'input' ? 'picker' : 'input';
    this.commitExercises(exercises);
  },

  onRepsInput(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    exercises[exIndex].sets[setIndex].reps = e.detail.value;
    this.commitExercises(exercises);
  },

  onRepsOptionChange(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const exercise = exercises[exIndex];
    const options = Array.isArray(exercise.repsOptions) ? exercise.repsOptions : [];
    const nextValue = options[Number(e.detail.value)] || '';

    exercise.sets[setIndex].reps = nextValue;
    this.commitExercises(exercises);
  },

  toggleRepsInputMode(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const targetSet = exercises[exIndex].sets[setIndex];

    targetSet.repsInputMode = targetSet.repsInputMode === 'input' ? 'picker' : 'input';
    this.commitExercises(exercises);
  },

  toggleSetDone(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const exercise = exercises[exIndex];
    const targetSet = exercise.sets[setIndex];

    targetSet.done = !targetSet.done;
    exercise.completed = exercise.sets.length > 0 && exercise.sets.every(set => set.done);
    this.commitExercises(exercises);

    if (targetSet.done) {
      this.startRestTimer(exercise.name);
    }
  },

  toggleComplete(e) {
    const index = Number(e.currentTarget.dataset.index);
    const exercises = this.cloneExercises(this.data.exercises);
    const exercise = exercises[index];
    const nextStatus = !exercise.completed;

    exercise.completed = nextStatus;
    exercise.sets = exercise.sets.map(set => ({
      ...set,
      done: nextStatus
    }));
    this.commitExercises(exercises);
  },

  onRestCompletedChange(e) {
    this.applyRestForm({
      ...this.data.restForm,
      restCompleted: !!e.detail.value
    });
  },

  onRestFeelingSelect(e) {
    this.applyRestForm({
      ...this.data.restForm,
      feeling: e.currentTarget.dataset.value || DEFAULT_REST_FEELING
    });
  },

  onRestNoteInput(e) {
    this.applyRestForm({
      ...this.data.restForm,
      note: e.detail.value
    });
  },

  copyLastWeight(e) {
    const index = Number(e.currentTarget.dataset.index);
    const exercise = this.data.exercises[index];
    const previousRecord = this.data.previousExerciseMap[exercise.id];

    if (!previousRecord || !previousRecord.exercise) {
      wx.showToast({
        title: '暂无可复制的历史重量',
        icon: 'none'
      });
      return;
    }

    const weights = util.copyWeightTemplateFromRecord(previousRecord.exercise, exercise.sets.length);
    const exercises = this.cloneExercises(this.data.exercises);
    exercises[index].sets = exercises[index].sets.map((set, setIndex) => ({
      ...set,
      weight: normalizeValue(weights[setIndex])
    }));
    this.commitExercises(exercises);

    wx.showToast({
      title: '已复制上次重量',
      icon: 'success'
    });
  },

  openGuide(e) {
    const index = Number(e.currentTarget.dataset.index);
    const exercise = this.data.exercises[index];
    const guide = exercise && exercise.guide ? exercise.guide : {};

    this.setData({
      guideVisible: true,
      activeGuide: {
        exerciseName: exercise ? exercise.name : '',
        summary: guide.summary || '教学说明会结合动作逐步补充，当前可先按计划备注稳定完成。',
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

  startRestTimer(exerciseName) {
    this.clearRestTimer();
    this.setCustomTabBarHidden(true);

    let seconds = REST_DURATION_SECONDS;
    this.setData({
      restTimerVisible: true,
      restTimerSeconds: seconds,
      restTimerLabel: formatTimerLabel(seconds),
      restTimerExerciseName: exerciseName || '当前动作'
    });

    this.restTimerId = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        this.clearRestTimer();
        this.setData({
          restTimerVisible: false,
          restTimerSeconds: 0,
          restTimerLabel: '00:00'
        });
        wx.showToast({
          title: '休息结束',
          icon: 'none'
        });
        return;
      }

      this.setData({
        restTimerSeconds: seconds,
        restTimerLabel: formatTimerLabel(seconds)
      });
    }, 1000);
  },

  clearRestTimer() {
    if (this.restTimerId) {
      clearInterval(this.restTimerId);
      this.restTimerId = null;
    }
  },

  resetRestTimerState() {
    this.clearRestTimer();
    this.setCustomTabBarHidden(false);
    this.setData(getDefaultRestTimerData());
  },

  closeRestTimer() {
    this.resetRestTimerState();
  },

  skipRestTimer() {
    this.resetRestTimerState();
  },

  restartRestTimer() {
    this.startRestTimer(this.data.restTimerExerciseName || '当前动作');
  },

  serializeExercises(exercises) {
    return (exercises || []).map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      targetPart: exercise.targetPart,
      planSets: exercise.planSets,
      planReps: exercise.planReps,
      note: exercise.note,
      completed: !!exercise.completed,
      sets: Array.isArray(exercise.sets) ? exercise.sets.map(set => ({
        weight: normalizeValue(set.weight),
        reps: normalizeValue(set.reps),
        done: !!set.done
      })) : []
    }));
  },

  saveRecord() {
    const { exercises, selectedDayIndex, todayStr, isRestDay: isRestDayMode, restForm } = this.data;
    const plan = this.currentPlan || app.getActiveTrainingPlan();
    const effectiveWeek = this.effectiveWeek || VISIBLE_WEEK;

    if (selectedDayIndex < 0 || !plan || !plan.days[selectedDayIndex]) {
      wx.showToast({
        title: '请先选择计划日',
        icon: 'none'
      });
      return;
    }

    const day = plan.days[selectedDayIndex];

    if (isRestDayMode) {
      const record = createRestRecord(day, plan, todayStr, restForm);
      util.saveTrainingRecord(todayStr, record);

      this.setData({
        hasExistingRecord: true,
        sessionStatusText: '已保存休息记录',
        ...this.getRestProgressData(restForm)
      });

      wx.showToast({
        title: '已保存休息记录',
        icon: 'success',
        duration: 1500
      });
      wx.vibrateShort({ type: 'medium' });
      return;
    }

    const record = {
      date: todayStr,
      planId: plan.id,
      planName: plan.title,
      planTitle: plan.title,
      dayId: day.id,
      dayType: day.id,
      dayName: day.name,
      dayColor: day.color,
      week: effectiveWeek,
      exercises: this.serializeExercises(exercises),
      completionRate: this.data.progressPercent,
      savedAt: new Date().toISOString()
    };

    util.saveTrainingRecord(todayStr, record);

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1500
    });

    this.setData({
      hasExistingRecord: true,
      sessionStatusText: '已保存记录'
    });
    wx.vibrateShort({ type: 'medium' });
  },

  noop() {}
});
