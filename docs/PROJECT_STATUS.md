# AIConnectPro project status and no-cost roadmap

Last reviewed: 2026-11-17 (Asia/Kolkata)

## Product direction

AIConnectPro is a professional opportunity and networking workspace. The longer-term plan combines career profiles and resumes, jobs and applications, networking, organization accounts, professional updates and Capsules, learning, and AI career help. Messaging is available. Voice and video calling remain future work.

The live product name remains AIConnectPro. Do not rename the product or change its branding without the owner's direction.

## Production status

- **Frontend:** Vercel production at https://aiconnectpro.vercel.app. The latest deployment is Ready.
- **Backend:** Render service `aiconnectpro-backend`, Free plan, at https://aiconnectpro-backend.onrender.com. Its latest application deployment is live.
- **Database and authentication:** Supabase project `yrjkkmvrmiieqozuvbqp` is Active/Healthy in ap-southeast-1.
- **Health:** Production `/api/health` and `/api/ready` returned HTTP 200; readiness included the database dependency.
- **Automated checks:** GitHub Actions Project checks passed for the latest account-export changes, including readiness and account-export tests.
- **Release evidence:** See [MVP release readiness snapshot](MVP-RELEASE-READINESS-2026-11-17.md) for deployment, route sweep, production data counts, and EOD checks.

Two older Render services (`aiconnectpro` and `aiconnectpro-1`) remain in the same workspace. Their recent deploy records show update failures and recent request-log checks found no traffic. They were left untouched because someone may still use their URLs. Confirm URL usage before suspending or deleting them.

## Implemented capabilities

The current application includes:

- Email/password signup and login, email verification flow, Google sign-in, and optional authenticator-app MFA.
- Member profile intents for professional, student, and founder accounts. Profile settings include profile details, visibility, appearance, and photo.
- Resume creation with templates and PDF download.
- Jobs and applications; employer access is separate from member profiles and depends on organization membership and approval.
- Manual company review. GST/address evidence can be collected, but submitting it does not automatically verify a company.
- Profile discovery, connection requests, direct messages, sent/delivered/seen indicators, and in-app notifications.
- Professional updates with privacy controls, editing, reactions, comments, and account export/deletion support.
- Capsules with media, likes, comments, shares, member reports, and administrator review. Members can browse posts shared with all members, accepted connections, or keep their own posts private; authors can change their post audience.
- Account export and account deletion flows.

Admin roles are managed through Supabase `app_metadata.roles` and server-side authorization. Never grant admin through browser-editable `user_metadata`.

## Production data and readiness

The read-only production snapshot on 2026-11-17 contained 4 auth users, 3 profiles, 0 organizations, 0 employer requests, 0 jobs, 0 applications, 1 conversation, 20 messages, and 3 Capsules.

This is enough to confirm that the product has real accounts and some member activity, but the jobs marketplace currently has no employer or job inventory. Do not create synthetic public companies or listings.

**Current release level: controlled pilot.** Production pages and health checks are available, but this is not a fully stocked public marketplace and has not had every user journey independently verified end to end.

## Known limits and owner checks

- **Email delivery:** The owner previously received a verification email, but production delivery to a new, unrelated signup address is not yet confirmed. Supabase's default relay is limited and best-effort. A dependable public signup needs custom SMTP configured in Supabase and a fresh signup tested by the owner.
- **Phone OTP:** Not configured because no SMS provider is connected and no paid subscription is authorized.
- **Automated company verification:** No GST verification provider is configured; review remains manual.
- **Calls:** No reliable calling service or TURN relay is configured.
- **AI assistance:** Live AI requires a provider key. Without it, the backend uses its fallback response.
- **First employer and job:** Production currently has no organization requests or jobs. A real employer must submit company evidence, receive manual review, and publish a genuine listing before testing the complete employer-to-application flow.
- **Deletion/contact operations:** The privacy policy is deployed. Before broad promotion, the owner should confirm the published retention/deletion process and the working user contact/deletion route.
- **Free-tier availability:** Supabase previously paused after inactivity, then was restored and verified healthy. Free tiers can pause or impose limits; check `/api/ready` if data-backed pages stop loading.

## Security and maintenance

- Supabase's security advisor reported backend-managed tables with RLS enabled and no policies. A read-only grant check found no table grants to `anon` or `authenticated`; the app accesses this data through the protected server API. Recheck before adding direct browser database access or changing grants.
- Leaked-password protection is reported unavailable on the current Supabase Free plan and remains disabled.
- Performance notices include unindexed foreign keys and unused indexes. At current low data volume these are informational; do not drop indexes or change production schema without query-plan review and a tested migration.
- Keep the Supabase service-role key on the backend only. Never paste credentials or secret values into chat.

## No-cost operating rule

Keep work within the existing free allowances. Do not upgrade plans or add a paid provider without the owner's explicit approval. SMS OTP, automated GST verification, reliable TURN calling, paid AI generation, and Supabase leaked-password screening are deferred until a free option or budget is approved.

## Recommended order to reach a broader launch

1. Configure custom SMTP in Supabase using a no-cost provider and a domain the owner controls; test a fresh signup to an unrelated address. Do not put SMTP credentials in chat.
2. Have one genuine employer submit a company request; review evidence manually and approve only when appropriate.
3. Publish a genuine job and complete the employer listing and member application flows.
4. Verify account deletion/contact operations and privacy wording from a member account.
5. Decide whether the two older Render service URLs are still used. Keep them until that is confirmed.
6. Continue free-tier monitoring; defer SMS, automated verification, calls, and paid AI without budget approval.

## Review evidence

- [README](../README.md).
- [Employer and organization verification process](employer-organization-verification.md).
- [MVP release readiness snapshot, 2026-11-17](MVP-RELEASE-READINESS-2026-11-17.md).
- Production Vercel, Render, and Supabase status plus the backend health/readiness endpoints were checked on 2026-11-17.
- Supabase security/performance advisories and grants were reviewed read-only on 2026-11-17.
