<script setup lang="ts">
import type { Customer } from '#/api/store';

import { computed, onMounted, ref } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import { getCustomerListApi } from '#/api/store';

import { DEFAULT_PAGE, MAX_OPTIONS } from '../shared';

defineOptions({ name: 'CustomerSelect' });

const props = defineProps<{
  modelValue?: number;
  placeholder?: string;
}>();

const emit = defineEmits<{
  change: [customer: Customer | undefined];
  'update:modelValue': [value: number | undefined];
}>();

const customers = ref<Customer[]>([]);
const loading = ref(false);

const selectedId = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

/** 下拉选项来自客户列表接口；超过 100 位客户时可按需改造为远程搜索。 */
async function loadCustomers() {
  loading.value = true;
  try {
    const result = await getCustomerListApi({
      page: DEFAULT_PAGE,
      pageSize: MAX_OPTIONS,
    });
    customers.value = result.items;
  } catch {
    customers.value = [];
  } finally {
    loading.value = false;
  }
}

function handleChange(value: number | undefined) {
  emit(
    'change',
    customers.value.find((item) => item.customerId === value),
  );
}

defineExpose({ reload: loadCustomers });

onMounted(loadCustomers);
</script>

<template>
  <ElSelect
    v-model="selectedId"
    :loading="loading"
    :placeholder="placeholder ?? '请选择客户'"
    clearable
    filterable
    style="width: 100%"
    @change="handleChange"
  >
    <ElOption
      v-for="item in customers"
      :key="item.customerId"
      :label="`${item.customerName}（${item.customerPhone}）`"
      :value="item.customerId"
    />
  </ElSelect>
</template>
