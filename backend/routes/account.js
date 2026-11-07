// backend/routes/account.js
// Account data export and self-service deletion. All requests are scoped to the
// canonical user ID established by authMiddleware; never accept a target user ID.
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
const auth = require('../middleware/authMiddleware');

const PAGE_SIZE = 500;
const RECENT_AUTH_SECONDS = 10 * 60;

async function fetchAll(queryFactory) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await queryFactory().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function listStoragePaths(bucket, root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const prefix = pending.shift();
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset });
      if (error) throw error;
      const entries = data || [];
      for (const entry of entries) {
        if (!entry?.name || entry.name === '.' || entry.name === '..') continue;
        const path = prefix + '/' + entry.name;
        // Storage returns folders without an object ID or file metadata.
        if (entry.id || entry.metadata) files.push(path);
        else pending.push(path);
      }
      if (entries.length < 100) break;
    }
  }
  return files;
}

async function removeStoragePaths(bucket, paths) {
  const uniquePaths = [...new Set(paths)].filter(Boolean);
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const { error } = await supabase.storage.from(bucket).remove(uniquePaths.slice(index, index + 100));
    if (error) throw error;
  }
}

function accountError(res, code, status = 500) {
  return res.status(status).json({ error: code });
}

/** Download a machine-readable copy of this signed-in member's data. */
router.get('/export', auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: authResult, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authResult?.user) return accountError(res, 'account_export_failed');
    const user = authResult.user;

    const [
      profiles, privateDetails, resumes, reels, likes, comments, shares,
      applications, jobs, accessRequests, memberships, connectionRequests,
      conversations, reportsFiled, posts, postReactions, postComments
    ] = await Promise.all([
      fetchAll(() => supabase.from('profiles').select('*').eq('id', userId)),
      fetchAll(() => supabase.from('profile_private_details').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('resumes').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('reels').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('reel_likes').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('reel_comments').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('reel_shares').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('applications').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('jobs').select('*').eq('posted_by', userId)),
      fetchAll(() => supabase.from('company_access_requests').select('*').eq('requester_id', userId)),
      fetchAll(() => supabase.from('organization_memberships').select('*, organization:organizations(*)').eq('user_id', userId)),
      fetchAll(() => supabase.from('connection_requests').select('*')
        .or('sender_id.eq.' + userId + ',recipient_id.eq.' + userId)),
      fetchAll(() => supabase.from('direct_conversations').select('*')
        .or('member_a.eq.' + userId + ',member_b.eq.' + userId)),
      fetchAll(() => supabase.from('content_reports').select('*').eq('reporter_id', userId)),
      fetchAll(() => supabase.from('posts').select('*').eq('author_id', userId)),
      fetchAll(() => supabase.from('post_reactions').select('*').eq('user_id', userId)),
      fetchAll(() => supabase.from('post_comments').select('*').eq('user_id', userId))
    ]);

    const conversationIds = conversations.map(row => row.id).filter(Boolean);
    const messages = conversationIds.length
      ? await fetchAll(() => supabase.from('direct_messages').select('*').in('conversation_id', conversationIds))
      : [];

    const [profilePhotoPaths, reelMediaPaths] = await Promise.all([
      listStoragePaths('profile-photos', userId),
      listStoragePaths('reel-media', userId)
    ]);
    const resumePaths = resumes.map(row => row.pdf_path).filter(path => typeof path === 'string' && path.startsWith('resumes/'));
    const storedFiles = [
      ...profilePhotoPaths.map(path => ({ bucket: 'profile-photos', path })),
      ...reelMediaPaths.map(path => ({ bucket: 'reel-media', path })),
      ...resumePaths.map(path => ({ bucket: 'resumes', path }))
    ];
    const downloads = await Promise.all(storedFiles.map(async file => {
      const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 3600);
      return {
        ...file,
        download_url: error ? null : data?.signedUrl || null,
        link_expires_in_seconds: 3600
      };
    }));

    const document = {
      export_version: 1,
      generated_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email || null,
        phone: user.phone || null,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at || null,
        user_metadata: user.user_metadata || {}
      },
      profile: profiles,
      private_profile_details: privateDetails,
      resumes,
      reels,
      reel_likes: likes,
      reel_comments: comments,
      reel_shares: shares,
      applications,
      jobs_posted: jobs,
      feed_posts: posts,
      feed_post_reactions: postReactions,
      feed_post_comments: postComments,
      employer_access_requests: accessRequests,
      organization_memberships: memberships,
      connection_requests: connectionRequests,
      conversations,
      messages,
      reports_filed: reportsFiled,
      stored_files: downloads
    };

    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Disposition', 'attachment; filename="aiconnectpro-data-export.json"');
    return res.type('application/json').send(JSON.stringify(document, null, 2));
  } catch (error) {
    console.error('Account data export failed', error);
    return accountError(res, 'account_export_failed');
  }
});

