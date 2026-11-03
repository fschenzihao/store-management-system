<script setup lang="ts">
import type {
  ConsumptionRecord,
  CustomerAccount,
  RechargeRecord,
} from '#/api/store';

import { ref } from 'vue';

import {
  ElButton,
  ElCard,
  ElEmpty,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import {
  getCustomerAccountApi,
  getCustomerConsumptionListApi,
  getCustomerRechargeListApi,
} from '#/api/store';

import CustomerSelect from '../components/customer-select.vue';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  formatCents,
  formatUtcDateTime,
  PAGE_SIZES,
} from '../shared';

defineOptions({ name: 'StoreAccount' });

const customerId = ref<number | undefined>(undefined);
const account = ref<CustomerAccount | null>(null);
const accountLoading = ref(false);
const activeTab = ref('recharges');

const recharges = ref<RechargeRecord[]>([]);
const rechargeTotal = ref(0);
const rechargePage = ref(DEFAULT_PAGE);
const rechargePageSize = ref(DEFAULT_PAGE_SIZE);
const rechargesLoading = ref(false);

const consumptions = ref<ConsumptionRecord[]>([]);
const consumptionTotal = ref(0);
const consumptionPage = ref(DEFAULT_PAGE);
const consumptionPageSize = ref(DEFAULT_PAGE_SIZE);
const consumptionsLoading = ref(false);

async function loadAccount(id: number | undefined) {
  if (!id) {
    account.value = null;
    return;
  }
  accountLoading.value = true;
  try {
    account.value = await getCustomerAccountApi(id);
  } catch {
    account.value = null;
  } finally {
    accountLoading.value = false;
  }
}

async function loadRecharges(id: number | undefined) {
  if (!id) {
    recharges.value = [];
    rechargeTotal.value = 0;
    return;
  }
  rechargesLoading.value = true;
  try {
    const result = await getCustomerRechargeListApi(id, {
      page: rechargePage.value,
      pageSize: rechargePageSize.value,
    });
    recharges.value = result.items;
    rechargeTotal.value = result.total;
  } catch {
    recharges.value = [];
    rechargeTotal.value = 0;
  } finally {
    rechargesLoading.value = false;
  }
}

async function loadConsumptions(id: number | undefined) {
  if (!id) {
    consumptions.value = [];
    consumptionTotal.value = 0;
    return;
  }
  consumptionsLoading.value = true;
  try {
    const result = await getCustomerConsumptionListApi(id, {
      page: consumptionPage.value,
      pageSize: consumptionPageSize.value,
    });
    consumptions.value = result.items;
    consumptionTotal.value = result.total;
  } catch {
    consumptions.value = [];
    consumptionTotal.value = 0;
  } finally {
    consumptionsLoading.value = false;
  }
}

async function refreshAll() {
  const id = customerId.value;
  await Promise.all([loadAccount(id), loadRecharges(id), loadConsumptions(id)]);
}

function handleCustomerChange() {
  rechargePage.value = DEFAULT_PAGE;
  consumptionPage.value = DEFAULT_PAGE;
  refreshAll();
}

function handleRechargeSizeChange(size: number) {
  rechargePageSize.value = size;
  rechargePage.value = DEFAULT_PAGE;
  loadRecharges(customerId.value);
}

function handleRechargeCurrentChange(value: number) {
  rechargePage.value = value;
  loadRecharges(customerId.value);
}

function handleConsumptionSizeChange(size: number) {
  consumptionPageSize.value = size;
  consumptionPage.value = DEFAULT_PAGE;
  loadConsumptions(customerId.value);
}

function handleConsumptionCurrentChange(value: number) {
  consumptionPage.value = value;
  loadConsumptions(customerId.value);
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <span class="text-base font-semibold">客户账户与余额</span>
      </template>
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-72">
          <CustomerSelect
            v-model="customerId"
            placeholder="请选择要查询的客户"
            @change="handleCustomerChange"
          />
        </div>
        <ElButton :disabled="!customerId" @click="refreshAll">刷新</ElButton>
      </div>
    </ElCard>

    <template v-if="customerId">
      <ElCard v-loading="accountLoading" shadow="never">
        <template #header>
          <span class="text-base font-semibold">账户信息</span>
        </template>
        <div v-if="account" class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div class="text-sm text-gray-500">客户 ID</div>
            <div class="mt-1 text-base">{{ account.customerId }}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">客户姓名</div>
            <div class="mt-1 text-base">{{ account.customerName }}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">当前余额</div>
            <div class="mt-1 text-2xl font-semibold text-green-600">
              {{ formatCents(account.balanceCents) }}
            </div>
          </div>
        </div>
        <ElEmpty
          v-else
          :image-size="80"
          description="账户信息不存在或加载失败"
        />
      </ElCard>

      <ElCard shadow="never">
        <ElTabs v-model="activeTab">
          <ElTabPane label="充值记录" name="recharges">
            <ElTable
              v-loading="rechargesLoading"
              :data="recharges"
              border
              stripe
            >
              <ElTableColumn label="流水 ID" prop="rechargeId" width="100" />
              <ElTableColumn label="客户" prop="customerName" min-width="120" />
              <ElTableColumn label="充值金额" min-width="140">
                <template #default="{ row }">
                  <span class="text-green-600">
                    + {{ formatCents(row.amountCents) }}
                  </span>
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
                v-model:current-page="rechargePage"
                v-model:page-size="rechargePageSize"
                :page-sizes="PAGE_SIZES"
                :total="rechargeTotal"
                background
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="handleRechargeCurrentChange"
                @size-change="handleRechargeSizeChange"
              />
            </div>
          </ElTabPane>

          <ElTabPane label="消费记录" name="consumptions">
            <ElTable
              v-loading="consumptionsLoading"
              :data="consumptions"
              border
              stripe
            >
              <ElTableColumn label="流水 ID" prop="consumptionId" width="100" />
              <ElTableColumn label="客户" prop="customerName" min-width="120" />
              <ElTableColumn
                label="手工品类"
                prop="categoryName"
                min-width="120"
              />
              <ElTableColumn label="消费金额" min-width="140">
                <template #default="{ row }">
                  <span class="text-red-600">
                    - {{ formatCents(row.consumptionAmountCents) }}
                  </span>
                </template>
              </ElTableColumn>
              <ElTableColumn
                label="时长（分钟）"
                prop="durationMinutes"
                min-width="140"
              />
            </ElTable>
            <div class="mt-4 flex justify-end">
              <ElPagination
                v-model:current-page="consumptionPage"
                v-model:page-size="consumptionPageSize"
                :page-sizes="PAGE_SIZES"
                :total="consumptionTotal"
                background
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="handleConsumptionCurrentChange"
                @size-change="handleConsumptionSizeChange"
              />
            </div>
          </ElTabPane>
        </ElTabs>
      </ElCard>
    </template>

    <ElCard v-else shadow="never">
      <ElEmpty description="请选择客户，查看账户余额以及充值、消费流水" />
    </ElCard>
  </div>
</template>
