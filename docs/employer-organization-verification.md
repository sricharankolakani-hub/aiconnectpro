# Employer organization verification

Employer registration creates a separate organization record and a pending owner membership. The person's existing AIConnectPro login and personal profile remain unchanged.

## GST verification boundary

`backend/services/gstVerification.js` is the provider-neutral server-side adapter boundary. Provider credentials must stay in the backend environment and must never be sent to the browser.

No provider is selected or configured yet. The current implementation always returns `manual_review`, so an organization cannot publish until an administrator checks its submitted details and approves the review. A configured provider name alone does not enable verification: add and review a provider adapter before returning `verified`.

A future adapter should accept a GSTIN and submitted organization details and return a normalized result containing:

- `status`: `verified`, `manual_review`, or `rejected`
- `provider` and a provider reference for audit
- a minimal result describing name, GST registration status, registered address, and any mismatch

Do not copy raw provider responses or credentials into `verification_result`. Store only the minimum evidence needed for audit, and keep provider-specific calls and secret keys in the backend.

## Manual review

The admin review queue displays the submitted GSTIN, registered address, and operating location. Administrators should compare those details against authoritative records and approve only after completing that review. Organizations without a GSTIN remain eligible for manual review; an empty GSTIN is not treated as a successful GST check.

## Database rollout

Apply `supabase/migrations/20261017103000_organizations_and_memberships.sql` before deploying the backend and frontend changes. It creates organizations and memberships, enables RLS, and associates job ownership with an organization.
