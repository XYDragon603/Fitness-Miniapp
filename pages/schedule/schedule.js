const plans = require('../../utils/workout-plan.js');
const reminders = require('../../utils/reminders.js');
const NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
Page({
  data: { title: '', mode: 'cycle', rows: [], choices: [] },
  onLoad() {
    this.plan = getApp().refreshTrainingPlanState().activePlan;
    const value = plans.getPlanSchedule(this.plan.id);
    this.weekdays = value.weekdays;
    this.setData({ title: this.plan.title, mode: value.mode,
      choices: [{ id: '', name: '休息日' }].concat(this.plan.days.filter(day => day.type !== 'rest').map(day => ({ id: day.id, name: day.name }))) });
    this.refreshRows();
  },
  refreshRows() { this.setData({ rows: NAMES.map((label, index) => {
    const selected = Math.max(0, this.data.choices.findIndex(day => day.id === this.weekdays[index + 1]));
    return { weekday: index + 1, label, selected, name: this.data.choices[selected].name };
  }) }); },
  selectMode(event) { this.setData({ mode: event.currentTarget.dataset.mode }); },
  changeDay(event) {
    this.weekdays[event.currentTarget.dataset.day] = this.data.choices[Number(event.detail.value)].id;
    this.refreshRows();
  },
  save() {
    plans.savePlanSchedule(this.plan.id, { mode: this.data.mode, weekdays: this.weekdays });
    getApp().refreshTrainingPlanState();
    reminders.markScheduleChanged();
    wx.showToast({ title: '排课已保存', icon: 'success' });
    wx.navigateBack();
  }
});
