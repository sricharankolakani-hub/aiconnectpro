'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isResumePdfPathForId } = require('../services/resumeStorageAccess');

const resumeId = '123e4567-e89b-12d3-a456-426614174000';

test('accepts the canonical PDF path for its resume ID', () => {
  assert.equal(isResumePdfPathForId('resumes/resume-' + resumeId + '.pdf', resumeId), true);
});

test('rejects a PDF path belonging to a different resume', () => {
  assert.equal(isResumePdfPathForId('resumes/resume-123e4567-e89b-12d3-a456-426614174001.pdf', resumeId), false);
});

test('rejects non-canonical, traversing, and malformed paths', () => {
  assert.equal(isResumePdfPathForId('resumes/other.pdf', resumeId), false);
  assert.equal(isResumePdfPathForId('resumes/../private/resume-' + resumeId + '.pdf', resumeId), false);
  assert.equal(isResumePdfPathForId('resumes/resume-' + resumeId + '.pdf/extra', resumeId), false);
  assert.equal(isResumePdfPathForId(null, resumeId), false);
  assert.equal(isResumePdfPathForId('resumes/resume-' + resumeId + '.pdf', 'not-a-uuid'), false);
});
