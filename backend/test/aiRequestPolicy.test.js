'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_PROMPT_CHARACTERS,
  MAX_SYSTEM_CHARACTERS,
  validateAssistantInput
} = require('../services/aiRequestPolicy');

test('requires a non-empty text prompt', () => {
  assert.equal(validateAssistantInput({}), 'prompt_required');
  assert.equal(validateAssistantInput({ prompt: '   ' }), 'prompt_required');
  assert.equal(validateAssistantInput({ prompt: 123 }), 'prompt_required');
});

test('accepts prompts at the limit and rejects oversized prompts', () => {
  assert.equal(validateAssistantInput({ prompt: 'x'.repeat(MAX_PROMPT_CHARACTERS) }), null);
  assert.equal(validateAssistantInput({ prompt: 'x'.repeat(MAX_PROMPT_CHARACTERS + 1) }), 'prompt_too_long');
});

test('accepts an optional bounded system instruction', () => {
  assert.equal(validateAssistantInput({ prompt: 'Help', system: 'x'.repeat(MAX_SYSTEM_CHARACTERS) }), null);
  assert.equal(validateAssistantInput({ prompt: 'Help', system: 'x'.repeat(MAX_SYSTEM_CHARACTERS + 1) }), 'system_prompt_too_long');
  assert.equal(validateAssistantInput({ prompt: 'Help', system: {} }), 'invalid_system_prompt');
});
