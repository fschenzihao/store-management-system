<script setup lang="ts">
import type { SeatBoardView } from '../types';

import { computed, ref } from 'vue';

import { useElementSize } from '@vueuse/core';

import { SCENE_HEIGHT, SCENE_WIDTH, TABLE_PROPS } from '../layout';
import BoardSeat from './board-seat.vue';

defineOptions({ name: 'BoardScene' });

defineProps<{ seats: SeatBoardView[] }>();
const emit = defineEmits<{ select: [seat: SeatBoardView] }>();

const wrapper = ref<HTMLElement>();
const { width } = useElementSize(wrapper);
const scale = computed(() => {
  const available = width.value || SCENE_WIDTH;
  return Math.min(Math.max(available / SCENE_WIDTH, 0.45), 1);
});

const wrapperStyle = computed(() => ({
  height: `${SCENE_HEIGHT * scale.value + 8}px`,
}));
const sceneStyle = computed(() => ({
  height: `${SCENE_HEIGHT}px`,
  transform: `scale(${scale.value})`,
  width: `${SCENE_WIDTH}px`,
}));

const gridLines = computed(() => {
  const lines: { x1: number; x2: number; y1: number; y2: number }[] = [];
  for (let x = 90; x < SCENE_WIDTH; x += 90) {
    lines.push({ x1: x, x2: x, y1: 0, y2: SCENE_HEIGHT });
  }
  for (let y = 80; y < SCENE_HEIGHT; y += 80) {
    lines.push({ x1: 0, x2: SCENE_WIDTH, y1: y, y2: y });
  }
  return lines;
});
</script>

<template>
  <div ref="wrapper" class="board-scene" :style="wrapperStyle">
    <div class="board-scene__canvas" :style="sceneStyle">
      <svg
        class="board-scene__backdrop"
        :viewBox="`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="floorFill" x1="0" x2="0.3" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--board-floor-back)" />
            <stop offset="100%" stop-color="var(--board-floor-front)" />
          </linearGradient>
          <radialGradient id="lightPool" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgb(255 236 198 / 50%)" />
            <stop offset="100%" stop-color="rgb(255 236 198 / 0%)" />
          </radialGradient>
        </defs>

        <!-- 顶部灯光光斑 -->
        <ellipse cx="180" cy="150" rx="240" ry="120" fill="url(#lightPool)" />
        <ellipse cx="480" cy="150" rx="240" ry="120" fill="url(#lightPool)" />
        <ellipse cx="780" cy="150" rx="240" ry="120" fill="url(#lightPool)" />
        <ellipse cx="1030" cy="350" rx="220" ry="120" fill="url(#lightPool)" />

        <!-- 地面与网格 -->
        <rect
          x="0"
          y="0"
          :width="SCENE_WIDTH"
          :height="SCENE_HEIGHT"
          fill="url(#floorFill)"
        />
        <g class="board-scene__grid">
          <line
            v-for="(line, index) in gridLines"
            :key="index"
            :x1="line.x1"
            :x2="line.x2"
            :y1="line.y1"
            :y2="line.y2"
            stroke="var(--board-grid)"
            stroke-width="1"
          />
        </g>
        <rect
          x="1"
          y="1"
          :width="SCENE_WIDTH - 2"
          :height="SCENE_HEIGHT - 2"
          fill="none"
          stroke="var(--board-floor-border)"
          stroke-width="2"
          rx="14"
        />

        <!-- 金属货架 -->
        <g>
          <rect
            x="950"
            y="25"
            width="262"
            height="112"
            rx="5"
            fill="var(--board-shelf)"
          />
          <rect
            x="956"
            y="31"
            width="250"
            height="100"
            rx="3"
            fill="none"
            stroke="var(--board-shelf-line)"
          />
          <line
            v-for="i in 22"
            :key="i"
            :x1="956 + i * 10.8"
            y1="31"
            :x2="956 + i * 10.8"
            y2="131"
            stroke="var(--board-shelf-line)"
          />
        </g>
      </svg>

      <!-- 桌面家具 -->
      <div
        v-for="table in TABLE_PROPS"
        :key="table.label"
        class="prop-table"
        :class="`prop-table--${table.kind}`"
        :style="{
          height: `${table.height}px`,
          left: `${table.x - table.width / 2}px`,
          top: `${table.y - table.height / 2}px`,
          width: `${table.width}px`,
        }"
        aria-hidden="true"
      ></div>

      <!-- 前台收银台 -->
      <div class="prop-desk" aria-hidden="true">
        <span class="prop-desk__main"></span>
        <span class="prop-desk__return"></span>
        <span class="prop-desk__screen"></span>
        <span class="prop-desk__screen prop-desk__screen--second"></span>
        <span class="prop-desk__paper"></span>
        <span class="prop-desk__plant"></span>
        <span class="prop-desk__chair"></span>
      </div>

      <BoardSeat
        v-for="seat in seats"
        :key="seat.layout.seatNo"
        :seat="seat"
        @select="emit('select', seat)"
      />
    </div>
  </div>
