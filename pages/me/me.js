const util = require('../../utils/util.js');
const view = require('../../utils/records-view.js');

Page({
  data: { stats: {}, week: [], weekCount: 0, latestWeight: null },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 4, hidden: false });
    const today = util.getToday();
    const recordsByDate = {};
    util.getTrainingDates().forEach(date => {
      const record = util.getTrainingRecord(date);
      if (record) recordsByDate[date] = record;
    });
    const week = view.weekTrainingCounts(recordsByDate, today);
    this.setData({
      stats: util.getTrainingStats(),
      week,
      weekCount: week.reduce((sum, day) => sum + day.count, 0),
      latestWeight: util.getFatLossWeightRecords().slice(-1)[0] || null,
      backupLabel: (() => { const meta = wx.getStorageSync('cloud_backup_meta'); return meta && meta.savedAt ? `上次备份 ${meta.savedAt.slice(0, 10)}` : '备份到云端，换手机也不丢'; })()
    });
  },
  openHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  openStats() { wx.navigateTo({ url: '/pages/stats/stats' }); },
  openWeight() { wx.navigateTo({ url: '/pages/fatloss/fatloss' }); },
  openBackup() { wx.navigateTo({ url: '/pages/backup/backup' }); }
});
