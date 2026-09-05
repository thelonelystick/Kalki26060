# Kalki 26060

Digital platform for efficient remote management of Indian Antarctic Research Stations.

## Development

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` for local Supabase configuration. Only the
publishable/anon key belongs in browser configuration.

```bash
npm run build
```

Login credentials are checked by the Supabase `verify_login` RPC against the
`public.login` table. Operational telemetry is intentionally shown as unavailable
until an authoritative backend and RLS policies are connected.
