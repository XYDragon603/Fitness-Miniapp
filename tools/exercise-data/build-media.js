// 生成 utils/exercise-media.js：动作 id -> 数据集媒体 id（图片 / GIF 文件名的一部分）。
// 用法：node tools/exercise-data/build-media.js [--source tmp-downloads/exercises-dataset/exercises.json]
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const sourceIndex = process.argv.indexOf('--source');
const source = path.resolve(root, sourceIndex > 0 ? process.argv[sourceIndex + 1] : 'tmp-downloads/exercises-dataset/exercises.json');

if (!fs.existsSync(source)) {
  console.error(`找不到数据集：${source}`);
  console.error('先下载：curl -L https://raw.githubusercontent.com/XYDragon603/exercises-dataset/main/data/exercises.json -o tmp-downloads/exercises-dataset/exercises.json');
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(source, 'utf8'));
const media = {};
list.forEach(item => {
  const expected = `images/${item.id}-${item.media_id}.jpg`;
  if (!/^\d{4}$/.test(item.id) || !/^[A-Za-z0-9]+$/.test(item.media_id || '') || item.image !== expected) {
    throw new Error(`媒体路径不符合预期：${item.id} ${item.image}`);
  }
  media[item.id] = item.media_id;
});

const output = path.join(root, 'utils', 'exercise-media.js');
fs.writeFileSync(output, `// 由 tools/exercise-data/build-media.js 生成，请勿手改\nmodule.exports = ${JSON.stringify(media)};\n`);
console.log(`${Object.keys(media).length} 条媒体映射 -> ${path.relative(root, output)} (${(fs.statSync(output).size / 1024).toFixed(1)} KB)`);
