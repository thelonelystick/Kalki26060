# Architecture

Polaris Ops is currently a static Vite entry point with a single-page operational shell. Supabase Auth owns identity and session state; the publishable key is the only client-side credential.

The 3D viewer is loaded lazily after the operator explicitly opens it. The model is cached with Cache Storage and is not initialized during normal dashboard refreshes.

The next production boundary is to move operational reads and writes into small service modules backed by Supabase tables with RLS. Until those migrations exist, the UI intentionally displays `NO DATA` rather than fabricating telemetry.
