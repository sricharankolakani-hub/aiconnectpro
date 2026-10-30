import { supabase } from './auth.js';

const API_BASE = '/api';
const feedEl = document.getElementById('feed');
const createResult = document.getElementById('create-result');
const mediaInput = document.getElementById('reel-file');
let offset = 0;
const limit = 8;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);

const byId = id => document.getElementById(id);
const authHeader = () => {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
};

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { ...authHeader(), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function renderComment(comment) {
  const item = node('p', 'reel-comment');
  const author = node('strong', '', 'Member ' + String(comment.user_id || '').slice(0, 8));
  item.append(author, document.createTextNode(' ' + (comment.comment || '')));
  return item;
}

function renderReel(reel) {
  const card = node('article', 'reel');
  card.id = 'reel-' + reel.id;
  card.dataset.id = reel.id;
  const header = node('div', 'reel-header');
  header.append(
    node('strong', 'reel-title', reel.title || 'A community Reel'),
    node('time', 'reel-date', new Date(reel.created_at).toLocaleString())
  );
  card.append(header);

  if (reel.body) card.append(node('p', 'reel-body', reel.body));
  if (reel.media_url) {
    const media = document.createElement(/\.(mp4|webm)(\?|$)/i.test(reel.media_url) ? 'video' : 'img');
    media.className = 'reel-media';
    media.src = reel.media_url;
    if (media.tagName === 'VIDEO') {
      media.controls = true;
      media.playsInline = true;
      media.preload = 'metadata';
    } else {
      media.alt = reel.title || 'Reel attachment';
      media.loading = 'lazy';
    }
    card.append(media);
  }

  const actions = node('div', 'reel-actions');
  const like = node('button', 'reel-action like-btn', (reel.liked ? '♥ Liked' : '♡ Like') + ' · ' + (reel.like_count || 0));
  like.type = 'button'; like.dataset.id = reel.id; like.setAttribute('aria-pressed', String(Boolean(reel.liked)));
  const comments = node('button', 'reel-action comments-toggle', 'Comments · ' + (reel.comment_count || 0));
  comments.type = 'button'; comments.dataset.id = reel.id;
  actions.append(like, comments);
  if (reel.visibility === 'public') {
    const share = node('button', 'reel-action share-btn', 'Share · ' + (reel.share_count || 0));
    share.type = 'button'; share.dataset.id = reel.id;
    actions.append(share);
  }
  card.append(actions);

  const commentArea = node('section', 'reel-comments');
  commentArea.id = 'comments-' + reel.id;
  commentArea.setAttribute('aria-label', 'Comments');
  (reel.recent_comments || []).slice().reverse().forEach(comment => commentArea.append(renderComment(comment)));
  const form = node('form', 'reel-comment-form');
  form.dataset.id = reel.id;
  const input = document.createElement('input');
  input.name = 'comment'; input.maxLength = 1500; input.placeholder = 'Write a comment'; input.setAttribute('aria-label', 'Write a comment');
  const submit = node('button', 'reel-action', 'Send');
  submit.type = 'submit';
  form.append(input, submit);
  commentArea.append(form);
  card.append(commentArea);
  return card;
}

async function loadReels() {
  const loadMore = byId('load-more-btn');
  loadMore.disabled = true;
  try {
    const result = await api('/reels?limit=' + limit + '&offset=' + offset);
    const reels = result.reels || [];
    reels.forEach(reel => feedEl.append(renderReel(reel)));
    if (offset === 0) {
      const target = window.location.hash.slice(1);
      if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'center' }));
    }
    offset += reels.length;
    loadMore.hidden = reels.length < limit;
    if (!reels.length && offset === 0) feedEl.textContent = 'No Reels yet. Share the first one.';
  } catch (error) {
    feedEl.textContent = error.message === 'Unauthorized' ? 'Please sign in to view Reels.' : 'We could not load the feed. Please try again.';
  } finally {
    loadMore.disabled = false;
  }
}

async function uploadMedia(file) {
  if (!file) return null;
  if (!ALLOWED_MEDIA_TYPES.has(file.type)) throw new Error('Choose a JPG, PNG, WebP, MP4, or WebM file.');
  if (file.size > MAX_MEDIA_BYTES) throw new Error('Media must be 25 MB or smaller.');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in again before uploading media.');
  const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = authData.user.id + '/' + crypto.randomUUID() + '.' + extension;
  const { error } = await supabase.storage.from('reel-media').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type
  });
  if (error) throw new Error('Media upload failed: ' + error.message);
  return path;
}

