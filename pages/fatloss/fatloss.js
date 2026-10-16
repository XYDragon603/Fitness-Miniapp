const util = require('../../utils/util.js');
const ui = require('../../utils/ui-helpers.js');
const { calculateFatLossTargets } = require('../../utils/mvp-core.js');

const HABITS = [
  { key: 'activity', icon: 'dumbbell', title: '完成训练或轻活动', desc: '哪怕是散步、拉伸也很棒' },
  { key: 'nutrition', icon: 'fork', title: '记录饮食', desc: '记录三餐，了解自己的摄入' },
  { key: 'protein', icon: 'plate', title: '关注蛋白质', desc: '每餐有一份优质蛋白' },
  { key: 'vegetables', icon: 'veg', title: '吃到蔬菜', desc: '在一餐中加入蔬菜' },
  { key: 'water', icon: 'drop', title: '补充饮水', desc: '按需喝水，记得留意口渴' },
  { key: 'sleep', icon: 'moon', title: '关注睡眠', desc: '给自己规律的休息时间' },
  { key: 'recovery', icon: 'sofa', title: '休息或拉伸', desc: '给身体留出恢复的时间' }
];
const HABIT_KEYS = HABITS.map(item => item.key);

function createHabitState(record) {
  const habits = record && record.habits ? record.habits : {};
  return HABIT_KEYS.reduce((state, key) => ({ ...state, [key]: !!habits[key] }), {});
}

Page({
  data: {
    todayStr: '',
    habits: HABITS,
    habitState: createHabitState(),
    target: null,
    hasReferenceProfile: false,
    weeklySummary: null,
    latestWeight: null
  },

  onShow() {
    this.loadPageData();
  },

  loadPageData() {
    const today = util.getToday();
    const profile = util.getFatLossProfile() || util.getNutritionGoalProfile() || null;
    const target = profile ? calculateFatLossTargets(profile) : null;
    this.setData({
      todayStr: today,
      hasReferenceProfile: !!profile,
      target: target && !target.isMinor ? {
        min: ui.formatThousands(target.calorieRange.min),
        max: ui.formatThousands(target.calorieRange.max),
        protein: Math.round(target.proteinTarget),
        note: target.note || ''
      } : (target ? { isMinor: true, note: target.note } : null),
      habitState: createHabitState(util.getFatLossHabits(today)),
      weeklySummary: util.getFatLossWeeklySummary(),
      latestWeight: util.getFatLossWeightRecords().slice(-1)[0] || null
    });
  },

  toggleHabit(e) {
    const key = e.currentTarget.dataset.key;
    if (!HABIT_KEYS.includes(key)) {
      return;
    }
    this.setData({ [`habitState.${key}`]: !this.data.habitState[key] });
  },

  saveHabits() {
    util.saveFatLossHabits(this.data.todayStr, {
      date: this.data.todayStr,
      habits: this.data.habitState,
      createdAt: new Date().toISOString()
    });
    this.setData({ weeklySummary: util.getFatLossWeeklySummary() });
    wx.showToast({ title: '已保存今日习惯', icon: 'success' });
  },

  openWeight() {
    wx.navigateTo({ url: '/pages/weight/weight' });
  },

  // 还没有身体数据：去饮食页的“营养参考目标”填写
  openGoalSetup() {
    const app = getApp();
    if (app && app.globalData) app.globalData.openGoalForm = true;
    wx.switchTab({ url: '/pages/nutrition/nutrition' });
  }
});