</template>

<style scoped>
.board-scene {
  --board-floor-back: #f7f3ec;
  --board-floor-front: #efe6d7;
  --board-grid: rgb(148 132 108 / 14%);
  --board-floor-border: rgb(148 132 108 / 22%);
  --board-shelf: #cfd4d6;
  --board-shelf-line: #a9b0b3;
  --board-wood: linear-gradient(135deg, #c98d5a, #a96f42 60%, #8f5a34);
  --board-wood-border: rgb(255 255 255 / 35%);

  position: relative;
  width: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 0%, rgb(255 255 255 / 65%), transparent 55%),
    linear-gradient(180deg, var(--vben-bg, #fbf8f2), transparent 60%);
  border-radius: 18px;
}

.board-scene__canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

.board-scene__backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.board-scene__grid {
  opacity: 0.9;
}

.prop-table {
  position: absolute;
  z-index: 1;
  border-radius: 10px;
}

.prop-table--island {
  background:
    linear-gradient(160deg, rgb(255 255 255 / 30%), transparent 45%),
    var(--board-wood);
  border: 1px solid var(--board-wood-border);
  box-shadow:
    0 14px 24px rgb(70 50 24 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 50%),
    inset 0 0 0 6px rgb(120 78 44 / 18%);
}

.prop-table--bar {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 26%), transparent 40%),
    var(--board-wood);
  border: 1px solid var(--board-wood-border);
  border-radius: 12px;
  box-shadow:
    0 14px 24px rgb(70 50 24 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 50%),
    inset 0 0 0 6px rgb(120 78 44 / 16%);
}

.prop-desk {
  position: absolute;
  top: 380px;
  left: 950px;
  z-index: 1;
  width: 270px;
  height: 85px;
}

.prop-desk__main {
  position: absolute;
  inset: 0;
  background: var(--board-wood);
  background-repeat: no-repeat;
  background-size: 270px 164px;
  border: 1px solid var(--board-wood-border);
  border-radius: 10px 10px 10px 0;
  box-shadow:
    0 14px 24px rgb(70 50 24 / 24%),
    inset 0 1px 0 rgb(255 255 255 / 55%);
}

.prop-desk__return {
  position: absolute;
  top: 83px;
  left: 0;
  width: 72px;
  height: 81px;
  background: var(--board-wood);
  background-repeat: no-repeat;
  background-position: 0 -82px;
  background-size: 270px 164px;
  border: 1px solid var(--board-wood-border);
  border-top: 0;
  border-radius: 0 0 10px 10px;
  box-shadow: 0 12px 20px -8px rgb(70 50 24 / 30%);
}

.prop-desk__screen {
  position: absolute;
  top: 18px;
  left: 60px;
  width: 52px;
  height: 40px;
  background: linear-gradient(160deg, #46555c, #22292d);
  border: 2px solid #ece7dc;
  border-radius: 6px;
  box-shadow: 0 4px 8px rgb(30 22 12 / 30%);
  transform: rotate(-8deg);
}

.prop-desk__screen--second {
  top: 22px;
  left: 128px;
  width: 44px;
  height: 34px;
  transform: rotate(6deg);
}

.prop-desk__paper {
  position: absolute;
  top: 30px;
  left: 196px;
  width: 34px;
  height: 26px;
  background: #fdfbf6;
  border: 1px solid rgb(120 106 84 / 30%);
  border-radius: 3px;
  transform: rotate(12deg);
}

.prop-desk__plant {
  position: absolute;
  top: 24px;
  left: 240px;
  width: 26px;
  height: 26px;
  background:
    radial-gradient(circle at 50% 32%, #4f9a6d 0 40%, transparent 42%),
    radial-gradient(circle at 32% 58%, #3f885c 0 32%, transparent 34%),
    radial-gradient(circle at 68% 60%, #5aa978 0 32%, transparent 34%);
  border-radius: 50%;
}

.prop-desk__chair {
  position: absolute;
  top: 100px;
  left: 150px;
  width: 52px;
  height: 52px;
  background: radial-gradient(circle at 50% 45%, #efe9dc 0 58%, #cfc7b6 60%);
  border-radius: 50%;
  box-shadow: 0 8px 14px rgb(60 48 32 / 20%);
}

:global(.dark) .board-scene {
  --board-floor-back: #2b2a28;
  --board-floor-front: #35322e;
  --board-grid: rgb(255 255 255 / 7%);
  --board-floor-border: rgb(255 255 255 / 10%);
  --board-shelf: #4a4b4d;
  --board-shelf-line: #616467;
  --board-wood: linear-gradient(135deg, #8a5c38, #6f4628 60%, #5c3a20);
  --board-wood-border: rgb(255 255 255 / 12%);

  background:
    radial-gradient(circle at 20% 0%, rgb(255 255 255 / 6%), transparent 55%),
    linear-gradient(180deg, #232220, transparent 60%);
}
</style>
