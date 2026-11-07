<script setup lang="ts">
import type { SeatBoardView, SeatState } from './types';

import type { TableBoardItem, TableBoardResult } from '#/api/store';

import { computed, onMounted, ref } from 'vue';

import { useEventListener, useIntervalFn } from '@vueuse/core';
import { ElButton } from 'element-plus';

import { getTableBoardApi } from '#/api/store';

import { formatCents } from '../shared';
import BoardScene from './components/board-scene.vue';
import OpenSessionDialog from './components/open-session-dialog.vue';
import SessionDetailDialog from './components/session-detail-dialog.vue';
import { ENDING_SOON_MS, getSeatLayout, TOTAL_SEATS } from './layout';
import {
  formatCountdown,
  formatLocalClock,
  formatMinutes,
  useBoardClock,
} from './use-board-clock';

defineOptions({ name: 'StoreTableBoard' });

const REFRESH_INTERVAL = 30_000;

const board = ref<null | TableBoardResult>(null);
const loading = ref(true);
const refreshing = ref(false);
const lastSyncedAt = ref<null | number>(null);
const detailVisible = ref(false);
const detailSeat = ref<null | TableBoardItem>(null);
const openDialog = ref<InstanceType<typeof OpenSessionDialog>>();

const clock = useBoardClock();

function resolveState(remainingMs: number, plannedMinutes: number): SeatState {
  if (remainingMs <= 0) {
    return 'overtime';
  }
  const totalMs = Math.max(plannedMinutes, 1) * 60_000;
  if (remainingMs <= ENDING_SOON_MS || remainingMs / totalMs <= 0.2) {
    return 'ending';
  }
  return 'active';
}

