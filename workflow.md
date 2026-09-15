# Workflow

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and supply the required environment values if you are testing authenticated or backend features.
3. Start the web client with `npm run dev`.
4. When working on API-backed behavior, run `npm run dev:backend` in a second terminal.

## UI workflow

1. Sign in with the intended role and confirm that the expected modules are available.
2. Use the top-bar theme control to verify light and dark contrast; refresh the page to confirm that the preference persists.
3. In **Twin Model**, open the 3D model, inspect orbit controls and resizing, then close it and confirm the canvas is released.
4. Treat the aurora field as ambient visual context only. Operational decisions must remain based on connected datasets and labelled station alerts.

## Data workflow

1. Start with the checked-in dataset fixtures for safe interface development.
2. Connect or update authoritative adapters in `src/webservices/datasets.js` before enabling live operational data.
3. Validate empty, loading, unavailable, and successful states for every module.
4. Use an administrator session for changes to accounts, device records, transfer policies, or dataset fields.

## Before release

1. Run `npm run build`.
2. Test narrow and wide viewports, keyboard navigation, login/logout, role visibility, and both themes.
3. Confirm no values that look operational are hard-coded as live telemetry.
4. Verify configured API and Supabase environment variables in the target deployment.
