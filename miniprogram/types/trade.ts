// 共享类型定义
export interface TradeRecord {
  id: number;
  time: string;
  coin: string;
  principal: string;
  entryPrice: string;
  stopLossPrice: string;
  takeProfitPrice: string;
  riskPercent: number;
  leverage: number;
  direction: string;     // 'long' | 'short'
  orderQty: string;
  orderValue: string;
  margin: string;
  maxLoss: string;
  stopLossRange: string;
  requiredLeverage: string;
  status: string;        // 'holding' | 'profit' | 'loss'
  closePrice: string;
  realPnl: string;
  note?: string;         // 备注（可选）
}

export const STORAGE_KEY = 'trade_records_v2';

export function getRecords(): TradeRecord[] {
  try {
    return wx.getStorageSync(STORAGE_KEY) || [];
  } catch (e) {
    return [];
  }
}

export function saveRecords(records: TradeRecord[]): void {
  try {
    wx.setStorageSync(STORAGE_KEY, records);
  } catch (e) {}
}
