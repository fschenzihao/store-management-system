<script setup lang="ts">
import type { SeatBoardView } from '../types';

import { computed } from 'vue';

defineOptions({ name: 'BoardSeat' });

const props = defineProps<{ seat: SeatBoardView }>();
const emit = defineEmits<{ select: [] }>();

const layout = computed(() => props.seat.layout);
const seatCode = computed(() => String(layout.value.seatNo).padStart(2, '0'));
const customerName = computed(
  () => props.seat.item.session?.customerName ?? '空位',
);
const tilt = computed(() => layout.value.board.rotate);
const ringLength = 94.2;
const ringOffset = computed(
  () => ringLength * (1 - Math.min(Math.max(props.seat.progress, 0), 1)),
);

const rootStyle = computed(() => ({
  left: `${layout.value.x}px`,
  top: `${layout.value.y}px`,
}));
const chairStyle = computed(() => ({
  transform: `translate(${layout.value.chair.x}px, ${layout.value.chair.y}px)`,
}));
const boardStyle = computed(() => ({
  transform: `translate(${layout.value.board.x}px, ${layout.value.board.y}px) rotate(${tilt.value}deg)`,
}));
const badgeStyle = computed(() => ({
  transform: `translate(${layout.value.badge.x}px, ${layout.value.badge.y}px)`,
}));

const ariaLabel = computed(() => {
  const base = `${layout.value.label}，${props.seat.state === 'free' ? '空闲' : customerName.value}`;
  return props.seat.state === 'free'
    ? `${base}，点击开台`
    : `${base}，剩余 ${props.seat.timeText}`;
});
</script>

<template>
  <button
    class="seat"
    :class="`seat--${seat.state}`"
    :style="rootStyle"
    :aria-label="ariaLabel"
    type="button"
    @click="emit('select')"
  >
    <span class="seat__pad" aria-hidden="true"></span>
    <span class="seat__chair" :style="chairStyle" aria-hidden="true"></span>
    <span class="seat__board" :style="boardStyle" aria-hidden="true">
      <span class="seat__peg"></span>
      <span class="seat__peg"></span>
      <span class="seat__peg"></span>
      <span class="seat__peg"></span>
    </span>

    <span class="seat__badge" :style="badgeStyle">
      <span class="seat__badge-head">
        <span class="seat__no">{{ seatCode }}</span>
        <span class="seat__name">{{ customerName }}</span>
        <span class="seat__dot" aria-hidden="true"></span>
      </span>
      <span class="seat__badge-body">
        <span class="seat__time">{{ seat.timeText }}</span>
        <svg class="seat__ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle class="seat__ring-track" cx="18" cy="18" r="15" />
          <circle
            class="seat__ring-value"
            cx="18"
            cy="18"
            r="15"
            :stroke-dasharray="ringLength"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
      </span>
    </span>
  </button>
</template>

<style scoped>
.seat {
  --seat-accent: #8d8579;
  --seat-glow: rgb(141 133 121 / 0%);

  position: absolute;
  z-index: 3;
  width: 1px;
  height: 1px;
  padding: 0;
  cursor: pointer;
  outline: none;
  background: none;
  border: 0;
  transform: translateZ(0);
}

.seat--active {
  --seat-accent: #2f9e8f;
  --seat-glow: rgb(47 158 143 / 45%);
}

.seat--ending {
  --seat-accent: #e8a33d;
  --seat-glow: rgb(232 163 61 / 55%);
}

.seat--overtime {
  --seat-accent: #e4572e;
  --seat-glow: rgb(228 87 46 / 60%);
}

.seat__pad {
  position: absolute;
  top: -22px;
  left: -30px;
  width: 60px;
  height: 42px;
  background: radial-gradient(
    ellipse at center,
    rgb(43 34 24 / 22%),
    transparent 70%
  );
  border-radius: 50%;
  filter: blur(2px);
}

