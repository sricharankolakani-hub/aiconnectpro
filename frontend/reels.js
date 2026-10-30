import { supabase } from './auth.js';

const API_BASE = '/api';
const feedEl = document.getElementById('feed');
const createResult = document.getElementById('create-result');
const feedStatus = document.getElementById('feed-status');
const createForm = document.getElementById('create-form');
const postButton = document.getElementById('post-reel');
const loadMoreButton = document.getElementById('load-more-btn');
const mediaInput = document.getElementById('reel-file');
let offset = 0;
const limit = 8;
let loading = false;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);

function byId(id) { return document.getElementById(id); }
const authHeader = () => {
  const token = localStorage.getItem('token') || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
};
function setStatus(element, message, error = false) {
  element.textContent = message;
  element.dataset.state = error ? 'error' : '';
}
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
  const card = node('article', 'reel-post');
  card.id = 'reel-' + reel.id;
  const title = (reel.title || '').trim();
  if (title) card.append(node('h3', '', title));

  const meta = node('div', 'reel-meta');
  meta.append(node('span', '', 'AIConnectPro member'));
  const created = new Date(reel.created_at);
  meta.append(node('time', '', Number.isNaN(created.getTime()) ? '' : created.toLocaleString()));
  card.append(meta);

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
      media.alt = title || 'Reel attachment';
      media.loading = 'lazy';
    }
    card.append(media);
  }

  const actions = node('div', 'reel-actions');
  const like = node('button', 'reel-action like-btn', (reel.liked ? '♥ Liked' : '♡ Like') + ' · ' + (reel.like_count || 0));
  like.type = 'button';
  like.dataset.id = reel.id;
  like.setAttribute('aria-pressed', String(Boolean(reel.liked)));
  const comments = node('button', 'reel-action comments-toggle', 'Comments · ' + (reel.comment_count || 0));
  comments.type = 'button';
  comments.dataset.id = reel.id;
  actions.append(like, comments);
  if (reel.visibility === 'public') {
    const share = node('button', 'reel-action share-btn', 'Share · ' + (reel.share_count || 0));
    share.type = 'button';
    share.dataset.id = reel.id;
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
  input.name = 'comment';
  input.maxLength = 1500;
  input.placeholder = 'Write a comment';
  input.setAttribute('aria-label', 'Write a comment');
  const submit = node('button', 'reel-action', 'Send');
  submit.type = 'submit';
  form.append(input, submit);
  commentArea.append(form);
  card.append(commentArea);
  return card;
}

async function loadReels({ reset = false } = {}) {
  if (loading) return;
  if (reset) {
    offset = 0;
    feedEl.replaceChildren();
  }
  loading = true;
  loadMoreButton.disabled = true;
  setStatus(feedStatus, 'Loading posts…');
  try {
    const result = await api('/reels?limit=' + limit + '&offset=' + offset);
    const reels = result.reels || [];
    if (offset === 0 && reels.length === 0) {
      feedEl.replaceChildren(node('p', 'reels-empty', 'No posts yet. Share the first useful idea with the community.'));
    } else {
      reels.forEach(reel => feedEl.append(renderReel(reel)));
      if (offset === 0) {
        const target = window.location.hash.slice(1);
        if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'center' }));
      }
    }
    offset += reels.length;
    loadMoreButton.hidden = reels.length < limit;
    setStatus(feedStatus, reels.length ? 'Showing the latest community posts.' : 'You’ve reached the end of the feed.');
  } catch (error) {
    setStatus(feedStatus, error.message || 'Could not load the community feed.', true);
    if (offset === 0 && feedEl.childElementCount === 0) {
      feedEl.replaceChildren(node('p', 'reels-empty', 'The feed could not load. Try refreshing.'));
    }
  } finally {
    loading = false;
    loadMoreButton.disabled = false;
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
  const title = byId('reel-title').value.trim();
  const body = byId('reel-body').value.trim();
  const file = mediaInput.files[0];
  if (!title && !body && !file) {
    setStatus(createResult, 'Add a title, message, photo, or video before publishing.', true);
    return;
  }
  let uploadedPath = null;
  postButton.disabled = true;
  setStatus(createResult, file ? 'Uploading media…' : 'Publishing…');
  try {
    uploadedPath = await uploadMedia(file);
    const result = await api('/reels', {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        media_url: uploadedPath,
        visibility: byId('reel-visibility').value
      })
    });
    createForm.reset();
    mediaInput.value = '';
    setStatus(createResult, 'Your post was saved.');
    await loadReels({ reset: true });
  } catch (error) {
    if (uploadedPath) {
      try {
        const { error: cleanupError } = await supabase.storage.from('reel-media').remove([uploadedPath]);
        if (cleanupError) console.warn('Unable to remove incomplete Reel upload', cleanupError);
      } catch (cleanupError) {
        console.warn('Unable to remove incomplete Reel upload', cleanupError);
      }
    }
    setStatus(createResult, error.message || 'Could not publish this post.', true);
  } finally {
    postButton.disabled = false;
  }
}

