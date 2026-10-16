# 肌群 PNG 素材

2026-10-16。用户列出的名称共 16 个，因此导出 dark/light 两套共 **32 张**。

- 成品：全部 32 张在 `packageExercise/images/muscles/{dark,light}/`（详情页、选动作页用）；主包 `images/muscles/dark/` 只保留动作库首页用的 6 张（chest、back、shoulders、arms、legs、abs），以控制主包体积。
- 每张 400×800，透明 PNG，完整人体居中，头顶与脚底使用统一位置。
- 两种主题与同一视角的所有肌群使用完全相同的 alpha 轮廓；高亮实色为 `#C8F76E`。
- `cardio` 是全身 25% 淡高亮。其余组合：`arms` = 二头+前臂，`legs` = 正面大腿+小腿，`back` = 背阔+斜方。
- 32 张成品合计约 960 KB。使用 PNG 调色板和透明度表减小体积。

| 正面 | 背面 |
| --- | --- |
| chest | back |
| shoulders | traps |
| biceps | lowerback |
| arms | triceps |
| forearms | glutes |
| abs | hamstrings |
| quads | calves |
| legs | |
| cardio | |

## 可复用源文件

- `anatomy-atlas.png`：内置 ImageGen 生成的正背面分色母图。
- `bases/front-dark.png`、`front-light.png`、`back-dark.png`、`back-light.png`：400×800 透明灰色底图。
- `masks/*.png`：16 张与底图对齐的荧光绿透明蒙版，文件名与成品相同。
- `validation.json`：尺寸、取景边界、视角与文件体积记录。
- [全部成品预览](../../../docs/codex-tasks/ui-design-proposal/muscle-assets-preview.png)。

在项目根目录执行 `python tools/ui-assets/build-muscles.py` 可重建全部素材。脚本使用 Pillow、NumPy、SciPy；直接使用本地母图，不需要再次调用模型。

## ImageGen 提示词规格

Use case: scientific-educational. Transparent square anatomy segmentation atlas with the same adult athletic mannequin shown full-body front and back, centered in separate halves, matched scale and head/sole alignment. Faceless head, neutral modest pelvis, clean superficial muscle contours. Arms nearly vertical with wrists beside upper thighs, fingers down, feet under hips, clear transparent gap between figures. No labels, shadows, floors or watermarks.

Neutral body gray. Front segmentation: chest red `#E64B5D`, deltoids blue `#4088E8`, biceps orange `#F4A340`, forearms cyan `#40C5CC`, abs/obliques yellow `#E7D34B`, quads purple `#9A62DE`, lower legs magenta `#D85CBB`. Back segmentation: lats blue, traps yellow, lumbar erectors orange, triceps red, glutes purple, hamstrings cyan, calves magenta. Final gray themes and `#C8F76E` overlays are exported from this single source by the local script.
