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
    link.append(el('strong', '', item.peer.full_name));
    link.append(el('span', '', item.latest_message?.body || 'Start a conversation'));
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
  form.hidden = false;
  renderMessages(data.messages || []);
  await loadInbox();
}

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
