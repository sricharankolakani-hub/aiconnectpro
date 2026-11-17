'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createAccountExportDocument } = require('../services/accountExportDocument');

test('account export includes notifications and organizations created by the member', () => {
  const notifications = [{ id: 'notification-1', type: 'connection_request' }];
  const organizations = [{ id: 'organization-1', name: 'Example Studio' }];
  const document = createAccountExportDocument({
    user: { id: 'user-1', email: 'member@example.com' },
    generatedAt: '2026-11-17T12:00:00.000Z',
    profiles: [],
    privateDetails: [],
    resumes: [],
    reels: [],
    likes: [],
    comments: [],
    shares: [],
    applications: [],
    jobs: [],
    accessRequests: [],
    organizations,
    memberships: [],
    connectionRequests: [],
    conversations: [],
    messages: [],
    notifications,
    reportsFiled: [],
    posts: [],
    postReactions: [],
    postComments: [],
    downloads: []
  });

  assert.deepEqual(document.organizations_created, organizations);
  assert.deepEqual(document.notifications, notifications);
  assert.equal(document.generated_at, '2026-11-17T12:00:00.000Z');
});
