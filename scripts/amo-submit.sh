#!/bin/sh
# Submit the Firefox build to addons.mozilla.org as a listed (public) add-on.
# Run from anywhere: sh scripts/amo-submit.sh
# 1. Sign in at https://addons.mozilla.org/developers/ (free, needs two-factor).
# 2. Open https://addons.mozilla.org/developers/addon/api/key/ and generate credentials.
# 3. Run this and paste the JWT issuer and secret when asked. They're read silently,
#    saved in the macOS Keychain for next time, and never printed or written to a file.
set -e
cd "$(dirname "$0")/.."
[ -f dist/firefox/manifest.json ] || sh scripts/build.sh
META=$(mktemp -t amo-metadata).json
python3 -I - "$META" <<'PY'
import json, sys
licence = open("LICENSE.md", encoding="utf-8").read()
desc = """Thinstream adds a Listen mode button to the YouTube player. Turn it on and the video drops to 144p and stays there, the picture is hidden, and a transcript fills the player and follows the audio. You can copy the transcript or save it as a text file.

It's for hotel wifi, trains, phone hotspots and data caps. On a 10 minute test video, 144p used about 15 MB instead of 66 to 97 MB at 720p.

- Works with every caption track the video has, including auto generated ones and right to left languages
- Puts your normal quality back when you turn it off
- Makes no network requests of its own and collects nothing

Free for any noncommercial use. Source: https://github.com/alireza12t/thinstream"""
meta = {
    "categories": {"firefox": ["photos-music-videos"]},
    "summary": {"en-US": "Listen to YouTube and read the transcript on slow internet. One click holds the video at 144p, hides it, and shows a transcript that follows the audio. No account, no tracking."},
    "description": {"en-US": desc},
    "homepage": {"en-US": "https://alireza12t.github.io/thinstream/"},
    "support_url": {"en-US": "https://github.com/alireza12t/thinstream/issues"},
    "tags": ["youtube", "music", "streaming"],
    "version": {"custom_license": {"name": {"en-US": "PolyForm Noncommercial 1.0.0"}, "text": {"en-US": licence}}},
}
json.dump(meta, open(sys.argv[1], "w"))
PY
# The keys live in the macOS Keychain (login keychain), nowhere else. First run asks
# for them and saves them; later runs read them back. They are never printed.
# After regenerating the keys at Mozilla: sh scripts/amo-submit.sh --reset
if [ "${1:-}" = "--reset" ]; then
  security delete-generic-password -s thinstream-amo-issuer >/dev/null 2>&1 || true
  security delete-generic-password -s thinstream-amo-secret >/dev/null 2>&1 || true
  echo "Saved Mozilla keys removed. You will be asked for the new ones."
fi
KEY=$(security find-generic-password -s thinstream-amo-issuer -w 2>/dev/null || true)
SECRET=$(security find-generic-password -s thinstream-amo-secret -w 2>/dev/null || true)
if [ -z "$KEY" ] || [ -z "$SECRET" ]; then
  printf "AMO JWT issuer: "; stty -echo; read KEY; stty echo; echo
  printf "AMO JWT secret: "; stty -echo; read SECRET; stty echo; echo
  case "$KEY$SECRET" in *[!A-Za-z0-9:_-]*|"") echo "That does not look like Mozilla keys. Nothing saved."; exit 1;; esac
  # Through stdin, so the secret never shows up in the process list.
  printf 'add-generic-password -U -a "%s" -s thinstream-amo-issuer -w "%s"\nadd-generic-password -U -a "%s" -s thinstream-amo-secret -w "%s"\n' \
    "$USER" "$KEY" "$USER" "$SECRET" | security -i >/dev/null
  echo "Keys saved in your Keychain as thinstream-amo-issuer and thinstream-amo-secret."
else
  echo "Using the Mozilla keys saved in your Keychain."
fi
WEB_EXT_API_KEY="$KEY" WEB_EXT_API_SECRET="$SECRET" npx -y web-ext@8 sign \
  --source-dir dist/firefox --artifacts-dir dist/amo \
  --channel listed --amo-metadata "$META" --approval-timeout 0
rm -f "$META"
echo "Submitted. Mozilla reviews listed add-ons, usually within a few days. Check https://addons.mozilla.org/developers/addons"
