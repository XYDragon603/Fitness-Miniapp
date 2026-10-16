# Healthy Fat Loss Reference Design

Date: 2026-05-17
Project: `fitness-miniapp`
Scope: Add a `健康减脂参考` feature set to the current WeChat Mini Program without adding a new bottom tab.

## Goals

Improve the current training and nutrition workflow with a gentle fat-loss-oriented reference system so users can:

- set a `健康减脂参考` target alongside existing nutrition goals
- switch to an embedded builtin `健康减脂计划`
- record simple daily fat-loss habits
- review weekly reference metrics and long-term trends
- optionally record and review body weight trend data

## Non-Goals

- No new bottom tab bar item
- No medical advice, diagnosis, or guaranteed weight-loss claims
- No “极速减脂 / 快速瘦身 / 低热量挑战 / 每日最大热量” language
- No breaking changes to existing training, nutrition, AI scan, rest-day, or custom plan flows
- No modification of old storage keys

## Product Decisions Confirmed

- Keep the existing 5 tab entries unchanged
- Add a dedicated subpage: `pages/fatloss/fatloss`
- Include lightweight `体重趋势` in v1
- Use `健康减脂参考` language throughout

## Entry Points

### Nutrition Page

Primary entry lives on `pages/nutrition/nutrition`.

Add a `健康减脂参考` card near the current `营养参考目标` card. It should:

- explain that the feature provides gentle daily reference ranges
- allow the user to open the fat-loss page
- reflect current status if a fat-loss profile already exists

### Training Plan Page

Add a new builtin plan to the current plan manager:

- `健康减脂计划`

This plan should be selectable the same way as the current builtin split plan.

### Stats Page

Add a `健康减脂参考` section to `pages/stats/stats`.

This section is a summary and secondary entry point to the fat-loss page.

### History Page

History remains display-only. It should show:

- existing training records
- existing nutrition records
- rest-day records
- fat-loss habit records
- optional weight records

## New Page

Create:

- `pages/fatloss/fatloss`

This page is not part of `app.json.tabBar.list`.

It is opened from:

- nutrition page fat-loss card
- stats page fat-loss summary area

## Fat Loss Reference Calculation

### Adult Users

If `age >= 18`:

- calculate `TDEE` first
- `dailyCaloriesMin = TDEE * 0.90`
- `dailyCaloriesMax = TDEE * 0.95`
- `proteinTarget = weightKg * 1.6`
- `fatMin = dailyCaloriesMin * 0.20 / 9`
- `fatMax = dailyCaloriesMax * 0.35 / 9`
- `carbTarget` should be calculated from remaining calories after protein and fat

Display wording:

- `每日参考热量区间`
- `营养参考目标`
- `长期趋势`
- `记录参考`

### Minor Users

If `age < 18`:

- do not generate a calorie deficit
- do not present strict heat or intake control
- show a gentle note only

Recommended note:

- `成长阶段能量需求差异较大，当前内容仅用于健康记录参考，如需调整饮食建议咨询家长或专业人士。`

## Fat Loss Goal Type

Extend the nutrition goal options with:

- `fat_loss`

Behavior:

- keep current `maintain`, `muscle_gain`, and `custom`
- add `健康减脂参考` as a fourth option
- do not rename or break current goal handling

Implementation note:

- existing `nutrition_goal_profile` and calculation helpers should remain compatible
- fat-loss-specific display logic can be layered on top rather than replacing existing goal logic

## Builtin Healthy Fat Loss Plan

Add a second builtin plan alongside the current split plan:

- `健康减脂计划`

Suggested structure:

1. Day 1: 力量训练 A
2. Day 2: 轻有氧 / 快走
3. Day 3: 力量训练 B
4. Day 4: 休息 / 拉伸
5. Day 5: 力量训练 C
6. Day 6: 轻活动
7. Day 7: 休息日

Design guidance:

- strength days can keep the same day object format as other training days
- light activity days can be represented as `rest`-style days with custom copy, or as training days with light-activity guidance and no heavy exercise logging requirement
- the final chosen data shape should preserve compatibility with current plan/day selection logic

Recommended approach:

- use `type: 'training'` for real lifting days
- use `type: 'rest'` for `休息 / 拉伸`, `轻活动`, and `休息日`
- customize each day’s `focus`, `description`, and `note`

This is the safest way to reuse the current rest-day-compatible record flow.

## Fat Loss Page Design

The `pages/fatloss/fatloss` page should include:

### 1. Reference Summary Card

Show:

- `每日参考热量区间`
- `蛋白质参考目标`
- `脂肪参考范围`
- `碳水参考目标`

If user is under 18, replace strict numbers with the minor guidance note.

### 2. Daily Habit Checklist

Checklist items:

