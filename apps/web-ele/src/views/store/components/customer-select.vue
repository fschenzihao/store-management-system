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
const selectedCustomer = ref<Customer>();

const selectedId = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

/** 下拉默认加载前 100 位客户；输入关键字时走服务端按客户名模糊查询。 */
async function loadCustomers(keyword?: string) {
  loading.value = true;
  try {
    const result = await getCustomerListApi({
      customerName: keyword?.trim() || undefined,
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

/** 远程搜索：关键字为空时恢复默认列表。 */
function handleRemoteSearch(query: string) {
  loadCustomers(query);
}

function handleChange(value: number | undefined) {
  selectedCustomer.value = customers.value.find(
    (item) => item.customerId === value,
  );
  emit('change', selectedCustomer.value);
}

/** 下拉关闭后恢复默认列表，并保留已选项，避免选中标签丢失。 */
async function handleVisibleChange(visible: boolean) {
  if (visible) {
    return;
  }
  await loadCustomers();
  if (
    props.modelValue !== undefined &&
    !customers.value.some((item) => item.customerId === props.modelValue) &&
    selectedCustomer.value
  ) {
    customers.value = [selectedCustomer.value, ...customers.value];
  }
}

defineExpose({ reload: loadCustomers });

onMounted(loadCustomers);
</script>

<template>
  <ElSelect
    v-model="selectedId"
    :loading="loading"
    :placeholder="placeholder ?? '请选择客户'"
    :remote-method="handleRemoteSearch"
    clearable
    filterable
    remote
    reserve-keyword
    style="width: 100%"
    @change="handleChange"
    @visible-change="handleVisibleChange"
  >
    <ElOption
      v-for="item in customers"
      :key="item.customerId"
      :label="`${item.customerName}（${item.customerPhone}）`"
      :value="item.customerId"
    />
  </ElSelect>
</template>
