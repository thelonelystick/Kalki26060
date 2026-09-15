# Digital approach

Polaris Ops is designed as a focused, browser-based operations console for Antarctic station teams. It keeps the most important operational context close to the people using it: station state, infrastructure access, utilities, data transfer, and alerts each have a dedicated module.

## Principles

- **Authoritative data first.** The interface begins with empty or clearly labelled states until a dataset or authenticated source is connected. It does not invent operational telemetry.
- **Useful at a glance.** Dense operational information is presented through short status labels, compact panels, and visual cues that make attention priorities clear.
- **Accessible in changing conditions.** The saved light/dark preference supports bright station environments and low-light work without requiring a separate interface.
- **Spatial context where it helps.** The station landscape can be opened as an interactive Three.js scene. A separate, site-wide animated aurora object provides ambient interface context without standing in for measured conditions.
- **Secure by role.** Authentication and roles control access to administrative actions; the visible product surface is tailored to the current session.

## Technical shape

The client is a Vite-served single-page interface with small, module-oriented data adapters. Supabase handles authenticated identity and data access where configured. The interactive terrain scene uses Three.js, loads the local GLB model on demand, and disposes renderer resources when closed. This keeps initial page load light while leaving a rich spatial inspection path available.

## Experience decisions

The interface favors a calm polar palette, restrained motion, and explicit status language. Theme selection is stored locally, honors the system preference on first visit, and updates the site-wide aurora palette. The aurora is intentionally decorative and must not be interpreted as a weather or geomagnetic forecast.
