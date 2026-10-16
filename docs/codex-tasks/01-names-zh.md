# Task: translate exercise names to Simplified Chinese

> 开工前先读 `docs/codex-tasks/README.md`。这个任务可以和 02、03、05、06 并行。

Input: `tools/exercise-data/names-input.json` — array of 1324 objects `{id, name, body_part, equipment, target}` (English).
Output: write `tools/exercise-data/names.zh.json` — ONE JSON object mapping every `id` to its Chinese name:
`{"0001": "3/4 仰卧起坐", "0025": "杠铃平板卧推", ...}`

Do NOT modify any other file in the repository. Only create `tools/exercise-data/names.zh.json`
(you may create helper scripts under `tools/exercise-data/_codex/` if needed).

## Rules
- Audience: Chinese gym users in mainland China. Use the terms they actually say in gyms.
- Equipment/variation first, movement last: "dumbbell incline bench press" -> "哑铃上斜卧推", "cable seated row" -> "绳索坐姿划船", "lever seated fly" -> "器械坐姿飞鸟".
- Standard terms: bench press 卧推, squat 深蹲, deadlift 硬拉, row 划船, curl 弯举, fly 飞鸟, pulldown 下拉, pull-up 引体向上, chin-up 反手引体向上, push-up 俯卧撑, dip 臂屈伸, shoulder press 肩推, lateral raise 侧平举, front raise 前平举, shrug 耸肩, lunge 箭步蹲, crunch 卷腹, sit-up 仰卧起坐, plank 平板支撑, calf raise 提踵, leg press 腿举, leg extension 腿屈伸, leg curl 腿弯举, hip thrust 臀推, good morning 早安式体前屈, pullover 仰卧上拉, skull crusher 仰卧臂屈伸, kickback 后踢/臂屈伸后踢(by context), stretch 拉伸, hold 静态保持.
- Equipment: barbell 杠铃, dumbbell 哑铃, cable 绳索/龙门架 (prefer 绳索), lever/leverage machine 器械, smith 史密斯, ez barbell / ez bar 曲杆, kettlebell 壶铃, band 弹力带, stability ball 瑞士球, bosu ball 波速球, medicine ball 药球, trap bar 六角杠, sled 雪橇, weighted 负重, assisted 辅助, body weight usually omitted unless needed to disambiguate.
- Grip/position: close-grip 窄握, wide-grip 宽握, reverse grip 反握, neutral grip 对握, incline 上斜, decline 下斜, seated 坐姿, standing 站姿, lying 仰卧/俯卧 (by context: prone 俯卧, supine 仰卧), one arm / single arm 单臂, one leg 单腿, alternate 交替, kneeling 跪姿, rear delt 后束.
- Keep the name concise (usually <= 14 Chinese characters). Keep meaningful qualifiers like "(男)", "v.2", "(version 2)" as "（版本2）"; keep numbers and fractions.
- Every id in the input must appear in the output; no extra ids; values must be non-empty and contain Chinese characters (proper nouns like "Jackknife" may be translated by meaning, e.g. 折刀).
- Names must be unique where English names are unique; if two different English names would collide, add a distinguishing qualifier.
- Output valid UTF-8 JSON, 2-space indent, keys sorted by id.

## Verify before finishing
Run a quick node check: count == 1324, all ids present, all values non-empty with CJK chars, report duplicates. Fix any issues.
