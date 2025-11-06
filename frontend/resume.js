// frontend/resume.js
const API_BASE = 'https://aiconnectpro-backend.onrender.com/api';

function el(id){ return document.getElementById(id); }

function collectData(){
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
    experience, education, skills,
    template: el('template-select') ? el('template-select').value : 'classic'
  };
}

async function generateResume(save=false){
  el('result').textContent = 'Generating...';
  const data = collectData();
  try {
    const res = await fetch(API_BASE + '/resume/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const j = await res.json();
    if (j.error) { el('result').textContent = 'Error: ' + JSON.stringify(j); return; }
    // indicate template used
    el('result').textContent = 'Template: ' + (j.template || 'classic') + ' — Preview opened in a new tab.';
    // open preview in new tab
    const newWindow = window.open('', '_blank');
    newWindow.document.open();
    newWindow.document.write(j.html);
    newWindow.document.close();
    if (save && j.id){
      el('result').textContent += ' Saved on server (id: ' + j.id + ')';
    }
  } catch (err){
    console.error(err);
    el('result').textContent = 'Failed to generate resume.';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const gen = el('generate-resume'); if(gen) gen.addEventListener('click', ()=>generateResume(false));
  const genSave = el('generate-and-save'); if(genSave) genSave.addEventListener('click', ()=>generateResume(true));
});