/** Permanently delete this member's own data after a recent authenticated sign-in. */
router.delete('/', auth, async (req, res) => {
  const userId = req.user.id;
  if (req.body?.confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'type_DELETE_to_confirm' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(req.user.authTime) || req.user.authTime > now + 60
      || now - req.user.authTime > RECENT_AUTH_SECONDS) {
    return res.status(401).json({ error: 'recent_sign_in_required' });
  }

  if ((req.user.roles || []).includes('admin')) {
    return res.status(409).json({
      error: 'admin_transfer_required',
      message: 'Transfer administrator access before deleting this account.'
    });
  }

  try {
    // A verified or reviewed organization is shared business data. Keep it
    // intact until its owner transfers it through the organization review flow.
    const organizations = await fetchAll(() => supabase.from('organizations')
      .select('id, verification_status').eq('created_by', userId));
    const protectedOrganizations = organizations.filter(row => row.verification_status !== 'pending');
    if (protectedOrganizations.length) {
      return res.status(409).json({
        error: 'organization_transfer_required',
        message: 'Transfer or close your reviewed organization before deleting this account.'
      });
    }

    const { data: authResult, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authResult?.user) return accountError(res, 'account_deletion_failed');
    const user = authResult.user;

    const [resumes, reels, profilePhotoPaths, reelMediaPaths] = await Promise.all([
      fetchAll(() => supabase.from('resumes').select('pdf_path').eq('user_id', userId)),
      fetchAll(() => supabase.from('reels').select('media_url').eq('user_id', userId)),
      listStoragePaths('profile-photos', userId),
      listStoragePaths('reel-media', userId)
    ]);
    const resumePaths = resumes.map(row => row.pdf_path)
      .filter(path => typeof path === 'string' && path.startsWith('resumes/'));
    const legacyReelPaths = reels.map(row => row.media_url)
      .filter(path => typeof path === 'string' && path.startsWith(userId + '/') && !/^https?:\/\//i.test(path));
    const avatarPath = user.user_metadata?.avatar_path;
    const profilePaths = [
      ...profilePhotoPaths,
      ...(typeof avatarPath === 'string' && avatarPath.startsWith(userId + '/') ? [avatarPath] : [])
    ];

    // Remove private objects before deleting their account metadata. Retrying is
    // safe if a later database or Auth operation fails.
    await removeStoragePaths('profile-photos', profilePaths);
    await removeStoragePaths('reel-media', [...reelMediaPaths, ...legacyReelPaths]);
    await removeStoragePaths('resumes', resumePaths);

    // Delete personal rows that do not cascade from auth.users and standalone jobs.
    // Auth deletion cascades authored posts. Organization-owned postings remain.
    const operations = [
      supabase.from('applications').delete().eq('user_id', userId),
      supabase.from('reel_likes').delete().eq('user_id', userId),
      supabase.from('reel_comments').delete().eq('user_id', userId),
      supabase.from('reel_shares').delete().eq('user_id', userId),
      supabase.from('reels').delete().eq('user_id', userId),
      supabase.from('resumes').delete().eq('user_id', userId),
      supabase.from('jobs').delete().eq('posted_by', userId).is('company_id', null),
      supabase.from('jobs').update({ posted_by: null }).eq('posted_by', userId).not('company_id', 'is', null)
    ];
    const results = await Promise.all(operations);
    if (results.some(result => result.error)) {
      console.error('Account database cleanup failed', results.filter(result => result.error).map(result => result.error));
      return accountError(res, 'account_deletion_failed');
    }
    if (organizations.length) {
      const { error: organizationError } = await supabase.from('organizations')
        .delete().eq('created_by', userId).eq('verification_status', 'pending');
      if (organizationError) {
        console.error('Pending organization cleanup failed', organizationError);
        return accountError(res, 'account_deletion_failed');
      }
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Auth account deletion failed', deleteError);
      return accountError(res, 'account_deletion_failed');
    }

    return res.json({ deleted: true });
  } catch (error) {
    console.error('Account deletion failed', error);
    return accountError(res, 'account_deletion_failed');
  }
});

module.exports = router;
