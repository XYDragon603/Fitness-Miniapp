原始 JSON 下载到 `tmp-downloads/exercises-dataset/exercises.json`，不随小程序上传。
运行 `node tools/exercise-data/build.js` 构建动作索引和中文步骤；`--source <path>` 指定来源，`--version <SHA或日期>` 标记更新快照。
中文名来自 `names.zh.json`，缺失时回退英文并打印数量；更新翻译后重新构建。
运行 `node tests/exercise-data-build.test.js` 验证规则；数据仅含文本，不含数据集媒体。
数据来源：https://github.com/XYDragon603/exercises-dataset （MIT）。
