// frontend/reels.js
const API_BASE = '/api';
const feedEl = document.getElementById('feed');
const createResult = document.getElementById('create-result');
let offset = 0;
const limit = 8;

function el(id){ return document.getElementById(id); }

function renderReel(r){
  const div = document.createElement('div');
  div.className = 'reel';
  div.innerHTML = `
    <div class="meta"><div><strong>${r.title || 'Untitled'}</strong></div><div class="small">${new Date(r.created_at).toLocaleString()}</div></div>
    <div class="body">${escapeHtml(r.body || '')}</div>
    ${r.media_url ? `<div style="margin-bottom:8px;"><a href="${r.media_url}" target="_blank">Media</a></div>` : ''}
    <div class="actions">
      <button class="btn like-btn" data-id="${r.id}">Like</button>
      <button class="btn comment-btn" data-id="${r.id}">Comment</button>
      <div class="small" style="margin-left:auto;">By: ${r.user_id}</div>
    </div>
    <div class="comments" id="comments-${r.id}" style="margin-top:8px;"></div>
  `;
  return div;
}

function escapeHtml(s){
  if(!s) return '';
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

async function loadReels() {
  document.getElementById('load-more-btn').disabled = true;
  try {
    const res = await fetch(`${API_BASE}/reels?limit=${limit}&offset=${offset}`, { headers: authHeader() });
    if (res.status === 401) {
      feedEl.innerHTML = '<div class="small">Please sign in to view the feed.</div>';
      return;
    }
    const j = await res.json();
    (j.reels || []).forEach(r => {
      const node = renderReel(r);
      feedEl.appendChild(node);
    });
    offset += (j.reels || []).length;
  } catch (err) {
    console.error(err);
  } finally {
    document.getElementById('load-more-btn').disabled = false;
  }
}

function authHeader(){
  // Expect user to have token in localStorage 'token' (adjust to your auth storage)
  const token = localStorage.getItem('token') || '';
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
  return headers;
}

async function postReel(){
  createResult.textContent = 'Posting...';
  const payload = {
    title: el('reel-title').value.trim(),
    body: el('reel-body').value.trim(),
    media_url: el('reel-media').value.trim(),
    visibility: el('reel-visibility').value
  };
  try {
    const res = await fetch(`${API_BASE}/reels`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
      body: JSON.stringify(payload)
    });
    if (res.status === 401){
      createResult.textContent = 'Please sign in to post a reel.';
      return;
    }
    const j = await res.json();
    if (j.error) {
      createResult.textContent = 'Error: ' + JSON.stringify(j);
      return;
    }
    // prepend to feed
    const node = renderReel(j.reel);
    feedEl.insertBefore(node, feedEl.firstChild);
    createResult.textContent = 'Posted!';
    // clear form
    el('reel-title').value = '';
    el('reel-body').value = '';
    el('reel-media').value = '';
  } catch (err) {
    console.error(err);
    createResult.textContent = 'Failed to post.';
  }
}

// event delegation for like/comment buttons
document.addEventListener('click', async (e) => {
  const likeBtn = e.target.closest('.like-btn');
  if (likeBtn){
    const id = likeBtn.dataset.id;
    try {
      const res = await fetch(`${API_BASE}/reels/${id}/like`, {
        method: 'POST',
        headers: authHeader()
      });
      const j = await res.json();
      likeBtn.textContent = j.liked ? 'Liked' : 'Like';
    } catch (err) { console.error(err); }
  }

  const commentBtn = e.target.closest('.comment-btn');
  if (commentBtn){
    const id = commentBtn.dataset.id;
    const text = prompt('Enter your comment:');
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE}/reels/${id}/comment`, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body: JSON.stringify({ comment: text })
      });
      const j = await res.json();
      if (j.error) { alert('Error: ' + JSON.stringify(j)); return; }
      // append comment to UI
      const commentsEl = document.getElementById('comments-' + id);
      const c = document.createElement('div');
      c.className = 'small';
      c.textContent = `${j.comment.user_id}: ${j.comment.comment}`;
      commentsEl.appendChild(c);
    } catch (err) { console.error(err); }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadReels();
  document.getElementById('load-more-btn').addEventListener('click', loadReels);
  document.getElementById('post-reel').addEventListener('click', postReel);
});
