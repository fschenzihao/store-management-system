export type BusinessErrorCode =
  | 'BALANCE_CHANGED'
  | 'BALANCE_OVERFLOW'
  | 'CATEGORY_HAS_CONSUMPTIONS'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_OFF_SHELF'
  | 'CUSTOMER_ACCOUNT_NOT_FOUND'
  | 'CUSTOMER_HAS_RELATED_DATA'
  | 'CUSTOMER_NOT_FOUND'
  | 'DUPLICATE_CATEGORY_NAME'
  | 'DUPLICATE_CUSTOMER_PHONE'
  | 'DUPLICATE_WECHAT_ID'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_INPUT'
  | 'INVALID_REFERENCE';

/** 可由后续接口层转换为明确响应的业务错误。 */
export class BusinessError extends Error {
  readonly code: BusinessErrorCode;

  constructor(code: BusinessErrorCode, message: string) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
  }
}

/** 生成数据库统一使用的 UTC 文本时间：YYYY-MM-DD HH:MM:SS。 */
export function getUtcTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function hasSqliteCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export function isForeignKeyError(error: unknown): boolean {
  return hasSqliteCode(error, 'SQLITE_CONSTRAINT_FOREIGNKEY');
}

export function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BusinessError(
      'INVALID_INPUT',
      `${fieldName}必须是大于 0 的安全整数`,
    );
  }
}

export function assertNonNegativeInteger(
  value: number,
  fieldName: string,
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BusinessError(
      'INVALID_INPUT',
      `${fieldName}必须是大于或等于 0 的安全整数`,
    );
  }
}

export function normalizeRequiredText(
  value: string,
  fieldName: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new BusinessError('INVALID_INPUT', `${fieldName}必须是文本`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BusinessError(
      'INVALID_INPUT',
      `${fieldName}不能为空且长度不能超过 ${maxLength} 个字符`,
    );
  }
  return normalized;
}

export function normalizeOptionalText(
  value: null | string | undefined,
  fieldName: string,
  maxLength: number,
): null | string {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BusinessError('INVALID_INPUT', `${fieldName}必须是文本`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BusinessError(
      'INVALID_INPUT',
      `${fieldName}长度不能超过 ${maxLength} 个字符`,
    );
  }
  return normalized || null;
}
