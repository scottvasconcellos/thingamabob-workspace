# LESSONS — Thing-a-ma-bob Workspace

The logbook. One line per thing learned the hard way, newest at the bottom.
Written in plain English so a cold reader (or a cold AI) gets the point without
re-deriving it.

- **2026-08-13 — Built the workspace.** Scaffolded the repo with ICM (CLAUDE.md
  router, CONTEXT.md, REFERENCES.md) and the IOM safety net (smoke test,
  LESSONS.md, `.iom/status`, registered for `/checkup`). The app is a plain
  HTML/CSS/JS PWA with a module registry (`app/modules.config.json`), one
  example `checklist` module, and a portable sync layer (`app/sync/tmb-sync.js`)
  that also ships as the `/gimme-a-link` skill for other repos. Backend is a
  Google Apps Script web app — free, in Scott's own Drive, and unlike a free
  Supabase project it never sleeps.

- **2026-08-13 — A service worker can only control its own folder and below.**
  `sw.js` was originally in `sync/` with everything else, which looked tidy and
  was useless: its scope was `/sync/`, so it could never handle `index.html` and
  the app would never have worked offline. It now lives beside `index.html`.
  Registration failed loudly in testing, which is the only reason this was
  caught before shipping.

- **2026-08-13 — You cannot override `localStorage.setItem` by assigning to it.**
  The mirror-mode wrapper did `localStorage.setItem = fn`. Storage objects treat
  unknown property writes as *stored keys*, so this silently created a junk
  entry literally named `setItem` and the wrapper never ran — sync appeared
  configured and did nothing. Fix: patch `Storage.prototype` instead, guarding
  on `this === localStorage` so `sessionStorage` is left alone.

- **2026-08-13 — Seeded defaults will eat your real data if you let them.**
  On a device with empty storage, most apps write default state immediately,
  stamped with the current time. That timestamp beats the older-but-real data
  coming back from the backend, so last-write-wins handed the win to the
  defaults — and then pushed them up, destroying the good copy for every other
  device. Fix: anything written before the first pull settles is "provisional" —
  it never wins a conflict and is never pushed. Found by simulating a fresh
  phone against a backend holding known-good data; it would not have shown up in
  any single-device test.

- **2026-08-13 — A static site cannot hide a credential.** GitHub Pages on a
  free account only serves public repos, and `config.js` has to ship to the
  browser to work at all. So `app/sync/config.js` is committed deliberately and
  its secret is *unlisted, not private*. The rule that falls out of this:
  nothing sensitive ever goes in a thing-a-ma-bob. Gitignoring the file would
  have broken the deployed app while providing no actual protection.

- **2026-08-13 — Added `note` and `counter` module types.** The app now ships
  three renderers, not one, so "add a thing-a-ma-bob" is usually a config edit
  with no new code at all. `stateForModule` only seeds `items`/`seeded` for
  checklists now — a note's state is just `{text}`, a counter's is `{count}`.
  Verified both by driving them in a browser: note text survives a reload, the
  counter clamps at `min`, and the picker remembers which module was open.

- **2026-08-13 — Nearly published a repo full of family and legal records.**
  Running the skill on another repo, an agent caught that free GitHub Pages
  serves public repos only, and that repo held 40 tracked files of family and
  legal records — kids' names, grade-placement reasoning, NOI filings. Two
  things came out of it. First, `gh repo create --source=.` publishes the entire
  *git history*, so deleting sensitive files before pushing does nothing; the
  only safe path is a fresh app-only repo with no history. Second, "be careful"
  is not a control: there is now a real scanner
  (`~/.claude/skills/gimme-a-link/assets/privacy_scan.py`) that the skill must
  run on the exact directory being published, and it blocks on credentials, IDs,
  MAC addresses, and sensitive filenames while flagging names, addresses, IPs,
  hostnames, and legal/medical/school references for a per-finding decision.
