// Mark any future member avatar with data-profile-photo; the global viewer handles it automatically.\nconst PROFILE_PHOTO_SELECTOR = '#profile-photo, #avatar-image, #member-avatar img, #connection-list img, #incoming-list img, #outgoing-list img, #discover-list img, [data-profile-photo]';

function preparePhoto(image) {
  if (!(image instanceof HTMLImageElement) || image.dataset.previewReady) return;
  image.dataset.previewReady = 'true';
  image.classList.add('profile-photo-previewable');
  image.tabIndex = 0;
  image.setAttribute('role', 'button');
  const memberName = image.closest('#member-avatar') && document.getElementById('member-name')?.textContent;
  const photoName = image.alt?.trim() || (memberName ? memberName + ' profile photo' : 'profile photo');
  image.setAttribute('aria-label', 'Preview ' + photoName);
}

function preparePhotos(root = document) {
  if (root.matches?.(PROFILE_PHOTO_SELECTOR)) preparePhoto(root);
  root.querySelectorAll?.(PROFILE_PHOTO_SELECTOR).forEach(preparePhoto);
}

function getViewer() {
  let dialog = document.getElementById('profile-photo-viewer');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'profile-photo-viewer';
  dialog.className = 'profile-photo-viewer';
  dialog.setAttribute('aria-label', 'Profile photo preview');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'profile-photo-viewer-close';
  close.setAttribute('aria-label', 'Close photo preview');
  close.textContent = '×';
  const image = document.createElement('img');
  const caption = document.createElement('p');
  dialog.append(close, image, caption);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    image.removeAttribute('src');
    caption.textContent = '';
  });
  document.body.append(dialog);
  return dialog;
}

function preview(image) {
  if (!image.getAttribute('src') || image.hidden) return;
  const dialog = getViewer();
  const previewImage = dialog.querySelector('img');
  const caption = dialog.querySelector('p');
  previewImage.src = image.currentSrc || image.src;
  const memberName = image.closest('#member-avatar') && document.getElementById('member-name')?.textContent;
  caption.textContent = memberName || image.alt || 'Profile photo';
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

document.addEventListener('click', event => {
  const image = event.target.closest?.(PROFILE_PHOTO_SELECTOR);
  if (image) preview(image);
});
document.addEventListener('keydown', event => {
  const image = event.target.closest?.(PROFILE_PHOTO_SELECTOR);
  if (image && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    preview(image);
  }
});
preparePhotos();
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
  if (node instanceof Element) preparePhotos(node);
}))).observe(document.documentElement, { childList: true, subtree: true });
