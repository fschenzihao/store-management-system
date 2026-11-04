/** 充值平台，与接口契约保持一致。 */
export type RechargePlatform = '微信' | '支付宝' | '现金';

/** 分页响应，total 为过滤后的总记录数。 */
export interface PageResult<T> {
  items: T[];
  total: number;
}

/** 分页查询参数。 */
export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** 品类状态数字枚举：1=上架、2=下架，与数据库 CHECK 约束保持一致。 */
export const CATEGORY_STATUS_OFF = 2;
export const CATEGORY_STATUS_ON = 1;

export type CraftCategoryStatus =
  | typeof CATEGORY_STATUS_OFF
  | typeof CATEGORY_STATUS_ON;

/** 品类状态展示映射：label 集中定义，后续接入 i18n 时仅需替换此处。 */
export const CATEGORY_STATUS_META: Record<
  CraftCategoryStatus,
  { label: string; tag: 'danger' | 'info' | 'primary' | 'success' | 'warning' }
> = {
  [CATEGORY_STATUS_ON]: { label: '上架', tag: 'success' },
  [CATEGORY_STATUS_OFF]: { label: '下架', tag: 'info' },
};

/** 手工品类。 */
export interface CraftCategory {
  categoryId: number;
  categoryName: string;
  createTime: string;
  remark: null | string;
  status: CraftCategoryStatus;
  updateTime: string;
}

/** 客户账户，customerName 由服务端关联补齐。 */
export interface CustomerAccount {
  balanceCents: number;
  customerId: number;
  customerName: string;
}

/** 客户。 */
export interface Customer {
  createTime: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  remark: null | string;
  updateTime: string;
  wechatId: null | string;
  wechatName: null | string;
}

/** 客户详情，含账户信息。 */
export interface CustomerDetailResult {
  account: CustomerAccount;
  customer: Customer;
}

/** 充值记录。 */
export interface RechargeRecord {
  amountCents: number;
  customerId: number;
  customerName: string;
  platform: RechargePlatform;
  rechargeId: number;
  rechargeTime: string;
}

/** 新增充值结果，余额为事务提交后的最新值。 */
export interface RechargeTransactionResult {
  account: CustomerAccount;
  rechargeRecord: RechargeRecord;
}

/** 消费记录。 */
export interface ConsumptionRecord {
  categoryId: number;
  categoryName: string;
  consumptionAmountCents: number;
  consumptionId: number;
  customerId: number;
  customerName: string;
  durationMinutes: number;
}

/** 新增消费结果，余额为事务提交后的最新值。 */
export interface ConsumptionTransactionResult {
  account: CustomerAccount;
  consumptionRecord: ConsumptionRecord;
}

/** 按品类统计消费。 */
export interface CategoryConsumptionStatistic {
  categoryId: number;
  categoryName: string;
  consumptionCount: number;
  totalConsumptionAmountCents: number;
  totalDurationMinutes: number;
}

/** 品类列表查询参数。 */
export interface CategoryListParams extends PageParams {
  categoryName?: string;
  status?: CraftCategoryStatus;
}

/** 新增品类参数；status 缺省时服务端默认上架。 */
export interface CreateCategoryParams {
  categoryName: string;
  remark?: null | string;
  status?: CraftCategoryStatus;
}

/** 修改品类参数；remark 传 null 或空字符串表示清空备注。 */
export interface UpdateCategoryParams {
  categoryName: string;
  remark?: null | string;
  status?: CraftCategoryStatus;
}

/** 客户列表查询参数。 */
export interface CustomerListParams extends PageParams {
  customerName?: string;
  customerPhone?: string;
}

/** 新增客户参数；可选字段省略或传 null 均保存为 null。 */
export interface CreateCustomerParams {
  customerName: string;
  customerPhone: string;
  remark?: null | string;
  wechatId?: null | string;
  wechatName?: null | string;
}

/** 修改客户参数；字段省略表示保持不变，传 null 或空字符串表示清空可选字段。 */
export interface UpdateCustomerParams {
  customerName?: string;
  customerPhone?: string;
  remark?: null | string;
  wechatId?: null | string;
  wechatName?: null | string;
}

/** 新增充值参数。 */
export interface CreateRechargeParams {
  amountCents: number;
  customerId: number;
  platform: RechargePlatform;
}

/** 新增消费参数。 */
export interface CreateConsumptionParams {
  categoryId: number;
  consumptionAmountCents: number;
  customerId: number;
  durationMinutes: number;
}
