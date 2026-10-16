const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const source = require(path.join(root, 'names-input.json'));
const raw = fs.readFileSync(path.join(root, 'names.zh.json'), 'utf8');
const names = JSON.parse(raw);
assert.strictEqual(source.length, 1324);
assert.strictEqual(Object.keys(names).length, 1324);
assert.deepStrictEqual(Object.keys(names).sort(), source.map(x => x.id).sort());
for (const x of source) {
  assert(names[x.id].trim());
  assert(/[\u3400-\u9fff]/u.test(names[x.id]));
  assert(!/[a-z]{3}/i.test(names[x.id]), `${x.id} contains untranslated English`);
  if (x.name.includes('(male)')) assert(names[x.id].includes('男'), x.id);
  if (x.name.includes('(female)')) assert(names[x.id].includes('女'), x.id);
  const version = x.name.match(/(?:v\.\s*|version\s*)(\d+)/);
  if (version) assert(names[x.id].includes(`版本${version[1]}`), `${x.id} version lost`);
}
const ids = [...raw.matchAll(/^  "(\d+)":/gm)].map(x => x[1]);
assert.deepStrictEqual(ids, [...ids].sort());
let conflicts = 0;
let sourceDuplicates = 0;
const seen = new Map();
for (const x of source) {
  const other = seen.get(names[x.id]);
  if (other) {
    if (other.name !== x.name) conflicts += 1;
    else sourceDuplicates += 1;
  }
  seen.set(names[x.id], x);
}
assert.strictEqual(conflicts, 0);
console.log(JSON.stringify({ count: source.length, missing: 0, extra: 0, untranslated: 0,
  distinctEnglishConflicts: conflicts, sourceDuplicatePairs: sourceDuplicates,
  utf8Bytes: Buffer.byteLength(raw) }, null, 2));
