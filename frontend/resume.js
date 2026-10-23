// frontend/resume.js
const API_BASE = '/api'; // Vercel rewrites this path to the Render API.

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function el(id) { return document.getElementById(id); }

function collectData() {
  const experience = [{
    company: el('exp-company').value.trim(),
    role: el('exp-role').value.trim(),
    from: el('exp-from').value.trim(),
    to: el('exp-to').value.trim(),
    desc: el('exp-desc').value.trim()
  }].filter(x => x.role || x.company || x.desc);

  const education = [{
    school: el('edu-school').value.trim(),
    degree: el('edu-degree').value.trim(),
    year: el('edu-year').value.trim()
  }].filter(x => x.school || x.degree);

  const skills = (el('skills').value || '').split(',').map(s => s.trim()).filter(Boolean);

  return {
    name: el('name').value.trim(),
    title: el('title').value.trim(),
    email: el('email').value.trim(),
    phone: el('phone').value.trim(),
    location: el('location').value.trim(),
    summary: el('summary').value.trim(),
    experience,
    education,
    skills,
    template: el('template-select') ? el('template-select').value : 'ats',
    fontFamily: el('font-select') ? el('font-select').value : 'Arial',
    pageBackground: document.querySelector('input[name="background"]:checked')?.value || 'white',
    atsFriendly: !!el('ats-mode')?.checked
  };
}


function escapeResumeText(value) {
  return String(value == null ? '' : value).replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
}
function buildLocalPreview(data) {
  const safe = escapeResumeText;
  const palettes = { white:'#fff', ivory:'#fbf7ef', blue:'#f1f6ff', sage:'#f1f6f1', lavender:'#f6f2fb' };
  const accents = { ats:'#172033', classic:'#355f9f', modern:'#2457c5', compact:'#26364b', creative:'#7652b8', editorial:'#a25c38', 'two-column':'#275c86' };
  const ats = data.atsFriendly || data.template === 'ats';
  const template = Object.hasOwn(accents, data.template) ? data.template : 'ats';
  const fonts = { Arial:'Arial,Helvetica,sans-serif', Aptos:'Aptos,Calibri,sans-serif', Georgia:'Georgia,serif', Cambria:'Cambria,Georgia,serif', 'Trebuchet MS':'"Trebuchet MS",Arial,sans-serif', Verdana:'Verdana,Arial,sans-serif' };
  const font = fonts[data.fontFamily] || fonts.Arial, bg = ats ? '#fff' : (palettes[data.pageBackground] || '#fff'), accent = accents[template];
  const items = (data.experience || []).map(item => '<article><div class="heading"><h3>'+safe(item.role)+'</h3><b>'+safe(item.company)+'</b></div><p class="muted">'+safe([item.from,item.to].filter(Boolean).join(' – '))+'</p><p>'+safe(item.desc)+'</p></article>').join('');
  const schools = (data.education || []).map(item => '<article><div class="heading"><h3>'+safe(item.school)+'</h3><b>'+safe(item.year)+'</b></div><p>'+safe(item.degree)+'</p></article>').join('');
  const common = '<section><h2>Professional Summary</h2><p>'+safe(data.summary)+'</p></section><section><h2>Experience</h2>'+(items||'<p class="muted">No experience added</p>')+'</section><section><h2>Education</h2>'+(schools||'<p class="muted">No education added</p>')+'</section>';
  const skills = '<section><h2>Skills</h2><p>'+safe((data.skills||[]).join(' · '))+'</p></section>';
  const columns = !ats && template === 'two-column'
    ? '<div class="columns"><main>'+common+'</main><aside>'+skills+'</aside></div>'
    : '<main>'+common+skills+'</main>';
  const css = '@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:'+bg+';color:#1b2433;font:10.5pt/1.48 '+font+'}.toolbar{position:sticky;top:0;text-align:center;padding:12px;background:#172033}.toolbar button{padding:10px 16px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.paper{max-width:820px;margin:26px auto;padding:42px 50px;background:'+bg+'}header{border-bottom:2px solid '+accent+';padding-bottom:16px;margin-bottom:18px}h1{font-size:28pt;line-height:1.1;margin:0 0 4px;color:'+accent+'}h2{font-size:11pt;letter-spacing:.06em;text-transform:uppercase;color:'+accent+';border-bottom:1px solid #d9dee8;padding-bottom:5px;margin:0 0 9px}h3{font-size:11pt;margin:0}section{margin:17px 0 0}p{margin:0 0 7px;white-space:pre-line}.heading{display:flex;justify-content:space-between;gap:12px}.muted{color:#586579;font-size:9.5pt}.columns{display:grid;grid-template-columns:2fr .85fr;gap:30px}.columns aside{border-left:1px solid #d9dee8;padding-left:20px}.template-compact{font-size:9.5pt}.template-creative header{border-left:5px solid '+accent+';padding-left:16px}.template-editorial h1{font-family:Georgia,serif;font-weight:500}.template-modern h2{text-transform:none}@media print{.toolbar{display:none}.paper{max-width:none;margin:0;padding:0;background:#fff}body{background:#fff!important}.columns{display:block}.columns aside{border:0;padding:0}}@media(max-width:650px){.paper{padding:24px}.columns{grid-template-columns:1fr}}';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume — '+safe(data.name)+'</title><style>'+css+'</style></head><body class="'+(ats?'ats ':'')+'template-'+template+'"><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div><article class="paper"><header><h1>'+safe(data.name)+'</h1><p><strong>'+safe(data.title)+'</strong></p><p>'+safe([data.email,data.phone,data.location].filter(Boolean).join(' · '))+'</p></header>'+columns+'</article></body></html>';
}

