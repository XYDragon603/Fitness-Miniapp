# Air Health UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the mini program into a calmer, more premium `Air Health` experience across all core pages while removing visible week switching from the main interface.

**Architecture:** Start by replacing the current visual tokens in `app.wxss` with a unified light wellness system, then restyle each page in order of user impact: training plan, training record, nutrition, history, and stats. Keep the current data flows and page structure intact while simplifying visible hierarchy, removing heavy tab emphasis, and hiding `第1/2/3周` UI from plan/record pages.

**Tech Stack:** Native WeChat Mini Program (`JS`, `WXML`, `WXSS`)

---

## File Structure

**Modify**

- `app.wxss`
- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/index/index.wxss`
- `pages/record/record.js`
- `pages/record/record.wxml`
- `pages/record/record.wxss`
- `pages/nutrition/nutrition.wxml`
- `pages/nutrition/nutrition.wxss`
- `pages/history/history.wxml`
- `pages/history/history.wxss`
- `pages/stats/stats.wxml`
- `pages/stats/stats.wxss`

**Verify**

- `app.json`
- `app.js`
- `pages/history/history.js`
- `pages/nutrition/nutrition.js`
- `pages/stats/stats.js`

## Task 1: Establish Air Health Global Tokens

**Files:**
- Modify: `app.wxss`

- [ ] **Step 1: Replace the current global color and surface tokens with the Air Health palette**

Update the `page` token block to this direction:

```css
page {
  --bg-page: #F6F7F9;
  --bg-elevated: #FFFFFF;
  --bg-soft: #EEF2F4;
  --bg-tint: #F9FBFC;
  --text-primary: #18222D;
  --text-secondary: #5F6B76;
  --text-tertiary: #8D98A3;
  --line-soft: #E6EBEF;
  --accent-primary: #D85A6A;
  --accent-primary-soft: rgba(216, 90, 106, 0.10);
  --accent-blue: #7F97AD;
  --accent-blue-soft: rgba(127, 151, 173, 0.12);
  --accent-green: #74B89A;
  --accent-green-soft: rgba(116, 184, 154, 0.14);
  --accent-amber: #D6A15E;
  --shadow-soft: 0 12rpx 36rpx rgba(24, 34, 45, 0.06);
  --shadow-card: 0 8rpx 24rpx rgba(24, 34, 45, 0.04);
  --radius-card: 28rpx;
  --radius-block: 22rpx;
  --radius-pill: 999rpx;
}
```

- [ ] **Step 2: Update shared containers, cards, buttons, headers, and tabs to the lighter wellness system**

Implement this direction in `app.wxss`:

```css
.container {
  padding: 28rpx 24rpx 40rpx;
  min-height: 100vh;
  box-sizing: border-box;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.92), rgba(246, 247, 249, 0.96) 48%),
    linear-gradient(180deg, #F9FAFB 0%, #F4F6F8 100%);
}

.card {
  background: rgba(255, 255, 255, 0.96);
  border: 1rpx solid var(--line-soft);
  border-radius: var(--radius-card);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.page-header {
  padding: 16rpx 4rpx 34rpx;
}

.page-title {
  font-size: 46rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  color: var(--text-primary);
}

.page-desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.7;
}
```

- [ ] **Step 3: Soften the shared button system**

Implement this button direction:

```css
.btn-primary {
  border-radius: 22rpx;
  background: linear-gradient(135deg, #D85A6A 0%, #C94E62 100%);
  color: #FFFFFF;
  box-shadow: 0 10rpx 26rpx rgba(216, 90, 106, 0.22);
}

.btn-secondary {
  border-radius: 22rpx;
  border: 1rpx solid rgba(127, 151, 173, 0.26);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-primary);
}
```

- [ ] **Step 4: Reduce the visual weight of the global `.tab-bar` pattern**

Update the tab base:

```css
.tab-bar {
  display: flex;
  padding: 8rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.86);
  border: 1rpx solid var(--line-soft);
  box-shadow: var(--shadow-card);
}

.tab-item {
  border-radius: 18rpx;
  color: var(--text-secondary);
}

.tab-item.active {
  background: #FFFFFF;
  color: var(--text-primary);
  box-shadow: 0 8rpx 20rpx rgba(24, 34, 45, 0.06);
}
```

- [ ] **Step 5: Verify the shared file parses and keep the style system coherent**

Run:

```powershell
Get-Content app.wxss -Raw
```

Expected:

```text
The new token names and softened card/button/tab styles are present with no truncated blocks.
```

## Task 2: Redesign the Training Plan Page and Remove Visible Week Tabs

**Files:**
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`

