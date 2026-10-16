const util = require('../../utils/util.js');
const ui = require('../../utils/ui-helpers.js');
const view = require('../../utils/records-view.js');

const RANGES = [7, 30, 90];

function timeLabel(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

Page({
  data: {
    ranges: RANGES,
    range: 30,
    latest: null,
    change: 0,
    changeText: '',
    chart: '',
    weightInput: '',
    weightNote: '',
    recent: [],
    showAll: false,
    todayStr: ''
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const today = util.getToday();
    const records = util.getFatLossWeightRecords();
    const series = view.weightSeries(records, this.data.range, today);
    const monthSeries = view.weightSeries(records, 30, today);
    const sorted = records.slice().sort((a, b) => b.date.localeCompare(a.date));
    this.setData({
      todayStr: today,
      latest: series.latest,
      change: monthSeries.change,
      changeText: monthSeries.change === 0 ? '0' : `${monthSeries.change > 0 ? '+' : ''}${monthSeries.change}`,
      chart: view.lineChartSvg(series.points),
      recent: sorted.map(item => ({
        date: item.date,
        title: ui.dateTitle(item.date),
        weekday: ui.weekdayLabel(item.date),
        time: timeLabel(item.time),
        weight: item.weight,
        note: item.note || ''
      }))
    });
  },

  selectRange(e) {
    this.setData({ range: Number(e.currentTarget.dataset.range) });
    this.loadData();
  },

  onWeightInput(e) {
    this.setData({ weightInput: e.detail.value });
  },

  onWeightNoteInput(e) {
    this.setData({ weightNote: e.detail.value });
  },

  clearNote() {
    this.setData({ weightNote: '' });
  },

  toggleAll() {
    this.setData({ showAll: !this.data.showAll });
  },

  saveWeight() {
    const weight = Number(this.data.weightInput);
    if (!weight || weight <= 0 || weight > 400) {
      wx.showToast({ title: '请先填写有效体重', icon: 'none' });
      return;
    }
    util.saveFatLossWeightRecord(this.data.todayStr, weight, this.data.weightNote.trim());
    this.setData({ weightInput: '', weightNote: '' });
    this.loadData();
    wx.showToast({ title: '已记录今日体重', icon: 'success' });
  }
});
