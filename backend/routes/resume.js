// backend/routes/resume.js
const express = require('express');
const router = express.Router();
const { generateHtml } = require('../services/resumeService');
const { v4: uuidv4 } = require('uuid');

// In-memory storage for generated resumes (demo). Replace with DB / object storage for production.
const RESUMES = {};

/**
 * POST /api/resume/generate
 * Body: { name, title, email, phone, location, summary, experience:[...], education:[...], skills:[...] }
 * Returns: { html } with resume HTML (use to preview) and optionally id if saved in server memory
 */
router.post('/generate', async (req, res) => {
  try {
    const data = req.body || {};
    const html = await generateHtml(data);
    // optionally store it in memory with id
    const id = uuidv4();
    RESUMES[id] = { html, createdAt: Date.now(), meta: { name: data.name || '' } };
    return res.json({ html, id });
  } catch (err) {
    console.error('Resume generate error', err && err.message);
    return res.status(500).json({ error: 'resume_error', details: err.message || 'internal' });
  }
});

/**
 * GET /api/resume/:id
 * Returns stored resume HTML by ID (demo).
 */
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const r = RESUMES[id];
  if (!r) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', 'text/html');
  return res.send(r.html);
});

module.exports = router;