- [ ] **Step 1: Remove visible week-switching UI and simplify page state**

Update `pages/index/index.js` so the page no longer depends on visible week tabs.

Use this direction:

```js
data: {
  trainingDays: [],
  notice: '',
  guideVisible: false,
  activeGuide: null
}
```

And in `loadPlanData()` derive a single visible plan view:

```js
const trainingDays = plan.days.map(day => ({
  ...day,
  exercises: day.exercises.map(exercise => ({
    ...exercise,
    currentPlan: exercise.weeks[1]
  }))
}));
```

- [ ] **Step 2: Remove the week tab block from `index.wxml` and replace the header with a calmer overview**

Replace the top section structure with:

```xml
<view class="page-header air-header">
  <view class="air-header-copy">
    <view class="page-title">训练计划</view>
    <view class="page-desc">更轻盈地查看今天要练什么，保持稳定记录与恢复节奏。</view>
  </view>
  <view class="plan-badge">当前启用计划</view>
</view>
```

- [ ] **Step 3: Reframe each day card into a premium overview card**

Use this layout direction:

```xml
<view class="day-card card fade-in" wx:for="{{trainingDays}}" wx:key="id">
  <view class="day-hero">
    <view class="day-hero-copy">
      <text class="day-icon">{{item.icon}}</text>
      <view class="day-info">
        <text class="day-name">{{item.name}}</text>
        <text class="day-count">{{item.exercises.length}} 个动作</text>
      </view>
    </view>
    <view class="day-badge">Day {{dayIndex + 1}}</view>
  </view>
```

- [ ] **Step 4: Restyle exercise metadata into pills and soften notes**

In `index.wxml`, keep the guide entry and exercise details, but move toward:

```xml
<view class="exercise-detail">
  <text class="detail-pill">组数 {{exercise.currentPlan.sets}}</text>
  <text class="detail-pill">次数 {{exercise.currentPlan.reps}}</text>
</view>
```

And note styling should remain advisory:

```xml
<view class="exercise-note" wx:if="{{exercise.currentPlan.note}}">
  <text class="note-label">提示</text>
  <text class="note-text">{{exercise.currentPlan.note}}</text>
</view>
```

- [ ] **Step 5: Apply Air Health page-specific styles in `index.wxss`**

Add or update:

```css
.air-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.plan-badge {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(127, 151, 173, 0.12);
  color: #5E7387;
  font-size: 22rpx;
  font-weight: 600;
}

.day-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0 18rpx;
}
```

- [ ] **Step 6: Verify there is no visible week selector left on the page**

Run:

```powershell
rg -n "switchWeek|data-week|第 1 周|第 2 周|第 3 周" pages/index
```

Expected:

```text
No visible week-tab markup remains in pages/index/index.wxml, and any leftover week logic has been removed or is no longer user-facing.
```

## Task 3: Redesign the Record Page and Remove Visible Week Tabs

**Files:**
- Modify: `pages/record/record.js`
- Modify: `pages/record/record.wxml`
- Modify: `pages/record/record.wxss`

- [ ] **Step 1: Remove visible week-switching from `record.js`**

Make the page default to a single displayed plan layer:

```js
data: {
  today: '',
  todayStr: '',
  selectedDayIndex: -1,
  dayOptions: [],
  exercises: [],
  currentDayColor: '',
  completedCount: 0,
  progressPercent: 0,
  guideVisible: false,
  activeGuide: null,
  restTimerVisible: false
}
```

When reading training plans for display, use the single visible plan week:

```js
const week = 1;
```

Preserve old saved records by continuing to respect `record.week || 1` when loading existing history.

- [ ] **Step 2: Remove the week selector block from `record.wxml`**

Delete the visible `week-selector tab-bar` section entirely so the record page no longer presents `第1/2/3周`.

- [ ] **Step 3: Build a calmer session header and softer day selector**

Update the top structure toward:

```xml
<view class="session-summary card">
  <view class="session-summary-top">
    <text class="session-date">{{today}}</text>
    <text class="session-progress">{{progressPercent}}%</text>
  </view>
  <text class="session-caption">记录每一次训练完成情况，保持节奏，不必着急。</text>
</view>
```

