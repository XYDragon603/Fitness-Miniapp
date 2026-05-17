# Training Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the mini program files and implement rest timer, last-weight copy, overload suggestions, exercise guides, and the training calendar check-in flow.

**Architecture:** Keep the current native WeChat Mini Program structure and extend it in place. Put record/history lookup and calendar shaping in `utils/util.js`, keep guide content in `app.js`, and add the new UI flows primarily in `pages/record`, `pages/index`, and `pages/history`.

**Tech Stack:** Native WeChat Mini Program (`JS`, `WXML`, `WXSS`), local storage via `wx.setStorageSync` / `wx.getStorageSync`

---

## File Structure

**Modify**

- `app.js`
- `app.json`
- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/index/index.wxss`
- `pages/record/record.js`
- `pages/record/record.wxml`
- `pages/record/record.wxss`
- `pages/history/history.js`
- `pages/history/history.wxml`
- `pages/history/history.wxss`
- `utils/util.js`

**Verify**

- `pages/stats/stats.js`
- `pages/stats/stats.wxml`
- `pages/stats/stats.wxss`
- `pages/nutrition/nutrition.js`
- `pages/nutrition/nutrition.wxml`

## Task 1: Repair Blocking File Corruption

**Files:**
- Modify: `app.json`
- Modify: `app.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/record/record.wxml`
- Modify: `pages/history/history.wxml`
- Modify: `pages/stats/stats.wxml`
- Verify: `pages/nutrition/nutrition.wxml`

- [ ] **Step 1: Write a quick parse-check script for JSON and WXML smoke validation**

```powershell
@'
$jsonFiles = @('app.json')
foreach ($file in $jsonFiles) {
  try {
    Get-Content $file -Raw | ConvertFrom-Json | Out-Null
    Write-Output "$file OK"
  } catch {
    Write-Output "$file FAIL: $($_.Exception.Message)"
  }
}

$wxmlFiles = @(
  'pages/index/index.wxml',
  'pages/record/record.wxml',
  'pages/history/history.wxml',
  'pages/stats/stats.wxml',
  'pages/nutrition/nutrition.wxml'
)

foreach ($file in $wxmlFiles) {
  $text = Get-Content $file -Raw
  if ($text -match '</view>' -and $text -notmatch '<view') {
    Write-Output "$file FAIL: orphan closing tags"
  } else {
    Write-Output "$file CHECKED"
  }
}
'@ | powershell -NoProfile -Command -
```

- [ ] **Step 2: Run the script to confirm the current files fail or look damaged**

Run:

```powershell
@'
$jsonFiles = @('app.json')
foreach ($file in $jsonFiles) {
  try {
    Get-Content $file -Raw | ConvertFrom-Json | Out-Null
    Write-Output "$file OK"
  } catch {
    Write-Output "$file FAIL: $($_.Exception.Message)"
  }
}
'@ | powershell -NoProfile -Command -
```

Expected:

```text
app.json FAIL: ...
```

- [ ] **Step 3: Restore valid Chinese text and valid tag structure**

Target structure examples:

```json
{
  "pages": [
    "pages/index/index",
    "pages/record/record",
    "pages/history/history",
    "pages/nutrition/nutrition",
    "pages/stats/stats"
  ],
  "window": {
    "navigationBarTitleText": "健身计划",
    "navigationBarBackgroundColor": "#1A1A2E",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#F5F5F5"
  }
}
```

```xml
<view class="page-header">
  <view class="page-title">开始训练</view>
  <view class="page-desc">{{today}} · 记录你的每一次进步</view>
</view>
```

- [ ] **Step 4: Re-run validation after repairs**

Run:

```powershell
@'
Get-Content app.json -Raw | ConvertFrom-Json | Out-Null
Write-Output 'app.json OK'
'@ | powershell -NoProfile -Command -
```

Expected:

```text
app.json OK
```

- [ ] **Step 5: Commit the stabilization pass if a git repo exists**

Run:

```powershell
git status --short
```

Expected:

```text
If this is a git repo, the repaired files appear as modified.
If not, skip commit and continue.
```

## Task 2: Add Utility Helpers for History Lookup and Calendar Data

**Files:**
- Modify: `utils/util.js`

- [ ] **Step 1: Write failing utility expectations in a scratch verification block**

Use these target examples while implementing:

```js
const previous = util.getPreviousExerciseRecord(mockDates, 'ex1_1', '2026-05-14');
// expected: most recent exercise object before 2026-05-14

