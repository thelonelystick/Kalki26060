# Kalki 26060

Digital platform for efficient remote management of Indian Antarctic Research Stations.

## Local data sources

The console bundles non-authoritative fixture data for each operational module:

- `assets/infrastructure-dataset.json` — trusted station devices
- `assets/utilities-dataset.json` — energy, shipment, and biosecurity state
- `assets/data-transfer-dataset.json` — transfer queue and support phases
- `assets/alerts-dataset.json` — site access and heritage alerts

Replace these fixtures with authenticated station feeds before using the values operationally.

## Backend endpoints

The Vercel backend exposes:

- `GET /api/health` — service health and timestamp
- `GET /api/datasets/infrastructure` — trusted device data
- `GET /api/datasets/utilities` — energy, shipment, and biosecurity data
- `GET /api/datasets/transfer` — transfer queue and support phases
- `GET /api/datasets/alerts` — site and heritage alert data

The frontend requests these endpoints first and uses the bundled fixtures when an endpoint is unavailable during local development or deployment transitions.
