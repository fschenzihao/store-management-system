/**
 * 桌位看板的静态布局配置（俯视平面视角，参照门店 3D 设计图）。
 *
 * 后端只保存座位号 1~18，分区、展示名与坐标全部在这里推导：
 * 上排为 A/B/C 三组四人桌（每组 2×2 四座），下排左侧为吧台长桌 6 座；
 * 右侧为前台收银台、货架、冰箱与玻璃门等装饰。
 */

export const SCENE_WIDTH = 1260;
export const SCENE_HEIGHT = 580;

/** 桌面家具：上排三张四人桌 + 下排吧台长桌。 */
export interface TableProp {
  height: number;
  kind: 'bar' | 'island';
  label: string;
  width: number;
  x: number;
  y: number;
}

export const TABLE_PROPS: TableProp[] = [
  { height: 150, kind: 'island', label: 'A 桌', width: 180, x: 180, y: 150 },
  { height: 150, kind: 'island', label: 'B 桌', width: 180, x: 480, y: 150 },
  { height: 150, kind: 'island', label: 'C 桌', width: 180, x: 780, y: 150 },
  { height: 72, kind: 'bar', label: '吧台', width: 500, x: 385, y: 440 },
];

export interface SeatLayout {
  /** 徽标相对座位中心的偏移 */
  badge: { x: number; y: number };
  /** 拼豆架相对座位中心的偏移（俯视图放在桌面上） */
  board: { rotate: number; x: number; y: number };
  /** 椅子相对座位中心的偏移 */
  chair: { x: number; y: number };
  group: 'A' | 'B' | 'bar' | 'C';
  label: string;
  seatNo: number;
  x: number;
  y: number;
}

const ISLAND_GROUPS: {
  base: number;
  group: 'A' | 'B' | 'C';
  x: number;
  y: number;
}[] = [
  { base: 7, group: 'A', x: 180, y: 150 },
  { base: 11, group: 'B', x: 480, y: 150 },
  { base: 15, group: 'C', x: 780, y: 150 },
];

/** 四人桌的四个座位：左右两侧各两座，拼豆架摆上桌面，组成 2×2。 */
const ISLAND_SEAT_OFFSETS = [
  {
    badge: { x: 0, y: -54 },
    board: { rotate: 0, x: 55, y: 3 },
    chair: { x: 0, y: 0 },
    dx: -105,
    dy: -33,
  },
  {
    badge: { x: 0, y: 54 },
    board: { rotate: 0, x: 55, y: -3 },
    chair: { x: 0, y: 0 },
    dx: -105,
    dy: 33,
  },
  {
    badge: { x: 0, y: -54 },
    board: { rotate: 0, x: -55, y: 3 },
    chair: { x: 0, y: 0 },
    dx: 105,
    dy: -33,
  },
  {
    badge: { x: 0, y: 54 },
    board: { rotate: 0, x: -55, y: -3 },
    chair: { x: 0, y: 0 },
    dx: 105,
    dy: 33,
  },
];

/** 吧台 6 个座位沿长桌一字排开，椅子在桌后（上方），徽标放座位下方。 */
const BAR_SEATS: SeatLayout[] = [
  { x: 160, y: 440 },
  { x: 250, y: 440 },
  { x: 340, y: 440 },
  { x: 430, y: 440 },
  { x: 520, y: 440 },
  { x: 610, y: 440 },
].map((seat, index) => ({
  badge: { x: 0, y: 60 },
  board: { rotate: 0, x: 0, y: 0 },
  chair: { x: 0, y: -55 },
  group: 'bar' as const,
  label: `吧台 ${String(index + 1).padStart(2, '0')}`,
  seatNo: index + 1,
  x: seat.x,
  y: seat.y,
}));

const ISLAND_SEATS: SeatLayout[] = ISLAND_GROUPS.flatMap((table) =>
  ISLAND_SEAT_OFFSETS.map((offset, index) => ({
    badge: offset.badge,
    board: offset.board,
    chair: offset.chair,
    group: table.group,
    label: `${table.group} 桌 ${index + 1} 号位`,
    seatNo: table.base + index,
    x: table.x + offset.dx,
    y: table.y + offset.dy,
  })),
);

export const SEATS: SeatLayout[] = [...BAR_SEATS, ...ISLAND_SEATS];

const SEAT_LAYOUT_MAP = new Map(SEATS.map((seat) => [seat.seatNo, seat]));

/** 未知编号回退到自动网格，便于后续扩充座位。 */
export function getSeatLayout(seatNo: number): SeatLayout {
  const known = SEAT_LAYOUT_MAP.get(seatNo);
  if (known) {
    return known;
  }
  const index = Math.max(seatNo - 1, 0);
  return {
    badge: { x: 0, y: 52 },
    board: { rotate: 0, x: 0, y: 0 },
    chair: { x: 0, y: 0 },
    group: 'C',
    label: `${seatNo} 号位`,
    seatNo,
    x: 160 + (index % 9) * 120,
    y: 260 + Math.floor(index / 9) * 120,
  };
}

/** 开台时长的快捷选项，单位分钟。 */
export const DURATION_PRESETS = [60, 90, 120];

/** 续时时长的快捷选项，单位分钟。 */
export const EXTEND_PRESETS = [30, 60, 90];

/** 剩余时间进入「即将结束」的阈值。 */
export const ENDING_SOON_MS = 10 * 60 * 1000;

export const TOTAL_SEATS = 18;
