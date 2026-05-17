# Rest Day / Recovery Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class `休息日 / 恢复日` support to default plans, custom plans, record flow, history calendar, and stats without breaking existing training, nutrition, or AI scan features.

**Architecture:** Extend the existing `plan.days[]` model with `type: 'training' | 'rest'`, then branch behavior at the utility, plan-page, record-page, history, and stats layers. Reuse current `training_YYYY-MM-DD` and `training_dates` storage so rest records participate in history and continuity without creating a second storage system.

**Tech Stack:** Native WeChat Mini Program (`Page`, `wx.setStorageSync`, `wx.getStorageSync`), JS/WXML/WXSS, local utility modules in `utils/`.

---

## Current Code Touchpoints

Before implementation, keep these existing behaviors in mind:

- `app.refreshTrainingPlanState()` caches:
  - `trainingPlan`
  - `trainingPlans`
  - `activePlanId`
  - `dayTypes`
- `pages/record/record.js` currently assumes every selected day has `exercises`
- `pages/history/history.js` currently assumes every training record is exercise-based
- `pages/stats/stats.js` currently treats every saved training date as a workout date
- `utils/workout-plan.js` currently truncates custom plans through `MAX_CUSTOM_DAYS`
- `utils/util.js` currently stores training records through:
  - `saveTrainingRecord(date, record)`
  - `getTrainingRecord(date)`
  - `getTrainingDates()`

The implementation must update these assumptions without creating a second rest-day-only system.

## File Structure

### Existing files to modify

- `utils/workout-plan.js`
  - Extend day normalization to preserve `type`, `focus`, `description`, `note`
  - Add built-in Day 4 rest day
  - Remove custom plan 3-day cap
  - Add helpers for creating and normalizing custom rest days

- `utils/util.js`
  - Add rest-day helpers
  - Update calendar generation to emit rest-day display type
  - Update stats to separate workout counts and rest-day counts
  - Keep backward compatibility for old records without `type`

- `pages/index/index.js`
  - Load/render rest days in plan list
  - Support adding custom rest days in plan draft
  - Save custom rest days without exercise arrays

- `pages/index/index.wxml`
  - Add distinct rest-day card UI
  - Add `添加休息日` editor action
  - Add rest-day draft form that hides exercise editor

- `pages/index/index.wxss`
  - Add rest-day card and rest-day editor styles

- `pages/record/record.js`
  - Branch record flow between training day and rest day
  - Load existing rest records
  - Save rest check-in records

- `pages/record/record.wxml`
  - Add rest-day check-in form
  - Hide exercise table/save CTA for rest days

- `pages/record/record.wxss`
  - Style rest-day check-in UI

- `pages/history/history.js`
  - Render rest records in training history list
  - Add calendar legend entry for rest day
  - Open rest-day detail modal

- `pages/history/history.wxml`
  - Add rest-day card branch
  - Add rest-day detail branch

- `pages/history/history.wxss`
  - Style rest-day cards, tags, and detail panel

- `pages/stats/stats.js`
  - Expose rest-day counts and plan-recorded day counts
  - Update recent 7-day markers if needed for rest-day distinction

- `pages/stats/stats.wxml`
  - Add rest-day metric to overview
  - Add plan-recorded day summary copy

- `pages/stats/stats.wxss`
  - Style new metrics without disturbing existing layout

### No new storage keys

- Keep using:
  - `training_YYYY-MM-DD`
  - `training_dates`
  - `workout_plans`
  - `active_plan_id`

## Canonical Shapes

### Canonical day shape

Every normalized day should match one of these two variants:

```js
// training day
{
  id: 'day1',
  type: 'training',
  name: '胸肩三头',
  icon: '🏋️',
  color: '#D97878',
  focus: '',
  description: '',
  note: '',
  exercises: [...]
}
```

```js
// rest day
{
  id: 'day4_rest',
  type: 'rest',
  name: '休息日',
  icon: '🌿',
  color: '#8FB8AA',
  focus: '恢复 · 拉伸 · 放松',
  description: '恢复也是训练计划的一部分。今天可以轻松活动、拉伸或完全休息。',
  note: '今天可以散步、拉伸、早睡，帮助身体恢复。',
  exercises: []
}
```

### Canonical record shapes

