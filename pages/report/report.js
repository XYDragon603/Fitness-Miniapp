const util = require('../../utils/util.js');
const data = require('../../utils/insights-data.js');
const insights = require('../../utils/training-insights.js');
const card = require('../../utils/share-card.js');
Page({
  data: { report: null, saving: false, isShared: false, error: '' },
  onLoad(options = {}) {
    this.options = options;
    if (options.shared) {
      let text = options.shared; try { text = decodeURIComponent(text); } catch (_) {}
      const report = card.parse(text);
      this.setData({ report, isShared: true, error: report ? '' : '分享卡片内容已失效' });
    } else this.loadReport();
    if (wx.showShareMenu) wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  },
  loadReport() {
    const options = this.options || {};
    const report = options.kind === 'week' ? data.loadWeek(insights.validDate(options.start) ? options.start : '', util.getToday())
      : data.loadSession(insights.validDate(options.date) ? options.date : util.getToday());
    this.setData({ report: report ? card.snapshot(report) : null, error: report ? '' : '这天还没有训练记录' });
    if (report && report.kind === 'week') wx.setStorageSync('weekly_seen', report.start);
  },
  previousWeek() {
    if (!this.data.report || this.data.isShared) return;
    this.options = { kind: 'week', start: require('../../utils/schedule.js').addDays(this.data.report.start, -7) };
    this.loadReport();
  },
  onShareAppMessage() { const report = this.data.report; if (!report) return require('../../utils/app-sharing.js').home(); return { title: report.kind === 'week' ? '我的训练周报' : '又一次训练完成', path: card.sharePath(report) }; },
  onShareTimeline() { const share = this.onShareAppMessage(); return { title: share.title, query: share.path.split('?')[1] }; },
  saveImage() {
    if (this.data.saving || !this.data.report) return;
    this.setData({ saving: true, error: '' });
    const fail = () => this.setData({ saving: false, error: '图片生成失败，请重试' });
    this.createSelectorQuery().select('#shareCanvas').fields({ node: true, size: true }).exec(result => {
      const canvas = result && result[0] && result[0].node;
      if (!canvas) { fail(); return; }
      try { card.render(canvas, this.data.report); } catch (_) { fail(); return; }
      wx.canvasToTempFilePath({ canvas, fileType: 'png', destWidth: 750, destHeight: 1120,
        success: image => {
          this.setData({ saving: false });
          wx.saveImageToPhotosAlbum({ filePath: image.tempFilePath,
            success: () => wx.showToast({ title: '已保存，可分享到朋友圈', icon: 'none' }),
            fail: () => { this.setData({ error: '相册保存未完成，可以长按预览图保存' }); wx.previewImage({ urls: [image.tempFilePath] }); }
          });
        }, fail }, this);
    });
  }
});
