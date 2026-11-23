'use strict';

function buildCompanyReviewNotification({ requestId, requesterId, reviewerId, decision }) {
  if (!requestId || !requesterId || !reviewerId || !['approved', 'rejected'].includes(decision)) return null;
  return {
    user_id: requesterId,
    actor_id: reviewerId,
    type: 'company_request_' + decision,
    request_id: null,
    application_id: null,
    company_access_request_id: requestId
  };
}

module.exports = { buildCompanyReviewNotification };