async function loadBoard(silent = false) {
  if (!silent) {
    loading.value = board.value === null;
  }
  refreshing.value = true;
  try {
    const result = await getTableBoardApi();
    board.value = result;
    clock.syncServerTime(result.serverTime);
    lastSyncedAt.value = Date.now();
    const current = detailSeat.value;
    if (current) {
      const latest = result.tables.find(
        (item) => item.tableId === current.tableId,
      );
      if (latest?.session) {
        detailSeat.value = latest;
      } else {
        detailVisible.value = false;
        detailSeat.value = null;
      }
    }
  } catch {
    // 业务错误由请求层统一提示，保留当前看板数据
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

const seats = computed<SeatBoardView[]>(() =>
  (board.value?.tables ?? []).map((item) => {
    const layout = getSeatLayout(item.seatNo);
    if (!item.session) {
      return {
        item,
        layout,
        progress: 0,
        remainingMs: 0,
        state: 'free' as const,
        timeText: '点击开台',
      };
    }
    const remainingMs = clock.remainingMs(item.session.plannedEndTime);
    const totalMs = Math.max(item.session.plannedDurationMinutes, 1) * 60_000;
    return {
      item,
      layout,
      progress: Math.min(Math.max(remainingMs / totalMs, 0), 1),
      remainingMs,
      state: resolveState(remainingMs, item.session.plannedDurationMinutes),
      timeText:
        remainingMs <= 0
          ? `+${formatCountdown(-remainingMs)}`
          : formatCountdown(remainingMs),
    };
  }),
);

const stats = computed(() => {
  const counters = { active: 0, ending: 0, free: 0, overtime: 0 };
  for (const seat of seats.value) {
    counters[seat.state] += 1;
  }
  return counters;
});

const summary = computed(() => board.value?.summary);
const clockText = computed(() =>
  formatLocalClock(clock.nowMs.value + clock.offsetMs.value),
);
const todayText = computed(() => {
  const date = new Date();
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
});
const syncedText = computed(() =>
  lastSyncedAt.value === null
    ? '尚未同步'
    : formatLocalClock(lastSyncedAt.value + clock.offsetMs.value),
);

const detailRemainingMs = computed(() => {
  const session = detailSeat.value?.session;
  return session ? clock.remainingMs(session.plannedEndTime) : 0;
});
const detailState = computed(() =>
  resolveState(
    detailRemainingMs.value,
    detailSeat.value?.session?.plannedDurationMinutes ?? 0,
  ),
);

function handleSelect(seat: SeatBoardView) {
  if (seat.item.session) {
    detailSeat.value = seat.item;
    detailVisible.value = true;
    return;
  }
  openDialog.value?.open(seat.item);
}

function handleSuccess() {
  loadBoard(true);
}

useIntervalFn(
  () => {
    if (!document.hidden) {
      loadBoard(true);
    }
  },
  REFRESH_INTERVAL,
  { immediate: false },
);
useEventListener(document, 'visibilitychange', () => {
  if (!document.hidden) {
    loadBoard(true);
  }
});
useEventListener(window, 'focus', () => loadBoard(true));

onMounted(() => loadBoard());
</script>

<template>
  <div class="board-page">
    <header class="board-header">
      <div class="board-header__main">
        <div class="board-header__title">
          <span class="board-header__eyebrow">STORE / FLOOR BOARD</span>
          <h1>桌位看板</h1>
          <p>
            {{ todayText }} · 今日营业中 ·
            <span class="font-mono">{{ clockText }}</span>
          </p>
        </div>
        <div class="board-header__actions">
          <span class="board-sync">
            <i class="board-sync__dot"></i>
            {{ refreshing ? '同步中…' : `${syncedText} 已同步` }}
          </span>
          <ElButton :loading="refreshing" size="small" @click="loadBoard(true)">
            刷新
          </ElButton>
        </div>
      </div>

      <div class="board-stats">
        <div class="board-stat board-stat--free">
          <span class="board-stat__value">{{ stats.free }}<em>/{{ TOTAL_SEATS }}</em></span>
          <span class="board-stat__label">空闲</span>
        </div>
        <div class="board-stat board-stat--active">
          <span class="board-stat__value">{{ stats.active }}</span>
          <span class="board-stat__label">使用中</span>
        </div>
        <div class="board-stat board-stat--ending">
          <span class="board-stat__value">{{ stats.ending }}</span>
          <span class="board-stat__label">即将结束</span>
        </div>
        <div class="board-stat board-stat--overtime">
          <span class="board-stat__value">{{ stats.overtime }}</span>
          <span class="board-stat__label">已超时</span>
        </div>
        <div class="board-stat__meta">
          <span>
            今日开台
            <b>{{ summary?.todaySessionCount ?? 0 }}</b> 次
          </span>
          <span>
            累计消费
            <b>{{ formatCents(summary?.todayTotalAmountCents ?? 0) }}</b>
          </span>
          <span>
            累计时长
            <b>{{ formatMinutes(summary?.todayDurationMinutes ?? 0) }}</b>
          </span>
        </div>
      </div>
    </header>

    <section class="board-stage">
      <div class="board-stage__head">
        <div>
          <h2>店内俯视看板</h2>
          <p>
            上排三组四人桌、下排吧台长桌；点击空闲座位开台，使用中的座位可查看详情、续时或结束。
          </p>
        </div>
        <div class="board-legend">
          <span><i class="legend-dot legend-dot--free"></i>空闲</span>
          <span><i class="legend-dot legend-dot--active"></i>使用中</span>
          <span><i class="legend-dot legend-dot--ending"></i>即将结束</span>
          <span><i class="legend-dot legend-dot--overtime"></i>已超时</span>
        </div>
      </div>

      <div v-if="loading" class="board-skeleton">
        <span
          v-for="index in 6"
          :key="index"
          class="board-skeleton__cell"
        ></span>
      </div>
      <BoardScene v-else :seats="seats" @select="handleSelect" />

      <footer class="board-stage__foot">
        <span>共 {{ TOTAL_SEATS }} 个座位 · 上排 A/B/C 三组四人桌 12 座 · 下排吧台
          6 座</span>
        <span>看板每 30 秒自动同步，操作成功后即时刷新对应座位</span>
      </footer>
    </section>

    <OpenSessionDialog ref="openDialog" @success="handleSuccess" />
    <SessionDetailDialog
      v-model="detailVisible"
      :remaining-ms="detailRemainingMs"
      :seat="detailSeat"
      :state="detailState"
      @success="handleSuccess"
    />
  </div>
</template>

<style scoped>
.board-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 4px 4px 24px;
}

.board-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px 18px;
  background:
    radial-gradient(circle at 92% 0%, rgb(216 185 142 / 22%), transparent 45%),
    linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(250 246 238 / 88%));
  border: 1px solid rgb(214 200 178 / 55%);
  border-radius: 20px;
  box-shadow: 0 18px 38px -26px rgb(72 54 30 / 45%);
}

