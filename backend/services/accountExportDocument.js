'use strict';

function createAccountExportDocument(data) {
  const { user } = data;
  return {
    export_version: 1,
    generated_at: data.generatedAt || new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at || null,
      user_metadata: user.user_metadata || {}
    },
    profile: data.profiles,
    private_profile_details: data.privateDetails,
    resumes: data.resumes,
    reels: data.reels,
    reel_likes: data.likes,
    reel_comments: data.comments,
    reel_shares: data.shares,
    applications: data.applications,
    jobs_posted: data.jobs,
    feed_posts: data.posts,
    feed_post_reactions: data.postReactions,
    feed_post_comments: data.postComments,
    employer_access_requests: data.accessRequests,
    organizations_created: data.organizations,
    organization_memberships: data.memberships,
    connection_requests: data.connectionRequests,
    conversations: data.conversations,
    messages: data.messages,
    notifications: data.notifications,
    reports_filed: data.reportsFiled,
    stored_files: data.downloads
  };
}

module.exports = { createAccountExportDocument };
