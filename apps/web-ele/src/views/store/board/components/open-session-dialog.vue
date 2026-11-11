<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type {
  CraftCategory,
  Customer,
  TableBoardItem,
  TableSessionTimingMode,
} from '#/api/store';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
} from 'element-plus';

import {
  CATEGORY_STATUS_ON,
  getCategoryListApi,
  getCustomerAccountApi,
  openTableSessionApi,
  TIMING_MODE_ELAPSED,
  TIMING_MODE_PURCHASED,
} from '#/api/store';

import CustomerSelect from '../../components/customer-select.vue';
import { loadStoreSetting } from '../../setting/use-store-setting';
import { formatCents, MAX_OPTIONS, yuanToCents } from '../../shared';
import { DURATION_PRESETS, getSeatLayout } from '../layout';

defineOptions({ name: 'OpenSessionDialog' });

const emit = defineEmits<{ success: [] }>();

interface OpenForm {
  amountYuan: number | undefined;
  categoryId: number | undefined;
  customerId: number | undefined;
  durationMinutes: number | undefined;
}

const visible = ref(false);
const submitting = ref(false);
const loadingCategories = ref(false);
const formRef = ref<FormInstance>();
const table = ref<null | TableBoardItem>(null);
const categories = ref<CraftCategory[]>([]);
const accountBalanceCents = ref<null | number>(null);
const accountName = ref('');

const form = reactive<OpenForm>({
  amountYuan: undefined,
  categoryId: undefined,
  customerId: undefined,
  durationMinutes: 60,
});

/** 计时方式：1=按购买时长倒计时、2=实际计时 */
const timingMode = ref<TableSessionTimingMode>(TIMING_MODE_PURCHASED);
const isElapsedMode = computed(() => timingMode.value === TIMING_MODE_ELAPSED);

const seatLabel = computed(() =>
  table.value ? getSeatLayout(table.value.seatNo).label : '',
);

const rules: FormRules = {
  amountYuan: [
    { message: '请输入预估消费金额', required: true, trigger: 'blur' },
    {
      trigger: 'blur',
      validator: (_rule, value: number, callback) => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          callback(new Error('预估消费金额不能小于 0 元'));
        } else if (Number.isSafeInteger(Math.round(value * 100))) {
          callback();
        } else {
          callback(new Error('预估消费金额超出可处理范围'));
        }
      },
    },
  ],
  categoryId: [
    { message: '请选择手工品类', required: true, trigger: 'change' },
  ],
  customerId: [{ message: '请选择客户', required: true, trigger: 'change' }],
  durationMinutes: [
    {
      trigger: 'change',
      validator: (_rule, value: number, callback) => {
        // 实际计时模式不使用购买时长，交由服务端按实际用时结算
        if (isElapsedMode.value) {
          callback();
        } else if (!Number.isSafeInteger(value) || value <= 0) {
          callback(new Error('购买时长必须为大于 0 的整数分钟'));
        } else {
          callback();
        }
      },
    },
  ],
};

/** 品类请求去重：避免同时打开弹窗与初始化时重复请求。 */
let categoriesRequest: null | Promise<void> = null;

async function loadCategories() {
  loadingCategories.value = true;
  try {
    const result = await getCategoryListApi({
      page: 1,
      pageSize: MAX_OPTIONS,
      status: CATEGORY_STATUS_ON,
    });
    categories.value = result.items;
  } catch {
    categories.value = [];
  } finally {
    loadingCategories.value = false;
  }
}

/** 确保上架品类已加载，供默认品类预填时判断可用性。 */
function ensureCategoriesLoaded(): Promise<void> {
  if (categories.value.length > 0) {
    return Promise.resolve();
  }
  categoriesRequest ??= loadCategories().finally(() => {
    categoriesRequest = null;
  });
  return categoriesRequest;
}

