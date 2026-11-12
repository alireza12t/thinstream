#!/bin/bash
# Packs extension/ for release.
#   dist/thinstream-chrome-<version>.zip    Chrome, Edge, Brave, Arc (and the Chrome Web Store)
#   dist/thinstream-firefox-<version>.zip   Firefox (and addons.mozilla.org)
#   dist/firefox/                           the unpacked Firefox build, for about:debugging
# The code is the same in both. Only the manifest differs: Firefox wants a background
# script instead of a service worker, plus its own add-on id.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./extension/manifest.json').version")
CHROME="dist/thinstream-chrome-$VERSION.zip"
FIREFOX="dist/thinstream-firefox-$VERSION.zip"

mkdir -p dist
rm -f "$CHROME" "$FIREFOX"

(cd extension && zip -qr -X "../$CHROME" . -x "*.DS_Store")
echo "Built $CHROME ($(du -h "$CHROME" | cut -f1))"

# Firefox: same files, patched manifest. Old build goes to the Trash, never deleted.
if [ -d dist/firefox ]; then mv dist/firefox "$HOME/.Trash/thinstream-firefox-build-$(date +%s)"; fi
mkdir -p dist/firefox
(cd extension && tar -cf - --exclude ".DS_Store" .) | (cd dist/firefox && tar -xf -)
node -e "
const fs = require('fs');
const file = 'dist/firefox/manifest.json';
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
m.background = { scripts: ['src/background.js'] };
m.browser_specific_settings = {
  gecko: {
    id: 'thinstream@alireza12t.github.io',
    strict_min_version: '140.0',
    data_collection_permissions: { required: ['none'] },
  },
};
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
"
(cd dist/firefox && zip -qr -X "../../$FIREFOX" . -x "*.DS_Store")
echo "Built $FIREFOX ($(du -h "$FIREFOX" | cut -f1))"
