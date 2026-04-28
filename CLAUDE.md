# CLAUDE.md

Guidance for Claude Code working in the Vessel repository.

## Project

Vessel is C2 (Command & Control) software for connecting, monitoring, and orchestrating physical sensors through a visual flow-based interface. Local-first, offline-first. Apache-2.0.

## Repository layout

Cargo + npm workspaces (monorepo).

- `apps/server` — Rust (axum, tokio) backend. SQLite via Diesel (`migrations/`, schema in `src/db/schema.rs`). MQTT broker (rumqttd) + client (rumqttc), WebRTC, RTP/RTSP via GStreamer, ONNX inference (ort/tract). Entry: `src/main.rs`. Routes wired in `src/routes.rs`, handlers under `src/handler/`. Flow engine in `src/flow/` (engine, manager, nodes). Built-in flow nodes live in `src/flow/nodes/`. The compiled server embeds the client `dist/` via `rust-embed`.
- `apps/client` — React 19 + Vite + TypeScript + Tailwind v4 + Radix + Zustand. FSD-ish layout: `app/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/`, plus `components/ui` (shadcn) and `hooks/`, `contexts/`, `lib/`. Routing in `src/App.tsx` (react-router v7).
- `apps/desktop` — Tauri v2 shell. The Tauri build runs `cargo build --release -p server` and bundles the server binary as a sidecar; frontend served from `apps/client/dist`. Crate at `apps/desktop/src-tauri`.
- `apps/landing` — Marketing site (React + Vite). Deployed at vessel.cartesiancs.com.
- `apps/capsule` — Standalone Rust service for "Capsule" zero-knowledge LLM proxy (X25519 + ChaCha20-Poly1305). Has its own Dockerfile/docker-compose.
- `packages/capsule-client` — TS client SDK for Capsule (`@vessel/capsule-client`). Built before `client` in the build chain.
- `packages/custom-node-utils` — Python helpers for user-authored custom flow nodes.
- `packages/shared-types` — empty placeholder.
- `docs/` — VitePress site (vessel.cartesiancs.com/docs).
- `tests/` — Jest + supertest E2E against a running server at `http://localhost:6174`. Default creds `admin/admin1`.
- `configs/`, `config.toml`, `.env.example` — server config (jwt_secret, listen_address, database_url).
- `migrations/` lives under `apps/server/`. `database.db` at repo root is the dev DB.

## Common commands

Run from repo root unless noted.

- `npm run server` — `cargo run -p server` (debug). `npm run server:prod` for release.
- `npm run client` — Vite dev server for the React client.
- `npm run desktop` — Tauri dev (builds capsule-client + client + release server, then launches shell). `npm run desktop:build` to package.
- `npm run landing` — landing site dev server.
- `npm run capsule` — capsule service.
- `npm run build` — `cargo build --release` of the server only. Output: `target/release/server` (needs a `.env` next to it to run).
- `npm run client:build` — builds capsule-client then the client.
- `npm test` — Jest E2E in `tests/`. Server must already be running on `:6174` with seeded admin.
- `npm run docs:dev` / `docs:build` — VitePress.
- Diesel: `cd apps/server && diesel setup && diesel migration run` (requires diesel_cli). Migrations are also embedded and auto-run on server boot via `MIGRATIONS`.

## Architecture notes

- The server is the integration point: HTTP/WS API, embedded client UI, MQTT broker + client, RTP receiver, RTSP puller, WebRTC, recording manager, flow engine, tunnel manager. All share `Arc<AppState>` (`apps/server/src/state.rs`). Background tasks are spawned into a `JoinSet` driven by a `watch` shutdown channel — prefer that pattern for new long-running tasks.
- Flow runtime: `FlowManagerActor` (mpsc-driven) owns the live engine. New node types go in `src/flow/nodes/` and are registered in `mod.rs`. Engine/types in `src/flow/engine.rs` and `src/flow/types.rs`.
- DB access uses Diesel with an r2d2 pool. Repositories in `src/db/repository/`. When adding tables, add a migration *and* update `schema.rs` (`diesel print-schema`) and models.
- Auth is JWT (`jsonwebtoken`). Initial admin is seeded by `init::db_record::create_initial_admin`. RBAC tables created by the `2025-09-08_create_rbac_tables` migration; permissions seeded on boot.
- Client follows feature-sliced design. New screens: add a route in `src/App.tsx`, page under `pages/`, feature logic under `features/<name>/`, domain models under `entities/<name>/`, reusable UI in `components/ui` (shadcn-style) or `widgets/`. State is Zustand; data fetching is axios in `shared/api`.
- Maps use MapLibre/Leaflet. Code editor uses Monaco + CodeMirror. Charts via d3.
- Desktop sidecar: `apps/desktop/src-tauri/src/main.rs` launches the bundled server binary; client detects desktop via `useDesktopSidecar`. A separate `desktop_settings` window is dispatched in `App.tsx` based on URL params.

## Coding rules (enforced by `CODE_RULE.md`)

Mission-critical posture. Highlights to keep in mind:

- Fail-safe: every fallible op returns `Result`/`Promise`; handle both arms — no silent failures. Lints fail builds on unhandled results.
- Deterministic: no recursion (use iterative forms), no magic numbers (use `const`/`enum`), fixed-size buffers, no float `==` (use epsilon).
- Security by design: validate all external input at runtime, default to deny, least privilege, keep control flow simple.
- Concurrency: prefer message passing (we already do — `mpsc`/`broadcast`/`watch`) over shared mutable state.
- Tooling: zero warnings, format with `rustfmt` / `prettier` (`.prettierrc` is at repo root: 2-space, semi, double-quote, trailing-comma all, jsxSingleQuote), pass clippy/eslint at strict settings. Lockfiles (`Cargo.lock`, `package-lock.json`) are committed and authoritative.

## Conventions

- UI copy is **English only**. Even when prompts/issues are in Korean, ship English strings in `apps/client`.
- Don't create docs/markdown unless asked.
- Don't add comments for the "what"; only for non-obvious "why".
- Branch is `develop` for active work; PRs target `main`.