```js
// workout record
{
  date: 'YYYY-MM-DD',
  planId: 'builtin_air_split_foundation',
  planName: '...',
  dayId: 'day1',
  dayName: '胸肩三头',
  dayType: 'day1', // optional legacy compatibility
  dayColor: '#D97878',
  week: 1,
  exercises: [...],
  completionRate: 80
}
```

```js
// rest record
{
  date: 'YYYY-MM-DD',
  type: 'rest',
  planId: 'builtin_air_split_foundation',
  planName: '...',
  dayId: 'day4_rest',
  dayName: '休息日',
  dayColor: '#8FB8AA',
  restCompleted: true,
  feeling: '有点疲劳',
  note: '',
  createdAt: '...'
}
```

## Compatibility Matrix

Use this table as the source of truth while branching UI and stats logic:

| Case | `type` | `exercises` | Treat as |
| --- | --- | --- | --- |
| Old workout record | missing | array | workout |
| New workout record | missing or `training` | array | workout |
| Rest record | `rest` | missing or empty array | rest |
| Broken/partial record | missing | missing | ignore exercise metrics, but avoid crash |

Additional rules:

- `record.type === 'rest'` is the only condition that should force rest-record behavior
- Missing `day.type` on plan data should always fall back to `training`
- Missing `planId`, `dayId`, `dayColor`, or `planName` must never crash history or stats

## Task 1: Extend Plan Model For Rest Days

**Files:**
- Modify: `utils/workout-plan.js`
- Test: manual inspection via `app.refreshTrainingPlanState()` consumers

- [ ] **Step 1: Add built-in rest-day constants and day factories**

Update `utils/workout-plan.js` so built-in days and custom days both support `type`, `focus`, `description`, and `note`.

Use shapes like:

```js
const DEFAULT_REST_DAY_COLOR = '#8FB8AA';

function createCustomTrainingDay(index) {
  return {
    id: `custom_day_${Date.now()}_${index}`,
    type: 'training',
    name: '',
    icon: ['🏋️', '💪', '🔥'][index] || '🏋️',
    color: ['#D97878', '#7CB8D6', '#6FBF97'][index] || '#D97878',
    exercises: [createDraftExercise()]
  };
}

function createCustomRestDay(index) {
  return {
    id: `custom_rest_${Date.now()}_${index}`,
    type: 'rest',
    name: '休息日',
    icon: '🌿',
    color: DEFAULT_REST_DAY_COLOR,
    focus: '恢复',
    description: '用于安排恢复、拉伸或轻度活动。',
    note: '',
    exercises: []
  };
}
```

- [ ] **Step 2: Append built-in Day 4 rest day**

Update the built-in `days` array so Day 4 is:

```js
{
  id: 'day4_rest',
  type: 'rest',
  name: '休息日',
  icon: '🌿',
  color: DEFAULT_REST_DAY_COLOR,
  focus: '恢复 · 拉伸 · 放松',
  description: '恢复也是训练计划的一部分。今天可以轻松活动、拉伸或完全休息。',
  note: '今天可以散步、拉伸、早睡，帮助身体恢复。',
  exercises: []
}
```

- [ ] **Step 3: Remove custom 3-day cap**

Delete or stop enforcing the current `MAX_CUSTOM_DAYS = 3` cap so `normalizePlan()` keeps all custom days.

The normalization behavior should be:

```js
const normalizedDays = Array.isArray(plan.days)
  ? plan.days.map((day, dayIndex) => normalizeDay(day, dayIndex)).filter(Boolean)
  : [];
```

No `.slice(0, MAX_CUSTOM_DAYS)`.

- [ ] **Step 4: Preserve rest-day fields in normalization**

Adjust `normalizeDay(day, dayIndex)` so it supports both training and rest days:

```js
function normalizeDay(day, dayIndex) {
  const type = day && day.type === 'rest' ? 'rest' : 'training';

  return {
    id: day.id || `${type}_day_${dayIndex + 1}`,
    type,
    name: day.name || (type === 'rest' ? '休息日' : `训练日 ${dayIndex + 1}`),
    icon: day.icon || (type === 'rest' ? '🌿' : '🏋️'),
    color: day.color || (type === 'rest' ? DEFAULT_REST_DAY_COLOR : '#D97878'),
    focus: day.focus || '',
    description: day.description || '',
    note: day.note || '',
    exercises: type === 'rest'
      ? []
      : normalizeExercises(day.exercises, dayIndex)
  };
}
```

