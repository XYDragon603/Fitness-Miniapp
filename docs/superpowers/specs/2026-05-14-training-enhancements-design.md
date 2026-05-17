# Training Enhancements Design

Date: 2026-05-14
Project: `fitness-miniapp`
Scope: Add five training-focused product features to the existing WeChat Mini Program:

- Rest Timer
- Copy Last Weight
- Progressive Overload Suggestion
- Exercise Guide with text and external video link
- Training Calendar Check-in

## Goals

Improve the core training workflow so users can:

- complete sets with built-in rest support
- reuse previous training data without retyping
- receive lightweight progression guidance
- understand unfamiliar movements
- review long-term consistency through a calendar view

## Non-Goals

- No cloud sync or backend storage in this phase
- No automatic weight increase or forced progression
- No embedded external video player inside the mini program
- No redesign of the full app information architecture
- No replacement of the current date-based storage model

## Product Decisions Confirmed

- Delivery scope: full product version with all 5 features
- Rest timer behavior: auto-open after a set is marked done, but user can close or skip it
- Exercise guide content: built-in text plus external video link entry

## Current Project Context

The app is a native WeChat Mini Program using:

- `app.js` for global training plan data
- `pages/record` as the core workout entry page
- `pages/index` for workout plan browsing
- `pages/history` for past training and nutrition history
- `pages/stats` for aggregate training statistics
- `utils/util.js` for storage and computed helpers

Existing training records are stored locally under keys like:

- `training_YYYY-MM-DD`
- `training_dates`

This storage model is sufficient for the current feature set, so the design extends it rather than replacing it.

## Recommended Approach

Use a lightweight enhancement approach on top of the existing pages and local storage.

Why this approach:

- fastest path to visible value
- lowest migration risk given the current project state
- best fit for the "record while training" user flow
- avoids unnecessary page-hopping during active workouts

Trade-offs:

- `pages/record` becomes more feature-dense
- some utility logic will grow and should be organized carefully
- current template/encoding issues in the project will need cleanup before or during implementation

## User Experience Design

### 1. Rest Timer

Primary location: `pages/record`

Behavior:

- When a user marks a set as done, the app automatically opens a 90-second rest timer modal or bottom sheet.
- The timer starts immediately.
- The user can:
  - close the timer
  - skip the timer
  - restart the timer
- If the user marks another set as done while a timer is already active, the timer resets to 90 seconds for the new rest period.
- Timer state is session-only and is not saved into historical records.

UI content:

- title: `组间休息`
- countdown display in `mm:ss`
- short helper text such as `建议休息 60-90 秒，可按自己状态调整`

Failure and edge handling:

- closing the timer should not mark data as incomplete
- skipping should immediately dismiss UI without changing set state
- timer cleanup must run on page hide/unload to avoid orphan intervals

### 2. Copy Last Weight

Primary location: `pages/record`

Behavior:

- For each exercise card, the app looks up the most recent previous record for the same exercise.
- If found, show a concise summary near the exercise header, for example:
  - `上次重量：40 x 12 / 45 x 10 / 50 x 8`
- Provide a `复制上次重量` action.
- Copying fills weight fields only.
- Reps remain editable and are not auto-filled by this action.

Rules:

- Match by `exercise.id`
- Search backward from the current training date
- If previous set count differs from current set count, copy only overlapping set indexes
- Leave unmatched current sets blank

Why weight-only copy:

- it preserves convenience
- it reduces the chance of users blindly reusing old rep counts
- it works better when weekly rep targets differ

### 3. Progressive Overload Suggestion

Primary location: `pages/record`

Behavior:

- For each exercise, the app computes whether recent performance suggests stable completion.
- If the user has completed target work for the same exercise in the last two relevant sessions, show a non-blocking suggestion.

Example wording:

- `动作稳定的话，下次可以小幅增加重量，建议 +2.5kg。`
- `也可以先保持当前重量，把动作做得更稳。`

Rules:

- Never auto-increment user inputs
- Never present the suggestion as mandatory
- Only show when enough history exists
- If history is sparse or inconsistent, show no suggestion

Suggested heuristic for v1:

- inspect the latest two past records for the same `exercise.id`
- count the exercise as "stable" if:
  - the exercise was marked completed, and
  - most sets have either a completed state or filled rep data aligned with target completion intent
- if both sessions are stable, suggest a small increase

Suggestion strategy:

- default message: `建议 +2.5kg`
- for smaller isolation movements, still keep the same text in v1 to avoid overcomplicating rules
- do not attempt exercise-specific load tables in this phase

### 4. Exercise Guide

Primary locations:

- `pages/index`
- `pages/record`

Behavior:

- Each exercise gets a `查看动作教学` entry.
- Tapping opens a guide panel or modal with:
  - action description
  - target muscles
  - common mistakes
  - safety notes
  - external video title
  - external video URL actions

Video entry behavior:

- preferred v1 action: `复制视频链接`
- optional secondary action if supported later: `显示链接说明`

Reasoning:

- WeChat Mini Program external navigation is restricted and inconsistent for arbitrary video destinations.
- Copying the link is the most reliable first release behavior.

Initial content expectation:

- The intended release target is guide content for all exercises in the current training plan.
- If implementation sequencing forces partial delivery during development, the following four movements are required before any others:
  - Y字侧平举
  - 单侧钢线下拉
  - 罗马尼亚硬拉
  - 保加利亚深蹲

