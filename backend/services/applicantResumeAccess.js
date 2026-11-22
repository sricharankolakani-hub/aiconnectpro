'use strict';

function canEmployerReviewApplicantResume({ viewerId, job, membership, application, resume }) {
  if (!viewerId || !job?.id || !job?.company_id) return false;
  if (membership?.user_id !== viewerId
      || membership.organization_id !== job.company_id
      || membership.status !== 'active'
      || membership.organization?.verification_status !== 'verified') return false;
  if (!application?.id
      || application.job_id !== job.id
      || !application.resume_id
      || !application.user_id
      || application.user_id === viewerId) return false;
  return resume?.id === application.resume_id && resume.user_id === application.user_id;
}

module.exports = { canEmployerReviewApplicantResume };
