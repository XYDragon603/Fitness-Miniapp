# Healthy Fat Loss Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `健康减脂参考` feature set with a nutrition-page entry, a non-tab fat-loss subpage, a builtin fat-loss workout plan, habit check-ins, weekly fat-loss stats, and lightweight weight trend support without breaking existing training, nutrition, AI scan, rest-day, or custom-plan flows.

**Architecture:** Extend the existing local-storage-first design by adding fat-loss-specific storage keys and utility helpers in `utils/util.js`, layering fat-loss calculations on top of the current nutrition goal system, and wiring new UI entry points into the current nutrition, plan, stats, and history pages. Keep the new user flow centered around `pages/fatloss/fatloss` so the bottom tab bar remains unchanged.

**Tech Stack:** Native WeChat Mini Program (`Page`, `wx.*`, WXML, WXSS), local storage via `wx.setStorageSync`, existing shared utility modules, current custom tab bar.

---

## File Structure

### Existing files to modify

- `app.json`
  - Register the new `pages/fatloss/fatloss` page without adding a new tab item.
- `utils/mvp-core.js`
  - Reuse or extend calorie/TDEE helpers for fat-loss calculation.
- `utils/util.js`
  - Add fat-loss profile, habits, weight-record storage helpers, and weekly summary helpers.
- `utils/workout-plan.js`
  - Add the builtin `健康减脂计划`.
- `pages/nutrition/nutrition.js`
  - Add `fat_loss` goal option, load fat-loss summary state, and route to fat-loss page.
- `pages/nutrition/nutrition.wxml`
  - Add the `健康减脂参考` entry card.
- `pages/nutrition/nutrition.wxss`
  - Style the fat-loss card consistently with the current Air Health direction.
- `pages/index/index.js`
  - Ensure the builtin fat-loss plan appears in plan management and can be activated.
- `pages/index/index.wxml`
  - Show the extra builtin plan in the existing plan manager.
- `pages/stats/stats.js`
  - Add weekly fat-loss summary loading and navigation to fat-loss page.
- `pages/stats/stats.wxml`
  - Add the `健康减脂参考` stats block.
- `pages/stats/stats.wxss`
  - Style the new stats block.
- `pages/history/history.js`
  - Merge fat-loss habits and weight records into display data.
- `pages/history/history.wxml`
  - Add history rendering for habit and weight records.
- `pages/history/history.wxss`
  - Style the added record types.

### New files to create

- `pages/fatloss/fatloss.js`
  - Page logic for fat-loss reference, habits, and weight trend.
- `pages/fatloss/fatloss.wxml`
  - Main fat-loss page layout.
- `pages/fatloss/fatloss.wxss`
  - Fat-loss page styling.
- `pages/fatloss/fatloss.json`
  - Page config.

---

### Task 1: Add Fat-Loss Data Helpers

**Files:**
- Modify: `utils/mvp-core.js`
- Modify: `utils/util.js`

- [ ] **Step 1: Add fat-loss target calculation helpers to `utils/mvp-core.js`**

Add a dedicated helper instead of overloading the existing muscle-gain / maintain path:

```js
function calculateFatLossTargets(profile) {
  const age = Number(profile && profile.age) || 0;
  const tdee = calculateTDEE(profile);

  if (age > 0 && age < 18) {
    return {
      isMinor: true,
      tdee,
      calorieRange: null,
      proteinTarget: null,
      fatRange: null,
      carbTarget: null,
      note: '成长阶段能量需求差异较大，当前内容仅用于健康记录参考，如需调整饮食建议咨询家长或专业人士。'
    };
  }

  const minCalories = roundInt(tdee * 0.9);
  const maxCalories = roundInt(tdee * 0.95);
  const proteinTarget = round1((Number(profile.weight) || 0) * 1.6);
  const proteinCalories = proteinTarget * 4;
  const fatMin = round1((minCalories * 0.2) / 9);
  const fatMax = round1((maxCalories * 0.35) / 9);
  const fatReferenceCalories = ((fatMin + fatMax) / 2) * 9;
  const carbTarget = round1(Math.max(0, (maxCalories - proteinCalories - fatReferenceCalories) / 4));

  return {
    isMinor: false,
    tdee,
    calorieRange: {
      min: minCalories,
      max: maxCalories
    },
    proteinTarget,
    fatRange: {
      min: fatMin,
      max: fatMax
    },
    carbTarget,
    note: '以每日参考热量区间和营养参考目标为主，关注长期趋势，不做强制限制。'
  };
}
```