- [ ] **Step 4.1: Keep built-in exercise guide behavior intact**

When updating `normalizeDay()` and built-in plan data, do not remove or bypass the current built-in exercise guide injection behavior in `createExercise()`.

Expected preserved behavior:

- built-in training exercises still receive the shared Douyin teaching link
- custom exercises still sanitize their own `videoUrl`
- rest days do not need guide objects because they have no exercises

- [ ] **Step 5: Run a syntax check**

Run: `node --check .\utils\workout-plan.js`

Expected: no output, exit code `0`

- [ ] **Step 6: Commit**

```bash
git add utils/workout-plan.js
git commit -m "feat: add rest day support to workout plans"
```

## Task 2: Add Rest-Day Utility Helpers And Stats Compatibility

**Files:**
- Modify: `utils/util.js`
- Test: manual syntax check and targeted logic spot-check

- [ ] **Step 1: Add day/record helpers**

Add these helpers near other training helpers:

```js
function isRestDay(day) {
  return !!(day && day.type === 'rest');
}

function isRestRecord(record) {
  return !!(record && record.type === 'rest');
}

function getRecordType(record) {
  if (isRestRecord(record)) {
    return 'rest';
  }

  return 'training';
}
```

- [ ] **Step 2: Add rest-record factory**

Add:

```js
function createRestRecord(day, plan, date, formData) {
  return {
    date,
    type: 'rest',
    planId: plan && plan.id ? plan.id : '',
    planName: plan && plan.title ? plan.title : '',
    dayId: day && day.id ? day.id : '',
    dayName: day && day.name ? day.name : '休息日',
    dayColor: day && day.color ? day.color : '#8FB8AA',
    restCompleted: formData ? !!formData.restCompleted : true,
    feeling: formData && formData.feeling ? formData.feeling : '',
    note: formData && formData.note ? formData.note : '',
    createdAt: new Date().toISOString()
  };
}
```

- [ ] **Step 3: Update calendar record typing**

Add:

```js
function getCalendarRecordType(record) {
  if (isRestRecord(record)) {
    return 'rest';
  }

  return getRecordDayId(record) || record.dayType || 'training';
}
```

Then update `getTrainingCalendarData(year, month)` so each day item can emit:

```js
{
  day,
  date: dateStr,
  hasRecord: true,
  dayType: getCalendarRecordType(record),
  dayName: record.dayName || '',
  recordType: isRestRecord(record) ? 'rest' : 'training',
  color: record.dayColor || ''
}
```

- [ ] **Step 4: Split workout counts from rest-day counts**

Add:

```js
function getTrainingCount(records) {
  return records.filter(record => !isRestRecord(record)).length;
}

function getRestDayCount(records) {
  return records.filter(record => isRestRecord(record)).length;
}
```

Then update `getTrainingStats()` so:

- `totalDays` becomes workout-record count only
- add `restDays`
- add `planRecordedDays = totalDays + restDays`
- exercise/completion counts skip rest records

Use branching like:

```js
records.forEach(record => {
  if (isRestRecord(record)) {
    restDays += 1;
    return;
  }

  // existing workout exercise counting logic
});
```

- [ ] **Step 4.1: Keep distribution logic meaningful**

When building `distributionGroups`, keep workout day distribution unchanged, and add rest records as a valid additional distribution item.

Recommended rule:

```js
const distributionKey = isRestRecord(record)
  ? 'rest'
  : (record.dayId || record.dayType || record.dayName || 'unknown');
```

Recommended label:

```js
const distributionName = isRestRecord(record)
  ? (record.dayName || '休息日')
  : (record.dayName || record.dayId || '训练记录');
```

- [ ] **Step 4.2: Do not inflate completion rate with rest days**

`completionRate` in `getTrainingStats()` must remain based on exercise completion only.

That means:

- rest records increase `restDays`
- rest records increase `planRecordedDays`
- rest records do **not** increase `totalExercises`
- rest records do **not** increase `completedExercises`

- [ ] **Step 5: Keep streak behavior intact**

Do not change `calcStreak()` behavior. Since rest records still write to `training_dates`, streak should continue counting recorded days naturally.

- [ ] **Step 6: Export new helpers**

Ensure `module.exports` includes:

