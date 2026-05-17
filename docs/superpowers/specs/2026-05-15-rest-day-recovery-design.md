# Rest Day / Recovery Day Design

Date: 2026-05-15
Project: `fitness-miniapp`
Scope: Add `休息日 / 恢复日` support across the existing WeChat Mini Program without breaking current training records, nutrition records, AI nutrition scan, custom plans, history, or statistics.

## Goals

Add first-class rest day support so users can:

- see a built-in rest day in the default split plan
- add rest days to custom plans
- check in on a rest/recovery day without exercise logging
- view rest records in history and calendar
- track rest days separately in statistics
- keep rest days part of plan execution without counting them as workout completions

## Non-Goals

- No cloud sync or schema migration in this phase
- No changes to nutrition record, AI scan, or food recognition flows
- No forced recovery suggestions or medical guidance
- No replacement of the current date-based training storage model

## Product Decisions Confirmed

- Custom plans are no longer capped at 3 days
- Rest days and training days share the same `plan.days[]` structure
- Rest days are recorded through the existing training record storage flow
- Rest days count as a recorded plan day, but not as a workout completion

## Current Project Context

The project already has:

- a built-in default plan plus custom plans in `utils/workout-plan.js`
- day selection and workout logging in `pages/record`
- training history and month calendar in `pages/history`
- aggregate stats in `pages/stats`
- local record storage under:
  - `training_YYYY-MM-DD`
  - `training_dates`

This is a good fit for additive rest-day support because the app already treats records as date-based daily entries.

## Recommended Approach

Use one unified day model:

- training day: `type: 'training'`
- rest day: `type: 'rest'`

Why this approach:

- default plan and custom plan can share the same shape
- the record page can branch cleanly by day type
- history, calendar, and stats can derive behavior from one field
- future variants like `主动恢复日` or `拉伸日` fit naturally

Trade-offs:

- several existing pages need compatibility updates
- custom plan editor becomes slightly more complex
- utility functions need careful fallback behavior for old records

## Data Model Changes

## Plan Day Shape

Extend each day in `plan.days[]` to support both training and rest days.

Training day example:

```js
{
  id: 'day1',
  type: 'training',
  name: '胸肩三头',
  icon: '🏋️',
  color: '#D97878',
  exercises: [...]
}
```

Rest day example:

