<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type {
  CategoryConsumptionStatistic,
  ConsumptionRecord,
  CraftCategory,
  Customer,
} from '#/api/store';

import { onMounted, reactive, ref } from 'vue';

import {
  ElButton,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  CATEGORY_STATUS_ON,
  createConsumptionApi,
  getCategoryListApi,
  getCategoryStatisticsApi,
  getConsumptionListApi,
  getCustomerAccountApi,
} from '#/api/store';

import CustomerSelect from '../components/customer-select.vue';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  formatCents,
  MAX_OPTIONS,
  PAGE_SIZES,
  yuanToCents,
} from '../shared';

defineOptions({ name: 'StoreConsumption' });

interface ConsumptionForm {
  /** 页面输入单位为元，提交前换算为整数分。 */
  amountYuan: number | undefined;
  categoryId: number | undefined;
  customerId: number | undefined;
  durationMinutes: number | undefined;
  /** 是否全天：1=全天、0=否，未拨动过提交为 null。 */
  isFullDay: 0 | 1 | undefined;
  /** 可选桌号，提交前归一为 null 表示未指定。 */
  tableNumber: number | undefined;
}

interface ConsumptionFilter {
  categoryId: number | undefined;
  customerId: number | undefined;
}

const dialogVisible = ref(false);
const form = reactive<ConsumptionForm>({
  amountYuan: undefined,
  categoryId: undefined,
  customerId: undefined,
  durationMinutes: undefined,
  isFullDay: undefined,
  tableNumber: undefined,
});
const formRef = ref<FormInstance>();
const rules: FormRules = {
  amountYuan: [
    { message: '请输入消费金额', required: true, trigger: 'blur' },
    {
      trigger: 'blur',
      validator: (_rule, value: number, callback) => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          callback(new Error('消费金额不能小于 0 元'));
        } else if (Number.isSafeInteger(Math.round(value * 100))) {
          callback();
        } else {
          callback(new Error('消费金额超出可处理范围'));
        }
      },
    },
  ],
  categoryId: [
    { message: '请选择手工品类', required: true, trigger: 'change' },
  ],
  customerId: [{ message: '请选择客户', required: true, trigger: 'change' }],
  durationMinutes: [
    { message: '请选择消费时长', required: true, trigger: 'change' },
    {
      trigger: 'change',
      validator: (_rule, value: number, callback) => {
        if (!Number.isSafeInteger(value) || value < 0) {
          callback(new Error('消费时长必须为大于或等于 0 的整数分钟'));
        } else {
          callback();
        }
      },
    },
  ],
};

/** 弹窗表单可用品类：仅上架品类。 */
const categories = ref<CraftCategory[]>([]);
/** 桌号候选项：固定 1 ~ 18，下拉支持手工输入过滤匹配。 */
const TABLE_NUMBER_OPTIONS = Array.from(
  { length: 18 },
  (_, index) => index + 1,
);
/** 时长快捷选项：值为分钟数。 */
const DURATION_OPTIONS = [
  { label: '1小时', value: 60 },
  { label: '2小时', value: 120 },
  { label: '3小时', value: 180 },
];
/** 过滤下拉可用品类：全量品类，历史记录可能关联已下架品类。 */
const filterCategories = ref<CraftCategory[]>([]);
const filterForm = reactive<ConsumptionFilter>({
  categoryId: undefined,
  customerId: undefined,
});
const accountBalanceCents = ref<null | number>(null);
const accountName = ref('');
const records = ref<ConsumptionRecord[]>([]);
const total = ref(0);
const page = ref(DEFAULT_PAGE);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const recordsLoading = ref(false);
const statistics = ref<CategoryConsumptionStatistic[]>([]);
const statisticsLoading = ref(false);
const submitting = ref(false);

async function loadCategories() {
  try {
    const result = await getCategoryListApi({
      page: DEFAULT_PAGE,
      pageSize: MAX_OPTIONS,
      // 下架品类不可用于新增消费，弹窗内仅展示上架品类
      status: CATEGORY_STATUS_ON,
    });
    categories.value = result.items;
  } catch {
    categories.value = [];
  }
}

async function loadFilterCategories() {
  try {
    const result = await getCategoryListApi({
      page: DEFAULT_PAGE,
      pageSize: MAX_OPTIONS,
    });
    filterCategories.value = result.items;
  } catch {
    filterCategories.value = [];
  }
}

