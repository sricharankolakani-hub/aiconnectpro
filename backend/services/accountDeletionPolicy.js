'use strict';

function accountDeletionPreflight({ confirmation, authTime, now, roles = [] }, recentAuthSeconds) {
  if (confirmation !== 'DELETE') {
    return { status: 400, error: 'type_DELETE_to_confirm' };
  }

  if (!Number.isFinite(authTime) || authTime > now + 60 || now - authTime > recentAuthSeconds) {
    return { status: 401, error: 'recent_sign_in_required' };
  }

  if (roles.includes('admin')) {
    return {
      status: 409,
      error: 'admin_transfer_required',
      message: 'Transfer administrator access before deleting this account.'
    };
  }

  return null;
}

function organizationsRequiringTransfer(organizations = []) {
  return organizations.filter(row => row.verification_status !== 'pending');
}

module.exports = { accountDeletionPreflight, organizationsRequiringTransfer };