.board-header__main {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.board-header__eyebrow {
  font-size: 10px;
  font-weight: 600;
  color: rgb(47 158 143 / 75%);
  letter-spacing: 3px;
}

.board-header__title h1 {
  margin: 4px 0 2px;
  font-size: 22px;
  font-weight: 600;
  color: #2b2a28;
  letter-spacing: 0.5px;
}

.board-header__title p {
  font-size: 12px;
  color: #6f685c;
}

.board-header__actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.board-sync {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  color: #6f685c;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(214 200 178 / 45%);
  border-radius: 999px;
}

.board-sync__dot {
  width: 6px;
  height: 6px;
  background: #3fae73;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(63 174 115 / 18%);
  animation: sync-breathe 2.4s ease-in-out infinite;
}

.board-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.board-stat {
  --stat-accent: rgb(168 161 150);
  --stat-fill-start: rgb(168 161 150 / 22%);
  --stat-fill-end: rgb(255 255 255 / 92%);
  --stat-glow: rgb(96 88 74 / 40%);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 92px;
  padding: 9px 15px 9px 16px;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    var(--stat-fill-start),
    var(--stat-fill-end) 78%
  );
  border: 2px solid var(--stat-accent);
  border-left-width: 5px;
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 65%),
    0 10px 22px -16px var(--stat-glow);
}

.board-stat__value {
  font-family: SFMono-Regular, 'JetBrains Mono', Menlo, monospace;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: #2b2a28;
}

.board-stat__value em {
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  color: #9c958a;
}

.board-stat__label {
  font-size: 11px;
  color: #6f685c;
  letter-spacing: 1px;
}

.board-stat--free {
  --stat-accent: #8f887b;
  --stat-fill-start: rgb(143 136 123 / 26%);
  --stat-fill-end: rgb(255 255 255 / 92%);
  --stat-glow: rgb(96 88 74 / 42%);
}

.board-stat--active {
  --stat-accent: #25907f;
  --stat-fill-start: rgb(37 144 127 / 30%);
  --stat-fill-end: rgb(255 255 255 / 90%);
  --stat-glow: rgb(37 144 127 / 50%);
}

.board-stat--active .board-stat__value {
  color: #1f8272;
}

.board-stat--ending {
  --stat-accent: #d98f22;
  --stat-fill-start: rgb(232 163 61 / 34%);
  --stat-fill-end: rgb(255 255 255 / 90%);
  --stat-glow: rgb(217 143 34 / 50%);
}

.board-stat--ending .board-stat__value {
  color: #b1710f;
}

.board-stat--overtime {
  --stat-accent: #d8481f;
  --stat-fill-start: rgb(228 87 46 / 30%);
  --stat-fill-end: rgb(255 255 255 / 90%);
  --stat-glow: rgb(216 72 31 / 48%);
}

.board-stat--overtime .board-stat__value {
  color: #c03f18;
}

.board-stat__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-left: auto;
  font-size: 11px;
  color: #8d8579;
}

.board-stat__meta b {
  font-family: SFMono-Regular, 'JetBrains Mono', Menlo, monospace;
  font-weight: 600;
  color: #4b463f;
}

