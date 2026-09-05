# Deployment

Configure these exact Vercel environment variables for the Production environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)

Vite only exposes variables prefixed with `VITE_` to browser code. Names such as
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are not available to this app.
Redeploy after saving or changing environment variables.

Run `npm run build` and deploy the generated `dist/` directory as a static site.

Never configure `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any other
privileged key in Vercel or a browser build. Rotate any privileged key that was
previously exposed.
