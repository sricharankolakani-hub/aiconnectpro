import { getUser } from './auth.js';

const token = localStorage.getItem('token');
const status = document.getElementById('messages-status');
const inbox = document.getElementById('inbox-list');
const thread = document.getElementById('thread-messages');
const form = document.getElementById('message-form');
const field = document.getElementById('message-body');
let user = null;
let activePeer = null;

async function api(path, options = {}) {
  const response = await fetch('/api/messages' + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Could not complete this request.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function initials(name) {
  return String(name || 'Member').trim().split(/\\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'A';
}

function renderInbox(rows) {
  inbox.replaceChildren();
  if (!rows.length) {
    inbox.append(el('p', 'message-empty', 'Your inbox is empty. Connect with a member to start a conversation.'));
    return;
  }
  for (const item of rows) {
    const link = el('a', 'inbox-link');
    link.href = 'messages.html?user=' + encodeURIComponent(item.peer.id);
    link.setAttribute('aria-current', item.peer.id === activePeer ? 'true' : 'false');

    const avatar = el('span', 'inbox-avatar', initials(item.peer.full_name));
    avatar.setAttribute('aria-hidden', 'true');
    const copy = el('span', 'inbox-link-copy');
    const heading = el('span', 'inbox-link-head');
    heading.append(el('strong', '', item.peer.full_name));
    if (item.unread_count) {
      const badge = el('span', 'inbox-unread-badge', item.unread_count > 99 ? '99+' : String(item.unread_count));
      badge.setAttribute('aria-label', item.unread_count + ' unread messages');
      heading.append(badge);
    }
    copy.append(heading);

    const latest = item.latest_message;
    const preview = latest?.sender_id === user.id ? 'You: ' + latest.body : (latest?.body || 'Start a conversation');
    copy.append(el('span', 'inbox-preview', preview));
    link.append(avatar, copy);
    inbox.append(link);
  }
}

function renderMessages(rows) {
  thread.replaceChildren();
  if (!rows.length) {
    thread.append(el('p', 'message-empty', 'No messages yet. Say hello.'));
    return;
  }
  for (const message of rows) {
    const bubble = el('article', 'message' + (message.sender_id === user.id ? ' mine' : ''), message.body);
    const date = new Date(message.created_at);
    bubble.append(el('time', '', Number.isNaN(date.getTime()) ? '' : date.toLocaleString()));
    if (message.sender_id === user.id) {
      const receipt = message.read_at
        ? 'Seen ' + new Date(message.read_at).toLocaleString()
        : 'Sent';
      bubble.append(el('span', 'message-receipt', receipt));
    }
    thread.append(bubble);
  }
  thread.scrollTop = thread.scrollHeight;
}

async function loadInbox() {
  const data = await api('');
  renderInbox(data.conversations || []);
}

async function openThread(peerId) {
  const data = await api('/' + encodeURIComponent(peerId));
  activePeer = peerId;
  document.getElementById('peer-name').textContent = data.peer.full_name;
  document.getElementById('peer-avatar').textContent = initials(data.peer.full_name);
  document.getElementById('peer-avatar').setAttribute('aria-label', data.peer.full_name);
  form.hidden = false;
  renderMessages(data.messages || []);
  await loadInbox();
}

field.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!form.querySelector('button').disabled) form.requestSubmit();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!activePeer) return;
  const body = field.value.trim();
  if (!body) return;
  const submit = form.querySelector('button');
  submit.disabled = true;
  try {
    await api('/' + encodeURIComponent(activePeer), { method: 'POST', body: JSON.stringify({ body }) });
    field.value = '';
    await openThread(activePeer);
    field.focus();
  } catch (error) {
    status.textContent = error.message;
  } finally { submit.disabled = false; }
});

document.getElementById('refresh-messages').addEventListener('click', async () => {
  try {
    await loadInbox();
    if (activePeer) await openThread(activePeer);
    status.textContent = 'Messages refreshed.';
  } catch (error) { status.textContent = error.message; }
});

window.setInterval(() => {
  if (document.hidden) return;
  if (activePeer) openThread(activePeer).catch(error => { status.textContent = error.message; });
  else loadInbox().catch(error => { status.textContent = error.message; });
}, 15000);

window.addEventListener('focus', () => {
  loadInbox().catch(error => { status.textContent = error.message; });
  if (activePeer) openThread(activePeer).catch(error => { status.textContent = error.message; });
});

async function initialize() {
  if (!token) return window.location.replace('login.html');
  try {
    user = await getUser();
    if (!user) return window.location.replace('login.html');
    await loadInbox();
    const peerId = new URLSearchParams(window.location.search).get('user');
    if (peerId) await openThread(peerId);
  } catch (error) {
    status.textContent = error.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load messages. Please try refreshing.';
    if (error.status === 401) window.location.replace('login.html');
  }
}

initialize();
