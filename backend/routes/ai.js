// backend/routes/ai.js
const express = require('express');
const router = express.Router();

/**
 * POST /api/ai/assistant
 * body: { prompt }
 * This is a mock assistant that returns a simple simulated reply.
 * Replace with real AI integration (OpenAI etc.) later.
 */
router.post('/assistant', (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || String(prompt).trim().length === 0) {
    return res.status(400).json({ error: 'prompt_required' });
  }

  // Mock logic: echo + short helpful suggestions
  const sanitized = String(prompt).trim();
  const reply = `Mock assistant reply — you asked: "${sanitized}".\n\nSuggestions:\n1) Break this into bullets.\n2) Ask for examples.\n3) Use "Generate" to create a template.`;

  return res.json({ reply });
});

module.exports = router;
