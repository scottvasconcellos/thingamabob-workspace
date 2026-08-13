# Thing-a-ma-bob Workspace — Router
Last updated: 2026-08-13

## Identity

This repo is the **Thing-a-ma-bob Workspace**: an ICM-governed, HTML-first app
builder for Scott's own tools. It is a *shell*, not a product. Its job is to
host arbitrary small "thing-a-ma-bobs" — checklists, notes, counters, whatever —
render them on an iPhone and a Mac, and keep their state in sync between the two.

The app itself is deliberately ignorant of what any module *means*. It only knows
that modules are declared in a config file, that each has a type, that each type
has a renderer, and that state gets saved.

## Behavior

- **The LLM is stateless compute.** No knowledge lives in a chat history, a
  model's memory, or anyone's head. Every durable fact lives in a file here.
- **Any agent — Claude, Cursor, Codex — reads these files and is caught up.**
  If something had to be explained in chat, it belongs in a file instead.
- **No frameworks, no build step.** The app runs by opening it from a static
  server. If a change would require `npm install` to view the app, it is the
  wrong change.

## The three ICM files

| File | Holds | Changes |
|---|---|---|
| **CLAUDE.md** (this file) | Identity, behavior rules, routing table, IOM guarantees | Rarely |
| **CONTEXT.md** | Current project scope, what "good work" means here, known failure modes and anti-patterns to avoid | At milestones |
| **REFERENCES.md** | Manuals, external docs, links, examples — static background knowledge | Occasionally |

Read CONTEXT.md before changing app behavior. Read REFERENCES.md before touching
the sync layer or the backend.

## Routing table

| Task | Go to | Read first |
|---|---|---|
| Add a thing-a-ma-bob (new module) | `app/modules.config.json` | `app/README-app.md` |
| Add a new module *type* | `app/app.js` → `RENDERERS` | `app/README-app.md` |
| Change look/layout | `app/style.css` | CONTEXT.md (layout stability rules) |
| Change how state saves/syncs | `app/sync/tmb-sync.js` | REFERENCES.md, CONTEXT.md |
| Point at a different backend | `app/sync/config.js` | REFERENCES.md |
| Change what gets cached offline | `app/sw.js` | — |
| Set up from scratch / deploy | `README.md` | — |

## Key locations

- `app/index.html` — the shell: header, status pill, module picker, `<main>`.
- `app/app.js` — config loading, module rendering, user interaction.
- `app/sync/tmb-sync.js` — the portable sync layer. **This file is a drop-in**;
  the same file is installed into other repos by the `/make-it-sync` skill.
  Keep it self-contained — it must never depend on anything else in this repo.
- `app/modules.config.json` — the thing-a-ma-bob registry.

## Session resume checklist

1. `CONTEXT.md` — what this is for and what not to do.
2. `app/README-app.md` — how modules and renderers fit together.
3. `LESSONS.md` — what was already learned the hard way.

<!-- IOM -->
## IOM — Operations Guarantees (machine-enforced)
This repo is governed by IOM (manual: ~/Documents/My Digital Library/Distills:AI Research/iom-operations-methodology/IOM-manual.md).
- Smoke test: `bash tests/smoke_test.sh` (must pass before any session ends)
- No session ends with unsaved work: run the wrap-up ritual (tests → regression tests for fixes → plain-English commit → LESSONS.md line → .iom/status)
- Bug reports: gather evidence yourself — this is a browser app, so read the DevTools console and the Network tab (or drive it with the browser tool); never ask Scott for tracebacks
- Dependency pinning: N/A by design — this app has zero dependencies and no build step. If that ever stops being true, it is a change worth arguing about first.
- Logs live at: the browser DevTools console (the sync layer logs every failure there and mirrors its state to the header status pill) · Logbook: LESSONS.md
<!-- /IOM -->
