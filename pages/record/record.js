const app = getApp();
const util = require('../../utils/util.js');
const progression = require('../../utils/progression.js');
const workoutPlan = require('../../utils/workout-plan.js');
const restTimer = require('../../utils/rest-timer.js');
const ui = require('../../utils/ui-helpers.js');
const nextTarget = require('../../utils/next-target.js');
const setTypes = require('../../utils/set-types.js');

const REST_DURATION_SECONDS = restTimer.DEFAULT_REST_SEC;
const VISIBLE_WEEK = 1;
const DEFAULT_REST_FEELING = '精力不错';

const WEIGHT_STEP = 2.5;
const REPS_STEP = 1;

function formatTimerLabel(seconds) {
  return ui.formatRestLabel(seconds);
}

function formatWeight(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return String(Math.round(num * 10) / 10);
}

// 一次训练里最好的一组：重量优先，其次次数
function bestSetOf(exercise, doneOnly) {
  const sets = exercise && Array.isArray(exercise.sets) ? exercise.sets : [];
  return sets.reduce((best, set) => {
    if (!setTypes.countsForRecord(set) || (doneOnly && !(set && set.done))) return best;
    const weight = Number(set && set.weight) || 0;
    const reps = Number(set && set.reps) || 0;
    if (!reps) return best;
    if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) return { weight, reps };
    return best;
  }, null);
}

function setLabel(set) {
  if (!set) return '';
  return `${set.weight ? formatWeight(set.weight) + ' kg' : '自重'} × ${set.reps}`;
}

