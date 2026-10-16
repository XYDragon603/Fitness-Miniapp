const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ui = require('../utils/ui-helpers.js');

const root = path.resolve(__dirname, '..');

function exists(webPath) {
  return fs.existsSync(path.join(root, webPath));
}

// 器械插图：按动作名关键字，其次按器械分组
assert.strictEqual(ui.equipmentImage('杠铃卧推'), '/images/equipment/bench.png');
assert.strictEqual(ui.equipmentImage('哑铃上斜卧推'), '/images/equipment/incline.png');
assert.strictEqual(ui.equipmentImage('杠铃深蹲'), '/images/equipment/rack.png');
assert.strictEqual(ui.equipmentImage('高位下拉'), '/images/equipment/pulldown.png');
assert.strictEqual(ui.equipmentImage('杠铃硬拉'), '/images/equipment/barbell.png');
assert.strictEqual(ui.equipmentImage('平板支撑', 'bodyweight'), '/images/equipment/rack.png');
assert.strictEqual(ui.equipmentImage('未知动作'), '/images/equipment/bench.png');
assert.strictEqual(ui.equipmentImage('哑铃侧平举'), '/images/equipment/dumbbell.png');
assert.strictEqual(ui.equipmentImage('壶铃摇摆'), '/images/equipment/dumbbell.png');
assert.strictEqual(ui.equipmentImage('某动作', 'dumbbell'), '/images/equipment/dumbbell.png');
assert(exists('/images/equipment/dumbbell-rack.png'));
['bench', 'incline', 'rack', 'pulldown', 'barbell', 'dumbbell'].forEach(name => assert(exists(`/images/equipment/${name}.png`), name));

// 数据集动作图：libraryId 优先，内置动作按名称，找不到返回 null
const bench = ui.exerciseMedia({ libraryId: '0025', name: '随便' });
assert(bench.thumb.endsWith('/images/0025-EIeI8Vf.jpg'));
assert(bench.gif.endsWith('/videos/0025-EIeI8Vf.gif'));
assert(bench.thumb.startsWith(ui.MEDIA_BASE_URL));
assert.strictEqual(ui.exerciseMedia({ name: '杠铃卧推' }).thumb, bench.thumb);
assert.strictEqual(ui.exerciseMedia('0025').gif, bench.gif);
assert.strictEqual(ui.exerciseMedia({ name: '自创动作' }), null);
assert.strictEqual(ui.exerciseMedia({ libraryId: '9999' }), null);
assert.strictEqual(ui.exerciseMedia(null), null);
assert.strictEqual(Object.keys(require('../utils/exercise-media.js')).length, 1324);

// 肌肉图：中英文都能匹配，且对应文件存在
assert.strictEqual(ui.muscleKey('胸部'), 'chest');
assert.strictEqual(ui.muscleKey('肱三头肌'), 'triceps');
assert.strictEqual(ui.muscleKey('上臂'), 'arms');
assert.strictEqual(ui.muscleKey('lats'), 'back');
assert.strictEqual(ui.muscleKey('三角肌中束'), 'shoulders');
assert.strictEqual(ui.muscleKey('大腿/臀'), 'glutes');
assert.strictEqual(ui.muscleKey('腘绳肌'), 'hamstrings');
assert.strictEqual(ui.muscleKey('cardiovascular system'), 'cardio');
assert.strictEqual(ui.muscleKey(''), 'chest');
['胸部', '背部', '肩部', '上臂', '腰腹核心', '大腿/臀', '小腿', '前臂', '有氧', '颈部', 'triceps', 'hamstrings', 'spine']
  .forEach(text => {
    assert(exists(ui.muscleImage(text, 'dark')), text);
    assert(exists(ui.muscleImage(text, 'light')), text);
  });

// 训练日简称
assert.strictEqual(ui.dayFocus({ name: '胸 · 三角肌中束 · 三头' }), '胸');
assert.strictEqual(ui.dayFocus({ name: '腿臀日' }), '腿臀');
assert.strictEqual(ui.dayFocus({ name: '休息日', type: 'rest' }), '休息');
assert.strictEqual(ui.dayFocus({ name: '' }), '训练');
assert.strictEqual(ui.dayFocus(null), '');

assert.strictEqual(ui.todayTitle({ name: '胸 · 三角肌中束 · 三头' }), '今天，练胸');
assert.strictEqual(ui.todayTitle({ name: '力量训练 A' }), '今天，力量训练');
assert.strictEqual(ui.todayTitle({ name: '轻有氧 / 快走' }), '今天，轻有氧');
assert.strictEqual(ui.todayTitle({ name: '休息日', type: 'rest' }), '今天，认真恢复');
assert.strictEqual(ui.todayTitle(null), '今天，动起来');
assert.strictEqual(ui.shortFocus({ name: '力量训练 A' }), '力量');
assert.strictEqual(ui.shortFocus({ name: '背 · 三角肌后束' }), '背');
assert.strictEqual(ui.shortFocus({ name: '上肢推拉日' }), '上肢推');

assert.strictEqual(ui.compactDayName({ name: '胸 · 三角肌中束 · 三头' }), '胸与三头');
assert.strictEqual(ui.compactDayName({ name: '背 · 三角肌后束 · 二头' }), '背与二头');
assert.strictEqual(ui.compactDayName({ name: '力量训练 A' }), '力量训练 A');
assert.strictEqual(ui.compactDayName({ name: '轻有氧 / 快走' }), '轻有氧');
assert.strictEqual(ui.compactDayName({ name: '腿 · 臀 · 股四头肌' }), '腿');
assert.strictEqual(ui.compactDayName({ name: '休息 / 拉伸', type: 'rest' }), '休息 / 拉伸');
assert.strictEqual(ui.compactDayName(null), '');

// 时长估算：5 个动作 × 4 组，40s + 90s → 43 分钟 → 45
const exercises = Array.from({ length: 5 }, () => ({ weeks: { 1: { sets: 4 } } }));
assert.strictEqual(ui.estimateMinutes(exercises), 45);
assert.strictEqual(ui.estimateMinutes([]), 0);
assert.strictEqual(ui.estimateMinutes([{ sets: 1 }], 10), 5);

assert.strictEqual(ui.formatThousands(1680), '1,680');
assert.strictEqual(ui.formatThousands(1234567.4), '1,234,567');
assert.strictEqual(ui.formatThousands(undefined), '0');
assert.strictEqual(ui.percent(1680, 2200), 76);
assert.strictEqual(ui.percent(3000, 2200), 100);
assert.strictEqual(ui.percent(10, 0), 0);
assert.strictEqual(ui.formatRestLabel(90), '01:30');
assert.strictEqual(ui.formatRestLabel(-3), '00:00');
assert.strictEqual(ui.monthDay('2026-10-16'), '10.16');
assert.strictEqual(ui.weekdayLabel('2026-10-16'), '周五');
assert.strictEqual(ui.dateTitle('2026-10-16'), '10月16日');

console.log('ui helpers tests passed');
