# AIConnectPro MVP release readiness

**Snapshot date:** 24 November 2026 (Asia/Kolkata)  
**Scope:** Current production MVP, using existing no-cost services.

## Current result

The deployed application is available for a controlled pilot. Core pages and backend health checks are responding. The broader product vision is not complete, and the public job marketplace has no inventory yet.

## Production evidence

- Monitoring on 23 November found no Vercel runtime error clusters in the prior seven days, no Render application error logs in the prior 24 hours, and no open GitHub issues or pull requests before this release.
- The latest production code release on Vercel is **READY** at commit `4b4a272dd0fb2c52fb35cf135069ce3cb90a02ac`, including the signup consent fix and legacy endpoint removal.
- Render service `aiconnectpro-backend` is **live** on the free plan at backend application commit `4b4a272dd0fb2c52fb35cf135069ce3cb90a02ac`.
- Supabase project `yrjkkmvrmiieqozuvbqp` is **ACTIVE_HEALTHY**.
- Platform state rechecked 24 November: the latest Vercel production code release is READY, Render's backend deploy is live on the Free plan, and Supabase is ACTIVE_HEALTHY. Production `/api/ready` returned HTTP 200 and confirmed database readiness after the latest release; the removed legacy company-list endpoint returned HTTP 404.
- The latest GitHub Actions workflow on PR #98 ran `npm test --prefix backend` successfully, including JavaScript checks and all 25 backend Node tests. The same workflow passed on PRs #94 and #96. Coverage includes the protected AI assistant endpoint and input policy, secure employer resume previews, verified-employer application-notification recipients, company review decision notifications, signup OTP input length, messaging receipts, readiness, account export, and account-deletion safeguards. The deletion tests cover policy guards only; no destructive account deletion was run against production data.
- The admin company-access page reports database connectivity separately from request-queue status. Access remains server-side admin protected.
- New-application notifications reach active members of the verified organization and link directly to that opportunity in the applicant inbox. Company approval and rejection notifications reach the request owner and link to company access. Both supporting Supabase migrations are applied.

## Current production data snapshot

Read-only counts captured on 23 November 2026:

| Item | Count |
| --- | ---: |
| Auth users | 6 (5 email-confirmed; 1 awaiting email confirmation) |
| Profiles | 3 |
| Organizations | 0 |
| Employer requests | 0 |
| Jobs | 0 |
| Applications | 0 |
| Conversations | 1 |
| Messages | 20 |
| Capsules | 3 |

The product has no employer or job inventory yet. Do not create synthetic public listings; onboard a real employer and review its company evidence manually.

## Ready for a controlled pilot

- Member email/password and Google sign-in flows are present. The owner reports saving temporary Gmail SMTP settings and has confirmed receiving a signup OTP. That confirms delivery for the reported test; code acceptance and completion of signup still need browser confirmation. A CI regression test protects the signup page's 6–10 digit range, including 8-digit codes. Signup, Google OAuth, and the backend signup endpoint now record/validate version `2026-11-02`, matching the published policy effective date (PR #98). Current aggregate counts show one account awaiting email confirmation, but cannot identify whether it is the test account. Complete the OTP step in the browser; never share the code in chat.
- Profile, resume, connections, messaging, Capsules, and employer access pages are deployed. Verified employers can open an applicant’s attached resume from the inbox, subject to a server-side check that it belongs to an application for their own listing. Active members of the verified organization receive an alert when an application arrives.
- Company request owners receive in-app alerts when an administrator approves or rejects their request.
- Account exports include notifications and organization records created by the member; this received a regression test in PR #75.
- Account deletion safeguards for exact confirmation, recent sign-in, admin transfer, and reviewed-organization transfer are covered by five tests in PR #78.
- Employer access is separate from a member profile. Job posting requires an approved organization membership.
- Company verification is manual because no GST verification provider is configured.
- Admin access is granted only through server-managed Supabase app metadata. Never grant admin through browser-editable user metadata.
- Company request and content-report pages are restricted to authorized admins.

## Remaining launch gates

1. **Email verification:** OTP delivery is confirmed for the owner's reported signup test after Gmail SMTP configuration. The signup's OTP acceptance and resulting signed-in state still need confirmation in the browser; the owner should enter the code without sharing it. Delivery to an unrelated public address has not been separately checked. Gmail SMTP is a temporary pilot setup.
2. **Mobile OTP:** Not enabled because no SMS provider is configured and the owner has no budget for paid services. Signup copy explains the limitation. Revisit only when a no-cost provider or budget is available.
3. **Real employer supply:** No company requests, organizations, or jobs exist in production. Invite a genuine employer, review the company documents, approve the organization, then publish a real listing.
4. **Privacy and account operations:** The policy page is deployed. Before broad public launch, verify the published retention/deletion process and provide users a working account deletion/contact route.
5. **Free-tier availability:** Supabase previously paused the project after inactivity; it has been restored and is healthy. The owner should check `/api/ready` if data-backed pages stop loading. Free services can pause or have usage limits.
6. **Not part of this MVP:** Automated GST checks, mobile OTP, voice/video calling, and paid AI generation are not available now. Without an AI provider key, the assistant may use its fallback response.

## Security and maintenance notes

- **API route audit (24 Nov):** All inspected user-data routes require sign-in; admin routes also require the server-managed admin role. PR #96 removed an unused unauthenticated legacy company-list endpoint, and production now returns HTTP 404 for that path. PR #98 aligned the legacy backend signup consent check with the same current policy version as the browser flow. Signup/login and health/readiness routes remain intentionally public.
- Supabase's security advisor rechecked on 2026-11-23 reports 19 RLS-enabled tables with no policies and a leaked-password protection warning. A same-day read-only grant query found no table grants to the `anon` or `authenticated` database roles; the app uses the protected server API. Recheck before changing grants or adding direct browser database access. A catalog audit confirmed that member-owned profile, connection, messaging, post, and report records cascade when an Auth user is deleted; reviewed organizations block deletion and attribution fields are set null. No destructive account deletion was run in production.
- Supabase’s leaked-password protection advisory remains. It requires a paid Supabase plan, so it was not enabled under the no-subscription constraint.
- Performance advisor rechecked 2026-11-23 still reports unused indexes and unindexed foreign keys. At current low row counts these are informational; do not drop indexes or make production schema changes without checking query plans and testing a migration.

## Pilot readiness checklist

- [x] Production pages resolve and are served over HTTPS.
- [x] Backend liveness and database readiness return healthy.
- [x] Production frontend, backend, and database are active.
- [x] Automated project checks pass for readiness, account export, account-deletion safeguards, OTP input length, employer resume access, application notifications, and company review notifications (CI runs `npm test --prefix backend`; all 25 backend tests and JavaScript checks passed on PR #98).
- [x] Application and company-review notification migrations are applied; corresponding code is live on Vercel and Render.
- [x] Owner confirms receiving the signup OTP after configuring temporary Gmail SMTP; the signup and OAuth consent version now matches the published policy.
- [ ] Owner submits the code in the signup page and confirms the new account reaches its signed-in state.
- [ ] A real employer submits a request and is manually reviewed.
- [ ] A real job is published and its listing/application flow is checked, including notification and resume preview.
- [ ] Owner verifies deletion/contact operations before inviting a broad public audience.

**Recommendation:** Treat the current deployment as a controlled pilot, not a fully stocked public marketplace. Complete the OTP sign-in check, first-employer review, real listing/application flow, and privacy/account-operation check before promoting it broadly.
