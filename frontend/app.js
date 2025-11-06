// frontend/app.js - AIConnect Pro
// Paste this file into frontend/app.js in your repo

const API = 'https://aiconnectpro-backend.onrender.com/api';
const TOKEN_KEY = 'aiconnectpro_token';
let token = null;

function el(id){ return document.getElementById(id); }

function saveToken(t){ token = t; try{ localStorage.setItem(TOKEN_KEY, t); }catch(e){} }
function clearToken(){ token = null; try{ localStorage.removeItem(TOKEN_KEY); }catch(e){} }
function loadToken(){ try{ const t = localStorage.getItem(TOKEN_KEY); if(t) token = t;}catch(e){ token = null; } }

// Generic API helper: returns parsed JSON or { error:'invalid-json', status }
async function api(path, opts = {}){
  opts.headers = opts.headers || {};
  if(token) opts.headers['Authorization'] = 'Bearer ' + token;
  if(opts.body && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, opts);
  try{ const j = await res.json(); return j; } catch(e){ return { error: 'invalid-json', status: res.status }; }
}

// UI helpers
function showAuth(){ el('auth').style.display = 'block'; el('feed').style.display = 'none'; }
function showFeed(){ el('auth').style.display = 'none'; el('feed').style.display = 'block'; fetchAndRenderPosts(); }

// Signup / Login
async function handleSignup(){
  const name = el('name').value.trim();
  const email = el('email').value.trim();
  const password = el('password').value.trim();
  if(!email || !password) return alert('Email and password required');
  const data = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password, roles: ['job_seeker'] }) });
  if(data && data.token){ saveToken(data.token); showFeed(); }
  else alert(JSON.stringify(data));
}

async function handleLogin(){
  const email = el('email').value.trim();
  const password = el('password').value.trim();
  if(!email || !password) return alert('Email and password required');
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if(data && data.token){ saveToken(data.token); showFeed(); }
  else alert(JSON.stringify(data));
}

// Posts
async function fetchAndRenderPosts(){
  const wrapper = el('posts');
  wrapper.innerHTML = 'Loading posts...';
  const data = await api('/posts');
  if(!data || !Array.isArray(data.posts)){ wrapper.innerHTML = '<div>No posts</div>'; return; }
  wrapper.innerHTML = '';
  for(const p of data.posts){
    const d = document.createElement('div'); d.className = 'post';
    const h = document.createElement('div'); h.innerHTML = `<strong style="text-transform:lowercase">${p.type}</strong> <em>${escapeHtml(p.title || '')}</em>`;
    const b = document.createElement('div'); b.textContent = p.body;
    const t = document.createElement('div'); t.style.fontSize='13px'; t.style.color='#666'; t.textContent = formatDate(p.createdAt);
    d.appendChild(h); d.appendChild(b); d.appendChild(t);
    wrapper.appendChild(d);
  }
}

async function handleCreatePost(){
  const type = el('post-type').value;
  const title = el('post-title').value.trim();
  const body = el('post-body').value.trim();
  if(!body) return alert('Post body required');
  const data = await api('/posts', { method: 'POST', body: JSON.stringify({ type, title, body }) });
  if(data && data.post){ el('post-title').value=''; el('post-body').value=''; fetchAndRenderPosts(); }
  else if(data && data.error) alert(JSON.stringify(data));
  else alert('Unexpected error while creating post');
}

// AI assistant
async function handleAskAI(){
  const prompt = el('ai-prompt').value.trim();
  const replyBox = el('ai-reply');
  replyBox.textContent = 'Thinking...';
  if(!prompt){ replyBox.textContent = 'Please enter a prompt.'; return; }
  const data = await api('/ai/assistant', { method: 'POST', body: JSON.stringify({ prompt }) });
  if(data && data.reply){ replyBox.textContent = data.reply;
    if(data.fallback){ const note = document.createElement('div'); note.style.fontSize='12px'; note.style.color='#666'; note.textContent = '⚠️ Using fallback AI mode (OpenAI unavailable or quota exceeded).'; replyBox.appendChild(note); }
  } else {
    replyBox.textContent = JSON.stringify(data);
  }
}

// Utilities
function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(iso){ if(!iso) return ''; try{ const d = new Date(iso); return d.toLocaleString(); }catch(e){ return iso; } }

// Init and event wiring
document.addEventListener('DOMContentLoaded', ()=>{
  loadToken();
  // wire auth
  const signupBtn = el('signup'); const loginBtn = el('login');
  if(signupBtn) signupBtn.addEventListener('click', handleSignup);
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);

  // posts
  const createPostBtn = el('create-post'); if(createPostBtn) createPostBtn.addEventListener('click', handleCreatePost);

  // AI
  const aiBtn = el('ai-send'); if(aiBtn) aiBtn.addEventListener('click', handleAskAI);

  // show feed if token exists
  if(token) showFeed(); else showAuth();

  // initial load of reels placeholder
  const reels = el('reels'); if(reels) reels.innerHTML = '<div class="post"><h4>Reel</h4><div>Welcome to AIConnect Pro</div></div>';
});

// expose for debugging (optional)
window.__aiconnect = { api, saveToken, clearToken, loadToken };
