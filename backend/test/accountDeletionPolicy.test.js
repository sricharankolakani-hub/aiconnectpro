'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  accountDeletionPreflight,
  organizationsRequiringTransfer
} = require('../services/accountDeletionPolicy');

const now = 1_800_000_000;
const recentAuthSeconds = 10 * 60;

function preflight(overrides = {}) {
  return accountDeletionPreflight({
    confirmation: 'DELETE',
    authTime: now - 30,
    now,
    roles: [],
    ...overrides
  }, recentAuthSeconds);
}

test('account deletion requires the exact confirmation word', () => {
  assert.deepEqual(preflight({ confirmation: 'delete' }), {
    status: 400,
    error: 'type_DELETE_to_confirm'
  });
});

test('account deletion rejects missing, future, and expired sign-in times', () => {
  assert.equal(preflight({ authTime: null }).error, 'recent_sign_in_required');
  assert.equal(preflight({ authTime: now + 61 }).error, 'recent_sign_in_required');
  assert.equal(preflight({ authTime: now - recentAuthSeconds - 1 }).error, 'recent_sign_in_required');
});

test('account deletion accepts a sign-in within the ten-minute window', () => {
  assert.equal(preflight({ authTime: now - recentAuthSeconds }), null);
});

test('account deletion requires admin access to be transferred first', () => {
  assert.deepEqual(preflight({ roles: ['member', 'admin'] }), {
    status: 409,
    error: 'admin_transfer_required',
    message: 'Transfer administrator access before deleting this account.'
  });
});

test('pending organizations can be removed, but reviewed organizations require transfer', () => {
  assert.deepEqual(
    organizationsRequiringTransfer([{ verification_status: 'pending' }]),
    []
  );
  assert.deepEqual(
    organizationsRequiringTransfer([
      { verification_status: 'pending' },
      { verification_status: 'verified' },
      { verification_status: 'rejected' },
      { verification_status: null }
    ]),
    [
      { verification_status: 'verified' },
      { verification_status: 'rejected' },
      { verification_status: null }
    ]
  );
});
