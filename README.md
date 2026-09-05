# Kalki 26060
### SIH Problem Statement :- 
Digital Platform for efficient remote management of Indian Antarctic Research Stations
### Live At -> https://kalki26060.vercel.app/

## Development

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` for local Supabase configuration. Only the publishable/anon key belongs in browser configuration. Never add a service-role key to `.env` committed to Git.

Build and preview the production bundle with:

```bash
npm run build
npm run preview
```

Supabase Auth is required for login. Operational telemetry is intentionally shown as unavailable until an authoritative backend and RLS policies are connected.
