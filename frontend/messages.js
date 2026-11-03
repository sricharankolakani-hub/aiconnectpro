import { getUser } from './auth.js';

const token = localStorage.getItem('token');
const status = document.getElementById('messages-status');
const inbox = document.getElementById('inbox-list');
const thread = document.getElementById('thread-messages');
const form = document.getElementById('message-form');
const field = document.getElementById('message-body');
const messageInfo = document.getElementById('message-info-dialog');
const THREAD_POLL_MS = 10000;
const INBOX_POLL_MS = 30000;
let user = null;
let activePeer = null;
let currentMessages = [];
let threadRefreshInFlight = false;
let inboxRefreshInFlight = false;
let lastInboxRefreshAt = 0;\nlet knownUnreadCounts = null;\nlet toastTimer = null;

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
  return String(name || 'Member').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'A';
}

function showIncomingToast(peerName, count = 1) {
  const toast = document.getElementById('incoming-message-toast');
  const text = document.getElementById('incoming-message-toast-text');
  text.textContent = (count > 1 ? count + ' new messages' : 'New message') + ' from ' + peerName + '.';
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 5000);
}

document.getElementById('dismiss-message-toast').addEventListener('click', () => {
  window.clearTimeout(toastTimer);
  document.getElementById('incoming-message-toast').hidden = true;
});

function formatDate(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleString();
}

function showMessageInfo(message) {
  document.getElementById('receipt-sent').textContent = formatDate(message.created_at);
  document.getElementById('receipt-delivered').textContent = formatDate(message.delivered_at);
  document.getElementById('receipt-seen').textContent = formatDate(message.read_at);
  if (!messageInfo.open) messageInfo.showModal();
}

document.getElementById('message-info-close').addEventListener('click', () => messageInfo.close());
messageInfo.addEventListener('click', event => {
  if (event.target === messageInfo) messageInfo.close();
});

function addReceipt(bubble, message) {
  const footer = el('div', 'message-footer');
  footer.append(el('time', '', formatDate(message.created_at)));
  if (message.sender_id === user.id) {
    const seen = Boolean(message.read_at);
    const delivered = Boolean(message.delivered_at);
    const state = message.pending ? 'pending' : seen ? 'seen' : delivered ? 'delivered' : 'sent';
    const symbol = message.pending ? '…' : seen || delivered ? '✓✓' : '✓';
    const button = el('button', 'message-receipt ' + state, symbol);
    button.type = 'button';
    button.disabled = Boolean(message.pending);
    button.setAttribute('aria-label', message.pending ? 'Sending message' : 'Message status: ' + state + '. Open sent, delivered and seen times.');
    button.title = message.pending ? 'Sending…' : 'Hold this message or select to view times';
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (!message.pending) showMessageInfo(message);
    });
    footer.append(button);

    if (!message.pending) {
      let holdTimer;
      const clearHold = () => { window.clearTimeout(holdTimer); };
      bubble.addEventListener('pointerdown', () => {
        clearHold();
        holdTimer = window.setTimeout(() => showMessageInfo(message), 600);
      });
      bubble.addEventListener('pointerup', clearHold);
      bubble.addEventListener('pointerleave', clearHold);
      bubble.addEventListener('pointercancel', clearHold);
      bubble.addEventListener('contextmenu', event => {
        event.preventDefault();
        showMessageInfo(message);
      });
    }
  }
  bubble.append(footer);
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

function renderMessages(rows, { scrollToBottom = false } = {}) {
  const wasNearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60;
  const previousScrollTop = thread.scrollTop;
  currentMessages = rows || [];
  thread.replaceChildren();
  if (!currentMessages.length) {
    thread.append(el('p', 'message-empty', 'No messages yet. Say hello.'));
    return;
  }
  for (const message of currentMessages) {
    const bubble = el('article', 'message' + (message.sender_id === user.id ? ' mine' : ''), message.body);
    addReceipt(bubble, message);
    thread.append(bubble);
  }
  if (scrollToBottom || wasNearBottom) thread.scrollTop = thread.scrollHeight;
  else thread.scrollTop = previousScrollTop;
}

