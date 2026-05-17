const app = getApp();
const util = require('../../utils/util.js');

Page({
  data: {
    activeTab: 'training',
    trainingRecords: [],
    nutritionRecords: [],
    calendarLegend: [],
    showDetail: false,
    detailRecord: null,
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    calendarWeeks: [],
    calendarWeekdays: ['日', '一', '二', '三', '四', '五', '六']
  },

  onShow() {
    this.syncCustomTabBar();
    this.loadRecords();
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
      selected: 3
    });
  },

  switchTab(e) {
    this.setData({
      activeTab: e.currentTarget.dataset.tab
    });
  },

  loadRecords() {
    this.loadTrainingRecords();
    this.loadNutritionRecords();
    this.loadCalendar();
  },

  loadCalendar() {
    const calendar = util.getTrainingCalendarData(this.data.calendarYear, this.data.calendarMonth);
    this.setData({
      calendarYear: calendar.year,
      calendarMonth: calendar.month,
      calendarWeeks: calendar.weeks
    });
  },

  loadTrainingRecords() {
    const state = app.refreshTrainingPlanState();
    const plan = state.activePlan;
    const colorMap = {};

    if (plan && Array.isArray(plan.days)) {
      plan.days.forEach(day => {
        colorMap[day.id] = day.color;
      });
    }

    const trainingRecords = util.getTrainingDates().map(date => {
      const record = util.getTrainingRecord(date);
      if (!record) {
        return null;
      }

      const isRest = util.isRestRecord(record);
      const exercises = Array.isArray(record.exercises) ? record.exercises : [];
      const completedCount = exercises.filter(item => item && item.completed).length;
      const totalSets = exercises.reduce((sum, item) => sum + (Array.isArray(item.sets) ? item.sets.length : 0), 0);
      const dayKey = util.getCalendarRecordType(record);

      return {
        date: record.date,
        dateCN: util.formatDateCN(record.date),
        type: isRest ? 'rest' : 'training',
        dayName: record.dayName || (isRest ? '休息日' : '未知训练日'),
        dayType: dayKey,
        dayId: util.getRecordDayId(record),
        week: record.week || 1,
        planName: record.planName || record.planTitle || '',
        color: record.dayColor || colorMap[record.dayId] || colorMap[dayKey] || (isRest ? '#5F9A88' : '#C96565'),
        completionRate: isRest ? 100 : (record.completionRate || 0),
        completedCount: isRest ? 0 : completedCount,
        totalCount: isRest ? 0 : exercises.length,
        totalSets: isRest ? 0 : totalSets,
        restCompleted: record.restCompleted !== false,
        feeling: record.feeling || '',
        note: record.note || '',
        exercises
      };
    }).filter(Boolean);

    this.setData({
      trainingRecords,
      calendarLegend: this.buildCalendarLegend(plan, trainingRecords)
    });
  },

  buildCalendarLegend(plan, trainingRecords) {
    const legend = [];
    const seen = {};
    let hasRest = false;

    if (plan && Array.isArray(plan.days)) {
      plan.days.forEach(day => {
        if (!day || !day.id) {
          return;
        }

        if (day.type === 'rest') {
          hasRest = true;
          return;
        }

        if (seen[day.id]) {
          return;
        }

        seen[day.id] = true;
        legend.push({
          key: day.id,
          label: day.name || '训练记录',
          color: day.color || '#C96565'
        });
      });
    }

    trainingRecords.forEach(record => {
      if (record.type === 'rest') {
        hasRest = true;
        return;
      }

      const key = record.dayId || record.dayType || record.dayName || `record_${legend.length}`;
      if (seen[key]) {
        return;
      }

      seen[key] = true;
      legend.push({
        key,
        label: record.dayName || '训练记录',
        color: record.color || '#C96565'
      });
    });

    if (hasRest && !seen.rest) {
      legend.push({
        key: 'rest',
        label: '休息日',
        color: '#5F9A88'
      });
    }

    return legend;
  },

  loadNutritionRecords() {
    const nutritionRecords = util.getNutritionDates().map(date => {
      const foods = util.getNutritionRecords(date);
      return {
        date,
        dateCN: util.formatDateCN(date),
        count: foods.length,
        total: util.calcDailyNutrition(foods),
        foods,
        showDetail: false
      };
    });

    this.setData({
      nutritionRecords
    });
  },

  viewTrainingDetail(e) {
    this.openTrainingDetailByDate(e.currentTarget.dataset.date);
  },

  switchMonth(e) {
    const offset = Number(e.currentTarget.dataset.offset) || 0;
    const nextMonth = new Date(this.data.calendarYear, this.data.calendarMonth - 1 + offset, 1);
    this.setData({
      calendarYear: nextMonth.getFullYear(),
      calendarMonth: nextMonth.getMonth() + 1
    }, () => {
      this.loadCalendar();
    });
  },

  selectCalendarDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) {
      return;
    }

    this.openTrainingDetailByDate(date);
  },

  openTrainingDetailByDate(date) {
    const record = this.data.trainingRecords.find(item => item.date === date);
    if (!record) {
      return;
    }

    this.setData({
      showDetail: true,
      detailRecord: record
    });
  },

  closeDetail() {
    this.setData({
      showDetail: false,
      detailRecord: null
    });
  },

  deleteRecord(e) {
    const date = e.currentTarget.dataset.date;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条训练记录吗？',
      confirmColor: '#C96565',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        util.deleteTrainingRecord(date);
        this.setData({
          showDetail: false,
          detailRecord: null
        });
        this.loadTrainingRecords();
        this.loadCalendar();
        wx.showToast({
          title: '已删除',
          icon: 'success'
        });
      }
    });
  },

  toggleNutritionDetail(e) {
    const index = Number(e.currentTarget.dataset.index);
    const key = `nutritionRecords[${index}].showDetail`;
    this.setData({
      [key]: !this.data.nutritionRecords[index].showDetail
    });
  }
});
