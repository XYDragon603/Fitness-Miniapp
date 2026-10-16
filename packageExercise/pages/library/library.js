const index = require('../../data/exercise-index.js');
const pinyinMap = require('../../data/exercise-pinyin.js');
const library = require('../../lib/exercise-library.js');
const ui = require('../../../utils/ui-helpers.js');
const favorites = require('../../../utils/exercise-favorites.js');
const PAGE_SIZE = 40;

// 筛选条：腿部合并大腿/臀与小腿，标签用短名
const BODY_CHIPS = [
  ['all', '全部'], ['chest', '胸部'], ['back', '背部'], ['shoulders', '肩部'], ['upper arms', '上臂'],
  ['legs', '腿部'], ['waist', '腰腹'], ['lower arms', '前臂'], ['cardio', '有氧'], ['neck', '颈部']
];
const EQUIPMENT_SHORT = { bodyweight: '徒手' };
const BODY_SHORT = { 'upper arms': '上臂', 'upper legs': '腿部', 'lower legs': '小腿', waist: '腰腹', 'lower arms': '前臂' };

Page({
  data: {
    keyword: '', bodyPart: 'all', equipmentGroup: 'all', mode: '', sortMode: 'default', dayLabel: '', favoritesOnly: false,
    bodyParts: [], equipmentGroups: [], items: [], total: 0, hasMore: false,
    selectedCount: 0, attribution: `${index.attribution || ''} · ${ui.MEDIA_ATTRIBUTION}`
  },
  onLoad(options = {}) {
    this._destroyed = false;
    this._all = library.expandIndex(index, pinyinMap);
    this._added = Object.create(null);
    const app = typeof getApp === 'function' ? getApp() : null;
    const pickContext = app && app.globalData ? app.globalData.pickContext || '' : '';
    const validBodyPart = BODY_CHIPS.some(([key]) => key === options.bodyPart) || (index.bodyParts || []).some(part => part.key === options.bodyPart);
    this.setData({
      mode: options.mode === 'pick' ? 'pick' : '',
      favoritesOnly: options.favorite === '1',
      dayLabel: options.mode === 'pick' ? pickContext : '',
      keyword: typeof options.keyword === 'string' ? options.keyword : '',
      bodyPart: validBodyPart ? options.bodyPart : 'all',
      bodyParts: BODY_CHIPS.map(([key, label]) => ({ key, label })),
      equipmentGroups: [{ key: 'all', label: '全部器械' }, ...index.equipmentGroups.map(group => ({ ...group, label: EQUIPMENT_SHORT[group.key] || group.label }))]
    });
    this.applyFilters();
  },
  onShow() {
    if (this._searchPending || this._favoritesKey !== JSON.stringify(favorites.list(wx))) this.applyFilters();
  },
  toggleFavoritesOnly() { this.setData({ favoritesOnly: !this.data.favoritesOnly }); this.applyFilters(); },
  toggleFavorite(event) { favorites.toggle(event.currentTarget.dataset.id, wx); this.applyFilters(); },
  onHide() { this.clearSearchTimer(); },
  onUnload() {
    this._destroyed = true;
    this.clearSearchTimer();
  },
  clearSearchTimer() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = null;
  },
  onSearchInput(event) {
    this.setData({ keyword: event.detail.value });
    this._searchPending = true;
    this.clearSearchTimer();
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      if (!this._destroyed) this.applyFilters();
    }, 200);
  },
  onSearchConfirm() { this.applyFilters(); },
  clearKeyword() {
    this.setData({ keyword: '' });
    this.applyFilters();
  },
  onBodyPartTap(event) {
    this.setData({ bodyPart: event.currentTarget.dataset.key });
    this.applyFilters();
  },
  onEquipmentTap(event) {
    this.setData({ equipmentGroup: event.currentTarget.dataset.key });
    this.applyFilters();
  },
  onSortTap() {
    wx.showActionSheet({
      itemList: ['默认排序', '按名称排序'],
      success: result => {
        this.setData({ sortMode: result.tapIndex === 1 ? 'name' : 'default' });
        this.applyFilters();
      }
    });
  },
  clearFilters() {
    this.setData({ keyword: '', bodyPart: 'all', equipmentGroup: 'all', favoritesOnly: false });
    this.applyFilters();
  },
  present(item) {
    const bodyShort = BODY_SHORT[item.bodyPart] || item.bodyPartLabel;
    const tags = [item.targetLabel, item.equipmentLabel].filter((value, position, all) => value && value !== bodyShort && all.indexOf(value) === position);
    return {
      id: item.id, name: item.name, nameEn: item.nameEn,
      labels: `${item.bodyPartLabel} · ${item.equipmentLabel} · ${item.targetLabel}`,
      bodyShort, tags,
      meta: `${bodyShort} · ${item.targetLabel}`,
      equipmentLabel: item.equipmentLabel,
      image: ui.equipmentImage(item.name, item.equipmentGroup),
      thumb: (ui.exerciseMedia(item.id) || {}).thumb || '',
      muscle: ui.muscleImage(item.targetLabel || item.bodyPartLabel, 'light'),
      added: Boolean(this._added[item.id]),
      favorite: (this._favoriteIds || []).includes(item.id)
    };
  },
  applyFilters() {
    this.clearSearchTimer();
    this._searchPending = false;
    this._filtered = library.filterExercises(this._all, this.data);
    this._favoriteIds = favorites.list(wx);
    this._favoritesKey = JSON.stringify(this._favoriteIds);
    if (this.data.favoritesOnly) this._filtered = this._filtered.filter(item => this._favoriteIds.includes(item.id));
    if (this.data.sortMode === 'name') {
      this._filtered = this._filtered.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    }
    this._visibleCount = Math.min(PAGE_SIZE, this._filtered.length);
    this.setData({
      items: this._filtered.slice(0, this._visibleCount).map(item => this.present(item)),
      total: this._filtered.length, hasMore: this._visibleCount < this._filtered.length
    });
  },
  onReachBottom() {
    if (this._destroyed || this._searchPending || this._visibleCount >= this._filtered.length) return;
    const start = this._visibleCount;
    const end = Math.min(start + PAGE_SIZE, this._filtered.length);
    const update = { hasMore: end < this._filtered.length };
    for (let position = start; position < end; position += 1) {
      update[`items[${position}]`] = this.present(this._filtered[position]);
    }
    this._visibleCount = end;
    this.setData(update);
  },
  onExerciseTap(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageExercise/pages/detail/detail?id=${encodeURIComponent(id)}${this.data.mode === 'pick' ? '&mode=pick' : ''}`,
      events: {
        exercisePicked: exercise => {
          if (!this._destroyed && this.data.mode === 'pick') this.forwardPick(exercise);
        }
      }
    });
  },
  onAddTap(event) {
    if (this.data.mode !== 'pick') return;
    const detail = library.getDetail(index, require('../../data/exercise-detail.js'), event.currentTarget.dataset.id);
    if (!detail) return;
    // Rapid repeated taps must still create independent plan rows.
    this._lastPickTime = Math.max(Date.now(), (this._lastPickTime || 0) + 1);
    this.forwardPick(library.toPlanExercise(detail, detail, this._lastPickTime));
  },
  forwardPick(exercise) {
    const channel = this.getOpenerEventChannel();
    if (!channel || typeof channel.emit !== 'function') return;
    // The list owns the session identity, including picks forwarded by detail pages.
    this._lastPickTime = Math.max(Date.now(), (this._lastPickTime || 0) + 1);
    exercise = { ...exercise, id: `lib_${exercise.libraryId}_${this._lastPickTime.toString(36)}` };
    channel.emit('exercisePicked', exercise);
    this._added[exercise.libraryId] = true;
    const update = { selectedCount: this.data.selectedCount + 1 };
    const position = this.data.items.findIndex(item => item.id === exercise.libraryId);
    if (position >= 0) update[`items[${position}].added`] = true;
    this.setData(update);
  },
  onThumbError(event) {
    const position = Number(event.currentTarget.dataset.index);
    if (this.data.items[position]) this.setData({ [`items[${position}].thumb`]: '' });
  },
  finishPick() { wx.navigateBack({ delta: 1 }); }
});
