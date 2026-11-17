'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createReadinessHandler } = require('../services/readiness');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function createSupabase(result, thrownError) {
  const calls = [];
  const query = {
    select(column) { calls.push(['select', column]); return this; },
    limit(value) {
      calls.push(['limit', value]);
      return thrownError ? Promise.reject(thrownError) : Promise.resolve(result);
    }
  };
  return {
    calls,
    supabase: { from(table) { calls.push(['from', table]); return query; } }
  };
}

test('readiness returns ready only when the database query succeeds', async () => {
  const { supabase, calls } = createSupabase({ data: [], error: null });
  const response = createResponse();
  await createReadinessHandler(supabase, { error() {} })({}, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'ready', dependency: 'database' });
  assert.deepEqual(calls, [['from', 'profiles'], ['select', 'id'], ['limit', 1]]);
});

test('readiness returns a generic unavailable response for database errors', async () => {
  const { supabase } = createSupabase({ data: null, error: new Error('private database detail') });
  const response = createResponse();
  await createReadinessHandler(supabase, { error() {} })({}, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { status: 'not_ready', dependency: 'database' });
  assert.equal(JSON.stringify(response.body).includes('private database detail'), false);
});

test('readiness handles a rejected database request', async () => {
  const { supabase } = createSupabase(null, new Error('connection refused'));
  const response = createResponse();
  await createReadinessHandler(supabase, { error() {} })({}, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { status: 'not_ready', dependency: 'database' });
});
