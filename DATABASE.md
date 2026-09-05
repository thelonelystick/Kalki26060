# Database

The current UI does not claim to have live operational persistence. It requires a Supabase schema with authenticated access and deny-by-default RLS before connecting observations, maintenance, alerts, documents, or telemetry.

Recommended tables are `profiles`, `stations`, `observations`, `maintenance`, `alerts`, `documents`, `telemetry`, and `audit_logs`, each with UUID primary keys, timestamps, foreign keys, indexes, and policies scoped to `auth.uid()`.
