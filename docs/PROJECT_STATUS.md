# AIConnectPro project status and no-cost roadmap

Last reviewed: 2026-11-24 (Asia/Kolkata)

## Product direction

AIConnectPro is a professional opportunity and networking workspace. The longer-term plan combines career profiles and resumes, jobs and applications, networking, organization accounts, professional updates and Capsules, learning, and AI career help. Messaging is available. Voice and video calling remain future work.

The live product name remains AIConnectPro. Do not rename the product or change its branding without the owner's direction.

## Production status

- **Frontend:** Vercel production at https://aiconnectpro.vercel.app. The latest production code release is Ready at commit `4b4a272dd0fb2c52fb35cf135069ce3cb90a02ac` (signup consent fix and legacy endpoint removal).
- **Backend:** Render service `aiconnectpro-backend`, Free plan, at https://aiconnectpro-backend.onrender.com. Its latest backend application deployment is live at commit `4b4a272dd0fb2c52fb35cf135069ce3cb90a02ac`.
- **Database and authentication:** Supabase project `yrjkkmvrmiieqozuvbqp` is Active/Healthy in ap-southeast-1.
- **Health:** Production `/api/ready` returned HTTP 200 with database readiness after the latest release.
- **Automated checks:** CI runs `npm test --prefix backend`, which checks project JavaScript and runs the backend Node tests. The latest workflow on PR #98 passed all 25 backend tests; the same workflow passed on PRs #94 and #96. Coverage includes account export, deletion safeguards, readiness, messaging receipts, 6–10 digit email OTP input, employer resume access, employer application-notification recipients, and company review-notification events. The deletion tests cover policy guards; they do not execute a destructive deletion against production data.
- **Notifications:** New applications notify active members of the verified organization and link to the relevant job in its protected applicant inbox. Company request approval and rejection also notify the requester and link to the company access page. Migrations for these events are applied.
- **Release evidence:** See [MVP release readiness snapshot](MVP-RELEASE-READINESS-2026-11-17.md) for current deployment, test, production data, and launch-gate evidence.

Two older Render services (`aiconnectpro` and `aiconnectpro-1`) remain in the same workspace. Their recent deploy records show update failures and recent request-log checks found no traffic. They were left untouched because someone may still use their URLs. Confirm URL usage before suspending or deleting them.

## Implemented capabilities

The current application includes:

- Email/password signup and login, email verification flow, Google sign-in, and optional authenticator-app MFA.
- Member profile intents for professional, student, and founder accounts. Profile settings include profile details, visibility, appearance, and photo.
- Resume creation with templates and PDF download.
- Jobs and applications; employer access is separate from member profiles and depends on active membership in a verified organization. The applicant inbox provides a protected preview of resumes attached to applications and receives application alerts for active members of the verified organization.
- Manual company review. GST/address evidence can be collected, but submitting it does not automatically verify a company. Requesters are notified when an admin approves or rejects their request.
- Profile discovery, connection requests, direct messages, sent/delivered/seen indicators, and in-app notifications.
- Professional updates with privacy controls, editing, reactions, comments, and account export/deletion support.
- Capsules with media, likes, comments, shares, member reports, and administrator review. Members can browse posts shared with all members, accepted connections, or keep their own posts private; authors can change their post audience.
- Account export and account deletion flows.

Admin roles are managed through Supabase `app_metadata.roles` and server-side authorization. Never grant admin through browser-editable `user_metadata`.

## Production data and readiness

The read-only production snapshot on 2026-11-23 contained 6 auth users (5 email-confirmed and 1 awaiting email confirmation), 3 profiles, 0 organizations, 0 employer requests, 0 jobs, 0 applications, 1 conversation, 20 messages, and 3 Capsules.

This is enough to confirm that the product has real accounts and some member activity, but the jobs marketplace currently has no employer or job inventory. Do not create synthetic public companies or listings.

**Current release level: controlled pilot.** Production pages and health checks are available, but this is not a fully stocked public marketplace and has not had every user journey independently verified end to end.

## Known limits and owner checks

