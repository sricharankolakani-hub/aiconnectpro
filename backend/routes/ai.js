// backend/routes/ai.js
const express = require('express');
const router = express.Router();

let aiProxy = null;
try { aiProxy = require('../services/aiProxy'); } catch(e) { aiProxy = null; }

router.post('/assistant', async (req, res) => {
  const { prompt, system } = req.body || {};
  if (!prompt || String(prompt).trim().length === 0) {
    return res.status(400).json({ error: 'prompt_required' });
  }

  // If OpenAI key is present, try calling; otherwise return mock
  if (process.env.OPENAI_API_KEY && aiProxy && aiProxy.callOpenAI) {
    try {
      const reply = await aiProxy.callOpenAI(prompt, { system });
      return res.json({ reply });
    } catch (err) {
      console.error('OpenAI call failed:', err && err.body ? err.body : err.message);

      // If quota/rate-limit (429) or other transient error -> fallback to mock reply
      if (err.status === 429 || (err.status >= 500 && err.status < 600) || err.message === 'openai_retry_failed') {
        const fallback = `(Fallback) Mock assistant reply — temporary OpenAI error. You asked: "${String(prompt).trim()}". Try again later.`;
        return res.json({ reply: fallback, fallback: true });
      }

      // For auth/bad request, surface a safe error
      return res.status(err.status || 500).json({ error: 'openai_error', details: err.body || err.message });
    }
  }

  // No key: mock reply
  const sanitized = String(prompt).trim();
  const reply = `Mock assistant reply — you asked: "${sanitized}".\n\nSuggestions:\n1) Break into bullets.\n2) Ask for examples.`;   //added
  return res.json({ reply, fallback: true });
});

module.exports = router;
