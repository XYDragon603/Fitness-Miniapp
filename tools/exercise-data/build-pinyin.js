// 生成 packageExercise/data/exercise-pinyin.js：动作 id -> "全拼 首字母"，供动作库拼音搜索。
// 依赖 pinyin-pro（只在构建时用，不进小程序包）：
//   npm i pinyin-pro@3.26.0 --no-save   然后   node tools/exercise-data/build-pinyin.js
// 动作中文名有变化（重新跑 build.js）后需要重新生成。
const fs = require('fs');
const path = require('path');

let pinyin;
try {
  ({ pinyin } = require('pinyin-pro'));
} catch (error) {
  console.error('缺少 pinyin-pro：先运行 npm i pinyin-pro@3.26.0 --no-save（或用 NODE_PATH 指向已安装的目录）');
  process.exit(1);
}

const root = path.resolve(__dirname, '..', '..');
const index = require(path.join(root, 'packageExercise', 'data', 'exercise-index.js'));
const idField = index.fields.indexOf('id');
const nameField = index.fields.indexOf('name');

const map = {};
index.rows.forEach(row => {
  const name = String(row[nameField] || '');
  const han = name.replace(/[^一-鿿]/g, '');
  if (!han) return;
  const full = pinyin(han, { toneType: 'none', type: 'array' }).join('');
  const initials = pinyin(han, { pattern: 'first', toneType: 'none', type: 'array' }).join('');
  map[row[idField]] = `${full} ${initials}`.toLowerCase();
});

const output = path.join(root, 'packageExercise', 'data', 'exercise-pinyin.js');
fs.writeFileSync(output, `// 由 tools/exercise-data/build-pinyin.js 生成，请勿手改\nmodule.exports = ${JSON.stringify(map)};\n`);
console.log(`${Object.keys(map).length} 条拼音 -> ${path.relative(root, output)} (${(fs.statSync(output).size / 1024).toFixed(1)} KB)`);
