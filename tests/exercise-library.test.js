const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const index = require('./fixtures/exercise-index.sample.js');
const detailMap = require('./fixtures/exercise-detail.sample.js');
const library = require('../packageExercise/lib/exercise-library.js');

const list = library.expandIndex(index);
assert.strictEqual(list.length, 10);
assert.strictEqual(list[0].id, '0025');
assert.strictEqual(list[0].equipmentLabel, '杠铃');
assert.strictEqual(list[0].bodyPartLabel, '胸部');
assert.strictEqual(list[0].searchText, '杠铃平板卧推 barbell bench press 胸肌 杠铃');
assert.deepStrictEqual(library.filterExercises(list, { keyword: ' BENCH   胸肌 ', bodyPart: 'chest', equipmentGroup: 'dumbbell' }).map(item => item.id), ['0026']);
assert.deepStrictEqual(library.filterExercises(list, { keyword: '哑铃 bench' }).map(item => item.id), ['0026']);
assert.deepStrictEqual(library.filterExercises(list, { keyword: 'bench squat' }), []);
assert.strictEqual(library.filterExercises(list, { keyword: '   ', bodyPart: 'all', equipmentGroup: 'all' }).length, 10);
assert.strictEqual(library.filterExercises(list).length, 10);
assert.strictEqual(library.filterExercises(list, { bodyPart: 'back', equipmentGroup: 'cable' })[0].id, '0031');
assert.strictEqual(library.getDetail(index, detailMap, 'missing'), null);
const detail = library.getDetail(index, detailMap, '0025');
assert.strictEqual(detail.muscleGroupLabel, '胸肌');
assert.deepStrictEqual(detail.secondaryLabels, ['肱三头肌', '肩部', '胸肌']);
assert.deepStrictEqual(library.getDetail(index, {}, '0025').steps, []);
const planExercise = library.toPlanExercise(list[0], detail, 12345);
assert.strictEqual(planExercise.id, 'lib_0025_9ix');
assert.strictEqual(planExercise.libraryId, '0025');
assert.strictEqual(planExercise.name, '杠铃平板卧推');
assert.strictEqual(planExercise.targetPart, '胸部');
assert.deepStrictEqual(planExercise.weeks, { 1: { sets: 3, reps: '10-12', note: '' } });
assert.strictEqual(planExercise.guide.summary, detail.steps[0]);
assert.deepStrictEqual(planExercise.guide.tips, detail.steps.slice(1));
assert.deepStrictEqual(planExercise.guide.targetMuscles, ['胸肌', '肱三头肌', '肩部']);
assert.deepStrictEqual(planExercise.guide.commonMistakes, []);
assert.strictEqual(planExercise.guide.videoUrl, '');
assert.strictEqual(planExercise.guide.videoTitle, '');
const workout = require('../utils/workout-plan.js');
if (workout.normalizeExercise) {
  const normalized = workout.normalizeExercise(planExercise, 0);
  assert.strictEqual(normalized.name, planExercise.name);
  assert.strictEqual(normalized.libraryId, '0025');
  assert.deepStrictEqual(normalized.weeks, planExercise.weeks);
}
assert.strictEqual(library.mediaBaseUrl, '');

function createPage(relativePath, fixtureIndex, wxOverrides = {}) {
  let definition;
  let nextTimer = 1;
  const timers = new Map();
  const updates = [];
  const emissions = [];
  const calls = { navigations: [], toasts: [], back: [] };
  const context = {
    require(request) {
      if (request.endsWith('/exercise-index.js')) return fixtureIndex;
      if (request.endsWith('/exercise-detail.js')) return detailMap;
      if (request.endsWith('/exercise-library.js')) return library;
      if (request.endsWith('/utils/ui-helpers.js')) return require('../utils/ui-helpers.js');
      if (request.endsWith('/utils/exercise-favorites.js')) return require('../utils/exercise-favorites.js');
      if (request.endsWith('/exercise-pinyin.js')) return require('../packageExercise/data/exercise-pinyin.js');
      throw new Error(`Unexpected dependency: ${request}`);
    },
    Page(value) { definition = value; },
    wx: {
      navigateTo(options) { calls.navigations.push(options); },
      navigateBack(options) { calls.back.push(options); },
      setNavigationBarTitle() {}, showToast(options) { calls.toasts.push(options); },
      ...wxOverrides
    },
    Date: { now: () => 1000 },
    setTimeout(callback, delay) { assert.strictEqual(delay, 200); const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), context);
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) };
  page.setData = function(update) {
    updates.push(update);
    Object.entries(update).forEach(([key, value]) => {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let cursor = this.data;
      parts.slice(0, -1).forEach(part => { cursor = cursor[part]; });
      cursor[parts[parts.length - 1]] = value;
    });
  };
  page.getOpenerEventChannel = () => ({ emit(name, value) { emissions.push({ name, value }); } });
  return {
    page, updates, emissions, calls, timers,
    flushTimers() { const pending = Array.from(timers.values()); timers.clear(); pending.forEach(callback => callback()); }
  };
}

