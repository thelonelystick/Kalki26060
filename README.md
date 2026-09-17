# Kalki 26060

Digital platform for efficient remote management of Indian Antarctic Research Stations.

https://kalki26060.vercel.app/

## Project guides

- [Workflow](workflow.md): local development, UI/data workflows, and release checks.
- [Digital approach](digital-approach.md): product principles, technical shape, and experience decisions.

### Git worktrees

Use a separate worktree when you want to work on another branch without disturbing the current checkout:

```bash
git worktree add ../Kalki26060-feature -b feature/name
git worktree list
git worktree remove ../Kalki26060-feature
```

## File reference

### Application

- [index.html](index.html): Main single-page application markup, login screen, navigation, operational modules, and inline module containers.
- [script.js](script.js): Client behavior for authentication, navigation, themes, dataset loading, admin actions, alerts, telemetry views, and the Three.js landscape viewer.
- [style.css](style.css): Global layout, responsive styles, light/dark themes, forms, status indicators, panels, and model-viewer presentation.
- [src/webservices/datasets.js](src/webservices/datasets.js): Reusable frontend service functions for fetching datasets and API health status.

### API and backend

- [api/health.js](api/health.js): Serverless health-check endpoint.
- [api/accounts.js](api/accounts.js): Protected administrator endpoint for listing and updating in-memory account role assignments.
- [api/auth/admin.js](api/auth/admin.js): Administrator credential endpoint that returns the configured admin API token after successful login.
- [api/auth/account-role.js](api/auth/account-role.js): Account-role endpoint placeholder for future durable role lookup.
- [api/datasets/[module].js](api/datasets/[module].js): Serverless dataset endpoint that serves fixture data and exposes the DOM binding contract; dataset writes require authorization.
- [api/telemetry/[deviceId].js](api/telemetry/[deviceId].js): Serverless IoT endpoint that accepts authenticated device readings and returns the latest reading for the DOM.
- [backend/server.mjs](backend/server.mjs): Local Node.js API server for health checks, datasets, admin updates, access requests, telemetry ingestion, and optional Supabase persistence.
- [backend/arduino/telemetry.ino](backend/arduino/telemetry.ino): ESP32/Arduino example that posts sensor readings to the telemetry endpoint.

### Data and assets

- [assets/polaris-dataset.json](assets/polaris-dataset.json): Twin Model station and orbital fixture data.
- [assets/infrastructure-dataset.json](assets/infrastructure-dataset.json): Infrastructure and site-access fixture data.
- [assets/utilities-dataset.json](assets/utilities-dataset.json): Utilities, energy, water, and environmental fixture data.
- [assets/data-transfer-dataset.json](assets/data-transfer-dataset.json): Data-transfer policy, links, and transfer-status fixture data.
- [assets/alerts-dataset.json](assets/alerts-dataset.json): Station alert and integrity-observation fixture data.
- [assets/polaris-logo.svg](assets/polaris-logo.svg): Polaris Ops brand mark used in the login and application headers.
- [assets/google-logo.svg](assets/google-logo.svg): Google sign-in button logo.
- [assets/landscape.glb](assets/landscape.glb): Compact deployable GLB used by the interactive landscape viewer.
- [landscape.glb](landscape.glb): Generated source GLB retained at the repository root for local inspection and regeneration workflows.
- [create_landscape_glb.py](create_landscape_glb.py): Python/trimesh generator for the island, lake, station, peaks, snow caps, and exported GLB scene.

### Database and documentation

- [supabase/migrations/001_verify_login.sql](supabase/migrations/001_verify_login.sql): Creates the secure login verification function.
- [supabase/migrations/002_add_login_role.sql](supabase/migrations/002_add_login_role.sql): Adds and validates visitor, researcher, and administrator roles.
- [supabase/migrations/003_datasets_and_admin_users.sql](supabase/migrations/003_datasets_and_admin_users.sql): Creates dataset storage and administrator/account management functions and policies.
- [supabase/migrations/004_iot_sensor_access_requests.sql](supabase/migrations/004_iot_sensor_access_requests.sql): Creates sensor-reading and SQL access-request tables with protected persistence functions.
- [docs/data-iot-access.md](docs/data-iot-access.md): Documents dataset, telemetry, access-request, and Supabase integration endpoints.
- [workflow.md](workflow.md): Local development, UI/data workflows, and release checks.
- [digital-approach.md](digital-approach.md): Product principles, technical shape, and experience decisions.

### Project configuration