async function loadStatistics() {
  statisticsLoading.value = true;
  try {
    statistics.value = await getCategoryStatisticsApi();
  } catch {
    statistics.value = [];
  } finally {
    statisticsLoading.value = false;
  }
}

async function loadAccount(customerId: number | undefined) {
  if (!customerId) {
    accountBalanceCents.value = null;
    return;
  }
  try {
    const account = await getCustomerAccountApi(customerId);
    accountBalanceCents.value = account.balanceCents;
    accountName.value = account.customerName;
  } catch {
    accountBalanceCents.value = null;
  }
}

async function loadRecords() {
  recordsLoading.value = true;
  try {
    const result = await getConsumptionListApi({
      categoryId: filterForm.categoryId,
      customerId: filterForm.customerId,
      page: page.value,
      pageSize: pageSize.value,
    });
    records.value = result.items;
    total.value = result.total;
  } catch {
    records.value = [];
    total.value = 0;
  } finally {
    recordsLoading.value = false;
  }
}

function handleCustomerChange(_customer: Customer | undefined) {
  loadAccount(form.customerId);
}

/** 手工输入的时长为字符串值，仅接受非负整数分钟并归一为数字。 */
function handleDurationChange(value: number | string | undefined) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    form.durationMinutes = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  }
}

/** 开启全天时时长自动置 0 并禁用；关闭后恢复可编辑，需重新选择。 */
function handleAllDayChange(value: boolean | number | string) {
  form.isFullDay = value === 1 ? 1 : 0;
  form.durationMinutes = value === 1 ? 0 : undefined;
  if (value !== 1) {
    formRef.value?.clearValidate('durationMinutes');
  }
}

function openCreateDialog() {
  form.amountYuan = undefined;
  form.categoryId = undefined;
  form.customerId = undefined;
  form.durationMinutes = undefined;
  form.isFullDay = undefined;
  form.tableNumber = undefined;
  accountBalanceCents.value = null;
  accountName.value = '';
  formRef.value?.clearValidate();
  loadCategories();
  dialogVisible.value = true;
}

function handleFilterSearch() {
  page.value = DEFAULT_PAGE;
  loadRecords();
}

function handleFilterReset() {
  filterForm.categoryId = undefined;
  filterForm.customerId = undefined;
  page.value = DEFAULT_PAGE;
  loadRecords();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = DEFAULT_PAGE;
  loadRecords();
}

function handleCurrentChange(value: number) {
  page.value = value;
  loadRecords();
}