async function toggleLike(button) {
  button.disabled = true;
  try {
    const result = await api('/reels/' + encodeURIComponent(button.dataset.id) + '/like', { method: 'POST' });
    button.textContent = (result.liked ? '♥ Liked' : '♡ Like') + ' · ' + result.like_count;
    button.setAttribute('aria-pressed', String(result.liked));
  } catch (error) {
    setStatus(feedStatus, error.message || 'Could not update your like.', true);
  } finally {
    button.disabled = false;
  }
}

async function loadAllComments(button) {
  const area = byId('comments-' + button.dataset.id);
  button.disabled = true;
  try {
    const result = await api('/reels/' + encodeURIComponent(button.dataset.id) + '/comments?limit=50');
    const form = area.querySelector('form');
    area.querySelectorAll('.reel-comment').forEach(item => item.remove());
    (result.comments || []).slice().reverse().forEach(comment => {
      if (form) area.insertBefore(renderComment(comment), form);
      else area.append(renderComment(comment));
    });
  } catch (error) {
    setStatus(feedStatus, error.message || 'Could not load comments.', true);
  } finally {
    button.disabled = false;
  }
}

async function shareReel(button) {
  const url = new URL('reels.html#reel-' + encodeURIComponent(button.dataset.id), window.location.href).toString();
  try {
    if (navigator.share) await navigator.share({ title: 'AIConnectPro Reel', url });
    else await navigator.clipboard.writeText(url);
    const result = await api('/reels/' + encodeURIComponent(button.dataset.id) + '/share', { method: 'POST' });
    button.textContent = 'Share · ' + result.share_count;
    setStatus(feedStatus, navigator.share ? 'Reel shared.' : 'Reel link copied.');
  } catch (error) {
    if (error.name !== 'AbortError') setStatus(feedStatus, 'Could not share this Reel. ' + error.message, true);
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

feedEl.addEventListener('click', event => {
  const like = event.target.closest('.like-btn');
  if (like) return void toggleLike(like);
  const comments = event.target.closest('.comments-toggle');
  if (comments) return void loadAllComments(comments);
  const share = event.target.closest('.share-btn');
  if (share) return void shareReel(share);
});
feedEl.addEventListener('submit', async event => {
  const form = event.target.closest('.reel-comment-form');
  if (!form) return;
  event.preventDefault();
  const input = form.elements.comment;
  const value = input.value.trim();
  if (!value) return;
  const submit = form.querySelector('button');
  submit.disabled = true;
  try {
    const result = await api('/reels/' + encodeURIComponent(form.dataset.id) + '/comment', {
      method: 'POST',
      body: JSON.stringify({ comment: value })
    });
    const area = form.closest('.reel-comments');
    area.insertBefore(renderComment(result.comment), form);
    const countButton = form.closest('.reel-post').querySelector('.comments-toggle');
    countButton.textContent = 'Comments · ' + result.comment_count;
    input.value = '';
    setStatus(feedStatus, 'Comment added.');
  } catch (error) {
    setStatus(feedStatus, error.message || 'Could not post your comment.', true);
  } finally {
    submit.disabled = false;
  }
});
mediaInput.addEventListener('change', () => {
  const file = mediaInput.files[0];
  if (file) setStatus(createResult, file.name + ' · ' + Math.ceil(file.size / 1024 / 1024) + ' MB selected.');
});
createForm.addEventListener('submit', postReel);
loadMoreButton.addEventListener('click', () => loadReels());
byId('refresh-feed').addEventListener('click', () => loadReels({ reset: true }));
loadReels();
