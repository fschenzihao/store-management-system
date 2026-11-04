<script setup lang="ts">
import type { FormInstance } from 'element-plus';

import type { RechargePlatform, RechargeRecord } from '#/api/store';

import { reactive, ref } from 'vue';

import {
  ElButton,
  ElCard,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { getRechargeListApi } from '#/api/store';

import CustomerSelect from '../components/customer-select.vue';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  formatCents,
  formatDateToUtcText,
  formatUtcDateTime,
  PAGE_SIZES,
} from '../shared';
import RechargeDialog from './recharge-dialog.vue';

defineOptions({ name: 'StoreRecharge' });

interface RechargeFilter {
  customerId: number | undefined;
  platform: '' | RechargePlatform;
  /** 本地时间范围，提交前换算为 UTC 文本。 */
  timeRange: [Date, Date] | null;
}

const PLATFORM_OPTIONS: RechargePlatform[] = ['微信', '支付宝', '现金'];

const filterFormRef = ref<FormInstance>();
const filterForm = reactive<RechargeFilter>({
  customerId: undefined,
  platform: '',
  timeRange: null,
});

const rechargeDialogRef = ref<InstanceType<typeof RechargeDialog>>();
const records = ref<RechargeRecord[]>([]);
const total = ref(0);
const page = ref(DEFAULT_PAGE);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const recordsLoading = ref(false);

async function loadRecords() {
  recordsLoading.value = true;
  try {
    const result = await getRechargeListApi({
      customerId: filterForm.customerId,
      endTime: filterForm.timeRange
        ? formatDateToUtcText(filterForm.timeRange[1])
        : undefined,
      page: page.value,
      pageSize: pageSize.value,
      platform: filterForm.platform || undefined,
      startTime: filterForm.timeRange
        ? formatDateToUtcText(filterForm.timeRange[0])
        : undefined,
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

function handleSearch() {
  page.value = DEFAULT_PAGE;
  loadRecords();
}

function handleReset() {
  filterForm.customerId = undefined;
  filterForm.platform = '';
  filterForm.timeRange = null;
  filterFormRef.value?.clearValidate();
  handleSearch();
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

function openRechargeDialog() {
  rechargeDialogRef.value?.open();
}

function handleRechargeSuccess() {
  handleSearch();
}

loadRecords();
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">充值记录</span>
          <ElButton type="primary" @click="openRechargeDialog">
            新增充值
          </ElButton>
        </div>
      </template>

      <ElForm
        ref="filterFormRef"
        inline
        :model="filterForm"
        @submit.prevent="handleSearch"
      >
        <ElFormItem label="客户" prop="customerId" style="width: 260px">
          <CustomerSelect
            v-model="filterForm.customerId"
            placeholder="输入关键字搜索客户"
          />
        </ElFormItem>
        <ElFormItem label="充值平台" prop="platform" style="width: 180px">
          <ElSelect
            v-model="filterForm.platform"
            clearable
            placeholder="全部平台"
          >
            <ElOption
              v-for="item in PLATFORM_OPTIONS"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="充值时间" prop="timeRange">
          <ElDatePicker
            v-model="filterForm.timeRange"
            end-placeholder="结束日期"
            range-separator="至"
            start-placeholder="开始日期"
            type="daterange"
            unlink-panels
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton
            :loading="recordsLoading"
            type="primary"
            @click="handleSearch"
          >
            查询
          </ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

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

    <RechargeDialog ref="rechargeDialogRef" @success="handleRechargeSuccess" />
  </div>
</template>
