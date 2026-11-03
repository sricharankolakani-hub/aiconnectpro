import { getUser, signOut, supabase } from './auth.js';

const appearanceForm = document.getElementById('appearance-form');
const profileForm = document.getElementById('profile-form');
const appearanceStatus = document.getElementById('appearance-status');
const profileStatus = document.getElementById('profile-status');
const photoStatus = document.getElementById('photo-status');
const photoInput = document.getElementById('photo-file');
const photoImage = document.getElementById('avatar-image');
const initials = document.getElementById('avatar-initials');
const saveButton = document.getElementById('save-profile');
const appearance = window.AIConnectProAppearance;
const settingsHeading = document.querySelector('.settings-heading');
const backToProfile = settingsHeading?.querySelector(':scope > a.button');
if (settingsHeading && backToProfile && localStorage.getItem('token')) {
  const actions = document.createElement('div');
  actions.className = 'settings-heading-actions';
  actions.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;';
  const logoutButton = document.createElement('button');
  logoutButton.className = 'button button-outline';
  logoutButton.type = 'button';
  logoutButton.id = 'settings-logout';
  logoutButton.textContent = 'Log out';
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = 'Signing out…';
    try {
      await signOut();
      window.location.replace('index.html');
    } catch (error) {
      logoutButton.disabled = false;
      logoutButton.textContent = 'Log out';
      setStatus(profileStatus, error.message || 'Could not sign out. Please try again.', true);
    }
  });
  settingsHeading.insertBefore(actions, backToProfile);
  actions.append(backToProfile, logoutButton);
}


function setStatus(element, message, error = false) {
  element.textContent = message;
  element.dataset.state = error ? 'error' : 'success';
}
function avatarLetters(name) {
  return String(name || 'A').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'A';
}
async function getAvatarUrl(user) {
  const path = user?.user_metadata?.avatar_path;
  if (path) {
    const { data, error } = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  return user?.user_metadata?.avatar_url || null;
}
function showAvatar(url, name) {
  initials.textContent = avatarLetters(name);
  if (url) {
    photoImage.src = url;
    photoImage.hidden = false;
  } else {
    photoImage.removeAttribute('src');
    photoImage.hidden = true;
  }
}
function applyAppearanceForm() {
  const preferences = appearance?.load?.() || { font: 'system', contrast: 'standard', background: 'warm' };
  for (const key of ['font', 'contrast', 'background']) {
    const control = document.getElementById(key === 'font' ? 'font-choice' : key === 'contrast' ? 'contrast-choice' : 'background-choice');
    control.value = preferences[key];
  }
}
function saveAppearance() {
  const preferences = {
    font: document.getElementById('font-choice').value,
    contrast: document.getElementById('contrast-choice').value,
    background: document.getElementById('background-choice').value
  };
  appearance?.save?.(preferences);
  setStatus(appearanceStatus, 'Appearance saved on this device.');
}
appearanceForm.addEventListener('change', saveAppearance);
document.getElementById('reset-appearance').addEventListener('click', () => {
  appearance?.save?.({ font: 'system', contrast: 'standard', background: 'warm' });
  applyAppearanceForm();
  setStatus(appearanceStatus, 'Appearance reset to the defaults.');
});

const exportAccountButton = document.getElementById('export-account-data');
const accountDataStatus = document.getElementById('account-data-status');
const deleteAccountDialog = document.getElementById('delete-account-dialog');
const deleteAccountForm = document.getElementById('delete-account-form');
const deleteAccountConfirmation = document.getElementById('delete-account-confirmation');
const deleteAccountStatus = document.getElementById('delete-account-status');
const confirmDeleteAccountButton = document.getElementById('confirm-delete-account');

exportAccountButton.addEventListener('click', async () => {
  exportAccountButton.disabled = true;
  exportAccountButton.textContent = 'Preparing your download…';
  try {
    const response = await fetch('/api/account/export', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
    if (!response.ok) throw new Error('Could not prepare your data export. Please try again.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aiconnectpro-data-export.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(accountDataStatus, 'Your data export has been downloaded. Private file links in it expire after one hour.');
  } catch (error) {
    setStatus(accountDataStatus, error.message || 'Could not download your data.', true);
  } finally {
    exportAccountButton.disabled = false;
    exportAccountButton.textContent = 'Download my data';
  }
});

document.getElementById('open-delete-account').addEventListener('click', () => {
  deleteAccountConfirmation.value = '';
  deleteAccountStatus.textContent = '';
  deleteAccountDialog.showModal();
  deleteAccountConfirmation.focus();
});
document.getElementById('cancel-delete-account').addEventListener('click', () => deleteAccountDialog.close());

deleteAccountForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (deleteAccountConfirmation.value !== 'DELETE') {
    setStatus(deleteAccountStatus, 'Type DELETE exactly to confirm.', true);
    return;
  }

  confirmDeleteAccountButton.disabled = true;
  confirmDeleteAccountButton.textContent = 'Deleting…';
  try {
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation: deleteAccountConfirmation.value })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (result.error === 'recent_sign_in_required') {
        throw new Error('For your safety, sign out and sign back in, then return here and confirm again within 10 minutes.');
      }
      throw new Error(result.message || 'Account deletion could not be completed. Contact support if this continues.');
    }

    localStorage.removeItem('token');
    try { await supabase.auth.signOut(); } catch {}
    window.location.replace('index.html');
  } catch (error) {
    setStatus(deleteAccountStatus, error.message || 'Account deletion could not be completed.', true);
  } finally {
    confirmDeleteAccountButton.disabled = false;
    confirmDeleteAccountButton.textContent = 'Delete permanently';
  }
});

