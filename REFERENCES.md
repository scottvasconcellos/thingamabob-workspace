# REFERENCES — Thing-a-ma-bob Workspace
Last updated: 2026-08-13

Static background knowledge. Nothing here changes often; nothing here is a task.

## House methodologies

- **ICM — Interpretable Context Methodology**
  `~/Documents/My Digital Library/Distills:AI Research/icm-context-methodology/`
  - `icm-manual_raw.md` — the write-up
  - The idea in one line: the agent is stateless compute; the folder is the
    stateful persistence layer. Identity in CLAUDE.md, mission in CONTEXT.md,
    knowledge in REFERENCES.md.
- **IOM — Operations Methodology**
  `~/Documents/My Digital Library/Distills:AI Research/iom-operations-methodology/IOM-manual.md`
  - §6 is the IOM Block appended to this repo's CLAUDE.md.
  - Prompts: `/fix`, `/wrap-up`, `/retrofit`, `/new-app`, `/checkup`.
  - Registry of protected repos: `~/.claude/iom-repos.json`.

## The backend

**Google Apps Script Web App + a Google Sheet**, living in Scott's own Google
account. Chosen because it is free with no signup, never sleeps, and stores the
data in a Drive he already owns.

- Apps Script web apps — https://developers.google.com/apps-script/guides/web
- `ContentService` (returning JSON) — https://developers.google.com/apps-script/reference/content/content-service
- `SpreadsheetApp` — https://developers.google.com/apps-script/reference/spreadsheet
- `LockService` (avoiding concurrent-write corruption) — https://developers.google.com/apps-script/reference/lock

Shared backend record for **all** of Scott's apps:
`~/.claude/tmb-backend.json` → `{ endpoint, secret, kind, sheet_id }`

Why one backend for every app: the first app pays the setup cost; every app
afterward is wired up with no setup at all. That is what makes `/make-it-sync`
a one-prompt operation in repo number seven.

### Why not a connector

MCP connectors run agent-side. When the phone opens the app there is no Claude
session anywhere, so a connector can never *be* the sync channel — it can only
*provision* a backend that then runs on its own. That distinction is the whole
reason the backend is a deployed web app rather than a clever tool call.

### CORS note

POSTs from the browser use `Content-Type: text/plain` on purpose. That keeps
them "simple requests" so the browser skips the preflight `OPTIONS` that Apps
Script `/exec` does not answer usefully. The body is still JSON; only the
declared content type differs. Do not "fix" this to `application/json`.

## Alternate backend (kept working, not used by default)

**Supabase** — Postgres + auto-generated REST. Free tier is generous, but free
projects **pause after ~7 days of inactivity**, which is fatal for a tool used
in bursts. Adapter ships anyway in case real Postgres, real auth, or real
multi-user is wanted later.

- Supabase docs — https://supabase.com/docs
- JS client — https://supabase.com/docs/reference/javascript
- PostgREST (what the REST endpoints actually are) — https://postgrest.org/en/stable/
- Upsert via `Prefer: resolution=merge-duplicates` + explicit
  `on_conflict=user_id,module_id` in the query string.

Table used by the adapter:

```sql
create table workspace_states (
  id          bigint generated always as identity primary key,
  user_id     text        not null default 'default-user',
  module_id   text        not null,
  state       jsonb       not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, module_id)
);
```

The **anon** key is safe in the browser. The **service-role** key never is —
it must never be committed or shipped to the client.

## Hosting

- GitHub Pages — https://docs.github.com/pages
- Free accounts serve Pages from **public** repos only. Private-repo Pages
  requires a paid plan.
- HTTPS is required for service workers (and therefore for a real "Add to Home
  Screen" install). `python3 -m http.server` over LAN is fine for development
  but will not give a proper PWA install.

## PWA specifics

- Web app manifest — https://developer.mozilla.org/en-US/docs/Web/Manifest
- Service worker API — https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- Safari on iOS honors `apple-mobile-web-app-capable` and
  `apple-mobile-web-app-status-bar-style`; `viewport-fit=cover` plus
  `env(safe-area-inset-*)` is what keeps content clear of the notch and the home
  indicator.

## How this app is meant to be used

- **Drop in different HTML views and wire them to modules.** The shell does not
  care what a module represents — only that it has a type with a renderer.
- **Use one data model across all devices.** Every app, every module, every
  device writes `(app_id, key) → JSON value + updated_at` to the same backend.
  Learn that one shape and everything else follows.