const template = util.copyWeightTemplateFromRecord(previousExercise, 4);
// expected: ['40', '45', '50', '']

const suggestion = util.getProgressiveOverloadSuggestion(mockDates, 'ex1_1', '2026-05-14');
// expected: { show: true, message: '动作稳定的话，下次可以小幅增加重量，建议 +2.5kg。' }

const calendar = util.getTrainingCalendarData(2026, 5);
// expected: { year: 2026, month: 5, weeks: [...] }
```

- [ ] **Step 2: Implement focused helper functions in `utils/util.js`**

Add functions with this shape:

```js
function getTrainingRecordByDate(date) {
  return getTrainingRecord(date);
}

function getPreviousExerciseRecords(exerciseId, beforeDate, limit = 2) {
  const dates = getTrainingDates().filter(date => date < beforeDate);
  const matches = [];

  for (const date of dates) {
    const record = getTrainingRecord(date);
    if (!record || !record.exercises) continue;

    const exercise = record.exercises.find(item => item.id === exerciseId);
    if (!exercise) continue;

    matches.push({
      date,
      dayType: record.dayType,
      week: record.week,
      exercise
    });

    if (matches.length >= limit) break;
  }

  return matches;
}

function getPreviousExerciseRecord(exerciseId, beforeDate) {
  return getPreviousExerciseRecords(exerciseId, beforeDate, 1)[0] || null;
}

function copyWeightTemplateFromRecord(previousExercise, currentSetCount) {
  const result = [];

  for (let i = 0; i < currentSetCount; i++) {
    result.push(previousExercise && previousExercise.sets && previousExercise.sets[i]
      ? previousExercise.sets[i].weight || ''
      : '');
  }

  return result;
}
```

- [ ] **Step 3: Add overload suggestion and calendar helpers**

Implement with this shape:

```js
function isExerciseStable(exercise) {
  if (!exercise || !exercise.sets || exercise.sets.length === 0) return false;
  if (exercise.completed) return true;

  const doneSets = exercise.sets.filter(set => set.done || set.reps).length;
  return doneSets >= Math.max(1, exercise.sets.length - 1);
}

function getProgressiveOverloadSuggestion(exerciseId, beforeDate) {
  const records = getPreviousExerciseRecords(exerciseId, beforeDate, 2);
  if (records.length < 2) {
    return { show: false, message: '' };
  }

  const stable = records.every(item => isExerciseStable(item.exercise));
  if (!stable) {
    return { show: false, message: '' };
  }

  return {
    show: true,
    message: '动作稳定的话，下次可以小幅增加重量，建议 +2.5kg。'
  };
}