let currentUser = null;
async function loadSettings() {
  if (!localStorage.getItem('token')) {
    window.location.replace('login.html');
    return;
  }
  currentUser = await getUser();
  if (!currentUser) throw new Error('Please sign in again to edit your profile.');
  const response = await fetch('/api/profile/me', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
  });
  if (!response.ok) throw new Error('Could not load your profile details.');
  const profile = await response.json();
  const name = profile.full_name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '';
  document.getElementById('full-name').value = name;
  document.getElementById('date-of-birth').value = profile.date_of_birth || '';
  document.getElementById('profile-location').value = profile.location || '';
  document.getElementById('profile-bio').value = profile.bio || '';
  const metadata = currentUser.user_metadata || {};
  const accountType = ['student', 'founder'].includes(metadata.account_type) ? metadata.account_type : null;
  const accountTypeEditor = document.getElementById('account-type-editor');
  const founderFields = document.getElementById('founder-profile-fields');
  const studentFields = document.getElementById('student-profile-fields');
  accountTypeEditor.hidden = !accountType;
  founderFields.hidden = accountType !== 'founder';
  studentFields.hidden = accountType !== 'student';
  if (accountType === 'founder') {
    document.getElementById('account-type-description').textContent = 'Edit the business details shown on your profile.';
    const business = metadata.business_profile || {};
    document.getElementById('business-name').value = business.name || '';
    document.getElementById('business-summary').value = business.summary || '';
    document.getElementById('business-website').value = business.website || '';
  } else if (accountType === 'student') {
    document.getElementById('account-type-description').textContent = 'Edit your education details shown on your profile.';
    const student = metadata.student_profile || {};
    document.getElementById('student-institution').value = student.institution || '';
    document.getElementById('student-field-of-study').value = student.field_of_study || '';
  }
  document.getElementById('bio-count').textContent = String((profile.bio || '').length);
  document.getElementById('account-email').value = currentUser.email || '';
  document.getElementById('account-phone').value = currentUser.phone || '';
  const visibility = profile.visibility || {};
  document.querySelectorAll('[data-visibility]').forEach(control => {
    control.value = ['private', 'connections', 'everyone'].includes(visibility[control.dataset.visibility])
      ? visibility[control.dataset.visibility]
      : 'private';
  });
  showAvatar(await getAvatarUrl(currentUser), name);
}

