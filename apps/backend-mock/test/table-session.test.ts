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

  it('开台成功后写入会话与消费流水并扣减余额', () => {
    const result = openTableSession(database, {
      categoryId,
      consumptionAmountCents: 5800,
      customerId,
      durationMinutes: 90,
      tableId: 7,
    });

    expect(result.session).toMatchObject({
      categoryId,
      customerId,
      plannedDurationMinutes: 90,
      status: 1,
      tableId: 7,
      totalAmountCents: 5800,
      totalDurationMinutes: 90,
    });
    expect(result.session.startTime).toMatch(UTC_TIME_PATTERN);
    expect(result.session.plannedEndTime).toMatch(UTC_TIME_PATTERN);
    expect(result.consumptionRecord.sessionId).toBe(result.session.sessionId);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(44_200);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      1,
    );
  });

  it('同一座位重复开台返回 TABLE_OCCUPIED', () => {
    openTableSession(database, {
      categoryId,
      consumptionAmountCents: 1000,
      customerId,
      durationMinutes: 60,
      tableId: 3,
    });

    const error = captureError(() =>
      openTableSession(database, {
        categoryId,
        consumptionAmountCents: 1000,
        customerId,
        durationMinutes: 60,
        tableId: 3,
      }),
    );
    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'TABLE_OCCUPIED' });
  });

  it('同桌的其他座位可以同时开台', () => {
    const first = openTableSession(database, {
      categoryId,
      consumptionAmountCents: 1000,
      customerId,
      durationMinutes: 60,
      tableId: 8,
    });
    const second = openTableSession(database, {
      categoryId,
      consumptionAmountCents: 1000,
      customerId,
      durationMinutes: 60,
      tableId: 9,
    });

    expect(second.session.sessionId).not.toBe(first.session.sessionId);
    expect(getActiveTableSession(database, 8)?.sessionId).toBe(
      first.session.sessionId,
    );
    expect(getActiveTableSession(database, 9)?.sessionId).toBe(
      second.session.sessionId,
    );
  });

  it('余额不足时开台失败且不写入会话与流水', () => {
    const error = captureError(() =>
      openTableSession(database, {
        categoryId,
        consumptionAmountCents: 60_000,
        customerId,
        durationMinutes: 60,
        tableId: 1,
      }),
    );

    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(getActiveTableSession(database, 1)).toBeNull();
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(50_000);
  });

  it('续时累加计划结束时间、时长与金额', () => {
    const opened = openTableSession(database, {
      categoryId,
      consumptionAmountCents: 2000,
      customerId,
      durationMinutes: 60,
      tableId: 12,
    });

    const extended = extendTableSession(database, opened.session.sessionId, {
      consumptionAmountCents: 1500,
      durationMinutes: 30,
    });

    expect(extended.session.plannedDurationMinutes).toBe(90);
    expect(extended.session.totalDurationMinutes).toBe(90);
    expect(extended.session.totalAmountCents).toBe(3500);
    expect(
      extended.session.plannedEndTime > opened.session.plannedEndTime,
    ).toBe(true);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(46_500);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      2,
    );
  });

  it('结束后释放座位且不能重复结束', () => {
    const opened = openTableSession(database, {
      categoryId,
      consumptionAmountCents: 2000,
      customerId,
      durationMinutes: 60,
      tableId: 15,
    });

    const closed = closeTableSession(database, opened.session.sessionId);

    expect(closed.status).toBe(2);
    expect(closed.closeTime).toMatch(UTC_TIME_PATTERN);
    expect(getActiveTableSession(database, 15)).toBeNull();

    const error = captureError(() =>
      closeTableSession(database, opened.session.sessionId),
    );
    expect(error).toMatchObject({ code: 'SESSION_ALREADY_CLOSED' });

    expect(() =>
      openTableSession(database, {
        categoryId,
        consumptionAmountCents: 1000,
        customerId,
        durationMinutes: 30,
        tableId: 15,
      }),
    ).not.toThrow();
  });

  it('看板返回 18 个座位并聚合进行中会话与当日汇总', () => {
    openTableSession(database, {
      categoryId,
      consumptionAmountCents: 3000,
      customerId,
      durationMinutes: 60,
      tableId: 5,
    });

    const board = listTableBoard(database);
    expect(board).toHaveLength(18);
    const seat = board.find((item) => item.seatNo === 5);
    expect(seat?.session).toMatchObject({
      categoryName: '拼豆',
      customerName: '开台客户',
      plannedDurationMinutes: 60,
    });
    expect(board.filter((item) => item.session !== null)).toHaveLength(1);

    const summary = getTableBoardSummary(database, 1);
    expect(summary).toMatchObject({
      activeCount: 1,
      todayDurationMinutes: 60,
      todaySessionCount: 1,
      todayTotalAmountCents: 3000,
    });
  });

  it('已结束的会话不能续时', () => {
    const opened = openTableSession(database, {
      categoryId,
      consumptionAmountCents: 2000,
      customerId,
      durationMinutes: 60,
      tableId: 18,
    });
    closeTableSession(database, opened.session.sessionId);

    const error = captureError(() =>
      extendTableSession(database, opened.session.sessionId, {
        consumptionAmountCents: 500,
        durationMinutes: 30,
      }),
    );
    expect(error).toMatchObject({ code: 'SESSION_ALREADY_CLOSED' });
  });
});