```js
isRestDay,
isRestRecord,
createRestRecord,
getTrainingCount,
getRestDayCount,
getCalendarRecordType,
```

- [ ] **Step 7: Run syntax check**

Run: `node --check .\utils\util.js`

Expected: no output, exit code `0`

- [ ] **Step 8: Commit**

```bash
git add utils/util.js
git commit -m "feat: add rest day utility and stats helpers"
```

## Task 3: Add Rest-Day Support To Training Plan Page And Custom Plan Editor

**Files:**
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`
- Depends on: `utils/workout-plan.js`, `utils/util.js`

- [ ] **Step 1: Add rest-day draft creators and branch logic in `index.js`**

Introduce day-type-aware draft creators:

```js
function createDraftDay(index) {
  return {
    type: 'training',
    name: '',
    icon: ['🏋️', '💪', '🔥'][index] || '🏋️',
    color: ['#D97878', '#7CB8D6', '#6FBF97'][index] || '#D97878',
    exercises: [createDraftExercise()]
  };
}

function createDraftRestDay(index) {
  return {
    type: 'rest',
    name: '休息日',
    icon: '🌿',
    color: '#8FB8AA',
    focus: '恢复',
    description: '用于安排恢复、拉伸或轻度活动。',
    note: '',
    exercises: []
  };
}
```

Add handlers:

```js
addDraftTrainingDay() { ...days.push(createDraftDay(days.length)); ... }
addDraftRestDay() { ...days.push(createDraftRestDay(days.length)); ... }
```

- [ ] **Step 2: Update exercise totals and plan summaries**

Where the page computes `exerciseTotal`, make sure rest days contribute `0`:

```js
const exerciseTotal = trainingDays.reduce(
  (total, day) => total + (Array.isArray(day.exercises) ? day.exercises.length : 0),
  0
);
```

Add rest metadata per displayed day:

```js
const trainingDays = plan.days.map(day => ({
  ...day,
  isRestDay: day.type === 'rest',
  restFocus: day.focus || '',
  restDescription: day.description || '',
  restNote: day.note || '',
  exercises: Array.isArray(day.exercises)
    ? day.exercises.map(...)
    : []
}));
```

- [ ] **Step 2.1: Keep existing plan title override**

`pages/index/index.js` currently overrides the built-in display title through:

- `BUILTIN_PLAN_ID`
- `BUILTIN_PLAN_TITLE`

Do not remove that behavior while adding rest-day support. The built-in plan should still display as the current named split plan, just with an added Day 4 rest day.

- [ ] **Step 3: Render rest-day card branch in `index.wxml`**

Inside the day card loop, branch on `item.isRestDay`.

For rest day show:

```xml
<text class="day-name">{{item.name}}</text>
<text class="day-summary">{{item.focus || '恢复 · 拉伸 · 放松'}}</text>
<view class="rest-day-copy">
  <text class="rest-day-desc">{{item.description || '恢复也是训练计划的一部分。'}}</text>
  <text class="rest-day-tip">{{item.note || '今天可以散步、拉伸、早睡，帮助身体恢复。'}}</text>
</view>
```

Hide exercise list for rest days and change CTA text:

```xml
<view class="btn-primary start-btn" ...>
  {{item.isRestDay ? '记录休息' : '开始今日训练'}}