### 5. Training Calendar Check-in

Primary location: `pages/history`, inside the training tab above the record list

Behavior:

- Show a month-view calendar for the current month.
- Days with training records are highlighted.
- Highlight color reflects training day type:
  - red: chest/shoulder/triceps day
  - blue: back/rear-delt/biceps day
  - green: leg/glute day
- Tapping a trained date opens that day's detail record.
- Tapping an empty date does nothing or only changes selection without opening details.

Navigation:

- allow switching month forward/backward
- default view opens to the current month

Why `history` instead of `stats`:

- calendar is best treated as a record-browsing tool
- it pairs naturally with the detailed history list below it

## Data Model Changes

### Training Plan Exercise Guide

Extend each exercise under `app.globalData.trainingPlan.days[].exercises[]` with:

```js
guide: {
  summary: '',
  targetMuscles: [],
  commonMistakes: [],
  tips: [],
  videoTitle: '',
  videoUrl: ''
}
```

This keeps guide content colocated with the training plan source of truth.

### Training Record Shape

Current record shape can remain compatible. Optional additive fields may be introduced:

```js
{
  date: 'YYYY-MM-DD',
  dayType: 'day1',
  dayName: '...',
  week: 1,
  exercises: [
    {
      id: 'ex1_1',
      name: '...',
      planSets: 4,
      planReps: '12, 10, 8, 6',
      note: '...',
      completed: true,
      sets: [
        { weight: '40', reps: '12', done: true }
      ]
    }
  ]
}
```

No migration is required unless implementation chooses to add metadata fields. Any new fields must remain optional so old records continue to load.

## Utility Layer Additions

Add helper functions in `utils/util.js` or split into a new util module if needed.

Recommended additions:

- `getPreviousExerciseRecord(exerciseId, beforeDate)`
- `getPreviousExerciseRecords(exerciseId, beforeDate, limit)`
- `copyWeightTemplateFromRecord(previousExercise, currentSetCount)`
- `getProgressiveOverloadSuggestion(exerciseId, beforeDate)`
- `getTrainingCalendarData(year, month)`
- `getTrainingRecordByDate(date)`

Behavior expectations:

- functions must tolerate missing or partial records
- date ordering should rely on existing `training_dates`
- all helper outputs should be presentation-ready enough for pages to consume with minimal reshaping

## Page-Level Design

### `pages/record`

Add:

- rest timer modal/sheet state
- previous weight summary
- `复制上次重量` action
- overload suggestion banner
- exercise guide entry and modal

Refinement guidance:

- keep set logging as the visual priority
- new actions should sit near the exercise header, not below all sets
- timer should be global to the page, not duplicated inside every exercise card

### `pages/index`

Add:

- guide entry for each exercise in the plan list
- modal/sheet reuse if practical

Goal:

- let users preview movement guidance before starting the session

### `pages/history`

Add:

- monthly training calendar at top of training tab
- month switch controls
- calendar-to-detail interaction

The existing list remains useful and should stay below the calendar.

### `pages/stats`

No required primary UI change for this scope.

Optional later enhancement:

- reuse the same calendar data model for habit visualizations

## Error Handling

- Missing previous exercise data: hide copy action and summary gracefully
- Missing guide content: show a fallback message such as `该动作教学内容稍后补充`
- Missing or invalid video URL: hide copy-link action
- Rest timer interval duplication: always clear previous interval before starting a new one
- Old records without new optional fields: continue rendering normally

## Testing Strategy

This project is currently a plain mini program without an established automated test harness, so implementation should still follow test-first thinking where practical, but will require a hybrid verification strategy.

Priority verification areas:

- rest timer opens, closes, skips, restarts, and cleans up correctly
- copying last weight pulls the most recent matching exercise only
- progressive overload suggestion appears only when heuristic conditions are met
- guide modal renders complete content and video link copy works
- calendar highlights correct days and opens correct detail records
- old stored records still load without crashes

Recommended implementation verification:

- unit-like verification for new util functions where possible
- manual workflow checks in WeChat DevTools for page interactions
- regression checks for save/load history flows

## Implementation Order

1. Repair any blocking template/config corruption in affected files
2. Add utility helpers for history lookup and calendar generation
3. Add guide data to training plan source
4. Implement record page enhancements:
   - copy last weight
   - overload suggestion
   - guide modal
   - rest timer
5. Implement history calendar
6. Run end-to-end manual verification across training save/history/stats flows

## Risks

- Current file corruption or encoding issues may slow implementation until stabilized
- `pages/record` could become cluttered if actions are not grouped carefully
- Progressive overload logic can feel arbitrary if messaging is too strong
- External video navigation limitations in WeChat make copy-link the safest initial behavior

## Open Design Choices Resolved for v1

- Rest timer duration defaults to 90 seconds
- Timer is auto-open plus dismissible
- Copy action fills weight only
- Overload guidance is advisory only
- Exercise guide includes text plus external link entry
- Calendar lives in history training tab

## Success Criteria

The feature set is successful when:

- users can complete a workout with less retyping
- the app helps maintain rest rhythm without becoming intrusive
- users receive gentle progression cues instead of forced changes
- movement guidance is available at the point of need
- consistency across training days is visible in a monthly view
