# AIConnectPro

AIConnectPro is a small frontend and Express API prototype using Supabase for authentication and data storage.

## Local structure

- `frontend/`: static HTML, CSS, and browser JavaScript
- `backend/`: Express API; run commands from this directory

## Backend on Render

Set the Render service root directory to `backend` and use `npm install` for the build command and `npm start` for the start command.

Required environment variables:

- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key

Optional:

- `FRONTEND_ORIGIN`: allowed browser origin for CORS
- `OPENAI_API_KEY`: enables live AI responses; without it the assistant uses a mock response

Never put the service role key in frontend files, Vercel settings, or GitHub.

Company posting access is restricted to users whose server-managed Supabase `app_metadata.roles` includes `company`. Grant that claim only after verifying the organization, using a trusted administrator process. The profile API rejects attempts to assign the company role from ordinary user input.

## Supabase email and Google sign-in

1. In `frontend/auth.js`, replace the project URL and public anon key with the values from Supabase **Project Settings → API**. The anon key is intended for browser use; the service role key is not.
2. In Supabase **Authentication → Providers → Google**, enable Google and enter the OAuth client ID and secret.
3. In Google Cloud Console, set the authorized redirect URI to `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase **Authentication → URL Configuration**, add the deployed frontend callback URL `https://<your-frontend-domain>/auth-callback.html` to the allowed redirect URLs. Add your local development callback URL too if needed.
5. Configure the Supabase Site URL to the deployed frontend origin.

The login and signup pages offer both email/password and Google sign-in. The OAuth callback page exchanges the returned Supabase session and then sends the user to the app.

## Deployment notes

Vercel can serve the static files from `frontend/`. The current frontend calls API paths beginning with `/api`; when the API is hosted on a separate Render domain, configure a Vercel rewrite to the Render service URL. The actual Render URL and production frontend domain are account-specific, so they are not hard-coded here.