</view>
```

- [ ] **Step 4: Add `添加休息日` in create-plan modal**

In the create-plan modal footer area under days, add both actions:

```xml
<view class="draft-add-action" bindtap="addDraftTrainingDay">添加训练日</view>
<view class="draft-add-action secondary" bindtap="addDraftRestDay">添加休息日</view>
```

For each draft day, branch the form:

- if `item.type === 'rest'`
  - show `名称`
  - show `恢复说明`
  - show `备注`
  - hide exercise repeater
- else
  - keep current exercise editing UI

- [ ] **Step 4.1: Persist rest-day note on custom plans**

For rest-day draft input bindings, add and save:

- `name`
- `focus`
- `description`
- `note`

Do not overload `notice` for per-day recovery copy. Per-day rest content must stay on the day object itself.

- [ ] **Step 5: Add rest-day styles in `index.wxss`**

Add styles such as:

```css
.rest-day-copy {
  margin-top: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: linear-gradient(180deg, #F4FBF8 0%, #EEF7F4 100%);
  border: 1rpx solid rgba(143, 184, 170, 0.22);
}

.rest-day-desc {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.75;
}

.rest-day-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #6F8F86;
  line-height: 1.7;
}
```

- [ ] **Step 6: Run syntax check**

Run:

```bash
node --check .\pages\index\index.js
```

Expected: no output, exit code `0`

- [ ] **Step 7: Commit**

```bash
git add pages/index/index.js pages/index/index.wxml pages/index/index.wxss
git commit -m "feat: add rest day support to plan page and custom plans"
```

## Task 4: Add Rest-Day Check-In Flow To Record Page

**Files:**
- Modify: `pages/record/record.js`
- Modify: `pages/record/record.wxml`
- Modify: `pages/record/record.wxss`
- Depends on: `utils/util.js`, `utils/workout-plan.js`

- [ ] **Step 1: Add rest-form state in `record.js`**

Add default state:

```js
function getDefaultRestForm() {
  return {
    restCompleted: true,
    feeling: '精力不错',
    note: ''
  };
}
```

Include in page data:

```js
isRestDay: false,
currentDayInfo: null,
restForm: getDefaultRestForm(),
```

- [ ] **Step 2: Detect rest day during load**

Inside `loadExercises(savedRecord, preferredDayId)`, before exercise mapping:

```js
const isRestDay = util.isRestDay(day);

if (isRestDay) {
  const restForm = matchedRecord && matchedRecord.type === 'rest'
    ? {
        restCompleted: matchedRecord.restCompleted !== false,
        feeling: matchedRecord.feeling || '精力不错',
        note: matchedRecord.note || ''
      }
    : getDefaultRestForm();

  this.clearRestTimer();
  this.setData({
    isRestDay: true,
    currentDayInfo: day,
    exercises: [],
    currentDayColor: day.color,
    selectedDayDisplay: `${day.icon} ${day.name}`,
    sessionStatusText: matchedRecord ? '已保存休息记录' : '等待保存',
    hasExistingRecord: !!matchedRecord,
    restForm,
    ...getDefaultRestTimerData(),
    ...this.getProgressData([])
  });
  return;
}
```

Reset `isRestDay` to `false` for training branch.

- [ ] **Step 2.1: Make sure existing saved workout records still restore**

Do not change the current `restoreRecord(record)` and `getMatchedRecord()` behavior in a way that breaks:

- saved workout records with `exercises`
- old records missing `type`
- re-opening an already saved training day and restoring set data

Rest branching must be additive, not a rewrite of workout restoration.

- [ ] **Step 3: Add rest-form handlers**

Add:

```js
onRestCompletedChange(e) {
  this.setData({
    'restForm.restCompleted': !!e.detail.value
  });
}

onRestFeelingSelect(e) {
  this.setData({
    'restForm.feeling': e.currentTarget.dataset.value || ''
  });
}