async function generateResume(save = false) {
  const resultEl = el('result');
  resultEl.textContent = 'Generating...';
  if (!el('name').value.trim()) {
    el('name').reportValidity();
    resultEl.textContent = 'Please add your name before continuing.';
    return;
  }
  const token = localStorage.getItem('token');
  if (!token) {
    resultEl.textContent = 'Please sign in before generating a resume.';
    window.location.assign('login.html');
    return;
  }

  const previewWindow = window.open('about:blank', '_blank');
  const data = collectData();
  try {
    let j = {};
    let html = '';
    if (save) {
      const res = await fetch(API_BASE + '/resume/save', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(data)
      });
      j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) {
        if (previewWindow) previewWindow.close();
        resultEl.textContent = res.status === 404
          ? 'Profile saving will be available after the backend update is deployed. You can preview and download a PDF now.'
          : 'Could not save this resume: ' + (j.error || res.statusText);
        return;
      }
      if (j.html) html = j.html;
      else if (j.previewUrl) {
        const previewResponse = await fetch(j.previewUrl, { headers: authHeaders() });
        if (!previewResponse.ok) throw new Error('Resume saved, but its preview could not be loaded.');
        html = await previewResponse.text();
      }
      resultEl.textContent = 'Resume saved to your profile. Use Print / Save as PDF in the preview to download a PDF.';
    } else {
      const res = await fetch(API_BASE + '/resume/preview', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        j = await res.json();
        html = j.html || '';
      } else if (res.status === 404 || res.status === 405) {
        html = buildLocalPreview(data);
      } else {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Could not generate the resume preview.');
      }
      if (!html) html = buildLocalPreview(data);
      resultEl.textContent = 'Preview opened in a new tab. Use Print / Save as PDF in the preview to download a PDF.';
    }
    const previewUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    if (previewWindow) previewWindow.location = previewUrl;
    else window.open(previewUrl, '_blank');

    // Show PDF link if available
    const old = document.getElementById('resume-pdf-link');
    if (old) old.remove();
    if (j.pdfUrl) {
      const pdfLink = document.createElement('a');
      pdfLink.id = 'resume-pdf-link';
      pdfLink.href = j.pdfUrl;
      pdfLink.textContent = 'Download PDF';
      pdfLink.download = (data.name || 'AIConnectPro-Resume').trim().replace(/[^a-z0-9-_]+/gi, '-') + '.pdf';
      pdfLink.target = '_blank';
      pdfLink.style.display = 'inline-block';
      pdfLink.style.marginTop = '10px';
      pdfLink.style.fontWeight = '600';
      pdfLink.style.color = '#0b76ff';
      resultEl.appendChild(document.createElement('br'));
      resultEl.appendChild(pdfLink);
    }

    if (save && j.id) resultEl.dataset.resumeId = j.id;
  } catch (err) {
    if (previewWindow) previewWindow.close();
    console.error(err);
    resultEl.textContent = err.message || 'Failed to generate resume.';
  }
}

// Template thumbnail click handling
function initTemplateThumbs() {
  const thumbs = document.querySelectorAll('.template-card[data-template]');
  const select = el('template-select');

  function setSelected(template) {
    // update hidden select (for data)
    if (select) select.value = template;
    // visual highlight
    thumbs.forEach(t => {
      const selected = t.getAttribute('data-template') === template;
      t.classList.toggle('selected', selected);
      t.setAttribute('aria-pressed', String(selected));
    });
  }

  thumbs.forEach(t => {
    t.addEventListener('click', () => {
      const template = t.getAttribute('data-template');
      setSelected(template);
      const atsMode = el('ats-mode');
      if (atsMode) atsMode.checked = template === 'ats';
      updateStyleControls();
    });
    t.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { t.click(); }});
  });

  // default select first
  if (thumbs.length) {
    const defaultTemplate = select ? select.value || thumbs[0].getAttribute('data-template') : thumbs[0].getAttribute('data-template');
    setSelected(defaultTemplate);
  }
}

function updateStyleControls() {
  const locked = !!el('ats-mode')?.checked;
  const font = el('font-select');
  if (font) font.disabled = locked;
  document.querySelectorAll('input[name="background"]').forEach(input => input.disabled = locked);
}

document.addEventListener('DOMContentLoaded', () => {
  initTemplateThumbs();
  const atsMode = el('ats-mode');
  if (atsMode) {
    atsMode.addEventListener('change', () => {
      if (atsMode.checked) {
        const select = el('template-select');
        if (select) select.value = 'ats';
        document.querySelectorAll('.template-card[data-template]').forEach(card => {
          const selected = card.dataset.template === 'ats';
          card.classList.toggle('selected', selected);
          card.setAttribute('aria-pressed', String(selected));
        });
      } else if (el('template-select')?.value === 'ats') {
        el('template-select').value = 'modern';
        document.querySelectorAll('.template-card[data-template]').forEach(card => {
          const selected = card.dataset.template === 'modern';
          card.classList.toggle('selected', selected);
          card.setAttribute('aria-pressed', String(selected));
        });
      }
      updateStyleControls();
    });
  }
  updateStyleControls();
  const gen = el('generate-resume'); if (gen) gen.addEventListener('click', () => generateResume(false));
  const genSave = el('generate-and-save'); if (genSave) genSave.addEventListener('click', () => generateResume(true));
});
