const index = require('../../data/exercise-index.js');
const details = require('../../data/exercise-detail.js');
const library = require('../../lib/exercise-library.js');
const ui = require('../../../utils/ui-helpers.js');

function titleCase(text) {
  return String(text || '').replace(/\b([a-z])/g, letter => letter.toUpperCase());
}

Page({
  data: { item: null, mode: '', primaryLabels: [], mediaUrl: '', addedCount: 0, view: null },
  onLoad(options = {}) {
    this._destroyed = false;
    const item = library.getDetail(index, details, options.id);
    this._item = item;
    this.setData({
      item, mode: options.mode === 'pick' ? 'pick' : '',
      primaryLabels: item ? [item.targetLabel, item.muscleGroupLabel]
        .filter((value, position, all) => value && all.indexOf(value) === position) : [],
      mediaUrl: item && library.mediaBaseUrl ? `${library.mediaBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(item.id)}.gif` : '',
      view: item ? {
        nameEn: titleCase(item.nameEn),
        image: ui.equipmentImage(item.name, item.equipmentGroup),
        gif: (ui.exerciseMedia(item.id) || {}).gif || '',
        attribution: ui.MEDIA_ATTRIBUTION,
        primary: item.targetLabel || item.bodyPartLabel,
        primaryFigure: ui.muscleImage(item.targetLabel || item.bodyPartLabel, 'light'),
        primaryDesc: `重点刺激${item.bodyPartLabel}肌群，是这个动作的主要发力部位。`,
        secondary: item.secondaryLabels[0] || item.muscleGroupLabel || '',
        secondaryFigure: ui.muscleImage(item.secondaryLabels[0] || item.muscleGroupLabel || item.bodyPartLabel, 'light'),
        secondaryDesc: item.secondaryLabels.length > 1 ? `以及${item.secondaryLabels.slice(1, 3).join('、')}协同发力。` : '协同发力，辅助完成动作。',
        bodyFigure: ui.muscleImage(item.bodyPartLabel, 'dark')
      } : null
    });
    if (item) wx.setNavigationBarTitle({ title: item.name });
  },
  onUnload() { this._destroyed = true; },
  openProgress() { if (this._item) wx.navigateTo({ url: `/pages/exercise-progress/progress?key=${encodeURIComponent(this._item.id)}&name=${encodeURIComponent(this._item.name)}` }); },
  onMediaError() { this.setData({ mediaUrl: '' }); },
  onGifError() { this.setData({ 'view.gif': '' }); },
  onAddTap() {
    if (!this._item || this._destroyed) return;
    if (this.data.mode !== 'pick') {
      wx.showToast({ title: '请在计划编辑中添加', icon: 'none' });
      return;
    }
    const channel = this.getOpenerEventChannel();
    if (!channel || typeof channel.emit !== 'function') return;
    this._lastPickTime = Math.max(Date.now(), (this._lastPickTime || 0) + 1);
    channel.emit('exercisePicked', library.toPlanExercise(this._item, this._item, this._lastPickTime));
    this.setData({ addedCount: this.data.addedCount + 1 });
    wx.showToast({ title: '已加入训练计划', icon: 'success' });
  },
  onShareAppMessage() {
    const item = this._item;
    return {
      title: item ? `${item.name} · 动作库` : '训练动作库',
      path: item ? `/packageExercise/pages/detail/detail?id=${encodeURIComponent(item.id)}` : '/packageExercise/pages/library/library'
    };
  }
});
