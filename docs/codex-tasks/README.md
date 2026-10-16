# 动作库改版 · Codex 任务总览

目标：参考 openGym，接入 exercises-dataset（1324 个动作），给小程序加上动作库、训练中模式和加量建议，最后整体换新 UI。

## 已确定的约束（所有任务都要遵守）

- 小程序**已上线**，**没有开通云存储**。
- **不使用数据集里的 GIF / 缩略图**：它们版权归 Gym visual，公开上线需要另行授权。只用 MIT 授权的部分：动作名、部位、器械、肌群、中文步骤（`instruction_steps.zh`）。媒体位置留占位，预留 `mediaBaseUrl` 配置项，默认为空。
- 数据集的 `name` 字段**只有英文**，没有中文名（`instructions` 和 `instruction_steps` 有 10 种语言：en/es/it/tr/ru/zh/hi/pl/ko/fr）。所以中文名由任务 01 翻译生成，中文步骤直接用 zh。
- 动作数据放在**分包** `packageExercise/`（体积约 700KB，主包不加载）。主包代码**不能**同步 `require` 分包里的文件。
- 原生小程序写法（WXML/WXSS/JS），不引入 npm 包。
- 测试沿用 `tests/*.test.js` 的写法：用 node 原生 `assert`，运行方式 `node tests/xxx.test.js`。
- 每个任务**只改自己负责的文件**（见下表）。如果需要改别人的文件，停下来说明原因。

## 数据源

数据集原始文件 `exercises.json` 有 17MB，**不进仓库**。下载到 `tmp-downloads/exercises-dataset/`（这个目录已被 `project.config.json` 的 packOptions 忽略，见任务 02）：

```
curl -L https://raw.githubusercontent.com/XYDragon603/exercises-dataset/main/data/exercises.json -o tmp-downloads/exercises-dataset/exercises.json
```

已经生成好的文件：
- `tools/exercise-data/names-input.json`：1324 条 `{id, name, body_part, equipment, target}`，作为任务 01 的输入
- `tools/exercise-data/terms.js`：部位、器械、肌群的中英对照表，以及器械分组（8 组）

## 任务与并发安排

| # | 任务 | 负责的文件 | 依赖 |
|---|---|---|---|
| 01 | 动作名翻译成中文 | `tools/exercise-data/names.zh.json` | 无 |
| 02 | 数据构建脚本 | `tools/exercise-data/build.js`、`packageExercise/data/*`、`tests/exercise-data-build.test.js`、`project.config.json`（只改 packOptions） | 01 未完成时先用英文名兜底，01 完成后重新跑一次 |
| 03 | 动作库分包页面 | `packageExercise/pages/**`、`packageExercise/lib/**`、`app.json`（只加 subpackages）、`tests/exercise-library.test.js`、`tests/fixtures/**` | 数据格式按本文档约定，可以和 02 并行 |
| 05 | 训练中模式（休息计时、上次成绩） | `pages/record/*`、`utils/rest-timer.js`、`tests/rest-timer.test.js` | 无 |
| 06 | 加量建议和个人纪录（纯逻辑） | `utils/progression.js`、`tests/progression.test.js` | 无 |
| 04 | 计划编辑接入动作库 | `pages/index/*`、`utils/workout-plan.js` | 03 |
| 07 | 整体 UI 重做和 tab 重构 | 几乎所有页面 | 全部完成后 |

**第一波并行：01、02、03、05、06**（负责的文件互不重叠）
**第二波：04**，然后把 06 的逻辑接进记录页（写在 06 的“集成”一节）
**第三波：07**

### 并行运行建议

1. 开工前先把当前所有未提交的改动 commit，作为基线。
2. 每个任务用一个独立的 git worktree 和分支，避免同时写同一个目录：
   ```
   git worktree add ../fm-t01 -b codex/t01-names
   git worktree add ../fm-t02 -b codex/t02-build
   ...
   ```
   在各自的 worktree 里运行：`codex exec -s workspace-write "Read docs/codex-tasks/0X-*.md and complete it."`
3. 合并顺序：01 → 02（合并后重新跑 build）→ 03 → 05 → 06。
4. 每个任务完成时必须跑通：自己的测试，加上 `node tests/stability-regression.test.js`。

## 共享数据约定（02 负责生成，03、04 负责读取）

### `packageExercise/data/exercise-index.js`
```js
module.exports = {
  version: 1,
  source: 'XYDragon603/exercises-dataset@<commit sha 或日期>',
  attribution: '动作数据来自 exercises-dataset（MIT）',
  bodyParts: [{ key: 'chest', label: '胸部', count: 163 }, ...],           // 按 terms.BODY_PART_ORDER 排序
  equipmentGroups: [{ key: 'dumbbell', label: '哑铃', count: 294 }, ...],  // 按 terms.EQUIPMENT_GROUPS 顺序
  equipmentLabels: { 'barbell': '杠铃', ... },                            // terms.EQUIPMENT
  muscleLabels: { 'pectorals': '胸肌', ... },                             // terms.MUSCLES
  fields: ['id', 'name', 'nameEn', 'bodyPart', 'equipment', 'equipmentGroup', 'target'],
  rows: [
    ['0025', '杠铃平板卧推', 'barbell bench press', 'chest', 'barbell', 'barbell', 'pectorals'],
    ...
  ]
};
```
`rows` 按 bodyPart 排序（顺序同 BODY_PART_ORDER），同部位内按中文名排序。

### `packageExercise/data/exercise-detail.js`
```js
module.exports = {
  '0025': { steps: ['躺在平板凳上…', '…'], muscleGroup: 'chest', secondary: ['triceps', 'shoulders'] },
  ...
};
```
`muscleGroup` 和 `secondary` 存英文 key，展示时用 `muscleLabels` 翻译。

### 页面约定（03 实现，04 调用）
- 列表页：`/packageExercise/pages/library/library`
  - 普通模式：浏览，点击进入详情。
  - 选择模式：`?mode=pick`，通过 `wx.navigateTo({ url, events: { exercisePicked(planExercise) {} } })` 打开。用户点“加入”后调用 `this.getOpenerEventChannel().emit('exercisePicked', planExercise)`，可以连续添加多个动作，点“完成”时返回。
- 详情页：`/packageExercise/pages/detail/detail?id=0025`
- `planExercise` 的结构就是计划里的 exercise（见 `utils/workout-plan.js` 的 `normalizeExercise`），另外加一个 `libraryId` 字段：
  ```js
  { id: 'lib_0025_<时间戳base36>', libraryId: '0025', name: '杠铃平板卧推', targetPart: '胸部',
    weeks: { 1: { sets: 3, reps: '10-12', note: '' } },
    guide: { summary: '<第一步>', targetMuscles: ['胸肌', '肱三头肌', '肩部'], commonMistakes: [], tips: [<其余步骤>], videoTitle: '', videoUrl: '' } }
  ```
