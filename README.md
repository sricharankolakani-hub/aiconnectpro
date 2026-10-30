# AIConnectPro

AIConnectPro is a professional networking and opportunities prototype built with static frontend pages, an Express API, and Supabase.

## Project structure

- `frontend/`: HTML, CSS, and browser JavaScript
- `backend/`: Express API; run commands from this directory
- `supabase/migrations/`: database migrations

## Backend on Render

Set the Render service root directory to `backend`, the build command to `npm install`, and the start command to `npm start`.

Required environment variables:

- `SUPABASE_URL`: the Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key

Optional:

- `FRONTEND_ORIGIN`: allowed browser origin for CORS
- `OPENAI_API_KEY`: enables live AI responses; without it, the assistant uses a mock response

Keep the service-role key on the backend. Never put it in frontend files, Vercel settings, or GitHub.

## Organization and employer access

Personal member profiles and organizations are separate records. A user can request access to an organization and becomes able to post jobs or view applicants only through an active organization membership and after that organization is verified.

Organization registrations collect business identity and location details, including a GSTIN when available. Registrations remain pending for administrator review. No automated GST verification provider is configured, so administrators must check the submitted details and any supporting evidence before approving an organization. Do not treat a submitted GSTIN or uploaded document alone as verification.

The first administrator must be configured by a trusted Supabase project owner by adding `admin` to that user's `app_metadata.roles` array. Never grant admin access through `user_metadata` or from a browser client. Administrator-only APIs enforce the server-managed admin role.

## Supabase email and Google sign-in

1. Configure the Supabase project URL and browser-safe publishable/anon key in `frontend/auth.js`.
2. In Supabase **Authentication → Providers → Google**, enable Google and enter the OAuth client ID and secret.
3. In Google Cloud Console, set the authorized redirect URI to `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase **Authentication → URL Configuration**, add the deployed frontend callback URL `https://<your-frontend-domain>/auth-callback.html` to the allowed redirect URLs. Add your local development callback URL if needed.
5. Set the Supabase Site URL to the deployed frontend origin.

The login and signup pages support email/password and Google sign-in. The OAuth callback exchanges the returned Supabase session and then sends the user to the app.

## Deployment

Set the Vercel project root directory to `frontend/`. The included `frontend/vercel.json` rewrites `/api/*` requests to the configured Render API URL. Confirm that it matches the selected Render backend before deployment, and configure the production frontend origin and OAuth callback URL in Supabase Authentication → URL Configuration.
