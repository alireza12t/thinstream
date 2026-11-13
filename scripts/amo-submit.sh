#!/bin/sh
# Submit the Firefox build to addons.mozilla.org as a listed (public) add-on.
# Run from anywhere: sh scripts/amo-submit.sh
# 1. Sign in at https://addons.mozilla.org/developers/ (free, needs two-factor).
# 2. Open https://addons.mozilla.org/developers/addon/api/key/ and generate credentials.
# 3. Run this and paste the JWT issuer and secret when asked. They're read silently,
#    passed through the environment and never saved or printed.
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
printf "AMO JWT issuer: "; stty -echo; read KEY; stty echo; echo
printf "AMO JWT secret: "; stty -echo; read SECRET; stty echo; echo
WEB_EXT_API_KEY="$KEY" WEB_EXT_API_SECRET="$SECRET" npx -y web-ext@8 sign \
  --source-dir dist/firefox --artifacts-dir dist/amo \
  --channel listed --amo-metadata "$META" --approval-timeout 0
rm -f "$META"
echo "Submitted. Mozilla reviews listed add-ons, usually within a few days. Check https://addons.mozilla.org/developers/addons"
