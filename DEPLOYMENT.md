# Deployment

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the deployment environment, then run `npm run build`. Deploy the generated `dist/` directory as a static site.

Never configure `SUPABASE_SERVICE_ROLE_KEY` in a browser build. Rotate any privileged key that was previously committed.
