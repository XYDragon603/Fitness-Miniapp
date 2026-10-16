# 任务 04：计划编辑接入动作库

依赖任务 03 已合并。开工前先读 `docs/codex-tasks/README.md`。

## 负责的文件
`pages/index/index.{js,wxml,wxss}`、`utils/workout-plan.js`

## 改动
1. **保留 `libraryId`**：`utils/workout-plan.js` 的 `normalizeExercise` 目前会丢掉额外字段。改为：如果有 `libraryId`（4 位数字字符串）就保留下来。其他行为不变，现有存储数据要能正常读取。
2. **从动作库添加**：自定义计划编辑弹层（`openCreatePlan` 和 `planDraft`）里，每个训练日的“添加动作”旁边加一个“从动作库选择”按钮：
   ```js
   wx.navigateTo({
     url: '/packageExercise/pages/library/library?mode=pick',
     events: { exercisePicked: (planExercise) => { /* 追加到 planDraft.days[dayIndex].exercises */ } }
   });
   ```
   - 如果当前训练日只有一个空的草稿动作（名字为空），选中的第一个动作替换它，而不是追加在后面。
   - 草稿动作的字段要和 `createDraftExercise()` 兼容。需要的话扩展 `createDraftExercise` 和 `submitCustomPlan` / `buildTrainingDay`，让 `libraryId` 和 `guide` 能一路保存进计划。
   - 打开弹层时调用了 `setCustomTabBarHidden`，跳转分包页面并返回后，要保持原来的隐藏状态。
3. **查看教学**：`openGuide` 遇到有 `libraryId` 的动作时，跳转 `/packageExercise/pages/detail/detail?id=<libraryId>`；没有的话保持原来的弹层。
4. **编辑已有自定义计划**：如果现在不支持编辑，不要新增这个功能，只处理新建流程。

## 测试
在 `tests/` 新增 `workout-plan-library.test.js`：`normalizeExercise` 保留合法的 libraryId、丢弃非法的 libraryId；带 libraryId 的计划经过 `upsertCustomPlan` 读写往返后字段不丢。需要模拟 `wx.getStorageSync` / `setStorageSync`，参考现有测试里的写法。

## 完成标准
新测试和 `node tests/stability-regression.test.js` 通过。在开发者工具中走一遍：新建计划 → 从动作库加 3 个动作 → 保存 → 启用 → 在首页看到动作 → 点“查看教学”打开详情页。
