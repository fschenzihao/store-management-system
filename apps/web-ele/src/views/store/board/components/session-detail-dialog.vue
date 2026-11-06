<script setup lang="ts">
import type { SeatState } from '../types';

import type { TableBoardItem } from '#/api/store';

import { computed, ref } from 'vue';

import {
  ElButton,
  ElDialog,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
} from 'element-plus';

import { closeTableSessionApi, extendTableSessionApi } from '#/api/store';

import { formatCents, formatUtcDateTime, yuanToCents } from '../../shared';
import { EXTEND_PRESETS, getSeatLayout } from '../layout';
import { formatCountdown, formatMinutes } from '../use-board-clock';

defineOptions({ name: 'SessionDetailDialog' });

const props = defineProps<{
  modelValue: boolean;
  remainingMs: number;
  seat: null | TableBoardItem;
  state: SeatState;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const session = computed(() => props.seat?.session ?? null);
const seatLabel = computed(() =>
  props.seat ? getSeatLayout(props.seat.seatNo).label : '',
);
const overtime = computed(() => props.remainingMs <= 0);
const progress = computed(() => {
  const totalMs = (session.value?.plannedDurationMinutes ?? 0) * 60_000;
  if (totalMs <= 0) {
    return 0;
  }
  return Math.min(Math.max(props.remainingMs / totalMs, 0), 1);
});
const ringLength = 289;
const ringOffset = computed(() => ringLength * (1 - progress.value));
const countdownText = computed(() =>
  overtime.value
    ? `超时 ${formatCountdown(-props.remainingMs)}`
    : formatCountdown(props.remainingMs),
);

const extending = ref(false);
const closing = ref(false);
const extendMinutes = ref(60);
const extendAmountYuan = ref<number>();

async function submitExtend() {
  if (!session.value) {
    return;
  }
  if (!Number.isSafeInteger(extendMinutes.value) || extendMinutes.value <= 0) {
    ElMessage.warning('续时时长必须为大于 0 的整数分钟');
    return;
  }
  if (
    extendAmountYuan.value === undefined ||
    !Number.isFinite(extendAmountYuan.value) ||
    extendAmountYuan.value < 0
  ) {
    ElMessage.warning('请输入不小于 0 的续时金额');
    return;
  }
  extending.value = true;
  try {
    const result = await extendTableSessionApi(session.value.sessionId, {
      consumptionAmountCents: yuanToCents(extendAmountYuan.value),
      durationMinutes: extendMinutes.value,
    });
    ElMessage.success(
      `续时成功，剩余余额 ${formatCents(result.account.balanceCents)}`,
    );
    extendAmountYuan.value = undefined;
    emit('success');
  } catch {
    // 请求层统一提示错误
  } finally {
    extending.value = false;
  }
}

async function closeSession() {
  if (!session.value) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认结束「${seatLabel.value}」的消费并释放座位？已产生的消费流水不会回退。`,
      '结束并释放座位',
      {
        cancelButtonText: '再想想',
        confirmButtonText: '确认结束',
        type: 'warning',
      },
    );
  } catch {
    return;
  }
  closing.value = true;
  try {
    await closeTableSessionApi(session.value.sessionId);
    ElMessage.success(`${seatLabel.value} 已结束，座位已释放`);
    visible.value = false;
    emit('success');
  } catch {
    // 请求层统一提示错误
  } finally {
    closing.value = false;
  }
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :close-on-click-modal="false"
    width="560px"
    class="session-detail-dialog"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span
          class="rounded-lg px-2.5 py-1 text-xs font-semibold"
          :class="
            state === 'overtime'
              ? 'bg-[#e4572e]/12 text-[#e4572e]'
              : state === 'ending'
                ? 'bg-[#e8a33d]/14 text-[#b47a1c]'
                : 'bg-[#2f9e8f]/12 text-[#2f9e8f]'
          "
        >
          {{ seatLabel }}
        </span>
        <span class="text-base font-semibold text-[#2b2a28] dark:text-white">
          消费详情
        </span>
      </div>
    </template>

    <div class="detail-hero">
      <svg class="detail-ring" viewBox="0 0 108 108" aria-hidden="true">
        <circle class="detail-ring__track" cx="54" cy="54" r="46" />
        <circle
          class="detail-ring__value"
          :class="`detail-ring__value--${state}`"
          cx="54"
          cy="54"
          r="46"
          :stroke-dasharray="ringLength"
          :stroke-dashoffset="ringOffset"
        />
      </svg>
      <div class="detail-hero__text">
        <span class="detail-hero__label">
          {{ overtime ? '已超时' : '剩余时长' }}
        </span>
        <span class="detail-hero__time" :class="`is-${state}`">
          {{ countdownText }}
        </span>
        <span class="detail-hero__hint">
          已购 {{ formatMinutes(session?.totalDurationMinutes ?? 0) }}
        </span>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-item__label">客户</span>
        <span class="detail-item__value">{{ session?.customerName }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">手工品类</span>
        <span class="detail-item__value">{{ session?.categoryName }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">开台时间</span>
        <span class="detail-item__value">
          {{ session ? formatUtcDateTime(session.startTime) : '-' }}
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">应结束时间</span>
        <span class="detail-item__value">
          {{ session ? formatUtcDateTime(session.plannedEndTime) : '-' }}
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">购买时长</span>
        <span class="detail-item__value">
          {{ formatMinutes(session?.plannedDurationMinutes ?? 0) }}
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-item__label">累计金额</span>
        <span class="detail-item__value font-mono text-[#2f9e8f]">
          {{ formatCents(session?.totalAmountCents ?? 0) }}
        </span>
      </div>
    </div>

    <div class="extend-panel">
      <div class="extend-panel__head">
        <span class="text-sm font-semibold text-[#2b2a28] dark:text-white">
          续时加钟
        </span>
        <span class="text-xs text-[#8d8579]"> 从当前计划结束时间继续累加 </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="minutes in EXTEND_PRESETS"
          :key="minutes"
          class="extend-chip"
          :class="{ 'extend-chip--active': extendMinutes === minutes }"
          type="button"
          @click="extendMinutes = minutes"
        >
          +{{ minutes }} 分钟
        </button>
        <ElInputNumber
          v-model="extendMinutes"
          :controls="false"
          :min="1"
          :precision="0"
          class="w-24"
          placeholder="分钟"
        />
        <ElInputNumber
          v-model="extendAmountYuan"
          :controls="false"
          :min="0"
          :precision="2"
          class="w-28"
          placeholder="金额（元）"
        />
        <ElButton :loading="extending" size="small" @click="submitExtend">
          确认续时
        </ElButton>
      </div>
    </div>

    <template #footer>
      <ElButton @click="visible = false">关闭</ElButton>
      <ElButton :loading="closing" type="danger" @click="closeSession">
        结束并释放座位
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.detail-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0 14px;
}

.detail-ring {
  width: 150px;
  height: 150px;
  transform: rotate(-90deg);
}

.detail-ring__track {
  fill: none;
  stroke: rgb(120 106 84 / 12%);
  stroke-width: 8;
}

.detail-ring__value {
  fill: none;
  stroke: #2f9e8f;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.9s linear;
}

.detail-ring__value--ending {
  stroke: #e8a33d;
}

.detail-ring__value--overtime {
  stroke: #e4572e;
}

.detail-hero__text {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.detail-hero__label {
  font-size: 11px;
  color: #8d8579;
  letter-spacing: 2px;
}

.detail-hero__time {
  font-family: SFMono-Regular, 'JetBrains Mono', Menlo, monospace;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #2f9e8f;
  letter-spacing: 0.5px;
}

.detail-hero__time.is-ending {
  color: #e8a33d;
}

.detail-hero__time.is-overtime {
  color: #e4572e;
  animation: detail-blink 1.4s ease-in-out infinite;
}

.detail-hero__hint {
  font-size: 11px;
  color: #8d8579;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f9f5ee, #fdfbf7);
  border: 1px solid rgb(160 138 108 / 14%);
  border-radius: 14px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-item__label {
  font-size: 11px;
  color: #8d8579;
}

.detail-item__value {
  font-size: 13px;
  font-weight: 500;
  color: #2b2a28;
}

.extend-panel {
  padding: 12px 16px;
  margin-top: 14px;
  background: rgb(47 158 143 / 6%);
  border: 1px dashed rgb(47 158 143 / 30%);
  border-radius: 14px;
}

.extend-panel__head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 10px;
}

.extend-chip {
  padding: 5px 12px;
  font-size: 12px;
  color: #2f9e8f;
  cursor: pointer;
  background: #fff;
  border: 1px solid rgb(47 158 143 / 30%);
  border-radius: 999px;
  transition: all 0.2s ease;
}

.extend-chip:hover,
.extend-chip--active {
  color: #fff;
  background: linear-gradient(135deg, #34a898, #2f9e8f);
  border-color: transparent;
  box-shadow: 0 6px 14px rgb(47 158 143 / 26%);
}

:global(.dark) .detail-grid {
  background: linear-gradient(135deg, #2b2a28, #232220);
  border-color: rgb(255 255 255 / 8%);
}

:global(.dark) .detail-item__value {
  color: rgb(255 255 255 / 90%);
}

:global(.dark) .detail-item__label,
:global(.dark) .detail-hero__label,
:global(.dark) .detail-hero__hint {
  color: rgb(255 255 255 / 45%);
}

:global(.dark) .extend-panel {
  background: rgb(47 158 143 / 10%);
}

:global(.dark) .extend-chip {
  color: #5bc4b4;
  background: #2b2a28;
}

:global(.dark) .extend-chip:hover,
:global(.dark) .extend-chip--active {
  color: #fff;
}

@keyframes detail-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-hero__time.is-overtime {
    animation: none;
  }
}
</style>
