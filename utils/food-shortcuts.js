const FIELDS = ['estimatedWeight', 'calories', 'protein', 'fat', 'carbs'];
function portion(food) {
  const result = { name: String(food && food.name || '').trim().slice(0, 100) };
  FIELDS.forEach(key => { const value = Number(food && food[key]); result[key] = Number.isFinite(value) && value >= 0 ? value : 0; });
  return result;
}
function combine(favorites, frequent, limit) {
  const names = new Set();
  return (favorites || []).map(favorite).concat(frequent || []).filter(food => {
    const name = food && String(food.name || '').trim();
    if (!name || names.has(name)) return false;
    names.add(name); return true;
  }).slice(0, limit || 12);
}
function favorite(food) {
  const result = portion(food);
  if (result.estimatedWeight > 0) {
    result.per100 = {};
    ['calories', 'protein', 'fat', 'carbs'].forEach(key => { result.per100[key] = result[key] * 100 / result.estimatedWeight; });
  } else result.per100 = null;
  return result;
}
function copyMeal(foods, indices, date, generateId) {
  return (indices || []).map(index => foods[index]).filter(Boolean).map((food, index) => {
    const time = new Date(food.time);
    const local = new Date(date + 'T12:00:00');
    if (!isNaN(time.getTime())) local.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
    return { ...portion(food), id: generateId() + '_' + index, source: 'copy', time: local.toISOString(), imagePath: food.imagePath || '' };
  });
}
module.exports = { portion, favorite, combine, copyMeal };
