import { describe, expect, it, vi } from 'vitest';
import { wrapNodeDb } from '../../src/worker/db/client';
import { runBatch } from '../../src/core/adapters/db/d1/lib/batch';
import { D1_MAX_BOUND_PARAMS } from '../../src/core/adapters/db/d1/lib/chunk';

describe('Node DB wrapper D1 limit guards', () => {
  it('exports valid named constants matching Cloudflare D1 documentation', () => {
    expect(D1_MAX_BOUND_PARAMS).toBe(100);
  });

  it('allows statements with up to 100 bound parameters and throws on 101', () => {
    const spyAll = vi.fn();
    const spyRun = vi.fn();
    const mockStmt = {
      all: spyAll,
      run: spyRun,
      get: vi.fn(),
    };
    const mockSqlite = {
      prepare: vi.fn((..._args: any[]) => mockStmt),
    };
    const mockDb = { $client: mockSqlite } as any;

    wrapNodeDb(mockDb);

    const prepared = mockSqlite.prepare('SELECT * FROM t WHERE id IN (...)');

    // 100 parameters succeeds
    const okParams = Array.from({ length: 100 }, (_, i) => `id_${i}`);
    expect(() => prepared.all(...okParams)).not.toThrow();
    expect(spyAll).toHaveBeenCalledTimes(1);

    // 101 parameters throws D1 limit error
    const overParams = Array.from({ length: 101 }, (_, i) => `id_${i}`);
    expect(() => prepared.all(...overParams)).toThrow(
      /D1 limit exceeded: statement has 101 bound parameters \(maximum is 100\)/,
    );

    // Also checks run()
    expect(() => prepared.run(...overParams)).toThrow(
      /D1 limit exceeded: statement has 101 bound parameters \(maximum is 100\)/,
    );
  });

  it('allows batches with 100+ statements in a single atomic transaction without arbitrary statement cap', async () => {
    const mockSqlite = {
      prepare: vi.fn(() => ({ run: vi.fn() })),
      transaction: (fn: any) => fn,
    };
    const mockDb = { $client: mockSqlite } as any;

    // Cloudflare D1 has no statement cap for db.batch(): 150 statements execute in one batch
    const statements = Array.from({ length: 150 }, (_, i) => ({
      getQuery: () => ({ sql: `INSERT INTO t VALUES (${i})`, params: [] }),
    }));
    await expect(runBatch(mockDb, statements as any)).resolves.toEqual([]);
  });

  it('throws in runBatch if any statement in the batch has more than 100 parameters', async () => {
    const mockSqlite = {
      prepare: vi.fn(() => ({ run: vi.fn() })),
      transaction: (fn: any) => fn,
    };
    const mockDb = { $client: mockSqlite } as any;

    const overParamStmt = {
      getQuery: () => ({
        sql: 'INSERT INTO t VALUES (...)',
        params: Array.from({ length: 102 }, (_, i) => i),
      }),
    };

    await expect(runBatch(mockDb, [overParamStmt as any])).rejects.toThrow(
      /D1 limit exceeded: statement in batch has 102 bound parameters \(maximum is 100\)/,
    );
  });
});
