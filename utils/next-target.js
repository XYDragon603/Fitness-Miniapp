// “下次目标”：在“下一组目标”页点“采用建议 / 保持当前重量”后保存，下次练同一动作时预填。
const STORAGE_KEY = 'exercise_next_targets';

function readAll() {
  if (typeof wx === 'undefined') return {};
  const value = wx.getStorageSync(STORAGE_KEY);
  return value && typeof value === 'object' ? value : {};
}

function getNextTarget(key) {
  if (!key) return null;
  const target = readAll()[key];
  return target && Array.isArray(target.weights) ? target : null;
}

function saveNextTarget(key, target) {
  if (!key || !target || typeof wx === 'undefined') return;
  const all = readAll();
  all[key] = {
    weights: (target.weights || []).map(value => (value === null || value === undefined ? '' : String(value))),
    repsBySet: (target.repsBySet || []).map(value => (value === null || value === undefined ? '' : String(value))),
    source: target.source || 'suggestion',
    savedAt: new Date().toISOString()
  };
  wx.setStorageSync(STORAGE_KEY, all);
}

module.exports = { STORAGE_KEY, getNextTarget, saveNextTarget };
