#!/usr/bin/env bash
# Runs the plugin's DOM layer in headless Chromium against a fixture that copies
# Stremio's streams-list markup. Needs chromium (or set CHROMIUM=/path/to/browser).
# Runs twice: once with the StremioEnhancedAPI stub and once without (?nostub).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
browser="${CHROMIUM:-$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)}"
[ -n "$browser" ] || { echo "chromium not found (set CHROMIUM=...)"; exit 2; }

run_case() {
  local name="$1" url="$2" dom out
  dom="$(timeout 90 "$browser" --headless=new --no-sandbox --disable-gpu \
    --allow-file-access-from-files --virtual-time-budget=20000 \
    --dump-dom "$url" 2>/dev/null || true)"

  # The results are written into <pre id="out">RESULTS ... END</pre>; unwrap and unescape.
  out="$(printf '%s\n' "$dom" | awk '/RESULTS/{p=1} p{print} /^END/{p=0}' \
    | sed -e 's/^<pre id="out">//' -e 's/&gt;/>/g' -e 's/&lt;/</g' -e 's/&amp;/\&/g')"

  echo "== $name =="
  printf '%s\n' "$out" | cut -c1-140
  printf '%s\n' "$out" | grep -q '^END' || { echo "no results produced ($name)"; return 1; }
  if printf '%s\n' "$out" | grep -qE '^(FAIL|ERROR)'; then return 1; fi
  return 0
}

status=0
run_case "stub" "file://$here/fixture.html" || status=1
run_case "nostub" "file://$here/fixture.html?nostub" || status=1
[ "$status" -eq 0 ] || exit 1
echo "browser tests OK"
