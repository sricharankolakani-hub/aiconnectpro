// backend/services/resumeService.js
// Produces an HTML resume string from provided data.
// Supports templates: 'classic', 'modern', 'compact', 'creative', 'two-column'

let aiProxy = null;
try { aiProxy = require('./aiProxy'); } catch (e) { aiProxy = null; }

function safeText(s){ return String(s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function improveSummary(summary){
  if (!aiProxy || !process.env.OPENAI_API_KEY) return summary;
  try {
    const prompt = `Improve this professional summary to be concise and compelling for a resume:\n\n${summary}\n\nProvide a 2-4 sentence professional summary.`;
    const improved = await aiProxy.callOpenAI(prompt, { max_tokens: 150 });
    return improved;
  } catch (err) {
    console.warn('AI summary improve failed, using original summary', err && err.message);
    return summary;
  }
}

function cssForTemplate(t){
  if(t === 'modern'){
    return `
      body{font-family: 'Segoe UI', Roboto, Arial; color:#111; margin:24px;}
      header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
      h1{margin:0;font-size:26px;color:#0b76ff}
      h2{margin:8px 0 6px;font-size:15px;color:#333}
      .contact{ text-align:right;font-size:13px;color:#777 }
      .muted{color:#666}
      .section{margin-top:12px;padding:12px;border-left:4px solid #eef6ff;background:#fbfdff;border-radius:6px}
      ul.skills{list-style:none;padding:0;display:flex;gap:8px;flex-wrap:wrap;margin:0}
      ul.skills li{background:#e8f2ff;padding:6px 8px;border-radius:6px;font-size:13px}
    `;
  }
  if(t === 'compact'){
    return `
      body{font-family: Arial, Helvetica, sans-serif; color:#111; margin:18px; font-size:13px;}
      header{display:block;margin-bottom:8px;}
      h1{margin:0;font-size:20px}
      .contact{ font-size:12px;color:#555 }
      .section{margin-top:8px}
      .job{margin-bottom:6px}
      ul.skills{list-style:none;padding:0;display:flex;gap:6px;flex-wrap:wrap;margin:0}
      ul.skills li{background:#f0f0f0;padding:4px 6px;border-radius:4px;font-size:12px}
    `;
  }
  if(t === 'creative'){
    return `
      :root{ --accent:#ff6b6b; --accent2:#6b8bff; --bg:#fff9f9; }
      body{font-family: 'Inter', system-ui, Arial; color:#111; margin:28px; background:var(--bg);}
      header{display:flex;gap:16px;align-items:center;margin-bottom:14px;}
      .avatar{width:68px;height:68px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:inline-block}
      h1{margin:0;font-size:26px;color:#333}
      h2{margin:6px 0 0;font-size:14px;color:#444}
      .contact{ margin-left:auto; text-align:right; font-size:13px; color:#444}
      .section{ margin-top:12px; padding:12px; background: #ffffffcc; border-radius:10px; box-shadow: 0 6px 18px rgba(16,24,40,0.04); }
      .muted{color:#666}
      ul.skills{list-style:none;padding:0;display:flex;gap:8px;flex-wrap:wrap;margin:0}
      ul.skills li{background:linear-gradient(90deg,var(--accent2),var(--accent)); color:#fff; padding:6px 10px;border-radius:999px; font-weight:600}
    `;
  }
  if(t === 'two-column'){
    return `
      body{font-family: 'Helvetica Neue', Arial, sans-serif; color:#111; margin:18px;}
      .layout{display:grid;grid-template-columns: 1fr 320px; gap:20px; align-items:start}
      .left{padding-right:10px}
      .right{background:#f7f9fc;padding:14px;border-radius:8px}
      header{grid-column:1 / -1; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px}
      h1{margin:0;font-size:22px}
      .contact{ font-size:13px; color:#555; text-align:right }
      h2{font-size:14px;margin:8px 0;color:#222}
      .muted{color:#666}
      .job{margin-bottom:10px}
      ul.skills{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px}
      ul.skills li{background:#eef4ff;padding:6px 8px;border-radius:6px;font-size:13px}
    `;
  }
  // classic
  return `
    body { font-family: Georgia, 'Times New Roman', serif; color:#111; margin:24px; }
    header{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
    h1{ margin:0; font-size:24px; }
    h2{ margin:8px 0 6px; font-size:16px; color:#333; }
    .contact{ text-align:right; font-size:13px; color:#555; }
    .section{ margin-top:10px; }
    .job{ margin-bottom:8px; }
    .muted{ color:#555; font-size:13px; }
    ul.skills{ list-style:none; padding:0; display:flex; gap:8px; flex-wrap:wrap; }
    ul.skills li{ background:#eef2ff; padding:6px 8px; border-radius:6px; font-size:13px; }
  `;
}

async function generateHtml(data = {}, template = 'classic') {
  const t = (template || 'classic').toLowerCase();
  const name = safeText(data.name || 'Unnamed');
  const title = safeText(data.title || '');
  const email = safeText(data.email || '');
  const phone = safeText(data.phone || '');
  const location = safeText(data.location || '');
  const rawSummary = data.summary || '';
  const summary = await improveSummary(rawSummary);
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const skills = Array.isArray(data.skills) ? data.skills : [];

  const css = cssForTemplate(t);

  // two-column layout handled specially
  if (t === 'two-column') {
    const left = `
      <div class="left">
        <section class="section">
          <h2>Professional Summary</h2>
          <div>${safeText(summary).replace(/\n/g,'<br/>')}</div>
        </section>
        <section class="section">
          <h2>Experience</h2>
          ${experience.map(exp => `
            <div class="job">
              <div style="font-weight:600">${safeText(exp.role || '')} — ${safeText(exp.company || '')}</div>
              <div class="muted">${safeText(exp.from || '')} — ${safeText(exp.to || '')}</div>
              <div>${safeText(exp.desc || '').replace(/\n/g,'<br/>')}</div>
            </div>
          `).join('') || '<div class="muted">No experience listed</div>'}
        </section>
      </div>
    `;
    const right = `
      <aside class="right">
        <h2>Contact</h2>
        <div class="muted">${email}</div>
        <div class="muted">${phone}</div>
        <div class="muted">${location}</div>

        <h2 style="margin-top:12px">Skills</h2>
        <ul class="skills">${skills.map(s => `<li>${safeText(s)}</li>`).join('') || '<li class="muted">No skills</li>'}</ul>

        <h2 style="margin-top:12px">Education</h2>
        ${education.map(ed => `<div style="margin-bottom:8px"><div style="font-weight:600">${safeText(ed.degree||'')} — ${safeText(ed.school||'')}</div><div class="muted">${safeText(ed.year||'')}</div></div>`).join('') || '<div class="muted">No education listed</div>'}
      </aside>
    `;
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Resume — ${name}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>${css} @media print { .no-print{ display:none } }</style>
      </head>
      <body>
        <header><div><h1>${name}</h1><div class="muted">${title}</div></div><div class="contact"><div>${email}</div><div>${phone}</div></div></header>
        <div class="layout">${left}${right}</div>
        <div class="no-print" style="margin-top:18px;"><button onclick="window.print()">Print / Save as PDF</button></div>
      </body>
      </html>
    `;
    return html;
  }

  // default single-column templates
  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Resume — ${name}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>${css}@media print { .no-print{ display:none } }</style>
  </head>
  <body>
    <header>
      <div>
        <h1>${name}</h1>
        <div class="muted">${title}</div>
      </div>
      <div class="contact">
        <div>${email}</div>
        <div>${phone}</div>
        <div>${location}</div>
      </div>
    </header>

    <section class="section">
      <h2>Professional Summary</h2>
      <div>${safeText(summary).replace(/\n/g,'<br/>')}</div>
    </section>

    <section class="section">
      <h2>Experience</h2>
      ${experience.map(exp => `
        <div class="job">
          <div style="font-weight:600">${safeText(exp.role || '')} — ${safeText(exp.company || '')}</div>
          <div class="muted">${safeText(exp.from || '')} — ${safeText(exp.to || '')}</div>
          <div>${safeText(exp.desc || '').replace(/\n/g,'<br/>')}</div>
        </div>
      `).join('') || '<div class="muted">No experience listed</div>'}
    </section>

    <section class="section">
      <h2>Education</h2>
      ${education.map(ed => `
        <div>
          <div style="font-weight:600">${safeText(ed.degree || '')} — ${safeText(ed.school || '')}</div>
          <div class="muted">${safeText(ed.year || '')}</div>
        </div>
      `).join('') || '<div class="muted">No education listed</div>'}
    </section>

    <section class="section">
      <h2>Skills</h2>
      <ul class="skills">
        ${skills.map(s => `<li>${safeText(s)}</li>`).join('') || '<li class="muted">No skills listed</li>'}
      </ul>
    </section>

    <div class="no-print" style="margin-top:18px;">
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
  </body>
  </html>
  `;
  return html;
}

module.exports = { generateHtml };
