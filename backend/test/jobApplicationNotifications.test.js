'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildJobApplicationNotifications } = require('../services/jobApplicationNotifications');

test('notifies active verified organization members once for an application', () => {
  const notifications = buildJobApplicationNotifications({
    applicationId: 'application-1',
    applicantId: 'applicant-1',
    memberships: [
      { user_id: 'employer-1', status: 'active', organization: { verification_status: 'verified' } },
      { user_id: 'employer-1', status: 'active', organization: { verification_status: 'verified' } },
      { user_id: 'employer-2', status: 'active', organization: { verification_status: 'verified' } }
    ]
  });

  assert.deepEqual(notifications, [
    { user_id: 'employer-1', actor_id: 'applicant-1', type: 'job_application', request_id: null, application_id: 'application-1' },
    { user_id: 'employer-2', actor_id: 'applicant-1', type: 'job_application', request_id: null, application_id: 'application-1' }
  ]);
});

test('does not notify pending, unverified, or applicant memberships', () => {
  const notifications = buildJobApplicationNotifications({
    applicationId: 'application-1',
    applicantId: 'applicant-1',
    memberships: [
      { user_id: 'pending', status: 'pending', organization: { verification_status: 'verified' } },
      { user_id: 'unverified', status: 'active', organization: { verification_status: 'pending' } },
      { user_id: 'applicant-1', status: 'active', organization: { verification_status: 'verified' } },
      { user_id: null, status: 'active', organization: { verification_status: 'verified' } }
    ]
  });
  assert.deepEqual(notifications, []);
});

test('returns no notifications when application identity is missing', () => {
  assert.deepEqual(buildJobApplicationNotifications({
    applicationId: null,
    applicantId: 'applicant-1',
    memberships: [{ user_id: 'employer-1', status: 'active', organization: { verification_status: 'verified' } }]
  }), []);
});