// Simulate the full dataset size without loading real generated assets.
const bigIndex = {
  ...index,
  rows: Array.from({ length: 1324 }, (_, position) => {
    const row = index.rows[position % index.rows.length].slice();
    row[0] = position === 0 ? '0025' : `fixture_${position}`;
    return row;
  })
};
const screen = createPage('packageExercise/pages/library/library.js', bigIndex);
const deepLink = createPage('packageExercise/pages/library/library.js', index);
deepLink.page.onLoad({ keyword: 'bench', bodyPart: 'chest' });
assert.strictEqual(deepLink.page.data.keyword, 'bench');
assert.strictEqual(deepLink.page.data.bodyPart, 'chest');
assert(deepLink.page.data.items.some(item => item.id === '0025'), 'main package hub filters are applied on entry');
screen.page.onLoad({ mode: 'pick' });
assert.strictEqual(screen.page.data.items.length, 40);
assert.strictEqual(screen.page.data.total, 1324);
assert(!('searchText' in screen.page.data.items[0]), 'Search corpus stays outside page data');
screen.page.onReachBottom();
assert.strictEqual(screen.page.data.items.length, 80);
const append = screen.updates[screen.updates.length - 1];
assert(!append.items, 'Appending must send only the next batch, not the entire existing list');
assert.strictEqual(Object.keys(append).filter(key => key.startsWith('items[')).length, 40);
screen.page.onSearchInput({ detail: { value: 'bench' } });
screen.page.onSearchInput({ detail: { value: 'squat' } });
assert.strictEqual(screen.timers.size, 1);
assert.strictEqual(screen.page.data.total, 1324, 'Search is debounced');
screen.flushTimers();
assert(screen.page.data.items.every(item => item.nameEn.includes('squat')));
assert.strictEqual(screen.page.data.items.length, 40, 'Search resets pagination');
screen.page.onBodyPartTap({ currentTarget: { dataset: { key: 'chest' } } });
assert.strictEqual(screen.page.data.total, 0);
screen.page.clearFilters();
screen.page.onSearchInput({ detail: { value: 'row' } });
screen.page.onHide();
assert.strictEqual(screen.timers.size, 0);
screen.page.onShow();
assert(screen.page.data.items.every(item => item.nameEn.includes('row')), 'Interrupted search is applied on return');
screen.page.clearFilters();
screen.page.onAddTap({ currentTarget: { dataset: { id: '0025' } } });
screen.page.onAddTap({ currentTarget: { dataset: { id: '0025' } } });
assert.strictEqual(screen.emissions.length, 2);
assert.notStrictEqual(screen.emissions[0].value.id, screen.emissions[1].value.id);
assert.strictEqual(screen.page.data.selectedCount, 2);
assert.strictEqual(screen.page.data.items[0].added, true);
screen.page.onExerciseTap({ currentTarget: { dataset: { id: '0025' } } });
const navigation = screen.calls.navigations[0];
assert(navigation.url.endsWith('id=0025&mode=pick'));
const detailScreen = createPage('packageExercise/pages/detail/detail.js', index);
detailScreen.page.getOpenerEventChannel = () => ({ emit(name, value) { navigation.events[name](value); } });
detailScreen.page.onLoad({ id: '0025', mode: 'pick' });
assert.strictEqual(detailScreen.page.data.primaryLabels.length, 1, 'Target and muscle group are deduplicated');
assert.strictEqual(detailScreen.page.data.mediaUrl, '', 'Unlicensed dataset media is never loaded');
detailScreen.page.onAddTap();
detailScreen.page.onAddTap();
assert.strictEqual(screen.emissions.length, 4);
assert.strictEqual(new Set(screen.emissions.map(event => event.value.id)).size, 4);
assert.strictEqual(screen.page.data.selectedCount, 4);
assert(detailScreen.page.onShareAppMessage().path.endsWith('id=0025'));
assert(!detailScreen.page.onShareAppMessage().path.includes('mode=pick'), 'Shared detail always opens in browsing mode');
screen.page.finishPick();
assert.strictEqual(screen.calls.back.length, 1);
screen.page.onSearchInput({ detail: { value: 'pending' } });
screen.page.onUnload();
assert.strictEqual(screen.timers.size, 0);
navigation.events.exercisePicked(planExercise);
assert.strictEqual(screen.emissions.length, 4, 'Unloaded list does not forward stale events');

const browse = createPage('packageExercise/pages/detail/detail.js', index);
browse.page.onLoad({ id: '0025' });
browse.page.onAddTap();
assert.strictEqual(browse.emissions.length, 0);
assert.strictEqual(browse.calls.toasts[0].title, '请在计划编辑中添加');
browse.page.onLoad({ id: 'missing' });
assert.strictEqual(browse.page.data.item, null);
browse.page.onAddTap();
assert.strictEqual(browse.calls.toasts.length, 1);

