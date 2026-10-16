const cloudBackup = require('../../utils/cloud-backup.js');

function formatTime(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || isNaN(date.getTime())) return '';
  const pad = value => String(value).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSize(chars) {
  const kb = (Number(chars) || 0) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
}

Page({
  data: {
    local: { keyCount: 0 },
    cloud: null,
    loading: true,
    busy: false,
    error: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const meta = wx.getStorageSync(cloudBackup.META_KEY) || null;
    const info = wx.getStorageInfoSync();
    this.setData({ local: { keyCount: info.keys.length, usedKb: info.currentSize, lastBackup: meta ? formatTime(meta.savedAt) : '' }, loading: true, error: '' });
    cloudBackup.getStatus()
      .then(status => this.setData({
        loading: false,
        cloud: status.exists ? { savedAt: formatTime(status.savedAt), keyCount: status.keyCount, size: formatSize(status.size) } : null
      }))
      .catch(error => this.setData({ loading: false, cloud: null, error: this.describe(error) }));
  },

  describe(error) {
    const message = String(error && error.message || '');
    if (message.includes('cloud_unavailable')) return '当前环境没有连接云开发。';
    if (message.includes('FunctionName') || message.includes('-501000') || message.includes('not found')) return '云函数 userBackup 还没有部署。';
    return '暂时连不上云端，请稍后再试。';
  },

  backup() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    wx.showLoading({ title: '正在备份', mask: true });
    cloudBackup.backupNow()
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已备份到云端', icon: 'success' });
        this.setData({ busy: false });
        this.refresh();
      })
      .catch(error => {
        wx.hideLoading();
        this.setData({ busy: false, error: this.describe(error) });
        wx.showToast({ title: '备份失败', icon: 'none' });
      });
  },

  restore() {
    if (this.data.busy || !this.data.cloud) return;
    wx.showModal({
      title: '从云端恢复？',
      content: `会用 ${this.data.cloud.savedAt} 的备份覆盖本机同名数据。本机较新的记录可能被替换。`,
      confirmText: '恢复',
      success: result => {
        if (!result.confirm) return;
        this.setData({ busy: true });
        wx.showLoading({ title: '正在恢复', mask: true });
        cloudBackup.restoreFromCloud()
          .then(() => {
            wx.hideLoading();
            const app = getApp();
            if (app && typeof app.refreshTrainingPlanState === 'function') app.refreshTrainingPlanState();
            this.setData({ busy: false });
            wx.showToast({ title: '已恢复', icon: 'success' });
            this.refresh();
          })
          .catch(error => {
            wx.hideLoading();
            this.setData({ busy: false, error: this.describe(error) });
            wx.showToast({ title: '恢复失败', icon: 'none' });
          });
      }
    });
  }
});
