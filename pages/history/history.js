const util = require('../../utils/util.js');
const ui = require('../../utils/ui-helpers.js');
const view = require('../../utils/records-view.js');
const { calculateFatLossTargets } = require('../../utils/mvp-core.js');

function loadRecordsByDate() {
  const map = {};
  util.getTrainingDates().forEach(date => {
    const record = util.getTrainingRecord(date);
    if (record) map[date] = { ...record, date: record.date || date };
  });
  return map;
}

function dailyCalorieTarget() {
  const profile = util.getNutritionGoalProfile();
  const goal = util.getNutritionGoal();
  if (!profile || !goal) return 0;
  if (profile.goal === 'fat_loss') {
    const target = calculateFatLossTargets(profile);
    return target.isMinor ? 0 : target.calorieRange.max;
  }
  return goal.isMinor ? 0 : goal.dailyCalories;
}

Page({
  data: {
    tab: 'training',
    year: 0,
    month: 0,
    calendar: null,
    recent: [],
    nutritionDate: '',
    nutritionDateLabel: '',
    nutritionTotal: null,
    nutritionRing: '',
    mealGroups: [],
    today: ''
  },

  onLoad(options = {}) {
    const today = util.getToday();
    const date = new Date(`${today}T12:00:00`);
    this.setData({
      tab: options.tab === 'nutrition' ? 'nutrition' : 'training',
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      nutritionDate: /^\d{4}-\d{2}-\d{2}$/.test(options.date || '') ? options.date : today,
      today
    });
  },

  onShow() {
    this.loadTraining();
    this.loadNutrition();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  // ---------- 训练记录 ----------
  loadTraining() {
    this._records = loadRecordsByDate();
    const { year, month, today } = this.data;
    const recent = Object.keys(this._records).sort().reverse().slice(0, 10).map(date => {
      const record = this._records[date];
      const isRest = record.type === 'rest';
      const exercises = record.exercises || [];
      const done = exercises.filter(exercise => exercise.completed || ((exercise.sets || []).length > 0 && exercise.sets.every(set => set && set.done))).length;
      return {
        date,
        title: ui.dateTitle(date),
        weekday: ui.weekdayLabel(date),
        isRest,
        name: isRest ? '休息日' : (record.dayName || '训练'),
        status: isRest ? (record.restCompleted === false ? '未打卡' : '已记录恢复') : `已完成 ${done}/${exercises.length}`
      };
    });
    this.setData({ calendar: view.calendarMonth(year, month, this._records, today), recent });
  },

  switchMonth(e) {
    const delta = Number(e.currentTarget.dataset.delta);
    let { year, month } = this.data;
    month += delta;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    this.setData({ year, month, calendar: view.calendarMonth(year, month, this._records || {}, this.data.today) });
  },

  selectCalendarDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!this._records || !this._records[date]) {
      wx.showToast({ title: '这天没有训练记录', icon: 'none' });
      return;
    }
    this.openDay({ currentTarget: { dataset: { date } } });
  },

  openDay(e) {
    wx.navigateTo({ url: `/pages/history/day?date=${e.currentTarget.dataset.date}` });
  },

  // ---------- 饮食记录 ----------
  loadNutrition() {
    const date = this.data.nutritionDate;
    const foods = util.getNutritionRecords(date);
    const total = util.calcDailyNutrition(foods);
    const target = dailyCalorieTarget();
    const percent = ui.percent(total.calories, target);
    this.setData({
      nutritionDateLabel: `${ui.dateTitle(date)}  ${ui.weekdayLabel(date)}`,
      nutritionTotal: {
        calories: ui.formatThousands(total.calories),
        hasTarget: target > 0,
        percent,
        protein: Math.round(total.protein),
        carbs: Math.round(total.carbs),
        fat: Math.round(total.fat)
      },
      nutritionRing: view.ringSvg(percent, true),
      mealGroups: view.buildMealGroups(foods)
    });
  },

  onNutritionDateChange(e) {
    this.setData({ nutritionDate: e.detail.value });
    this.loadNutrition();
  }
});
