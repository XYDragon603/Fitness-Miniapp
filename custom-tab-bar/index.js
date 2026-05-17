Component({
  data: {
    selected: 0,
    hidden: false,
    color: '#64727D',
    selectedColor: '#C96565',
    list: [
      {
        pagePath: '/pages/index/index',
        text: '训练计划',
        iconPath: '/images/plan.png',
        selectedIconPath: '/images/plan-active.png'
      },
      {
        pagePath: '/pages/record/record',
        text: '训练记录',
        iconPath: '/images/record.png',
        selectedIconPath: '/images/record-active.png'
      },
      {
        pagePath: '/pages/nutrition/nutrition',
        text: '营养记录',
        iconPath: '/images/food.png',
        selectedIconPath: '/images/food-active.png'
      },
      {
        pagePath: '/pages/history/history',
        text: '历史记录',
        iconPath: '/images/history.png',
        selectedIconPath: '/images/history-active.png'
      },
      {
        pagePath: '/pages/stats/stats',
        text: '数据统计',
        iconPath: '/images/stats.png',
        selectedIconPath: '/images/stats-active.png'
      }
    ]
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
    }
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage ? `/${currentPage.route}` : '';
      const selected = this.data.list.findIndex(item => item.pagePath === currentRoute);

      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },

    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      if (!path) {
        return;
      }

      if (index === this.data.selected) {
        return;
      }

      this.setData({
        selected: index
      });

      wx.switchTab({
        url: path
      });
    }
  }
});
