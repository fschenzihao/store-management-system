<script setup lang="ts">
import type { FormInstance, FormItemRule, FormRules } from 'element-plus';

import type { Customer } from '#/api/store';

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
  createCustomerApi,
  deleteCustomerApi,
  getCustomerListApi,
  updateCustomerApi,
} from '#/api/store';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  displayText,
  formatUtcDateTime,
  PAGE_SIZES,
} from '../shared';

defineOptions({ name: 'StoreCustomer' });

interface CustomerForm {
  customerName: string;
  customerPhone: string;
  remark: string;
  wechatId: string;
  wechatName: string;
}

/** 必填文本规则：服务端同样会对文本去空格，页面先做等价校验。 */
function requiredTextRules(label: string, maxLength: number): FormItemRule[] {
  return [
    { message: `请输入${label}`, required: true, trigger: 'blur' },
    {
      max: maxLength,
      message: `${label}不能超过 ${maxLength} 个字符`,
      trigger: 'blur',
    },
    {
      trigger: 'blur',
      validator: (_rule, value: string, callback) => {
        if (typeof value === 'string' && value.trim().length === 0) {
          callback(new Error(`${label}不能为空白字符`));
        } else {
          callback();
        }
      },
    },
  ];
}

const query = reactive({ customerName: '', customerPhone: '' });
const form = reactive<CustomerForm>({
  customerName: '',
  customerPhone: '',
  remark: '',
  wechatId: '',
  wechatName: '',
});
const formRef = ref<FormInstance>();
const rules: FormRules = {
  customerName: requiredTextRules('客户姓名', 50),
  customerPhone: requiredTextRules('手机号', 20),
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }],
  wechatId: [
    { max: 64, message: '微信 ID 不能超过 64 个字符', trigger: 'blur' },
  ],
  wechatName: [
    { max: 100, message: '微信名不能超过 100 个字符', trigger: 'blur' },
  ],
};

const items = ref<Customer[]>([]);
const total = ref(0);
const page = ref(DEFAULT_PAGE);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<null | number>(null);

async function loadCustomers() {
  loading.value = true;
  try {
    const result = await getCustomerListApi({
      page: page.value,
      pageSize: pageSize.value,
      customerName: query.customerName.trim() || undefined,
      customerPhone: query.customerPhone.trim() || undefined,
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
  loadCustomers();
}

function handleReset() {
  query.customerName = '';
  query.customerPhone = '';
  handleSearch();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = DEFAULT_PAGE;
  loadCustomers();
}

function handleCurrentChange(value: number) {
  page.value = value;
  loadCustomers();
}

function resetForm() {
  form.customerName = '';
  form.customerPhone = '';
  form.remark = '';
  form.wechatId = '';
  form.wechatName = '';
}

function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEdit(row: Customer) {
  editingId.value = row.customerId;
  form.customerName = row.customerName;
  form.customerPhone = row.customerPhone;
  form.remark = row.remark ?? '';
  form.wechatId = row.wechatId ?? '';
  form.wechatName = row.wechatName ?? '';
  dialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

/** 可选文本清空时提交 null，符合契约「传 null 或空字符串表示清空」。 */
function buildPayload() {
  return {
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim(),
    remark: form.remark.trim() || null,
    wechatId: form.wechatId.trim() || null,
    wechatName: form.wechatName.trim() || null,
  };
}

async function submitForm() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const payload = buildPayload();
    if (editingId.value === null) {
      await createCustomerApi(payload);
      ElMessage.success('新增客户成功，已同时创建零余额账户');
    } else {
      await updateCustomerApi(editingId.value, payload);
      ElMessage.success('修改客户成功');
    }
    dialogVisible.value = false;
    page.value = DEFAULT_PAGE;
    await loadCustomers();
  } catch {
    // 错误提示由 request.ts 统一处理，保留弹窗与表单内容供用户修改
  } finally {
    submitting.value = false;
  }
}

async function removeCustomer(row: Customer) {
  try {
    await ElMessageBox.confirm(
      `确认删除客户「${row.customerName}」吗？已有账户或业务流水的客户不可删除。`,
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
    await deleteCustomerApi(row.customerId);
    ElMessage.success('删除成功');
    await loadCustomers();
  } catch {
    // 删除被业务规则拦截时统一提示，不重复发起请求
  }
}

onMounted(loadCustomers);
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <ElCard shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">客户管理</span>
          <ElButton type="primary" @click="openCreate">新增客户</ElButton>
        </div>
      </template>

      <ElForm inline :model="query" @submit.prevent="handleSearch">
        <ElFormItem label="客户姓名">
          <ElInput
            v-model="query.customerName"
            clearable
            placeholder="按姓名模糊查询"
            style="width: 200px"
          />
        </ElFormItem>
        <ElFormItem label="手机号">
          <ElInput
            v-model="query.customerPhone"
            clearable
            placeholder="按手机号模糊查询"
            style="width: 200px"
          />
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" @click="handleSearch">查询</ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <ElTable v-loading="loading" :data="items" border stripe>
        <ElTableColumn label="客户 ID" prop="customerId" width="100" />
        <ElTableColumn label="客户姓名" prop="customerName" min-width="120" />
        <ElTableColumn label="手机号" prop="customerPhone" min-width="140" />
        <ElTableColumn label="微信 ID" min-width="140">
          <template #default="{ row }">
            {{ displayText(row.wechatId) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="微信名" min-width="120">
          <template #default="{ row }">
            {{ displayText(row.wechatName) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ displayText(row.remark) }}</template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ formatUtcDateTime(row.createTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" min-width="180">
          <template #default="{ row }">
            {{ formatUtcDateTime(row.updateTime) }}
          </template>
        </ElTableColumn>
        <ElTableColumn fixed="right" label="操作" width="150">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEdit(row as Customer)">
              修改
            </ElButton>
            <ElButton
              link
              type="danger"
              @click="removeCustomer(row as Customer)"
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
      :title="editingId === null ? '新增客户' : '修改客户'"
      width="560px"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <ElFormItem label="客户姓名" prop="customerName">
          <ElInput
            v-model="form.customerName"
            maxlength="50"
            placeholder="请输入客户姓名"
          />
        </ElFormItem>
        <ElFormItem label="手机号" prop="customerPhone">
          <ElInput
            v-model="form.customerPhone"
            maxlength="20"
            placeholder="请输入手机号"
          />
        </ElFormItem>
        <ElFormItem label="微信 ID" prop="wechatId">
          <ElInput
            v-model="form.wechatId"
            maxlength="64"
            placeholder="选填，留空表示清空"
          />
        </ElFormItem>
        <ElFormItem label="微信名" prop="wechatName">
          <ElInput
            v-model="form.wechatName"
            maxlength="100"
            placeholder="选填，留空表示清空"
          />
        </ElFormItem>
        <ElFormItem label="备注" prop="remark">
          <ElInput
            v-model="form.remark"
            :rows="3"
            maxlength="500"
            placeholder="选填，留空表示清空"
            show-word-limit
            type="textarea"
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
