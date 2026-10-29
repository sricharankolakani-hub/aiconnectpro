-- Private profile data is accessed only through the authenticated backend
-- route, which scopes every query to the verified user ID. Do not expose this
-- table through PostgREST or GraphQL to browser sessions.
revoke all on public.profile_private_details from anon, authenticated;
