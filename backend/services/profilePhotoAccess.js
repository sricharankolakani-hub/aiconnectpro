'use strict';

function isProfilePhotoPathOwnedBy(path, userId) {
  if (typeof path !== 'string' || typeof userId !== 'string' || path.includes('\\')) return false;
  const segments = path.split('/');
  return segments.length >= 2
    && segments[0] === userId
    && segments.every(segment => segment && segment !== '.' && segment !== '..');
}

module.exports = { isProfilePhotoPathOwnedBy };