function getTrainingCalendarData(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const startWeekDay = firstDay.getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeek = [];

  for (let i = 0; i < startWeekDay; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= lastDate; day++) {
    const date = formatDate(new Date(year, month - 1, day));
    const record = getTrainingRecord(date);
    currentWeek.push({
      day,
      date,
      hasRecord: !!record,
      dayType: record ? record.dayType : '',
      dayName: record ? record.dayName : ''
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }

  if (currentWeek.length === 7) {
    weeks.push(currentWeek);
  }

  return { year, month, weeks };
}
```

- [ ] **Step 4: Export all new helpers and smoke-check the file**

Run:

```powershell
@'
Get-Content utils/util.js -Raw | Select-String -Pattern 'getPreviousExerciseRecord|getProgressiveOverloadSuggestion|getTrainingCalendarData'
'@ | powershell -NoProfile -Command -
```

Expected:

```text
The new helper names appear in the file.
```

- [ ] **Step 5: Commit the utility layer if a git repo exists**

```powershell
git add utils/util.js
git commit -m "feat: add training history and calendar helpers"
```

## Task 3: Extend Training Plan Data with Exercise Guides

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Write the intended guide object shape beside each exercise definition**

Use this structure:

```js
guide: {
  summary: '重点感受臀腿后侧发力，髋部主导动作。',
  targetMuscles: ['臀部', '腘绳肌', '竖脊肌'],
  commonMistakes: ['弓背', '蹲成深蹲', '重量起步过大'],
  tips: ['保持脊柱中立', '杠铃沿腿下放', '先把动作做稳'],
  videoTitle: '罗马尼亚硬拉教学',
  videoUrl: 'https://example.com/romanian-deadlift'
}
```

- [ ] **Step 2: Add guide content for every exercise, prioritizing the four required movements**

Required named movements:

```js
[
  'Y字侧平举',
  '单侧钢线下拉',
  '罗马尼亚硬拉',
  '保加利亚深蹲'
]
```

Expected result:

```text
Every exercise in app.js has a guide object with non-empty summary and tips.
```

- [ ] **Step 3: Keep the existing training plan contract intact**

Verify that each exercise still contains:

```js
{
  id: 'ex1_1',
  name: '杠铃卧推',
  weeks: { ... },
  guide: { ... }
}
```

- [ ] **Step 4: Commit guide data if a git repo exists**

```powershell
git add app.js
git commit -m "feat: add exercise guide metadata"
```

## Task 4: Implement Record Page Enhancements

**Files:**
- Modify: `pages/record/record.js`
- Modify: `pages/record/record.wxml`
- Modify: `pages/record/record.wxss`
- Use: `utils/util.js`

- [ ] **Step 1: Add page state for timer, previous weights, suggestion banners, and guide modal**

Add data fields like:

```js
data: {
  restTimerVisible: false,
  restTimerSeconds: 90,
  restTimerLabel: '01:30',
  restTimerExerciseName: '',
  previousExerciseMap: {},
  overloadSuggestionMap: {},
  guideVisible: false,
  activeGuide: null
}
```

- [ ] **Step 2: Fill previous-weight and suggestion data during `loadExercises()`**

Implementation target:

```js
const previousExerciseMap = {};
const overloadSuggestionMap = {};

const exercises = day.exercises.map(ex => {
  const previous = util.getPreviousExerciseRecord(ex.id, today);
  const suggestion = util.getProgressiveOverloadSuggestion(ex.id, today);

  previousExerciseMap[ex.id] = previous;
  overloadSuggestionMap[ex.id] = suggestion;

  return {
    id: ex.id,
    name: ex.name,
    guide: ex.guide || null,
    previousSummary: previous && previous.exercise && previous.exercise.sets
      ? previous.exercise.sets
          .map(set => `${set.weight || '-'} x ${set.reps || '-'}`)
          .join(' / ')
      : '',
    overloadSuggestion: suggestion,
    sets: ...
  };
});
```

- [ ] **Step 3: Add copy-last-weight and guide actions**

Implement methods like:

```js
copyLastWeight(e) {
  const index = e.currentTarget.dataset.index;
  const exercise = this.data.exercises[index];
  const previous = this.data.previousExerciseMap[exercise.id];
  if (!previous || !previous.exercise) return;

  const weights = util.copyWeightTemplateFromRecord(previous.exercise, exercise.sets.length);
  const nextSets = exercise.sets.map((set, setIndex) => ({
    ...set,
    weight: weights[setIndex]
  }));

  this.setData({
    [`exercises[${index}].sets`]: nextSets
  });

  wx.showToast({ title: '已复制上次重量', icon: 'success' });
}

openGuide(e) {
  const index = e.currentTarget.dataset.index;
  this.setData({
    guideVisible: true,
    activeGuide: this.data.exercises[index].guide || null
  });
}

closeGuide() {
  this.setData({
    guideVisible: false,
    activeGuide: null
  });
}
```

- [ ] **Step 4: Add link-copy behavior for video URLs**

Implement:

```js
copyGuideVideoUrl() {
  const guide = this.data.activeGuide;
  if (!guide || !guide.videoUrl) return;

  wx.setClipboardData({
    data: guide.videoUrl,
    success: () => {
      wx.showToast({ title: '视频链接已复制', icon: 'success' });
    }
  });
}
```

- [ ] **Step 5: Add rest timer lifecycle and hook it into set completion**

Implement:

```js
startRestTimer(exerciseName) {
  this.clearRestTimer();

  let seconds = 90;
  this.setData({
    restTimerVisible: true,
    restTimerSeconds: seconds,
    restTimerLabel: this.formatTimerLabel(seconds),
    restTimerExerciseName: exerciseName
  });

  this.restTimerId = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      this.clearRestTimer();
      this.setData({
        restTimerVisible: false,
        restTimerSeconds: 0,
        restTimerLabel: '00:00'
      });
      wx.showToast({ title: '休息结束', icon: 'none' });
      return;
    }

    this.setData({
      restTimerSeconds: seconds,
      restTimerLabel: this.formatTimerLabel(seconds)
    });
  }, 1000);
}