- **Email delivery:** The owner reports saving temporary Gmail SMTP settings in Supabase and has now confirmed receiving a signup OTP. Delivery is confirmed for that test; acceptance of the code and completion of signup still need browser confirmation. The production database snapshot captured one account awaiting email confirmation, but aggregate counts cannot tie it to this test. Gmail SMTP is a temporary pilot setup. Never share OTPs or SMTP credentials in chat.
- **Phone OTP:** Not configured because no SMS provider is connected and no paid subscription is authorized.
- **Automated company verification:** No GST verification provider is configured; review remains manual.
- **Calls:** No reliable calling service or TURN relay is configured.
- **AI assistance:** The assistant endpoint now requires a verified signed-in user, enforces prompt-size limits, avoids echoing prompts in the free fallback, and suppresses provider details in errors. Live AI still requires a provider key; without it, the backend uses its fallback response.
- **First employer and job:** Production currently has no organization requests or jobs. A real employer must submit company evidence, receive manual review, and publish a genuine listing before testing the complete employer-to-application flow and notifications.
- **Deletion/contact operations:** The privacy policy is deployed. Before broad promotion, the owner should confirm the published retention/deletion process and the working user contact/deletion route.
- **Free-tier availability:** Supabase previously paused after inactivity, then was restored and verified healthy. Free tiers can pause or impose limits; check `/api/ready` if data-backed pages stop loading.

## Security and maintenance

- **API route audit (24 Nov):** All inspected user-data routes require sign-in; admin routes also require the server-managed admin role. The unauthenticated legacy company-list endpoint was unused by the current app pages, removed in PR #96, and returns HTTP 404 in production. Signup/login and health/readiness routes remain intentionally public.
- Supabase's security advisor warnings: 19 RLS-enabled tables with no policies and leaked-password protection unavailable on the current Free plan. A same-day read-only grant query found no table grants to `anon` or `authenticated`; the app accesses data through the protected server API. Recheck before adding direct browser database access or changing grants. A catalog review confirmed member-owned profile, connection, messaging, post, and report records cascade on Auth user deletion; reviewed organizations block deletion and attribution fields are set null. No destructive account deletion was run in production.
- Leaked-password protection remains disabled because it is reported unavailable on the current Supabase Free plan.
- Supabase's performance advisor flags unindexed foreign keys and unused indexes. At current low data volume these are informational; do not drop indexes or change production schema without query-plan review and a tested migration.
- Keep the Supabase service-role key on the backend only. Never paste credentials or secret values into chat.

## No-cost operating rule

Keep work within the existing free allowances. Do not upgrade plans or add a paid provider without the owner's explicit approval. SMS OTP, automated GST verification, reliable TURN calling, paid AI generation, and Supabase leaked-password screening are deferred until a free option or budget is approved.

## Recommended order to reach a broader launch

1. Submit the received email OTP in the signup page and confirm that the account reaches its signed-in state. Before broad public launch, test delivery to an address outside the owner's team. Keep Gmail SMTP as a temporary pilot setup and do not share credentials in chat.
2. Have one genuine employer submit a company request; review evidence manually and approve only when appropriate.
3. Publish a genuine job and complete the employer listing and member application flows, including the new application notification and resume preview.
4. Verify account deletion/contact operations and privacy wording from a member account.
5. Decide whether the two older Render service URLs are still used. Keep them until that is confirmed.
6. Continue free-tier monitoring; defer SMS, automated verification, calls, and paid AI without budget approval.

## Review evidence

- [README](../README.md).
- [Employer and organization verification process](employer-organization-verification.md).
- [MVP release readiness snapshot, 2026-11-17](MVP-RELEASE-READINESS-2026-11-17.md).
- Production rechecked on 2026-11-24: Vercel production and Render's backend are live at `4b4a272dd0fb2c52fb35cf135069ce3cb90a02ac`; Supabase is ACTIVE_HEALTHY. Production readiness returned HTTP 200 with database dependency; the removed legacy company-list endpoint returned HTTP 404. GitHub Actions on PR #98 passed the full `npm test --prefix backend` workflow: JavaScript checks and all 25 backend tests. Signup and Google OAuth now record the currently published privacy policy version (`2026-11-02`); the backend signup endpoint validates the same version in PR #98.
