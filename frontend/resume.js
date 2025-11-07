// frontend/resume.js
const API_BASE = '/api'; // backend base (Vercel proxy)
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
    template: el('template-select') ? el('template-select').value : 'classic'
  };
}

async function generateResume(save = false) {
  const resultEl = el('result');
  resultEl.textContent = 'Generating...';
  const data = collectData();
  try {
    const res = await fetch(API_BASE + '/resume/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();

    if (j.error) {
      resultEl.textContent = 'Error: ' + JSON.stringify(j);
      return;
    }

    resultEl.textContent = 'Template: ' + (j.template || 'classic') + ' — Preview opened in a new tab.';

    // Open preview (prefer backend redirect)
    if (j.url) {
      window.open('/api/resume/' + j.id, '_blank');
    } else if (j.html) {
      const w = window.open('', '_blank');
      w.document.open();
      w.document.write(j.html);
      w.document.close();
    }

    // Show PDF link if available
    const old = document.getElementById('resume-pdf-link');
    if (old) old.remove();
    if (j.pdfUrl) {
      const pdfLink = document.createElement('a');
      pdfLink.id = 'resume-pdf-link';
      pdfLink.href = j.pdfUrl;
      pdfLink.textContent = 'Download PDF';
      pdfLink.target = '_blank';
      pdfLink.style.display = 'inline-block';
      pdfLink.style.marginTop = '10px';
      pdfLink.style.fontWeight = '600';
      pdfLink.style.color = '#0b76ff';
      resultEl.appendChild(document.createElement('br'));
      resultEl.appendChild(pdfLink);
    }

    if (save && j.id) {
      resultEl.textContent += ' Saved on server (id: ' + j.id + ')';
    }
  } catch (err) {
    console.error(err);
    resultEl.textContent = 'Failed to generate resume.';
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
      if (t.getAttribute('data-template') === template) t.classList.add('selected');
      else t.classList.remove('selected');
    });
  }

  thumbs.forEach(t => {
    t.addEventListener('click', () => {
      const template = t.getAttribute('data-template');
      setSelected(template);
    });
    t.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { t.click(); }});
  });

  // default select first
  if (thumbs.length) {
    const defaultTemplate = select ? select.value || thumbs[0].getAttribute('data-template') : thumbs[0].getAttribute('data-template');
    setSelected(defaultTemplate);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTemplateThumbs();
  const gen = el('generate-resume'); if (gen) gen.addEventListener('click', () => generateResume(false));
  const genSave = el('generate-and-save'); if (genSave) genSave.addEventListener('click', () => generateResume(true));
});
