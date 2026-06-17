// pages/index/index.ts - 仓位计算器页面
import { TradeRecord, getRecords, saveRecords } from '../../types/trade';

Page({
  data: {
    principal: '',
    entryPrice: '',
    stopLossPrice: '',
    riskRewardRatio: '2',   // 盈亏比（盈利空间 / 止损空间）
    quickRatios: [1, 1.5, 2, 3, 5],
    riskPercent: 5,
    leverage: 10,
    direction: 'long',
    coin: 'BTC',
    quickPercents: [1, 2, 5, 10, 20],
    quickLeverages: [1, 2, 3, 5, 10, 20, 50, 100],
    showFormula: false,

    // 手续费（开仓 Maker 限价单，平仓 Taker 市价单，支持自定义）
    makerRateInput: '0.02',   // 开仓费率输入值（%）
    takerRateInput: '0.05',   // 平仓费率输入值（%）
    makerRate: 0.0002,
    takerRate: 0.0005,

    // 结果
    hasResult: false,
    maxLoss: '0.00',
    stopLossRange: '0.00',
    orderQty: '0.0000',       // 币计价下单量
orderQtyUsdt: '0.00',    // USD 计价下单量
qtyUnit: 'coin' as 'coin' | 'usd',  // 当前展示单位
    orderValue: '0.00',
    margin: '0.00',
    requiredLeverage: '1',
    marginWarning: false,
    leverageWarning: false,
    errorMsg: '',
    marginRatio: 0,  // 保证金占本金比例（%）整数，用于圆环
    marginRatioText: '0.0',  // 显示用的一位小数
    remainMargin: '0.00',  // 剩余保证金（本金 - 保证金占用）
    remainMarginNegative: false,  // 剩余保证金是否为负
    openFee: '0.00',    // 开仓手续费
    closeFee: '0.00',   // 平仓手续费
    totalFee: '0.00',   // 总手续费
    takeProfitPrice: '0.00',  // 止盈价格
  },

  onShow() {
    // 更新自定义 tabBar 选中状态
    const tabBar = this.getTabBar() as any;
    if (tabBar) tabBar.setData({ selected: 0 });
    // 从开仓记录页跳转回来时，读取填入的参数
    const app = getApp<{ calcParams?: any }>();
    if (app && app.calcParams) {
      const p = app.calcParams;
      this.setData({
        principal: p.principal || '',
        entryPrice: p.entryPrice || '',
        stopLossPrice: p.stopLossPrice || '',
        riskPercent: p.riskPercent || 5,
        leverage: p.leverage || 10,
        direction: p.direction || 'long',
        coin: p.coin || 'BTC',
        hasResult: false,
      });
      app.calcParams = null;
      wx.showToast({ title: '已填入参数', icon: 'success' });
    }
  },

  onPrincipalInput(e: any) {
    this.setData({ principal: e.detail.value, hasResult: false });
  },
  onEntryPriceInput(e: any) {
    this.setData({ entryPrice: e.detail.value, hasResult: false });
  },
  onStopLossPriceInput(e: any) {
    this.setData({ stopLossPrice: e.detail.value, hasResult: false });
  },
  onRiskRewardRatioInput(e: any) {
    this.setData({ riskRewardRatio: e.detail.value, hasResult: false });
  },
  onQuickRatio(e: any) {
    this.setData({ riskRewardRatio: String(e.currentTarget.dataset.value), hasResult: false });
  },
  onSliderChange(e: any) {
    this.setData({ riskPercent: e.detail.value, hasResult: false });
  },
  onLeverageChange(e: any) {
    this.setData({ leverage: e.detail.value, hasResult: false });
  },
  onQuickPercent(e: any) {
    this.setData({ riskPercent: e.currentTarget.dataset.value, hasResult: false });
  },
  onQuickLeverage(e: any) {
    this.setData({ leverage: e.currentTarget.dataset.value, hasResult: false });
  },
  onDirectionChange(e: any) {
    this.setData({ direction: e.currentTarget.dataset.value, hasResult: false });
  },
  onToggleFormula() {
    this.setData({ showFormula: !this.data.showFormula });
  },

  onMakerRateInput(e: any) {
    const val = e.detail.value;
    const rate = parseFloat(val);
    this.setData({
      makerRateInput: val,
      makerRate: (!isNaN(rate) && rate >= 0) ? rate / 100 : 0.0002,
      hasResult: false,
    });
  },

  onTakerRateInput(e: any) {
    const val = e.detail.value;
    const rate = parseFloat(val);
    this.setData({
      takerRateInput: val,
      takerRate: (!isNaN(rate) && rate >= 0) ? rate / 100 : 0.0005,
      hasResult: false,
    });
  },

  onQtyUnitChange(e: any) {
    this.setData({ qtyUnit: e.currentTarget.dataset.unit }, () => {
      // 切换单位触发重渲染会清空 canvas，需重新绘制圆环
      if (this.data.hasResult && !this.data.errorMsg) {
        setTimeout(() => {
          this.drawRing(this.data.marginRatio, this.data.marginWarning);
        }, 50);
      }
    });
  },


  calculate() {
    const { principal, entryPrice, stopLossPrice, riskRewardRatio, riskPercent, leverage, direction } = this.data;
    const p = parseFloat(principal);
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLossPrice);
    const risk = parseFloat(String(riskPercent));
    const lev = parseFloat(String(leverage));

    if (isNaN(p) || p <= 0) {
      this.setData({ hasResult: true, errorMsg: '请输入有效的本金' }); return;
    }
    if (isNaN(entry) || entry <= 0) {
      this.setData({ hasResult: true, errorMsg: '请输入有效的入场价格' }); return;
    }
    if (isNaN(stop) || stop <= 0) {
      this.setData({ hasResult: true, errorMsg: '请输入有效的止损价格' }); return;
    }
    if (stop === entry) {
      this.setData({ hasResult: true, errorMsg: '止损价格不能等于入场价格' }); return;
    }
    // 方向校验：做多止损必须低于入场价；做空止损必须高于入场价
    if (direction === 'long' && stop >= entry) {
      this.setData({ hasResult: true, errorMsg: '做多时，止损价格应低于入场价格' }); return;
    }
    if (direction === 'short' && stop <= entry) {
      this.setData({ hasResult: true, errorMsg: '做空时，止损价格应高于入场价格' }); return;
    }

    const rr = parseFloat(riskRewardRatio);
    if (isNaN(rr) || rr <= 0) {
      this.setData({ hasResult: true, errorMsg: '请输入有效的盈亏比（大于 0）' }); return;
    }

    const { makerRate, takerRate } = this.data;
    const maxLoss = p * (risk / 100);
    const priceDiff = Math.abs(entry - stop);
    const stopLossRange = (priceDiff / entry) * 100;
    const takeProfit = direction === 'long'
      ? entry + priceDiff * rr
      : entry - priceDiff * rr;

    // 考虑手续费反推下单量：
    // 设下单价值为 V，止损价值 = V * (stop/entry)
    // 开仓手续费（Maker 0.02%）= V * makerRate
    // 平仓手续费（Taker 0.05%）= V * (stop/entry) * takerRate
    // 价格亏损 = V * stopLossRange/100
    // 总亏损 = 价格亏损 + 开仓手续费 + 平仓手续费 = maxLoss
    // V * (stopLossRange/100 + makerRate + (stop/entry)*takerRate) = maxLoss
    const stopRatio = stop / entry;
    const lossFactor = (stopLossRange / 100) + makerRate + stopRatio * takerRate;
    const orderValue = maxLoss / lossFactor;
    const orderQty = orderValue / entry;
    const openFee = orderValue * makerRate;
    const closeFee = (orderValue * stopRatio) * takerRate;
    const totalFee = openFee + closeFee;

    const margin = orderValue / lev;
    const requiredLeverage = Math.ceil(orderValue / p);
    const marginWarning = margin > p;
    const leverageWarning = lev < requiredLeverage;

    const marginRatio = Math.min(Math.round((margin / p) * 100), 100);
    const marginRatioText = ((margin / p) * 100).toFixed(1);
    const remain = p - margin;

    this.setData({
      hasResult: true,
      errorMsg: '',
      maxLoss: maxLoss.toFixed(2),
      stopLossRange: stopLossRange.toFixed(2),
      orderQty: orderQty.toFixed(4),
      orderQtyUsdt: orderValue.toFixed(2),
      orderValue: orderValue.toFixed(2),
      margin: margin.toFixed(2),
      requiredLeverage: String(requiredLeverage),
      marginWarning,
      leverageWarning,
      marginRatio,
      marginRatioText,
      remainMargin: remain.toFixed(2),
      remainMarginNegative: remain < 0,
      openFee: openFee.toFixed(4),
      closeFee: closeFee.toFixed(4),
      totalFee: totalFee.toFixed(4),
      takeProfitPrice: takeProfit.toFixed(2),
    }, () => {
      // result-card 从 display:none 变为 display:block 后，需等渲染完成再绘制圆环
      setTimeout(() => {
        this.drawRing(marginRatio, marginWarning);
      }, 50);
    });
  },

  // 绘制保证金占用比例圆环
  drawRing(percent: number, warning: boolean) {
    const ctx = wx.createCanvasContext('ringCanvas', this);
    // 根据设备像素比计算 canvas 实际尺寸（canvas 容器为 110rpx × 110rpx）
    const sysInfo = wx.getSystemInfoSync();
    // 110rpx 转 px：rpx * (屏幕宽 / 750)
    const sizePx = 110 * (sysInfo.windowWidth / 750);
    const lineWidth = 7;
    const cx = sizePx / 2;
    const cy = sizePx / 2;
    const r = cx - lineWidth / 2 - 1; // 留出线宽空间，避免被画布边缘裁剪
    // 背景圆
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.setStrokeStyle('#2a2d3e');
    ctx.setLineWidth(lineWidth);
    ctx.stroke();
    // 进度弧
    if (percent > 0) {
      const start = -Math.PI / 2;
      const end = start + (2 * Math.PI * Math.min(percent, 100)) / 100;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.setStrokeStyle(warning ? '#ff4d4f' : '#52c41a');
      ctx.setLineWidth(lineWidth);
      ctx.setLineCap('round');
      ctx.stroke();
    }
    ctx.draw();
  },

  saveRecord() {
    const { principal, entryPrice, stopLossPrice, takeProfitPrice, riskPercent, leverage, direction, coin,
      orderQty, orderValue, margin, maxLoss, stopLossRange, requiredLeverage } = this.data;
    if (!this.data.hasResult || this.data.errorMsg) {
      wx.showToast({ title: '请先计算结果', icon: 'none' }); return;
    }
    const now = new Date();
    const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const record: TradeRecord = {
      id: Date.now(), time: timeStr, coin, principal, entryPrice, stopLossPrice,
      takeProfitPrice, riskPercent, leverage, direction,
      orderQty, orderValue, margin, maxLoss, stopLossRange, requiredLeverage,
      status: 'holding', closePrice: '', realPnl: '0',
    };
    const records = getRecords();
    const newRecords = [record, ...records].slice(0, 100);
    saveRecords(newRecords);
    wx.showToast({ title: '已保存记录', icon: 'success' });
  },
});