- [ ] **Step 2: Export the new helper from `utils/mvp-core.js`**

Update `module.exports` to expose the new calculator:

```js
module.exports = {
  calculateNutritionTargets,
  calculateFatLossTargets,
  sanitizeGuideUrl,
  createPortionAdjustedFood
};
```

- [ ] **Step 3: Add fat-loss storage keys and getters/setters to `utils/util.js`**

Add constants near the top:

```js
const FAT_LOSS_PROFILE_KEY = 'fat_loss_profile';
const FAT_LOSS_WEIGHT_RECORDS_KEY = 'fat_loss_weight_records';
```

Add save/load helpers:

```js
function saveFatLossProfile(profile) {
  wx.setStorageSync(FAT_LOSS_PROFILE_KEY, profile || null);
}

function getFatLossProfile() {
  return wx.getStorageSync(FAT_LOSS_PROFILE_KEY) || null;
}

function saveFatLossHabits(date, record) {
  wx.setStorageSync(`fat_loss_habits_${date}`, record);
  const dates = getFatLossHabitDates();
  if (!dates.includes(date)) {
    dates.unshift(date);
    dates.sort((a, b) => b.localeCompare(a));
    wx.setStorageSync('fat_loss_habit_dates', dates);
  }
}

function getFatLossHabits(date) {
  return wx.getStorageSync(`fat_loss_habits_${date}`) || null;
}

function getFatLossHabitDates() {
  return wx.getStorageSync('fat_loss_habit_dates') || [];
}

function saveFatLossWeightRecord(date, weight, note) {
  const records = getFatLossWeightRecords().filter(item => item.date !== date);
  records.push({ date, weight: Number(weight), note: note || '' });
  records.sort((a, b) => a.date.localeCompare(b.date));
  wx.setStorageSync(FAT_LOSS_WEIGHT_RECORDS_KEY, records);
}

function getFatLossWeightRecords() {
  return wx.getStorageSync(FAT_LOSS_WEIGHT_RECORDS_KEY) || [];
}
```

- [ ] **Step 4: Add weekly fat-loss summary helper to `utils/util.js`**

Add a summary helper that combines current nutrition, training, rest, and habit data:

```js
function getFatLossWeeklySummary() {
  const recentDates = getRecentDays(7);
  const habitRecords = recentDates
    .map(date => getFatLossHabits(date))
    .filter(Boolean);
  const nutritionTotals = recentDates
    .map(date => calcDailyNutrition(getNutritionRecords(date)))
    .filter(item => item.calories > 0 || item.protein > 0 || item.fat > 0 || item.carbs > 0);
  const trainingRecords = recentDates
    .map(date => getTrainingRecord(date))
    .filter(Boolean);

  const totalHabitChecks = habitRecords.reduce((sum, item) => {
    return sum + Object.values(item.habits || {}).filter(Boolean).length;
  }, 0);

  return {
    trainingCount: getTrainingCount(trainingRecords),
    restDays: getRestDayCount(trainingRecords),
    avgCalories: nutritionTotals.length
      ? roundInt(nutritionTotals.reduce((sum, item) => sum + item.calories, 0) / nutritionTotals.length)
      : 0,
    avgProtein: nutritionTotals.length
      ? round1(nutritionTotals.reduce((sum, item) => sum + item.protein, 0) / nutritionTotals.length)
      : 0,
    habitCompletionRate: habitRecords.length
      ? Math.round((totalHabitChecks / (habitRecords.length * 7)) * 100)
      : 0,
    latestWeight: getFatLossWeightRecords().slice(-1)[0] || null
  };
}
```

- [ ] **Step 5: Export all new fat-loss helpers from `utils/util.js`**