async function loadInbox({ notifyIncoming = false } = {}) {
  if (inboxRefreshInFlight) return;
  inboxRefreshInFlight = true;
  try {
    const data = await api('');
    renderInbox(data.conversations || [], { notifyIncoming });
    lastInboxRefreshAt = Date.now();
  } finally {
    inboxRefreshInFlight = false;
  }
}

async function openThread(peerId) {
  if (!peerId || threadRefreshInFlight) return;
  threadRefreshInFlight = true;
  const isNewConversation = activePeer !== peerId;
  try {
    const data = await api('/' + encodeURIComponent(peerId));
    activePeer = peerId;
    document.getElementById('peer-name').textContent = data.peer.full_name;
    document.getElementById('peer-avatar').textContent = initials(data.peer.full_name);
    document.getElementById('peer-avatar').setAttribute('aria-label', data.peer.full_name);
    const nextMessages = data.messages || [];
    if (!isNewConversation) {
      const previousIds = new Set(currentMessages.map(message => message.id));
      const incomingCount = nextMessages.filter(message => message.sender_id !== user.id && !previousIds.has(message.id)).length;
      if (incomingCount) showIncomingToast(data.peer.full_name, incomingCount);
    }
    form.hidden = false;
    renderMessages(nextMessages, { scrollToBottom: isNewConversation });
  } finally {
    threadRefreshInFlight = false;
  }
}

function refreshVisibleConversation() {
  if (document.hidden) return;
  const tasks = [];
  if (activePeer) tasks.push(openThread(activePeer));
  if (Date.now() - lastInboxRefreshAt >= INBOX_POLL_MS) tasks.push(loadInbox({ notifyIncoming: true }));
  Promise.all(tasks).catch(error => {
    status.textContent = error.status === 401 ? 'Your session expired. Please sign in again.' : 'Connection paused. We’ll retry automatically.';
    if (error.status === 401) window.location.replace('login.html');
  });
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
  const peerId = activePeer;
  const optimistic = {
    id: 'pending-' + Date.now(),
    sender_id: user.id,
    body,
    created_at: new Date().toISOString(),
    delivered_at: null,
    read_at: null,
    pending: true
  };
  renderMessages([...currentMessages, optimistic], { scrollToBottom: true });
  field.value = '';
  try {
    const data = await api('/' + encodeURIComponent(peerId), { method: 'POST', body: JSON.stringify({ body }) });
    if (activePeer === peerId && data.message) {
      const finalMessages = currentMessages.filter(message => message.id !== optimistic.id && message.id !== data.message.id);
      renderMessages([...finalMessages, data.message], { scrollToBottom: true });
      loadInbox().catch(() => {});
    }
    field.focus();
  } catch (error) {
    if (activePeer === peerId) {
      renderMessages(currentMessages.filter(message => message.id !== optimistic.id), { scrollToBottom: true });
      status.textContent = error.status === 401 ? 'Your session expired. Please sign in again.' : error.message;
    }
    if (field.value === '') field.value = body;
    if (error.status === 401) window.location.replace('login.html');
  } finally { submit.disabled = false; }
});

document.getElementById('refresh-messages').addEventListener('click', async () => {
  try {
    const tasks = [loadInbox()];
    if (activePeer) tasks.push(openThread(activePeer));
    await Promise.all(tasks);
    status.textContent = 'Messages refreshed.';
  } catch (error) { status.textContent = error.message; }
});

window.setInterval(refreshVisibleConversation, THREAD_POLL_MS);
window.addEventListener('focus', refreshVisibleConversation);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshVisibleConversation();
});

async function initialize() {
  if (!token) return window.location.replace('login.html');
  try {
    user = await getUser();
    if (!user) return window.location.replace('login.html');
    const peerId = new URLSearchParams(window.location.search).get('user');
    const tasks = [loadInbox()];
    if (peerId) tasks.push(openThread(peerId));
    await Promise.all(tasks);
  } catch (error) {
    status.textContent = error.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load messages. Please try refreshing.';
    if (error.status === 401) window.location.replace('login.html');
  }
}

initialize();
