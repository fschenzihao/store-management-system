<script setup lang="ts">
import type { Customer } from '#/api/store';

import { computed, onMounted, ref, watch } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import { getCustomerDetailApi, getCustomerListApi } from '#/api/store';

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

/** 列表缺少已选客户时补齐选项，避免标签与选项丢失。 */
function mergeSelectedCustomer(list: Customer[]): Customer[] {
  if (
    props.modelValue === undefined ||
    list.some((item) => item.customerId === props.modelValue)
  ) {
    return list;
  }
  const selected =
    selectedCustomer.value ??
    customers.value.find((item) => item.customerId === props.modelValue);
  return selected ? [selected, ...list] : list;
}

/** 下拉默认加载前 100 位客户；输入关键字时走服务端按客户名模糊查询。 */
async function loadCustomers(keyword?: string) {
  loading.value = true;
  try {
    const result = await getCustomerListApi({
      customerName: keyword?.trim() || undefined,
      page: DEFAULT_PAGE,
      pageSize: MAX_OPTIONS,
    });
    customers.value = mergeSelectedCustomer(result.items);
  } catch {
    customers.value = [];
  } finally {
    loading.value = false;
  }
}

/** 外部预置选中值时，若选项不在当前列表中，按客户详情补齐并回显。 */
async function syncSelectedCustomer(customerId: number | undefined) {
  if (customerId === undefined) {
    return;
  }
  const matched = customers.value.find(
    (item) => item.customerId === customerId,
  );
  if (matched) {
    selectedCustomer.value = matched;
    return;
  }
  try {
    const detail = await getCustomerDetailApi(customerId);
    selectedCustomer.value = detail.customer;
    if (!customers.value.some((item) => item.customerId === customerId)) {
      customers.value = [detail.customer, ...customers.value];
    }
  } catch {
    // 客户不存在或已被删除时保持未选中，由表单校验提示重新选择
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
}

defineExpose({ reload: loadCustomers });

watch(() => props.modelValue, syncSelectedCustomer, { immediate: true });

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
