// Only licensed, separately hosted media may be configured here.
const mediaBaseUrl = '';

// pinyinMap（可选）：id -> "全拼 首字母"，让“wotui”“wt”也能搜到“卧推”
function expandIndex(index, pinyinMap) {
  const fields = index.fields || [];
  const bodyLabels = {};
  (index.bodyParts || []).forEach(part => { bodyLabels[part.key] = part.label; });
  return (index.rows || []).map(row => {
    const raw = {};
    fields.forEach((field, position) => { raw[field] = row[position]; });
    const item = {
      id: String(raw.id), name: raw.name || raw.nameEn || '', nameEn: raw.nameEn || '',
      bodyPart: raw.bodyPart, bodyPartLabel: bodyLabels[raw.bodyPart] || raw.bodyPart || '',
      equipment: raw.equipment, equipmentLabel: (index.equipmentLabels || {})[raw.equipment] || raw.equipment || '',
      equipmentGroup: raw.equipmentGroup, target: raw.target,
      targetLabel: (index.muscleLabels || {})[raw.target] || raw.target || ''
    };
    item.searchText = [item.name, item.nameEn, item.targetLabel, item.equipmentLabel, (pinyinMap && pinyinMap[item.id]) || ''].filter(Boolean).join(' ').toLowerCase();
    return item;
  });
}

// 界面上的“腿部”合并大腿/臀与小腿
const BODY_PART_ALIASES = { legs: ['upper legs', 'lower legs'] };

function matchesBodyPart(item, bodyPart) {
  if (!bodyPart || bodyPart === 'all') return true;
  return (BODY_PART_ALIASES[bodyPart] || [bodyPart]).includes(item.bodyPart);
}

function filterExercises(list, filters = {}) {
  const words = String(filters.keyword || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(item =>
    matchesBodyPart(item, filters.bodyPart) &&
    (!filters.equipmentGroup || filters.equipmentGroup === 'all' || item.equipmentGroup === filters.equipmentGroup) &&
    words.every(word => item.searchText.includes(word))
  );
}

function getDetail(index, detailMap, id) {
  const position = (index.fields || []).indexOf('id');
  const row = (index.rows || []).find(value => String(value[position]) === String(id));
  if (!row) return null;
  const item = expandIndex({ ...index, rows: [row] })[0];
  const detail = detailMap[String(id)] || {};
  const labels = index.muscleLabels || {};
  return {
    ...item, steps: Array.isArray(detail.steps) ? detail.steps.slice() : [],
    muscleGroupLabel: labels[detail.muscleGroup] || detail.muscleGroup || '',
    secondaryLabels: (detail.secondary || []).map(key => labels[key] || key)
  };
}

function toPlanExercise(item, detail, now = Date.now()) {
  const source = detail || item;
  const steps = source.steps || [];
  const targetMuscles = [item.targetLabel, ...(source.secondaryLabels || [])]
    .filter((value, index, all) => value && all.indexOf(value) === index);
  return {
    id: `lib_${item.id}_${Number(now).toString(36)}`, libraryId: item.id,
    name: item.name, targetPart: item.bodyPartLabel,
    weeks: { 1: { sets: 3, reps: '10-12', note: '' } },
    guide: {
      summary: steps[0] || '', targetMuscles, commonMistakes: [], tips: steps.slice(1),
      videoTitle: '', videoUrl: ''
    }
  };
}

module.exports = { mediaBaseUrl, BODY_PART_ALIASES, expandIndex, filterExercises, getDetail, toPlanExercise };
