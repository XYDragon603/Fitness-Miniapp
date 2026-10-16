// The reviewed translation batches use explicit source IDs to avoid row shifts.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const input = JSON.parse(fs.readFileSync(path.join(root, 'names-input.json'), 'utf8'));
const translations = new Map();
for (let batch = 1; batch <= 6; batch += 1) {
  const lines = fs.readFileSync(path.join(__dirname, `names-${batch}.txt`), 'utf8').trim().split(/\r?\n/);
  for (const line of lines) {
    const split = line.indexOf('|');
    const id = line.slice(0, split);
    const name = line.slice(split + 1);
    if (translations.has(id)) throw new Error(`Repeated source ID: ${id}`);
    if (!/[\u3400-\u9fff]/u.test(name)) throw new Error(`Missing Chinese name: ${id}`);
    translations.set(id, name);
  }
}
const sourceIds = new Set(input.map(exercise => exercise.id));
const missing = input.filter(exercise => !translations.has(exercise.id));
const extra = [...translations.keys()].filter(id => !sourceIds.has(id));
if (missing.length || extra.length || translations.size !== 1324) {
  throw new Error(JSON.stringify({ count: translations.size, missing, extra }));
}
// JSON.stringify(object) reorders numeric-looking IDs; write sorted entries explicitly.
const entries = [...translations.entries()].sort(([a], [b]) => a.localeCompare(b));
const json = '{\n' + entries.map(([id, name]) => `  ${JSON.stringify(id)}: ${JSON.stringify(name)}`).join(',\n') + '\n}\n';
fs.writeFileSync(path.join(root, 'names.zh.json'), json, 'utf8');
const duplicateNames = new Map();
for (const exercise of input) {
  const name = translations.get(exercise.id);
  if (!duplicateNames.has(name)) duplicateNames.set(name, []);
  duplicateNames.get(name).push({ id: exercise.id, en: exercise.name });
}
console.log(JSON.stringify({ count: translations.size, duplicates: [...duplicateNames.entries()].filter(([, rows]) => rows.length > 1) }, null, 2));
