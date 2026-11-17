# AIConnectPro MVP release readiness

**Snapshot date:** 17 November 2026 (Asia/Kolkata)  
**Scope:** Current production MVP, using existing no-cost services.

## Current result

The deployed application is available for a controlled pilot. Core pages and backend health checks are responding. The broader product vision is not complete, and the public job marketplace has no inventory yet.

## Production evidence

- Vercel production deployment is **READY** at commit `8c5d64265abc7161b6c8a7dd03ef690fcefac8a3`.
- Render service `aiconnectpro-backend` is **live** on the free plan at commit `d35bcaebc0ff47fe8dd2c880f967af38df54a6b7`.
- Supabase project `yrjkkmvrmiieqozuvbqp` is **ACTIVE_HEALTHY**.
- Production `/api/health` returned HTTP 200. `/api/ready` returned HTTP 200 with database readiness.
- A production route sweep returned HTTP 200 for: home, login, signup, jobs, connections, messages, profile, resume builder, Capsules, settings, company access, both admin pages, post-job, and `privacy-policy.html`.
- GitHub Actions Project checks passed for the admin readiness changes (run 43). Vercel production is ready.
- The admin company-access page now shows database connectivity separately from request-queue status. Access remains server-side admin protected.

## Current production data snapshot

Read-only counts at the time of review:

| Item | Count |
| --- | ---: |
| Auth users | 4 |
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

- Member email/password and Google sign-in flows are present; email verification has been exercised by the owner previously.
- Profile, resume, connections, messaging, Capsules, and employer access pages are deployed.
- Employer access is separate from a member profile. Job posting requires an approved organization membership.
- Company verification is manual because no GST verification provider is configured.
- Admin access is granted only through server-managed Supabase app metadata. Never grant admin through browser-editable user metadata.
- Company request and content-report pages are restricted to authorized admins.

## Remaining launch gates

1. **Email delivery:** Confirm production email uses a configured custom SMTP provider and verify a fresh signup end to end. Supabase’s default mail service is best-effort and is not a reliable production delivery plan. Configure SMTP in Supabase without sharing credentials in chat.
2. **Mobile OTP:** Not enabled because no SMS provider is configured and the owner has no budget for paid services. Signup copy explains the limitation. Revisit only when a no-cost provider or budget is available.
3. **Real employer supply:** No company requests, organizations, or jobs exist in production. Invite a genuine employer, review the company documents, approve the organization, then publish a real listing.
4. **Privacy and account operations:** The policy page is deployed. Before broad public launch, verify the published retention/deletion process and provide users a working account deletion/contact route.
5. **Free-tier availability:** Supabase previously paused the project after inactivity; it has been restored and is healthy. The owner should check `/api/ready` if data-backed pages stop loading. Free services can pause or have usage limits.
6. **Not part of this MVP:** Automated GST checks, mobile OTP, voice/video calling, and paid AI generation are not available now. Without an AI provider key, the assistant may use its fallback response.

## Security and maintenance notes

- Supabase’s advisor reports tables with RLS enabled and no policies. A current read-only check found no table grants to the `anon` or `authenticated` database roles; the application accesses data through the protected server API. Recheck this before changing grants or adding direct browser database access.
- Supabase’s leaked-password protection advisory remains. It requires a paid Supabase plan, so it was not enabled under the no-subscription constraint.
- Performance advisor notices about unused indexes and unindexed foreign keys are informational at current low row counts. Do not drop indexes or make production schema changes without checking query plans and testing a migration.

## EOD acceptance checklist

- [x] Production pages resolve and are served over HTTPS.
- [x] Backend liveness and database readiness return healthy.
- [x] Production frontend, backend, and database are active.
- [x] Automated project checks pass for the latest admin-status changes.
- [x] No open pull requests remain after this release.
- [ ] Owner confirms custom SMTP and completes a fresh email signup.
- [ ] A real employer submits a request and is manually reviewed.
- [ ] A real job is published and its listing/application flow is checked.
- [ ] Owner verifies deletion/contact operations before inviting a broad public audience.

**Recommendation:** Treat the current deployment as a controlled pilot, not a fully stocked public marketplace. Complete the owner-controlled SMTP and first-employer checks before promoting it broadly.
