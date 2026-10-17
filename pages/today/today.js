const app = getApp();
const util = require('../../utils/util.js');
const ui = require('../../utils/ui-helpers.js');
const { buildOverview } = require('./today-model.js');
const schedule = require('../../utils/schedule.js');
const onboarding = require('../../utils/onboarding.js');

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
}

Page({
  onShareAppMessage() { return require('../../utils/app-sharing.js').home(); },
  onShareTimeline() { return { title: require('../../utils/app-sharing.js').home().title, query: '' }; },
  onAddToFavorites() { return require('../../utils/app-sharing.js').favorite(); },
  data: {
    dateLabel: '',
    title: '今天，动起来',
    planTitle: '',
    day: null,
    dayOptions: [],
    dayPickerVisible: false,
    selectedDayId: '',
    hasTodayRecord: false,
    week: [],
    weekTrainingCount: 0,
    nextExercise: null
  },

  onShow() {
    require('../../utils/app-sharing.js').menu(wx);
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 0, hidden: false });
    this.loadOverview();
    this.maybeShowOnboarding();
  },

  // 新用户第一次打开：进引导；已有记录的老用户直接标记为看过
  maybeShowOnboarding() {
    if (this._onboardingChecked || typeof wx.getStorageSync !== 'function') return;
    this._onboardingChecked = true;
    const state = {
      done: !!wx.getStorageSync(onboarding.ONBOARDING_KEY),
      trainingDates: util.getTrainingDates(),
      nutritionDates: typeof util.getNutritionDates === 'function' ? util.getNutritionDates() : [],
      plans: wx.getStorageSync('workout_plans') || []
    };
    if (onboarding.shouldShowOnboarding(state)) {
      wx.navigateTo({ url: '/pages/welcome/welcome' });
    } else if (!state.done) {
      wx.setStorageSync(onboarding.ONBOARDING_KEY, true);
    }
  },

  loadOverview() {
    const state = app.refreshTrainingPlanState();
    this._plan = state.activePlan;
    const today = util.getToday();
    if (typeof wx.getStorageSync === 'function') {
      const report = require('../../utils/insights-data.js').latestWeek(today);
      this.setData({ weeklyReady: report.hasData && wx.getStorageSync('weekly_seen') !== report.start });
    }
    this._records = util.getTrainingDates().map(date => util.getTrainingRecord(date));
    const records = this._records;
    const scheduleKey = JSON.stringify(this._plan.schedule || {});
    const sameContext = this._overviewDate === today && this._overviewPlan === this._plan.id && this._overviewSchedule === scheduleKey;
    this._overviewSchedule = scheduleKey;
    const todayRecord = records.find(record => record && record.date === today && (!record.planId || record.planId === this._plan.id));
    const recordDayId = todayRecord && (todayRecord.dayId || todayRecord.dayType) || '';
    const recordChanged = this._recordDayId !== recordDayId;
    this._recordDayId = recordDayId;
    this._overviewDate = today;
    this._overviewPlan = this._plan.id;
    const overview = buildOverview(this._plan, records, today, sameContext && !recordChanged ? this.data.selectedDayId : '');
    this._selectedIndex = overview.selectedIndex;
    const selected = overview.selected;
    const exercises = selected ? (selected.exercises || []) : [];
    const savedToday = overview.hasTodayRecord ? todayRecord : null;

    this.setData({
      dateLabel: `${util.formatDateCN(today).replace(' ', '  ')}`,
      title: ui.todayTitle(selected),
      planTitle: this._plan.title,
      selectedDayId: selected ? selected.id : '',
      dayOptions: this._plan.days.map(day => ({ id: day.id, name: day.name })),
      day: selected ? {
        id: selected.id,
        name: selected.name,
        isRest: selected.type === 'rest',
        description: selected.description || selected.note || '轻松活动、拉伸，让身体恢复。',
        exerciseCount: exercises.length,
        minutes: ui.estimateMinutes(exercises),
        image: exercises.length ? ui.equipmentImage(exercises[0].name) : '',
        exercises: exercises.map(exercise => ({ id: exercise.id, name: exercise.name, sets: exercise.weeks[1].sets, reps: exercise.weeks[1].reps }))
      } : null,
      hasTodayRecord: overview.hasTodayRecord,
      week: this.decorateWeek(overview, today),
      weekTrainingCount: overview.weekTrainingCount,
      nextExercise: this.pickNextExercise(exercises, savedToday)
    });
  },

  // 本周 7 天：已记录的按记录显示，今天及以后按计划顺延，过去没记录的显示“—”
  decorateWeek(overview, today) {
    const days = this._plan.days || [];
    const records = this._records || [];
    return overview.week.map((item, index) => {
      const record = records.find(entry => entry && entry.date === item.date);
      let focus = '—';
      if (record) {
        const day = days.find(entry => entry.id === (record.dayId || record.dayType));
        focus = record.type === 'rest' ? '休息' : (day ? ui.shortFocus(day) : (record.dayName || '训练').slice(0, 2));
      } else if (this._plan.schedule && this._plan.schedule.mode === 'weekday') {
        const day = schedule.resolveDay(this._plan, records, item.date);
        focus = day ? ui.shortFocus(day) : '休息';
      } else if (item.date >= today && days.length && overview.selectedIndex >= 0) {
        focus = ui.shortFocus(days[(overview.selectedIndex + daysBetween(today, item.date)) % days.length]);
      }
      let status = 'empty';
      if (record && record.type !== 'rest') status = 'done';
      else if (item.isToday) status = 'today';
      return {
        date: item.date,
        name: item.isToday ? '今天' : WEEK_NAMES[index],
        md: ui.monthDay(item.date),
        isToday: item.isToday,
        status,
        focus
      };
    });
  },

  pickNextExercise(exercises, savedRecord) {
    if (!exercises.length) return null;
    const saved = savedRecord && Array.isArray(savedRecord.exercises) ? savedRecord.exercises : [];
    const next = exercises.find(exercise => {
      const match = saved.find(item => item && item.id === exercise.id);
      return !(match && match.completed);
    });
    if (!next) return null;
    return {
      id: next.id,
      name: next.name,
      sets: next.weeks[1].sets,
      reps: String(next.weeks[1].reps).replace('-', '–'),
      image: ui.equipmentImage(next.name),
      thumb: (ui.exerciseMedia(next) || {}).thumb || ''
    };
  },

  selectDay(event) {
    this.setData({ selectedDayId: event.currentTarget.dataset.id });
    this.loadOverview();
  },

  switchDay() {
    if (this.data.dayOptions.length > 1) this.setData({ dayPickerVisible: true });
  },
  closeDayPicker() { this.setData({ dayPickerVisible: false }); },
  pickDay(event) { this.selectDay(event); this.closeDayPicker(); },
  noop() {},

  startTraining() {
    if (!this.data.day) return;
    app.globalData.selectedDayIndex = this._selectedIndex;
    app.globalData.selectedDayId = this.data.day.id;
    app.globalData.selectedWeek = 1;
    wx.navigateTo({ url: '/pages/record/record' });
  },

  openWeekly() { wx.navigateTo({ url: '/pages/report/report?kind=week' }); },
  openPlans() { wx.switchTab({ url: '/pages/index/index' }); },

  openHistory() { wx.navigateTo({ url: '/pages/history/history' }); }
});

