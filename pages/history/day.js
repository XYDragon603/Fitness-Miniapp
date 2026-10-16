const util = require('../../utils/util.js');
const ui = require('../../utils/ui-helpers.js');
const view = require('../../utils/records-view.js');

Page({
  data: { date: '', title: '', record: null, isRest: false, summary: null, dayName: '' },

  onLoad(options = {}) {
    this.setData({ date: options.date || util.getToday() });
  },

  onShow() {
    const date = this.data.date;
    const record = util.getTrainingRecord(date);
    if (!record) {
      this.setData({ record: null, title: `${ui.dateTitle(date)}` });
      return;
    }
    const isRest = record.type === 'rest';
    const all = util.getTrainingDates().map(item => util.getTrainingRecord(item)).filter(Boolean)
      .map(item => ({ ...item, date: item.date || '' }));
    const summary = isRest ? null : view.trainingDaySummary({ ...record, date }, all);
    this.setData({
      record,
      isRest,
      title: `${ui.dateTitle(date)}的${isRest ? '恢复' : '训练'}`,
      dayName: record.dayName || (isRest ? '休息日' : '训练'),
      summary: summary ? { ...summary, volumeText: ui.formatThousands(summary.volume) } : null
    });
  },

  openExercise(e) {
    const id = e.currentTarget.dataset.libraryId;
    if (id) wx.navigateTo({ url: `/packageExercise/pages/detail/detail?id=${id}` });
  },

  deleteRecord() {
    wx.showModal({
      title: '删除这天的记录？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#E06A5F',
      success: result => {
        if (!result.confirm) return;
        util.deleteTrainingRecord(this.data.date);
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/me/me' }) }), 600);
      }
    });
  }
});
