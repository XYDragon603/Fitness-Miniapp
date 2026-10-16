# 任务 02：动作数据构建脚本

开工前先读 `docs/codex-tasks/README.md`，其中的“约束”和“共享数据约定”是硬性要求。

## 目标
写 `tools/exercise-data/build.js`（Node，不依赖第三方包），把数据集转换成小程序分包能直接 `require` 的两个文件：
- `packageExercise/data/exercise-index.js`
- `packageExercise/data/exercise-detail.js`

文件格式严格按 README 的“共享数据约定”。

## 输入
- `--source <path>`：数据集 `exercises.json`，默认 `tmp-downloads/exercises-dataset/exercises.json`。不存在时打印下载命令并以非 0 退出。
- `tools/exercise-data/terms.js`
- `tools/exercise-data/names.zh.json`（任务 01 产出）。**可以不存在**：缺失或缺某个 id 时用英文名兜底，并在最后打印“N 个动作没有中文名”。

## 规则
- 只读这些字段：`id, name, body_part, equipment, target, muscle_group, secondary_muscles, instruction_steps.zh`。**不要**输出 image、gif_url、media_id、其他语言。
- 遇到 terms 里没有的部位、器械或肌群术语：打印清单并以非 0 退出（不要静默跳过）。`muscleLabels` 要覆盖 target、muscle_group、secondary 出现的所有值。
- 中文步骤：去掉每一步首尾的空白；过滤空步骤；去掉开头的“1.”“步骤1：”这类编号。
- secondary 去重，并去掉和 target 同义的项（比如 target 是 lats 时去掉 `lats` 和 `latissimus dorsi`；同义判断依据是 terms.MUSCLES 中文相同）。
- 输出文件开头写注释 `// 由 tools/exercise-data/build.js 生成，请勿手改`，用 `JSON.stringify` 输出（不缩进，控制体积），以 `module.exports = ` 开头。
- 运行结束时打印统计：总数、各部位数量、两个文件的 KB 数。**两个文件合计必须 < 1.2MB**，超过就报错。
- 把构建逻辑导出为纯函数 `buildExerciseData(rawList, terms, namesZh)` → `{ index, detail, warnings }`，CLI 只负责读写文件，方便测试。

## 打包配置
在 `project.config.json` 的 `packOptions.ignore` 里加入以下 folder 项（小程序上传时不打包这些目录）：`tools`、`tests`、`docs`、`tmp-downloads`、`tmp-skill-build`。只改 packOptions，其余不动。

## 测试 `tests/exercise-data-build.test.js`
用 3 到 5 条手写的假数据测试 `buildExerciseData`：字段顺序和 `fields` 一致；中文名兜底；未知术语报错；secondary 去重和同义过滤；步骤编号被清理；bodyParts 和 equipmentGroups 的计数正确。

## 完成标准
- `node tools/exercise-data/build.js` 用真实数据跑通，并生成两个文件
- `node tests/exercise-data-build.test.js` 和 `node tests/stability-regression.test.js` 通过
- 在 `tools/exercise-data/README.md` 写 5 行以内的用法说明
