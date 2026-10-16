const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const sharing = require('../utils/app-sharing');
let guide, menu;
sharing.favoriteGuide({ showModal: options => { guide = options; } });
assert(guide.content.includes('右上角') && guide.showCancel === false);
sharing.menu({ showShareMenu: options => { menu = options; } });
assert.deepStrictEqual(menu.menus, ['shareAppMessage', 'shareTimeline']);
for (const name of ['today/today', 'library/library', 'index/index', 'nutrition/nutrition', 'me/me']) {
  const filename = path.resolve(__dirname, '../pages/' + name + '.js');
  let page;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { Page: value => { page = value; }, getApp: () => ({}), require: createRequire(filename) });
  const shared = page.onShareAppMessage();
  assert.strictEqual(shared.path, '/pages/today/today');
  assert(!JSON.stringify(shared).includes('training_'), 'generic tab sharing never leaks local records');
  assert.strictEqual(page.onAddToFavorites().query, '');
  const json = JSON.parse(fs.readFileSync(filename.replace(/\.js$/, '.json'), 'utf8'));
  assert(json.enableShareAppMessage && json.enableShareTimeline);
}
console.log('app sharing menus, safe landing paths, and native favorite guide verified');