.board-stage {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 16px 18px 12px;
  background:
    radial-gradient(circle at 12% 0%, rgb(255 255 255 / 80%), transparent 40%),
    linear-gradient(160deg, #fdfaf4, #f6efe4);
  border: 1px solid rgb(214 200 178 / 55%);
  border-radius: 20px;
  box-shadow: 0 22px 44px -30px rgb(72 54 30 / 55%);
}

.board-stage__head {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 4px 8px;
}

.board-stage__head h2 {
  font-size: 15px;
  font-weight: 600;
  color: #2b2a28;
  letter-spacing: 0.5px;
}

.board-stage__head p {
  margin-top: 2px;
  font-size: 11px;
  color: #8d8579;
}

.board-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #6f685c;
}

.board-legend span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.legend-dot--free {
  background: #b3ab9e;
}

.legend-dot--active {
  background: #2f9e8f;
  box-shadow: 0 0 0 3px rgb(47 158 143 / 15%);
}

.legend-dot--ending {
  background: #e8a33d;
  box-shadow: 0 0 0 3px rgb(232 163 61 / 16%);
}

.legend-dot--overtime {
  background: #e4572e;
  box-shadow: 0 0 0 3px rgb(228 87 46 / 16%);
}

.board-stage__foot {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  padding: 6px 4px 2px;
  font-size: 11px;
  color: #9c958a;
}

.board-skeleton {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  height: 520px;
  padding: 20px;
}

.board-skeleton__cell {
  background: linear-gradient(
    100deg,
    rgb(230 222 208 / 45%) 20%,
    rgb(244 238 228 / 75%) 40%,
    rgb(230 222 208 / 45%) 60%
  );
  background-size: 220% 100%;
  border-radius: 14px;
  animation: skeleton-sweep 1.6s linear infinite;
}

:global(.dark) .board-header {
  background:
    radial-gradient(circle at 92% 0%, rgb(216 185 142 / 12%), transparent 45%),
    linear-gradient(135deg, rgb(43 42 40 / 94%), rgb(35 34 32 / 92%));
  border-color: rgb(255 255 255 / 8%);
}

:global(.dark) .board-header__title h1,
:global(.dark) .board-stage__head h2 {
  color: rgb(255 255 255 / 92%);
}

:global(.dark) .board-header__title p,
:global(.dark) .board-stage__head p,
:global(.dark) .board-legend,
:global(.dark) .board-stat__label,
:global(.dark) .board-stage__foot {
  color: rgb(255 255 255 / 50%);
}

:global(.dark) .board-sync {
  background: rgb(255 255 255 / 4%);
  border-color: rgb(255 255 255 / 8%);
}

:global(.dark) .board-stat {
  background: linear-gradient(
    135deg,
    var(--stat-fill-start),
    rgb(255 255 255 / 4%) 78%
  );
  border-color: var(--stat-accent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 8%),
    0 12px 24px -18px rgb(0 0 0 / 75%);
}

:global(.dark) .board-stat__value {
  color: rgb(255 255 255 / 92%);
}

:global(.dark) .board-stat--active .board-stat__value {
  color: #5cc9b8;
}

:global(.dark) .board-stat--ending .board-stat__value {
  color: #f0b355;
}

:global(.dark) .board-stat--overtime .board-stat__value {
  color: #ff7a4f;
}

:global(.dark) .board-stat__meta b {
  color: rgb(255 255 255 / 78%);
}

:global(.dark) .board-stage {
  background:
    radial-gradient(circle at 12% 0%, rgb(255 255 255 / 6%), transparent 40%),
    linear-gradient(160deg, #262523, #201f1d);
  border-color: rgb(255 255 255 / 8%);
}

:global(.dark) .board-skeleton__cell {
  background: linear-gradient(
    100deg,
    rgb(255 255 255 / 4%) 20%,
    rgb(255 255 255 / 9%) 40%,
    rgb(255 255 255 / 4%) 60%
  );
  background-size: 220% 100%;
}

@keyframes sync-breathe {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@keyframes skeleton-sweep {
  0% {
    background-position: 120% 0;
  }

  100% {
    background-position: -120% 0;
  }
}

@media (max-width: 900px) {
  .board-header__main {
    flex-direction: column;
  }

  .board-stat__meta {
    margin-left: 0;
  }

  .board-skeleton {
    grid-template-columns: repeat(3, 1fr);
    height: 420px;
  }
}
</style>
