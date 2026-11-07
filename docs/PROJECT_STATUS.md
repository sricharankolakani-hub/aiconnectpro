# AIConnectPro project status and no-cost roadmap

Last reviewed: 2026-11-07

## Product direction

AIConnectPro is a professional opportunity and networking workspace. The longer-term plan brings together career profiles and resumes, jobs and applications, networking, business and organization accounts, professional posts and Capsules, learning, and AI career help. Messaging is available; voice/video calling remains future work.

The product name is still AIConnectPro in the live application. Do not rename the product or change branding without the owner's direction.

## Current deployment

- **Frontend:** Vercel production at https://aiconnectpro.vercel.app. The latest reviewed production deployment was Ready.
- **Backend:** Render service `aiconnectpro-backend`, on the Free plan, serves the API at https://aiconnectpro-backend.onrender.com. The Vercel rewrite points to this service.
- **Database and authentication:** Supabase project is Active/Healthy in ap-southeast-1. The backend uses the service-role key; keep that key server-side.
- **Database changes:** The migration history contains the current account, profile, organization, messaging, notification, Capsule, and receipt schema changes. See `../supabase/migrations/`.

Two older Render services also point at the same repository and backend directory. Their request metrics and request logs were empty for Nov 1–6, 2026, and their recent deploy records show update failures. They have not been removed because old URLs may still be in use.

## Implemented capabilities

These capabilities are represented in the current repository; the status review did not run a full end-to-end test of every flow.

- Email/password signup and login, email verification codes, Google sign-in, and optional authenticator-app MFA.
- Professional, student, and founder profile intents. Settings support editing profile details, privacy visibility, appearance, photos, and student/founder information.
- Resume creation with template options and PDF download.
- Jobs, applications, and employer access through separate organization records and memberships.
- Manual organization verification. GST/address details are collected, but a submission is not treated as verified by itself.
- Discoverable profiles, connection requests, direct messages, delivered/seen receipts, and in-app notifications.
- Private-by-default professional updates that members can keep visible only to themselves or share with accepted connections. Owners can delete their posts; members who can view a post can add or remove reactions and comment. Comment authors can delete their comments. Account export includes authored posts, reactions, and comments; account deletion cascades both.
- Capsules with media, likes, comments, shares, and member reports, plus administrator review pages.
- Account export and deletion flows.

The first administrator role is managed in Supabase `app_metadata.roles`; it must not be granted from browser-controlled `user_metadata`.

## Known limits

- **Phone verification:** Email OTP is available. Phone OTP is not configured because no SMS provider is connected.
- **Automated business verification:** No GST verification provider is configured, so organization approval stays manual.
- **Calls:** Reliable calling needs a TURN relay. No calling service is configured.
- **AI assistant:** Live AI requires an `OPENAI_API_KEY`; otherwise the backend returns a mock response.
- **Professional feed:** Posts and reactions persist in Supabase. Editing and post-specific reports are not implemented yet; the feed audience remains limited to the author and accepted connections.
- **Automated checks:** The backend package currently has start/dev scripts but no test or lint script. No comprehensive automated release check is present.
- **Supabase advisories:** Leaked-password screening is disabled and is not included in the Free plan. The database advisor also reports unindexed foreign keys and unused indexes. Only add indexes that match actual query patterns; several flagged foreign keys are not used as query filters today.
- **RLS notes:** The advisor reports RLS enabled without policies on backend-managed tables. The repository migration describes backend-only access. Keep browser table access revoked and never expose the service-role key. Revisit policies if browser code starts querying those tables directly.
- **Build warnings:** The last reviewed Render build logged old Puppeteer and UUID dependency warnings, plus no lockfile. The build completed successfully.

## No-cost operating rule

Keep work within existing free allowances. Do not upgrade plans, enable paid providers, or add services that require payment without the owner's explicit approval. Free-tier quotas and limits still apply.

Current items intentionally deferred until a funded option is available: paid SMS delivery, paid GST verification, reliable TURN calling, paid AI API usage, and Supabase leaked-password screening.

## Recommended next steps

1. Keep the Vercel production rewrite pointed at `aiconnectpro-backend.onrender.com`.
2. Confirm whether anyone still uses the two older Render service URLs before changing or deleting those services.
3. Add post editing and post-specific reports before expanding the audience beyond the author and accepted connections.
4. Monitor database use and add only indexes justified by query patterns and growth.
5. Revisit the deferred paid integrations only when a budget and provider are approved.

## Review evidence

- Repository overview: [README](../README.md).
- Manual organization review: [employer and organization verification](employer-organization-verification.md).
- Supabase project and security/performance advisors were checked on 2026-11-03.
- Vercel, Render, and repository status were checked on 2026-11-07.