clearRestTimer() {
  if (this.restTimerId) {
    clearInterval(this.restTimerId);
    this.restTimerId = null;
  }
}

formatTimerLabel(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remain = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remain}`;
}
```

When a set becomes done:

```js
if (!current && !this.data.exercises[exIndex].sets[setIndex].done) {
  this.startRestTimer(this.data.exercises[exIndex].name);
}
```

Also add:

```js
closeRestTimer() {
  this.clearRestTimer();
  this.setData({ restTimerVisible: false });
}

restartRestTimer() {
  this.startRestTimer(this.data.restTimerExerciseName || '当前动作');
}
```

- [ ] **Step 6: Clean up timer in page lifecycle**

Add:

```js
onHide() {
  this.clearRestTimer();
}

onUnload() {
  this.clearRestTimer();
}
```

- [ ] **Step 7: Render new UI in `record.wxml`**

Add inside each exercise card:

```xml
<view class="record-actions" wx:if="{{item.previousSummary || item.guide}}">
  <view class="action-chip" wx:if="{{item.previousSummary}}" bindtap="copyLastWeight" data-index="{{index}}">
    复制上次重量
  </view>
  <view class="action-chip ghost" wx:if="{{item.guide}}" bindtap="openGuide" data-index="{{index}}">
    查看动作教学
  </view>
</view>

<view class="previous-summary" wx:if="{{item.previousSummary}}">
  上次重量：{{item.previousSummary}}
</view>

<view class="suggestion-banner" wx:if="{{item.overloadSuggestion.show}}">
  {{item.overloadSuggestion.message}}
</view>
```

Add page-level modals:

```xml
<view class="rest-timer-mask" wx:if="{{restTimerVisible}}">
  <view class="rest-timer-card">
    <text class="rest-timer-title">组间休息</text>
    <text class="rest-timer-exercise">{{restTimerExerciseName}}</text>
    <text class="rest-timer-count">{{restTimerLabel}}</text>
    <text class="rest-timer-hint">建议休息 60-90 秒，可按自己状态调整</text>
    <view class="rest-timer-actions">
      <view class="btn-secondary" bindtap="closeRestTimer">关闭</view>
      <view class="btn-secondary" bindtap="restartRestTimer">重新开始</view>
      <view class="btn-primary" bindtap="closeRestTimer">跳过</view>
    </view>
  </view>
</view>
```

- [ ] **Step 8: Add supporting styles in `record.wxss`**

Style targets:

```css
.record-actions {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 28rpx 0;
}

.action-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(233, 69, 96, 0.12);
  color: #E94560;
  font-size: 22rpx;
  font-weight: 600;
}

.suggestion-banner {
  margin: 16rpx 28rpx 0;
  padding: 16rpx 20rpx;
  border-radius: 14rpx;
  background: #FFF4D6;
  color: #8B6B1F;
  font-size: 22rpx;
  line-height: 1.5;
}
```

