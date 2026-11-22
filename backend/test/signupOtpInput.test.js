'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const signupHtml = fs.readFileSync(
  path.join(__dirname, '../../frontend/signup.html'),
  'utf8'
);

function getEmailCodeInput() {
  const input = signupHtml.split(/\\r?\\n/).find(line => line.includes('id="email-code"'));
  assert.ok(input, 'signup page should include the email verification code input');
  return input;
}

function getAttribute(element, name) {
  const match = element.match(name + '="([^"]*)"');
  return match?.[1] ?? null;
}

test('email verification input accepts 6 to 10 digit OTPs, including 8 digit codes', () => {
  const input = getEmailCodeInput();
  assert.equal(getAttribute(input, 'type'), 'text');
  assert.equal(getAttribute(input, 'inputmode'), 'numeric');
  assert.equal(getAttribute(input, 'autocomplete'), 'one-time-code');
  assert.equal(getAttribute(input, 'minlength'), '6');
  assert.equal(getAttribute(input, 'maxlength'), '10');

  const digitPattern = getAttribute(input, 'pattern');
  assert.ok(digitPattern, 'email code input should constrain the code to digits');
  const accepts = new RegExp('^(?:' + digitPattern + ')$');
  assert.ok(accepts.test('123456'), 'should accept a six digit code');
  assert.ok(accepts.test('12345678'), 'should accept an eight digit code');
  assert.ok(accepts.test('1234567890'), 'should accept a ten digit code');
  assert.ok(!accepts.test('12345'), 'should reject fewer than six digits');
  assert.ok(!accepts.test('12345678901'), 'should reject more than ten digits');
});
