Component({
  data: {
    selected: 0,
    hidden: false,
    color: '#5D6366',
    selectedColor: '#111517',
    list: [
      {
        pagePath: '/pages/today/today',
        text: '今天',
        iconPath: '/images/tab-today.png',
        selectedIconPath: '/images/tab-today-active.png'
      },
      {
        pagePath: '/pages/library/library',
        text: '动作库',
        iconPath: '/images/tab-library.png',
        selectedIconPath: '/images/tab-library-active.png'
      },
      {
        pagePath: '/pages/index/index',
        text: '计划',
        iconPath: '/images/tab-plan.png',
        selectedIconPath: '/images/tab-plan-active.png'
      },
      {
        pagePath: '/pages/nutrition/nutrition',
        text: '饮食',
        iconPath: '/images/tab-diet.png',
        selectedIconPath: '/images/tab-diet-active.png'
      },
      {
        pagePath: '/pages/me/me',
        text: '我的',
        iconPath: '/images/tab-me.png',
        selectedIconPath: '/images/tab-me-active.png'
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