function dotDate(dateStr) {
  return String(dateStr || '').replace(/-/g, '.');
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
    restTimerFinished: false,
    restTimerSeconds: REST_DURATION_SECONDS,
    restTimerLabel: formatTimerLabel(REST_DURATION_SECONDS),
    restTimerExerciseName: '',
    restProgress: 1,
    restCaption: '',
    restNext: null
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
    type: 'working',
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

function buildSetWeightOptions(savedSet, previousRecord, setIndex) {
  const referenceWeight = Math.max(
    extractWeightAtIndex(savedSet, setIndex),
    extractWeightAtIndex(previousRecord && previousRecord.exercise && previousRecord.exercise.sets, setIndex),
    extractMaxWeightFromSets(savedSet),
    extractMaxWeightFromSets(previousRecord && previousRecord.exercise && previousRecord.exercise.sets)
  );

  return util.buildWeightOptions(referenceWeight);
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
    currentExIndex: 0,
    exercisePickerVisible: false,
    restDayLabel: '',
    restPresets: restTimer.REST_PRESETS,
    restDefaultSec: REST_DURATION_SECONDS,
    targetView: null,
    supersetOptions: null,
    ...getDefaultRestTimerData()
  },

  onLoad() {
    const storedDuration = Number(wx.getStorageSync('rest_timer_default_sec'));
    this.defaultRestSec = restTimer.REST_PRESETS.includes(storedDuration) ? storedDuration : restTimer.DEFAULT_REST_SEC;
    this.setData({ restDefaultSec: this.defaultRestSec });
    this.initPage();
  },

  onShow() {
    this.syncCustomTabBar();
    const returning = this.pageHidden;
    this.pageHidden = false;
    if (!this.consumeIncomingSelection() && (!returning || this.data.todayStr !== util.getToday())) {
      this.initPage();
    }
    this.resumeRestTimer();
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
      hidden: !!(this.data.restTimerVisible || this.data.guideVisible)
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
    this.pageHidden = true;
    this.clearRestTimer();
    this.clearRestDismissTimer();
    this.setRestKeepScreenOn(false);
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
    this._baselineToday = existingRecord || null;

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

    const plan = app.getActiveTrainingPlan();
    const targetIndex = selectedDayId ? plan.days.findIndex(day => day.id === selectedDayId) : Number(selectedDayIndex);
    const target = plan.days[targetIndex];
    if (!target) return false;
    if (existingRecord && util.getRecordDayId(existingRecord) === target.id
      && (!existingRecord.planId || existingRecord.planId === plan.id)) {
      this.restoreRecord(existingRecord);
      return true;
    }

    this.setPagePlan(plan);
    this.setData({
      selectedDayIndex: targetIndex
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
    this.resetRestTimerState();
    this.applyStatusBar(false);
    const restPlan = this.currentPlan || app.getActiveTrainingPlan();
    const dayNumber = restPlan && restPlan.days ? restPlan.days.findIndex(item => item.id === safeDay.id) + 1 : 0;

    this.setData({
      isRestDay: true,
      restDayLabel: `${dayNumber > 0 ? '第 ' + dayNumber + ' 天 · ' : ''}${safeDay.name || '休息日'}`,
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
    const pairGroups = (wx.getStorageSync('training_supersets') || {})[`${plan.id}:${day.id}`] || [];

    const exercises = dayExercises.map(exercisePlan => {
      const weekPlan = exercisePlan.weeks[effectiveWeek] || exercisePlan.weeks[VISIBLE_WEEK];
      const history = util.getPreviousExerciseRecords(exercisePlan.id, today, 2, exercisePlan.libraryId);
      const previousRecord = history[0] || (!exercisePlan.libraryId ? util.getPreviousExerciseRecord(exercisePlan.id, today) : null);
      const suggestion = progression.suggestNextTarget({ planReps: weekPlan.reps, planSets: weekPlan.sets, history });
      const overloadSuggestion = { ...suggestion, show: suggestion.type !== 'none' };
      const savedExercise = savedExerciseMap[exercisePlan.id];
      const target = savedExercise ? null : nextTarget.getNextTarget(exercisePlan.libraryId || exercisePlan.id);
      const repsMeta = util.parsePlanRepsMeta(weekPlan.reps, weekPlan.sets);
      const previousBest = bestSetOf(previousRecord && previousRecord.exercise);
      const pairGroup = pairGroups.find(group => Array.isArray(group) && group.length === 2 && group.includes(exercisePlan.id)
        && group.every(id => dayExercises.some(item => item.id === id)));
      const supersetId = savedExercise && savedExercise.supersetId || (pairGroup ? pairGroup.slice().sort().join(':') : '');
      const sets = (savedExercise && Array.isArray(savedExercise.sets) && savedExercise.sets.length
        ? savedExercise.sets : createEmptySets(weekPlan.sets)).map((set, setIndex) => {
        const savedSet = savedExercise && Array.isArray(savedExercise.sets) ? savedExercise.sets[setIndex] : null;
        const fallbackReps = repsMeta.suggestedBySet[setIndex] || '';
        const targetWeight = target && target.weights[setIndex] !== undefined ? target.weights[setIndex] : '';
        const targetReps = target && target.repsBySet[setIndex] !== undefined ? target.repsBySet[setIndex] : '';
        const previousSet = previousRecord && previousRecord.exercise && Array.isArray(previousRecord.exercise.sets)
          ? previousRecord.exercise.sets[setIndex] : null;
        return {
          type: setTypes.typeOf(savedSet || (supersetId ? { type: 'superset' } : set)),
          typeLabel: setTypes.LABELS[setTypes.typeOf(savedSet || (supersetId ? { type: 'superset' } : set))],
          weight: normalizeValue(savedSet && savedSet.weight) || normalizeValue(targetWeight),
          reps: normalizeValue(savedSet && savedSet.reps) || normalizeValue(targetReps) || fallbackReps,
          weightHint: previousSet && normalizeValue(previousSet.weight) ? normalizeValue(previousSet.weight) : '',
          done: !!(savedSet && savedSet.done),
          previousSetLabel: this.getPreviousSetLabel(previousRecord, setIndex),
          weightOptions: buildSetWeightOptions(savedExercise && savedExercise.sets, previousRecord, setIndex),
          weightInputMode: savedSet && savedSet.weightInputMode ? savedSet.weightInputMode : 'picker',
          repsInputMode: savedSet && savedSet.repsInputMode ? savedSet.repsInputMode : (repsMeta.options.length > 0 ? 'picker' : 'input')
        };
      });

      previousExerciseMap[exercisePlan.id] = previousRecord;
      overloadSuggestionMap[exercisePlan.id] = overloadSuggestion;

      return {
        id: exercisePlan.id,
        supersetId,
        supersetLabel: supersetId ? '超级组 · 两个动作交替' : '',
        ...(exercisePlan.libraryId ? { libraryId: exercisePlan.libraryId } : {}),
        name: exercisePlan.name,
        targetPart: exercisePlan.targetPart || '',
        planSets: weekPlan.sets,
        planReps: weekPlan.reps,
        note: weekPlan.note,
        guide: exercisePlan.guide || null,
        repsOptions: repsMeta.options,
        previousDate: previousRecord ? previousRecord.date : '',
        previousDateLabel: previousRecord ? util.formatDateCN(previousRecord.date) : '',
        previousSummary: buildPreviousSummary(previousRecord),
        previousBestLabel: previousBest ? setLabel(previousBest) : '',
        image: ui.equipmentImage(exercisePlan.name),
        gif: (ui.exerciseMedia(exercisePlan) || {}).gif || '',
        thumb: (ui.exerciseMedia(exercisePlan) || {}).thumb || '',
        repsLabel: `${weekPlan.sets} 组 × ${String(weekPlan.reps).replace(/\s*-\s*/, '–')} 次`,
        overloadSuggestion,
        sets,
        activeSetIndex: sets.findIndex(set => !set.done),
        completed: savedExercise
          ? !!savedExercise.completed || (sets.length > 0 && sets.every(set => set.done))
          : false
      };
    });

    this.effectiveWeek = effectiveWeek;
    this._pendingTargets = [];
    this.sessionStartedAt = matchedRecord && matchedRecord.startedAt ? matchedRecord.startedAt : '';
    this.resetRestTimerState();
    this.applyStatusBar(true);
    const firstOpen = exercises.findIndex(item => !item.completed);

    this.setData({
      isRestDay: false,
      currentExIndex: firstOpen >= 0 ? firstOpen : Math.max(0, exercises.length - 1),
      targetView: null,
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
    if (record.planId && this.currentPlan && record.planId !== this.currentPlan.id) return null;

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
      sessionProgressText: `${completedCount} / ${total}`,
      activeExerciseId: ((exercises || []).find(item => (item.sets || []).some(set => !set.done)) || {}).id || ''
    };
  },

  commitExercises(exercises) {
    exercises = exercises.map(exercise => ({ ...exercise, activeSetIndex: exercise.sets.findIndex(set => !set.done),
      sets: exercise.sets.map(set => ({ ...set, type: setTypes.typeOf(set), typeLabel: setTypes.LABELS[setTypes.typeOf(set)] })) }));
    this.setData({
      exercises,
      ...this.getProgressData(exercises)
    });
  },

  onWeightInput(e) {
    const { exIndex, setIndex } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const exercise = exercises[exIndex];
    const targetSet = exercise.sets[setIndex];

    targetSet.weight = e.detail.value;
    targetSet.weightOptions = util.buildWeightOptions(targetSet.weight);
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
    exercise.sets[setIndex].weightOptions = util.buildWeightOptions(nextValue);
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
    if (!targetSet) return;
    if (!targetSet.done && (!(Number(targetSet.reps) > 0) || !Number.isInteger(Number(targetSet.reps))
      || !Number.isFinite(Number(targetSet.weight || 0)) || Number(targetSet.weight || 0) < 0)) {
      wx.showToast({ title: '请填写有效重量和次数', icon: 'none' }); return;
    }

    targetSet.done = !targetSet.done;
    if (targetSet.done && !this.sessionStartedAt) this.sessionStartedAt = new Date().toISOString();
    exercise.completed = exercise.sets.length > 0 && exercise.sets.every(set => set.done);
    this.commitExercises(exercises);
    this.autoSave();

    const partnerIndex = targetSet.done && setTypes.countsForProgression(targetSet)
      ? setTypes.nextSupersetExercise(exercises, Number(exIndex)) : -1;
    if (partnerIndex >= 0) {
      if (exercise.completed) this._pendingTargets = [...new Set((this._pendingTargets || []).concat(Number(exIndex)))];
      const count = item => item.sets.filter(set => set.done && setTypes.countsForProgression(set)).length;
      this.setData({ currentExIndex: partnerIndex });
      if (count(exercise) <= count(exercises[partnerIndex])) {
        const nextIndex = exercises[partnerIndex].sets.findIndex(set => !set.done);
        this.startRestTimer(exercises[partnerIndex].name, partnerIndex, nextIndex - 1);
      }
      return;
    }

    if (targetSet.done && Number(setIndex) < exercise.sets.length - 1 && !this.data.isRestDay) {
      this.startRestTimer(exercise.name, Number(exIndex), Number(setIndex));
    } else if (targetSet.done && exercise.completed && !this.data.isRestDay) {
      const targets = [...new Set((this._pendingTargets || []).concat(Number(exIndex)))];
      this._pendingTargets = targets.slice(1);
      this.openTargetView(targets[0]);
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

    const workingSets = exercise.sets.filter(setTypes.countsForProgression);
    const weights = util.copyWeightTemplateFromRecord({ ...previousRecord.exercise,
      sets: (previousRecord.exercise.sets || []).filter(setTypes.countsForProgression) }, workingSets.length);
    const exercises = this.cloneExercises(this.data.exercises);
    let workingIndex = -1;
    exercises[index].sets = exercises[index].sets.map(set => setTypes.countsForProgression(set)
      ? { ...set, weight: normalizeValue(weights[++workingIndex]) } : set);
    this.commitExercises(exercises);

    wx.showToast({
      title: '已复制上次重量',
      icon: 'success'
    });
  },

  openGuide(e) {
    const index = Number(e.currentTarget.dataset.index);
    const exercise = this.data.exercises[index];
    if (exercise && exercise.libraryId) {
      wx.navigateTo({ url: `/packageExercise/pages/detail/detail?id=${exercise.libraryId}` });
      return;
    }
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

  startRestTimer(exerciseName, exIndex, setIndex) {
    if (this.data.isRestDay) return;
    const restExercise = this.data.exercises[exIndex];
    const nextSet = restExercise && restExercise.sets[setIndex + 1];
    const restMeta = restExercise ? {
      restCaption: `${restExercise.name} · 第 ${setIndex + 1} / ${restExercise.sets.length} 组已完成`,
      restCaptionDone: setIndex + 1,
      restNext: nextSet ? {
        name: restExercise.name,
        image: restExercise.thumb || restExercise.image,
        isMedia: !!restExercise.thumb,
        label: `${nextSet.weight ? formatWeight(nextSet.weight) + ' kg' : '自重'} × ${nextSet.reps || '-'} 次`
      } : null
    } : {};
    this.clearRestTimer();
    this.clearRestDismissTimer();
    this.restFinishedAt = null;
    this.setCustomTabBarHidden(true);

    const seconds = this.defaultRestSec || REST_DURATION_SECONDS;
    this.activeRestTimer = restTimer.createTimer(seconds, Date.now());
    this.setData({
      restTimerVisible: true,
      restTimerFinished: false,
      restTimerSeconds: seconds,
      restTimerLabel: formatTimerLabel(seconds),
      restTimerExerciseName: exerciseName || '当前动作',
      restProgress: 1,
      ...restMeta
    });

    this.resumeRestTimer();
  },

  getPreviousSetLabel(previousRecord, index) {
    const previous = previousRecord && previousRecord.exercise && previousRecord.exercise.sets;
    const set = Array.isArray(previous) ? previous[index] : null;
    if (!set || normalizeValue(set.reps).trim() === '') return '';
    const weight = normalizeValue(set.weight).trim();
    return `上次 ${weight === '' || Number(weight) === 0 ? '自重' : weight + 'kg'} × ${set.reps}`;
  },

  setRestKeepScreenOn(keepScreenOn) {
    if (typeof wx.setKeepScreenOn === 'function') wx.setKeepScreenOn({ keepScreenOn });
  },

  resumeRestTimer() {
    this.clearRestTimer();
    if (!this.activeRestTimer || this.data.isRestDay) return;
    this.setCustomTabBarHidden(true);
    if (this.restFinishedAt !== null && this.restFinishedAt !== undefined) {
      this.scheduleRestDismiss();
      return;
    }
    this.tickRestTimer();
    if (!this.data.restTimerFinished && this.activeRestTimer) {
      this.setRestKeepScreenOn(true);
      this.restTimerId = setInterval(() => this.tickRestTimer(), 1000);
    }
  },

  tickRestTimer() {
    const seconds = restTimer.getRemaining(this.activeRestTimer, Date.now());
    if (seconds === 0) {
      this.finishRestTimer();
      return;
    }
    // Do not resend exercises or other page state every second.
    const total = this.activeRestTimer && this.activeRestTimer.durationSec ? this.activeRestTimer.durationSec : (this.defaultRestSec || REST_DURATION_SECONDS);
    this.setData({ restTimerLabel: formatTimerLabel(seconds), restProgress: Math.max(0, Math.min(1, seconds / total)) });
  },

  finishRestTimer() {
    if (this.data.restTimerFinished || !this.activeRestTimer) return;
    this.clearRestTimer();
    this.setRestKeepScreenOn(false);
    this.restFinishedAt = Date.now();
    this.setData({ restTimerFinished: true, restTimerLabel: '休息结束 · 开始下一组', restProgress: 0 });
    if (typeof wx.vibrateLong === 'function') wx.vibrateLong();
    this.scheduleRestDismiss();
  },

  scheduleRestDismiss() {
    this.clearRestDismissTimer();
    const delay = Math.max(0, 3000 - (Date.now() - this.restFinishedAt));
    if (!delay) this.resetRestTimerState();
    else this.restDismissTimerId = setTimeout(() => this.resetRestTimerState(), delay);
  },

  clearRestDismissTimer() {
    if (this.restDismissTimerId !== undefined && this.restDismissTimerId !== null) {
      clearTimeout(this.restDismissTimerId);
      this.restDismissTimerId = null;
    }
  },

  adjustRestTimer(e) {
    if (!this.activeRestTimer || this.data.restTimerFinished) return;
    const delta = Number(e.currentTarget.dataset.delta);
    if (delta !== -15 && delta !== 15) return;
    this.activeRestTimer = restTimer.adjust(this.activeRestTimer, delta, Date.now());
    this.tickRestTimer();
  },

  chooseRestPreset() {
    wx.showActionSheet({
      itemList: restTimer.REST_PRESETS.map(seconds => `${seconds} 秒`),
      success: result => {
        const seconds = restTimer.REST_PRESETS[result.tapIndex];
        if (!seconds) return;
        this.defaultRestSec = seconds;
        wx.setStorageSync('rest_timer_default_sec', seconds);
        this.setData({ restDefaultSec: seconds });
        if (this.data.restTimerVisible && !this.data.restTimerFinished) this.restartRestTimer();
      }
    });
  },

  clearRestTimer() {
    if (this.restTimerId !== undefined && this.restTimerId !== null) {
      clearInterval(this.restTimerId);
      this.restTimerId = null;
    }
  },

  resetRestTimerState() {
    this.clearRestTimer();
    this.clearRestDismissTimer();
    this.activeRestTimer = null;
    this.restFinishedAt = null;
    this.setRestKeepScreenOn(false);
    this.setCustomTabBarHidden(!!this.data.guideVisible);
    this.setData(getDefaultRestTimerData());
  },

  closeRestTimer() {
    this.resetRestTimerState();
  },

  skipRestTimer() {
    this.resetRestTimerState();
  },

  restartRestTimer() {
    this.clearRestTimer();
    this.clearRestDismissTimer();
    this.restFinishedAt = null;
    const seconds = this.defaultRestSec || REST_DURATION_SECONDS;
    this.activeRestTimer = restTimer.createTimer(seconds, Date.now());
    this.setData({ restTimerVisible: true, restTimerFinished: false, restTimerSeconds: seconds, restTimerLabel: formatTimerLabel(seconds), restProgress: 1 });
    this.resumeRestTimer();
  },

  serializeExercises(exercises) {
    return (exercises || []).map(exercise => ({
      id: exercise.id,
      ...(exercise.supersetId ? { supersetId: exercise.supersetId } : {}),
      ...(exercise.libraryId ? { libraryId: exercise.libraryId } : {}),
      name: exercise.name,
      targetPart: exercise.targetPart,
      planSets: exercise.planSets,
      planReps: exercise.planReps,
      note: exercise.note,
      completed: !!exercise.completed,
      sets: Array.isArray(exercise.sets) ? exercise.sets.map(set => ({
        weight: normalizeValue(set.weight),
        reps: normalizeValue(set.reps),
        done: !!set.done,
        ...(setTypes.typeOf(set) !== 'working' ? { type: setTypes.typeOf(set) } : {})
      })) : []
    }));
  },

  saveRecord(confirmedReplacement, onSaved) {
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
    const priorToday = util.getTrainingRecord(todayStr);
    if (confirmedReplacement !== true && priorToday
      && (util.getRecordDayId(priorToday) !== day.id || (priorToday.planId && priorToday.planId !== plan.id))) {
      if (this._saveConfirmation) return;
      this._saveConfirmation = true;
      wx.showModal({
        title: '替换今日记录？',
        content: `今天已保存“${priorToday.dayName || '训练'}”。每天保留一份记录，继续保存会替换它。`,
        confirmText: '替换保存',
        success: result => { this._saveConfirmation = false; if (result.confirm) this.saveRecord(true, onSaved); },
        fail: () => { this._saveConfirmation = false; }
      });
      return;
    }

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

    const record = this.buildTrainingRecord(plan, day, effectiveWeek);

    // 对比“打开页面时”的当天记录（自动保存不算），同样的成绩再次保存不会重复提示新纪录。
    const priorRecords = this.getPriorRecords();
    const newRecords = record.exercises.flatMap(exercise => progression.detectNewRecords(exercise,
      progression.findPersonalRecords(priorRecords, exercise.libraryId || exercise.id, record.exercises)));
    util.saveTrainingRecord(todayStr, record);
    this._baselineToday = record;

    wx.showToast({
      title: newRecords.length ? '新纪录 🎉' : '保存成功',
      icon: 'success',
      duration: 1500
    });

    this.setData({
      hasExistingRecord: true,
      sessionStatusText: '已保存记录'
    });
    wx.vibrateShort({ type: 'medium' });
    if (typeof onSaved === 'function') onSaved(record);
  },

  adoptSuggestion(e) {
    const index = Number(e.currentTarget.dataset.index);
    const exercise = this.data.exercises[index];
    const suggestion = exercise && exercise.overloadSuggestion;
    if (!suggestion || !suggestion.show) return;
    const exercises = this.cloneExercises(this.data.exercises);
    let workingIndex = -1;
    exercises[index].sets = exercises[index].sets.map(set => {
      if (!setTypes.countsForProgression(set)) return set;
      const setIndex = ++workingIndex;
      return set.done ? set : ({
      ...set,
      weight: String(suggestion.weights[setIndex] === undefined ? suggestion.weight : suggestion.weights[setIndex]),
      reps: String(suggestion.repsBySet[setIndex] === undefined ? suggestion.reps : suggestion.repsBySet[setIndex]),
      weightInputMode: 'input', repsInputMode: 'input'
    }); });
    this.commitExercises(exercises);
    wx.showToast({ title: '已填入未完成组', icon: 'success' });
  },

  buildTrainingRecord(plan, day, week) {
    return {
      date: this.data.todayStr,
      planId: plan.id,
      planName: plan.title,
      planTitle: plan.title,
      dayId: day.id,
      dayType: day.id,
      dayName: day.name,
      dayColor: day.color,
      week: week || this.effectiveWeek || VISIBLE_WEEK,
      exercises: this.serializeExercises(this.data.exercises),
      completionRate: this.data.progressPercent,
      ...this.getDurationFields(),
      savedAt: new Date().toISOString()
    };
  },

  getPriorRecords() {
    const today = this.data.todayStr;
    return util.getTrainingDates()
      .filter(date => date !== today)
      .map(date => util.getTrainingRecord(date))
      .filter(Boolean)
      .concat(this._baselineToday ? [this._baselineToday] : []);
  },

  getDurationFields() {
    if (!this.sessionStartedAt) return {};
    const finishedAt = new Date().toISOString();
    const minutes = Math.max(1, Math.round((new Date(finishedAt) - new Date(this.sessionStartedAt)) / 60000));
    return { startedAt: this.sessionStartedAt, finishedAt, durationMin: minutes };
  },

  // 每完成一组就静默保存；当天已有其他训练日的记录时不覆盖，等用户结束训练时再确认替换
  autoSave() {
    const { selectedDayIndex, todayStr, isRestDay: restMode } = this.data;
    const plan = this.currentPlan || app.getActiveTrainingPlan();
    if (restMode || selectedDayIndex < 0 || !plan || !plan.days[selectedDayIndex] || !todayStr) return;
    const day = plan.days[selectedDayIndex];
    const prior = util.getTrainingRecord(todayStr);
    if (prior && (util.getRecordDayId(prior) !== day.id || (prior.planId && prior.planId !== plan.id))) return;
    util.saveTrainingRecord(todayStr, this.buildTrainingRecord(plan, day));
    this.setData({ hasExistingRecord: true });
  },

  applyStatusBar(dark) {
    if (typeof wx.setNavigationBarColor !== 'function') return;
    wx.setNavigationBarColor({
      frontColor: dark ? '#ffffff' : '#000000',
      backgroundColor: dark ? '#0E1416' : '#F6F4EE',
      fail() {}
    });
  },

  // ---------- 单个动作视图 ----------
  stepValue(e) {
    const { exIndex, setIndex, field, delta } = e.currentTarget.dataset;
    const exercises = this.cloneExercises(this.data.exercises);
    const exercise = exercises[exIndex];
    const set = exercise && exercise.sets[setIndex];
    if (!set) return;
    const step = Number(delta) * (field === 'weight' ? WEIGHT_STEP : REPS_STEP);
    const fallback = field === 'weight'
      ? Number(set.weightHint) || Number(setIndex > 0 && exercise.sets[setIndex - 1].weight) || 0
      : Number(setIndex > 0 && exercise.sets[setIndex - 1].reps) || 0;
    const current = set[field] === '' ? fallback : Number(set[field]) || 0;
    const next = Math.max(0, current + (set[field] === '' && fallback ? 0 : step));
    set[field] = field === 'weight' ? formatWeight(next) : String(Math.round(next));
    if (field === 'weight') set.weightInputMode = 'input';
    else set.repsInputMode = 'input';
    this.commitExercises(exercises);
  },

  completeCurrentSet() {
    const exIndex = this.data.currentExIndex;
    const exercise = this.data.exercises[exIndex];
    if (!exercise) return;
    const setIndex = exercise.sets.findIndex(set => !set.done);
    if (setIndex < 0) {
      this.goNextExercise();
      return;
    }
    const set = exercise.sets[setIndex];
    if (String(set.reps).trim() === '') {
      wx.showToast({ title: '先填写这一组的次数', icon: 'none' });
      return;
    }
    this.toggleSetDone({ currentTarget: { dataset: { exIndex, setIndex } } });
  },

  goNextExercise() {
    const exercises = this.data.exercises;
    const after = exercises.findIndex((item, index) => index > this.data.currentExIndex && !item.completed);
    const anyOpen = after >= 0 ? after : exercises.findIndex(item => !item.completed);
    if (anyOpen < 0) {
      this.finishWorkout();
      return;
    }
    this.setData({ currentExIndex: anyOpen });
  },

  chooseExercise() {
    if (this.data.exercises.length > 1) this.setData({ exercisePickerVisible: true });
  },
  closeExercisePicker() { this.setData({ exercisePickerVisible: false }); },
  pickExercise(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isInteger(index) && this.data.exercises[index]) this.setData({ currentExIndex: index, exercisePickerVisible: false });
  },

  openCurrentGuide() {
    this.openGuide({ currentTarget: { dataset: { index: this.data.currentExIndex } } });
  },

  copyCurrentLast() {
    this.copyLastWeight({ currentTarget: { dataset: { index: this.data.currentExIndex } } });
  },

  // ---------- 组间休息 ----------
  pickRestPreset(e) {
    const seconds = Number(e.currentTarget.dataset.seconds);
    if (!restTimer.REST_PRESETS.includes(seconds)) return;
    this.defaultRestSec = seconds;
    this.setData({ restDefaultSec: seconds });
    if (this.data.restTimerVisible) this.restartRestTimer();
  },

  saveRestPreset(e) {
    const seconds = Number(e.currentTarget.dataset.seconds);
    if (!restTimer.REST_PRESETS.includes(seconds)) return;
    this.defaultRestSec = seconds;
    wx.setStorageSync('rest_timer_default_sec', seconds);
    this.setData({ restDefaultSec: seconds });
    wx.showToast({ title: `默认休息 ${seconds} 秒`, icon: 'none' });
  },

  // ---------- 下一组目标（一个动作做完后） ----------
  openTargetView(exIndex) {
    const exercise = this.data.exercises[exIndex];
    if (!exercise) return;
    const previous = this.data.previousExerciseMap[exercise.id];
    const thisSession = { date: this.data.todayStr, exercise: this.serializeExercises([exercise])[0] };
    const history = [thisSession].concat(previous ? [previous] : []);
    const suggestion = progression.suggestNextTarget({ planReps: exercise.planReps, planSets: exercise.planSets, history });
    const best = bestSetOf(exercise, true);
    const previousBest = bestSetOf(previous && previous.exercise);
    const priorPRs = progression.findPersonalRecords(this.getPriorRecords(), exercise.libraryId || exercise.id, [exercise]);
    const prs = progression.detectNewRecords(thisSession.exercise, priorPRs);
    const weightPR = prs.find(item => item.type === 'bestWeight');
    const hasWeight = suggestion.type !== 'none' && suggestion.weight !== null && suggestion.weight !== undefined;

    this.clearRestTimer();
    this.setData({
      targetView: {
        exIndex,
        name: exercise.name,
        repsLabel: exercise.repsLabel,
        image: exercise.thumb || exercise.image,
        isMedia: !!exercise.thumb,
        previous: previousBest ? { label: setLabel(previousBest), weight: formatWeight(previousBest.weight), reps: previousBest.reps, date: dotDate(previous.date) } : null,
        current: best ? { weight: formatWeight(best.weight), reps: best.reps, isBodyweight: !best.weight, date: dotDate(this.data.todayStr) } : null,
        suggestion: {
          show: hasWeight,
          weight: hasWeight ? formatWeight(suggestion.weight) : '',
          isBodyweight: hasWeight && !Number(suggestion.weight),
          reps: String(exercise.planReps).replace(/\s*-\s*/, '-'),
          message: suggestion.message || ''
        },
        weights: suggestion.weights || [],
        repsBySet: suggestion.repsBySet || [],
        pr: weightPR ? {
          gain: priorPRs.bestWeight ? formatWeight(weightPR.weight - priorPRs.bestWeight.weight) : '',
          weight: formatWeight(weightPR.weight)
        } : null
      }
    });
  },

  adoptNextTarget() {
    const view = this.data.targetView;
    if (!view) return;
    const exercise = this.data.exercises[view.exIndex];
    if (view.suggestion.show && exercise) {
      nextTarget.saveNextTarget(exercise.libraryId || exercise.id, { weights: view.weights, repsBySet: view.repsBySet, source: 'suggestion' });
      wx.showToast({ title: '下次将按建议预填', icon: 'none' });
    }
    this.closeTargetView();
  },

  keepCurrentTarget() {
    const view = this.data.targetView;
    const exercise = view ? this.data.exercises[view.exIndex] : null;
    if (exercise) {
      nextTarget.saveNextTarget(exercise.libraryId || exercise.id, {
        weights: exercise.sets.filter(setTypes.countsForProgression).map(set => set.weight),
        repsBySet: exercise.sets.filter(setTypes.countsForProgression).map(set => set.reps),
        source: 'keep'
      });
    }
    this.closeTargetView();
  },

  closeTargetView() {
    this.setData({ targetView: null });
    if (this._pendingTargets && this._pendingTargets.length) { this.openTargetView(this._pendingTargets.shift()); return; }
    this.goNextExercise();
  },

  dismissTargetView() {
    this.setData({ targetView: null });
  },

  finishWorkout() {
    if (this.data.isRestDay) return;
    this.saveRecord(false, () => wx.redirectTo({ url: `/pages/report/report?date=${this.data.todayStr}` }));
  },

  openProgress() {
    const exercise = this.data.exercises[this.data.currentExIndex];
    if (exercise) wx.navigateTo({ url: `/pages/exercise-progress/progress?key=${encodeURIComponent(ui.exerciseKey(exercise))}&name=${encodeURIComponent(exercise.name)}` });
  },

  setTypeMenu(event) {
    const { exIndex, setIndex } = event.currentTarget.dataset;
    const exercise = this.data.exercises[exIndex];
    if (!exercise || !exercise.sets[setIndex]) return;
    wx.showActionSheet({ itemList: ['正式组', '热身组（不计纪录）', '递减组', '删除这一组'], success: result => {
      const exercises = this.cloneExercises(this.data.exercises);
      if (result.tapIndex === 3) {
        if (exercises[exIndex].sets.length <= 1) { wx.showToast({ title: '至少保留一组', icon: 'none' }); return; }
        exercises[exIndex].sets.splice(setIndex, 1);
      } else exercises[exIndex].sets[setIndex].type = result.tapIndex === 0 && exercise.supersetId ? 'superset' : ['working', 'warmup', 'drop'][result.tapIndex];
      exercises[exIndex].completed = exercises[exIndex].sets.every(set => set.done);
      this.commitExercises(exercises); this.autoSave();
    } });
  },

  addSet() {
    wx.showActionSheet({ itemList: ['添加正式组', '添加热身组', '添加递减组'], success: result => {
      const exercises = this.cloneExercises(this.data.exercises);
      const exercise = exercises[this.data.currentExIndex]; if (!exercise) return;
      const type = ['working', 'warmup', 'drop'][result.tapIndex];
      const previous = exercise.sets[exercise.sets.length - 1] || {};
      const set = { ...createEmptySets(1)[0], type: type === 'working' && exercise.supersetId ? 'superset' : type,
        weight: type === 'drop' && Number(previous.weight) > 0 ? formatWeight(Number(previous.weight) * .8) : '', reps: previous.reps || '' };
      if (type === 'warmup') exercise.sets.unshift(set); else exercise.sets.push(set);
      exercise.completed = false; this.commitExercises(exercises); this.autoSave();
    } });
  },

  chooseSuperset() {
    const current = this.data.currentExIndex;
    this.setData({ supersetOptions: this.data.exercises.map((item, index) => ({ index, name: item.name })).filter(item => item.index !== current) });
  },
  closeSuperset() { this.setData({ supersetOptions: null }); },
  pairSuperset(event) {
    const partner = Number(event.currentTarget.dataset.index);
    const current = this.data.currentExIndex;
    const exercises = this.cloneExercises(this.data.exercises);
    if (!exercises[current] || (partner >= 0 && !exercises[partner]) || current === partner) return;
    const ids = [exercises[current].id, ...(partner >= 0 ? [exercises[partner].id] : [])];
    const groups = wx.getStorageSync('training_supersets') || {};
    const key = `${this.currentPlan.id}:${this.currentPlan.days[this.data.selectedDayIndex].id}`;
    const pairs = (groups[key] || []).filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(id => exercises.some(item => item.id === id)) && !pair.some(id => ids.includes(id)));
    if (partner >= 0) pairs.push(ids);
    wx.setStorageSync('training_supersets', { ...groups, [key]: pairs });
    exercises.forEach(exercise => {
      const pair = pairs.find(item => item.includes(exercise.id));
      exercise.supersetId = pair ? pair.slice().sort().join(':') : '';
      exercise.supersetLabel = pair ? '交替：' + exercises.find(item => item.id === pair.find(id => id !== exercise.id)).name : '';
      exercise.sets = exercise.sets.map(set => ['working', 'superset'].includes(setTypes.typeOf(set)) ? { ...set, type: pair ? 'superset' : 'working' } : set);
    });
    this.commitExercises(exercises); this.closeSuperset(); this.autoSave();
  },

  onExerciseMediaError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.exercises[index]) this.setData({ [`exercises[${index}].gif`]: '' });
  },

  noop() {}
});
