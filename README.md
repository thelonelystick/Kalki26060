# Kalki 26060

Digital platform for efficient remote management of Indian Antarctic Research Stations.

https://kalki26060.vercel.app/

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