```js
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

Notes:

- `type` defaults to `training` when missing
- `exercises` remains an array for compatibility
- rest days store `exercises: []`

## Default Plan Change

Append this day after the current Day 3:

```js
{
  id: 'day4_rest',
  type: 'rest',
  name: '休息日',
  focus: '恢复 · 拉伸 · 放松',
  description: '恢复也是训练计划的一部分。今天可以轻松活动、拉伸或完全休息。',
  exercises: []
}
```

Display order:

1. Day 1：胸肩三头
2. Day 2：背后三角二头
3. Day 3：腿臀
4. Day 4：休息日

## Custom Plan Day Support

Custom plan editor must support two day variants:

- training day
- rest day

Rest day draft shape:

```js
{
  id: 'custom_rest_xxx',
  type: 'rest',
  name: '休息日',
  focus: '恢复',
  description: '用于安排恢复、拉伸或轻度活动。',
  note: '',
  exercises: []
}
```

Editor rules:

- remove the 3-day cap
- user can add any number of days
- user can add either a training day or a rest day
- rest days hide exercise editing UI
- rest days allow custom names like `主动恢复日` or `拉伸日`
- rest day note/description saves with the plan

## Record Shape

Training records remain compatible.

Rest record shape:

```js
{
  date: 'YYYY-MM-DD',
  type: 'rest',
  planId: 'xxx',
  planName: '默认三分化计划',
  dayId: 'day4_rest',
  dayName: '休息日',
  dayColor: '#8FB8AA',
  restCompleted: true,
  feeling: '有点疲劳',
  note: '',
  createdAt: '...'
}
```

Compatibility rules:

- old records without `type` and with `exercises` remain workout records
- `type === 'rest'` means rest record
- old records without `planId/dayId` continue to display

## Utility Layer Changes

Add or update helpers in `utils/util.js`:

- `isRestDay(day)`
- `isRestRecord(record)`
- `createRestRecord(day, plan, date, formData)`
- `getTrainingCount(records)`
- `getRestDayCount(records)`
- `getCalendarRecordType(record)`

Behavior expectations:

- missing `type` on a day should be treated as `training`
- missing `type` on a record should fall back to existing training behavior
- rest records should still participate in `training_dates`
- stats helpers must exclude rest records from exercise-based counts

## Page-Level Design

## `pages/index`

### Plan Cards

Rest day cards must look distinct from training cards:

- softer color family such as pale blue, grey-green, or mint
- no red warning treatment
- no exercise list
- show:
  - title: `休息日`
  - subtitle: `恢复 · 拉伸 · 放松`
  - description: `恢复也是训练计划的一部分。`
  - helper tip: `今天可以散步、拉伸、早睡，帮助身体恢复。`
- CTA text: `记录休息`

### Plan Metrics

Overview day count should include rest days because they are part of the plan.

Exercise total should still count only training exercises.

### Custom Plan Editor

Add:

- `添加训练日`
- `添加休息日`

Rest day editor fields:

- 名称
- 恢复说明
- 备注

Training day editor remains the same.

## `pages/record`

### Training Day Flow

Keep the current set logging UI and rest timer behavior unchanged for normal training days.

### Rest Day Flow

If the selected day is a rest day:

- do not render exercise cards
- do not render weight/reps/set inputs
- do not render workout save CTA

Instead render a rest check-in form with:

- status header: `今日为休息日 / 恢复日`
- current plan name
- date
- day description
- optional fields:
  - `是否完成休息打卡`
  - `今日感受`
    - `精力不错`
    - `有点疲劳`
    - `需要恢复`
  - `简短备注`
- CTA: `保存休息记录`

Save rules:

- store under `training_YYYY-MM-DD`
- append date to `training_dates`
- no empty exercise table should be generated

## `pages/history`

### Training List

If `record.type === 'rest'`, show:

- date
- `休息日 / 恢复日`
- current plan name
- feeling
- note
- tag: `休息`

Normal training records keep the current card structure.

### Detail Modal

Rest day detail should show:

- date
- plan name
- day name
- feeling
- note
- completion/check-in status

It should not show exercise table UI.

### Calendar

Calendar day handling:

- training records keep existing day-based colors
- rest records use a dedicated rest color
- clicking a rest day opens its detail
- rest days must not look blank or unrecorded

Legend additions:

- training day entries
- one dedicated `休息日` entry

## `pages/stats`

Add separate rest-day metrics.

Suggested top-level stats:

- `总训练次数`
- `本周训练次数`
- `休息天数`
- `连续记录天数`

Rules:

- training count: `record.type !== 'rest'`
- rest day count: `record.type === 'rest'`
- total exercise/completion stats ignore rest records
- plan recorded days can be derived as:
  - `trainingCount + restDayCount`

Display examples:

- `本月训练：8 次`
- `本月休息：3 天`
- `计划记录：11 天`

## Calendar and Color Behavior

Calendar record coloring should support:

- normal training day colors from day config
- rest day color from rest day config or fallback rest color

Recommended fallback rest color:

- `#8FB8AA`

This color should also be reused on history rest tags and record-page rest panels for consistency.

## Error Handling and Fallbacks

- Old records without `type`: treat as workout records
- Old plans without day `type`: treat as training days
- Missing rest day `description` or `note`: show warm fallback copy
- Missing `planId/dayId` on old record: continue current display fallback
- If a rest record is loaded on record page, skip all exercise reconstruction logic

## Testing Strategy

Priority verification:

1. default plan shows Day 4 rest day after Day 3
2. custom plan can add unlimited training/rest days
3. rest day editor does not render exercise form
4. record page branches correctly between training and rest flows
5. rest record saves into `training_YYYY-MM-DD` and `training_dates`
6. history list renders rest cards correctly
7. calendar shows rest days with separate color and detail access
8. stats show rest-day count and exclude rest days from workout totals
9. old workout history still loads without crashes
10. nutrition records and AI food scan flows remain unchanged

Recommended verification method:

- syntax checks on touched JS files
- manual UI verification in WeChat DevTools
- regression checks for save/load/delete training records

## Implementation Order

1. Extend workout plan model to support rest days and remove custom day cap
2. Add utility helpers and compatibility behavior for rest records
3. Update training plan page and custom plan editor
4. Add record-page rest-day branch and save flow
5. Update history cards, detail modal, and calendar legend/colors
6. Update stats calculations and top-level metrics
7. Run regression verification across training, history, stats, nutrition, and AI scan entry points

## Risks

- Existing pages currently assume every day has exercises
- Existing stats logic assumes every record is a workout record
- Custom plan editor needs careful branching so rest days do not create empty exercise drafts
- Old records without `type` must not be accidentally reclassified

## Success Criteria

The feature is successful when:

- default plan clearly shows a rest day after Day 3
- custom plans can include rest days naturally
- rest days can be checked in without exercise data
- rest records appear in history and calendar
- stats separately show rest-day count
- workout counts do not incorrectly include rest days
- existing training, nutrition, AI scan, and history behavior remains stable
