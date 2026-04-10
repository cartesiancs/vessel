# Vessel Desktop (Tauri)

This package wraps the existing client and Rust server into a Tauri desktop build with the server running as a sidecar.

## Development

```bash
npm run desktop
```

This builds the server in release mode, starts the Vite dev server for the client, and launches Tauri.

## Build

```bash
npm run desktop:build
```

This compiles the client bundle, builds the server sidecar (`apps/server/target/release/server`), and packages the desktop app.

## Notes

- The sidecar server runs inside the app's writable data directory and will create `config.toml`, `database.db`, and `log/` there if they do not exist.
- The client is pre-wired to point at the local sidecar (sets `server_url` cookie) when running inside Tauri.
