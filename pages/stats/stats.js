const util = require('../../utils/util.js');

Page({
  data: {
    stats: {
      totalDays: 0,
      restDays: 0,
      planRecordedDays: 0,
      totalExercises: 0,
      completedExercises: 0,
      uncompletedExercises: 0,
      completionRate: 0,
      streak: 0
    },
    distributionItems: [],
    recentDays: [],
    nutritionStats: []
  },

  onShow() {
    this.syncCustomTabBar();
    this.loadStats();
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
      selected: 4
    });
  },

  loadStats() {
    const rawStats = util.getTrainingStats();
    const distributionGroups = Array.isArray(rawStats.distributionGroups) ? rawStats.distributionGroups : [];
    const maxCount = Math.max(...distributionGroups.map(item => item.count), 1);

    const stats = {
      ...rawStats,
      restDays: rawStats.restDays || 0,
      planRecordedDays: rawStats.planRecordedDays || ((rawStats.totalDays || 0) + (rawStats.restDays || 0)),
      uncompletedExercises: rawStats.totalExercises - rawStats.completedExercises
    };
    const distributionItems = distributionGroups.map(item => ({
      ...item,
      percent: Math.round((item.count / maxCount) * 100)
    }));

    this.setData({
      stats,
      distributionItems
    });
    this.loadRecentDays();
    this.loadNutritionStats();
  },

  loadRecentDays() {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const recentDays = [];

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = util.formatDate(date);
      const record = util.getTrainingRecord(dateStr);
      const recordType = util.isRestRecord(record) ? 'rest' : (record ? 'training' : '');

      recentDays.push({
        date: dateStr,
        day: date.getDate(),
        weekDay: weekDays[date.getDay()],
        hasRecord: !!record,
        recordType
      });
    }

    this.setData({ recentDays });
  },

  loadNutritionStats() {
    const nutritionStats = [];
    let maxCalories = 0;

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = util.formatDate(date);
      const foods = util.getNutritionRecords(dateStr);

      if (foods.length > 0) {
        const total = util.calcDailyNutrition(foods);
        if (total.calories > maxCalories) {
          maxCalories = total.calories;
        }
        nutritionStats.push({
          date: dateStr,
          dateCN: `${date.getMonth() + 1}/${date.getDate()}`,
          total,
          calPercent: 0
        });
      }
    }

    if (maxCalories > 0) {
      nutritionStats.forEach(item => {
        item.calPercent = Math.round((item.total.calories / maxCalories) * 80);
      });
    }

    this.setData({ nutritionStats });
  }
});
