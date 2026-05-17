const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

  assert.strictEqual(appJson.window.navigationBarBackgroundColor, '#F4F8F7');
  assert.strictEqual(appJson.window.navigationBarTextStyle, 'black');
  assert.strictEqual(appJson.window.backgroundColor, '#F4F8F7');
  assert.strictEqual(appJson.tabBar.color, '#8C98A4');
  assert.strictEqual(appJson.tabBar.selectedColor, '#D97878');
  assert.strictEqual(appJson.tabBar.borderStyle, 'white');
}

function testStartTrainingSetsSelectionBeforeSwitchTab() {
  const indexSource = fs.readFileSync(path.join(projectRoot, 'pages', 'index', 'index.js'), 'utf8');
  const switchTabIndex = indexSource.indexOf('wx.switchTab');
  const selectedDayIndexAssignment = indexSource.indexOf('app.globalData.selectedDayIndex = dayIndex');
  const selectedDayIdAssignment = indexSource.indexOf("app.globalData.selectedDayId = day ? day.id : ''");

  assert(selectedDayIndexAssignment >= 0, 'selectedDayIndex assignment missing');
  assert(selectedDayIdAssignment >= 0, 'selectedDayId assignment missing');
  assert(switchTabIndex >= 0, 'wx.switchTab call missing');
  assert(selectedDayIndexAssignment < switchTabIndex, 'selectedDayIndex should be set before switchTab');
  assert(selectedDayIdAssignment < switchTabIndex, 'selectedDayId should be set before switchTab');
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
  testStartTrainingSetsSelectionBeforeSwitchTab();
  testTrainingStatsSupportsDynamicDistribution();
  testWeekLabelsAndHardcodedSplitNamesAreHidden();
  testFoodRecognizeUsesEnvModelAndDoesNotShipProdMockAsSuccess();
  console.log('stability regression tests passed');
}

run();