.seat__chair {
  position: absolute;
  top: -14px;
  left: -14px;
  width: 28px;
  height: 26px;
  background: linear-gradient(165deg, #fffdf8, #e6ddcd);
  border: 1px solid rgb(160 148 128 / 45%);
  border-radius: 8px;
  box-shadow:
    0 4px 8px rgb(60 48 32 / 22%),
    inset 0 0 0 3px rgb(255 255 255 / 55%);
  transition: transform 0.25s ease;
}

.seat__board {
  position: absolute;
  top: -14px;
  left: -20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  width: 40px;
  height: 28px;
  padding: 3px;
  background: linear-gradient(155deg, #f6f4ee 0%, #d9d4c7 55%, #bdb7a8 100%);
  border-radius: 4px;
  box-shadow:
    0 5px 9px rgb(62 50 34 / 25%),
    inset 0 1px 0 rgb(255 255 255 / 85%);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.seat--active .seat__board,
.seat--ending .seat__board,
.seat--overtime .seat__board {
  box-shadow:
    0 5px 9px rgb(62 50 34 / 25%),
    inset 0 1px 0 rgb(255 255 255 / 85%),
    0 0 14px var(--seat-glow);
}

.seat__peg {
  background:
    radial-gradient(circle at 30% 30%, #6f665a 0 30%, transparent 32%),
    linear-gradient(150deg, #3b3733, #2b2825);
  border-radius: 2px;
  opacity: 0.92;
}

.seat__badge {
  --badge-accent: var(--seat-accent);
  --badge-ink: var(--seat-accent);
  --badge-fill-start: rgb(141 133 121 / 22%);
  --badge-fill-end: rgb(255 255 255 / 92%);
  --badge-glow: rgb(96 88 74 / 40%);
  --badge-tint: rgb(255 255 255 / 12%);

  position: absolute;
  top: -26px;
  left: -58px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 116px;
  padding: 5px 6px 4px;
  color: #2b2a28;
  background:
    linear-gradient(160deg, var(--badge-fill-start), var(--badge-fill-end) 78%),
    rgb(251 247 240 / 96%);
  border: 1px solid var(--badge-accent);
  border-radius: 10px;
  box-shadow:
    0 8px 18px rgb(30 22 12 / 28%),
    inset 0 1px 0 rgb(255 255 255 / 12%);
  backdrop-filter: blur(6px);
  transition:
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.seat--free .seat__badge {
  color: #6f685c;
  background: linear-gradient(
    160deg,
    rgb(250 246 238 / 94%),
    rgb(240 233 221 / 88%)
  );
  border-color: rgb(120 106 84 / 18%);
}

.seat--active .seat__badge {
  --badge-accent: #25907f;
  --badge-ink: #1f8272;
  --badge-fill-start: rgb(37 144 127 / 30%);
  --badge-fill-end: rgb(255 255 255 / 90%);
  --badge-glow: rgb(37 144 127 / 50%);
  --badge-tint: rgb(37 144 127 / 14%);
}

.seat--ending .seat__badge {
  --badge-accent: #d98f22;
  --badge-ink: #b1710f;
  --badge-fill-start: rgb(232 163 61 / 34%);
  --badge-fill-end: rgb(255 255 255 / 90%);
  --badge-glow: rgb(217 143 34 / 50%);
  --badge-tint: rgb(217 143 34 / 16%);

  animation: seat-breathe 2s ease-in-out infinite;
}

.seat--overtime .seat__badge {
  --badge-accent: #d8481f;
  --badge-ink: #c03f18;
  --badge-fill-start: rgb(228 87 46 / 30%);
  --badge-fill-end: rgb(255 255 255 / 90%);
  --badge-glow: rgb(216 72 31 / 48%);
  --badge-tint: rgb(216 72 31 / 14%);

  animation: seat-alert 1.2s ease-in-out infinite;
}

.seat--active .seat__badge,
.seat--ending .seat__badge,
.seat--overtime .seat__badge {
  border-color: var(--badge-accent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 65%),
    0 10px 22px -16px var(--badge-glow);
}

.seat__badge-head {
  display: flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
}

.seat__no {
  flex: none;
  padding: 0 4px;
  font-size: 9px;
  font-weight: 600;
  line-height: 14px;
  color: var(--badge-ink);
  background: var(--badge-tint);
  border-radius: 3px;
}

.seat--free .seat__no {
  background: rgb(120 106 84 / 10%);
}

.seat__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  white-space: nowrap;
}

.seat__dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-left: auto;
  background: var(--badge-accent);
  border-radius: 50%;
}

.seat--active .seat__dot,
.seat--ending .seat__dot,
.seat--overtime .seat__dot {
  box-shadow: 0 0 0 3px var(--seat-glow);
  animation: seat-pulse 2.4s ease-in-out infinite;
}

.seat--ending .seat__dot {
  animation-duration: 1.4s;
}

.seat--overtime .seat__dot {
  animation-duration: 0.9s;
}

.seat__badge-body {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: space-between;
}

.seat__time {
  flex: 1;
  min-width: 0;
  font-family: SFMono-Regular, 'JetBrains Mono', Menlo, monospace;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  color: var(--badge-ink);
  letter-spacing: 0.4px;
  white-space: nowrap;
}

.seat--free .seat__time {
  font-family: inherit;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
}

.seat__ring {
  flex: none;
  width: 20px;
  height: 20px;
  transform: rotate(-90deg);
}

.seat__ring-track {
  fill: none;
  stroke: rgb(43 42 40 / 12%);
  stroke-width: 3;
}

.seat--free .seat__ring-track {
  stroke: rgb(120 106 84 / 15%);
}

.seat__ring-value {
  fill: none;
  stroke: var(--badge-accent);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.9s linear;
}

.seat--free .seat__ring-value {
  display: none;
}

.seat:hover .seat__badge {
  border-color: rgb(255 255 255 / 28%);
  box-shadow:
    0 12px 22px rgb(30 22 12 / 34%),
    inset 0 1px 0 rgb(255 255 255 / 16%);
}

.seat--active:hover .seat__badge,
.seat--ending:hover .seat__badge,
.seat--overtime:hover .seat__badge {
  border-color: var(--badge-accent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 65%),
    0 12px 24px -14px var(--badge-glow);
}

.seat:hover .seat__board {
  filter: brightness(1.08);
}

.seat:hover .seat__chair {
  box-shadow:
    0 7px 12px rgb(60 48 32 / 28%),
    inset 0 -3px 0 rgb(190 178 158 / 35%);
}

.seat:focus-visible .seat__badge {
  outline: 2px solid var(--badge-accent);
  outline-offset: 2px;
}

@keyframes seat-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.55;
    transform: scale(0.82);
  }
}

@keyframes seat-breathe {
  0%,
  100% {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 65%),
      0 10px 22px -16px rgb(217 143 34 / 45%);
  }

  50% {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 65%),
      0 12px 26px -14px rgb(217 143 34 / 60%);
  }
}

@keyframes seat-alert {
  0%,
  100% {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 65%),
      0 10px 22px -16px rgb(216 72 31 / 48%);
  }

  50% {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 65%),
      0 12px 26px -14px rgb(216 72 31 / 62%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .seat--active .seat__dot,
  .seat--ending .seat__dot,
  .seat--overtime .seat__dot,
  .seat--ending .seat__badge,
  .seat--overtime .seat__badge {
    animation: none;
  }
}
</style>