Add these exports:

```js
  saveFatLossProfile,
  getFatLossProfile,
  saveFatLossHabits,
  getFatLossHabits,
  getFatLossHabitDates,
  saveFatLossWeightRecord,
  getFatLossWeightRecords,
  getFatLossWeeklySummary
```

- [ ] **Step 6: Run quick syntax verification**

Run:

```bash
node --check utils/mvp-core.js
node --check utils/util.js
```

Expected: both commands exit without output.

---

### Task 2: Add the Builtin Healthy Fat Loss Plan

**Files:**
- Modify: `utils/workout-plan.js`

- [ ] **Step 1: Add a plan builder for the builtin `健康减脂计划`**

Add a sibling to `buildDefaultPlan()`:

```js
function buildHealthyFatLossPlan() {
  return {
    id: 'builtin_healthy_fat_loss',
    type: 'builtin',
    title: '健康减脂计划',
    notice: '以规律力量训练、轻活动和恢复节奏为主，帮助建立更稳定的长期记录习惯。',
    days: [
      {
        id: 'fatloss_day1',
        type: 'training',
        name: '力量训练 A',
        icon: '🏋',
        color: '#C96565',
        exercises: [
          createExercise('fatloss_day1_ex1', '高脚杯深蹲', '腿/臀', 4, '10-12', '动作稳定优先。'),
          createExercise('fatloss_day1_ex2', '俯卧撑', '胸/三头', 4, '8-12', '按自己可控强度完成。'),
          createExercise('fatloss_day1_ex3', '坐姿划船', '背部', 4, '10-12', '保持节奏稳定。')
        ]
      },
      createRestDay({
        id: 'fatloss_day2',
        name: '轻有氧 / 快走',
        icon: '🚶',
        color: '#5F9A88',
        focus: '轻活动',
        description: '今天以轻有氧、快走或舒展活动为主。',
        note: '保持节奏就很好，记录参考比强度更重要。'
      }),
      {
        id: 'fatloss_day3',
        type: 'training',
        name: '力量训练 B',
        icon: '🔥',
        color: '#4F9CC4',
        exercises: [
          createExercise('fatloss_day3_ex1', '哑铃罗马尼亚硬拉', '臀/后链', 4, '10-12', '优先感受臀腿后侧。'),
          createExercise('fatloss_day3_ex2', '哑铃上斜卧推', '上胸', 4, '10-12', '动作稳定优先。'),
          createExercise('fatloss_day3_ex3', '高位下拉', '背部', 4, '10-12', '保持完整行程。')
        ]
      },
      createRestDay({
        id: 'fatloss_day4',
        name: '休息 / 拉伸',
        icon: '🧘',
        color: '#5F9A88',
        focus: '恢复',
        description: '今天可以轻松拉伸、散步或安排完全休息。',
        note: '好好恢复，是为了下一次更稳定地训练。'
      }),
      {
        id: 'fatloss_day5',
        type: 'training',
        name: '力量训练 C',
        icon: '💪',
        color: '#4EAE7D',
        exercises: [
          createExercise('fatloss_day5_ex1', '保加利亚分腿蹲', '腿/臀', 3, '10-12', '先稳再加重量。'),
          createExercise('fatloss_day5_ex2', '哑铃肩推', '肩部', 3, '10-12', '保持肩胛稳定。'),
          createExercise('fatloss_day5_ex3', '面拉', '后束/上背', 3, '12-15', '轻重量慢节奏。')
        ]
      }),
      createRestDay({
        id: 'fatloss_day6',
        name: '轻活动',
        icon: '🌿',
        color: '#6CA78F',
        focus: '活动',
        description: '今天可以安排轻松散步、舒展或温和活动。',
        note: '把活动变成习惯，比追求一次做很多更重要。'
      }),
      createRestDay({
        id: 'fatloss_day7',
        name: '休息日',
        icon: '🍃',
        color: '#5F9A88',
        focus: '恢复',
        description: '今天以恢复节奏为主。',
        note: '记录休息日，也能帮助观察训练节奏。'
      })
    ]
  };
}
```

