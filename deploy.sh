#!/bin/zsh
# Lädt die App auf GitHub hoch; GitHub Pages veröffentlicht sie unter
# https://mensch-vs-tier.github.io (dauert danach 1–2 Minuten).
# Aufruf im Projektordner:  ./deploy.sh "Was geändert wurde"
set -e
cd "$(dirname "$0")"

MSG="${1:-Update}"

# Service-Worker-Version hochzählen, damit Handys die neue Version laden
CUR=$(grep -o "mensch-vs-tier-v[0-9]*" sw.js | grep -o "[0-9]*$")
NEXT=$((CUR + 1))
sed -i '' "s/mensch-vs-tier-v$CUR/mensch-vs-tier-v$NEXT/" sw.js
echo "Service Worker: v$CUR -> v$NEXT"

git add -A
git commit -q -m "$MSG"
git push -q
echo "Hochgeladen. In 1–2 Minuten live: https://mensch-vs-tier.github.io"
