# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-page web app for manually testing Firebase Cloud Messaging (FCM) v1 API sends. Upload a Google service account JSON, paste one or more FCM registration tokens, set title/body/image, and watch a terminal-styled console log the raw request/response for each send. No database, no build step, no tests.

## Commands

```bash
npm install
npm start        # node server.js, serves on PORT env var or 3000
```

No lint/test scripts exist.

## Architecture

Two-piece app, no framework/bundler:

- **`server.js`** — single Express server. Serves `public/` as static files and exposes one route, `POST /api/send`. Per request it:
  1. Validates `serviceAccount` (JSON string or object), `tokens` (array), `title`, `body`.
  2. Uses `google-auth-library`'s `GoogleAuth` with the service account credentials (scope `firebase.messaging`) to mint an OAuth2 access token.
  3. Loops over `tokens`, POSTing one FCM v1 message per token to `https://fcm.googleapis.com/v1/projects/{project_id}/messages:send` with `fetch`.
  4. Accumulates a `logs` array (`{timestamp, type: info|success|error, message, data}`) across every step and auth failure, and returns it as JSON — the whole request/response history goes back to the client in one shot rather than streaming.
  5. When `imageUrl` is set, adds `data.bigPicture`, `android.notification.image`, and `apns.payload.aps["mutable-content"]` + `apns.fcm_options.image` to the message payload so the image shows on both platforms.
  - Service account credentials are never persisted server-side — they exist only for the duration of the request.

- **`public/app.js`** — vanilla JS, no framework. Handles file drop/upload of the service account JSON (validated client-side for `project_id`/`private_key`/`client_email` before it's ever sent), builds the token list by splitting the tokens textarea on newlines, POSTs to `/api/send`, then replays the returned `logs` array into the `#consoleBody` terminal UI (`addLog`). Console supports clear/copy.

- **`public/index.html` / `public/index.css`** — two-column layout: left is the form (`#fcmForm`), right is a fake terminal window (`#consoleBody`) styled as `fcm-console.sh`.

## Key conventions

- All FCM send outcomes (success/error/network failure) are logged per-token and returned together — a partial batch failure still returns HTTP 200 with per-token logs showing which tokens failed and why.
- The `data` payload on every FCM message always mirrors `title`/`body` and includes placeholder `itemType`/`itemId` fields ("0") — this look like app-specific deep-link fields; preserve them if extending the payload shape.
- `.codegraph/` exists — use the CodeGraph MCP tool for code lookups before grep/reading files.