- [ ] **Step 2: Include the new builtin plan in `getBuiltinPlans()`**

Change:

```js
function getBuiltinPlans() {
  return [buildDefaultPlan()];
}
```

to:

```js
function getBuiltinPlans() {
  return [buildDefaultPlan(), buildHealthyFatLossPlan()];
}
```

- [ ] **Step 3: Run syntax verification**

Run:

```bash
node --check utils/workout-plan.js
```

Expected: exits without output.

---

### Task 3: Add Fat-Loss Entry to Nutrition Page

**Files:**
- Modify: `pages/nutrition/nutrition.js`
- Modify: `pages/nutrition/nutrition.wxml`
- Modify: `pages/nutrition/nutrition.wxss`

- [ ] **Step 1: Extend nutrition goal options with `fat_loss`**

In `pages/nutrition/nutrition.js`, add:

```js
{ key: 'fat_loss', label: '健康减脂参考' }
```

to the `goalOptions` array, without removing existing options.

- [ ] **Step 2: Load fat-loss summary into nutrition page state**

Add state fields:

```js
fatLossSummary: {
  enabled: false,
  subtitle: '点击开启健康减脂参考，查看每日参考热量区间和长期趋势。',
  rangeText: '--',
  proteinText: '--'
}
```

Add a loader method:

```js
loadFatLossSummary() {
  const profile = util.getFatLossProfile();
  const summary = util.getFatLossWeeklySummary();

  if (!profile) {
    this.setData({
      fatLossSummary: {
        enabled: false,
        subtitle: '点击开启健康减脂参考，查看每日参考热量区间和长期趋势。',
        rangeText: '--',
        proteinText: '--'
      }
    });
    return;
  }

  const target = require('../../utils/mvp-core.js').calculateFatLossTargets(profile);

  if (target.isMinor) {
    this.setData({
      fatLossSummary: {
        enabled: true,
        subtitle: target.note,
        rangeText: '温和记录参考',
        proteinText: '--'
      }
    });
    return;
  }

  this.setData({
    fatLossSummary: {
      enabled: true,
      subtitle: '以每日参考热量区间和长期趋势为主，不做强制限制。',
      rangeText: `${target.calorieRange.min}-${target.calorieRange.max} kcal`,
      proteinText: `${target.proteinTarget} g`,
      weeklyHabitRate: summary.habitCompletionRate
    }
  });
}
```

Call it from `onShow()` after the existing nutrition goal/daily total loaders.

- [ ] **Step 3: Add fat-loss card to the nutrition page template**

In `pages/nutrition/nutrition.wxml`, add a new card near the goal card:

```xml
<view class="goal-card card fat-loss-card">
  <view class="goal-card-top">
    <view class="goal-card-copy">
      <view class="card-title">健康减脂参考</view>
      <view class="card-subtitle">{{fatLossSummary.subtitle}}</view>
    </view>
    <view class="btn-secondary goal-card-action" bindtap="openFatLossPage">
      <text wx:if="{{fatLossSummary.enabled}}">查看参考</text>
      <text wx:else>开启参考</text>
    </view>
  </view>

  <view class="fat-loss-quick-metrics" wx:if="{{fatLossSummary.enabled}}">
    <view class="macro-overview-card">
      <view class="macro-overview-label">每日参考热量区间</view>
      <view class="macro-overview-value">{{fatLossSummary.rangeText}}</view>
    </view>
    <view class="macro-overview-card">
      <view class="macro-overview-label">蛋白质参考目标</view>
      <view class="macro-overview-value">{{fatLossSummary.proteinText}}</view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: Add nutrition-page navigation to the fat-loss page**

In `pages/nutrition/nutrition.js`, add:

```js
openFatLossPage() {
  wx.navigateTo({
    url: '/pages/fatloss/fatloss'
  });
}
```

- [ ] **Step 5: Add styles for the fat-loss card**

In `pages/nutrition/nutrition.wxss`, add:

```css
.fat-loss-card {
  background:
    radial-gradient(circle at top right, rgba(111, 191, 151, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 248, 0.96));
}

