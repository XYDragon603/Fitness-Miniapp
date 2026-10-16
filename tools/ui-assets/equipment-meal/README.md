# 器械与餐食素材

2026-10-16，使用内置 ImageGen 生成，源图保存在 `sources/`，成品已写入项目 `images/`。`previous/` 保留被替换的旧图及首次导出备份。

## 成品规格

| 目录 | 文件 | 规格 |
| --- | --- | --- |
| `images/equipment/` | bench、rack、incline、dumbbell、dumbbell-rack | 800×600 透明 PNG |
| `images/meal/` | breakfast、lunch、dinner、snack | 600×600 RGB JPG |

器械采用统一 3/4 视角、中灰金属和柔和高光，没有外部地面阴影。已在 `#12191C` 与 `#F6F4EE` 上检查。餐食采用俯拍、暖光、浅米色桌面。晚餐记录入口已指向 `dinner.jpg`。

5 张器械合计约 216 KB，4 张餐食合计约 339 KB。[查看双底色和餐食预览](../../../docs/codex-tasks/ui-design-proposal/equipment-meal-preview.jpg)。尺寸、透明通道均已检查；逐文件尺寸和体积记录见 `validation.json`。

重建：在项目根目录运行 `python tools/ui-assets/export-equipment-meals.py`。脚本使用 Pillow，统一透明画布、留白、尺寸与编码；高分辨率 ImageGen 源图和旧文件均在工具目录，不进入小程序包。

## 提示词规格

器械共享：`3D render, realistic matte mid-gray metal, subtle neutral highlights, soft studio lighting, 3/4 front-left view, mildly elevated camera, centered complete object, isolated on true transparent background, no floor/contact/drop shadow, no text/branding, clean alpha without white or black fringe, landscape 4:3`。

分别生成：平板卧推架加杠铃；带安全杆的深蹲架；40 度可调上斜凳；一对六角哑铃；三层哑铃架。卧推架和深蹲架额外进行 ImageGen 边缘清理，导出时规范透明边缘并压缩 PNG。

餐食共享：`square overhead 90-degree food photograph, warm soft daylight, pale warm beige tabletop, off-white ceramic dishes, natural food textures, centered composition, no people/text/logo`。

- 早餐：鸡蛋、全麦吐司、小番茄、绿叶菜。
- 午餐：鸡胸肉、糙米、西兰花、胡萝卜。
- 晚餐：三文鱼、烤土豆、四季豆、小番茄。
- 加餐：莓果酸奶、香蕉、少量坚果。
