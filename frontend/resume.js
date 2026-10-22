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
    const res = await fetch(API_BASE + '/resume/generate', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ ...data, save })
    });
    const j = await res.json();

    if (!res.ok || j.error) {
      if (previewWindow) previewWindow.close();
      resultEl.textContent = 'Error: ' + JSON.stringify(j);
      return;
    }

    resultEl.textContent = (save ? 'Resume saved to your profile. ' : 'Preview opened in a new tab. ') + 'Use Print / Save as PDF in the preview to download a PDF.';

    let html = j.html;
    if (!html) {
      if (!j.previewUrl) throw new Error('The resume preview link was not returned.');
      const previewResponse = await fetch(j.previewUrl, { headers: authHeaders() });
      if (!previewResponse.ok) throw new Error('Could not load the saved resume preview.');
      html = await previewResponse.text();
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
