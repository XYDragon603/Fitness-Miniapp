const assert = require('assert');
const { FOODS } = require('../utils/food-db.js');
const food = require('../utils/food-suggest.js');

// 食物库数据完整、名称不重复
const names = new Set();
FOODS.forEach(item => {
  assert(item.name && !names.has(item.name), item.name);
  names.add(item.name);
  ['calories', 'protein', 'fat', 'carbs'].forEach(key => assert(Number.isFinite(item.per100[key]) && item.per100[key] >= 0, `${item.name}.${key}`));
  assert(item.grams > 0, item.name);
  // 热量与三大营养素大致自洽（4/4/9 估算，允许误差）
  const estimate = item.per100.protein * 4 + item.per100.carbs * 4 + item.per100.fat * 9;
  assert(Math.abs(estimate - item.per100.calories) <= Math.max(25, item.per100.calories * 0.25), `${item.name} kcal ${item.per100.calories} vs ${estimate}`);
});
assert(FOODS.length >= 60);

assert.deepStrictEqual(food.scaleFood({ calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9 }, 200), { calories: 232, protein: 5.2, fat: 0.6, carbs: 51.8 });

// 常吃：按次数排序，营养值取最近一次，按克数折算每 100g
const records = {
  '2026-10-14': [{ name: '鸡胸肉', estimatedWeight: 150, calories: 248, protein: 46, fat: 5, carbs: 0 }, { name: '米饭', estimatedWeight: 200, calories: 232, protein: 5, fat: 1, carbs: 52 }],
  '2026-10-15': [{ name: '鸡胸肉', estimatedWeight: 200, calories: 330, protein: 62, fat: 7, carbs: 0 }],
  '2026-10-16': [{ name: '自制沙拉', calories: 180, protein: 6, fat: 9, carbs: 12 }, { name: '' }]
};
const frequent = food.frequentFoods(records, 5);
assert.deepStrictEqual(frequent.map(item => item.name), ['鸡胸肉', '自制沙拉', '米饭']);
assert.strictEqual(frequent[0].count, 2);
assert.strictEqual(frequent[0].estimatedWeight, 200);
assert.strictEqual(Math.round(frequent[0].per100.calories), 165);
assert.strictEqual(frequent[1].per100, null, 'no grams -> no per-100g scaling');

// 候选：常吃的排前面，别名也能命中，空关键字没有候选
let list = food.suggestFoods('鸡', frequent);
assert.strictEqual(list[0].name, '鸡胸肉');
assert.strictEqual(list[0].source, 'frequent');
assert(list.some(item => item.name === '鸡蛋' && item.source === 'db'));
assert(list.length <= 6);
assert.strictEqual(food.suggestFoods('西红柿', [])[0].name, '番茄');
assert.strictEqual(food.suggestFoods('  ', frequent).length, 0);

// 选中后填表；常吃且无克数的用原值
const rice = food.suggestFoods('米饭', [])[0];
assert.deepStrictEqual(food.applySuggestion(rice), { name: '米饭', estimatedWeight: '200', calories: '232', protein: '5.2', fat: '0.6', carbs: '51.8' });
assert.strictEqual(food.applySuggestion(rice, 100).calories, '116');
const salad = food.suggestFoods('沙拉', frequent)[0];
assert.strictEqual(food.applySuggestion(salad).calories, '180');

console.log('food suggest tests passed');