- 今日完成训练或轻活动
- 今日记录饮食
- 今日蛋白质记录
- 今日蔬菜摄入
- 今日喝水
- 今日睡眠
- 今日休息或拉伸

The checklist is saveable per date.

### 3. Weight Trend

Lightweight v1 only:

- current latest weight
- recent records list or a simple trend block
- add / edit today’s weight

Do not frame this as a pass/fail score.

### 4. Weekly Summary

Show:

- 本周训练次数
- 本周休息天数
- 平均每日热量
- 平均蛋白质
- 习惯完成率

## Stats Page Changes

Add a `健康减脂参考` area to `pages/stats/stats` with:

- 本周训练次数
- 本周休息天数
- 平均每日热量
- 平均蛋白质
- 习惯完成率
- 体重趋势（if weight records exist）

This block can also include a small button:

- `查看健康减脂参考`

## History Page Changes

Add support for:

- fat-loss habit records
- optional weight records

History only displays them. It does not own editing.

Recommended display:

- date
- record type badge: `习惯打卡` or `体重记录`
- short content summary

## Data Model

### New Storage Keys

Use only new independent keys:

- `fat_loss_profile`
- `fat_loss_habits_YYYY-MM-DD`
- `fat_loss_habit_dates`
- `fat_loss_weight_records`

### Fat Loss Profile Shape

```js
{
  enabled: true,
  age: 25,
  height: 170,
  weight: 65,
  gender: 'male',
  activityLevel: 'light',
  goal: 'fat_loss',
  updatedAt: '...'
}
```

### Habit Record Shape

```js
{
  date: 'YYYY-MM-DD',
  habits: {
    activity: true,
    nutrition: true,
    protein: false,
    vegetables: true,
    water: false,
    sleep: true,
    recovery: true
  },
  note: '',
  createdAt: '...'
}
```

### Weight Records Shape

```js
[
  {
    date: 'YYYY-MM-DD',
    weight: 65.2,
    note: ''
  }
]
```

## Utility Layer Changes

Add or extend helpers in `utils/util.js` and, where appropriate, `utils/mvp-core.js`.

Recommended additions:

- `saveFatLossProfile(profile)`
- `getFatLossProfile()`
- `saveFatLossHabits(date, record)`
- `getFatLossHabits(date)`
- `getFatLossHabitDates()`
- `saveFatLossWeightRecord(date, weight, note)`
- `getFatLossWeightRecords()`
- `getFatLossWeeklySummary()`
- `calculateFatLossTargets(profile)`

Implementation guidance:

- reuse existing TDEE logic where possible
- do not break current `calculateNutritionTargets`
- add fat-loss calculation as a layered path, not a replacement

## Compatibility Requirements

1. Existing training record save/load stays intact
2. Existing AI nutrition scan stays intact
3. Existing custom plans stay intact
4. Existing rest-day logic stays intact
5. Existing storage keys stay untouched
6. Existing tab bar remains exactly 5 items

## Copy Rules

Always use:

- `健康减脂参考`
- `每日参考热量区间`
- `营养参考目标`
- `长期趋势`
- `记录参考`

Do not use:

- `超标`
- `失败`
- `吃多了`
- `摄入不足`
- `必须达到`
- `快速减肥`
- `保证瘦身`

## Testing Strategy

Priority manual checks:

1. Nutrition page shows the new fat-loss card without breaking current goal card
2. Selecting `fat_loss` generates adult reference ranges correctly
3. Users under 18 see only the gentle note path
4. Builtin `健康减脂计划` can be activated like other plans
5. No new tab appears in the bottom bar
6. Fat-loss habits save and reload correctly by date
7. Stats page shows weekly fat-loss summary without breaking existing stats
8. History page can display habit and weight records without affecting existing training/nutrition history

## Risks

- Current nutrition goal logic and fat-loss profile logic could become tangled if not separated cleanly
- Adding a second builtin plan requires careful plan activation compatibility
- Habit and weight history should not pollute current training or nutrition record lists
- Minor-user messaging must stay gentle and non-restrictive

## Recommended Implementation Order

1. Add fat-loss calculation and storage helpers
2. Add builtin `健康减脂计划`
3. Add nutrition-page fat-loss entry and `fat_loss` goal option
4. Create `pages/fatloss/fatloss`
5. Add stats summary block
6. Add history display support for habit/weight records
7. Run compatibility regression checks

## Success Criteria

The feature is successful when:

- user can enable `健康减脂参考` without a new tab
- user can switch to a builtin `健康减脂计划`
- user can complete daily habit check-ins
- stats reflects weekly fat-loss-oriented summary data
- weight trend is lightly recordable and reviewable
- existing training, nutrition, AI scan, rest-day, and custom-plan flows remain stable
