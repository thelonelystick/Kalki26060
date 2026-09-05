# Security Notes

## Authentication

The frontend uses Supabase Auth `signInWithPassword`, persisted Supabase sessions, automatic token refresh, `getSession`, `onAuthStateChange`, and `signOut`. A locally writable object is never treated as proof of authentication.

The browser must receive only the Supabase URL and publishable/anon key. The service-role key must remain server-side and must never be committed.

## Required secret rotation

The repository previously contained a Supabase service-role secret in `.env`. It has been removed from the working tree and Git tracking, but it must be revoked and rotated in the Supabase dashboard because it may exist in Git history.

## Current limitations

Operational tables and role-based authorization still require Supabase migrations and RLS policies before production data is connected. Do not expose sensitive tables until deny-by-default policies are deployed.