- [ ] **Step 4: Restyle exercise cards to make the set table the visual center**

In `record.wxml`, keep:

- previous summary
- copy-last-weight chip
- overload suggestion
- guide modal
- rest timer

But group them in a lighter hierarchy:

```xml
<view class="record-meta">
  <view class="previous-summary" wx:if="{{item.previousSummary}}">
    ...
  </view>
  <view class="record-actions">
    ...
  </view>
  <view class="suggestion-banner" wx:if="{{item.overloadSuggestion.show}}">
    ...
  </view>
</view>
```

- [ ] **Step 5: Apply Air Health styles in `record.wxss`**

Use the following direction:

```css
.session-summary {
  padding: 28rpx 30rpx;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,251,252,0.96));
}

.exercise-record-card {
  border: 1rpx solid var(--line-soft);
  border-radius: 28rpx;
  box-shadow: var(--shadow-card);
}

.previous-summary,
.suggestion-banner,
.guide-video-card,
.rest-timer-card {
  border-radius: 20rpx;
}
```

- [ ] **Step 6: Verify core interactions remain wired after the UI restructure**

Run:

```powershell
rg -n "copyLastWeight|openGuide|copyGuideVideoUrl|startRestTimer|closeRestTimer|restartRestTimer" pages/record
```

Expected:

```text
All current training interactions remain present after the week-selector removal and UI restyle.
```

## Task 4: Redesign the Nutrition Page into a Trusted Daily Intake View

**Files:**
- Modify: `pages/nutrition/nutrition.wxml`
- Modify: `pages/nutrition/nutrition.wxss`
- Verify: `pages/nutrition/nutrition.js`

- [ ] **Step 1: Reframe the page header and daily overview**

Update the top section in `nutrition.wxml` toward:

```xml
<view class="page-header air-header">
  <view>
    <view class="page-title">营养扫描</view>
    <view class="page-desc">{{todayCN}} · 记录饮食摄入与估算营养值</view>
  </view>
</view>
```

And restyle the daily overview as a calmer dashboard.

- [ ] **Step 2: Turn scan entry points into a premium action group**

Keep existing actions:

- 拍照识别
- 相册选择
- 手动添加

But reorganize them into a cleaner action block:

```xml
<view class="scan-action-panel card">
  <view class="scan-panel-header">
    <text class="card-title">添加今日饮食</text>
  </view>
  <view class="scan-btn-group">
    ...
  </view>
</view>
```

- [ ] **Step 3: Make AI result and manual input cards feel safer and more editable**

Ensure the result card visually communicates:

- estimated values
- user review required
- editable/confirm-first posture

Introduce a soft estimate marker:

```xml
<text class="estimate-badge">估算值</text>
```

- [ ] **Step 4: Restyle food log cards and macro chips**

Use lighter tags and calmer card grouping so the page reads as a wellness journal rather than an AI tool.

- [ ] **Step 5: Update `nutrition.wxss` to match Air Health**

Add styles like:

```css
.estimate-badge {
  display: inline-flex;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(214, 161, 94, 0.14);
  color: #B07A3F;
  font-size: 20rpx;
  font-weight: 700;
}
```

- [ ] **Step 6: Verify no nutrition logic was changed during the UI pass**

Run:

```powershell
rg -n "takePhoto|chooseFromAlbum|manualAdd|submitManualForm|addToDaily|deleteFood" pages/nutrition
```

Expected:

```text
All existing nutrition actions remain present and only the presentation layer has been reworked.
```

## Task 5: Redesign the History Page with Calendar as Visual Hero

**Files:**
- Modify: `pages/history/history.wxml`
- Modify: `pages/history/history.wxss`
- Verify: `pages/history/history.js`

- [ ] **Step 1: Keep the training calendar at the top but make it feel like a wellness journal**

Reframe the training tab section:

```xml
<view class="calendar-card card fade-in">
  <view class="calendar-shell">
    ...
  </view>
</view>
```

- [ ] **Step 2: Reduce the visual weight of the training/nutrition tab switch**

Leave the logic intact but make the tab bar calmer and more integrated with the page.

- [ ] **Step 3: Restyle history cards into lighter journal entries**

In `history.wxml`, keep:

- date
- badge
- completion rate
- detail open behavior

But reduce strong borders and loud stats blocks.

- [ ] **Step 4: Apply scoped styles in `history.wxss`**

Use a direction like:

```css
.calendar-card {
  padding: 24rpx 24rpx 28rpx;
}

.calendar-day {
  border-radius: 18rpx;
  background: rgba(255,255,255,0.78);
  border: 1rpx solid var(--line-soft);
}
```

- [ ] **Step 5: Verify calendar interactions remain intact after restyling**

Run:

```powershell
rg -n "switchMonth|selectCalendarDay|openTrainingDetailByDate|toggleNutritionDetail" pages/history
```

Expected:

```text
History page interaction handlers remain unchanged while the page visuals are upgraded.
```

## Task 6: Redesign the Stats Page into a Weekly Summary

**Files:**
- Modify: `pages/stats/stats.wxml`
- Modify: `pages/stats/stats.wxss`
- Verify: `pages/stats/stats.js`

- [ ] **Step 1: Turn the top stats block into a calm summary hero**

Update the hero area in `stats.wxml` toward:

```xml
<view class="stats-hero card">
  <view class="hero-copy">
    <text class="hero-title">本周训练概览</text>
    <text class="hero-subtitle">用更轻的方式看见自己的训练节奏。</text>
  </view>
  ...
</view>
```

- [ ] **Step 2: Soften distribution, completion, recent days, and nutrition sections**

Keep all current data sections but reduce dashboard heaviness:

- lighter progress bars
- quieter labels
- cleaner metric spacing
- less dense card chrome

- [ ] **Step 3: Update `stats.wxss` with editorial summary styling**

Add or update:

```css
.stats-hero,
.distribution-card,
.completion-card,
.recent-card,
.nutrition-stats-card {
  border: 1rpx solid var(--line-soft);
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 4: Verify stats logic still matches the existing bindings**

Run:

```powershell
rg -n "stats\\.totalDays|stats\\.completionRate|recentDays|nutritionStats" pages/stats
```

Expected:

```text
The redesigned page still binds to the same stats data shape.
```

## Task 7: Final UI Verification

**Files:**
- Verify: `app.wxss`
- Verify: `pages/index/index.*`
- Verify: `pages/record/record.*`
- Verify: `pages/nutrition/nutrition.*`
- Verify: `pages/history/history.*`
- Verify: `pages/stats/stats.*`

- [ ] **Step 1: Confirm visible week selectors are gone from plan and record pages**

Run:

```powershell
rg -n "第 1 周|第 2 周|第 3 周|data-week|switchWeek" pages/index pages/record
```

Expected:

```text
No user-facing week-tab markup remains on the plan or record pages.
```

- [ ] **Step 2: Confirm key visual markers exist across redesigned pages**

Run:

```powershell
rg -n "air-header|plan-badge|session-summary|estimate-badge|calendar-card|hero-title" app.wxss pages
```

Expected:

```text
The new Air Health UI markers appear in the expected files.
```

- [ ] **Step 3: Manual verification in WeChat DevTools**

Checklist:

```text
1. 首页不再显示第1/2/3周切换，整体更轻、更干净。
2. 开始训练页不再显示第1/2/3周切换，训练卡片层级更清晰。
3. 训练记录页的休息计时、复制上次重量、教学弹层仍然可用。
4. 营养扫描页仍能拍照、选图、手动添加，页面更像健康记录页。
5. 历史页月历与列表都正常显示，切月与点选详情不受影响。
6. 数据统计页数据仍正常显示，没有因为 UI 改版丢失绑定。
```

- [ ] **Step 4: Regression-check existing functionality after the visual pass**

Checklist:

```text
1. 原有训练记录仍可保存和加载。
2. 原有饮食记录仍可保存和删除。
3. 历史记录与统计页仍能读取旧数据。
4. 所有新增教学入口、计时器和日历功能仍保持可用。
```

## Self-Review Notes

- Spec coverage:
  - Air Health visual system: Task 1
  - Training plan redesign: Task 2
  - Record page redesign and visible week removal: Task 3
  - Nutrition redesign: Task 4
  - History redesign: Task 5
  - Stats redesign: Task 6
  - Whole-app verification and visible week removal confirmation: Task 7
- Placeholder scan:
  - No `TODO` / `TBD`
  - All tasks use exact files and direct validation commands
- Type consistency:
  - Shared visual markers use consistent names: `air-header`, `session-summary`, `estimate-badge`, `plan-badge`
  - Week removal is consistently applied to both `pages/index` and `pages/record`