.fat-loss-quick-metrics {
  display: flex;
  gap: 14rpx;
  margin-top: 20rpx;
}

.fat-loss-quick-metrics .macro-overview-card {
  flex: 1;
}
```

- [ ] **Step 6: Run syntax verification**

Run:

```bash
node --check pages/nutrition/nutrition.js
```

Expected: exits without output.

---

### Task 4: Build the Non-Tab Fat Loss Page

**Files:**
- Create: `pages/fatloss/fatloss.js`
- Create: `pages/fatloss/fatloss.wxml`
- Create: `pages/fatloss/fatloss.wxss`
- Create: `pages/fatloss/fatloss.json`
- Modify: `app.json`

- [ ] **Step 1: Register the page in `app.json`**

Add the new page path to the `pages` array:

```json
"pages/fatloss/fatloss"
```

Do not add it to `tabBar.list`.

- [ ] **Step 2: Create the page config**

Create `pages/fatloss/fatloss.json`:

```json
{
  "navigationBarTitleText": "健康减脂参考"
}
```

- [ ] **Step 3: Create the page logic**

Create `pages/fatloss/fatloss.js`:

```js
const util = require('../../utils/util.js');
const { calculateFatLossTargets } = require('../../utils/mvp-core.js');

function createHabitState(record) {
  const habits = record && record.habits ? record.habits : {};
  return {
    activity: !!habits.activity,
    nutrition: !!habits.nutrition,
    protein: !!habits.protein,
    vegetables: !!habits.vegetables,
    water: !!habits.water,
    sleep: !!habits.sleep,
    recovery: !!habits.recovery
  };
}

