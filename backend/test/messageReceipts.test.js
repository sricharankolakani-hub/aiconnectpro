'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { markIncomingMessagesDeliveredAndRead } = require('../services/messageReceipts');

function createSupabaseMock(results = [{ error: null }, { error: null }]) {
  const calls = [];
  const pending = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'direct_messages');
      return {
        update(values) {
          const call = { values, filters: [] };
          calls.push(call);
          return {
            eq(column, value) { call.filters.push(['eq', column, value]); return this; },
            neq(column, value) { call.filters.push(['neq', column, value]); return this; },
            is(column, value) {
              call.filters.push(['is', column, value]);
              const resultIndex = pending.length;
              return new Promise(resolve => pending.push(() => resolve(results[resultIndex])));
            }
          };
        }
      };
    }
  };
  return { supabase, calls, pending };
}

test('marks incoming messages delivered and seen concurrently before returning', async () => {
  const { supabase, calls, pending } = createSupabaseMock();
  let tick = 0;
  const task = markIncomingMessagesDeliveredAndRead(
    supabase,
    'conversation-id',
    'current-user-id',
    () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++))
  );

  assert.equal(calls.length, 2, 'both receipt updates should start before either resolves');
  assert.deepEqual(calls.map(call => Object.keys(call.values)[0]), ['delivered_at', 'read_at']);
  assert.deepEqual(calls.map(call => call.filters), [
    [['eq', 'conversation_id', 'conversation-id'], ['neq', 'sender_id', 'current-user-id'], ['is', 'delivered_at', null]],
    [['eq', 'conversation_id', 'conversation-id'], ['neq', 'sender_id', 'current-user-id'], ['is', 'read_at', null]]
  ]);
  assert.equal(calls[0].values.delivered_at, '2026-01-01T00:00:00.000Z');
  assert.equal(calls[1].values.read_at, '2026-01-01T00:00:01.000Z');

  pending.forEach(resolve => resolve());
  await task;
});

test('reports a receipt update failure', async () => {
  const failure = new Error('delivery update failed');
  const { supabase, pending } = createSupabaseMock([{ error: failure }, { error: null }]);
  const task = markIncomingMessagesDeliveredAndRead(supabase, 'conversation-id', 'current-user-id');
  pending.forEach(resolve => resolve());
  await assert.rejects(task, failure);
});