async function submitConsumption() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const {
    amountYuan,
    categoryId,
    customerId,
    durationMinutes,
    isFullDay,
    tableNumber,
  } = form;
  if (
    amountYuan === undefined ||
    categoryId === undefined ||
    customerId === undefined ||
    durationMinutes === undefined
  ) {
    return;
  }
  submitting.value = true;
  try {
    const result = await createConsumptionApi({
      categoryId,
      consumptionAmountCents: yuanToCents(amountYuan),
      customerId,
      durationMinutes,
      isFullDay: isFullDay === 1 ? 1 : null,
      tableNumber: tableNumber ?? null,
    });
    // 契约：最新余额必须取自事务响应，前端不得自行扣减
    ElMessage.success(
      `消费登记成功，${result.account.customerName} 当前余额 ${formatCents(result.account.balanceCents)}`,
    );
    dialogVisible.value = false;
    page.value = DEFAULT_PAGE;
    await Promise.all([loadRecords(), loadStatistics()]);
  } catch {
    // 余额不足等业务错误统一提示，保留表单内容且不刷新出乐观数据
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadFilterCategories();
  loadRecords();
  loadStatistics();
});
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">消费记录</span>
          <ElButton type="primary" @click="openCreateDialog">
            新增消费
          </ElButton>
        </div>
      </template>

      <ElForm inline :model="filterForm">
        <ElFormItem label="客户" style="width: 280px">
          <CustomerSelect
            v-model="filterForm.customerId"
            placeholder="输入客户名模糊查询或选择已有客户"
          />
        </ElFormItem>
        <ElFormItem label="手工品类" style="width: 200px">
          <ElSelect
            v-model="filterForm.categoryId"
            clearable
            placeholder="请选择品类"
          >
            <ElOption
              v-for="item in filterCategories"
              :key="item.categoryId"
              :label="item.categoryName"
              :value="item.categoryId"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <ElButton
            :loading="recordsLoading"
            type="primary"
            @click="handleFilterSearch"
          >
            查询
          </ElButton>
          <ElButton @click="handleFilterReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <ElTable v-loading="recordsLoading" :data="records" border stripe>
        <ElTableColumn label="流水 ID" prop="consumptionId" width="100" />
        <ElTableColumn label="客户" prop="customerName" min-width="120" />
        <ElTableColumn label="手工品类" prop="categoryName" min-width="120" />
        <ElTableColumn label="消费金额" min-width="140">
          <template #default="{ row }">
            {{ formatCents(row.consumptionAmountCents) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="时长（分钟）"
          prop="durationMinutes"
          min-width="130"
        />
        <ElTableColumn label="全天" min-width="80">
          <template #default="{ row }">
            {{ row.isFullDay === 1 ? '是' : row.isFullDay === 0 ? '否' : '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="桌号" min-width="90">
          <template #default="{ row }">
            {{ row.tableNumber ?? '—' }}
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="mt-4 flex justify-end">
        <ElPagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="PAGE_SIZES"
          :total="total"
          background
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </ElCard>

    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">按品类统计消费</span>
          <ElButton @click="loadStatistics">刷新统计</ElButton>
        </div>
      </template>
      <ElTable v-loading="statisticsLoading" :data="statistics" border stripe>
        <ElTableColumn label="品类 ID" prop="categoryId" width="100" />
        <ElTableColumn label="手工品类" prop="categoryName" min-width="140" />
        <ElTableColumn
          label="消费次数"
          prop="consumptionCount"
          min-width="120"
        />
        <ElTableColumn label="消费总额" min-width="150">
          <template #default="{ row }">
            {{ formatCents(row.totalConsumptionAmountCents) }}
          </template>
        </ElTableColumn>
        <ElTableColumn
          label="总时长（分钟）"
          prop="totalDurationMinutes"
          min-width="150"
        />
      </ElTable>
    </ElCard>

    <ElDialog v-model="dialogVisible" title="新增消费" width="50%">
      <div
        class="mb-4 rounded-md bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800"
      >
        <template v-if="accountBalanceCents !== null">
          {{ accountName }} 当前账户余额：
          <span class="text-base font-semibold text-green-600">
            {{ formatCents(accountBalanceCents) }}
          </span>
          <span class="ml-2 text-gray-500">余额不足时服务端会拒绝本次消费</span>
        </template>
        <template v-else>请选择客户，以查看其账户余额。</template>
      </div>

      <ElForm ref="formRef" :model="form" :rules="rules" label-width="auto">
        <ElFormItem label="桌号" prop="tableNumber">
          <ElSelect
            v-model="form.tableNumber"
            clearable
            filterable
            placeholder="请选择或输入桌号"
          >
            <ElOption
              v-for="item in TABLE_NUMBER_OPTIONS"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="客户" prop="customerId">
          <CustomerSelect
            v-model="form.customerId"
            @change="handleCustomerChange"
          />
        </ElFormItem>
        <ElFormItem label="手工品类" prop="categoryId">
          <ElSelect
            v-model="form.categoryId"
            clearable
            placeholder="请选择品类"
            style="width: 100%"
          >
            <ElOption
              v-for="item in categories"
              :key="item.categoryId"
              :label="item.categoryName"
              :value="item.categoryId"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="时长（分钟）" prop="durationMinutes">
          <ElSelect
            v-model="form.durationMinutes"
            :disabled="form.isFullDay === 1"
            allow-create
            clearable
            default-first-option
            filterable
            placeholder="选择快捷时长或输入分钟数"
            @change="handleDurationChange"
          >
            <ElOption
              v-for="item in DURATION_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="是否全天" prop="isFullDay">
          <ElSwitch
            v-model="form.isFullDay"
            :active-value="1"
            :inactive-value="0"
            @change="handleAllDayChange"
          />
        </ElFormItem>
        <ElFormItem label="消费金额（元）" prop="amountYuan">
          <ElInputNumber
            v-model="form.amountYuan"
            :controls="false"
            :min="0"
            :precision="2"
            :step="1"
            style="width: 100%"
          />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton
          :loading="submitting"
          type="primary"
          @click="submitConsumption"
        >
          确认消费
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>
