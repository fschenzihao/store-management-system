// @vitest-environment node

import type BetterSqlite3 from 'better-sqlite3';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listConsumptionRecordsByCustomer } from '../db/dal/consumption-record.ts';
import { createCraftCategory } from '../db/dal/craft-category.ts';
import { getCustomerAccount } from '../db/dal/customer-account.ts';
import { createCustomer } from '../db/dal/customer.ts';
import { BusinessError } from '../db/dal/shared.ts';
import {
  getActiveTableSession,
  getTableBoardSummary,
  listTableBoard,
} from '../db/dal/table-session.ts';
import {
  closeTableSession,
  extendTableSession,
  openTableSession,
  settleTableSession,
} from '../db/table-session-transactions.ts';
import { createRecharge } from '../db/transactions.ts';
import { createTestDatabase } from './helpers/database.ts';

const UTC_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function captureError(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error('预期操作失败，但实际执行成功');
}

describe('开台会话事务', () => {
  let categoryId: number;
  let customerId: number;
  let database: BetterSqlite3.Database;

  beforeEach(() => {
    database = createTestDatabase();
    for (let seatNo = 1; seatNo <= 18; seatNo += 1) {
      database
        .prepare('INSERT INTO store_table (table_id, seat_no) VALUES (?, ?)')
        .run(seatNo, seatNo);
    }
    customerId = createCustomer(database, {
      customerName: '开台客户',
      customerPhone: '13800000011',
    }).customer.customerId;
    categoryId = createCraftCategory(database, {
      categoryName: '拼豆',
    }).categoryId;
    createRecharge(database, {
      amountCents: 50_000,
      customerId,
      platform: '微信',
    });
  });

  afterEach(() => {
    database.close();
  });

  it('开台只写入会话，不写消费流水也不扣余额', () => {
    const session = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 90,
      estimatedAmountCents: 5800,
      tableId: 7,
    });

    expect(session).toMatchObject({
      categoryId,
      customerId,
      plannedDurationMinutes: 90,
      status: 1,
      tableId: 7,
      totalAmountCents: 5800,
      totalDurationMinutes: 90,
    });
    expect(session.startTime).toMatch(UTC_TIME_PATTERN);
    expect(session.plannedEndTime).toMatch(UTC_TIME_PATTERN);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('开台不校验余额：预估金额超过余额仍可开台', () => {
    const session = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 60_000,
      tableId: 2,
    });

    expect(session.totalAmountCents).toBe(60_000);
    expect(getActiveTableSession(database, 2)?.sessionId).toBe(
      session.sessionId,
    );
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('同一座位重复开台返回 TABLE_OCCUPIED', () => {
    openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 1000,
      tableId: 3,
    });

    const error = captureError(() =>
      openTableSession(database, {
        categoryId,
        customerId,
        durationMinutes: 60,
        estimatedAmountCents: 1000,
        tableId: 3,
      }),
    );
    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'TABLE_OCCUPIED' });
  });

  it('同桌的其他座位可以同时开台', () => {
    const first = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 1000,
      tableId: 8,
    });
    const second = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 1000,
      tableId: 9,
    });

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(getActiveTableSession(database, 8)?.sessionId).toBe(first.sessionId);
    expect(getActiveTableSession(database, 9)?.sessionId).toBe(
      second.sessionId,
    );
  });

  it('续时只累计计划结束时间、时长与金额，不扣款不写流水', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 2000,
      tableId: 12,
    });

    const extended = extendTableSession(database, opened.sessionId, {
      durationMinutes: 30,
      estimatedAmountCents: 1500,
    });

    expect(extended.plannedDurationMinutes).toBe(90);
    expect(extended.totalDurationMinutes).toBe(90);
    expect(extended.totalAmountCents).toBe(3500);
    expect(extended.plannedEndTime > opened.plannedEndTime).toBe(true);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('结账按实收金额写流水、扣款并结束会话', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 90,
      estimatedAmountCents: 5800,
      tableId: 15,
    });

    const result = settleTableSession(database, opened.sessionId, {
      amountCents: 5800,
    });

    expect(result.session.status).toBe(2);
    expect(result.session.closeTime).toMatch(UTC_TIME_PATTERN);
    expect(getActiveTableSession(database, 15)).toBeNull();
    expect(result.account.balanceCents).toBe(44_200);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(44_200);
    expect(result.consumptionRecord).toMatchObject({
      categoryId,
      consumptionAmountCents: 5800,
      customerId,
      durationMinutes: 90,
      sessionId: opened.sessionId,
      tableNumber: 15,
    });
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      1,
    );
  });

  it('结账允许下调实收金额（折扣）并按实收扣款', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 5000,
      tableId: 4,
    });

    const result = settleTableSession(database, opened.sessionId, {
      amountCents: 3000,
    });

    expect(result.consumptionRecord.consumptionAmountCents).toBe(3000);
    expect(result.account.balanceCents).toBe(47_000);
  });

  it('结账金额超过应付金额被拒绝且不产生任何变更', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 2000,
      tableId: 6,
    });

    const error = captureError(() =>
      settleTableSession(database, opened.sessionId, { amountCents: 2500 }),
    );

    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'INVALID_INPUT' });
    expect(getActiveTableSession(database, 6)?.sessionId).toBe(
      opened.sessionId,
    );
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('余额不足时结账失败，座位保持占用且不写流水', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 60_000,
      tableId: 1,
    });

    const error = captureError(() =>
      settleTableSession(database, opened.sessionId, { amountCents: 60_000 }),
    );

    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(getActiveTableSession(database, 1)?.sessionId).toBe(
      opened.sessionId,
    );
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
  });

  it('品类在会话期间下架后仍可结账', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 2000,
      tableId: 10,
    });
    database
      .prepare('UPDATE craft_category SET status = 2 WHERE category_id = ?')
      .run(categoryId);

    const result = settleTableSession(database, opened.sessionId, {
      amountCents: 2000,
    });

    expect(result.consumptionRecord.consumptionAmountCents).toBe(2000);
    expect(result.account.balanceCents).toBe(48_000);
  });

  it('关台不结账：直接结束会话、不写流水、不扣余额', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 2000,
      tableId: 17,
    });

    const closed = closeTableSession(database, opened.sessionId);

    expect(closed.status).toBe(2);
    expect(closed.closeTime).toMatch(UTC_TIME_PATTERN);
    expect(getActiveTableSession(database, 17)).toBeNull();
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('已关台的会话不能重复关台、续时或结账', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 2000,
      tableId: 18,
    });
    closeTableSession(database, opened.sessionId);

    expect(
      captureError(() => closeTableSession(database, opened.sessionId)),
    ).toMatchObject({ code: 'SESSION_ALREADY_CLOSED' });
    expect(
      captureError(() =>
        extendTableSession(database, opened.sessionId, {
          durationMinutes: 30,
          estimatedAmountCents: 500,
        }),
      ),
    ).toMatchObject({ code: 'SESSION_ALREADY_CLOSED' });
    expect(
      captureError(() =>
        settleTableSession(database, opened.sessionId, { amountCents: 2000 }),
      ),
    ).toMatchObject({ code: 'SESSION_ALREADY_CLOSED' });
  });

  it('关台后座位可重新开台', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 2000,
      tableId: 16,
    });
    closeTableSession(database, opened.sessionId);

    expect(() =>
      openTableSession(database, {
        categoryId,
        customerId,
        durationMinutes: 30,
        estimatedAmountCents: 1000,
        tableId: 16,
      }),
    ).not.toThrow();
  });

  it('实际计时模式开台不设计划结束时间，也不写流水不扣款', () => {
    const session = openTableSession(database, {
      categoryId,
      customerId,
      estimatedAmountCents: 0,
      tableId: 2,
      timingMode: 2,
    });

    expect(session.timingMode).toBe(2);
    expect(session.plannedEndTime).toBeNull();
    expect(session.plannedDurationMinutes).toBe(0);
    expect(session.totalDurationMinutes).toBe(0);
    expect(session.totalAmountCents).toBe(0);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('实际计时模式结账按开台至结账的实际用时计算消费时长', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      estimatedAmountCents: 0,
      tableId: 3,
      timingMode: 2,
    });
    // 将开台时间回拨 95 分钟，模拟实际计时
    const startTime = new Date(Date.now() - 95 * 60_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    database
      .prepare('UPDATE table_session SET start_time = ? WHERE session_id = ?')
      .run(startTime, opened.sessionId);

    const result = settleTableSession(database, opened.sessionId, {
      amountCents: 8000,
    });

    expect(result.consumptionRecord.durationMinutes).toBe(95);
    expect(result.consumptionRecord.consumptionAmountCents).toBe(8000);
    expect(result.session.status).toBe(2);
    expect(result.session.totalDurationMinutes).toBe(95);
    expect(result.account.balanceCents).toBe(42_000);
  });

  it('实际计时模式不足 1 分钟按 1 分钟结算', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      estimatedAmountCents: 0,
      tableId: 4,
      timingMode: 2,
    });

    const result = settleTableSession(database, opened.sessionId, {
      amountCents: 500,
    });

    expect(result.consumptionRecord.durationMinutes).toBe(1);
  });

  it('实际计时模式结账金额不受开台预估金额限制', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      estimatedAmountCents: 1000,
      tableId: 6,
      timingMode: 2,
    });

    const result = settleTableSession(database, opened.sessionId, {
      amountCents: 9000,
    });

    expect(result.consumptionRecord.consumptionAmountCents).toBe(9000);
    expect(result.account.balanceCents).toBe(41_000);
  });

  it('实际计时模式不支持续时', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      estimatedAmountCents: 1000,
      tableId: 8,
      timingMode: 2,
    });

    const error = captureError(() =>
      extendTableSession(database, opened.sessionId, {
        durationMinutes: 30,
        estimatedAmountCents: 500,
      }),
    );

    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('实际计时模式在看板返回计时标记且不暴露占位值', () => {
    openTableSession(database, {
      categoryId,
      customerId,
      estimatedAmountCents: 0,
      tableId: 9,
      timingMode: 2,
    });

    const board = listTableBoard(database);
    const seat = board.find((item) => item.seatNo === 9);
    expect(seat?.session).toMatchObject({
      plannedDurationMinutes: 0,
      plannedEndTime: null,
      timingMode: 2,
    });
  });

  it('非法计时方式返回 INVALID_INPUT', () => {
    const error = captureError(() =>
      openTableSession(database, {
        categoryId,
        customerId,
        durationMinutes: 60,
        estimatedAmountCents: 1000,
        tableId: 11,
        timingMode: 3,
      }),
    );

    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'INVALID_INPUT' });
    expect(getActiveTableSession(database, 11)).toBeNull();
  });

  it('看板返回 18 个座位，汇总金额只统计已结流水', () => {
    const opened = openTableSession(database, {
      categoryId,
      customerId,
      durationMinutes: 60,
      estimatedAmountCents: 3000,
      tableId: 5,
    });

    const board = listTableBoard(database);
    expect(board).toHaveLength(18);
    const seat = board.find((item) => item.seatNo === 5);
    expect(seat?.session).toMatchObject({
      categoryName: '拼豆',
      customerName: '开台客户',
      plannedDurationMinutes: 60,
      totalAmountCents: 3000,
    });
    expect(board.filter((item) => item.session !== null)).toHaveLength(1);

    // 未结账时不计入当日已结金额
    expect(getTableBoardSummary(database, 1)).toMatchObject({
      activeCount: 1,
      todayDurationMinutes: 60,
      todaySessionCount: 1,
      todayTotalAmountCents: 0,
    });

    settleTableSession(database, opened.sessionId, { amountCents: 2500 });

    const summary = getTableBoardSummary(database, 0);
    expect(summary).toMatchObject({
      activeCount: 0,
      todayDurationMinutes: 60,
      todaySessionCount: 1,
      todayTotalAmountCents: 2500,
    });
  });
});
