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
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createConsumptionApi,
  getCategoryListApi,
  getCategoryStatisticsApi,
  getCustomerAccountApi,
  getCustomerConsumptionListApi,
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
}

const form = reactive<ConsumptionForm>({
  amountYuan: undefined,
  categoryId: undefined,
  customerId: undefined,
  durationMinutes: undefined,
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
    { message: '请输入消费时长', required: true, trigger: 'blur' },
    {
      trigger: 'blur',
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

const categories = ref<CraftCategory[]>([]);
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
    });
    categories.value = result.items;
  } catch {
    categories.value = [];
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

async function loadRecords(customerId: number | undefined) {
  if (!customerId) {
    records.value = [];
    total.value = 0;
    return;
  }
  recordsLoading.value = true;
  try {
    const result = await getCustomerConsumptionListApi(customerId, {
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

function handleCustomerChange(customer: Customer | undefined) {
  page.value = DEFAULT_PAGE;
  accountName.value = customer?.customerName ?? '';
  loadAccount(form.customerId);
  loadRecords(form.customerId);
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = DEFAULT_PAGE;
  loadRecords(form.customerId);
}

function handleCurrentChange(value: number) {
  page.value = value;
  loadRecords(form.customerId);
}

async function submitConsumption() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const { amountYuan, categoryId, customerId, durationMinutes } = form;
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
    });
    // 契约：最新余额必须取自事务响应，前端不得自行扣减
    accountBalanceCents.value = result.account.balanceCents;
    accountName.value = result.account.customerName;
    ElMessage.success(
      `消费登记成功，${result.account.customerName} 当前余额 ${formatCents(result.account.balanceCents)}`,
    );
    form.amountYuan = undefined;
    form.durationMinutes = undefined;
    formRef.value?.clearValidate(['amountYuan', 'durationMinutes']);
    page.value = DEFAULT_PAGE;
    await Promise.all([loadRecords(customerId), loadStatistics()]);
  } catch {
    // 余额不足等业务错误统一提示，保留表单内容且不刷新出乐观数据
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadCategories();
  loadStatistics();
});
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <span class="text-base font-semibold">新增消费</span>
      </template>

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

      <ElForm ref="formRef" inline :model="form" :rules="rules">
        <ElFormItem label="客户" prop="customerId" style="width: 280px">
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
            style="width: 170px"
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
          <ElInputNumber
            v-model="form.durationMinutes"
            :controls="false"
            :min="0"
            :precision="0"
            :step="1"
            style="width: 140px"
          />
        </ElFormItem>
        <ElFormItem label="消费金额（元）" prop="amountYuan">
          <ElInputNumber
            v-model="form.amountYuan"
            :controls="false"
            :min="0"
            :precision="2"
            :step="1"
            style="width: 160px"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton
            :loading="submitting"
            type="primary"
            @click="submitConsumption"
          >
            确认消费
          </ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">消费记录</span>
          <span class="text-sm text-gray-500">
            {{
              form.customerId
                ? `客户：${accountName || '已选择'}`
                : '请先选择客户'
            }}
          </span>
        </div>
      </template>

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
  </div>
</template>
