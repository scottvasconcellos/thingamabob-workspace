#!/usr/bin/env bash
# IOM smoke test for the Thing-a-ma-bob Workspace.
#
# Fast, non-destructive "does it basically exist and hang together?" check.
# No server, no dependencies — this must stay runnable in under a second.
#
# Exit 0 = pass, exit 1 = fail.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$REPO_ROOT/app"
fail=0

note() { echo "[smoke_test] $*"; }
bad()  { echo "[smoke_test] FAIL — $*"; fail=1; }

# 1. Every file the app needs must exist and be non-empty.
for f in \
  "$APP/index.html" \
  "$APP/style.css" \
  "$APP/app.js" \
  "$APP/modules.config.json" \
  "$APP/README-app.md" \
  "$APP/sync/tmb-sync.js" \
  "$APP/sync/config.js" \
  "$APP/sw.js" \
  "$APP/sync/manifest.webmanifest" \
  "$APP/sync/icons/icon-192.png" \
  "$APP/sync/icons/icon-512.png"
do
  if [ ! -s "$f" ]; then bad "missing or empty: ${f#$REPO_ROOT/}"; fi
done

# 2. The module registry must be valid JSON and a non-empty array, or the app
#    boots to an error panel.
if [ -s "$APP/modules.config.json" ]; then
  if ! python3 -c "
import json, sys
data = json.load(open('$APP/modules.config.json'))
assert isinstance(data, list), 'modules.config.json must be a JSON array'
assert data, 'modules.config.json must not be empty'
for m in data:
    for key in ('id', 'type', 'title'):
        assert key in m, 'module missing required key: ' + key
" 2>/tmp/tmb_json_err; then
    bad "modules.config.json invalid: $(cat /tmp/tmb_json_err | tail -1)"
  fi
fi

# 3. The manifest must be valid JSON too.
if [ -s "$APP/sync/manifest.webmanifest" ]; then
  if ! python3 -c "import json; json.load(open('$APP/sync/manifest.webmanifest'))" 2>/dev/null; then
    bad "manifest.webmanifest is not valid JSON"
  fi
fi

# 4. The bits that make it a stable, installable PWA are easy to delete by
#    accident, so assert they are still in the HTML.
if [ -s "$APP/index.html" ]; then
  grep -q 'user-scalable=no' "$APP/index.html"            || bad "viewport is missing user-scalable=no (page will pinch-zoom)"
  grep -q 'viewport-fit=cover' "$APP/index.html"          || bad "viewport is missing viewport-fit=cover (notch will clip)"
  grep -q 'manifest.webmanifest' "$APP/index.html"        || bad "no manifest link (cannot Add to Home Screen)"
  grep -q 'apple-mobile-web-app-capable' "$APP/index.html" || bad "missing apple-mobile-web-app-capable"
  # config.js must be loaded before tmb-sync.js, or the sync layer sees no config.
  cfg_line=$(grep -n 'sync/config.js' "$APP/index.html" | head -1 | cut -d: -f1 || echo 0)
  syn_line=$(grep -n 'sync/tmb-sync.js' "$APP/index.html" | head -1 | cut -d: -f1 || echo 0)
  if [ "$cfg_line" -eq 0 ] || [ "$syn_line" -eq 0 ] || [ "$cfg_line" -ge "$syn_line" ]; then
    bad "config.js must be loaded before tmb-sync.js in index.html"
  fi
fi

# 5. Icons must be real PNGs of the right size, not empty placeholders.
for spec in "192:$APP/sync/icons/icon-192.png" "512:$APP/sync/icons/icon-512.png"; do
  size="${spec%%:*}"; path="${spec#*:}"
  if [ -s "$path" ]; then
    if ! python3 -c "
import struct, sys
d = open('$path','rb').read(24)
assert d[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
w, h = struct.unpack('>II', d[16:24])
assert w == h == $size, 'expected ${size}x${size}, got %dx%d' % (w, h)
" 2>/dev/null; then
      bad "$(basename "$path") is not a valid ${size}x${size} PNG"
    fi
  fi
done

# 6. This repo is published publicly, so a real credential must never land in
#    it. Look for key-shaped *values* (JWTs, PEM blocks, .env files) rather than
#    the words — the docs discuss service-role keys on purpose.
if find "$REPO_ROOT" -name '.env' -o -name '.env.*' -o -name '*.pem' 2>/dev/null | grep -q .; then
  bad "a .env or .pem file is present — this repo gets published publicly"
fi
if grep -rIE --exclude-dir=.git --exclude-dir=.iom --exclude='smoke_test.sh' \
     -e 'eyJ[A-Za-z0-9_-]{30,}' -e 'BEGIN [A-Z ]*PRIVATE KEY' "$REPO_ROOT" 2>/dev/null | grep -q .; then
  bad "something shaped like a JWT or private key is committed — this repo is public"
fi

if [ "$fail" -ne 0 ]; then
  note "FAIL — see the lines above."
  exit 1
fi

note "PASS — app files present, module registry valid, PWA metas intact, icons real."
exit 0
