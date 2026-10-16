// 饮食记录的输入建议：内置食物库 + 自己常吃的。纯函数。
const { FOODS } = require('./food-db.js');

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

// 按克数换算营养值
function scaleFood(per100, grams) {
  const ratio = (Number(grams) || 0) / 100;
  return {
    calories: Math.round(per100.calories * ratio),
    protein: round1(per100.protein * ratio),
    fat: round1(per100.fat * ratio),
    carbs: round1(per100.carbs * ratio)
  };
}

// 最近的饮食记录里按名称统计次数，取吃得最多的；营养值用最近一次的
function frequentFoods(recordsByDate, limit) {
  const max = limit || 8;
  const stats = {};
  Object.keys(recordsByDate || {}).sort().forEach(date => {
    (recordsByDate[date] || []).forEach(food => {
      const name = String(food && food.name || '').trim();
      const grams = Number(food && food.estimatedWeight) || 0;
      if (!name || !(Number(food.calories) >= 0)) return;
      const entry = stats[name] || { name, count: 0 };
      entry.count += 1;
      entry.lastDate = date;
      entry.estimatedWeight = grams;
      entry.calories = Math.round(Number(food.calories) || 0);
      entry.protein = round1(food.protein);
      entry.fat = round1(food.fat);
      entry.carbs = round1(food.carbs);
      // 有克数时记下每 100g 的值，方便改重量后按比例换算
      entry.per100 = grams > 0 ? {
        calories: entry.calories / grams * 100,
        protein: entry.protein / grams * 100,
        fat: entry.fat / grams * 100,
        carbs: entry.carbs / grams * 100
      } : null;
      stats[name] = entry;
    });
  });
  return Object.values(stats)
    .sort((a, b) => b.count - a.count || (b.lastDate || '').localeCompare(a.lastDate || ''))
    .slice(0, max);
}

// 输入名称时的候选：先常吃的，再食物库；名称或别名包含关键字
function suggestFoods(keyword, frequent, limit) {
  const text = String(keyword || '').trim();
  if (!text) return [];
  const max = limit || 6;
  const results = [];
  const seen = {};
  (frequent || []).forEach(food => {
    if (food.name.includes(text) && !seen[food.name]) {
      seen[food.name] = true;
      results.push({
        name: food.name,
        source: 'frequent',
        grams: food.estimatedWeight || 100,
        per100: food.per100,
        fixed: food.per100 ? null : { calories: food.calories, protein: food.protein, fat: food.fat, carbs: food.carbs },
        hint: food.estimatedWeight ? `常吃 · ${food.estimatedWeight}g ${food.calories} kcal` : `常吃 · ${food.calories} kcal`
      });
    }
  });
  FOODS.forEach(food => {
    const hit = food.name.includes(text) || food.aliases.some(alias => alias.includes(text)) || text.includes(food.name);
    if (hit && !seen[food.name]) {
      seen[food.name] = true;
      results.push({
        name: food.name,
        source: 'db',
        grams: food.grams,
        per100: food.per100,
        fixed: null,
        hint: `参考值 · ${food.per100.calories} kcal/100g`
      });
    }
  });
  return results.slice(0, max);
}

// 选中候选后填进表单（字符串，和输入框一致）
function applySuggestion(suggestion, grams) {
  const weight = Number(grams) > 0 ? Number(grams) : suggestion.grams;
  const values = suggestion.per100 ? scaleFood(suggestion.per100, weight) : suggestion.fixed;
  return {
    name: suggestion.name,
    estimatedWeight: String(weight),
    calories: String(values.calories),
    protein: String(values.protein),
    fat: String(values.fat),
    carbs: String(values.carbs)
  };
}

module.exports = { scaleFood, frequentFoods, suggestFoods, applySuggestion };