- [ ] **Step 9: Commit the record page feature set if a git repo exists**

```powershell
git add pages/record/record.js pages/record/record.wxml pages/record/record.wxss utils/util.js
git commit -m "feat: enhance workout record flow"
```

## Task 5: Add Exercise Guide Entry on the Plan Page

**Files:**
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`

- [ ] **Step 1: Add guide modal state and handlers**

Implement:

```js
data: {
  currentWeek: 1,
  trainingDays: [],
  notice: '',
  guideVisible: false,
  activeGuide: null
},

openGuide(e) {
  const { dayIndex, exIndex } = e.currentTarget.dataset;
  const exercise = this.data.trainingDays[dayIndex].exercises[exIndex];
  this.setData({
    guideVisible: true,
    activeGuide: exercise.guide || null
  });
},

closeGuide() {
  this.setData({
    guideVisible: false,
    activeGuide: null
  });
}
```

- [ ] **Step 2: Ensure `loadPlanData()` keeps `guide` on each exercise**

Verify mapping shape:

```js
exercises: day.exercises.map(ex => ({
  ...ex,
  currentPlan: ex.weeks[week]
}))
```

- [ ] **Step 3: Render `查看动作教学` on each exercise item**

Add:

```xml
<view class="exercise-tools">
  <text class="guide-link" bindtap="openGuide" data-day-index="{{index}}" data-ex-index="{{exIndex}}">
    查看动作教学
  </text>
</view>
```

- [ ] **Step 4: Reuse guide modal UI on the plan page**

Add:

```xml
<view class="guide-mask" wx:if="{{guideVisible}}" bindtap="closeGuide">
  <view class="guide-card" catchtap="">
    <text class="guide-title">{{activeGuide.videoTitle}}</text>
    <text class="guide-summary">{{activeGuide.summary}}</text>
    <view class="guide-section">
      <text class="guide-section-title">目标肌肉</text>
      <text>{{activeGuide.targetMuscles.join('、')}}</text>
    </view>
  </view>
</view>
```

- [ ] **Step 5: Commit the plan-page guide entry if a git repo exists**

```powershell
git add pages/index/index.js pages/index/index.wxml pages/index/index.wxss
git commit -m "feat: add exercise guide entry to training plan"
```

## Task 6: Add Training Calendar to History

**Files:**
- Modify: `pages/history/history.js`
- Modify: `pages/history/history.wxml`
- Modify: `pages/history/history.wxss`
- Use: `utils/util.js`

- [ ] **Step 1: Add calendar state**

```js
data: {
  activeTab: 'training',
  trainingRecords: [],
  nutritionRecords: [],
  showDetail: false,
  detailRecord: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth() + 1,
  calendarWeeks: []
}
```

- [ ] **Step 2: Load calendar data during `onShow()` and on month switch**

Implement:

```js
loadCalendar() {
  const { calendarYear, calendarMonth } = this.data;
  const calendar = util.getTrainingCalendarData(calendarYear, calendarMonth);
  this.setData({
    calendarWeeks: calendar.weeks
  });
}

