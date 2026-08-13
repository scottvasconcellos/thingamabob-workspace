/*
 * tmb-sync.js — portable cross-device state sync for plain HTML apps.
 *
 * THIS FILE IS A DROP-IN. The same copy is installed into other repos by the
 * /make-it-sync skill, so it must never depend on anything outside this folder.
 *
 * It gives you:
 *   TMB.get(key)            -> value (from local state, always instant)
 *   TMB.set(key, value)     -> saves locally now, pushes to backend shortly
 *   TMB.keys()              -> array of known keys
 *   TMB.status              -> 'local' | 'syncing' | 'synced' | 'error'
 *   TMB.pull()              -> force a refresh from the backend
 *   window event 'tmb:updated' -> remote brought newer data ({detail:{keys}})
 *   window event 'tmb:status'  -> status changed ({detail:{status, message}})
 *
 * Two modes, set in config.js:
 *   mode: 'explicit' — the app calls TMB.get/TMB.set itself.
 *   mode: 'mirror'   — the app keeps using localStorage exactly as it always
 *                      did, and we mirror it to the backend transparently.
 *
 * Rules it follows, deliberately:
 *   - Never block rendering on the network. Local state boots instantly.
 *   - Never fail silently. Every problem goes to the console AND the status.
 *   - Last write wins, compared on updated_at. Fine for one person; do not
 *     grow this into a CRDT.
 */
