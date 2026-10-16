// 动作库首页（主包）：只放部位入口，完整列表在 packageExercise 分包里。
// 数量来自 exercises-dataset（1324 个动作），腿部 = 大腿/臀 227 + 小腿 59。
const BODY_PARTS = [
  { key: 'chest', label: '胸部', count: 163, figure: 'chest' },
  { key: 'back', label: '背部', count: 203, figure: 'back' },
  { key: 'shoulders', label: '肩部', count: 143, figure: 'shoulders' },
  { key: 'upper arms', label: '上臂', count: 292, figure: 'arms' },
  { key: 'legs', label: '腿部', count: 286, figure: 'legs' },
  { key: 'waist', label: '腰腹', count: 169, figure: 'abs' }
];

Page({
  data: { keyword: '', bodyParts: BODY_PARTS },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 1, hidden: false });
  },
  onSearchInput(event) { this.setData({ keyword: event.detail.value }); },
  search() { this.openLibrary({ keyword: this.data.keyword }); },
  choosePart(event) { this.openLibrary({ bodyPart: event.currentTarget.dataset.key }); },
  browseAll() { this.openLibrary({}); },
  openLibrary(filters) {
    const query = Object.keys(filters).filter(key => filters[key]).map(key => key + '=' + encodeURIComponent(filters[key])).join('&');
    wx.navigateTo({ url: '/packageExercise/pages/library/library' + (query ? '?' + query : '') });
  }
});
