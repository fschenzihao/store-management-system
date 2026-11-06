import type { SeatLayout } from './layout';

import type { TableBoardItem } from '#/api/store';

/** 座位看板状态：空闲、使用中、即将结束、已超时。 */
export type SeatState = 'active' | 'ending' | 'free' | 'overtime';

/** 单个座位的渲染数据，由页面统一计算后传给场景与座位组件。 */
export interface SeatBoardView {
  item: TableBoardItem;
  layout: SeatLayout;
  /** 剩余时长占购买时长的比例，0~1 */
  progress: number;
  remainingMs: number;
  state: SeatState;
  timeText: string;
}
