'use strict';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isResumePdfPathForId(path, resumeId) {
  return typeof path === 'string'
    && typeof resumeId === 'string'
    && UUID_PATTERN.test(resumeId)
    && path === 'resumes/resume-' + resumeId + '.pdf';
}

module.exports = { isResumePdfPathForId };
