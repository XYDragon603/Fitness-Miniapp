const fs = require('fs');
const path = require('path');

const FIELDS = ['id', 'name', 'nameEn', 'bodyPart', 'equipment', 'equipmentGroup', 'target'];
const MAX_BYTES = 1.2 * 1024 * 1024;

function cleanStep(step) {
  return String(step || '').trim().replace(/^(?:(?:步骤|第)\s*\d+\s*(?:步)?\s*[:：.、)）-]?|\d+\s*[.、:：)）])\s*/, '').trim();
}

function buildExerciseData(rawList, terms, namesZh = {}) {
  if (!Array.isArray(rawList)) throw new Error('数据源必须是动作数组');
  const unknown = new Set();
  const ids = new Set();
  const equipmentGroup = {};
  terms.EQUIPMENT_GROUPS.forEach(group => group.items.forEach(item => { equipmentGroup[item] = group.key; }));
  rawList.forEach(item => {
    if (!item || typeof item.id !== 'string' || !/^\d{4}$/.test(item.id) || ids.has(item.id)) {
      throw new Error('动作 id 无效或重复：' + (item && item.id));
    }
    ids.add(item.id);
    [['部位', item.body_part, terms.BODY_PARTS], ['器械', item.equipment, terms.EQUIPMENT],
      ['目标肌', item.target, terms.MUSCLES], ['肌群', item.muscle_group, terms.MUSCLES]]
      .forEach(([field, key, labels]) => { if (!Object.prototype.hasOwnProperty.call(labels, key)) unknown.add(field + ': ' + key); });
    (item.secondary_muscles || []).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(terms.MUSCLES, key)) unknown.add('次要肌: ' + key);
    });
    if (!equipmentGroup[item.equipment]) unknown.add('器械分组: ' + item.equipment);
  });
  if (unknown.size) throw new Error('未知术语：\n' + Array.from(unknown).sort().join('\n'));

  const warnings = [];
  const detail = {};
  const rows = rawList.map(item => {
    const translated = typeof namesZh[item.id] === 'string' ? namesZh[item.id].trim() : '';
    if (!translated) warnings.push(item.id);
    const targetLabel = terms.MUSCLES[item.target];
    const seenLabels = new Set([targetLabel]);
    const secondary = (item.secondary_muscles || []).filter(key => {
      const label = terms.MUSCLES[key];
      if (seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    });
    const steps = item.instruction_steps && item.instruction_steps.zh;
    detail[item.id] = {
      steps: (Array.isArray(steps) ? steps : []).map(cleanStep).filter(Boolean),
      muscleGroup: item.muscle_group,
      secondary
    };
    return [item.id, translated || item.name, item.name, item.body_part, item.equipment, equipmentGroup[item.equipment], item.target];
  });
  rows.sort((a, b) => terms.BODY_PART_ORDER.indexOf(a[3]) - terms.BODY_PART_ORDER.indexOf(b[3]) || a[1].localeCompare(b[1], 'zh-Hans-CN') || a[0].localeCompare(b[0]));
  const index = {
    version: 1,
    source: 'XYDragon603/exercises-dataset@2026-10-16',
    attribution: '动作数据来自 exercises-dataset（MIT）',
    bodyParts: terms.BODY_PART_ORDER.map(key => ({ key, label: terms.BODY_PARTS[key], count: rows.filter(row => row[3] === key).length })),
    equipmentGroups: terms.EQUIPMENT_GROUPS.map(group => ({ key: group.key, label: group.label, count: rows.filter(row => row[5] === group.key).length })),
    equipmentLabels: { ...terms.EQUIPMENT },
    muscleLabels: { ...terms.MUSCLES },
    fields: FIELDS.slice(),
    rows
  };
  return { index, detail, warnings };
}

function serialize(data) {
  return '// 由 tools/exercise-data/build.js 生成，请勿手改\nmodule.exports = ' + JSON.stringify(data) + ';\n';
}

function main(args) {
  const root = path.resolve(__dirname, '../..');
  const sourceIndex = args.indexOf('--source');
  if (sourceIndex >= 0 && !args[sourceIndex + 1]) throw new Error('--source 需要文件路径');
  const source = path.resolve(root, sourceIndex >= 0 ? args[sourceIndex + 1] : 'tmp-downloads/exercises-dataset/exercises.json');
  if (!fs.existsSync(source)) throw new Error('找不到数据源。请先运行：\ncurl -L https://raw.githubusercontent.com/XYDragon603/exercises-dataset/main/data/exercises.json -o tmp-downloads/exercises-dataset/exercises.json');
  const namesPath = path.join(__dirname, 'names.zh.json');
  const names = fs.existsSync(namesPath) ? JSON.parse(fs.readFileSync(namesPath, 'utf8')) : {};
  const result = buildExerciseData(JSON.parse(fs.readFileSync(source, 'utf8')), require('./terms.js'), names);
  const versionIndex = args.indexOf('--version');
  if (versionIndex >= 0) {
    if (!args[versionIndex + 1] || args[versionIndex + 1].startsWith('--')) throw new Error('--version 需要快照 SHA 或日期');
    result.index.source = 'XYDragon603/exercises-dataset@' + args[versionIndex + 1];
  }
  const files = { 'exercise-index.js': serialize(result.index), 'exercise-detail.js': serialize(result.detail) };
  const bytes = Object.values(files).reduce((sum, file) => sum + Buffer.byteLength(file), 0);
  if (bytes >= MAX_BYTES) throw new Error('动作数据超过 1.2MB：' + bytes + ' bytes');
  const output = path.join(root, 'packageExercise/data');
  fs.mkdirSync(output, { recursive: true });
  Object.entries(files).forEach(([name, content]) => {
    fs.writeFileSync(path.join(output, name), content, 'utf8');
    console.log(name + ': ' + (Buffer.byteLength(content) / 1024).toFixed(1) + ' KB');
  });
  console.log('总数：' + result.index.rows.length);
  result.index.bodyParts.forEach(part => console.log(part.label + '：' + part.count));
  console.log(result.warnings.length + ' 个动作没有中文名');
}

module.exports = { buildExerciseData };
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