document.getElementById('profile-bio').addEventListener('input', event => {
  document.getElementById('bio-count').textContent = String(event.currentTarget.value.length);
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.getElementById('full-name').value.trim();
  const dateOfBirth = document.getElementById('date-of-birth').value;
  const location = document.getElementById('profile-location').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();
  const metadata = currentUser?.user_metadata || {};
  const accountType = ['student', 'founder'].includes(metadata.account_type) ? metadata.account_type : null;
  const businessProfile = accountType === 'founder' ? {
    name: document.getElementById('business-name').value.trim(),
    summary: document.getElementById('business-summary').value.trim(),
    website: document.getElementById('business-website').value.trim()
  } : null;
  const studentProfile = accountType === 'student' ? {
    institution: document.getElementById('student-institution').value.trim(),
    field_of_study: document.getElementById('student-field-of-study').value.trim()
  } : null;
  const visibility = Object.fromEntries(
    [...document.querySelectorAll('[data-visibility]')]
      .map(control => [control.dataset.visibility, control.value])
  );
  if (name.length < 2 || name.length > 100) {
    setStatus(profileStatus, 'Enter a name between 2 and 100 characters.', true);
    return;
  }
  if (location.length > 120 || bio.length > 500) {
    setStatus(profileStatus, 'Place must be 120 characters or fewer and About you 500 or fewer.', true);
    return;
  }
  if (businessProfile && (businessProfile.name.length > 160 || businessProfile.summary.length > 500 || businessProfile.website.length > 320)) {
    setStatus(profileStatus, 'Check the business details and keep them within the stated character limits.', true);
    return;
  }
  if (businessProfile?.website) {
    try {
      const website = new URL(businessProfile.website);
      if (!['http:', 'https:'].includes(website.protocol)) throw new Error();
    } catch {
      setStatus(profileStatus, 'Enter a valid website beginning with https:// or http://.', true);
      return;
    }
  }
  if (studentProfile && (studentProfile.institution.length > 160 || studentProfile.field_of_study.length > 160)) {
    setStatus(profileStatus, 'School and field of study must be 160 characters or fewer.', true);
    return;
  }
  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';
  try {
    const metadataUpdates = { full_name: name };
    if (businessProfile) metadataUpdates.business_profile = businessProfile;
    if (studentProfile) metadataUpdates.student_profile = studentProfile;
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { ...metadata, ...metadataUpdates }
    });
    if (metadataError) throw metadataError;
    const response = await fetch('/api/profile/me', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ full_name: name, date_of_birth: dateOfBirth || null, location, bio, visibility })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not save your profile.');
    currentUser = await getUser();
    showAvatar(await getAvatarUrl(currentUser), name);
    setStatus(profileStatus, 'Your profile details and visibility are saved.');
  } catch (error) {
    setStatus(profileStatus, error.message || 'Could not save your profile.', true);
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = 'Save profile <span aria-hidden="true">→</span>';
  }
});

async function imageAsAvatar(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
  const bitmap = await createImageBitmap(file);
  const size = 512;
  const cropSize = Math.min(bitmap.width, bitmap.height);
  const cropX = Math.round((bitmap.width - cropSize) / 2);
  const cropY = Math.round((bitmap.height - cropSize) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, cropX, cropY, cropSize, cropSize, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
  if (!blob) throw new Error('This browser could not prepare the photo. Try another image.');
  return blob;
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  const choose = document.querySelector('.upload-button');
  choose.textContent = 'Uploading…';
  choose.setAttribute('aria-disabled', 'true');
  try {
    if (!currentUser) throw new Error('Sign in again before uploading a photo.');
    const blob = await imageAsAvatar(file);
    const path = currentUser.id + '/' + crypto.randomUUID() + '.webp';
    const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, blob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false
    });
    if (uploadError) throw uploadError;
    const oldPath = currentUser.user_metadata?.avatar_path;
    const { data: updated, error: metadataError } = await supabase.auth.updateUser({
      data: { avatar_url: null, avatar_path: path }
    });
    if (metadataError) {
      await supabase.storage.from('profile-photos').remove([path]);
      throw metadataError;
    }
    currentUser = updated.user;
    showAvatar(await getAvatarUrl(currentUser), document.getElementById('full-name').value);
    setStatus(photoStatus, 'Your profile photo has been updated.');
    if (oldPath && oldPath !== path) {
      const { error: removeError } = await supabase.storage.from('profile-photos').remove([oldPath]);
      if (removeError) console.warn('Previous profile photo could not be removed.');
    }
  } catch (error) {
    setStatus(photoStatus, error.message || 'Could not upload the photo.', true);
  } finally {
    choose.textContent = 'Choose photo';
    choose.removeAttribute('aria-disabled');
    photoInput.value = '';
  }
});

applyAppearanceForm();
loadSettings().catch(error => setStatus(profileStatus, error.message || 'Could not load settings.', true));
