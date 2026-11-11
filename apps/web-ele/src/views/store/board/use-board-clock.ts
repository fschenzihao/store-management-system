import { onScopeDispose, ref } from 'vue';

import { useIntervalFn } from '@vueuse/core';

/**
 * 看板倒计时时钟。
 *
 * 服务端时间统一为 UTC 文本（YYYY-MM-DD HH:MM:SS），接口返回 serverTime 后计算
 * 与本机时钟的偏移，倒计时始终基于服务端时间，避免门店终端时间不准。
 * 全页共用一个 1 秒 ticker，不为每个座位单独创建定时器。
 */
export function parseUtcTimestamp(value: string): number {
  if (!value) {
    return Number.NaN;
  }
  return new Date(`${value.replace(' ', 'T')}Z`).getTime();
}

/** 毫秒 → mm:ss（超过 1 小时显示 h:mm:ss）。 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** 本地时间 → HH:mm:ss，用于标题栏时钟。 */
export function formatLocalClock(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 分钟 → 「1 小时 30 分」 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) {
    return '0 分钟';
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} 分钟`;
  }
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`;
}

export function useBoardClock() {
  const nowMs = ref(Date.now());
  /** 服务端时间 - 本机时间 */
  const offsetMs = ref(0);

  const { pause, resume } = useIntervalFn(
    () => {
      nowMs.value = Date.now();
    },
    1000,
    { immediateCallback: false },
  );

  onScopeDispose(pause);

  function syncServerTime(serverTime: string) {
    const parsed = parseUtcTimestamp(serverTime);
    if (Number.isNaN(parsed)) {
      return;
    }
    offsetMs.value = parsed - Date.now();
    nowMs.value = Date.now();
  }

  /** 校准后的服务端当前时间 */
  function serverNow(): number {
    return nowMs.value + offsetMs.value;
  }

  function remainingMs(plannedEndTime: string): number {
    const end = parseUtcTimestamp(plannedEndTime);
    if (Number.isNaN(end)) {
      return 0;
    }
    return end - serverNow();
  }

  /** 实际计时模式：从开台时间到服务端当前时间的已用毫秒数 */
  function elapsedMs(startTime: string): number {
    const start = parseUtcTimestamp(startTime);
    if (Number.isNaN(start)) {
      return 0;
    }
    return Math.max(serverNow() - start, 0);
  }

  return {
    elapsedMs,
    nowMs,
    offsetMs,
    pause,
    remainingMs,
    resume,
    serverNow,
    syncServerTime,
  };
}
