const util = require('../../utils/util.js');
const insights = require('../../utils/training-insights.js');
const data = require('../../utils/insights-data.js');
const view = require('../../utils/records-view.js');
const ui = require('../../utils/ui-helpers.js');
const schedule = require('../../utils/schedule.js');
Page({
  data: { name: '动作进步', range: 0, points: [], weightChart: '', e1rmChart: '', latest: null, bestWeight: 0, bestE1rm: null },
  onLoad(options) {
    this.key = String(options.key || '').slice(0, 120);
    let name = options.name || ''; try { name = decodeURIComponent(name); } catch (_) {}
    this.setData({ name: String(name || '动作进步').slice(0, 64) });
  },
  onShow() { this.loadHistory(); },
  selectRange(event) { this.setData({ range: Number(event.currentTarget.dataset.days) || 0 }); this.loadHistory(); },
  loadHistory() {
    const records = data.allRecords();
    const source = records.flatMap(record => record.exercises || []).find(exercise => exercise.id === this.key || exercise.libraryId === this.key);
    const known = data.knownExercises(records);
    const key = source ? require('../../utils/progression.js').resolveExerciseKey(source, known) : this.key;
    const today = util.getToday();
    const all = insights.exerciseHistory(records, key, known).filter(point => point.date <= today);
    const from = this.data.range ? schedule.addDays(today, 1 - this.data.range) : '';
    const points = all.filter(point => !from || point.date >= from);
    this.setData({
      name: source && source.name || this.data.name,
      points: points.slice().reverse(), latest: all[all.length - 1] || null,
      bestWeight: all.length ? Math.max(...all.map(point => point.maxWeight)) : 0,
      bestE1rm: all.some(point => point.e1rm !== null) ? Math.max(...all.map(point => point.e1rm || 0)) : null,
      weightChart: view.lineChartSvg(points.map(point => ({ date: point.date, weight: point.maxWeight }))),
      e1rmChart: view.lineChartSvg(points.filter(point => point.e1rm !== null).map(point => ({ date: point.date, weight: point.e1rm })))
    });
  },
  openDay(event) { wx.navigateTo({ url: '/pages/history/day?date=' + event.currentTarget.dataset.date }); }
});