- [package.json](package.json): npm scripts and frontend/backend dependencies.
- [package-lock.json](package-lock.json): Locked npm dependency versions for reproducible installs.
- [vite.config.js](vite.config.js): Vite build configuration and local `/api` proxy.
- [.env.example](.env.example): Example environment variable names for Supabase, OAuth, administrator access, and local persistence.
- [.gitignore](.gitignore): Files and directories excluded from version control, including local secrets and generated data.
- [.gitattributes](.gitattributes): Git file handling rules for repository assets.

## Google login

Google login uses Supabase Auth and opens the existing researcher console. In Supabase, enable the Google provider under **Authentication -> Providers -> Google**, then add these redirect URLs under **Authentication -> URL Configuration**:

If the app reports `Unsupported provider: provider is not enabled`, the Google provider is still disabled in Supabase. Turn on the provider, enter the Google OAuth client ID and client secret, save it, and retry the button.

```text
http://localhost:5173/
https://kalki26060.vercel.app/
```

In Google Cloud, add this authorized redirect URI to the OAuth web client. Google must redirect to Supabase's callback, not directly to the Vercel site:

```text
https://alymfzfgpqcvbcptwafg.supabase.co/auth/v1/callback
```

Set the Supabase **Site URL** to `https://kalki26060.vercel.app/` and keep both app URLs above in Supabase's **Redirect URLs** list. For local development, also add `http://localhost:5173/` there.

Set `VITE_SUPABASE_REDIRECT_URL` for a different deployment URL. The Google OAuth client secret belongs only in Supabase or a server-side secret store; never put it in `.env`, browser code, or Git. Because the OAuth credentials shown in the supplied screenshot are exposed, rotate that client secret in Google Cloud before using it.

Use this client ID in Supabase's Google provider configuration:

```text
621904618145-87s2cackunqb0tl35a4l87uiim2eufol.apps.googleusercontent.com
```

## Local webservices

The backend source lives in `backend/server.mjs` and exposes:

- `GET /api/health`
- `GET /api/datasets/{module}`

Run the webservice with `npm run dev:backend` in one terminal and the frontend with `npm run dev` in another. Vite proxies `/api` requests to `http://localhost:8787`, so the browser uses the same paths locally and in deployment. `npm start` runs only the backend for production-style use.

## Dataset automation API

Each dataset is available at `/api/datasets/{module}`:

| Module | Dataset key | DOM root |
| --- | --- | --- |
| `polaris` | `polaris` | `data-dataset="polaris"` |
| `infrastructure` | `infrastructure` | `data-dataset="infrastructure"` |
| `utilities` | `utilities` | `data-dataset="utilities"` |
| `transfer` | `data-transfer` | `data-dataset="data-transfer"` |
| `alerts` | `alerts` | `data-dataset="alerts"` |

Responses include `data` plus the DOM binding contract. Automation can use `data-dataset-item` for records and `data-dataset-path` for fields, for example `utilities.energy.usedKwh`.

To protect the endpoints, configure the deployment secret `POLARIS_DATASET_API_KEYS` as one or more comma-separated keys. The same key works for every dataset route. Send it as either:

```text
x-api-key: <your-key>
```

or:

```text
Authorization: Bearer <your-key>
```

When no key is configured, the endpoint remains readable for the local fixture-based frontend. Never commit a real key to this repository or expose it in browser code.

## Access roles and persistence

The login screen supports two access types:

- `Researcher`: the existing console experience with read-only dataset access.
- `Visitor`: the default Google/unknown-account access; read-only Twin Model and model viewing controls only.
- `Administrator`: authenticates against the backend and can add IoT devices, edit transfer policy fields, update dataset fields, and assign account roles.

Set `POLARIS_ADMIN_USERNAME` and `POLARIS_ADMIN_PASSWORD` in the ignored local `.env` file before starting the backend. The local administrator username is `admin`; never commit or document the password. Administrator updates are stored under `POLARIS_DATA_DIR` (default `backend/data`) and are loaded again after a browser refresh. The generated JSON store is ignored by Git. For production deployment, point this persistence layer at a durable database or volume; serverless temporary files are not durable.

For the deployed Vercel login, add these environment variables in **Vercel -> Project Settings -> Environment Variables** and redeploy:

```text
POLARIS_ADMIN_USERNAME=admin
POLARIS_ADMIN_PASSWORD=<your-admin-password>
POLARIS_ADMIN_API_KEY=<a-long-random-api-key>
```

The deployed account log currently uses serverless memory; use Supabase or another durable store before relying on production role assignments.

After adding the `role` column, apply both Supabase migrations so researcher accounts default to `researcher` and administrator accounts can be marked `admin`.
