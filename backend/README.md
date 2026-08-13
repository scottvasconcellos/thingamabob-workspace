# The shared sync backend

One deployment of `Code.gs` serves **every** thing-a-ma-bob app you ever make.
You do this once. After that, `/make-it-sync` wires up any new repo with no
setup at all.

It is free, it lives in your own Google account, and unlike a Supabase free
project it **never goes to sleep**.

## Setup — about 3 minutes, once

1. Go to **https://script.google.com/home/projects/create**
   (this is the Apps Script editor, not the Cloud Console — no billing, no
   project settings, nothing to enable).
2. Delete the placeholder `function myFunction() {}`.
3. Open `backend/Code.gs` from this repo, copy **all** of it, paste it in.
4. Rename the project (top-left) to **Thing-a-ma-bob Sync Backend**. Optional
   but you'll be glad later.
5. Click **Save** (the disk icon).
6. In the function dropdown pick **`setup`**, then click **Run**.
   - Google will ask for permission. It will warn that the app "isn't verified"
     — that is expected, because *you* are the developer and the app is yours.
     Click **Advanced → Go to Thing-a-ma-bob Sync Backend (unsafe)** → **Allow**.
   - This creates the storage Sheet in your Drive. Check
     **View → Logs** for its link.
7. Click **Deploy → New deployment**.
   - Gear icon → **Web app**
   - *Description*: anything
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**  ← required; without it your phone can't reach it
   - **Deploy**, then **Copy** the Web app URL. It ends in `/exec`.
8. Paste that URL into `app/sync/config.js` as `endpoint`.

The `secret` in `config.js` is already set to match `SHARED_SECRET` in
`Code.gs`. Leave both alone unless you're rotating it.

## Check it works

```bash
curl "PASTE_YOUR_EXEC_URL?app=test&secret=tmb-61zMv-xKvPfd4d7XLyw4k8s"
```

Expect `{"keys":{}}`. If you get HTML back, the deployment's access is not set
to **Anyone**. If you get `{"error":"bad secret"}`, the secret doesn't match.

## What "Anyone" actually means

The deployment is reachable by anyone who knows the URL, and the shared secret
is visible in the published `config.js`. Treat this as **unlisted, not
private** — good enough that nobody stumbles into it, not good enough for
anything you'd mind being read.

**So: no passwords, no medical notes, no financial details in a
thing-a-ma-bob.** That is the deliberate price of a free, zero-friction,
never-sleeping backend. See `../CONTEXT.md`.

To rotate the secret: change `SHARED_SECRET`, **Deploy → Manage deployments →
edit → New version**, then update `secret` in every app's `config.js`.

## Updating the code later

Edit in the Apps Script editor, then **Deploy → Manage deployments → ✏️ →
Version: New version → Deploy**. If you skip the new version, the live URL
keeps running the old code — this is the single most common Apps Script
gotcha.

## Data layout

The Sheet has one row per key:

| app_id | key | value (JSON) | updated_at (ISO 8601) |
|---|---|---|---|
| `thingamabob-workspace` | `today-checklist` | `{"items":[…]}` | `2026-08-13T18:22:01.004Z` |

`app_id` comes from `appId` in each app's `config.js`. Conflicts resolve
last-write-wins on `updated_at`; writes are serialized with `LockService` so
two devices saving simultaneously can't corrupt a row.

You can hand-edit the Sheet. Keep `value` valid JSON and bump `updated_at` to
something later than what your devices have, or your edit will be overwritten.

## Why not Supabase?

The adapter is there and works (`kind: 'supabase'` in `config.js`) if you ever
want real Postgres or real auth. It isn't the default because free Supabase
projects pause after about a week idle, and a tool you use in bursts is exactly
the tool that will be asleep when you reach for it.

## Why couldn't Claude just set this up?

It tried. Creating the script programmatically needs the **Apps Script API**
and **Sheets API** enabled on the Google Cloud project behind the MCP
connector (project `381788436709`), and both are currently disabled. Enabling
them is a Cloud Console click only you can make. Pasting the file into the
Apps Script editor is faster than that, which is why these instructions take
the manual route.
