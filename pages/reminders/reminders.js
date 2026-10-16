const reminders = require('../../utils/reminders.js');
const util = require('../../utils/util.js');
Page({
  data: { settings: { enabled: false, time: '20:00' }, preview: [], planTitle: '' },
  onShow() {
    const plan = getApp().refreshTrainingPlanState().activePlan;
    this.setData({ settings: reminders.load(), planTitle: plan.title,
      preview: reminders.upcoming(plan, util.getTrainingDates().map(date => util.getTrainingRecord(date)), util.getToday()).slice(0, 5) });
  },
  changeEnabled(event) { this.setData({ 'settings.enabled': event.detail.value }); },
  changeTime(event) { this.setData({ 'settings.time': event.detail.value }); },
  save() { reminders.save(this.data.settings); wx.showToast({ title: '提醒偏好已保存在本机', icon: 'none' }); },
  openSchedule() { wx.navigateTo({ url: '/pages/schedule/schedule' }); }
});
