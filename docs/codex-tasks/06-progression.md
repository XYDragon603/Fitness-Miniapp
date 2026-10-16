# 任务 06：加量建议和个人纪录（纯逻辑）

开工前先读 `docs/codex-tasks/README.md`。

## 负责的文件
`utils/progression.js`、`tests/progression.test.js`。**第一波只写纯逻辑和测试，不改页面**。

## 背景
- 训练记录按 `training_${date}` 存储，结构见 `utils/util.js` 的 `saveTrainingRecord` 和 `getPreviousExerciseRecords`。每个 exercise 有 `id`、`sets: [{ weight, reps, done }]`（weight 和 reps 可能是字符串），计划中的次数是 `planReps`，例如 `'10-12'`、`'15, 12, 10, 8'`、`'12'`。
- `utils/util.js` 已经有 `parsePlanRepsMeta`、`isExerciseStable`、`getProgressiveOverloadSuggestion`。**先读懂它们**。新逻辑应该是它们的升级版，并且复用 `parsePlanRepsMeta`，不要重复实现。

## 导出（全部是纯函数，输入是记录数组，不读 storage）
1. `suggestNextTarget({ planReps, planSets, history, increment })`，采用双重递进（double progression）：
   - `history` 是该动作最近的记录（新的在前），只看已完成（`done`）的组。
   - 上次所有完成组都达到区间**上限** → 重量 + increment（默认 2.5，返回值保留 1 位小数），次数回到下限。
   - 达到下限但没到上限 → 重量不变，目标是每组 +1 次。
   - 连续 2 次有组低于下限 → 建议降 10%（四舍五入到 0.5kg），并给出原因。
   - 自重（weight 为 0 或空）→ 只建议次数。
   - 返回 `{ type: 'increase' | 'hold' | 'reps' | 'deload' | 'none', weight, reps, message }`，`message` 是一句中文，例如“上次每组都做满 12 次，这次试试 62.5kg × 10”。
   - 计划中写的是金字塔次数（如 `'15, 12, 10, 8'`）时，逐组比较。
2. `estimateOneRepMax(weight, reps)`：Epley 公式，reps > 12 时返回 null。
3. `findPersonalRecords(records, key)`：`key` 是 exercise 的 `libraryId`，没有 libraryId 时用 `id`。返回 `{ bestWeight: {weight, reps, date}, bestE1RM: {...}, bestVolume: {volume, date} }`。
4. `detectNewRecords(todayExercise, previousPRs)` → 今天打破的纪录列表，用于在保存后提示“新纪录 🎉”。

## 测试
上面每条规则至少一个用例，另外覆盖：字符串数字、空组、未完成组、金字塔次数、自重、降重的四舍五入。

## 集成（第二波，04 合并之后再做，新开一个 Codex 会话）
- 记录页每个动作卡片显示 `suggestNextTarget` 的 message，加“采用”按钮，点击把建议的重量和次数填进各组。
- 保存记录后调用 `detectNewRecords`，有新纪录就弹 toast。
- 统计页新增“个人纪录”卡片，列出各动作的 bestWeight 和 bestE1RM。
- 统一用 `utils/progression.js` 的逻辑；`util.getProgressiveOverloadSuggestion` 改为调用新逻辑，保持对外签名不变。
