const assert = require('assert');
const view = require('../utils/records-view.js');

// 饮食按时间归餐：早餐 / 午餐 / 加餐，按时间排序，没有照片时用对应餐的占位图
const local = (hours, minutes) => new Date(2026, 9, 16, hours, minutes).toISOString();
const meals = view.buildMealGroups([
  { name: '米饭', calories: 232, estimatedWeight: 200, time: local(12, 20) },
  { name: '鸡蛋', calories: 140.4, time: local(7, 30) },
  { name: '全麦面包', calories: 345, time: local(7, 45), imagePath: 'wxfile://bread.jpg' },
  { name: '鸡胸肉', calories: 248, time: local(12, 40) },
  { name: '香蕉', calories: 105, time: local(16, 0) },
  { name: '无时间', calories: 10 }
]);
assert.deepStrictEqual(meals.map(meal => meal.label), ['早餐', '午餐', '加餐']);
assert.strictEqual(meals[0].time, '07:30');
assert.strictEqual(meals[0].calories, 485);
assert.strictEqual(meals[0].image, 'wxfile://bread.jpg');
assert.strictEqual(meals[0].names, '鸡蛋 · 全麦面包');
assert.strictEqual(meals[1].items.length, 3, 'records without time fall into lunch');
assert.strictEqual(meals[1].items[0].weight, '200 g');
assert.strictEqual(meals[1].image, '/images/meal/lunch.jpg');
assert.strictEqual(meals[2].items[0].index, 4, 'index points back into the original list for deletion');
assert.deepStrictEqual(view.buildMealGroups([]), []);

// 本周（周一开始）
const records = {
  '2026-10-13': { date: '2026-10-13', exercises: [] },
  '2026-10-14': { date: '2026-10-14', type: 'rest' },
  '2026-10-16': { date: '2026-10-16', exercises: [] }
};
const week = view.weekTrainingCounts(records, '2026-10-16');
assert.strictEqual(week[0].date, '2026-10-12');
assert.strictEqual(week[0].label, '周一');
assert.deepStrictEqual(week.map(day => day.count), [0, 1, 0, 0, 1, 0, 0]);
assert.strictEqual(week[2].isRest, true);
assert.strictEqual(week[4].isToday, true);
assert.strictEqual(view.weekTrainingCounts(records, '2026-10-18')[0].date, '2026-10-12', 'Sunday belongs to the same week');

// 月历：2026 年 10 月 1 日是周四，前面补 3 天
const month = view.calendarMonth(2026, 10, records, '2026-10-16');
assert.strictEqual(month.title, '2026年10月');
assert.strictEqual(month.weeks[0][0].date, '2026-09-28');
assert.strictEqual(month.weeks[0][3].day, 1);
assert.strictEqual(month.weeks[0][3].inMonth, true);
const cells = month.weeks.flat();
assert.strictEqual(cells.find(cell => cell.date === '2026-10-14').type, 'rest');
assert.strictEqual(cells.find(cell => cell.date === '2026-10-16').isToday, true);
assert.strictEqual(month.weeks.length, 5);

// 单日训练：训练量、组数、个人纪录标记
const day = {
  date: '2026-10-16', durationMin: 46,
  exercises: [
    { id: 'a', libraryId: '0025', name: '杠铃卧推', targetPart: '胸部', completed: true, sets: [
      { weight: '60', reps: '12', done: true }, { weight: '60', reps: '10', done: true }] },
    { id: 'b', name: '双杠臂屈伸', sets: [{ weight: '', reps: '12', done: true }, { weight: '', reps: '8', done: false }] }
  ]
};
const older = { date: '2026-10-10', exercises: [{ id: 'a', libraryId: '0025', sets: [{ weight: '57.5', reps: '12', done: true }] }] };
const summary = view.trainingDaySummary(day, [older, day]);
assert.strictEqual(summary.volume, 60 * 12 + 60 * 10);
assert.strictEqual(summary.setCount, 3);
assert.strictEqual(summary.completed, 1);
assert.strictEqual(summary.durationMin, 46);
assert.strictEqual(summary.items[0].isPR, true);
assert.strictEqual(summary.items[0].sets[0].isPR, true);
assert.strictEqual(summary.items[0].sets[1].isPR, false);
assert.strictEqual(summary.items[1].sets[0].value, '自重 × 12');
assert.strictEqual(summary.items[1].sets[1].value, '未完成');
assert.strictEqual(view.trainingDaySummary({ type: 'rest' }, []), null);

// 体重
const weights = [
  { date: '2026-09-18', weight: 69.6 }, { date: '2026-10-02', weight: 68.9 },
  { date: '2026-10-16', weight: 68.4 }, { date: '2026-08-01', weight: 72 }
];
const series = view.weightSeries(weights, 30, '2026-10-16');
assert.deepStrictEqual(series.points.map(point => point.date), ['2026-09-18', '2026-10-02', '2026-10-16']);
assert.strictEqual(series.change, -1.2);
assert.strictEqual(series.latest.weight, 68.4);
assert.strictEqual(view.weightSeries([], 30, '2026-10-16').latest, null);
const chart = view.lineChartSvg(series.points);
assert(chart.startsWith('data:image/svg+xml;utf8,<svg'));
assert(!chart.includes('#'), 'colors must be URL-encoded inside data URIs');
assert.strictEqual(view.lineChartSvg([]), '');
assert(view.ringSvg(86).includes('stroke-dashoffset'));

console.log('records view tests passed');
