Component({
  data: {
    selected: 0,
    hidden: false,
    list: [
      {
        pagePath: 'pages/index/index',
        text: '计算器',
        icon: '📊',
      },
      {
        pagePath: 'pages/records/records',
        text: '开仓记录',
        icon: '📋',
      },
    ],
  },

  methods: {
    switchTab(e: any) {
      const dataset = (e.currentTarget && e.currentTarget.dataset) || {};
      const path: string = dataset.path;
      const index: number = Number(dataset.index);
      console.log('[custom-tab-bar] switchTab', { path, index, selected: this.data.selected });

      if (!path) return;
      if (index === this.data.selected) return;

      const url = path.startsWith('/') ? path : `/${path}`;
      wx.switchTab({
        url,
        success: () => {
          this.setData({ selected: index });
        },
        fail: (err) => {
          console.error('[custom-tab-bar] switchTab fail', err);
          wx.showToast({ title: '跳转失败', icon: 'none' });
        },
      });
    },
  },
});
