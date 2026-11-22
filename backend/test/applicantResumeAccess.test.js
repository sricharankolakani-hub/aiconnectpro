'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canEmployerReviewApplicantResume } = require('../services/applicantResumeAccess');

const valid = {
  viewerId: 'employer-user',
  job: { id: 'job-1', company_id: 'org-1' },
  membership: {
    user_id: 'employer-user',
    organization_id: 'org-1',
    status: 'active',
    organization: { verification_status: 'verified' }
  },
  application: {
    id: 'application-1',
    job_id: 'job-1',
    user_id: 'applicant-user',
    resume_id: 'resume-1'
  },
  resume: { id: 'resume-1', user_id: 'applicant-user' }
};

test('verified active organization members can review an applicant resume for their listing', () => {
  assert.equal(canEmployerReviewApplicantResume(valid), true);
});

test('resume access rejects an unrelated or unverified organization member', () => {
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    membership: { ...valid.membership, organization_id: 'other-org' }
  }), false);
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    membership: { ...valid.membership, organization: { verification_status: 'pending' } }
  }), false);
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    membership: { ...valid.membership, status: 'pending' }
  }), false);
});

test('resume access rejects an application for another job or another applicant resume', () => {
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    application: { ...valid.application, job_id: 'other-job' }
  }), false);
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    resume: { ...valid.resume, user_id: 'different-user' }
  }), false);
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    resume: { ...valid.resume, id: 'different-resume' }
  }), false);
});

test('resume access rejects missing records and self-applications', () => {
  assert.equal(canEmployerReviewApplicantResume({ ...valid, application: null }), false);
  assert.equal(canEmployerReviewApplicantResume({
    ...valid,
    application: { ...valid.application, user_id: 'employer-user' },
    resume: { ...valid.resume, user_id: 'employer-user' }
  }), false);
});
