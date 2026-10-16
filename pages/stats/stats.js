const util = require('../../utils/util.js');
const progression = require('../../utils/progression.js');
const view = require('../../utils/records-view.js');
const ui = require('../../utils/ui-helpers.js');

const SEGMENT_COLORS = ['#C8F76E', '#2A3236', '#8C8C88', '#B8B6B0', '#D9D7D1'];

Page({
  data: {
    stats: { totalDays: 0, restDays: 0, completedExercises: 0, completionRate: 0, streak: 0 },
    ring: '',
    week: [],
    personalRecords: [],
    topRecords: [],
    distribution: []
  },

  onShow() {
    this.loadStats();
  },

  loadStats() {
    const rawStats = util.getTrainingStats();
    const groups = Array.isArray(rawStats.distributionGroups) ? rawStats.distributionGroups : [];
    const total = groups.reduce((sum, item) => sum + item.count, 0);
    const top = groups.slice(0, 4);
    const rest = groups.slice(4).reduce((sum, item) => sum + item.count, 0);
    const segments = top.map(item => ({ name: item.name, count: item.count }));
    if (rest) segments.push({ name: '其他', count: rest });
    const distribution = segments.map((item, index) => ({
      ...item,
      percent: total ? Math.round((item.count / total) * 100) : 0,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length]
    }));

    const recordsByDate = {};
    util.getTrainingDates().forEach(date => {
      const record = util.getTrainingRecord(date);
      if (record) recordsByDate[date] = record;
    });

    this.setData({
      stats: rawStats,
      ring: view.ringSvg(rawStats.completionRate, true),
      week: view.weekTrainingCounts(recordsByDate, util.getToday()),
      distribution
    });
    this.loadPersonalRecords();
  },

  loadPersonalRecords() {
    const data = require('../../utils/insights-data.js');
    const records = data.allRecords();
    const known = data.knownExercises(records);
    const names = {};
    records.forEach(record => (record.exercises || []).forEach(exercise => {
      const key = progression.resolveExerciseKey(exercise, known);
      if (key && !names[key]) names[key] = exercise.name;
    }));
    const personalRecords = Object.keys(names).map(key => ({ key, name: names[key], ...progression.findPersonalRecords(records, key, known) }))
      .filter(item => require('../../utils/training-insights.js').exerciseHistory(records, item.key, known).length);
    const topRecords = personalRecords
      .slice()
      .sort((a, b) => ((b.bestWeight && b.bestWeight.weight) || 0) - ((a.bestWeight && a.bestWeight.weight) || 0))
      .map(item => ({
        key: item.key,
        name: item.name,
        libraryId: /^\d{4}$/.test(item.key) ? item.key : '',
        image: (ui.exerciseMedia(/^\d{4}$/.test(item.key) ? item.key : { name: item.name }) || {}).thumb || ui.equipmentImage(item.name),
        weight: item.bestWeight ? item.bestWeight.weight : '—',
        e1rm: item.bestE1RM ? item.bestE1RM.e1rm : '—'
      }));
    this.setData({ personalRecords, topRecords });
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  openRecord(e) {
    const item = this.data.topRecords.find(row => row.key === e.currentTarget.dataset.key);
    if (item) wx.navigateTo({ url: `/pages/exercise-progress/progress?key=${encodeURIComponent(item.key)}&name=${encodeURIComponent(item.name)}` });
  },

  openFatLossPage() {
    wx.navigateTo({ url: '/pages/fatloss/fatloss' });
  }
});
