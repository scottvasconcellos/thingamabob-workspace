# CONTEXT — Thing-a-ma-bob Workspace
Last updated: 2026-08-13

## Purpose

A small, generic HTML workspace app used to host different checklist / module
UIs, all synced via a shared backend.

The real problem it solves: Scott has many started apps and none of them stick,
because state never followed him from the Mac to the iPhone. An app you can only
use at your desk is an app you stop using. So the point of this repo is *not*
the checklist — it is the sync layer plus the module registry, proven once here,
then reused everywhere else via the `/gimme-a-link` skill.

## What "good work" looks like here

1. **Clean, readable HTML/JS with no hidden magic.** Scott must be able to open
   any file in this repo and understand it without a tutorial. If a clever trick
   saves ten lines but costs an hour of "what does this do", it is not worth it.
2. **Easy module configuration by editing a single file.** Adding a
   thing-a-ma-bob means adding an object to `app/modules.config.json`. Nothing
   else. Adding a new *kind* of thing-a-ma-bob means adding one renderer
   function to `app/app.js` — core logic stays untouched.
3. **Reliable cross-device state sync.** Change it on the phone, see it on the
   Mac. Local state always works even when the network does not.
4. **Stable layout.** Checking a box or adding an item must not make the page
   jump, reflow, or zoom. On iPhone especially.

## Anti-patterns — things that have predictably killed versions of this before

- **Overcomplicated frameworks.** No React, Vue, Svelte, bundler, or build step.
  The moment this needs `npm install` to look at, it stops being adaptable and
  starts being a project. Vanilla JS or nothing.
- **Hard-coded, non-configurable modules.** If module details leak out of
  `modules.config.json` and into `app.js`, the registry is a lie and every new
  thing-a-ma-bob becomes a code change. Renderers may know about *types*; they
  must never know about specific module IDs.
- **Silent failures when sync breaks.** The worst outcome is an app that looks
  fine while quietly saving nothing. Every sync failure must be visible in two
  places: the console, and the status pill in the header. "It seemed to work"
  is the bug.
- **Blocking the UI on the network.** The app boots from local state
  immediately, always. Remote is an enhancement that arrives late, never a
  prerequisite for rendering.
- **Putting anything sensitive in a module.** See below.

## Deliberate constraints (decided, not accidental)

- **The app is publicly hosted and its credential is public.** GitHub Pages on a
  free account serves public repos only, and a static site fundamentally cannot
  hide a client-side key. `app/sync/config.js` is therefore committed on
  purpose. The shared secret is *obscurity, not security*: it stops casual
  drive-by writes, nothing more. Anyone with the URL and the file can read these
  checklists. **So nothing private, financial, medical, or otherwise sensitive
  goes into a thing-a-ma-bob.** That is the price of zero-friction hosting, and
  it was accepted knowingly.
- **Single user.** Everything is namespaced `(app_id, key)` under one implicit
  user. Real auth can come later; it is not pretended to exist now.
- **Last-write-wins.** Two devices editing the same key at the same moment means
  one of them loses. For a personal checklist this is correct and simple. Do not
  build CRDTs here.
- **Backend is swappable.** `tmb-sync.js` talks to an adapter, so the Apps
  Script backend can be replaced (with Supabase, or anything else) by changing
  `config.js` and one adapter — never by rewriting the app.

## Current state

Baseline scaffold: shell app, one example `checklist` module ("Today"), the
portable sync drop-in, IOM safety net, and the `/gimme-a-link` skill that
installs the same sync layer into Scott's other repos.