Page({
  data: {
    todayStr: '',
    profile: null,
    target: null,
    weeklySummary: null,
    habitState: createHabitState(),
    weightInput: '',
    weightNote: '',
    weightRecords: []
  },

  onShow() {
    const today = util.getToday();
    const profile = util.getFatLossProfile() || util.getNutritionGoalProfile();
    const habitRecord = util.getFatLossHabits(today);
    const target = profile ? calculateFatLossTargets(profile) : null;

    this.setData({
      todayStr: today,
      profile,
      target,
      weeklySummary: util.getFatLossWeeklySummary(),
      habitState: createHabitState(habitRecord),
      weightRecords: util.getFatLossWeightRecords().slice().reverse()
    });
  },

  toggleHabit(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({
      [`habitState.${key}`]: !this.data.habitState[key]
    });
  },

  saveHabits() {
    util.saveFatLossHabits(this.data.todayStr, {
      date: this.data.todayStr,
      habits: this.data.habitState,
      note: '',
      createdAt: new Date().toISOString()
    });

    this.setData({
      weeklySummary: util.getFatLossWeeklySummary()
    });

    wx.showToast({ title: '已保存今日习惯', icon: 'success' });
  },

  onWeightInput(e) {
    this.setData({ weightInput: e.detail.value });
  },

  onWeightNoteInput(e) {
    this.setData({ weightNote: e.detail.value });
  },

  saveWeight() {
    if (!this.data.weightInput) {
      wx.showToast({ title: '请先填写体重', icon: 'none' });
      return;
    }

    util.saveFatLossWeightRecord(this.data.todayStr, this.data.weightInput, this.data.weightNote);
    this.setData({
      weightInput: '',
      weightNote: '',
      weeklySummary: util.getFatLossWeeklySummary(),
      weightRecords: util.getFatLossWeightRecords().slice().reverse()
    });
    wx.showToast({ title: '已记录体重', icon: 'success' });
  }
});
```

- [ ] **Step 4: Create the page template**

Create `pages/fatloss/fatloss.wxml`:

```xml
<view class="container fatloss-page">
  <view class="page-header">
    <view class="page-title">健康减脂参考</view>
    <view class="page-desc">以记录参考、长期趋势和稳定节奏为主，不做强制限制。</view>
  </view>

  <view class="card fatloss-hero" wx:if="{{target && !target.isMinor}}">
    <view class="card-title">每日参考热量区间</view>
    <view class="hero-range">{{target.calorieRange.min}} - {{target.calorieRange.max}} kcal</view>
    <view class="hero-grid">
      <view class="hero-metric">
        <view class="hero-metric-label">蛋白质参考目标</view>
        <view class="hero-metric-value">{{target.proteinTarget}} g</view>
      </view>
      <view class="hero-metric">
        <view class="hero-metric-label">脂肪参考范围</view>
        <view class="hero-metric-value">{{target.fatRange.min}} - {{target.fatRange.max}} g</view>
      </view>
      <view class="hero-metric">
        <view class="hero-metric-label">碳水参考目标</view>
        <view class="hero-metric-value">{{target.carbTarget}} g</view>
      </view>
    </view>
  </view>

  <view class="card fatloss-hero" wx:elif="{{target && target.isMinor}}">
    <view class="card-title">温和健康记录建议</view>
    <view class="card-subtitle">{{target.note}}</view>
  </view>

  <view class="card habit-card">
    <view class="card-title">今日习惯打卡</view>
    <view class="habit-grid">
      <view class="habit-chip {{habitState.activity ? 'active' : ''}}" bindtap="toggleHabit" data-key="activity">今日完成训练或轻活动</view>
      <view class="habit-chip {{habitState.nutrition ? 'active' : ''}}" bindtap="toggleHabit" data-key="nutrition">今日记录饮食</view>
      <view class="habit-chip {{habitState.protein ? 'active' : ''}}" bindtap="toggleHabit" data-key="protein">今日蛋白质记录</view>
      <view class="habit-chip {{habitState.vegetables ? 'active' : ''}}" bindtap="toggleHabit" data-key="vegetables">今日蔬菜摄入</view>
      <view class="habit-chip {{habitState.water ? 'active' : ''}}" bindtap="toggleHabit" data-key="water">今日喝水</view>
      <view class="habit-chip {{habitState.sleep ? 'active' : ''}}" bindtap="toggleHabit" data-key="sleep">今日睡眠</view>
      <view class="habit-chip {{habitState.recovery ? 'active' : ''}}" bindtap="toggleHabit" data-key="recovery">今日休息或拉伸</view>
    </view>
    <view class="btn-success save-btn" bindtap="saveHabits">保存今日习惯</view>
  </view>

  <view class="card weekly-card" wx:if="{{weeklySummary}}">
    <view class="card-title">本周记录参考</view>
    <view class="hero-grid">
      <view class="hero-metric">
        <view class="hero-metric-label">本周训练次数</view>
        <view class="hero-metric-value">{{weeklySummary.trainingCount}}</view>
      </view>
      <view class="hero-metric">
        <view class="hero-metric-label">本周休息天数</view>
        <view class="hero-metric-value">{{weeklySummary.restDays}}</view>
      </view>
      <view class="hero-metric">
        <view class="hero-metric-label">平均每日热量</view>
        <view class="hero-metric-value">{{weeklySummary.avgCalories}} kcal</view>
      </view>
      <view class="hero-metric">
        <view class="hero-metric-label">平均蛋白质</view>
        <view class="hero-metric-value">{{weeklySummary.avgProtein}} g</view>
      </view>
      <view class="hero-metric">
        <view class="hero-metric-label">习惯完成率</view>
        <view class="hero-metric-value">{{weeklySummary.habitCompletionRate}}%</view>
      </view>
    </view>
  </view>

  <view class="card weight-card">
    <view class="card-title">体重趋势</view>
    <view class="card-subtitle">仅用于观察长期趋势，不代表健康诊断。</view>
    <input class="input-field" type="digit" placeholder="例如：65.2" value="{{weightInput}}" bindinput="onWeightInput" />
    <input class="input-field" placeholder="可选备注" value="{{weightNote}}" bindinput="onWeightNoteInput" />
    <view class="btn-secondary save-btn" bindtap="saveWeight">记录今日体重</view>

    <view class="weight-record-list" wx:if="{{weightRecords.length > 0}}">
      <view class="weight-row" wx:for="{{weightRecords}}" wx:key="date">
        <view class="weight-date">{{item.date}}</view>
        <view class="weight-value">{{item.weight}} kg</view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 5: Create page styles**

