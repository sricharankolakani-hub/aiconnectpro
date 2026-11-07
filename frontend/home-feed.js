import { getUser } from './auth.js';

const feedSection = document.getElementById('professional-feed');
const form = document.getElementById('post-composer');
const postList = document.getElementById('feed-post-list');
const status = document.getElementById('professional-feed-status');
const publishButton = document.getElementById('publish-post');
const typeLabels = {
  update: 'Professional update',
  milestone: 'Career milestone',
  business: 'Business update',
  learning: 'Learning insight'
};
const audienceLabels = {
  private: 'Only me',
  connections: 'My connections'
};

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : '';
}

async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/posts' + path, {
    ...options,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || (response.status === 401
      ? 'Please sign in again to open your feed.'
      : 'The feed could not be updated. Please try again.');
    throw new Error(message);
  }
  return data;
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function renderPost(post, currentUserId) {
  const card = document.createElement('article');
  card.className = 'feed-post-card';

  const header = document.createElement('div');
  header.className = 'feed-post-header';
  const authorBlock = document.createElement('div');
  const author = document.createElement('div');
  author.className = 'feed-author';
  author.textContent = post.author_id === currentUserId ? 'You' : (post.author_name || 'AIConnectPro member');
  const meta = document.createElement('div');
  meta.className = 'feed-meta';
  const type = document.createElement('span');
  type.textContent = typeLabels[post.type] || 'Professional update';
  const separator = document.createElement('span');
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '·';
  const date = document.createElement('time');
  date.dateTime = post.created_at;
  date.textContent = formatDate(post.created_at);
  const audience = document.createElement('span');
  audience.className = 'feed-audience';
  audience.textContent = audienceLabels[post.visibility] || 'Private';
  meta.append(type, separator, date, audience);
  authorBlock.append(author, meta);
  header.append(authorBlock);

  if (post.author_id === currentUserId) {
    const remove = document.createElement('button');
    remove.className = 'feed-delete';
    remove.type = 'button';
    remove.dataset.deletePost = post.id;
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', 'Delete your post');
    header.append(remove);
  }

  const title = document.createElement('h3');
  title.className = 'feed-post-title';
  title.textContent = post.title || typeLabels[post.type] || 'Professional update';
  const body = document.createElement('p');
  body.className = 'feed-post-body';
  body.textContent = post.body || '';
  card.append(header, title, body);
  return card;
}

async function loadFeed(currentUserId) {
  postList.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'feed-empty';
  loading.textContent = 'Loading your updates…';
  postList.append(loading);
  const { posts = [] } = await api('/');
  postList.replaceChildren();
  if (!posts.length) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = 'No updates yet. Your first post will be private unless you choose to share it with your connections.';
    postList.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const post of posts) fragment.append(renderPost(post, currentUserId));
  postList.append(fragment);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const body = document.getElementById('post-body').value.trim();
  const title = document.getElementById('post-title').value.trim();
  const type = document.getElementById('post-type').value;
  const visibility = document.getElementById('post-visibility').value;
  if (!body) {
    setStatus('Write an update before sharing.', true);
    return;
  }

  publishButton.disabled = true;
  publishButton.textContent = 'Sharing…';
  try {
    await api('/', {
      method: 'POST',
      body: JSON.stringify({ type, title, body, visibility })
    });
    form.reset();
    setStatus(visibility === 'private' ? 'Saved privately to your profile.' : 'Shared with your connections.');
    await loadFeed(currentUser.id);
  } catch (error) {
    setStatus(error.message || 'Your update could not be shared. Please try again.', true);
  } finally {
    publishButton.disabled = false;
    publishButton.innerHTML = 'Share update <span aria-hidden="true">→</span>';
  }
});

postList.addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-post]');
  if (!button) return;
  if (!window.confirm('Delete this post permanently?')) return;

  button.disabled = true;
  button.textContent = 'Deleting…';
  try {
    await api('/' + encodeURIComponent(button.dataset.deletePost), { method: 'DELETE' });
    setStatus('Your post was deleted.');
    await loadFeed(currentUser.id);
  } catch (error) {
    setStatus(error.message || 'Your post could not be deleted. Please try again.', true);
    button.disabled = false;
    button.textContent = 'Delete';
  }
});

let currentUser = null;
try {
  currentUser = await getUser();
  if (currentUser) {
    feedSection.hidden = false;
    await loadFeed(currentUser.id);
  }
} catch {
  setStatus('Sign in again to view your professional feed.', true);
}
