// backend/routes/resume.js
// Full updated resume route: generate HTML, save to Supabase, create PDF (Puppeteer) and upload to Supabase storage.
// Endpoints:
//   POST  /api/resume/generate   -> generate HTML, save record, (optionally) generate PDF and return signed URL
//   GET   /api/resume/:id        -> returns JSON with resume record and signed pdf url (if available)
//   GET   /api/resume/:id/html   -> returns the HTML directly (useful for preview)
// Notes:
// - Requires these helper files to exist:
//     - backend/services/supabaseClient.js   (exports configured supabase client)
//     - backend/services/resumePdfService.js (exports htmlToPdfBuffer, uploadPdfBufferToSupabase)
//     - backend/middleware/authMiddleware.js (optional — used to attach req.user if present)
// - Ensure Supabase has a 'resumes' table with at least: id (uuid PK), user_id, html, template, metadata (jsonb), pdf_path (text), created_at
// - Environment variable GENERATE_PDF controls PDF generation (set to "true" to enable).
// - Adjust bucket names or column names if your schema differs.

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');
const authMiddleware = require('../middleware/authMiddleware');
const { htmlToPdfBuffer, uploadPdfBufferToSupabase } = require('../services/resumePdfService');

// Helper: build simple resume HTML (inline CSS). This is intentionally simple and safe.
function buildResumeHtml(data = {}, template = 'classic') {
  const name = data.name || '';
  const title = data.title || '';
  const contactEmail = data.email || '';
  const phone = data.phone || '';
  const location = data.location || '';
  const summary = data.summary || '';
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const skills = Array.isArray(data.skills) ? data.skills : [];

  // Template variations may change colors or font — simple switch
  let accent = '#0b76ff';
  if (template === 'creative') accent = '#ff6b6b';
  if (template === 'modern') accent = '#2b6cb0';
  if (template === 'compact') accent = '#1f2937';
  if (template === 'two-column') accent = '#0b76ff';

  // Basic CSS
  const css = `
    :root{ --accent:${accent}; --muted:#666; --bg:#ffffff; --font:Inter, Arial, sans-serif; }
    body{ font-family:var(--font); margin:20px; color:#111; background:#fff; }
    header{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    h1{ margin:0; font-size:28px; color:var(--accent); }
    h2{ margin:10px 0 6px 0; font-size:16px; color:#222; }
    .muted{ color:var(--muted); font-size:13px; }
    .section{ margin-top:12px; }
    .experience-item{ margin-bottom:10px; }
    .skills{ display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .skill{ background:linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.02)); padding:6px 8px; border-radius:6px; font-size:13px; }
    .two-column { display:grid; grid-template-columns: 1fr 320px; gap:20px; }
    @media print { body{ margin:10mm } }
  `;

  // Build HTML blocks
  const expHtml = experience.map(exp => {
    const company = exp.company || '';
    const role = exp.role || '';
    const from = exp.from || '';
    const to = exp.to || '';
    const desc = exp.desc ? `<div>${escapeHtml(exp.desc)}</div>` : '';
    return `<div class="experience-item">
      <div style="font-weight:700">${escapeHtml(role)} ${company ? `<span class="muted"> — ${escapeHtml(company)}</span>` : ''}</div>
      <div class="muted" style="font-size:13px">${escapeHtml(from)} ${to ? '– ' + escapeHtml(to) : ''}</div>
      ${desc}
    </div>`;
  }).join('');

  const eduHtml = education.map(ed => {
    const school = ed.school || '';
    const degree = ed.degree || '';
    const year = ed.year || '';
    return `<div style="margin-bottom:8px;">
      <div style="font-weight:700">${escapeHtml(school)}</div>
      <div class="muted">${escapeHtml(degree)} ${year ? `• ${escapeHtml(year)}` : ''}</div>
    </div>`;
  }).join('');

  const skillsHtml = (skills || []).map(s => `<div class="skill">${escapeHtml(s)}</div>`).join('');

  // Choose layout class for two-column template
  const layoutClass = template === 'two-column' ? 'two-column' : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Resume — ${escapeHtml(name)}</title>
<style>${css}</style>
</head>
<body>
  <div class="${layoutClass}">
    <main>
      <header>
        <div>
          <h1>${escapeHtml(name)}</h1>
          <div style="font-weight:600">${escapeHtml(title)}</div>
        </div>
        <div style="text-align:right;">
          <div class="muted">${escapeHtml(contactEmail)}</div>
          <div class="muted">${escapeHtml(phone)} ${location ? ' • ' + escapeHtml(location) : ''}</div>
        </div>
      </header>

      <section class="section">
        <h2>Professional Summary</h2>
        <div>${escapeHtml(summary)}</div>
      </section>

      <section class="section">
        <h2>Experience</h2>
        ${expHtml || '<div class="muted">No experience added</div>'}
      </section>

      <section class="section">
        <h2>Education</h2>
        ${eduHtml || '<div class="muted">No education added</div>'}
      </section>
    </main>

    <aside style="min-width:220px;">
      <section class="section">
        <h2>Skills</h2>
        <div class="skills">${skillsHtml || '<div class="muted">No skills added</div>'}</div>
      </section>
    </aside>
  </div>
</body>
</html>`;

  return html;
}

// simple HTML escape
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * POST /api/resume/generate
 * Body: JSON containing resume data (name, title, summary, experience[], education[], skills[], template)
 * Auth optional — if auth middleware is used earlier it will populate req.user
 */
router.post('/generate', async (req, res) => {
  try {
    // If you want to require auth for resume generation, uncomment the next line:
    // await new Promise((resolve, reject) => authMiddleware(req, res, (err) => err ? reject(err) : resolve()));

    const userId = (req.user && req.user.id) || null; // authMiddleware sets req.user if present

    const payload = req.body || {};
    const template = payload.template || 'classic';

    // Build HTML
    const renderedHtml = buildResumeHtml(payload, template);

    // Create DB record in Supabase (table: resumes)
    const resumeId = uuidv4();
    const metadata = {
      title: payload.title || '',
      template,
      name: payload.name || '',
      summarySnippet: (payload.summary || '').slice(0, 200)
    };

    const insertObj = {
      id: resumeId,
      user_id: userId,
      html: renderedHtml,
      template,
      metadata,
      pdf_path: null
    };

    const { data: insertData, error: insertErr } = await supabase.from('resumes').insert([insertObj]).select().single();
    if (insertErr) {
      console.error('Supabase insert resume error:', insertErr);
      return res.status(500).json({ error: 'db_insert_failed', details: insertErr.message || insertErr });
    }

    // Optionally generate PDF if enabled in env
    let pdfSignedUrl = null;
    if (String(process.env.GENERATE_PDF || '').toLowerCase() === 'true') {
      try {
        // Convert HTML to PDF buffer
        const pdfBuffer = await htmlToPdfBuffer(renderedHtml);

        // Upload to Supabase storage; use filename based on resume id
        const filename = `resume-${resumeId}.pdf`;
        const uploadResult = await uploadPdfBufferToSupabase(pdfBuffer, filename);

        // uploadResult = { id, signedUrl }
        pdfSignedUrl = uploadResult && uploadResult.signedUrl ? uploadResult.signedUrl : null;

        // update DB record with pdf path (store filename or path)
        const { error: updErr } = await supabase.from('resumes').update({ pdf_path: `resumes/${uploadResult.id}` }).eq('id', resumeId);
        if (updErr) console.warn('Failed to update resume pdf_path in DB', updErr);
      } catch (pdfErr) {
        // Log but do not fail the whole request
        console.error('PDF generation/upload failed:', pdfErr && (pdfErr.message || pdfErr));
      }
    }

    // Return response with resume id, preview endpoint and pdf url (if produced)
    const previewUrl = `/api/resume/${resumeId}/html`; // you can expose this route below
    return res.status(201).json({
      id: resumeId,
      previewUrl,
      pdfUrl: pdfSignedUrl || null,
      message: 'Resume generated'
    });
  } catch (err) {
    console.error('Resume generate failed:', err && (err.message || err));
    return res.status(500).json({ error: 'internal_error', details: err && (err.message || err) });
  }
});

/**
 * GET /api/resume/:id
 * Returns the resume DB record and a PDF signed URL if available (does not require auth by default).
 * If you want to require auth, apply authMiddleware when mounting this route or uncomment the check below.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('resumes').select('*').eq('id', id).limit(1).single();
    if (error || !data) {
      return res.status(404).json({ error: 'not_found' });
    }

    // If pdf_path exists, create a signed url (fresh)
    let pdfUrl = null;
    if (data.pdf_path) {
      try {
        const bucket = process.env.SUPABASE_RESUME_BUCKET || 'resumes';
        const expiresIn = parseInt(process.env.SUPABASE_SIGNED_URL_EXPIRES || String(60 * 60), 10);
        const { data: signed, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(data.pdf_path, expiresIn);
        if (!signedErr && signed && signed.signedUrl) {
          pdfUrl = signed.signedUrl;
        } else {
          console.warn('createSignedUrl error', signedErr);
        }
      } catch (e) {
        console.error('Signed URL creation error', e && (e.message || e));
      }
    }

    return res.json({ resume: data, pdfUrl });
  } catch (err) {
    console.error('Resume fetch failed', err && (err.message || err));
    return res.status(500).json({ error: 'internal', details: err && (err.message || err) });
  }
});

/**
 * GET /api/resume/:id/html
 * Returns rendered HTML for preview. This returns HTML content-type.
 * Use carefully — if you want to protect previews to auth users only, apply authMiddleware or check req.user here.
 */
router.get('/:id/html', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('resumes').select('html').eq('id', id).limit(1).single();
    if (error || !data) {
      return res.status(404).send('<h3>Resume not found</h3>');
    }
    res.set('Content-Type', 'text/html');
    return res.send(data.html);
  } catch (err) {
    console.error('Resume HTML fetch failed', err && (err.message || err));
    return res.status(500).send('<h3>Internal error</h3>');
  }
});

module.exports = router;
