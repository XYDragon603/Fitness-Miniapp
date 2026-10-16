const KEY = 'exercise_favorites';
function list(api) {
  const value = api && typeof api.getStorageSync === 'function' ? api.getStorageSync(KEY) : [];
  return [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === 'string' && id.length > 0 && id.length <= 100))];
}
function toggle(id, api) {
  const ids = list(api);
  const next = ids.includes(id) ? ids.filter(item => item !== id) : [id].concat(ids);
  api.setStorageSync(KEY, next);
  return next.includes(id);
}
module.exports = { KEY, list, toggle };