async function loadAccount(customerId: number | undefined) {
  if (!customerId) {
    accountBalanceCents.value = null;
    accountName.value = '';
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

/** 打开弹窗并重置表单，空表单时按系统设置预填默认客户与默认品类。 */
async function open(item: TableBoardItem) {
  table.value = item;
  form.amountYuan = undefined;
  form.categoryId = undefined;
  form.customerId = undefined;
  form.durationMinutes = 60;
  timingMode.value = TIMING_MODE_PURCHASED;
  accountBalanceCents.value = null;
  accountName.value = '';
  formRef.value?.clearValidate();
  visible.value = true;

  const [setting] = await Promise.all([
    loadStoreSetting(),
    ensureCategoriesLoaded(),
  ]);

  // 等待期间用户可能已手动选择，仅在仍为空时预填
  if (form.customerId === undefined && setting.defaultCustomerId !== null) {
    form.customerId = setting.defaultCustomerId;
    loadAccount(form.customerId);
  }
  if (form.categoryId === undefined && setting.defaultCategoryId !== null) {
    const defaultCategoryId = setting.defaultCategoryId;
    // 仅预填仍在架品类，避免默认品类下架后开台失败
    if (
      categories.value.some(
        (category) => category.categoryId === defaultCategoryId,
      )
    ) {
      form.categoryId = defaultCategoryId;
    }
  }
}

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const { amountYuan, categoryId, customerId, durationMinutes } = form;
  if (
    !table.value ||
    amountYuan === undefined ||
    categoryId === undefined ||
    customerId === undefined
  ) {
    return;
  }
  const elapsedMode = isElapsedMode.value;
  if (!elapsedMode && (durationMinutes === undefined || durationMinutes <= 0)) {
    return;
  }
  submitting.value = true;
  try {
    const result = await openTableSessionApi({
      categoryId,
      customerId,
      durationMinutes: elapsedMode ? 0 : durationMinutes,
      estimatedAmountCents: yuanToCents(amountYuan),
      tableId: table.value.tableId,
      timingMode: timingMode.value,
    });
    ElMessage.success(
      elapsedMode
        ? `${seatLabel.value} 已开始实际计时，结账时按实际用时结算`
        : `${seatLabel.value} 开台成功，预估应付 ${formatCents(result.session.totalAmountCents)}，结账时按实收金额扣款`,
    );
    visible.value = false;
    emit('success');
  } catch {
    // 业务错误提示由请求层统一处理，保留表单内容供用户调整
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
onMounted(ensureCategoriesLoaded);
</script>

<template>
  <ElDialog
    v-model="visible"
    :close-on-click-modal="false"
    width="520px"
    class="open-session-dialog"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span
          class="rounded-lg bg-[#2f9e8f]/12 px-2.5 py-1 text-xs font-semibold text-[#2f9e8f]"
        >
          {{ seatLabel }}
        </span>
        <span class="text-base font-semibold text-[#2b2a28] dark:text-white">
          开台消费
        </span>
      </div>
    </template>

    <div
      class="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#f7f3ec] to-[#fdfbf7] px-4 py-3 text-sm dark:from-[#2b2a28] dark:to-[#232220]"
    >
      <template v-if="accountBalanceCents !== null">
        <span class="text-[#6f685c] dark:text-white/60">
          {{ accountName }} 当前余额（开台不扣款）
        </span>
        <span class="font-mono text-base font-semibold text-[#2f9e8f]">
          {{ formatCents(accountBalanceCents) }}
        </span>
      </template>
      <template v-else>
        <span class="text-[#6f685c] dark:text-white/60">
          选择客户后可查看余额并开台计时
        </span>
      </template>
    </div>

    <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
      <ElFormItem label="客户" prop="customerId">
        <CustomerSelect
          v-model="form.customerId"
          @change="handleCustomerChange"
        />
      </ElFormItem>

      <ElFormItem label="手工品类" prop="categoryId">
        <ElSelect
          v-model="form.categoryId"
          :loading="loadingCategories"
          clearable
          placeholder="请选择手工品类"
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

      <ElFormItem label="计时方式">
        <ElRadioGroup v-model="timingMode">
          <ElRadioButton :value="TIMING_MODE_PURCHASED">
            按购买时长
          </ElRadioButton>
          <ElRadioButton :value="TIMING_MODE_ELAPSED">实际计时</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>

      <ElFormItem v-if="!isElapsedMode" label="购买时长" prop="durationMinutes">
        <div class="w-full">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="minutes in DURATION_PRESETS"
              :key="minutes"
              class="duration-chip"
              :class="{
                'duration-chip--active': form.durationMinutes === minutes,
              }"
              type="button"
              @click="form.durationMinutes = minutes"
            >
              {{ minutes }} 分钟
            </button>
            <ElInputNumber
              v-model="form.durationMinutes"
              :min="1"
              :precision="0"
              :step="15"
              :controls="false"
              class="w-24"
              placeholder="自定义"
            />
          </div>
          <p class="mt-1.5 text-xs text-[#8d8579]">
            自定义时长单位为分钟，开台后按该时长倒计时。
          </p>
        </div>
      </ElFormItem>

      <ElFormItem v-else label="计时模式">
        <div
          class="w-full rounded-lg bg-[#2f9e8f]/8 px-3 py-2 text-xs text-[#6f685c] dark:text-white/60"
        >
          不设结束时间，从开台起按实际用时正计时；结账时按实际用时结算，无需续时。
        </div>
      </ElFormItem>

      <ElFormItem label="预估消费金额" prop="amountYuan">
        <div class="w-full">
          <ElInputNumber
            v-model="form.amountYuan"
            :controls="false"
            :min="0"
            :precision="2"
            :step="1"
            placeholder="请输入预估金额（元）"
            style="width: 100%"
          />
          <p class="mt-1.5 text-xs text-[#8d8579]">
            开台不扣款，结账时按实收金额扣减余额。
          </p>
        </div>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton :loading="submitting" type="primary" @click="submit">
        确认开台
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.duration-chip {
  display: inline-flex;
  align-items: center;
  height: var(--el-component-size);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: #6f685c;
  white-space: nowrap;
  cursor: pointer;
  background: #f7f3ec;
  border: 1px solid rgb(160 138 108 / 18%);
  border-radius: var(--el-border-radius-base);
  transition: all 0.2s ease;
}

.duration-chip:hover {
  color: #2f9e8f;
  border-color: rgb(47 158 143 / 45%);
}

.duration-chip--active {
  color: #fff;
  background: linear-gradient(135deg, #34a898, #2f9e8f);
  border-color: transparent;
  box-shadow: 0 2px 6px rgb(47 158 143 / 24%);
}

:global(.dark) .duration-chip {
  color: rgb(255 255 255 / 65%);
  background: #2b2a28;
  border-color: rgb(255 255 255 / 10%);
}

:global(.dark) .duration-chip--active {
  color: #fff;
}
</style>
