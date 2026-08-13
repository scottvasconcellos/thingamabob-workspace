# Thing-a-ma-bob Workspace

A small HTML app that holds whatever thing-a-ma-bob you need today — a
checklist, a note, a counter — on your phone and your Mac, with the same state
on both.

It is deliberately generic. The app doesn't care what a module *represents*; it
only cares that modules are declared in a config file and that state gets saved.
So you can drop a new kind of thing into it without rebuilding anything.

No frameworks. No build step. No `npm install`. Open the files and read them.

**Live:** https://scottvasconcellos.github.io/thingamabob-workspace/app/
(open that in **Safari** on the iPhone → Share → Add to Home Screen)

It works right now, saving locally on each device. It starts syncing between
them the moment you finish step 1 below.

---

## The 60-second version

```bash
cd "app" && python3 -m http.server 8000
```

Open http://localhost:8000. It works immediately, saving locally.
To make it sync between devices, do the backend setup below — once, ever.

---

## 1. Set up the backend (once, ~3 minutes)

Full instructions with screenshots-worth-of-detail: **[`backend/README.md`](backend/README.md)**

The short version:

1. New project at https://script.google.com/home/projects/create
2. Paste in all of [`backend/Code.gs`](backend/Code.gs), save
3. Run the `setup` function once and grant permission
   (it will warn the app "isn't verified" — that's you, click through)
4. **Deploy → New deployment → Web app**, *Execute as* **Me**,
   *Who has access* **Anyone**
5. Copy the `/exec` URL into `endpoint` in [`app/sync/config.js`](app/sync/config.js)

That's it. Free, in your own Google Drive, and it never sleeps.

**This same backend serves every app you ever make** — that's the whole point.
App number two doesn't repeat any of this.

### Alternative: Supabase

The adapter ships and works. Set `kind: 'supabase'` in `config.js` and provide
`endpoint` + `anonKey`, then create the table:

```sql
create table workspace_states (
  id          bigint generated always as identity primary key,
  user_id     text        not null default 'default-user',
  module_id   text        not null,
  state       jsonb       not null,
  updated_at  timestamptz not null default now(),
  unique (user_id, module_id)
);
alter table workspace_states enable row level security;
create policy "anon full access" on workspace_states for all
  to anon using (true) with check (true);
```

The **anon** key is fine in the browser. The **service-role** key is not, ever.
It must never be committed or shipped to the client.

Not the default because free Supabase projects pause after ~7 days idle.

### A word about the secret

This app is hosted publicly, and **a static site cannot hide a credential** —
anything the browser can read, a visitor can read. The shared secret in
`config.js` is therefore *unlisted, not private*. It keeps strangers from
stumbling in; it is not security.

**Don't put anything sensitive in a thing-a-ma-bob.** Checklists and notes,
yes. Passwords, medical details, financial information, no.

## 2. Run it locally

```bash
cd app && python3 -m http.server 8000
```

- On the Mac: http://localhost:8000
- On the iPhone (same wifi): `http://<your-mac-ip>:8000`
  — find the IP with `ipconfig getifaddr en0`

Good enough for checking layout. **Not** good enough for a real install:
"Add to Home Screen" and offline support need HTTPS.

## 3. Put it on your phone properly

Deploy to GitHub Pages (free, and you're already set up for it):

```bash
gh repo create thingamabob-workspace --public --source=. --push
gh api -X POST repos/:owner/thingamabob-workspace/pages -f "source[branch]=main" -f "source[path]=/"
```

Wait a minute, then open `https://<you>.github.io/thingamabob-workspace/app/`
on the iPhone in **Safari** (not Chrome — only Safari can install PWAs on iOS):

1. Tap the **Share** button
2. Scroll to **Add to Home Screen**
3. Launch it from the Home Screen — full screen, no browser chrome, works offline

Note Pages on a free account only serves **public** repos.

## 4. Add a new thing-a-ma-bob

**The easy way — just run this in the repo and say what you want:**

```
/make-it-sync
```

It edits the registry for you, and asks if anything's unclear. Built-in types
are `checklist`, `note`, and `counter`.

**By hand**, edit [`app/modules.config.json`](app/modules.config.json):

```json
{
  "id": "packing-list",
  "type": "checklist",
  "title": "Packing",
  "description": "What goes in the bag",
  "fields": [
    { "id": "passport", "label": "Passport", "defaultDone": false }
  ]
}
```

Reload. Done — it has its own synced state.

For a whole new *kind* of module (note, counter, timer), add one renderer
function to `app/app.js` and register it in `RENDERERS`. Details and a worked
example: [`app/README-app.md`](app/README-app.md).

## 5. Sync it into your *other* apps

This repo's sync layer is a drop-in. To put it in any other repo:

```
/make-it-sync
```

That skill finds the repo's HTML, installs the same `sync/` folder, wires up
the shared backend, and can deploy it to Pages. For apps that already use
`localStorage` it syncs them **without changing their code**.

## How IOM wraps this repo

This repo carries the `<!-- IOM -->` marker in `CLAUDE.md`, so it's covered by
your operations safety net:

- **`bash tests/smoke_test.sh`** — the key-turn check. Verifies the app's files
  exist, the module registry is valid JSON, the PWA meta tags are intact, the
  icons are real PNGs, and no credential-shaped string got committed. Runs in
  under a second.
- **`/wrap-up`** — run at the end of **every** session in here. Tests → a
  regression test for anything fixed → plain-English commit → a line in
  `LESSONS.md` → `.iom/status`.
- **`LESSONS.md`** — the logbook. One line per thing learned the hard way.
- **`.iom/status`** — last known health, written by the wrap-up. Local only,
  never committed.
- **`/checkup`** — reports on this app alongside your others.
- **`/fix`** — for when something breaks. It gathers the evidence itself.

## Where to look when something is confusing

| Question | File |
|---|---|
| What is this and how do I work on it? | `CLAUDE.md` |
| Why is it built this way? What should I avoid? | `CONTEXT.md` |
| Where are the manuals and docs? | `REFERENCES.md` |
| How do modules and renderers work? | `app/README-app.md` |
| How does the backend work? | `backend/README.md` |
| What went wrong before? | `LESSONS.md` |
