'use strict';

const MAX_PROMPT_CHARACTERS = 8000;
const MAX_SYSTEM_CHARACTERS = 4000;

function validateAssistantInput(input = {}) {
  if (typeof input.prompt !== 'string' || !input.prompt.trim()) return 'prompt_required';
  if (input.prompt.length > MAX_PROMPT_CHARACTERS) return 'prompt_too_long';
  if (input.system !== undefined && input.system !== null && typeof input.system !== 'string') {
    return 'invalid_system_prompt';
  }
  if (typeof input.system === 'string' && input.system.length > MAX_SYSTEM_CHARACTERS) {
    return 'system_prompt_too_long';
  }
  return null;
}

module.exports = {
  MAX_PROMPT_CHARACTERS,
  MAX_SYSTEM_CHARACTERS,
  validateAssistantInput
};
