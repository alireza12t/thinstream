#!/bin/bash
# One time publish: creates the public GitHub repo, sets description, topics and
# website, turns on GitHub Pages from docs/, and creates the release with the zip.
# Safe to run again: each step is skipped if it is already done.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="alireza12t/thinstream"
VERSION=$(node -p "require('./extension/manifest.json').version")
TAG="v$VERSION"
ZIP="dist/thinstream-chrome-$VERSION.zip"
FIREFOX_ZIP="dist/thinstream-firefox-$VERSION.zip"
DESC="Listen to YouTube and read the transcript on slow internet. Free Chrome, Firefox and Safari extension: holds video at 144p, hides it, shows a synced transcript."

./scripts/build.sh

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source . --remote origin --description "$DESC"
fi
git push -u origin main
git push origin "$TAG"

gh repo edit "$REPO" \
  --description "$DESC" \
  --homepage "https://alireza12t.github.io/thinstream/" \
  --add-topic youtube --add-topic chrome-extension --add-topic safari-extension \
  --add-topic browser-extension --add-topic youtube-transcript --add-topic audio-only \
  --add-topic data-saver --add-topic low-bandwidth --add-topic slow-internet \
  --add-topic transcript --add-topic manifest-v3 --add-topic accessibility \
  --add-topic youtube-extension --add-topic listen-mode --add-topic safari-web-extension \
  --add-topic firefox-addon --add-topic firefox-extension

if ! gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$REPO/pages" -f "source[branch]=main" -f "source[path]=/docs" >/dev/null
fi

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release create "$TAG" "$ZIP" "$FIREFOX_ZIP" --repo "$REPO" \
    --title "Thinstream $VERSION" \
    --notes-file scripts/release-notes.md
else
  # Release exists: add any zip it is missing, never replace one that is there.
  HAVE=$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')
  for f in "$ZIP" "$FIREFOX_ZIP"; do
    if ! echo "$HAVE" | grep -qx "$(basename "$f")"; then
      gh release upload "$TAG" "$f" --repo "$REPO"
    fi
  done
  gh release edit "$TAG" --repo "$REPO" --notes-file scripts/release-notes.md >/dev/null
fi

echo "Done: https://github.com/$REPO"
echo "Site: https://alireza12t.github.io/thinstream/ (takes a minute or two the first time)"