switchMonth(e) {
  const offset = Number(e.currentTarget.dataset.offset);
  const current = new Date(this.data.calendarYear, this.data.calendarMonth - 1 + offset, 1);
  this.setData({
    calendarYear: current.getFullYear(),
    calendarMonth: current.getMonth() + 1
  });
  this.loadCalendar();
}
```

- [ ] **Step 3: Add day selection behavior**

Implement:

```js
selectCalendarDay(e) {
  const date = e.currentTarget.dataset.date;
  if (!date) return;

  const record = this.data.trainingRecords.find(item => item.date === date);
  if (!record) return;

  this.setData({
    showDetail: true,
    detailRecord: record
  });
}
```

- [ ] **Step 4: Render calendar above the training list**

Add:

```xml
<view class="calendar-card card" wx:if="{{activeTab === 'training'}}">
  <view class="calendar-header">
    <view class="calendar-switch" bindtap="switchMonth" data-offset="-1">上月</view>
    <view class="calendar-title">{{calendarYear}}年{{calendarMonth}}月</view>
    <view class="calendar-switch" bindtap="switchMonth" data-offset="1">下月</view>
  </view>

  <view class="calendar-weekdays">
    <text wx:for="{{['日','一','二','三','四','五','六']}}" wx:key="*this">{{item}}</text>
  </view>

  <view class="calendar-weeks">
    <view class="calendar-row" wx:for="{{calendarWeeks}}" wx:key="index">
      <view
        class="calendar-day {{dayItem && dayItem.dayType ? dayItem.dayType : ''}}"
        wx:for="{{item}}"
        wx:for-item="dayItem"
        wx:key="date"
        bindtap="selectCalendarDay"
        data-date="{{dayItem ? dayItem.date : ''}}"
      >
        <text wx:if="{{dayItem}}">{{dayItem.day}}</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 5: Add calendar day coloring styles**

Use styles like:

```css
.calendar-day.day1 {
  background: rgba(233, 69, 96, 0.14);
  color: #E94560;
}

.calendar-day.day2 {
  background: rgba(15, 52, 96, 0.14);
  color: #0F3460;
}

.calendar-day.day3 {
  background: rgba(22, 199, 154, 0.16);
  color: #16C79A;
}
```

- [ ] **Step 6: Commit the history calendar if a git repo exists**

```powershell
git add pages/history/history.js pages/history/history.wxml pages/history/history.wxss utils/util.js
git commit -m "feat: add training calendar to history"
```

## Task 7: Final Verification

**Files:**
- Verify: `app.js`
- Verify: `app.json`
- Verify: `pages/index/index.*`
- Verify: `pages/record/record.*`
- Verify: `pages/history/history.*`
- Verify: `utils/util.js`

- [ ] **Step 1: Smoke-check key strings and new handlers**

Run:

```powershell
rg -n "组间休息|复制上次重量|查看动作教学|动作稳定的话|calendarWeeks|copyGuideVideoUrl" app.js pages utils
```

Expected:

```text
The new strings and handlers appear in the expected files.
```

- [ ] **Step 2: Manual verification in WeChat DevTools**

Checklist:

```text
1. 打开训练记录页，勾选一组完成，90 秒计时器自动弹出。
2. 关闭或跳过计时器后，训练状态保持已完成。
3. 有历史记录的动作可显示“上次重量”并可一键复制。
4. 历史表现稳定的动作会显示建议文案，不会自动改重量。
5. 首页和训练页都能打开动作教学，并复制视频链接。
6. 历史页月历能显示训练日颜色，点中训练日能打开详情。
```

- [ ] **Step 3: Regression-check training save/load flows**

Checklist:

```text
1. 保存新的训练记录后，历史记录列表仍正常显示。
2. 原有旧记录可以正常打开，不因 guide 或 suggestion 缺字段而报错。
3. 统计页仍能读取训练天数、完成率和近 7 天数据。
```

- [ ] **Step 4: Commit the final integrated pass if a git repo exists**

```powershell
git add app.js app.json pages/index pages/record pages/history utils/util.js
git commit -m "feat: add training productivity enhancements"
```

## Self-Review Notes

- Spec coverage check:
  - Rest timer: covered in Task 4
  - Copy last weight: covered in Task 2 and Task 4
  - Progressive overload suggestion: covered in Task 2 and Task 4
  - Exercise guide: covered in Task 3, Task 4, and Task 5
  - Training calendar: covered in Task 2 and Task 6
  - File corruption stabilization: covered in Task 1
- Placeholder scan:
  - No `TODO` or `TBD`
  - All tasks name exact files and concrete commands
- Type consistency:
  - Guide object uses `summary`, `targetMuscles`, `commonMistakes`, `tips`, `videoTitle`, `videoUrl`
  - Calendar uses `calendarYear`, `calendarMonth`, `calendarWeeks`
  - Suggestion object uses `show` and `message`
