'use strict';

function buildJobApplicationNotifications({ memberships, applicationId, applicantId }) {
  if (!applicationId || !applicantId) return [];
  const recipients = new Set();
  for (const membership of memberships || []) {
    if (membership?.status !== 'active'
        || membership.organization?.verification_status !== 'verified'
        || !membership.user_id
        || membership.user_id === applicantId) continue;
    recipients.add(membership.user_id);
  }
  return [...recipients].map(userId => ({
    user_id: userId,
    actor_id: applicantId,
    type: 'job_application',
    request_id: null,
    application_id: applicationId
  }));
}

module.exports = { buildJobApplicationNotifications };
