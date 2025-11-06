// backend/routes/ai.js
const express = require('express');
const router = express.Router();

let aiProxy = null;
try { aiProxy = require('../services/aiProxy'); } catch(e) { aiProxy = null; }

/**
 * POST /api/ai/assistant
 * body: { prompt, system? }
 * If OPENAI_API_KEY is set on the server, forwards to OpenAI; otherwise returns a mock reply.
 */
router.post('/assistant', async (req, res) => {
  const { prompt, system } = req.body || {};
  if (!prompt || String(prompt).trim().length === 0) {
    return res.status(400).json({ error: 'prompt_required' });
  }

  // If we have an OpenAI key configured, use the proxy
  if (process.env.OPENAI_API_KEY && aiProxy && aiProxy.callOpenAI) {
    try {
      const reply = await aiProxy.callOpenAI(prompt, { system });
      return res.json({ reply });
    } catch (err) {
      // Return a helpful error (do not leak the API key)
      console.error('OpenAI call failed:', err && err.body ? err.body : err.message);
      const status = err.status || 500;
      return res.status(status).json({ error: 'openai_error', details: err.body || err.message });
    }
  }

  // Fallback: safe mock reply
  const sanitized = String(prompt).trim();
  const reply = `Mock assistant reply — you asked: "${sanitized}".\n\nSuggestions:\n1) Break this into bullets.\n2) Ask for examples or a template.\n3) Use the "Generate" option for a ready-made draft.`;
  return res.json({ reply });
});

module.exports = router;
