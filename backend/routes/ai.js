// backend/routes/ai.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { validateAssistantInput } = require('../services/aiRequestPolicy');

let aiProxy = null;
try { aiProxy = require('../services/aiProxy'); } catch(e) { aiProxy = null; }

router.post('/assistant', auth, async (req, res) => {
  const input = req.body || {};
  const inputError = validateAssistantInput(input);
  if (inputError) return res.status(400).json({ error: inputError });

  const prompt = input.prompt.trim();
  const system = typeof input.system === 'string' ? input.system.trim() : undefined;

  // If OpenAI key is present, try calling; otherwise return the existing free fallback.
  if (process.env.OPENAI_API_KEY && aiProxy && aiProxy.callOpenAI) {
    try {
      const reply = await aiProxy.callOpenAI(prompt, { system });
      return res.json({ reply });
    } catch (err) {
      console.error('OpenAI call failed:', {
        status: Number.isInteger(err.status) ? err.status : undefined,
        message: String(err.message || 'provider_error').slice(0, 200)
      });

      // If quota/rate-limit (429) or other transient error -> fallback to mock reply.
      if (err.status === 429 || (err.status >= 500 && err.status < 600) || err.message === 'openai_retry_failed') {
        const fallback = '(Fallback) Mock assistant reply — temporary AI service error. Try again later.';
        return res.json({ reply: fallback, fallback: true });
      }

      // Keep provider internals and request details out of the response.
      return res.status(err.status || 500).json({ error: 'ai_service_error' });
    }
  }

  // No key: preserve the free mock reply without reflecting the full user prompt.
  return res.json({
    reply: 'The AI career assistant is in preview mode. Add a concise prompt and I’ll help you organize the next step.',
    fallback: true
  });
});

module.exports = router;
