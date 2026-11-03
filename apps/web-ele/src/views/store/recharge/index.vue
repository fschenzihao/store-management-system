<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type { Customer, RechargePlatform, RechargeRecord } from '#/api/store';

import { reactive, ref } from 'vue';

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
  createRechargeApi,
  getCustomerAccountApi,
  getCustomerRechargeListApi,
} from '#/api/store';

import CustomerSelect from '../components/customer-select.vue';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  formatCents,
  formatUtcDateTime,
  PAGE_SIZES,
  yuanToCents,
} from '../shared';

defineOptions({ name: 'StoreRecharge' });

interface RechargeForm {
  /** 页面输入单位为元，提交前换算为整数分。 */
  amountYuan: number | undefined;
  customerId: number | undefined;
  platform: '' | RechargePlatform;
}

const PLATFORM_OPTIONS: RechargePlatform[] = ['微信', '支付宝', '现金'];

const form = reactive<RechargeForm>({
  amountYuan: undefined,
  customerId: undefined,
  platform: '',
});
const formRef = ref<FormInstance>();
const rules: FormRules = {
  amountYuan: [
    { message: '请输入充值金额', required: true, trigger: 'blur' },
    {
      trigger: 'blur',
      validator: (_rule, value: number, callback) => {
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value <= 0
        ) {
          callback(new Error('充值金额必须大于 0 元'));
        } else if (Number.isSafeInteger(Math.round(value * 100))) {
          callback();
        } else {
          callback(new Error('充值金额超出可处理范围'));
        }
      },
    },
  ],
  customerId: [{ message: '请选择客户', required: true, trigger: 'change' }],
  platform: [{ message: '请选择充值平台', required: true, trigger: 'change' }],
};

const accountBalanceCents = ref<null | number>(null);
const accountName = ref('');
const records = ref<RechargeRecord[]>([]);
const total = ref(0);
const page = ref(DEFAULT_PAGE);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const recordsLoading = ref(false);
const submitting = ref(false);

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
    const result = await getCustomerRechargeListApi(customerId, {
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

async function submitRecharge() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const { amountYuan, customerId, platform } = form;
  if (amountYuan === undefined || customerId === undefined || !platform) {
    return;
  }
  submitting.value = true;
  try {
    const result = await createRechargeApi({
      amountCents: yuanToCents(amountYuan),
      customerId,
      platform,
    });
    // 契约：最新余额必须取自事务响应，前端不得自行累加
    accountBalanceCents.value = result.account.balanceCents;
    accountName.value = result.account.customerName;
    ElMessage.success(
      `充值成功，${result.account.customerName} 当前余额 ${formatCents(result.account.balanceCents)}`,
    );
    form.amountYuan = undefined;
    formRef.value?.clearValidate('amountYuan');
    page.value = DEFAULT_PAGE;
    await loadRecords(customerId);
  } catch {
    // 错误提示由 request.ts 统一处理，保留表单内容供用户修改
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <span class="text-base font-semibold">新增充值</span>
      </template>

      <div
        class="mb-4 rounded-md bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800"
      >
        <template v-if="accountBalanceCents !== null">
          {{ accountName }} 当前账户余额：
          <span class="text-base font-semibold text-green-600">
            {{ formatCents(accountBalanceCents) }}
          </span>
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
        <ElFormItem label="充值金额（元）" prop="amountYuan">
          <ElInputNumber
            v-model="form.amountYuan"
            :controls="false"
            :min="0"
            :precision="2"
            :step="1"
            placeholder="请输入金额"
            style="width: 180px"
          />
        </ElFormItem>
        <ElFormItem label="充值平台" prop="platform">
          <ElSelect
            v-model="form.platform"
            clearable
            placeholder="请选择平台"
            style="width: 160px"
          >
            <ElOption
              v-for="item in PLATFORM_OPTIONS"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <ElButton
            :loading="submitting"
            type="primary"
            @click="submitRecharge"
          >
            确认充值
          </ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">充值记录</span>
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
        <ElTableColumn label="流水 ID" prop="rechargeId" width="100" />
        <ElTableColumn label="客户" prop="customerName" min-width="120" />
        <ElTableColumn label="充值金额" min-width="140">
          <template #default="{ row }">
            {{ formatCents(row.amountCents) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="充值平台" prop="platform" min-width="120" />
        <ElTableColumn label="充值时间" min-width="180">
          <template #default="{ row }">
            {{ formatUtcDateTime(row.rechargeTime) }}
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
  </div>
</template>
