<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type { Customer, RechargePlatform } from '#/api/store';

import { reactive, ref } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import { createRechargeApi, getCustomerAccountApi } from '#/api/store';

import CustomerSelect from '../components/customer-select.vue';
import { formatCents, yuanToCents } from '../shared';

defineOptions({ name: 'RechargeDialog' });

const emit = defineEmits<{ success: [] }>();

interface RechargeForm {
  /** 页面输入单位为元，提交前换算为整数分。 */
  amountYuan: number | undefined;
  customerId: number | undefined;
  platform: '' | RechargePlatform;
}

const PLATFORM_OPTIONS: RechargePlatform[] = ['微信', '支付宝', '现金'];

const visible = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<RechargeForm>({
  amountYuan: undefined,
  customerId: undefined,
  platform: '',
});
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

function handleCustomerChange(customer: Customer | undefined) {
  accountName.value = customer?.customerName ?? '';
  loadAccount(form.customerId);
}

/** 打开弹窗并重置表单与余额展示。 */
function open() {
  form.amountYuan = undefined;
  form.customerId = undefined;
  form.platform = '';
  accountBalanceCents.value = null;
  accountName.value = '';
  formRef.value?.clearValidate();
  visible.value = true;
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
    ElMessage.success(
      `充值成功，${result.account.customerName} 当前余额 ${formatCents(result.account.balanceCents)}`,
    );
    visible.value = false;
    emit('success');
  } catch {
    // 错误提示由 request.ts 统一处理，保留表单内容供用户修改
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <ElDialog
    v-model="visible"
    title="新增充值"
    width="480px"
    :close-on-click-modal="false"
  >
    <div class="mb-4 rounded-md bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800">
      <template v-if="accountBalanceCents !== null">
        {{ accountName }} 当前账户余额：
        <span class="text-base font-semibold text-green-600">
          {{ formatCents(accountBalanceCents) }}
        </span>
      </template>
      <template v-else>请选择客户，以查看其账户余额。</template>
    </div>

    <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
      <ElFormItem label="客户" prop="customerId">
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
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem label="充值平台" prop="platform">
        <ElSelect
          v-model="form.platform"
          clearable
          placeholder="请选择平台"
          style="width: 100%"
        >
          <ElOption
            v-for="item in PLATFORM_OPTIONS"
            :key="item"
            :label="item"
            :value="item"
          />
        </ElSelect>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton :loading="submitting" type="primary" @click="submitRecharge">
        确认充值
      </ElButton>
    </template>
  </ElDialog>
</template>
