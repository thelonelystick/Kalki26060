# Kalki 26060

Digital platform for efficient remote management of Indian Antarctic Research Stations.

https://kalki26060.vercel.app/

## Google login

Google login uses Supabase Auth and opens the existing researcher console. In Supabase, enable the Google provider under **Authentication -> Providers -> Google**, then add these redirect URLs under **Authentication -> URL Configuration**:

If the app reports `Unsupported provider: provider is not enabled`, the Google provider is still disabled in Supabase. Turn on the provider, enter the Google OAuth client ID and client secret, save it, and retry the button.

```text
http://localhost:5173/
https://kalki26060.vercel.app/
```

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

Set `POLARIS_ADMIN_USERNAME` and `POLARIS_ADMIN_PASSWORD` before starting the backend. Administrator updates are stored under `POLARIS_DATA_DIR` (default `backend/data`) and are loaded again after a browser refresh. The generated JSON store is ignored by Git. For production deployment, point this persistence layer at a durable database or volume; serverless temporary files are not durable.

After adding the `role` column, apply both Supabase migrations so researcher accounts default to `researcher` and administrator accounts can be marked `admin`.
