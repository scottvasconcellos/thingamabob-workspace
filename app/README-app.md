# The app itself

Usage notes for the front end. Setup and deployment live in the repo root
`README.md`; the "why" lives in `../CONTEXT.md`.

## Files

| File | What it does |
|---|---|
| `index.html` | The shell: header, status pill, module picker, `<main>`. |
| `style.css` | All the styling. Dark, big tap targets, no animation. |
| `app.js` | Loads the registry, renders modules, handles interaction. |
| `modules.config.json` | **The thing-a-ma-bob registry.** Edit this to add modules. |
| `sync/tmb-sync.js` | Portable sync layer. Also installed in other repos — keep it self-contained. |
| `sync/config.js` | Which backend, which app namespace, which mode. |
| `sw.js` | Service worker: makes the app open offline. Must stay beside `index.html` — from `sync/` its scope could not cover the page. |

## Adding a thing-a-ma-bob

Add an object to `modules.config.json`:

```json
{
  "id": "packing-list",
  "type": "checklist",
  "title": "Packing",
  "description": "What goes in the bag",
  "allowAddItems": true,
  "fields": [
    { "id": "passport", "label": "Passport", "defaultDone": false },
    { "id": "charger",  "label": "Charger",  "defaultDone": false }
  ]
}
```

Reload. It appears in the picker with its own independent, synced state.

**Required keys:** `id`, `type`, `title`. `id` must be unique and stable —
it is the storage key, so renaming it orphans that module's saved state.

### Built-in types

The quickest way to add any of these is to run `/make-it-sync` and say what you
want — it edits the registry for you. To do it by hand:

| Type | Options |
|---|---|
| `checklist` | `fields` seeds initial items; `allowAddItems: false` hides the add box |
| `note` | `rows` (default 12), `placeholder`. Saves 400ms after you stop typing, and on blur. |
| `counter` | `start` (0), `step` (1), `min`, `max`, `allowReset: false` |

```json
{ "id": "scratch", "type": "note", "title": "Scratch", "rows": 8 },
{ "id": "water", "type": "counter", "title": "Water", "min": 0 }
```

### How config fields and saved state interact

Config fields are **seeds, not law**. Each field is added to the list once, then
its id is recorded in `state.seeded`. After that the saved list is authoritative:

- Delete an item → it stays deleted, even though it's still in the config.
- Add a new field to the config later → it appears, because its id is unseen.
- Change a field's `label` in the config → existing lists keep the old text, since
  the item already exists. Delete the item to have it re-seeded.

## Adding a new module *type*

Three steps, all in this folder:

1. Write a renderer in `app.js`, following `renderChecklistModule`:

   ```js
   function renderNoteModule(module, state, save) {
     var box = document.createElement('textarea');
     box.value = state.text || '';
     box.addEventListener('input', function () {
       state.text = box.value;
       save(state);          // persists locally + syncs
     });
     return box;
   }
   ```

2. Register it: `var RENDERERS = { checklist: …, note: renderNoteModule };`

3. Use `"type": "note"` in `modules.config.json`.

Nothing else changes. An unrecognized type renders a visible error panel rather
than a blank screen, so a typo is obvious.

A renderer receives `(module, state, save)` and returns a DOM node or fragment.
Call `save(state)` whenever something changes — it writes to localStorage
immediately and schedules a background push to the backend.

## The sync layer

```js
TMB.get(key)      // read (instant, from local state)
TMB.set(key, val) // save locally now, push shortly
TMB.pull()        // force a refresh from the backend
TMB.status        // 'local' | 'syncing' | 'synced' | 'error'
TMB.ready         // promise resolving after the first pull settles
```

Events on `window`:
- `tmb:updated` — remote had newer data. `app.js` re-renders and calls
  `ev.detail.handled()`.
- `tmb:status` — status changed; drives the header pill.

**It never blocks rendering on the network.** The app boots from localStorage
instantly and remote data arrives later. If the backend is unreachable the pill
reads `Offline — local only` and everything keeps working; changes are retried.

If `sync/config.js` still has a `PASTE_…` endpoint, the app makes no network
calls at all and the pill reads `Local only`. That is a valid way to use it.

## Testing it on a phone before deploying

`python3 -m http.server` from this folder and visiting the Mac's LAN IP works
for checking layout, but **not** for a real install — service workers and
"Add to Home Screen" need HTTPS. Deploy to GitHub Pages for the real thing.
