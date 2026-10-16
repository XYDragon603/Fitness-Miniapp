const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.js')).sort();
let failed = 0;
files.forEach(file => {
  const result = spawnSync(process.execPath, [path.join(root, 'tests', file)], { cwd: root, encoding: 'utf8', windowsHide: true });
  console.log(file + ': ' + (result.status === 0 ? 'PASS' : 'FAIL'));
  if (result.status !== 0) { failed += 1; console.error(result.error || result.stderr || result.stdout); }
});
console.log(files.length + ' test scripts; ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
