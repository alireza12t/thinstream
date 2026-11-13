#!/bin/sh
# Upload Thinstream's icon and screenshots to its addons.mozilla.org listing.
# Run from anywhere: sh scripts/amo-media.sh
# Paste the JWT issuer and secret from https://addons.mozilla.org/developers/addon/api/key/
# when asked. They're read silently, kept in the environment of this run only, never saved.
set -e
cd "$(dirname "$0")/.."
ADDON="thinstream@alireza12t.github.io"
API="https://addons.mozilla.org/api/v5/addons/addon/$ADDON"
printf "AMO JWT issuer: "; stty -echo; read AMO_KEY; stty echo; echo
printf "AMO JWT secret: "; stty -echo; read AMO_SECRET; stty echo; echo
export AMO_KEY AMO_SECRET
token() {
  python3 -I -c '
import base64, hashlib, hmac, json, os, time, uuid
b = lambda d: base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).rstrip(b"=")
now = int(time.time())
msg = b({"alg": "HS256", "typ": "JWT"}) + b"." + b({"iss": os.environ["AMO_KEY"], "jti": str(uuid.uuid4()), "iat": now, "exp": now + 60})
sig = base64.urlsafe_b64encode(hmac.new(os.environ["AMO_SECRET"].encode(), msg, hashlib.sha256).digest()).rstrip(b"=")
print((msg + b"." + sig).decode())'
}
ICON=$(mktemp -t thinstream-icon).png
sips -z 128 128 assets/logo-512.png --out "$ICON" >/dev/null
echo "Icon..."
curl -fsS -X PATCH -H "Authorization: JWT $(token)" -F "icon=@$ICON;type=image/png" "$API/" -o /dev/null
rm -f "$ICON"
pos=0
for img in assets/screenshot.png assets/popup.png; do
  echo "Screenshot $img..."
  curl -fsS -X POST -H "Authorization: JWT $(token)" -F "image=@$img;type=image/png" -F "position=$pos" "$API/previews/" -o /dev/null
  pos=$((pos + 1))
done
echo "Done. Check https://addons.mozilla.org/en-US/developers/addon/thinstream-listen-mode-for-you/edit"
