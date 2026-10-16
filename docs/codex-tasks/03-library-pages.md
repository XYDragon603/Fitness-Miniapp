# 任务 03：动作库分包（列表页、详情页）

开工前先读 `docs/codex-tasks/README.md`。数据格式和页面约定都以那里为准。

## 文件
- `packageExercise/lib/exercise-library.js`：纯逻辑，不调用 `wx`
- `packageExercise/pages/library/library.{js,json,wxml,wxss}`
- `packageExercise/pages/detail/detail.{js,json,wxml,wxss}`
- `app.json`：只新增
  ```json
  "subpackages": [{ "root": "packageExercise", "pages": ["pages/library/library", "pages/detail/detail"] }],
  "preloadRule": { "pages/index/index": { "network": "all", "packages": ["packageExercise"] } }
  ```
- `tests/exercise-library.test.js`、`tests/fixtures/exercise-index.sample.js`、`tests/fixtures/exercise-detail.sample.js`（各约 10 条，格式和真实数据一致）

任务 02 可能还没完成。开发和测试时用 fixture；页面里 `require('../../data/exercise-index.js')` 用真实路径。

## `exercise-library.js` 导出
- `expandIndex(index)` → 对象数组 `{ id, name, nameEn, bodyPart, bodyPartLabel, equipment, equipmentLabel, equipmentGroup, target, targetLabel, searchText }`。`searchText` 是中文名、英文名、目标肌中文、器械中文拼起来的小写字符串。
- `filterExercises(list, { keyword, bodyPart, equipmentGroup })`：keyword 按空格分词，所有词都要命中 searchText；`bodyPart`、`equipmentGroup` 为空或 `'all'` 表示不过滤。
- `getDetail(index, detailMap, id)` → 列表项字段 + `steps`、`muscleGroupLabel`、`secondaryLabels[]`。id 不存在时返回 null。
- `toPlanExercise(item, detail, now = Date.now())` → README 约定的 `planExercise` 结构。`targetPart` 取 bodyPartLabel。`guide.targetMuscles` = [targetLabel, ...secondaryLabels] 去重。`guide.summary` 是第一步，`guide.tips` 是其余步骤。

## 列表页
- 顶部：搜索框（输入防抖 200ms），下方两行横向滚动的筛选 chip：部位（全部 + bodyParts，带数量），器械组（全部 + equipmentGroups）。
- 列表：单列卡片，显示中文名（粗体）、英文名（小字灰色）、标签“部位 · 器械 · 目标肌”。左侧是 88rpx 的圆角色块，内容为部位首字，每个部位一种颜色，**不使用图片**。
- 性能：1324 条不能一次 `setData`。分页渲染每次 40 条，`onReachBottom` 追加。筛选变化时重置。在 `data` 里只放当前要展示的字段。
- 顶部显示“共 N 个动作”。为空时显示空状态和“清除筛选”按钮。
- 选择模式（`mode=pick`）：每张卡片右侧有“＋加入”按钮，点击后 emit `exercisePicked`，按钮变为“已加入 ✓”（本次会话内可以再点一次加入，即允许同一动作加两次）。底部固定一个“完成（已选 N）”按钮，点击返回。普通模式下点卡片进入详情。
- 页面底部小字显示 `attribution`。

## 详情页
- 标题区：中文名、英文名、部位/器械/目标肌标签。
- 媒体位：一个 16:9 的占位卡片，显示“动作演示即将上线”。`mediaBaseUrl` 常量放在 lib 里，默认 `''`；不为空时才渲染 `<image>`，地址为 `${mediaBaseUrl}/${id}.gif`。
- 肌群：主要肌群（target + muscleGroup）和次要肌群（secondary），用 chip 展示。
- 步骤：带编号的列表。
- 底部按钮：“加入训练计划”。如果是从选择模式进入详情（通过 query `mode=pick` 透传，并通过 eventChannel 转发），就 emit；否则 toast“请在计划编辑中添加”。
- 支持 `onShareAppMessage`，分享路径带 id。

## 样式
沿用 `app.wxss` 里的 `--air-*` 变量和 `.card`、`.btn-primary` 等全局类。不要新增全局样式。

## 测试
覆盖 `expandIndex`、`filterExercises`（多词、部位与器械组合、空关键词）、`getDetail`（不存在的 id）、`toPlanExercise`（字段结构和 `normalizeExercise` 兼容：用 `require('../utils/workout-plan.js')` 验证，如果它没导出 normalizeExercise，就只断言结构）。

## 完成标准
测试通过，`node tests/stability-regression.test.js` 通过。在微信开发者工具里列表能滚动、搜索、筛选，详情能打开。
