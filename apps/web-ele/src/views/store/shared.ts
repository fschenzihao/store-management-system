/**
 * 门店业务页面展示层公共工具。
 *
 * 金额在接口契约中统一为「整数分」（xxxCents），本文件只在表单输入与页面展示时
 * 换算为元，请求体始终提交整数分，不新增以元为单位的 API 字段。
 */

/** 展示：整数分 → ¥ xx.xx */
export function formatCents(cents: number): string {
  return `¥ ${(cents / 100).toFixed(2)}`;
}

/** 表单输入（元，最多两位小数）→ 请求字段（整数分） */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 服务端 UTC 文本（YYYY-MM-DD HH:MM:SS）→ 本地时区展示文本 */
export function formatUtcDateTime(value: string): string {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number) => `${part}`.padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}

/** 可空文本的统一占位展示 */
export function displayText(value: null | string | undefined): string {
  return value || '-';
}

/** 分页默认值与可选项，pageSize 上限与接口契约的 1 ~ 100 一致 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZES = [10, 20, 50, 100];

/** 客户、品类下拉一次加载的最大条数（契约 pageSize 上限） */
export const MAX_OPTIONS = 100;
