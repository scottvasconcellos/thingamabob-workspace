/*
 * Thing-a-ma-bob Workspace — core app.
 *
 * This file knows about three things and nothing else:
 *   1. loading the module registry (modules.config.json)
 *   2. showing a picker and rendering the selected module
 *   3. reading and writing module state through TMB (sync/tmb-sync.js)
 *
 * It deliberately knows nothing about any *specific* module. To add a new kind
 * of thing-a-ma-bob, write a renderer and register it in RENDERERS below —
 * everything above this line stays untouched.
 */
(function () {
  'use strict';

  var els = {
    status: document.getElementById('sync-status'),
    select: document.getElementById('module-select'),
    root: document.getElementById('module-root'),
    description: document.getElementById('module-description')
  };

  var modules = [];       // the registry, as loaded from modules.config.json
  var currentId = null;   // id of the module on screen

  var SELECTED_KEY = 'ui.selectedModule';

  // ===========================================================================
  // RENDERERS — one per module "type". This is the extension point.
  // ===========================================================================

  var RENDERERS = {
    checklist: renderChecklistModule

    // To add a new type, e.g. "note":
    //   1. add   note: renderNoteModule   to this map
    //   2. write the function below, following renderChecklistModule's shape:
    //        function renderNoteModule(module, state, save) {
    //          // build DOM into a container, call save(newState) on change,
    //          // and return the container element.
    //        }
    //   3. add a module with "type": "note" to modules.config.json
    // Nothing else in this file needs to change.
  };

  // ===========================================================================
  // State: defaults from config, overlaid with whatever has been saved.
  // ===========================================================================

  // Config fields seed the list once. After that the saved list is the truth,
  // so an item you deleted stays deleted instead of reappearing on reload,
  // while genuinely new fields added to the config still show up.
  function stateForModule(module) {
    var saved = TMB.get(module.id);
    var state = (saved && typeof saved === 'object') ? saved : {};

    if (!Array.isArray(state.items)) state.items = [];
    if (!Array.isArray(state.seeded)) state.seeded = [];

    (module.fields || []).forEach(function (field) {
      if (state.seeded.indexOf(field.id) === -1) {
        state.items.push({
          id: field.id,
          label: field.label,
          done: !!field.defaultDone
        });
        state.seeded.push(field.id);
      }
    });

    return state;
  }

  function saverFor(moduleId) {
    return function save(state) {
      TMB.set(moduleId, state);
    };
  }

  // ===========================================================================
  // Checklist renderer
  // ===========================================================================

  function renderChecklistModule(module, state, save) {
    var frag = document.createDocumentFragment();

    if (!state.items.length) {
      var empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'Nothing here yet.';
      frag.appendChild(empty);
    }

    state.items.forEach(function (item) {
      frag.appendChild(checklistRow(item, state, save));
    });

    if (module.allowAddItems !== false) {
      frag.appendChild(addItemRow(state, save));
    }

    return frag;
  }

  function checklistRow(item, state, save) {
    var row = document.createElement('label');
    row.className = 'check-row' + (item.done ? ' is-done' : '');

    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!item.done;
    box.addEventListener('change', function () {
      item.done = box.checked;
      row.classList.toggle('is-done', item.done);
      save(state);
    });

    var label = document.createElement('span');
    label.className = 'check-label';
    label.textContent = item.label;

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'row-delete';
    del.setAttribute('aria-label', 'Delete ' + item.label);
    del.textContent = '×';
    del.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var i = state.items.indexOf(item);
      if (i > -1) state.items.splice(i, 1);
      save(state);
      renderCurrent();
    });

    row.appendChild(box);
    row.appendChild(label);
    row.appendChild(del);
    return row;
  }

  function addItemRow(state, save) {
    var wrap = document.createElement('form');
    wrap.className = 'add-row';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add an item…';
    input.setAttribute('aria-label', 'New item');
    input.autocomplete = 'off';

    var button = document.createElement('button');
    button.type = 'submit';
    button.textContent = 'Add';

    wrap.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      state.items.push({
        id: 'item-' + Date.now().toString(36),
        label: text,
        done: false
      });
      save(state);
      input.value = '';
      renderCurrent();
      // Put focus back so several items can be added in a row.
      var next = els.root.querySelector('.add-row input[type="text"]');
      if (next) next.focus();
    });

    wrap.appendChild(input);
    wrap.appendChild(button);
    return wrap;
  }

  // ===========================================================================
  // Shell: picker + rendering
  // ===========================================================================

  function buildSelector() {
    els.select.textContent = '';
    modules.forEach(function (module) {
      var opt = document.createElement('option');
      opt.value = module.id;
      opt.textContent = module.title || module.id;
      els.select.appendChild(opt);
    });
    els.select.addEventListener('change', function () {
      currentId = els.select.value;
      TMB.set(SELECTED_KEY, currentId);
      renderCurrent();
    });
  }

  function renderCurrent() {
    var module = modules.filter(function (m) { return m.id === currentId; })[0];
    els.root.textContent = '';

    if (!module) {
      els.description.textContent = '';
      return;
    }

    els.description.textContent = module.description || '';

    var title = document.createElement('h2');
    title.className = 'module-title';
    title.textContent = module.title || module.id;
    els.root.appendChild(title);

    var renderer = RENDERERS[module.type];
    if (!renderer) {
      // Loud, not blank. An unknown type is a config mistake worth seeing.
      var err = document.createElement('div');
      err.className = 'module-error';
      err.innerHTML = 'No renderer for type <code></code>.';
      err.querySelector('code').textContent = String(module.type);
      err.appendChild(document.createTextNode(
        ' Add one to RENDERERS in app.js.'
      ));
      els.root.appendChild(err);
      return;
    }

    var state = stateForModule(module);
    els.root.appendChild(renderer(module, state, saverFor(module.id)));
  }

  // ===========================================================================
  // Sync status pill
  // ===========================================================================

  var STATUS_CLASS = {
    local: 'status-pill status-local',
    syncing: 'status-pill status-syncing',
    synced: 'status-pill status-synced',
    error: 'status-pill status-error'
  };

  function paintStatus(status, message) {
    els.status.className = STATUS_CLASS[status] || STATUS_CLASS.local;
    els.status.textContent = message || status;
  }

  window.addEventListener('tmb:status', function (ev) {
    paintStatus(ev.detail.status, ev.detail.message);
  });

  // Another device changed something. Re-render and tell the sync layer we
  // handled it, so it does not fall back to reloading the page.
  window.addEventListener('tmb:updated', function (ev) {
    if (ev.detail && typeof ev.detail.handled === 'function') ev.detail.handled();
    renderCurrent();
  });

  // ===========================================================================
  // Boot
  // ===========================================================================

  function boot() {
    paintStatus(TMB.status, TMB.statusMessage);

    fetch('modules.config.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (config) {
        if (!Array.isArray(config) || !config.length) {
          throw new Error('modules.config.json must be a non-empty array');
        }
        modules = config;
        buildSelector();

        var remembered = TMB.get(SELECTED_KEY);
        var known = modules.some(function (m) { return m.id === remembered; });
        currentId = known ? remembered : modules[0].id;
        els.select.value = currentId;

        renderCurrent();
      })
      .catch(function (err) {
        console.error('[app] could not load modules.config.json', err);
        els.root.textContent = '';
        var box = document.createElement('div');
        box.className = 'module-error';
        box.textContent = 'Could not load modules.config.json — ' + err.message;
        els.root.appendChild(box);
      });
  }

  boot();

  // Service worker: only where it can actually work (https, or localhost during
  // development). Failing to register is not worth breaking the app over.
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      // sw.js lives beside index.html on purpose — see the note at the top of
      // that file. From sync/ it could not control the page.
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('[app] service worker did not register', err);
      });
    });
  }
})();
