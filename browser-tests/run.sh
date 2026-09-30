#!/usr/bin/env bash
# Runs the plugin's DOM layer in headless Chromium against a fixture that copies
# Stremio's streams-list markup. Needs chromium (or set CHROMIUM=/path/to/browser).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
browser="${CHROMIUM:-$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)}"
[ -n "$browser" ] || { echo "chromium not found (set CHROMIUM=...)"; exit 2; }

dom="$(timeout 90 "$browser" --headless=new --no-sandbox --disable-gpu \
  --allow-file-access-from-files --virtual-time-budget=20000 \
  --dump-dom "file://$here/fixture.html" 2>/dev/null || true)"

# The results are written into <pre id="out">RESULTS ... END</pre>; unwrap and unescape.
out="$(printf '%s\n' "$dom" | awk '/RESULTS/{p=1} p{print} /^END/{p=0}' \
  | sed -e 's/^<pre id="out">//' -e 's/&gt;/>/g' -e 's/&lt;/</g' -e 's/&amp;/\&/g')"

printf '%s\n' "$out" | cut -c1-140
printf '%s\n' "$out" | grep -q '^END' || { echo "no results produced"; exit 1; }
if printf '%s\n' "$out" | grep -qE '^(FAIL|ERROR)'; then exit 1; fi
echo "browser tests OK"
