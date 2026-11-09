<script setup lang="ts">
import type { CraftCategory, StoreSetting } from '#/api/store';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  ElButton,
  ElCard,
  ElForm,
  ElFormItem,
  ElMessage,
  ElOption,
  ElSelect,
} from 'element-plus';

import {
  CATEGORY_STATUS_ON,
  getCategoryListApi,
  getStoreSettingApi,
  updateStoreSettingApi,
} from '#/api/store';

import CustomerSelect from '../components/customer-select.vue';
import { DEFAULT_PAGE, formatUtcDateTime, MAX_OPTIONS } from '../shared';
import { clearStoreSettingCache } from './use-store-setting';

defineOptions({ name: 'StoreSetting' });

interface SettingForm {
  categoryId: number | undefined;
  customerId: number | undefined;
}

const EMPTY_SETTING: StoreSetting = {
  defaultCategoryId: null,
  defaultCategoryName: null,
  defaultCustomerId: null,
  defaultCustomerName: null,
  updateTime: null,
};

const form = reactive<SettingForm>({
  categoryId: undefined,
  customerId: undefined,
});
/** 已保存的设置，用于「重置」与展示最近修改时间。 */
const savedSetting = ref<StoreSetting>(EMPTY_SETTING);
const categories = ref<CraftCategory[]>([]);
const loading = ref(false);
const categoriesLoading = ref(false);
const submitting = ref(false);

const lastUpdateText = computed(() =>
  savedSetting.value.updateTime
    ? formatUtcDateTime(savedSetting.value.updateTime)
    : '-',
);

function applySetting(setting: StoreSetting) {
  savedSetting.value = setting;
  form.customerId = setting.defaultCustomerId ?? undefined;
  form.categoryId = setting.defaultCategoryId ?? undefined;
}

async function loadSetting() {
  loading.value = true;
  try {
    applySetting(await getStoreSettingApi());
  } catch {
    // 读取失败由请求层统一提示，表单保持可编辑状态
  } finally {
    loading.value = false;
  }
}

/** 默认值下拉展示全量品类（含已下架），下架项置灰不可选。 */
async function loadCategories() {
  categoriesLoading.value = true;
  try {
    const result = await getCategoryListApi({
      page: DEFAULT_PAGE,
      pageSize: MAX_OPTIONS,
    });
    categories.value = result.items;
  } catch {
    categories.value = [];
  } finally {
    categoriesLoading.value = false;
  }
}

function handleReset() {
  applySetting(savedSetting.value);
}

async function submitSetting() {
  submitting.value = true;
  try {
    const result = await updateStoreSettingApi({
      defaultCategoryId: form.categoryId ?? null,
      defaultCustomerId: form.customerId ?? null,
    });
    applySetting(result);
    clearStoreSettingCache();
    ElMessage.success('保存成功');
  } catch {
    // 校验或保存失败由请求层统一提示，保留表单内容供用户修改
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadSetting();
  loadCategories();
});
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-base font-semibold">系统设置</span>
          <span class="text-xs text-[#8d8579] dark:text-white/50">
            最近修改：{{ lastUpdateText }}
          </span>
        </div>
      </template>

      <div v-loading="loading" class="max-w-[640px]">
        <p class="mb-5 text-sm text-[#6f685c] dark:text-white/60">
          这里的默认值会在桌位看板开台与新增消费时自动预填，表单中仍可临时修改。
        </p>

        <ElForm label-width="110px">
          <ElFormItem label="默认客户">
            <div class="w-full">
              <CustomerSelect
                v-model="form.customerId"
                placeholder="留空表示不预填客户"
              />
              <p class="mt-1.5 text-xs text-[#8d8579] dark:text-white/50">
                留空则开台与新增消费时不做预填。
              </p>
            </div>
          </ElFormItem>

          <ElFormItem label="默认手工品类">
            <div class="w-full">
              <ElSelect
                v-model="form.categoryId"
                :loading="categoriesLoading"
                clearable
                filterable
                placeholder="留空表示不预填品类"
                style="width: 100%"
              >
                <ElOption
                  v-for="item in categories"
                  :key="item.categoryId"
                  :disabled="item.status !== CATEGORY_STATUS_ON"
                  :label="item.categoryName"
                  :value="item.categoryId"
                >
                  <span>{{ item.categoryName }}</span>
                  <span
                    v-if="item.status !== CATEGORY_STATUS_ON"
                    class="ml-2 text-xs text-[#8d8579]"
                  >
                    （已下架）
                  </span>
                </ElOption>
              </ElSelect>
              <p class="mt-1.5 text-xs text-[#8d8579] dark:text-white/50">
                下架品类不可设为默认品类；留空则不做预填。
              </p>
            </div>
          </ElFormItem>
        </ElForm>

        <div class="mt-6 flex justify-end gap-2">
          <ElButton :disabled="loading || submitting" @click="handleReset">
            重置
          </ElButton>
          <ElButton :loading="submitting" type="primary" @click="submitSetting">
            保存设置
          </ElButton>
        </div>
      </div>
    </ElCard>
  </div>
</template>
