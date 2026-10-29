const API_BASE = '/api';
const feedEl = document.getElementById('feed');
const createResult = document.getElementById('create-result');
const feedStatus = document.getElementById('feed-status');
const createForm = document.getElementById('create-form');
const postButton = document.getElementById('post-reel');
const loadMoreButton = document.getElementById('load-more-btn');
let offset = 0;
const limit = 8;
let loading = false;

function byId(id) { return document.getElementById(id); }
function tokenHeaders(json = false) {
  const token = localStorage.getItem('token') || '';
  return { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) };
}
function setStatus(element, message, error = false) {
  element.textContent = message;
  element.dataset.state = error ? 'error' : '';
}
function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}
function mediaLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function renderReel(reel) {
  const card = node('article', 'reel-post');
  card.id = 'reel-' + reel.id;
  const title = (reel.title || '').trim();
  if (title) card.append(node('h3', '', title));

  const meta = node('div', 'reel-meta');
  meta.append(node('span', '', 'AIConnectPro member'));
  const created = new Date(reel.created_at);
  meta.append(node('time', '', Number.isNaN(created.getTime()) ? '' : created.toLocaleString()));
  card.append(meta);

  const body = (reel.body || '').trim();
  if (body) card.append(node('p', 'reel-body', body));

  const safeMedia = mediaLink(reel.media_url || '');
  if (safeMedia) {
    const link = node('a', 'reel-media', 'Open shared media ↗');
    link.href = safeMedia;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
  }

  const actions = node('div', 'reel-actions');
  const like = node('button', 'reel-action', 'Like');
  like.type = 'button'; like.dataset.action = 'like'; like.dataset.id = reel.id; like.setAttribute('aria-pressed', 'false');
  const comment = node('button', 'reel-action', 'Comment');
  comment.type = 'button'; comment.dataset.action = 'comment'; comment.dataset.id = reel.id;
  const share = node('button', 'reel-action', 'Copy link');
  share.type = 'button'; share.dataset.action = 'share'; share.dataset.id = reel.id;
  actions.append(like, comment, share);
  card.append(actions, node('div', 'reel-comments'));
  return card;
}

async function loadReels({ reset = false } = {}) {
  if (loading) return;
  if (reset) { offset = 0; feedEl.replaceChildren(); }
  loading = true;
  loadMoreButton.disabled = true;
  setStatus(feedStatus, 'Loading posts…');
  try {
    const response = await fetch(`${API_BASE}/reels?limit=${limit}&offset=${offset}`, { headers: tokenHeaders() });
    if (response.status === 401) {
      feedEl.replaceChildren(node('p', 'reels-empty', 'Sign in to see the community feed.'));
      loadMoreButton.hidden = true;
      setStatus(feedStatus, 'Your feed is available after you sign in.');
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load posts.');
    const reels = data.reels || [];
    if (offset === 0 && reels.length === 0) {
      feedEl.replaceChildren(node('p', 'reels-empty', 'No posts yet. Share the first useful idea with the community.'));
    } else {
      for (const reel of reels) feedEl.append(renderReel(reel));
      const target = location.hash.slice(1);
      if (target && offset === 0) document.getElementById(target)?.scrollIntoView({ block: 'center' });
    }
    offset += reels.length;
    loadMoreButton.hidden = reels.length < limit;
    setStatus(feedStatus, reels.length ? 'Showing the latest community posts.' : 'You’ve reached the end of the feed.');
  } catch (error) {
    setStatus(feedStatus, error.message || 'Could not load the community feed.', true);
    if (offset === 0 && feedEl.childElementCount === 0) feedEl.replaceChildren(node('p', 'reels-empty', 'The feed could not load. Try refreshing.'));
  } finally {
    loading = false;
    loadMoreButton.disabled = false;
  }
}

async function postReel(event) {
  event.preventDefault();
  const title = byId('reel-title').value.trim();
  const body = byId('reel-body').value.trim();
  const media_url = byId('reel-media').value.trim();
  if (!body && !media_url) {
    setStatus(createResult, 'Add a short insight or a media link before publishing.', true);
    return;
  }
  if (media_url && !mediaLink(media_url)) {
    setStatus(createResult, 'Use a valid http or https link for shared media.', true);
    return;
  }
  postButton.disabled = true;
  setStatus(createResult, 'Publishing…');
  try {
    const response = await fetch(`${API_BASE}/reels`, {
      method: 'POST', headers: tokenHeaders(true),
      body: JSON.stringify({ title, body, media_url, visibility: byId('reel-visibility').value })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Please sign in to publish a post.');
    if (!response.ok || data.error) throw new Error(data.error || 'Could not publish this post.');
    createForm.reset();
    setStatus(createResult, 'Your post is live.');
    await loadReels({ reset: true });
  } catch (error) {
    setStatus(createResult, error.message || 'Could not publish this post.', true);
  } finally { postButton.disabled = false; }
}

async function handleAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const card = button.closest('.reel-post');
  if (action === 'comment') {
    const area = card.querySelector('.reel-comments');
    if (area.querySelector('form')) { area.replaceChildren(); return; }
    const form = node('form', 'reel-comment-form');
    const input = node('input');
    input.type = 'text'; input.maxLength = 1000; input.required = true; input.placeholder = 'Write a thoughtful comment…'; input.setAttribute('aria-label', 'Comment');
    const submit = node('button', 'reel-action', 'Send'); submit.type = 'submit';
    form.append(input, submit);
    form.addEventListener('submit', async submitEvent => {
      submitEvent.preventDefault();
      submit.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/reels/${encodeURIComponent(id)}/comment`, {
          method: 'POST', headers: tokenHeaders(true), body: JSON.stringify({ comment: input.value.trim() })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) throw new Error(data.error || 'Could not post your comment.');
        area.replaceChildren(node('p', 'reel-comment', data.comment.comment));
        setStatus(feedStatus, 'Comment added.');
      } catch (error) { setStatus(feedStatus, error.message || 'Could not post your comment.', true); }
      finally { submit.disabled = false; }
    });
    area.replaceChildren(form); input.focus();
    return;
  }

  if (action === 'like') {
    button.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/reels/${encodeURIComponent(id)}/like`, { method: 'POST', headers: tokenHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update your like.');
      button.textContent = data.liked ? 'Liked' : 'Like';
      button.setAttribute('aria-pressed', String(Boolean(data.liked)));
    } catch (error) { setStatus(feedStatus, error.message || 'Could not update your like.', true); }
    finally { button.disabled = false; }
    return;
  }

  if (action === 'share') {
    const url = location.origin + location.pathname + '#reel-' + id;
    try {
      await navigator.clipboard.writeText(url);
      setStatus(feedStatus, 'Link copied. Share it with someone who may find this useful.');
    } catch {
      setStatus(feedStatus, 'Copy the page address and add #reel-' + id + ' to share this post.');
    }
  }
}

const token = localStorage.getItem('token');
if (!token) {
  createForm.hidden = true;
  const prompt = node('div', 'reels-auth-prompt');
  prompt.append(node('p', '', 'Sign in to publish a post. Your account is required to like or comment too.'));
  const link = node('a', 'button button-primary', 'Log in');
  link.href = 'login.html';
  prompt.append(link);
  document.getElementById('create-panel').append(prompt);
}

createForm.addEventListener('submit', postReel);
feedEl.addEventListener('click', handleAction);
loadMoreButton.addEventListener('click', () => loadReels());
byId('refresh-feed').addEventListener('click', () => loadReels({ reset: true }));
loadReels();