// Favorites persist across detail/list pages and update when returning from a
// detail. Sharing and native favorites never carry the plan-picker context.
const favoriteStorage = {};
const storageApi = { getStorageSync: key => favoriteStorage[key], setStorageSync: (key, value) => { favoriteStorage[key] = value; } };
const favoriteDetail = createPage('packageExercise/pages/detail/detail.js', index, storageApi);
favoriteDetail.page.onLoad({ id: '0025', mode: 'pick' });
favoriteDetail.page.toggleFavorite();
assert.strictEqual(favoriteDetail.page.data.favorited, true);
assert.strictEqual(favoriteDetail.page.onAddToFavorites().query, 'id=0025');
assert.strictEqual(favoriteDetail.page.onShareTimeline().query, 'id=0025');
const favoriteList = createPage('packageExercise/pages/library/library.js', index, storageApi);
favoriteList.page.onLoad({ favorite: '1' });
assert.strictEqual(favoriteList.page.data.total, 1);
assert.strictEqual(favoriteList.page.data.items[0].id, '0025');
favoriteDetail.page.toggleFavorite(); favoriteList.page.onShow();
assert.strictEqual(favoriteList.page.data.total, 0);
favoriteList.page.clearFilters(); assert.strictEqual(favoriteList.page.data.total, 10);
favoriteList.page.toggleFavorite({ currentTarget: { dataset: { id: '0025' } } });
favoriteDetail.page.onShow(); assert.strictEqual(favoriteDetail.page.data.favorited, true);

const paginate = createPage('packageExercise/pages/library/library.js', bigIndex);
paginate.page.onLoad();
while (paginate.page.data.hasMore) paginate.page.onReachBottom();
assert.strictEqual(paginate.page.data.items.length, 1324);
assert.strictEqual(new Set(paginate.page.data.items.map(item => item.id)).size, 1324);
const updateCount = paginate.updates.length;
paginate.page.onReachBottom();
assert.strictEqual(paginate.updates.length, updateCount);
paginate.page.onEquipmentTap({ currentTarget: { dataset: { key: 'dumbbell' } } });
assert.strictEqual(paginate.page.data.items.length, 40);
assert(paginate.page.data.items.every(item => item.nameEn.includes('dumbbell')));

// Builders can run separately; when generated data exists, exercise the actual
// compact schema through the same page harness as well.
const realIndexPath = path.join(__dirname, '../packageExercise/data/exercise-index.js');
const realDetailPath = path.join(__dirname, '../packageExercise/data/exercise-detail.js');
if (fs.existsSync(realIndexPath) && fs.existsSync(realDetailPath)) {
  const realIndex = require(realIndexPath);
  const realDetails = require(realDetailPath);
  const realList = library.expandIndex(realIndex);
  const realPage = createPage('packageExercise/pages/library/library.js', realIndex);
  realPage.page.onLoad();
  assert.strictEqual(realPage.page.data.items.length, Math.min(40, realList.length));
  assert.strictEqual(realPage.page.data.total, realList.length);
  const bench = library.getDetail(realIndex, realDetails, '0025');
  assert(bench, 'Dataset preserves the zero-padded bench press id');
  assert(bench.steps.length > 0);
  const exactFilters = { keyword: 'bench', bodyPart: 'chest', equipmentGroup: 'barbell' };
  const expectedMatches = library.filterExercises(realList, exactFilters);
  assert(expectedMatches.some(item => item.id === '0025'));
  realPage.page.setData(exactFilters);
  realPage.page.applyFilters();
  assert.strictEqual(realPage.page.data.total, expectedMatches.length);
  assert(realPage.page.data.items.some(item => item.id === '0025'));
  console.log(`Real dataset verified: ${realList.length} exercises, ${expectedMatches.length} barbell chest bench matches.`);
}

// 拼音搜索：全拼、分词全拼、首字母都能命中“杠铃平板卧推”
{
  const realIndex = require('../packageExercise/data/exercise-index.js');
  const pinyinMap = require('../packageExercise/data/exercise-pinyin.js');
  const all = library.expandIndex(realIndex, pinyinMap);
  ['wotui', 'wo tui', 'glpbwt', 'gangling wotui'].forEach(keyword => {
    assert(library.filterExercises(all, { keyword }).some(item => item.id === '0025'), keyword);
  });
  assert(!library.expandIndex(realIndex).find(item => item.id === '0025').searchText.includes('wotui'), 'pinyin is optional');
  assert.strictEqual(Object.keys(pinyinMap).length, realIndex.rows.length);
}

console.log('Exercise library logic and page lifecycle tests passed.');
