# Mensch vs. Tier

Mobile-First Web-App: Wer gewinnt, du oder eines von 50 Tieren? Reines HTML/CSS/JS, kein Build, kein Backend, läuft offline (PWA).

## Lokal starten
```
cd mensch-vs-tier
python3 -m http.server 8000
```
Dann `http://localhost:8000` öffnen (am Handy im selben WLAN: `http://<Rechner-IP>:8000`). `index.html` per Doppelklick geht auch, nur ohne Service Worker.

## Aufs Handy
- **GitHub Pages:** Ordner in ein Repo legen, unter Settings > Pages den Branch `main` (Root) aktivieren.
- **Netlify Drop:** den Ordner auf https://app.netlify.com/drop ziehen, fertig.

## Zum Home-Bildschirm
- **iPhone (Safari):** Teilen-Symbol > "Zum Home-Bildschirm".
- **Android (Chrome):** Menü > "App installieren" bzw. "Zum Startbildschirm hinzufügen".

Nach Änderungen an Dateien in `sw.js` die Version `CACHE` hochzählen, damit der Cache erneuert wird.

*Unterhaltungs-Simulation, keine Sicherheitsberatung. Wildtieren immer ausweichen.*
