#!/bin/bash
# Packs extension/ into dist/thinstream-chrome-<version>.zip for a GitHub release
# or the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./extension/manifest.json').version")
OUT="dist/thinstream-chrome-$VERSION.zip"

mkdir -p dist
rm -f "$OUT"
(cd extension && zip -qr -X "../$OUT" . -x "*.DS_Store")
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
