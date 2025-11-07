// backend/routes/resume.js
const express = require('express');
const router = express.Router();
const { generateHtml } = require('../services/resumeService');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');

// bucket name (must exist in Supabase Storage)
const BUCKET = 'resumes';

/**
 * POST /api/resume/generate
 * Body: { name, title, email, phone, location, summary, experience, education, skills, template }
 * Returns: { id, template, public_url (signed url) }
 */
router.post('/generate', async (req, res) => {
  try {
    const data = req.body || {};
    const template = (data.template || 'classic').toLowerCase();

    // generate HTML string
    const html = await generateHtml(data, template);

    // create uuid id for file
    const id = uuidv4();
    const filename = `resumes/${id}.html`; // storage path

    // upload HTML buffer to Supabase Storage (private bucket)
    const buffer = Buffer.from(html, 'utf-8');

    // upload - note: upsert false to avoid overwriting accidentally
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
      contentType: 'text/html',
      upsert: false
    });

    if (uploadErr) {
      // if file already exists, you might want to upsert instead; here we fail for safety
      console.error('Supabase upload error', uploadErr);
      return res.status(500).json({ error: 'storage_upload_failed', details: uploadErr.message || uploadErr });
    }

    // insert metadata into resumes table
    const meta = {
      id,
      filename,
      name: data.name || null,
      template: template,
      user_id: data.user_id || null
    };

    const { error: insertErr } = await supabase.from('resumes').insert([meta]);
    if (insertErr) {
      console.error('Supabase insert metadata error', insertErr);
      // proceed — we still can return preview link even if metadata insertion failed
    }

    // create a signed URL (expiration seconds) - 7 days = 60*60*24*7
    const expiresIn = 60 * 60 * 24 * 7;
    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(filename, expiresIn);

    if (signedErr) {
      console.error('Supabase createSignedUrl error', signedErr);
      return res.status(500).json({ error: 'signed_url_failed', details: signedErr.message || signedErr });
    }

    return res.json({ id, template, url: signedData.signedUrl || signedData.signedURL || null });
  } catch (err) {
    console.error('Resume generate error', err && err.message);
    return res.status(500).json({ error: 'resume_error', details: err.message || 'internal' });
  }
});

/**
 * GET /api/resume/:id
 * Redirect or return signed URL for the resume HTML by id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // fetch metadata from table
    const { data: rows, error } = await supabase.from('resumes').select('*').eq('id', id).limit(1).single();

    if (error) {
      console.error('Supabase metadata fetch error', error);
      return res.status(404).json({ error: 'not_found' });
    }
    const filename = rows.filename;
    // create short signed url (60 seconds) for immediate preview
    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(filename, 60);
    if (signedErr) {
      console.error('Signed URL creation failed', signedErr);
      return res.status(500).json({ error: 'signed_url_failed' });
    }
    // redirect to signed url (so browser opens HTML)
    return res.redirect(signedData.signedUrl || signedData.signedURL);
  } catch (err) {
    console.error('Resume fetch error', err && err.message);
    return res.status(500).json({ error: 'resume_fetch_error', details: err.message || 'internal' });
  }
});

module.exports = router;
