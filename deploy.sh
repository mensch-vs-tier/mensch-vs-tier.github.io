#!/bin/zsh
# Lädt die App auf GitHub (mensch-vs-tier.github.io) und auf Netlify hoch.
# Aufruf im Projektordner:  ./deploy.sh "Was geändert wurde"
set -e
cd "$(dirname "$0")"

MSG="${1:-Update}"

# Service-Worker-Version hochzählen, damit Handys die neue Version laden
CUR=$(grep -o "mensch-vs-tier-v[0-9]*" sw.js | grep -o "[0-9]*$")
NEXT=$((CUR + 1))
sed -i '' "s/mensch-vs-tier-v$CUR/mensch-vs-tier-v$NEXT/" sw.js
echo "Service Worker: v$CUR -> v$NEXT"

# GitHub
git add -A
git commit -q -m "$MSG" && git push -q && echo "GitHub: hochgeladen"

# Netlify: nur die App-Dateien, ohne .git und Hilfsdateien
TMP=$(mktemp -d)
rsync -a --exclude .git --exclude .netlify --exclude .gitignore --exclude .DS_Store \
  --exclude deploy.sh --exclude README.md ./ "$TMP/"
netlify deploy --prod --no-build --dir "$TMP" | grep -E "Production URL|Error" || true
rm -rf "$TMP"
echo "Fertig: https://mensch-vs-tier.github.io (und https://mensch-vs-tier.netlify.app)"
