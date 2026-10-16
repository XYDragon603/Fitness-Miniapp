// Uses the locally installed developer tools, without installing application dependencies.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const compilerDir = process.env.WECHAT_COMPILER_DIR || 'D:/微信web开发者工具/code/package.nw/node_modules/wcc-exec';
const files = [];
function walk(directory) {
  fs.readdirSync(path.join(root, directory), { withFileTypes: true }).forEach(item => {
    const relative = directory + '/' + item.name;
    if (item.isDirectory()) walk(relative);
    else if (/\.(?:wxml|wxss)$/.test(item.name)) files.push(relative);
  });
}
['pages', 'packageExercise/pages', 'custom-tab-bar', 'components'].forEach(walk);
files.push('app.wxss');
let failed = false;
for (const [name, extension] of [['wcc', '.wxml'], ['wcsc', '.wxss']]) {
  const executable = path.join(compilerDir, name + '.exe');
  if (!fs.existsSync(executable)) throw new Error('找不到微信编译器，请设置 WECHAT_COMPILER_DIR：' + executable);
  const inputs = files.filter(file => file.endsWith(extension));
  const args = name === 'wcsc' ? ['-pc', String(inputs.length), ...inputs] : inputs;
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(name + ' failed:', result.error || result.stderr || result.stdout);
  } else console.log(name + ': compiled ' + inputs.length + ' files (' + Buffer.byteLength(result.stdout) + ' output bytes)');
  if (result.stderr) console.log(result.stderr.trim());
}
process.exitCode = failed ? 1 : 0;
