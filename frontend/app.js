// frontend/app.js - ready to paste
// Backend API base (Render)
const API = 'https://aiconnectpro-backend.onrender.com/api';
let token = null;

function el(id){ return document.getElementById(id); }

async function api(path, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (opts.body && !opts.headers['Content-Type']) {
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + path, opts);
  try { return await res.json(); } catch (e) { return { error: 'invalid-json', status: res.status }; }
}

// Auth (demo using backend in-memory)
el('signup').addEventListener('click', async () => {
  const name = el('name').value;
  const email = el('email').value;
  const password = el('password').value;
  if (!email || !password) return alert('Email and password required');
  const data = await api('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, roles: ['job_seeker'] })
  });
  if (data.token) { token = data.token; showFeed(); } else alert(JSON.stringify(data));
});

el('login').addEventListener('click', async () => {
  const email = el('email').value;
  const password = el('password').value;
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (data.token) { token = data.token; showFeed(); } else alert(JSON.stringify(data));
});

async function loadPosts() {
  const data = await api('/posts');
  const posts = data.posts || [];
  const container = el('posts'); container.innerHTML = '';
  posts.forEach(p => {
    const d = document.createElement('div'); d.className = 'post';
    d.innerHTML = `<strong>${p.type}</strong> <em>${p.title || ''}</em><p>${p.body}</p><small>${new Date(p.createdAt).toLocaleString()}</small>`;
    container.appendChild(d);
  });
}

el('create-post').addEventListener('click', async () => {
  const type = el('post-type').value, title = el('post-title').value, body = el('post-body').value;
  const data = await api('/posts', { method: 'POST', body: JSON.stringify({ type, title, body }) });
  if (data.post) { el('post-title').value = ''; el('post-body').value = ''; loadPosts(); } else alert(JSON.stringify(data));
});

async function showFeed(){
  el('auth').style.display = 'none'; el('feed').style.display = 'block';
  await loadPosts();
  const reels = [{ id: 'r1', caption: 'Welcome to AIConnect Pro', videoUrl: '' }];
  const rcont = el('reels'); rcont.innerHTML = '';
  reels.forEach(r => {
    const div = document.createElement('div'); div.className = 'post';
    div.innerHTML = `<strong>Reel</strong><p>${r.caption}</p>`;
    rcont.appendChild(div);
  });
}

// AI assistant UI
el('ai-send').addEventListener('click', async () => {
  const prompt = el('ai-prompt').value;
  if (!prompt) return alert('Enter a prompt first');
  const data = await api('/ai/assistant', { method: 'POST', body: JSON.stringify({ prompt }) });
  el('ai-reply').textContent = data.reply || JSON.stringify(data);
});
