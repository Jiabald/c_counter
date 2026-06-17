// pages/records/records.ts - 开仓记录页面
import { TradeRecord, getRecords, saveRecords } from '../../types/trade';

Page({
  data: {
    records: [] as TradeRecord[],
    filterStatus: 'all',

    // 统计
    totalCount: 0,
    holdingCount: 0,
    profitCount: 0,
    lossCount: 0,
    totalPnl: '+0.00',
    winRate: '0.0',

    // 新增记录弹窗
    showAddModal: false,
    newRecord: {
      coin: '',
      direction: 'long',
      entryPrice: '',
      stopLossPrice: '',
      takeProfitPrice: '',
      leverage: 10,
      orderQty: '',
      orderQtyUnit: 'coin' as 'coin' | 'usd',  // 下单数量单位
      note: '',
    },

    // 平仓弹窗
    showCloseModal: false,
    closingRecordId: 0,
    closePrice: '',
    closeStatus: 'profit',

    // 展开平仓输入框的记录 id 集合
    expandedCloseIds: {} as Record<number, boolean>,

    // 导出弹窗
    showExportModal: false,
    exportScope: 'all' as 'all' | 'filtered',
    exportFilterLabel: '全部',
    exportCanvasW: 750,
    exportCanvasH: 1000,
  },

  onShow() {
    // 更新自定义 tabBar 选中状态
    const tabBar = this.getTabBar() as any;
    if (tabBar) tabBar.setData({ selected: 1 });
    const records = getRecords();
    this.setData({ records });
    this.calcStats(records);
  },

  calcStats(records: TradeRecord[]) {
    const total = records.length;
    const holding = records.filter(r => r.status === 'holding').length;
    const profit = records.filter(r => r.status === 'profit').length;
    const loss = records.filter(r => r.status === 'loss').length;
    const closed = records.filter(r => r.status !== 'holding');
    const totalPnlNum = closed.reduce((sum, r) => sum + parseFloat(r.realPnl || '0'), 0);
    const winRate = closed.length > 0 ? ((profit / closed.length) * 100).toFixed(1) : '0.0';
    this.setData({
      totalCount: total,
      holdingCount: holding,
      profitCount: profit,
      lossCount: loss,
      totalPnl: totalPnlNum >= 0 ? '+' + totalPnlNum.toFixed(2) : totalPnlNum.toFixed(2),
      winRate,
    });
  },

  onFilterChange(e: any) {
    this.setData({ filterStatus: e.currentTarget.dataset.status });
  },

  // 阻止事件冒泡（弹窗内容区点击不关闭弹窗）
  onStopPropagation() {},

  // 切换自定义 tabBar 的显隐（弹窗打开时隐藏 tabBar，防止遮挡）
  toggleTabBar(hidden: boolean) {
    const tabBar = this.getTabBar() as any;
    if (tabBar) tabBar.setData({ hidden });
  },

  // ===== 新增记录弹窗 =====
  onShowAddModal() {
    this.setData({ showAddModal: true });
    this.toggleTabBar(true);
  },
  onHideAddModal() {
    this.setData({ showAddModal: false });
    this.toggleTabBar(false);
  },
  onNewRecordInput(e: any) {
    const field = e.currentTarget.dataset.field;
    const newRecord = { ...this.data.newRecord, [field]: e.detail.value };
    this.setData({ newRecord });
  },
  onNewRecordDirection(e: any) {
    const newRecord = { ...this.data.newRecord, direction: e.currentTarget.dataset.value };
    this.setData({ newRecord });
  },
  onNewRecordQtyUnit(e: any) {
    const newRecord = { ...this.data.newRecord, orderQtyUnit: e.currentTarget.dataset.unit };
    this.setData({ newRecord });
  },
  onAddRecord() {
    const { newRecord, records } = this.data;
    if (!newRecord.note) {
      wx.showToast({ title: '请填写入场逻辑', icon: 'none' }); return;
    }
    if (!newRecord.coin) {
      wx.showToast({ title: '请填写交易对/币种', icon: 'none' }); return;
    }
    if (!newRecord.entryPrice) {
      wx.showToast({ title: '请填写入场价格', icon: 'none' }); return;
    }
    if (!newRecord.stopLossPrice) {
      wx.showToast({ title: '请填写止损价格', icon: 'none' }); return;
    }
    if (!newRecord.orderQty) {
      wx.showToast({ title: '请填写下单数量', icon: 'none' }); return;
    }
    if (!newRecord.leverage) {
      wx.showToast({ title: '请填写杠杆', icon: 'none' }); return;
    }
    const now = new Date();
    const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // 若单位为 USD，换算成币数量存储
    let finalOrderQty = newRecord.orderQty || '0';
    if (newRecord.orderQtyUnit === 'usd' && newRecord.orderQty && newRecord.entryPrice) {
      const entryNum = parseFloat(newRecord.entryPrice);
      const qtyUsdt = parseFloat(newRecord.orderQty);
      if (entryNum > 0) {
        finalOrderQty = (qtyUsdt / entryNum).toFixed(4);
      }
    }
    const record: TradeRecord = {
      id: Date.now(), time: timeStr,
      coin: newRecord.coin || 'BTC',
      principal: '',
      entryPrice: newRecord.entryPrice,
      stopLossPrice: newRecord.stopLossPrice,
      takeProfitPrice: newRecord.takeProfitPrice || '',
      riskPercent: 0,
      leverage: newRecord.leverage || 10,
      direction: newRecord.direction,
      orderQty: finalOrderQty,
      orderValue: '0',
      margin: '0',
      maxLoss: '0',
      stopLossRange: '0',
      requiredLeverage: '1',
      status: 'holding',
      closePrice: '',
      realPnl: '0',
      note: newRecord.note || '',
    };
    const newRecords = [record, ...records].slice(0, 100);
    this.setData({
      records: newRecords,
      showAddModal: false,
      newRecord: { coin: 'BTC', direction: 'long', entryPrice: '', stopLossPrice: '', takeProfitPrice: '', leverage: 10, orderQty: '', orderQtyUnit: 'coin' as 'coin' | 'usd', note: '' },
    });
    saveRecords(newRecords);
    this.calcStats(newRecords);
    this.toggleTabBar(false);
    wx.showToast({ title: '已添加记录', icon: 'success' });
  },

  // ===== 内联平仓（卡片内直接输入） =====
  onToggleCloseInput(e: any) {
    const id = e.currentTarget.dataset.id;
    const expandedCloseIds = { ...this.data.expandedCloseIds };
    expandedCloseIds[id] = !expandedCloseIds[id];
    this.setData({ expandedCloseIds });
  },
  onClosePriceInputInline(e: any) {
    // 临时存储各卡片的平仓价输入
    const id = e.currentTarget.dataset.id;
    const key = `inlineClose_${id}`;
    (this as any)[key] = e.detail.value;
  },

  onClosePositionInline(e: any) {
    const id = e.currentTarget.dataset.id;
    const key = `inlineClose_${id}`;
    const closePrice = (this as any)[key] || '';
    if (!closePrice) {
      wx.showToast({ title: '请输入平仓价', icon: 'none' }); return;
    }
    const { records } = this.data;
    const newRecords = records.map((r: TradeRecord) => {
      if (r.id !== id) return r;
      const entry = parseFloat(r.entryPrice);
      const close = parseFloat(closePrice);
      const qty = parseFloat(r.orderQty);
      const pnl = r.direction === 'long' ? (close - entry) * qty : (entry - close) * qty;
      const closeStatus = pnl >= 0 ? 'profit' : 'loss';
      return { ...r, status: closeStatus, closePrice, realPnl: pnl.toFixed(2) };
    });
    this.setData({ records: newRecords });
    saveRecords(newRecords);
    this.calcStats(newRecords);
    wx.showToast({ title: '已平仓', icon: 'success' });
  },

  // ===== 平仓弹窗 =====
  onClosePosition(e: any) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showCloseModal: true, closingRecordId: id, closePrice: '', closeStatus: 'profit' });
    this.toggleTabBar(true);
  },
  onHideCloseModal() {
    this.setData({ showCloseModal: false });
    this.toggleTabBar(false);
  },
  onClosePriceInput(e: any) {
    this.setData({ closePrice: e.detail.value });
  },
  onCloseStatusChange(e: any) {
    this.setData({ closeStatus: e.currentTarget.dataset.status });
  },
  onConfirmClose() {
    const { closingRecordId, closePrice, closeStatus, records } = this.data;
    if (!closePrice) {
      wx.showToast({ title: '请输入平仓价', icon: 'none' }); return;
    }
    const newRecords = records.map((r: TradeRecord) => {
      if (r.id !== closingRecordId) return r;
      const entry = parseFloat(r.entryPrice);
      const close = parseFloat(closePrice);
      const qty = parseFloat(r.orderQty);
      const pnl = r.direction === 'long' ? (close - entry) * qty : (entry - close) * qty;
      return { ...r, status: closeStatus, closePrice, realPnl: pnl.toFixed(2) };
    });
    this.setData({ records: newRecords, showCloseModal: false });
    saveRecords(newRecords);
    this.calcStats(newRecords);
    this.toggleTabBar(false);
    wx.showToast({ title: '已平仓', icon: 'success' });
  },

  // ===== 删除 / 填入计算器 =====
  deleteRecord(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除', content: '确定删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const records = this.data.records.filter((r: TradeRecord) => r.id !== id);
          this.setData({ records });
          saveRecords(records);
          this.calcStats(records);
        }
      }
    });
  },

  // ===== 导出功能 =====
  onShowExportModal() {
    const { filterStatus } = this.data;
    const labelMap: Record<string, string> = { all: '全部', holding: '持仓中', profit: '已盈利', loss: '已止损' };
    this.setData({
      showExportModal: true,
      exportScope: filterStatus === 'all' ? 'all' : 'filtered',
      exportFilterLabel: labelMap[filterStatus] || '全部',
    });
    this.toggleTabBar(true);
  },
  onHideExportModal() {
    this.setData({ showExportModal: false });
    this.toggleTabBar(false);
  },
  onExportScopeChange(e: any) {
    this.setData({ exportScope: e.currentTarget.dataset.scope });
  },

  // 获取待导出的记录列表
  getExportRecords(): TradeRecord[] {
    const { records, exportScope, filterStatus } = this.data;
    if (exportScope === 'filtered' && filterStatus !== 'all') {
      return records.filter((r: TradeRecord) => r.status === filterStatus);
    }
    return records;
  },

  onExport(e: any) {
    const format = e.currentTarget.dataset.format;
    const list = this.getExportRecords();
    if (list.length === 0) {
      wx.showToast({ title: '暂无记录可导出', icon: 'none' }); return;
    }
    if (format === 'csv') {
      this.exportCSV(list);
    } else if (format === 'md') {
      this.exportMarkdown(list);
    } else if (format === 'pdf') {
      this.exportImage(list);
    }
  },

  // 导出 CSV
  exportCSV(list: TradeRecord[]) {
    const headers = ['时间', '币种', '方向', '入场价', '止损价', '止盈价', '下单量', '杠杆', '状态', '平仓价', '实际盈亏(USD)', '入场逻辑'];
    const rows = list.map(r => [
      r.time,
      r.coin,
      r.direction === 'long' ? '做多' : '做空',
      r.entryPrice,
      r.stopLossPrice,
      r.takeProfitPrice || '',
      r.orderQty,
      r.leverage + 'x',
      r.status === 'holding' ? '持仓中' : (r.status === 'profit' ? '已盈利' : '已止损'),
      r.closePrice || '',
      r.status !== 'holding' ? r.realPnl : '',
      (r.note || '').replace(/,/g, '，').replace(/\n/g, ' '),
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    this.saveTextFile(csvContent, 'trade_records.csv', 'CSV 表格');
  },

  // 导出 Markdown
  exportMarkdown(list: TradeRecord[]) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const closed = list.filter(r => r.status !== 'holding');
    const profit = list.filter(r => r.status === 'profit').length;
    const totalPnl = closed.reduce((s, r) => s + parseFloat(r.realPnl || '0'), 0);
    const winRate = closed.length > 0 ? ((profit / closed.length) * 100).toFixed(1) : '0.0';

    let md = `# 📊 开仓记录导出\n\n`;
    md += `> 导出时间：${dateStr}　共 ${list.length} 条记录\n\n`;
    md += `## 统计概览\n\n`;
    md += `| 指标 | 数值 |\n|:--|:--|\n`;
    md += `| 总笔数 | ${list.length} |\n`;
    md += `| 持仓中 | ${list.filter(r => r.status === 'holding').length} |\n`;
    md += `| 已盈利 | ${profit} |\n`;
    md += `| 已止损 | ${list.filter(r => r.status === 'loss').length} |\n`;
    md += `| 胜率 | ${winRate}% |\n`;
    md += `| 累计盈亏 | ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USD |\n\n`;
    md += `## 交易记录\n\n`;

    list.forEach((r, i) => {
      const dir = r.direction === 'long' ? '▲ 做多' : '▼ 做空';
      const status = r.status === 'holding' ? '🟡 持仓中' : (r.status === 'profit' ? '🟢 已盈利' : '🔴 已止损');
      const pnl = r.status !== 'holding' ? `${parseFloat(r.realPnl) >= 0 ? '+' : ''}${r.realPnl} USD` : '-';
      md += `### ${i + 1}. ${r.coin} ${dir} · ${r.time}\n\n`;
      if (r.note) md += `> 💡 **入场逻辑**：${r.note}\n\n`;
      md += `| 字段 | 数值 |\n|:--|:--|\n`;
      md += `| 状态 | ${status} |\n`;
      md += `| 入场价 | ${r.entryPrice} USD |\n`;
      md += `| 止损价 | ${r.stopLossPrice} USD |\n`;
      if (r.takeProfitPrice) md += `| 止盈价 | ${r.takeProfitPrice} USD |\n`;
      md += `| 下单量 | ${r.orderQty} ${r.coin} |\n`;
      md += `| 杠杆 | ${r.leverage}x |\n`;
      if (r.status !== 'holding') {
        md += `| 平仓价 | ${r.closePrice} USD |\n`;
        md += `| 实际盈亏 | ${pnl} |\n`;
      }
      md += `\n`;
    });

    this.saveTextFile(md, 'trade_records.md', 'Markdown 文档');
  },

  // 保存文本文件并分享
  saveTextFile(content: string, filename: string, label: string) {
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${filename}`;
    fs.writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => {
        wx.hideLoading();
        this.setData({ showExportModal: false });
        this.toggleTabBar(false);
        wx.showModal({
          title: `${label}已生成`,
          content: '点击"分享"可发送给好友或保存到文件管理器',
          confirmText: '分享文件',
          cancelText: '关闭',
          success: (res) => {
            if (res.confirm) {
              (wx as any).shareFileMessage({
                filePath,
                success: () => wx.showToast({ title: '分享成功', icon: 'success' }),
                fail: () => {
                  // 部分机型不支持 shareFileMessage，降级提示
                  wx.showToast({ title: '请在文件管理中查看', icon: 'none' });
                },
              });
            }
          },
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '导出失败：' + (err.errMsg || ''), icon: 'none' });
      },
    });
    wx.showLoading({ title: '生成中...' });
  },

  // 导出图片（Canvas 截图保存到相册）
  exportImage(list: TradeRecord[]) {
    const sysInfo = wx.getSystemInfoSync();
    const dpr = sysInfo.pixelRatio || 2;
    const canvasW = Math.floor(sysInfo.windowWidth);
    const lineH = 44;
    const paddingX = 24;
    const headerH = 120;
    const rowH = lineH;
    const statsH = 160;
    // 每条记录大约占 6 行
    const totalH = headerH + statsH + list.length * rowH * 7 + 60;
    const canvasH = Math.min(totalH, 4000); // 限制最大高度

    this.setData({ exportCanvasW: canvasW, exportCanvasH: canvasH });

    setTimeout(() => {
      const ctx = wx.createCanvasContext('exportCanvas', this);
      const w = canvasW;
      // 背景
      ctx.setFillStyle('#0d1117');
      ctx.fillRect(0, 0, w, canvasH);

      // 标题
      ctx.setFillStyle('#ffffff');
      ctx.setFontSize(20);
      ctx.setTextAlign('center');
      ctx.fillText('📊 开仓记录', w / 2, 50);
      ctx.setFontSize(13);
      ctx.setFillStyle('#888');
      const now = new Date();
      ctx.fillText(`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} · ${list.length} 条记录`, w / 2, 78);

      // 统计行
      const closed = list.filter(r => r.status !== 'holding');
      const profit = list.filter(r => r.status === 'profit').length;
      const totalPnl = closed.reduce((s, r) => s + parseFloat(r.realPnl || '0'), 0);
      const winRate = closed.length > 0 ? ((profit / closed.length) * 100).toFixed(1) : '0.0';
      ctx.setFillStyle('#1a2035');
      ctx.fillRect(paddingX, 96, w - paddingX * 2, 52);
      ctx.setFontSize(12);
      ctx.setTextAlign('left');
      const stats = [`总笔数 ${list.length}`, `胜率 ${winRate}%`, `盈亏 ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`];
      stats.forEach((s, i) => {
        ctx.setFillStyle(i === 2 ? (totalPnl >= 0 ? '#52c41a' : '#ff4d4f') : '#aaa');
        ctx.fillText(s, paddingX + 16 + i * (w / 3), 128);
      });

      // 记录列表
      let y = 168;
      list.forEach((r) => {
        if (y + rowH * 6 > canvasH - 20) return; // 超出画布则跳过
        // 卡片背景
        ctx.setFillStyle('#161b27');
        ctx.fillRect(paddingX, y, w - paddingX * 2, rowH * 6 + 16);
        // 方向标签
        ctx.setFillStyle(r.direction === 'long' ? '#0d2e1a' : '#2e0d0d');
        ctx.fillRect(paddingX + 8, y + 8, 60, 26);
        ctx.setFontSize(11);
        ctx.setFillStyle(r.direction === 'long' ? '#52c41a' : '#ff4d4f');
        ctx.setTextAlign('center');
        ctx.fillText(r.direction === 'long' ? '▲ 多' : '▼ 空', paddingX + 38, y + 26);
        // 币种 + 时间
        ctx.setFillStyle('#fff');
        ctx.setFontSize(14);
        ctx.setTextAlign('left');
        ctx.fillText(`${r.coin} · ${r.leverage}x`, paddingX + 80, y + 26);
        ctx.setFillStyle('#666');
        ctx.setFontSize(11);
        ctx.fillText(r.time, w - paddingX - 80, y + 26);
        // 分割线
        ctx.setStrokeStyle('#2a2d3e');
        ctx.setLineWidth(1);
        ctx.beginPath();
        ctx.moveTo(paddingX + 8, y + 40);
        ctx.lineTo(w - paddingX - 8, y + 40);
        ctx.stroke();
        // 数据行
        const fields = [
          ['入场价', r.entryPrice + ' USD'],
          ['止损价', r.stopLossPrice + ' USD'],
          ['下单量', r.orderQty + ' ' + r.coin],
          ['状态', r.status === 'holding' ? '持仓中' : (r.status === 'profit' ? '已盈利' : '已止损')],
          ['盈亏', r.status !== 'holding' ? (parseFloat(r.realPnl) >= 0 ? '+' : '') + r.realPnl + ' USD' : '-'],
        ];
        fields.forEach((f, fi) => {
          const fy = y + 52 + fi * rowH;
          ctx.setFillStyle('#888');
          ctx.setFontSize(11);
          ctx.setTextAlign('left');
          ctx.fillText(f[0], paddingX + 16, fy);
          const valColor = f[0] === '盈亏' ? (parseFloat(r.realPnl) >= 0 ? '#52c41a' : '#ff4d4f') : '#e0e0e0';
          ctx.setFillStyle(valColor);
          ctx.setFontSize(12);
          ctx.setTextAlign('right');
          ctx.fillText(f[1], w - paddingX - 16, fy);
        });
        y += rowH * 6 + 24;
      });

      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'exportCanvas',
          x: 0, y: 0, width: canvasW, height: Math.min(y + 20, canvasH),
          destWidth: canvasW * dpr,
          destHeight: Math.min(y + 20, canvasH) * dpr,
          success: (res) => {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                this.setData({ showExportModal: false });
                this.toggleTabBar(false);
                wx.showToast({ title: '已保存到相册', icon: 'success' });
              },
              fail: (err) => {
                if (err.errMsg && err.errMsg.includes('auth')) {
                  wx.showModal({
                    title: '需要相册权限',
                    content: '请在设置中允许访问相册',
                    confirmText: '去设置',
                    success: (r) => { if (r.confirm) wx.openSetting({}); },
                  });
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' });
                }
              },
            });
          },
          fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' }),
        }, this);
      });
    }, 100);
  },

});
