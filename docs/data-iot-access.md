# Dataset, IoT, and SQL access integration

The backend now discovers every `assets/*-dataset.json` file and exposes:

- `GET /api/datasets` — dataset registry and DOM binding contract.
- `GET /api/datasets/{module}` — dataset JSON plus `data-dataset`, `data-dataset-item`, and `data-dataset-path` metadata.
- `PATCH /api/datasets/{module}` — administrator-only dataset field updates.
- `POST /api/telemetry/{deviceId}` — Arduino/IoT JSON ingestion. Use `x-api-key`; configure `POLARIS_IOT_DEVICE_KEYS=device-id:key`.
- `GET /api/telemetry/{deviceId}` — latest reading for the browser dashboard. The frontend maps `temperatureC` to `polaris.station.temperature` and `humidityPct` to `polaris.station.humidity`, then updates matching `data-dataset-path` elements every 30 seconds.
- `GET /api/access-requests` — administrator-only access request list.
- `POST /api/access-requests` — administrator-only request creation for a SQL table.

When Supabase server credentials are configured, sensor readings and access requests are stored in Supabase. Without them, local JSON files under `backend/data` are used for development.

Apply `supabase/migrations/004_iot_sensor_access_requests.sql` before enabling the Supabase persistence path. Never expose a Supabase service key or device key in frontend code. The Arduino example is in `backend/arduino/telemetry.ino` and must be configured with deployment-specific values.