onRestNoteInput(e) {
  this.setData({
    'restForm.note': e.detail.value
  });
}
```

- [ ] **Step 4: Branch `saveRecord()` for rest day**

At the top of `saveRecord()`:

```js
if (this.data.isRestDay) {
  const day = this.currentPlan.days[this.data.selectedDayIndex];
  const record = util.createRestRecord(
    day,
    this.currentPlan,
    this.data.todayStr || util.getToday(),
    this.data.restForm
  );

  util.saveTrainingRecord(record);
  this.setData({
    sessionStatusText: '已保存休息记录',
    hasExistingRecord: true
  });

  wx.showToast({
    title: '已保存休息记录',
    icon: 'success'
  });
  return;
}
```

Leave the existing workout save logic untouched below this branch.

- [ ] **Step 4.1: Preserve existing workout save payload**

For normal training days, keep storing the current fields already used elsewhere:

- `planId`
- `planName` or `planTitle`
- `dayId`
- `dayName`
- `dayColor`
- `week`
- `exercises`
- `completionRate`

Do not refactor the workout payload shape during this task.

- [ ] **Step 5: Add rest UI to `record.wxml`**

Add a branch after day selector:

```xml
<view class="rest-checkin card" wx:if="{{isRestDay}}">
  <view class="rest-checkin-header">
    <text class="rest-checkin-title">今日为休息日 / 恢复日</text>
    <text class="rest-checkin-subtitle">{{currentDayInfo.description || '恢复也是训练计划的一部分。'}}</text>
  </view>

  <view class="rest-meta-pills">
    <view class="session-pill">
      <text class="session-pill-label">当前计划</text>
      <text class="session-pill-value">{{currentPlan.title}}</text>
    </view>
    <view class="session-pill">
      <text class="session-pill-label">日期</text>
      <text class="session-pill-value">{{today}}</text>
    </view>
  </view>

  <label class="rest-switch-row">
    <text class="rest-switch-label">完成休息打卡</text>
    <switch checked="{{restForm.restCompleted}}" bindchange="onRestCompletedChange" color="{{currentDayColor}}" />
  </label>

  <view class="rest-feeling-group">
    <text class="rest-section-label">今日感受</text>
    <view class="rest-feeling-options">
      <view class="rest-feeling-chip {{restForm.feeling === '精力不错' ? 'active' : ''}}" bindtap="onRestFeelingSelect" data-value="精力不错">精力不错</view>
      <view class="rest-feeling-chip {{restForm.feeling === '有点疲劳' ? 'active' : ''}}" bindtap="onRestFeelingSelect" data-value="有点疲劳">有点疲劳</view>
      <view class="rest-feeling-chip {{restForm.feeling === '需要恢复' ? 'active' : ''}}" bindtap="onRestFeelingSelect" data-value="需要恢复">需要恢复</view>
    </view>
  </view>

  <view class="rest-note-group">
    <text class="rest-section-label">简短备注</text>
    <textarea class="plan-textarea" value="{{restForm.note}}" bindinput="onRestNoteInput" placeholder="记录今天的恢复状态、拉伸安排或感受"></textarea>
  </view>
</view>

<view class="save-section" wx:if="{{isRestDay}}">
  <view class="btn-success save-btn" bindtap="saveRecord">保存休息记录</view>
