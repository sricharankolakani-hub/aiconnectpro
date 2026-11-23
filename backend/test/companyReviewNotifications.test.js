'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCompanyReviewNotification } = require('../services/companyReviewNotifications');

test('builds an approval notification for the company requester', () => {
  assert.deepEqual(buildCompanyReviewNotification({
    requestId: 'request-1',
    requesterId: 'requester-1',
    reviewerId: 'admin-1',
    decision: 'approved'
  }), {
    user_id: 'requester-1',
    actor_id: 'admin-1',
    type: 'company_request_approved',
    request_id: null,
    application_id: null,
    company_access_request_id: 'request-1'
  });
});

test('builds a rejection notification for the company requester', () => {
  const notification = buildCompanyReviewNotification({
    requestId: 'request-1',
    requesterId: 'requester-1',
    reviewerId: 'admin-1',
    decision: 'rejected'
  });
  assert.equal(notification.type, 'company_request_rejected');
  assert.equal(notification.user_id, 'requester-1');
});

test('ignores incomplete or unsupported company review outcomes', () => {
  assert.equal(buildCompanyReviewNotification({
    requestId: 'request-1',
    requesterId: 'requester-1',
    reviewerId: 'admin-1',
    decision: 'pending'
  }), null);
  assert.equal(buildCompanyReviewNotification({
    requestId: 'request-1',
    requesterId: 'requester-1',
    reviewerId: null,
    decision: 'approved'
  }), null);
});
