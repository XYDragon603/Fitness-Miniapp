// 自定义导航栏：状态栏 + 与胶囊按钮等高的一行。大标题写在页面内容里。
function getMetrics() {
  const app = getApp();
  if (app && app.globalData && app.globalData.navMetrics) {
    return app.globalData.navMetrics;
  }

  let statusBarHeight = 20;
  let navHeight = 44;
  let capsuleWidth = 96;
  try {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    statusBarHeight = windowInfo.statusBarHeight || statusBarHeight;
    const rect = wx.getMenuButtonBoundingClientRect();
    if (rect && rect.height) {
      navHeight = (rect.top - statusBarHeight) * 2 + rect.height;
      capsuleWidth = windowInfo.windowWidth - rect.left + 8;
    }
  } catch (error) {
    // 使用默认值
  }

  const metrics = { statusBarHeight, navHeight, capsuleWidth };
  if (app && app.globalData) {
    app.globalData.navMetrics = metrics;
  }
  return metrics;
}

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    back: { type: Boolean, value: false },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    align: { type: String, value: 'left' },
    dark: { type: Boolean, value: false },
    // 为 true 时点返回只触发 back 事件，由页面自己关闭子页
    customBack: { type: Boolean, value: false }
  },
  data: { statusBarHeight: 20, navHeight: 44, capsuleWidth: 96 },
  lifetimes: {
    attached() {
      this.setData(getMetrics());
    }
  },
  methods: {
    onBack() {
      if (this.data.customBack) {
        this.triggerEvent('back');
        return;
      }
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: '/pages/today/today' });
      }
    }
  }
});
