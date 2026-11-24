'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isProfilePhotoPathOwnedBy } = require('../services/profilePhotoAccess');

test('accepts user-scoped photo and Capsule media paths', () => {
  assert.equal(isProfilePhotoPathOwnedBy('user-1/avatar.webp', 'user-1'), true);
  assert.equal(isProfilePhotoPathOwnedBy('user-1/capsule/clip.mp4', 'user-1'), true);
});

test('rejects a path under a different user folder or a prefix collision', () => {
  assert.equal(isProfilePhotoPathOwnedBy('user-2/avatar.webp', 'user-1'), false);
  assert.equal(isProfilePhotoPathOwnedBy('user-10/avatar.webp', 'user-1'), false);
});

test('rejects traversal and malformed paths', () => {
  assert.equal(isProfilePhotoPathOwnedBy('user-1/../user-2/avatar.webp', 'user-1'), false);
  assert.equal(isProfilePhotoPathOwnedBy('/user-1/avatar.webp', 'user-1'), false);
  assert.equal(isProfilePhotoPathOwnedBy('user-1/avatar\\\\evil.webp', 'user-1'), false);
  assert.equal(isProfilePhotoPathOwnedBy('user-1', 'user-1'), false);
  assert.equal(isProfilePhotoPathOwnedBy(null, 'user-1'), false);
});