async function postReel(event) {
  event.preventDefault();
  const submit = byId('post-reel');
  const file = mediaInput.files[0];
  let uploadedPath = null;
  submit.disabled = true;
  createResult.textContent = file ? 'Uploading media…' : 'Posting…';
  try {
    uploadedPath = await uploadMedia(file);
    createResult.textContent = 'Publishing Reel…';
    const result = await api('/reels', {
      method: 'POST',
      body: JSON.stringify({
        title: byId('reel-title').value.trim(),
        body: byId('reel-body').value.trim(),
        media_url: uploadedPath,
        visibility: byId('reel-visibility').value
      })
    });
    feedEl.prepend(renderReel(result.reel));
    createResult.textContent = 'Your Reel is live.';
    byId('reel-title').value = '';
    byId('reel-body').value = '';
    mediaInput.value = '';
  } catch (error) {
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from('reel-media').remove([uploadedPath]);
      if (cleanupError) console.warn('Unable to remove incomplete Reel upload', cleanupError);
    }
    createResult.textContent = error.message || 'We could not post your Reel.';
  } finally {
    submit.disabled = false;
  }
}

async function toggleLike(button) {
  button.disabled = true;
  try {
    const result = await api('/reels/' + encodeURIComponent(button.dataset.id) + '/like', { method: 'POST' });
    button.textContent = (result.liked ? '♥ Liked' : '♡ Like') + ' · ' + result.like_count;
    button.setAttribute('aria-pressed', String(result.liked));
  } catch (error) {
    createResult.textContent = error.message;
  } finally { button.disabled = false; }
}

async function loadAllComments(button) {
  const area = byId('comments-' + button.dataset.id);
  button.disabled = true;
  try {
    const result = await api('/reels/' + encodeURIComponent(button.dataset.id) + '/comments?limit=50');
    area.querySelectorAll('.reel-comment').forEach(item => item.remove());
    (result.comments || []).slice().reverse().forEach(comment => area.insertBefore(renderComment(comment), area.firstChild));
  } catch (error) {
    createResult.textContent = error.message;
  } finally { button.disabled = false; }
}

async function shareReel(button) {
  const url = new URL('reels.html#reel-' + encodeURIComponent(button.dataset.id), window.location.href).toString();
  try {
    if (navigator.share) await navigator.share({ title: 'AIConnectPro Reel', url });
    else await navigator.clipboard.writeText(url);
    const result = await api('/reels/' + encodeURIComponent(button.dataset.id) + '/share', { method: 'POST' });
    button.textContent = 'Share · ' + result.share_count;
    createResult.textContent = navigator.share ? 'Reel shared.' : 'Reel link copied.';
  } catch (error) {
    if (error.name !== 'AbortError') createResult.textContent = 'Could not share this Reel. ' + error.message;
  }
}

document.addEventListener('click', event => {
  const like = event.target.closest('.like-btn');
  if (like) return void toggleLike(like);
  const comments = event.target.closest('.comments-toggle');
  if (comments) return void loadAllComments(comments);
  const share = event.target.closest('.share-btn');
  if (share) return void shareReel(share);
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('.reel-comment-form');
  if (!form) return;
  event.preventDefault();
  const input = form.elements.comment;
  const value = input.value.trim();
  if (!value) return;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const result = await api('/reels/' + encodeURIComponent(form.dataset.id) + '/comment', {
      method: 'POST', body: JSON.stringify({ comment: value })
    });
    const area = form.closest('.reel-comments');
    area.insertBefore(renderComment(result.comment), form);
    const countButton = form.closest('.reel').querySelector('.comments-toggle');
    countButton.textContent = 'Comments · ' + result.comment_count;
    input.value = '';
  } catch (error) { createResult.textContent = error.message; }
  finally { button.disabled = false; }
});

byId('create-form').addEventListener('submit', postReel);
mediaInput.addEventListener('change', () => {
  const file = mediaInput.files[0];
  byId('media-help').textContent = file ? file.name + ' · ' + Math.ceil(file.size / 1024 / 1024) + ' MB' : 'Optional photo or short video, up to 25 MB.';
});
byId('load-more-btn').addEventListener('click', loadReels);
loadReels();