(function (global) {
  'use strict';

  var CFG = global.TMB_CONFIG || {};
  var APP_ID = CFG.appId || 'tmb-app';
  var MODE = CFG.mode === 'mirror' ? 'mirror' : 'explicit';
  var PREFIX = 'thingamabob_state_';
  var DEBOUNCE_MS = 600;

  // ---------------------------------------------------------------- utilities

  function nowISO() { return new Date().toISOString(); }

  function log(msg, err) {
    if (err) { console.error('[tmb-sync] ' + msg, err); }
    else { console.log('[tmb-sync] ' + msg); }
  }

  var status = 'local';
  var statusMessage = 'Local only';

  // Anything the app writes before the first pull has settled is "provisional":
  // on a fresh device most apps seed default state the moment they find empty
  // storage, stamped *now*, which would otherwise beat the real data coming
  // back from the backend and then overwrite it. Provisional keys never win a
  // conflict and are never pushed. See pull().
  var provisional = {};
  var firstPullDone = false;

  function setStatus(next, message) {
    status = next;
    statusMessage = message || next;
    API.status = next;
    API.statusMessage = statusMessage;
    try {
      global.dispatchEvent(new CustomEvent('tmb:status', {
        detail: { status: next, message: statusMessage }
      }));
    } catch (e) { /* CustomEvent unavailable — not worth failing over */ }
  }

  // -------------------------------------------------------------- local store
  // Every value is stored wrapped as {v: <value>, t: <ISO timestamp>} so that
  // last-write-wins still works after the app has been offline.

  function localKey(key) { return PREFIX + key; }

  function readLocal(key) {
    var raw;
    try { raw = global.localStorage.getItem(localKey(key)); }
    catch (e) { log('localStorage unreadable', e); return null; }
    if (raw === null) return null;
    try {
      var parsed = JSON.parse(raw);
      // Tolerate values written before this layer existed, or by hand.
      if (parsed && typeof parsed === 'object' && 't' in parsed && 'v' in parsed) {
        return parsed;
      }
      return { v: parsed, t: '1970-01-01T00:00:00.000Z' };
    } catch (e) {
      return { v: raw, t: '1970-01-01T00:00:00.000Z' };
    }
  }

  function writeLocal(key, value, iso) {
    try {
      global.localStorage.setItem(localKey(key), JSON.stringify({ v: value, t: iso || nowISO() }));
      if (!firstPullDone) provisional[key] = true;
      return true;
    } catch (e) {
      log('could not write localStorage (quota or private mode?)', e);
      setStatus('error', 'Cannot save locally');
      return false;
    }
  }

  function localKeys() {
    var out = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
      }
    } catch (e) { log('localStorage unlistable', e); }
    return out;
  }

  // ----------------------------------------------------------------- adapters
  // An adapter is just: load(appId) -> Promise<{key: {value, updated_at}}>
  //                     save(appId, entries) -> Promise<void>

  var adapters = {};

  // Google Apps Script web app. POSTs use text/plain so the browser treats them
  // as "simple requests" and skips the CORS preflight that /exec won't answer.
  adapters['apps-script'] = {
    load: function (appId) {
      var url = CFG.endpoint + '?app=' + encodeURIComponent(appId) +
                '&secret=' + encodeURIComponent(CFG.secret || '');
      return fetch(url, { method: 'GET' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          if (data && data.error) throw new Error(data.error);
          return (data && data.keys) || {};
        });
    },
    save: function (appId, entries) {
      return fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ app: appId, secret: CFG.secret || '', entries: entries })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        if (data && data.error) throw new Error(data.error);
      });
    }
  };

  // Supabase / PostgREST. Not the default (free projects pause after ~7 days
  // idle) but kept working so the backend stays swappable.
  adapters.supabase = {
    load: function (appId) {
      var url = CFG.endpoint.replace(/\/$/, '') +
        '/rest/v1/workspace_states?user_id=eq.' + encodeURIComponent(appId) +
        '&select=module_id,state,updated_at';
      return fetch(url, {
        headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey }
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (rows) {
        var out = {};
        (rows || []).forEach(function (row) {
          out[row.module_id] = { value: row.state, updated_at: row.updated_at };
        });
        return out;
      });
    },
    save: function (appId, entries) {
      var url = CFG.endpoint.replace(/\/$/, '') +
        '/rest/v1/workspace_states?on_conflict=user_id,module_id';
      var body = entries.map(function (e) {
        return { user_id: appId, module_id: e.key, state: e.value, updated_at: e.updated_at };
      });
      return fetch(url, {
        method: 'POST',
        headers: {
          apikey: CFG.anonKey,
          Authorization: 'Bearer ' + CFG.anonKey,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
      });
    }
  };

  function configured() {
    if (!CFG.kind || !adapters[CFG.kind]) return false;
    if (CFG.kind === 'apps-script') {
      return !!CFG.endpoint && CFG.endpoint.indexOf('PASTE_') !== 0;
    }
    if (CFG.kind === 'supabase') {
      return !!CFG.endpoint && !!CFG.anonKey && CFG.endpoint.indexOf('PASTE_') !== 0;
    }
    return false;
  }

  var adapter = configured() ? adapters[CFG.kind] : null;

  // --------------------------------------------------------------- push queue

  var pending = {};     // key -> true, waiting to be pushed
  var pushTimer = null;

  function schedulePush() {
    if (!adapter) return;                 // local-only: nothing to push to
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, DEBOUNCE_MS);
  }

  function flush() {
    pushTimer = null;
    if (!adapter) return Promise.resolve();
    var keys = Object.keys(pending);
    if (!keys.length) return Promise.resolve();

    // Never push before the first pull has settled. On a fresh device the app
    // may have seeded default state, and uploading that first would overwrite
    // the real data still sitting in the backend.
    if (!firstPullDone) {
      schedulePush();
      return Promise.resolve();
    }

    var entries = keys.map(function (k) {
      var rec = readLocal(k) || { v: null, t: nowISO() };
      return { key: k, value: rec.v, updated_at: rec.t };
    });
    pending = {};
    setStatus('syncing', 'Syncing…');

    return adapter.save(APP_ID, entries).then(function () {
      setStatus('synced', 'Synced');
    }).catch(function (err) {
      // Put them back so the next change (or the next pull) retries them.
      entries.forEach(function (e) { pending[e.key] = true; });
      log('save failed — your changes are safe locally and will retry', err);
      setStatus('error', 'Sync failed — saved locally');
    });
  }

  // -------------------------------------------------------------------- pull

  var hydrated = false;

  function pull() {
    if (!adapter) {
      setStatus('local', 'Local only');
      return Promise.resolve({});
    }
    setStatus('syncing', 'Syncing…');
    return adapter.load(APP_ID).then(function (remote) {
      var changed = {};
      Object.keys(remote || {}).forEach(function (key) {
        var incoming = remote[key];
        if (!incoming) return;
        var mine = readLocal(key);

        // Provisional local values are seeded defaults, not history. Remote
        // wins regardless of timestamp, and we drop any queued push so the
        // defaults can never overwrite real data in the backend.
        if (provisional[key]) {
          delete pending[key];
        }

        // Otherwise last write wins. Ties go to local, so a device never
        // clobbers itself.
        if (!mine || provisional[key] ||
            (incoming.updated_at && incoming.updated_at > mine.t)) {
          writeLocal(key, incoming.value, incoming.updated_at);
          changed[key] = incoming.value;
        }
      });
      setStatus('synced', 'Synced');
      hydrated = true;
      firstPullDone = true;
      // Past the danger window: later writes are real edits, not seeded
      // defaults, so they push and win normally. Provisional keys the backend
      // had never heard of are still queued and get uploaded.
      provisional = {};

      var changedKeys = Object.keys(changed);
      if (changedKeys.length) {
        log('remote had newer data for: ' + changedKeys.join(', '));
        announce(changed);
      }
      return changed;
    }).catch(function (err) {
      log('could not reach the backend — running on local data', err);
      setStatus('error', 'Offline — local only');
      hydrated = true;
      firstPullDone = true;   // unblock pushes; offline must not mean stuck
      provisional = {};
      return {};
    });
  }

  // Tell the app that data changed underneath it. In explicit mode the app
  // listens and re-renders. In mirror mode most apps read localStorage once at
  // startup and never look again, so if nobody handled the event we reload the
  // page exactly once — guarded so it can never loop.
  function announce(changed) {
    var handled = false;
    try {
      var ev = new CustomEvent('tmb:updated', {
        detail: { keys: changed, handled: function () { handled = true; } },
        cancelable: true
      });
      handled = !global.dispatchEvent(ev) || handled;
    } catch (e) { /* ignore */ }

    if (MODE === 'mirror' && !handled) {
      var FLAG = 'tmb_reloaded_once';
      try {
        if (!global.sessionStorage.getItem(FLAG)) {
          global.sessionStorage.setItem(FLAG, '1');
          log('reloading once to pick up newer data from another device');
          global.location.reload();
        }
      } catch (e) { /* sessionStorage blocked — skip the reload, not worth it */ }
    }
  }

  // ---------------------------------------------------------------- mirror mode
  // Wrap localStorage so an existing app syncs without changing a line of its
  // own code. We only mirror keys the app already uses, and never our own.

  function installMirror() {
    var ls = global.localStorage;

    // Patch Storage.prototype, NOT the localStorage instance. Assigning
    // `localStorage.setItem = fn` does not override the method — Storage
    // objects treat unknown property writes as *stored keys*, so it silently
    // creates an entry called "setItem" and the wrapper never runs.
    var proto = Object.getPrototypeOf(ls);
    var nativeSet = proto.setItem;
    var nativeRemove = proto.removeItem;

    proto.setItem = function (key, value) {
      nativeSet.call(this, key, value);
      // sessionStorage shares this prototype — only mirror localStorage.
      if (this === ls && String(key).indexOf(PREFIX) !== 0) {
        writeLocal(key, value, nowISO());
        pending[key] = true;
        schedulePush();
      }
    };

    proto.removeItem = function (key) {
      nativeRemove.call(this, key);
      if (this === ls && String(key).indexOf(PREFIX) !== 0) {
        writeLocal(key, null, nowISO());
        pending[key] = true;
        schedulePush();
      }
    };

    // Seed our shadow copy from whatever the app already had stored, so the
    // first sync uploads existing state instead of wiping it.
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(PREFIX) !== 0 && readLocal(k) === null) {
          writeLocal(k, ls.getItem(k), nowISO());
          pending[k] = true;
        }
      }
    } catch (e) { log('could not seed mirror from existing localStorage', e); }

    // When remote wins in mirror mode, push the value back into the real
    // localStorage key the app actually reads.
    global.addEventListener('tmb:updated', function (ev) {
      var keys = (ev.detail && ev.detail.keys) || {};
      Object.keys(keys).forEach(function (k) {
        // Write through the native method so this does not re-queue a push.
        try { nativeSet.call(ls, k, keys[k]); } catch (e) { /* ignore */ }
      });
    });

    if (Object.keys(pending).length) schedulePush();
  }

  // ------------------------------------------------------------------- public

  var API = {
    appId: APP_ID,
    mode: MODE,
    status: status,
    statusMessage: statusMessage,
    configured: !!adapter,

    get: function (key) {
      var rec = readLocal(key);
      return rec ? rec.v : undefined;
    },

    set: function (key, value) {
      writeLocal(key, value, nowISO());
      pending[key] = true;
      schedulePush();
      return value;
    },

    keys: localKeys,
    pull: pull,
    flush: flush,

    // Resolves once the first pull has finished (or failed). The app does not
    // have to wait for this to render — it is here for tests and for callers
    // that genuinely want the settled state.
    ready: null
  };

  if (MODE === 'mirror') installMirror();

  if (!adapter) {
    log('no backend configured — running local-only. Fill in sync/config.js to sync across devices.');
    setStatus('local', 'Local only');
    API.ready = Promise.resolve({});
  } else {
    API.ready = pull();
    // Coming back to the app on a phone is the moment stale data hurts most.
    global.addEventListener('visibilitychange', function () {
      if (!global.document.hidden) pull();
    });
    global.addEventListener('online', function () { pull(); flush(); });
    // Last-ditch attempt to not lose a change when the tab goes away.
    global.addEventListener('pagehide', function () { flush(); });
  }

  global.TMB = API;
})(window);