</view>
```

Keep existing workout `wx:if="{{exercises.length > 0}}"` sections unchanged for training days.

- [ ] **Step 6: Add rest styles in `record.wxss`**

Add:

```css
.rest-checkin {
  padding: 30rpx 30rpx 32rpx;
  background: linear-gradient(180deg, #FCFEFD 0%, #F4FBF8 100%);
}

.rest-checkin-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.rest-feeling-chip.active {
  background: rgba(143, 184, 170, 0.18);
  border-color: rgba(143, 184, 170, 0.5);
  color: #5D7F74;
}
```

- [ ] **Step 7: Run syntax check**

Run:

```bash
node --check .\pages\record\record.js
```

Expected: no output, exit code `0`

- [ ] **Step 8: Commit**

```bash
git add pages/record/record.js pages/record/record.wxml pages/record/record.wxss
git commit -m "feat: add rest day check-in flow"
```

## Task 5: Render Rest Records In History And Calendar

**Files:**
- Modify: `pages/history/history.js`
- Modify: `pages/history/history.wxml`
- Modify: `pages/history/history.wxss`
- Depends on: `utils/util.js`

- [ ] **Step 1: Enrich training history mapping**

Update `loadTrainingRecords()` to branch rest vs workout:

```js
const isRest = util.isRestRecord(record);
const exercises = Array.isArray(record.exercises) ? record.exercises : [];

return {
  date: record.date,
  dateCN: util.formatDateCN(record.date),
  type: isRest ? 'rest' : 'training',
  dayName: record.dayName || (isRest ? '休息日' : '未知训练日'),
  dayType: util.getCalendarRecordType(record),
  dayId: util.getRecordDayId(record),
  planName: record.planName || record.planTitle || '',
  color: record.dayColor || (isRest ? '#8FB8AA' : colorMap[record.dayType] || '#D97878'),
  feeling: record.feeling || '',
  note: record.note || '',
  restCompleted: record.restCompleted !== false,
  completionRate: isRest ? 100 : (record.completionRate || 0),
  completedCount: isRest ? 0 : exercises.filter(item => item.completed).length,
  totalCount: isRest ? 0 : exercises.length,
  totalSets: isRest ? 0 : exercises.reduce((sum, item) => sum + (Array.isArray(item.sets) ? item.sets.length : 0), 0),
  exercises
};
```

- [ ] **Step 1.1: Keep delete flow shared**

`deleteRecord(date)` should continue to work for both workout records and rest records without creating a second delete path.

Expected result:

- deleting a rest record removes `training_YYYY-MM-DD`
- removes the date from `training_dates`
- refreshes training history and calendar normally

- [ ] **Step 2: Add dedicated rest legend entry**

Update `buildCalendarLegend(plan, trainingRecords)` so it always includes:

```js
legend.push({
  key: 'rest',
  label: '休息日',
  color: '#8FB8AA'
});
```

Avoid duplicate rest entries if one already exists.

- [ ] **Step 2.1: Keep workout legend entries visible**

Do not replace the whole legend with only `休息日`.

Expected order:

1. current-plan workout day entries that exist
2. one rest entry if rest records exist or current plan contains a rest day

- [ ] **Step 3: Branch rest cards in `history.wxml`**

Inside the training records loop, render rest records differently:

```xml
<view wx:if="{{item.type === 'rest'}}" class="history-card training-history-card rest-history-card card fade-in" ...>
  <view class="history-entry-top">
    <view class="history-date-section">
      <view class="history-date">{{item.dateCN}}</view>
      <view class="history-count">{{item.planName || '休息记录'}}</view>
    </view>
    <view class="history-badge rest" style="background: {{item.color}}18; color: {{item.color}};">休息</view>
  </view>
  <view class="history-entry-copy">
    <view class="history-entry-title">{{item.dayName}}</view>
    <view class="history-entry-note">{{item.feeling || '已记录恢复节奏'}}{{item.note ? ' · ' + item.note : ''}}</view>
  </view>
</view>
```

Keep existing workout card branch in `wx:else`.

- [ ] **Step 4: Branch detail modal for rest record**

In detail modal content, add:

```xml
<view wx:if="{{detailRecord.type === 'rest'}}" class="rest-detail">
  <view class="detail-meta">
    <view>{{detailRecord.dateCN}} · {{detailRecord.planName || '休息记录'}}</view>
  </view>
  <view class="rest-detail-card">
    <view class="completion-chip">{{detailRecord.restCompleted ? '已完成休息打卡' : '已记录恢复日'}}</view>
    <view class="rest-detail-row">今日感受：{{detailRecord.feeling || '未填写'}}</view>
    <view class="rest-detail-row">备注：{{detailRecord.note || '未填写'}}</view>
  </view>
</view>
```

Wrap current exercise-table detail block in `wx:else`.

- [ ] **Step 5: Add rest styles in `history.wxss`**

Add:

```css
.rest-history-card {
  background: linear-gradient(180deg, #FCFEFD 0%, #F4FBF8 100%);
}

.history-badge.rest {
  border: 1rpx solid rgba(143, 184, 170, 0.24);
}
```

- [ ] **Step 6: Run syntax check**

Run:

```bash
node --check .\pages\history\history.js
```

Expected: no output, exit code `0`

- [ ] **Step 7: Commit**

```bash
git add pages/history/history.js pages/history/history.wxml pages/history/history.wxss
git commit -m "feat: show rest day records in history and calendar"
```

## Task 6: Add Rest-Day Metrics To Stats Page

**Files:**
- Modify: `pages/stats/stats.js`
- Modify: `pages/stats/stats.wxml`
- Modify: `pages/stats/stats.wxss`
- Depends on: `utils/util.js`

- [ ] **Step 1: Surface rest metrics from stats loader**

Update `loadStats()` to expect `restDays` and `planRecordedDays` from `util.getTrainingStats()`:

```js
const stats = {
  ...rawStats,
  restDays: rawStats.restDays || 0,
  planRecordedDays: rawStats.planRecordedDays || ((rawStats.totalDays || 0) + (rawStats.restDays || 0)),
  uncompletedExercises: rawStats.totalExercises - rawStats.completedExercises
};
```

- [ ] **Step 2: Keep recent-days view compatible**

No need to change the basic `hasRecord` logic, but if you want a subtle rest marker, enrich each recent day:

```js
const record = util.getTrainingRecord(dateStr);
const recordType = util.isRestRecord(record) ? 'rest' : (record ? 'training' : '');
```

Then pass `recordType` into the recent-days item shape.

Optional visual distinction:

```xml
<view class="week-day-dot {{item.recordType === 'rest' ? 'rest' : ''}} {{item.hasRecord ? 'active' : ''}}">
```

If added, keep the existing training checkmark behavior for workout days.

- [ ] **Step 3: Update overview UI in `stats.wxml`**

Add a fourth metric:

```xml
<view class="hero-metric">
  <view class="hero-metric-value rest-value">{{stats.restDays}}</view>
  <view class="hero-metric-label">休息天数</view>
</view>
```

Add a compact summary line under the hero metrics:

```xml
<view class="hero-footnote">计划记录 {{stats.planRecordedDays}} 天 = 训练 {{stats.totalDays}} 次 + 休息 {{stats.restDays}} 天</view>
```

- [ ] **Step 4: Add minimal supporting styles**

In `stats.wxss`, add:

```css
.rest-value {
  color: #5F8B7E;
}

.hero-footnote {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: var(--text-hint);
  line-height: 1.7;
}
```

- [ ] **Step 5: Run syntax check**

Run:

```bash
node --check .\pages\stats\stats.js
```

Expected: no output, exit code `0`

- [ ] **Step 6: Commit**

```bash
git add pages/stats/stats.js pages/stats/stats.wxml pages/stats/stats.wxss
git commit -m "feat: add rest day metrics to stats"
```

## Task 7: Regression Verification

**Files:**
- Verify touched files only; no new source files required

- [ ] **Step 1: Run JS syntax verification**

Run:

```bash
node --check .\utils\workout-plan.js
node --check .\utils\util.js
node --check .\pages\index\index.js
node --check .\pages\record\record.js
node --check .\pages\history\history.js
node --check .\pages\stats\stats.js
```

Expected: all commands exit `0`

- [ ] **Step 2: Verify WXML structure manually**

Open these files and confirm all new `wx:if / wx:else` branches are balanced:

- `pages/index/index.wxml`
- `pages/record/record.wxml`
- `pages/history/history.wxml`
- `pages/stats/stats.wxml`

Expected: no unmatched tags, no duplicated rest/training branches

- [ ] **Step 3: Manual WeChat DevTools verification checklist**

Verify:

- built-in plan shows Day 4 rest day after Day 3
- custom plan can add multiple training days and rest days
- rest day in plan editor hides exercise inputs
- selecting rest day in record page shows check-in form only
- saving rest day writes a visible record into history
- calendar shows rest day with distinct color
- stats show rest-day count without inflating workout count
- old normal workout records still render
- nutrition page and AI scan still open and work visually

- [ ] **Step 3.1: Manual save/restore matrix**

Verify each of these exact scenarios:

- create a new rest record today and reopen it
- create a new workout record today and reopen it
- switch active plan, then open the record page again
- create a custom plan that mixes:
  - training day
  - rest day
  - training day
  - rest day
- save one rest record from a custom plan and confirm:
  - history card shows correct plan name
  - calendar color is correct
  - stats count it as rest only
- delete the rest record and verify:
  - history entry disappears
  - calendar marker disappears
  - stats decrement correctly

- [ ] **Step 3.2: Old-data compatibility smoke check**

Before finalizing, manually inspect at least one old workout record already stored in local storage and confirm:

- record page restore still works
- history card still renders
- stats still include it as workout data
- no `type`-related crash occurs

- [ ] **Step 4: Final commit**

```bash
git add utils/workout-plan.js utils/util.js pages/index/index.js pages/index/index.wxml pages/index/index.wxss pages/record/record.js pages/record/record.wxml pages/record/record.wxss pages/history/history.js pages/history/history.wxml pages/history/history.wxss pages/stats/stats.js pages/stats/stats.wxml pages/stats/stats.wxss
git commit -m "feat: support rest days across plans records history and stats"
```

## Self-Review

### Spec Coverage

- Default plan Day 4 rest day: Task 1
- Custom plans support rest day and unlimited days: Task 1, Task 3
- Record page rest-day branch: Task 4
- History and calendar support: Task 5
- Stats rest-day count and separation from workouts: Task 2, Task 6
- Old-data compatibility: Task 2, Task 5
- No breakage to nutrition and AI scan: Task 7 regression checklist

### Placeholder Scan

- No `TODO` or `TBD` markers remain
- Each task lists exact files and concrete implementation snippets
- Verification commands are included

### Type Consistency

- Day type uses only `training` and `rest`
- Record type uses only `rest` special case; missing type falls back to training
- Rest record fields consistently use:
  - `restCompleted`
  - `feeling`
  - `note`
  - `dayId`
  - `dayName`
  - `dayColor`
