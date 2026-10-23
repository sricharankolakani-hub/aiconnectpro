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
//     - backend/middleware/authMiddleware.js (required for all resume endpoints)
// - The resumes table also requires filename; content columns are added by the Supabase migration.
// - Environment variable GENERATE_PDF controls PDF generation (set to "true" to enable).
// - Adjust bucket names or column names if your schema differs.

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');
const authMiddleware = require('../middleware/authMiddleware');
const { htmlToPdfBuffer, uploadPdfBufferToSupabase } = require('../services/resumePdfService');

// Render accessible, readable HTML. ATS mode deliberately stays single-column and unadorned.
function buildResumeHtml(data = {}, requestedTemplate = 'ats') {
  const allowedTemplates = ['ats', 'classic', 'modern', 'compact', 'creative', 'editorial', 'two-column'];
  const template = allowedTemplates.includes(requestedTemplate) ? requestedTemplate : 'ats';
  const ats = data.atsFriendly === true || template === 'ats';
  const fonts = {
    'Arial': 'Arial, Helvetica, sans-serif',
    'Aptos': 'Aptos, Calibri, sans-serif',
    'Georgia': 'Georgia, serif',
    'Cambria': 'Cambria, Georgia, serif',
    'Trebuchet MS': '"Trebuchet MS", Arial, sans-serif',
    'Verdana': 'Verdana, Arial, sans-serif'
  };
  const font = fonts[data.fontFamily] || fonts['Arial'];
  const backgrounds = { white:'#ffffff', ivory:'#fbf7ef', blue:'#f1f6ff', sage:'#f1f6f1', lavender:'#f6f2fb' };
  const background = ats ? '#ffffff' : (backgrounds[data.pageBackground] || '#ffffff');
  const accents = { ats:'#172033', classic:'#355f9f', modern:'#2457c5', compact:'#26364b', creative:'#7652b8', editorial:'#a25c38', 'two-column':'#275c86' };
  const accent = accents[template];
  const safe = value => escapeHtml(value == null ? '' : String(value).trim());
  const name = safe(data.name), title = safe(data.title), email = safe(data.email);
  const phone = safe(data.phone), location = safe(data.location), summary = safe(data.summary);
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const experienceHtml = experience.map(item => {
    const position = safe(item.role), company = safe(item.company), from = safe(item.from), to = safe(item.to), desc = safe(item.desc);
    const dates = [from, to].filter(Boolean).join(' – ');
    return '<article class="entry"><div class="entry-heading"><h3>' + position + '</h3>' +
      (company ? '<span class="company">' + company + '</span>' : '') + '</div>' +
      (dates ? '<p class="dates">' + dates + '</p>' : '') +
      (desc ? '<p class="entry-description">' + desc + '</p>' : '') + '</article>';
  }).join('');
  const educationHtml = education.map(item => {
    const school = safe(item.school), degree = safe(item.degree), year = safe(item.year);
    return '<article class="entry"><div class="entry-heading"><h3>' + school + '</h3>' +
      (year ? '<span class="dates">' + year + '</span>' : '') + '</div>' +
      (degree ? '<p class="entry-description">' + degree + '</p>' : '') + '</article>';
  }).join('');
  const skillsText = skills.map(safe).filter(Boolean).join(' · ');
  const twoColumn = !ats && template === 'two-column';
  const layout = twoColumn
    ? '<div class="columns"><main>' +
        '<section><h2>Professional Summary</h2><p>' + summary + '</p></section>' +
        '<section><h2>Experience</h2>' + (experienceHtml || '<p class="muted">Add experience to complete this section.</p>') + '</section>' +
        '<section><h2>Education</h2>' + (educationHtml || '<p class="muted">Add education to complete this section.</p>') + '</section>' +
      '</main><aside><section><h2>Skills</h2><p class="skills-text">' + skillsText + '</p></section></aside></div>'
    : '<main>' +
        '<section><h2>Professional Summary</h2><p>' + summary + '</p></section>' +
        '<section><h2>Experience</h2>' + (experienceHtml || '<p class="muted">Add experience to complete this section.</p>') + '</section>' +
        '<section><h2>Education</h2>' + (educationHtml || '<p class="muted">Add education to complete this section.</p>') + '</section>' +
        '<section><h2>Skills</h2><p class="skills-text">' + skillsText + '</p></section>' +
      '</main>';
  const css = [
    '@page{size:A4;margin:14mm}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:' + background + ';color:#1b2433;font-family:' + font + ';font-size:10.5pt;line-height:1.48;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.paper{max-width:820px;margin:26px auto;padding:42px 50px;background:' + background + '}',
    '.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;padding:12px;background:#172033;color:white;font:600 14px Arial,sans-serif}',
    '.toolbar button{border:0;border-radius:8px;background:#fff;color:#172033;padding:10px 16px;font-weight:700;cursor:pointer}',
    'header{border-bottom:2px solid ' + accent + ';padding-bottom:16px;margin-bottom:18px}',
    'h1{font-size:28pt;line-height:1.1;margin:0 0 4px;color:' + accent + ';letter-spacing:-.035em}',
    '.headline{font-size:13pt;font-weight:600;margin:0 0 8px}',
    '.contact{display:flex;flex-wrap:wrap;gap:5px 14px;color:#4b5565;font-size:9.5pt}',
    'section{margin:17px 0 0;break-inside:avoid}',
    'h2{font-size:11pt;letter-spacing:.08em;text-transform:uppercase;color:' + accent + ';border-bottom:1px solid #d9dee8;padding-bottom:5px;margin:0 0 9px}',
    'h3{font-size:11pt;margin:0;font-weight:700}',
    'p{margin:0 0 7px;white-space:pre-line}',
    '.entry{margin:0 0 11px;break-inside:avoid}',
    '.entry-heading{display:flex;justify-content:space-between;gap:12px;align-items:baseline}',
    '.company{font-weight:600}.dates,.muted{color:#586579;font-size:9.5pt}',
    '.dates{margin:1px 0 5px}.entry-description{margin-top:4px}',
    '.skills-text{line-height:1.65}',
    '.columns{display:grid;grid-template-columns:minmax(0,2fr) minmax(180px,.85fr);gap:30px}',
    '.columns aside{border-left:1px solid #d9dee8;padding-left:20px}',
    'body.template-compact{font-size:9.5pt}.template-compact .paper{padding-top:28px}.template-compact section{margin-top:12px}',
    'body.template-creative header{border-bottom:0;border-left:5px solid ' + accent + ';padding:4px 0 4px 16px}',
    'body.template-editorial h1{font-weight:500;font-family:Georgia,serif}',
    'body.template-modern h2{letter-spacing:.025em;text-transform:none;font-size:12pt}',
    'body.ats h2{text-transform:uppercase;letter-spacing:.03em;color:#111;border-bottom:1px solid #777}',
    '.muted{font-style:italic}',
    '@media(max-width:650px){.paper{padding:24px;margin:0}.columns{grid-template-columns:1fr}.columns aside{border-left:0;padding-left:0}.entry-heading{display:block}}',
    '@media print{.toolbar{display:none!important}.paper{max-width:none;margin:0;padding:0;background:#fff}body{background:#fff!important;color:#111}.columns{display:block}.columns aside{border:0;padding:0}a{color:inherit;text-decoration:none}}'
  ].join('');
  const classes = (ats ? 'ats ' : '') + 'template-' + template;
  const contact = [email, phone, location].filter(Boolean).join(' · ');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="Resume for ' + name + '"><title>Resume — ' + name + '</title><style>' + css +
    '</style></head><body class="' + classes + '"><div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>' +
    '<article class="paper"><header><h1>' + name + '</h1><p class="headline">' + title + '</p><div class="contact">' + contact + '</div></header>' + layout +
    '</article></body></html>';
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

// Generate an authenticated preview without creating or changing a resume record.
router.post('/preview', authMiddleware, async (req, res) => {
  try {
    const payload = req.body || {};
    const template = payload.template || 'ats';
    return res.json({ html: buildResumeHtml(payload, template), template: payload.atsFriendly || template === 'ats' ? 'ats' : template });
  } catch (err) {
    console.error('Resume preview failed:', err && (err.message || err));
    return res.status(500).json({ error: 'preview_failed' });
  }
});

/**
 * POST /api/resume/generate
 * Body: JSON containing resume data (name, title, summary, experience[], education[], skills[], template)
 * Auth required.
 */
router.post(['/generate', '/save'], authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

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
      filename: `resume-${resumeId}.html`,
      name: payload.name ? String(payload.name).trim() : null,
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
 * Returns the current user's resume record and a fresh PDF signed URL if available.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('resumes').select('*').eq('id', id).eq('user_id', req.user.id).limit(1).single();
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
 * Auth required; only the owner can preview the resume.
 */
router.get('/:id/html', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from('resumes').select('html').eq('id', id).eq('user_id', req.user.id).limit(1).single();
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

// GET /api/resume?mine=true
router.get('/', authMiddleware, async (req, res) => {
  if (req.query.mine !== 'true') {
    return res.status(400).json({ error: 'Invalid query' });
  }

  const { data, error } = await supabase
    .from('resumes')
    .select('id, template, created_at, pdf_path')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});


module.exports = router;
