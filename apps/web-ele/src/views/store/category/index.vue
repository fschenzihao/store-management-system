<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';

import type { CraftCategory } from '#/api/store';

import { nextTick, onMounted, reactive, ref } from 'vue';

import {
  ElButton,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createCategoryApi,
  deleteCategoryApi,
  getCategoryListApi,
  updateCategoryApi,
} from '#/api/store';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  formatUtcDateTime,
  PAGE_SIZES,
} from '../shared';

defineOptions({ name: 'StoreCategory' });

interface CategoryForm {
  categoryName: string;
}

const query = reactive({ categoryName: '' });
const form = reactive<CategoryForm>({ categoryName: '' });
const formRef = ref<FormInstance>();
const rules: FormRules = {
  categoryName: [
    { required: true, message: '请输入品类名', trigger: 'blur' },
    { max: 50, message: '品类名不能超过 50 个字符', trigger: 'blur' },
    {
      trigger: 'blur',
      validator: (_rule, value: string, callback) => {
        if (typeof value === 'string' && value.trim().length === 0) {
          callback(new Error('品类名不能为空白字符'));
        } else {
          callback();
        }
      },
    },
  ],
};

const items = ref<CraftCategory[]>([]);
const total = ref(0);
const page = ref(DEFAULT_PAGE);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<null | number>(null);

async function loadCategories() {
  loading.value = true;
  try {
    const categoryName = query.categoryName.trim() || undefined;
    const result = await getCategoryListApi({
      page: page.value,
      pageSize: pageSize.value,
      categoryName,
    });
    items.value = result.items;
    total.value = result.total;
  } catch {
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = DEFAULT_PAGE;
  loadCategories();
}

function handleReset() {
  query.categoryName = '';
  handleSearch();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = DEFAULT_PAGE;
  loadCategories();
}

function handleCurrentChange(value: number) {
  page.value = value;
  loadCategories();
}

function openCreate() {
  editingId.value = null;
  form.categoryName = '';
  dialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEdit(row: CraftCategory) {
  editingId.value = row.categoryId;
  form.categoryName = row.categoryName;
  dialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function submitForm() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const categoryName = form.categoryName.trim();
    if (editingId.value === null) {
      await createCategoryApi({ categoryName });
      ElMessage.success('新增品类成功');
    } else {
      await updateCategoryApi(editingId.value, { categoryName });
      ElMessage.success('修改品类成功');
    }
    dialogVisible.value = false;
    page.value = DEFAULT_PAGE;
    await loadCategories();
  } catch {
    // 错误提示由 request.ts 统一处理，保留弹窗与表单内容供用户修改
  } finally {
    submitting.value = false;
  }
}

async function removeCategory(row: CraftCategory) {
  try {
    await ElMessageBox.confirm(
      `确认删除品类「${row.categoryName}」吗？已有消费记录的品类不可删除。`,
      '删除确认',
      {
        cancelButtonText: '取消',
        confirmButtonText: '确定',
        type: 'warning',
      },
    );
  } catch {
    return;
  }
  try {
    await deleteCategoryApi(row.categoryId);
    ElMessage.success('删除成功');
    await loadCategories();
  } catch {
    // 删除被业务规则拦截时统一提示，不重复发起请求
  }
}

onMounted(loadCategories);
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">手工品类管理</span>
          <ElButton type="primary" @click="openCreate">新增品类</ElButton>
        </div>
      </template>

      <ElForm inline :model="query" @submit.prevent="handleSearch">
        <ElFormItem label="品类名">
          <ElInput
            v-model="query.categoryName"
            clearable
            placeholder="按品类名模糊查询"
            style="width: 220px"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" @click="handleSearch">查询</ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <ElTable v-loading="loading" :data="items" border stripe>
        <ElTableColumn label="品类 ID" prop="categoryId" width="100" />
        <ElTableColumn label="品类名" prop="categoryName" min-width="180" />
        <ElTableColumn label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ formatUtcDateTime(row.createTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn fixed="right" label="操作" width="150">
          <template #default="{ row }">
            <ElButton
              link
              type="primary"
              @click="openEdit(row as CraftCategory)"
            >
              修改
            </ElButton>
            <ElButton
              link
              type="danger"
              @click="removeCategory(row as CraftCategory)"
            >
              删除
            </ElButton>
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

    <ElDialog
      v-model="dialogVisible"
      :title="editingId === null ? '新增品类' : '修改品类'"
      width="460px"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="品类名" prop="categoryName">
          <ElInput
            v-model="form.categoryName"
            maxlength="50"
            placeholder="请输入品类名"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton :loading="submitting" type="primary" @click="submitForm">
          确定
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>
