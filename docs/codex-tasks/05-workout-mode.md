# 任务 05：训练中模式（组间休息计时、上次成绩）

开工前先读 `docs/codex-tasks/README.md`。

## 负责的文件
`pages/record/record.{js,wxml,wxss,json}`、`utils/rest-timer.js`、`tests/rest-timer.test.js`

## 1. 休息计时器
- `utils/rest-timer.js`：纯逻辑，时间通过参数注入，不在内部调用 `Date.now()`，方便测试：
  - `createTimer(durationSec, startedAt)` → `{ durationSec, startedAt, endsAt }`
  - `getRemaining(timer, now)` → 剩余秒数（≥ 0，向上取整）
  - `adjust(timer, deltaSec)`：±15 秒，剩余时间不能小于 0
  - `isFinished(timer, now)`
  - `DEFAULT_REST_SEC = 90`，`REST_PRESETS = [60, 90, 120, 180]`
- 记录页的交互：`toggleSetDone` 把某组标为完成，并且这不是该动作的最后一组时，自动启动计时器。
  - 页面底部浮出一个计时条：大字倒计时 `1:30`，以及 `-15s`、`+15s`、`跳过` 三个按钮。倒计时会挤占自定义 tabBar 的位置，用现有的 `setCustomTabBarHidden` 处理。
  - 用 `setInterval` 每秒刷新一次。刷新时**只 setData 倒计时这一个字段**。剩余时间根据 `endsAt` 计算（切到后台再回来时依然准确）。`onHide` 时停止 interval，`onShow` 时如果计时还没结束就恢复。
  - 计时结束：`wx.vibrateLong()`，计时条显示“休息结束 · 开始下一组”，3 秒后自动收起。
  - 默认时长可以在计时条上长按切换预设，用 `wx.setStorageSync('rest_timer_default_sec')` 记住。
  - 计时器运行期间调用 `wx.setKeepScreenOn({ keepScreenOn: true })`，结束或页面卸载时恢复为 false。
- 休息日（`isRestDay`）不显示计时器。

## 2. 显示上次成绩
- 记录页已经能拿到 `previousRecord`（见 `buildSetWeightOptions`、`copyLastWeight`）。在每一组那一行下方加一行小字“上次 60kg × 10”。上次没有对应的组时不显示。
- 动作卡片头部显示上次训练的日期，如“上次：10月12日”（用 `util.formatDateCN`）。
- 这一步只用已有数据，不改存储结构。

## 不要做
不要改 `utils/util.js` 和存储 key，不要做加量建议（那是任务 06）。

## 测试
`tests/rest-timer.test.js`：开始、剩余、调整的边界、结束判断、后台恢复（now 跳跃）。

## 完成标准
测试和 `node tests/stability-regression.test.js` 通过。在开发者工具中：完成一组 → 计时条出现 → ±15 生效 → 切后台 10 秒再回来时间正确 → 结束后震动并收起。
