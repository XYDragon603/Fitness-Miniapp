const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

function withMockWx(storage, callback) {
  const previousWx = global.wx;
  const state = { ...storage };

  global.wx = {
    getStorageSync(key) {
      return state[key];
    },
    setStorageSync(key, value) {
      state[key] = value;
    },
    removeStorageSync(key) {
      delete state[key];
    }
  };

  try {
    callback();
  } finally {
    global.wx = previousWx;
  }
}

function loadUtilFresh() {
  const utilPath = path.join(projectRoot, 'utils', 'util.js');
  delete require.cache[require.resolve(utilPath)];
  return require(utilPath);
}

function testAppThemeIsAirHealth() {
  const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));

  assert.strictEqual(appJson.window.navigationStyle, 'custom');
  assert.strictEqual(appJson.window.navigationBarTextStyle, 'black');
  assert.strictEqual(appJson.window.backgroundColor, '#F6F4EE');
  assert.strictEqual(appJson.usingComponents['nav-bar'], '/components/nav-bar/nav-bar');
  assert.strictEqual(appJson.tabBar.color, '#5D6366');
  assert.strictEqual(appJson.tabBar.selectedColor, '#111517');
  let customTabBar;
  vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'custom-tab-bar', 'index.js'), 'utf8'), {
    Component(definition) { customTabBar = definition; }
  });
  assert.strictEqual(customTabBar.data.color, appJson.tabBar.color);
  assert.strictEqual(customTabBar.data.selectedColor, appJson.tabBar.selectedColor);
}

function testStartTrainingSetsSelectionBeforeNavigation() {
  const indexSource = fs.readFileSync(path.join(projectRoot, 'pages', 'index', 'index.js'), 'utf8');
  const navigationIndex = indexSource.indexOf('wx.navigateTo', indexSource.indexOf('startTraining(e)'));
  const selectedDayIndexAssignment = indexSource.indexOf('app.globalData.selectedDayIndex = dayIndex');
  const selectedDayIdAssignment = indexSource.indexOf("app.globalData.selectedDayId = day ? day.id : ''");

  assert(selectedDayIndexAssignment >= 0, 'selectedDayIndex assignment missing');
  assert(selectedDayIdAssignment >= 0, 'selectedDayId assignment missing');
  assert(navigationIndex >= 0, 'training navigation missing');
  assert(selectedDayIndexAssignment < navigationIndex, 'selectedDayIndex should be set before navigation');
  assert(selectedDayIdAssignment < navigationIndex, 'selectedDayId should be set before navigation');
}

function testTrainingStatsSupportsDynamicDistribution() {
  withMockWx({
    training_dates: ['2026-05-15', '2026-05-14', '2026-05-13'],
    'training_2026-05-15': {
      date: '2026-05-15',
      dayId: 'push',
      dayName: '推类训练',
      dayColor: '#D97878',
      exercises: [{ completed: true }, { completed: false }]
    },
    'training_2026-05-14': {
      date: '2026-05-14',
      dayId: 'legs',
      dayName: '腿臀训练',
      dayColor: '#6FBF97',
      exercises: [{ completed: true }]
    },
    'training_2026-05-13': {
      date: '2026-05-13',
      dayId: 'push',
      dayName: '推类训练',
      dayColor: '#D97878',
      exercises: [{ completed: true }]
    }
  }, () => {
    const util = loadUtilFresh();
    const stats = util.getTrainingStats();

    assert(Array.isArray(stats.distributionGroups), 'distributionGroups should exist');
    assert.deepStrictEqual(stats.distributionGroups.map(item => item.name), ['推类训练', '腿臀训练']);
    assert.deepStrictEqual(stats.distributionGroups.map(item => item.count), [2, 1]);
  });
}

function testWeekLabelsAndHardcodedSplitNamesAreHidden() {
  const historyWxml = fs.readFileSync(path.join(projectRoot, 'pages', 'history', 'history.wxml'), 'utf8');
  const statsWxml = fs.readFileSync(path.join(projectRoot, 'pages', 'stats', 'stats.wxml'), 'utf8');

  assert(!historyWxml.includes('第{{item.week}}周'));
  assert(!historyWxml.includes('第{{detailRecord.week}}周'));
  assert(!statsWxml.includes('胸三角肌中束 · 三头'));
  assert(!statsWxml.includes('背 · 三角肌后束 · 二头'));
  assert(!statsWxml.includes('腿 · 臀 · 股四头肌'));
}

function testFoodRecognizeUsesEnvModelAndDoesNotShipProdMockAsSuccess() {
  const source = fs.readFileSync(path.join(projectRoot, 'cloudfunctions', 'foodRecognize', 'index.js'), 'utf8');

  assert(source.includes('process.env.SILICONFLOW_MODEL'));
  assert(!source.includes("success: true,\n      source: 'fallback'"));
}

function run() {
  testAppThemeIsAirHealth();
  testStartTrainingSetsSelectionBeforeNavigation();
  testTrainingStatsSupportsDynamicDistribution();
  testWeekLabelsAndHardcodedSplitNamesAreHidden();
  testFoodRecognizeUsesEnvModelAndDoesNotShipProdMockAsSuccess();
  console.log('stability regression tests passed');
}

run();
