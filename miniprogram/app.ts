// app.ts
App({
  globalData: {},
  // 计算器页面参数传递（从开仓记录填入）
  calcParams: null,
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);
  },
} as any);