Create `pages/fatloss/fatloss.wxss`:

```css
.fatloss-page {
  padding-bottom: calc(env(safe-area-inset-bottom) + 48rpx);
}

.fatloss-hero {
  background:
    radial-gradient(circle at top right, rgba(111, 191, 151, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 248, 0.96));
}

.hero-range {
  margin-top: 16rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: var(--success-color);
}

.hero-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}

.hero-metric {
  flex: 1;
  min-width: 210rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.84);
  border: 1rpx solid rgba(217, 232, 228, 0.92);
}

.hero-metric-label {
  font-size: 22rpx;
  color: var(--text-hint);
}

.hero-metric-value {
  margin-top: 10rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.habit-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.habit-chip {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.86);
  border: 1rpx solid rgba(217, 232, 228, 0.92);
  color: var(--text-secondary);
  font-size: 22rpx;
}

.habit-chip.active {
  background: rgba(111, 191, 151, 0.18);
  border-color: rgba(111, 191, 151, 0.42);
  color: #4B8F72;
}

.save-btn {
  margin-top: 18rpx;
}

.weight-record-list {
  margin-top: 18rpx;
}

.weight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(217, 232, 228, 0.72);
}

.weight-row:last-child {
  border-bottom: none;
}
```

- [ ] **Step 6: Run syntax verification**

Run:

```bash
node --check pages/fatloss/fatloss.js
```

Expected: exits without output.

---

### Task 5: Add Fat-Loss Summary to Stats Page

**Files:**
- Modify: `pages/stats/stats.js`
- Modify: `pages/stats/stats.wxml`
- Modify: `pages/stats/stats.wxss`

- [ ] **Step 1: Load weekly fat-loss summary in `pages/stats/stats.js`**

Add state:

```js
fatLossStats: null
```

In `loadStats()`, after existing stats loads:

```js
this.setData({
  fatLossStats: util.getFatLossWeeklySummary()
});
```

Add navigation:

```js
openFatLossPage() {
  wx.navigateTo({
    url: '/pages/fatloss/fatloss'
  });
}
```

- [ ] **Step 2: Add a fat-loss summary block to `pages/stats/stats.wxml`**

Insert below the existing main stats cards:

```xml
<view class="card fat-loss-stats-card" wx:if="{{fatLossStats}}">
  <view class="card-header stats-card-header">
    <view>
      <view class="card-title">健康减脂参考</view>
      <view class="card-subtitle">关注记录参考、长期趋势和习惯节奏。</view>
    </view>
    <view class="btn-secondary mini-action-btn" bindtap="openFatLossPage">查看参考</view>
  </view>

  <view class="hero-grid">
    <view class="hero-metric">
      <view class="hero-metric-label">本周训练次数</view>
      <view class="hero-metric-value">{{fatLossStats.trainingCount}}</view>
    </view>
    <view class="hero-metric">
      <view class="hero-metric-label">本周休息天数</view>
      <view class="hero-metric-value">{{fatLossStats.restDays}}</view>
    </view>
    <view class="hero-metric">
      <view class="hero-metric-label">平均每日热量</view>
      <view class="hero-metric-value">{{fatLossStats.avgCalories}} kcal</view>
    </view>
    <view class="hero-metric">
      <view class="hero-metric-label">平均蛋白质</view>
      <view class="hero-metric-value">{{fatLossStats.avgProtein}} g</view>
    </view>
    <view class="hero-metric">
      <view class="hero-metric-label">习惯完成率</view>
      <view class="hero-metric-value">{{fatLossStats.habitCompletionRate}}%</view>
    </view>
    <view class="hero-metric" wx:if="{{fatLossStats.latestWeight}}">
      <view class="hero-metric-label">最新体重</view>
      <view class="hero-metric-value">{{fatLossStats.latestWeight.weight}} kg</view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Add fat-loss card styles to `pages/stats/stats.wxss`**

```css
.fat-loss-stats-card {
  background:
    radial-gradient(circle at top right, rgba(111, 191, 151, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 248, 0.96));
}
```

- [ ] **Step 4: Run syntax verification**

Run:

```bash
node --check pages/stats/stats.js
```

Expected: exits without output.

---

### Task 6: Add Fat-Loss Records to History Page

**Files:**
- Modify: `pages/history/history.js`
- Modify: `pages/history/history.wxml`
- Modify: `pages/history/history.wxss`

- [ ] **Step 1: Build fat-loss history items in `pages/history/history.js`**

Add state:

```js
fatLossRecords: []
```

Add loader:

```js
loadFatLossRecords() {
  const habitItems = util.getFatLossHabitDates().map(date => {
    const record = util.getFatLossHabits(date);
    const completed = Object.values(record && record.habits ? record.habits : {}).filter(Boolean).length;
    return {
      id: `habit_${date}`,
      date,
      dateCN: util.formatDateCN(date),
      type: 'habit',
      title: '减脂习惯打卡',
      summary: `已记录 ${completed} 项习惯`,
      badge: '习惯打卡'
    };
  });

  const weightItems = util.getFatLossWeightRecords().map(item => ({
    id: `weight_${item.date}`,
    date: item.date,
    dateCN: util.formatDateCN(item.date),
    type: 'weight',
    title: '体重记录',
    summary: `${item.weight} kg${item.note ? ` · ${item.note}` : ''}`,
    badge: '体重记录'
  }));

  const fatLossRecords = habitItems.concat(weightItems)
    .sort((a, b) => b.date.localeCompare(a.date));

  this.setData({ fatLossRecords });
}
```

Call it from `loadRecords()`.

- [ ] **Step 2: Add history rendering block**

In `pages/history/history.wxml`, inside the nutrition tab area after nutrition cards, add:

```xml
<view class="history-section-label" wx:if="{{fatLossRecords.length > 0}}">健康减脂参考记录</view>

<view
  class="history-card fatloss-history-card card fade-in"
  wx:for="{{fatLossRecords}}"
  wx:key="id"
>
  <view class="history-entry-top">
    <view class="history-date-section">
      <view class="history-date">{{item.dateCN}}</view>
      <view class="history-count">{{item.title}}</view>
    </view>
    <view class="history-badge rest">{{item.badge}}</view>
  </view>
  <view class="history-entry-copy">
    <view class="history-entry-note">{{item.summary}}</view>
  </view>
</view>
```

- [ ] **Step 3: Add small card styling**

In `pages/history/history.wxss`, add:

```css
.fatloss-history-card {
  background: linear-gradient(180deg, #FCFEFD 0%, #F6FBF8 100%);
}
```

- [ ] **Step 4: Run syntax verification**

Run:

```bash
node --check pages/history/history.js
```

Expected: exits without output.

---

### Task 7: Compatibility Check

**Files:**
- Modify: none

- [ ] **Step 1: Re-run syntax checks for all touched page scripts**

Run:

```bash
node --check pages/nutrition/nutrition.js
node --check pages/index/index.js
node --check pages/stats/stats.js
node --check pages/history/history.js
node --check pages/fatloss/fatloss.js
node --check utils/util.js
node --check utils/mvp-core.js
node --check utils/workout-plan.js
```

Expected: all commands exit without output.

- [ ] **Step 2: Manual smoke checklist in WeChat DevTools**

Verify:

```text
1. Bottom tab bar still has exactly 5 items
2. Nutrition page shows the healthy fat-loss card
3. Fat-loss page opens from nutrition page
4. Builtin healthy fat-loss plan appears and can be activated
5. Habit checklist saves and reloads for today
6. Weight record saves and appears in trend list
7. Stats page shows healthy fat-loss summary
8. History page shows habit/weight records
9. Existing AI scan still works
10. Existing rest-day save/load still works
```

- [ ] **Step 3: Commit**

```bash
git add app.json pages/fatloss pages/nutrition pages/stats pages/history utils
git commit -m "feat: add healthy fat loss reference flow"
```

Expected: a single commit containing the new fat-loss page, helpers, builtin plan, and summary cards.
