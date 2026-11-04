import type BetterSqlite3 from 'better-sqlite3';
import type { EventHandlerRequest, H3Event } from 'h3';
import type { Customer } from '~/db/dal/customer.ts';

import {
  eventHandler,
  getQuery,
  getRouterParam,
  readBody,
  setResponseStatus,
} from 'h3';
import { getCraftCategory } from '~/db/dal/craft-category.ts';
import { getCustomer } from '~/db/dal/customer.ts';
import { BusinessError } from '~/db/dal/shared.ts';
import { verifyAccessToken } from '~/utils/jwt-utils.ts';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response.ts';

/** 分页响应结构，total 为过滤后的总记录数。 */
export interface PageResult<T> {
  items: T[];
  total: number;
}

/**
 * 业务接口统一入口：认证、响应包装与错误转换。
 *
 * - 预期业务错误（BusinessError）：HTTP 200 + 顶层 `code: -1` + `error.code`
 * - 未知异常：HTTP 500 + `INTERNAL_ERROR`，不向前端暴露 SQL、数据库路径或错误堆栈
 */
export function defineStoreEventHandler<T>(
  handler: (event: H3Event<EventHandlerRequest>) => Promise<T> | T,
) {
  return eventHandler(async (event) => {
    const userinfo = verifyAccessToken(event);
    if (!userinfo) {
      return unAuthorizedResponse(event);
    }
    try {
      return useResponseSuccess(await handler(event));
    } catch (error) {
      if (error instanceof BusinessError) {
        return useResponseError(error.message, {
          code: error.code,
          message: error.message,
        });
      }
      console.error('[store-api] 未预期错误：', error);
      setResponseStatus(event, 500);
      return useResponseError('服务器内部错误，请稍后重试', {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误，请稍后重试',
      });
    }
  });
}

/** 读取去空格后的查询参数；未传或为空返回 undefined。 */
export function getQueryText(
  event: H3Event<EventHandlerRequest>,
  key: string,
): string | undefined {
  const raw = getQuery(event)[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function parsePageValue(
  raw: string | undefined,
  field: string,
  fallback: number,
  max?: number,
): number {
  if (raw === undefined) {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    throw new BusinessError('INVALID_INPUT', `${field} 必须为整数`);
  }
  const value = Number(raw);
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    (max !== undefined && value > max)
  ) {
    const range = max === undefined ? '大于或等于 1' : `1 ~ ${max}`;
    throw new BusinessError('INVALID_INPUT', `${field} 必须为 ${range} 的整数`);
  }
  return value;
}

/** 解析分页查询参数：page 默认 1，pageSize 默认 20 且范围为 1 ~ 100。 */
export function parsePaginationQuery(event: H3Event<EventHandlerRequest>): {
  page: number;
  pageSize: number;
} {
  return {
    page: parsePageValue(getQueryText(event, 'page'), 'page', 1),
    pageSize: parsePageValue(
      getQueryText(event, 'pageSize'),
      'pageSize',
      20,
      100,
    ),
  };
}

/** 读取大于 0 的整数路径参数，非法时返回 `INVALID_INPUT`。 */
export function getPositiveIntParam(
  event: H3Event<EventHandlerRequest>,
  name: string,
): number {
  const raw = getRouterParam(event, name);
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new BusinessError('INVALID_INPUT', `${name} 必须为大于 0 的整数`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BusinessError('INVALID_INPUT', `${name} 必须为大于 0 的整数`);
  }
  return value;
}

/** 读取 JSON 对象请求体，非对象或解析失败返回 `INVALID_INPUT`。 */
export async function readJsonBody(
  event: H3Event<EventHandlerRequest>,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    throw new BusinessError('INVALID_INPUT', '请求体必须是合法的 JSON 对象');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BusinessError('INVALID_INPUT', '请求体必须是 JSON 对象');
  }
  return body as Record<string, unknown>;
}

/** 读取必填文本字段。 */
export function requireStringField(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw new BusinessError('INVALID_INPUT', `${field} 必须为文本`);
  }
  return value;
}

/** 读取必填数字字段，数值范围校验由数据访问层与事务负责。 */
export function requireNumberField(
  body: Record<string, unknown>,
  field: string,
): number {
  const value = body[field];
  if (typeof value !== 'number') {
    throw new BusinessError('INVALID_INPUT', `${field} 必须为数字`);
  }
  return value;
}

/** 读取可选文本字段：undefined 表示未提供，null 表示清空。 */
export function optionalTextField(
  body: Record<string, unknown>,
  field: string,
): null | string | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'string') {
    throw new BusinessError('INVALID_INPUT', `${field} 必须为文本或 null`);
  }
  return value;
}

/** 读取可选数字字段：undefined 表示未提供，取值范围校验由数据访问层负责。 */
export function optionalNumberField(
  body: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = body[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number') {
    throw new BusinessError('INVALID_INPUT', `${field} 必须为数字`);
  }
  return value;
}

/** 对过滤后的完整列表做内存分页。 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PageResult<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
  };
}

/** 校验客户存在并返回客户信息。 */
export function requireCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
): Customer {
  const customer = getCustomer(database, customerId);
  if (!customer) {
    throw new BusinessError(
      'CUSTOMER_NOT_FOUND',
      `客户不存在（ID: ${customerId}）`,
    );
  }
  return customer;
}

/** 校验手工品类存在并返回品类名。 */
export function getCategoryName(
  database: BetterSqlite3.Database,
  categoryId: number,
): string {
  const category = getCraftCategory(database, categoryId);
  if (!category) {
    throw new BusinessError(
      'CATEGORY_NOT_FOUND',
      `手工品类不存在（ID: ${categoryId}）`,
    );
  }
  return category.categoryName;
}
