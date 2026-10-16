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
    available: false,
    diagnostic: '',
    error: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const meta = wx.getStorageSync(cloudBackup.META_KEY) || null;
    const info = wx.getStorageInfoSync();
    this.setData({ local: { keyCount: info.keys.length, usedKb: info.currentSize, lastBackup: meta ? formatTime(meta.savedAt) : '' }, loading: true, available: false, error: '', diagnostic: '' });
    cloudBackup.getStatus()
      .then(status => this.setData({
        loading: false,
        available: status.protocol === 2,
        error: status.protocol === 2 ? '' : '云备份服务需要更新部署。',
        cloud: status.exists ? { savedAt: formatTime(status.savedAt), keyCount: status.keyCount, size: formatSize(status.size) } : null
      }))
      .catch(error => this.setData({ loading: false, available: false, cloud: null, error: this.describe(error), diagnostic: this.diagnostic(error) }));
  },

  diagnostic(error) { return JSON.stringify({ env: require('../../config/cloud.js').envId, service: 'userBackup', error: error.message,
    stage: error.stage || '', code: error.code || '', detail: error.detail || '', requestId: error.requestId || '' }, null, 2); },
  copyDiagnostic() { if (this.data.diagnostic) wx.setClipboardData({ data: this.data.diagnostic }); },

  describe(error) {
    const message = String(error && error.message || '');
    if (message.includes('cloud_unavailable')) return '当前环境没有连接云开发。';
    if (message.includes('checksum_mismatch') || message.includes('bad_backup') || message.includes('incomplete_upload')) return '备份完整性校验失败，未完成本次备份或恢复。';
    if (message.includes('restore_write_failed')) return '本机写入失败，已回退原数据，请检查存储空间。';
    if (message.includes('backup_too_large')) return '数据超过单份云备份容量，请先减少不需要的记录。';
    if (message.includes('database_error')) return (error.stage === 'create_collection' ? '云数据库集合初始化失败' : '云数据库访问失败') + (error.code ? '（' + error.code + '）' : '') + '，可复制诊断信息排查。';
    if (message.includes('superseded_upload')) return '另一台设备已保存更新的备份，请刷新后再操作。';
    if (message.includes('service_outdated') || message.includes('client_update_required') || message.includes('unknown_action')) return '云备份服务需要更新部署。';
    if (message.includes('FunctionName') || message.includes('-501000') || message.includes('not found')) return '云函数 userBackup 还没有部署。';
    return '暂时连不上云端，请稍后再试。';
  },

  backup() {
    if (this.data.busy || this.data.loading || !this.data.available) return;
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
        this.setData({ busy: false, error: this.describe(error), diagnostic: this.diagnostic(error) });
        wx.showToast({ title: '备份失败', icon: 'none' });
      });
  },

  restore() {
    if (this.data.busy || !this.data.cloud) return;
    wx.showModal({
      title: '从云端恢复？',
      content: `会用 ${this.data.cloud.savedAt} 的备份覆盖本机同名数据。云端没有的本机记录会保留；同一天的本机较新记录可能被替换。`,
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
            this.setData({ busy: false, error: this.describe(error), diagnostic: this.diagnostic(error) });
            wx.showToast({ title: '恢复失败', icon: 'none' });
          });
      }
    });
  }
});
