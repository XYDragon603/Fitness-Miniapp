const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { buildOverview } = require('../pages/today/today-model');
const root = path.resolve(__dirname, '..');
const app = require('../app.json');
const config = require('../project.config.json');
let custom;
vm.runInNewContext(fs.readFileSync(path.join(root, 'custom-tab-bar/index.js'), 'utf8'), { Component(value) { custom = value; } });
assert.deepStrictEqual(app.tabBar.list.map(item => item.text), ['今天', '动作库', '计划', '饮食', '我的']);
assert.strictEqual(app.pages[0], 'pages/today/today');
assert(!app.tabBar.list.some(item => item.pagePath === 'pages/record/record'));
app.tabBar.list.forEach((item, index) => {
  assert(app.pages.includes(item.pagePath));
  assert.strictEqual(custom.data.list[index].pagePath, '/' + item.pagePath);
  assert.strictEqual(custom.data.list[index].text, item.text);
  ['iconPath', 'selectedIconPath'].forEach(field => {
    const image = fs.readFileSync(path.join(root, item[field]));
    assert.strictEqual(image.readUInt32BE(16), 81);
    assert.strictEqual(image.readUInt32BE(20), 81);
    assert.strictEqual(custom.data.list[index][field], '/' + item[field]);
  });
});
const routes = app.pages.concat(app.subpackages.flatMap(pack => pack.pages.map(page => pack.root + '/' + page)));
routes.forEach(route => {
  ['js', 'json', 'wxml', 'wxss'].forEach(ext => assert(fs.existsSync(path.join(root, route + '.' + ext)), route + ' missing ' + ext));
  const wxml = fs.readFileSync(path.join(root, route + '.wxml'), 'utf8');
  const stack = [];
  for (const match of wxml.matchAll(/<(\/?)([\w-]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    if (match[1]) assert.strictEqual(stack.pop(), match[2], route + ': unbalanced tag ' + match[2]);
    else if (!match[3].trim().endsWith('/')) stack.push(match[2]);
  }
  assert.strictEqual(stack.length, 0, route + ': unclosed tags ' + stack.join(','));
  const js = fs.readFileSync(path.join(root, route + '.js'), 'utf8');
  for (const match of wxml.matchAll(/(?:bind|catch)(?::)?(?:tap|input|change|confirm|longpress|longtap)="([a-zA-Z]\w*)"/g)) {
    assert(new RegExp('\\b' + match[1] + '\\s*\\(').test(js), route + ': missing event handler ' + match[1]);
  }
});
for (const route of app.pages) {
  assert(!/require\s*\([^)]*packageExercise/.test(fs.readFileSync(path.join(root, route + '.js'), 'utf8')), 'main package must not require subpackage');
}
const plan = { id: 'plan', days: [{ id: 'push' }, { id: 'pull' }, { id: 'rest', type: 'rest' }] };
let overview = buildOverview(plan, [], '2026-10-16');
assert.strictEqual(overview.selected.id, 'push');
assert.strictEqual(overview.week[0].date, '2026-10-12');
assert.strictEqual(overview.week[6].date, '2026-10-18');
assert.strictEqual(overview.week.find(day => day.isToday).label, '五');
overview = buildOverview(plan, [{ date: '2026-10-15', planId: 'plan', dayId: 'pull', completionRate: 100 }], '2026-10-16');
assert.strictEqual(overview.selected.id, 'rest');
assert.strictEqual(overview.weekTrainingCount, 1);
assert.strictEqual(buildOverview(plan, [{ date: '2026-10-15', dayId: 'rest', type: 'rest' }], '2026-10-16').selected.id, 'push');
assert.strictEqual(buildOverview(plan, [{ date: '2026-10-16', dayId: 'pull' }], '2026-10-16').selected.id, 'pull');
assert.strictEqual(buildOverview(plan, [{ date: '2026-10-15', planId: 'other', dayId: 'pull' }], '2026-10-16').selected.id, 'push');
assert.strictEqual(buildOverview(null, [], '2026-10-16').selected, null);
assert.strictEqual(buildOverview(plan, [], '2026-10-16', 'rest').selected.id, 'rest');

// Exercise the two entry pages without loading any subpackage data into the main package.
const globalState = {};
let destination;
let page;
let tabData;
let savedToday = null;
const todayPath = path.join(root, 'pages/today/today.js');
vm.runInNewContext(fs.readFileSync(todayPath, 'utf8'), {
  Page(value) { page = value; },
  getApp() { return { globalData: globalState, refreshTrainingPlanState: () => ({ activePlan: { id: 'test', title: '计划', days: [{ id: 'first', name: '胸部', exercises: [] }, { id: 'second', name: '背部', exercises: [] }] } }) }; },
  require(file) { return file.endsWith('util.js') ? { getToday: () => '2026-10-16', formatDateCN: () => '10月16日', getTrainingDates: () => savedToday ? [savedToday.date] : [], getTrainingRecord: () => savedToday } : createRequire(todayPath)(file); },
  wx: { navigateTo(options) { assert.strictEqual(globalState.selectedDayId, 'first'); destination = options.url; } }
});
page.data = JSON.parse(JSON.stringify(page.data));
page.setData = update => Object.assign(page.data, update);
page.getTabBar = () => ({ setData(update) { tabData = update; } });
page.onShow();
page.startTraining();
assert.strictEqual(tabData.selected, 0);
assert.strictEqual(destination, '/pages/record/record');
savedToday = { date: '2026-10-16', planId: 'test', dayId: 'second', completionRate: 100 };
page.onShow();
assert.strictEqual(page.data.day.id, 'second', 'return after saving another day refreshes the overview');
assert.strictEqual(page.data.hasTodayRecord, true);
page.selectDay({ currentTarget: { dataset: { id: 'first' } } });
assert.strictEqual(page.data.day.id, 'first', 'explicit manual selection remains available');
const libraryPath = path.join(root, 'pages/library/library.js');
vm.runInNewContext(fs.readFileSync(libraryPath, 'utf8'), { Page(value) { page = value; }, wx: { navigateTo(options) { destination = options.url; } } });
page.openLibrary({ bodyPart: 'upper arms', keyword: '哑铃 弯举' });
assert(destination.includes('bodyPart=upper%20arms'));
assert(destination.includes('keyword=' + encodeURIComponent('哑铃 弯举')));

const ignored = config.packOptions.ignore.filter(item => item.type === 'folder').map(item => item.value);
['tools', 'tests', 'docs', 'tmp-downloads', 'tmp-skill-build'].forEach(folder => assert(ignored.includes(folder)));
assert(config.packOptions.include.some(item => item.value === 'packageExercise/data/LICENSE.txt'));
let mainBytes = 0;
let subBytes = 0;
function measure(directory, prefix = '') {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.name === '.git' || ignored.includes(relative) || relative === 'cloudfunctions') continue;
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) measure(absolute, relative + '/');
    else if (relative.startsWith('packageExercise/')) subBytes += fs.statSync(absolute).size;
    else mainBytes += fs.statSync(absolute).size;
  }
}
measure(root);
assert(mainBytes < 2 * 1024 * 1024, 'main package source exceeds 2MB');
assert(subBytes < 2 * 1024 * 1024, 'subpackage source exceeds 2MB');
console.log(`UI navigation, WXML, and source package budget verified: main ${(mainBytes / 1024).toFixed(1)} KB; exercise ${(subBytes / 1024).toFixed(1)} KB.`);
