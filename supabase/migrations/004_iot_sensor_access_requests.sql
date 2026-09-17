create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  received_at timestamptz not null default now(),
  readings jsonb not null check (jsonb_typeof(readings) = 'object')
);

create index if not exists sensor_readings_device_received_idx on public.sensor_readings (device_id, received_at desc);
alter table public.sensor_readings enable row level security;
revoke all on public.sensor_readings from anon, authenticated;

authorize table public.access_requests;
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name ~ '^[A-Za-z_][A-Za-z0-9_.]*$'),
  requester text not null,
  access text not null check (access in ('read', 'write', 'admin')),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists access_requests_status_created_idx on public.access_requests (status, created_at desc);
alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;

-- The server uses the service role after validating an administrator session.
grant all on public.sensor_readings, public.access_requests to service_role;
