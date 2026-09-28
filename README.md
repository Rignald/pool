# 🎱 Pool & Biljart Scoreboard & Match Timer

Een moderne, professionele scoreteller en timer webapplicatie voor **Pool (8-Ball & 9-Ball)** en **Biljart (Caramboles / Libre / Driebanden)**. Ontworpen om direct in de browser te werken én eenvoudig te installeren als een **Android App** (Progressive Web App / APK).

---

## ✨ Functies

- **📱 Touch & Klik Scorebord**:
  - Grote, kristalheldere cijfers (geoptimaliseerd voor zowel staand / portret op telefoons als liggend / landscape voor tablets naast de biljarttafel).
  - Tik direct op de score of gebruik de `+1` en `↶ Herstel` knoppen.
  - 🎱 **8-Ball Fouten**: Automatische registratie en strafpunt toekenning aan de tegenstander.
  - ⚪ **Speelbal Fout (Scratch)**: Witte bal van tafel of in de pocket telling.
  - **Krijtje (🪶)**: Direct de laatste actie herstellen.
- **⏱️ Match Timer**:
  - Aftellende wedstrijdklok (uren, minuten, seconden).
  - Handige presets (15 min, 30 min, 1 uur, 2 uur).
  - Waarschuwingsanimatie in de laatste minuut en 3-tonig eindsignaal.
  - Auto-reset functie bij een nieuw potje.
- **🏆 Toernooi & Competitiestand**:
  - Houdt bij wie hoeveel potjes ("racks") heeft gewonnen.
  - Instelbaar doel (bijv. "Eerste met 5 potjes" of "Best of 7").
  - Kampioenschapsviering met trofee en fanfares wanneer iemand het toernooi wint.
- **📊 Live Timeline & Geschiedenis**:
  - Realtime tijdlijn met echte biljartbal-kleuren (1 geel, 2 blauw, 3 rood, etc.).
  - Complete wedstrijdgeschiedenis met datum, scores en winnaar.
  - 📤 **Deel uitslag**: Deel direct de uitslag en stand via WhatsApp of kopieer naar het klembord.
- **🎵 Audio & Stem (100% Offline)**:
  - Gesynthetiseerde biljartbal-botsingen ("klak!"), foutsignalen en fanfares via de Web Audio API (geen externe bestanden nodig).
  - Optionele **Nederlandse stem-omroeper** via SpeechSynthesis ("Rignald 3, Shuhung 2").
- **💡 Android Scherm & Trillingen (Wake Lock & Haptics)**:
  - **Wake Lock**: Houdt het scherm van je telefoon automatisch aan zolang je speelt.
  - **Trillingen**: Voel een subtiele trilling bij elke score op Android.
- **🎨 Aanpasbare Spelers**:
  - Kies namen, 18 verschillende avatars / emoji's en kleurgradiënten per speler.

---

## 🚀 Hoe start je de app op je computer?

### Optie 1: Met 1 dubbelklik (Aanbevolen)
Dubbelklik op `start_app.bat`.
Dit start een lokale webserver op `http://localhost:8080/` en opent automatisch je browser.

### Optie 2: Direct in je browser openen
Dubbelklik op `index.html`. De app werkt direct in Chrome, Edge, Firefox en Safari.

---

## 📲 Hoe installeer je de app op Android?

De app is gebouwd als een **Progressive Web App (PWA)** volgens de Google Android standaarden.

### Manier 1: Direct installeren via Google Chrome op je telefoon
1. Zorg dat de bestanden online staan (zie hieronder bij "Online zetten") of open het IP-adres van je computer op je telefoon (bijv. `http://192.168.1.x:8080/`).
2. Open de link in **Google Chrome** of **Samsung Internet** op je Android telefoon.
3. Tik rechtsboven op de **drie puntjes (⋮)**.
4. Tik op **"Toevoegen aan startscherm"** of **"App installeren"**.
5. De app wordt nu geïnstalleerd met het officiële 🎱 logo en gedraagt zich als een volwaardige Android app (volledig scherm zonder adresbalk, offline beschikbaar).

---

## 📦 Hoe maak je hier een echte Android `.APK` van?

Wil je een los `.apk` installatiebestand of de app publiceren in de **Google Play Store**? Dat kan binnen 2 minuten via gratis tools:

### Methode A: PWABuilder (Aanbevolen van Microsoft & Google)
1. Zet de app gratis online (bijvoorbeeld via GitHub Pages of Firebase Hosting).
2. Ga naar [PWABuilder.com](https://www.pwabuilder.com/).
3. Vul je website-URL in en klik op **Start**.
4. PWABuilder valideert het meegeleverde `manifest.json` en de service worker `sw.js`.
5. Klik op **"Package for Android"**.
6. Je downloadt direct een kant-en-klaar **APK** bestand (om te sideloaden op Android) of een **AAB** bestand voor de Google Play Console!

### Methode B: Capacitor / Android Studio
Als je native Android code wilt toevoegen:
```bash
npm init @capacitor/app
npx cap add android
npx cap open android
```

---

## 🌐 Gratis online hosten (zodat je vrienden mee kunnen kijken)

Je kunt deze map gratis online zetten via:
- **GitHub Pages**: Maak een GitHub repository en schakel Pages in onder *Settings > Pages*.
- **Firebase Hosting**: `firebase init hosting` en `firebase deploy`.
- **Netlify / Vercel**: Sleep de map eenvoudig naar het dashboard.

---

## 📁 Bestandsstructuur

```text
e:/projects/hello_world/
├── index.html        # De hoofdinterface (HTML5, responsive)
├── style.css         # Styling, thema's, animaties en responsive layout
├── app.js            # Spelstatistieken, audio synthesizer, timer & toernooilogica
├── manifest.json     # PWA configuratie voor Android installatie
├── sw.js             # Service Worker voor 100% offline ondersteuning
├── server.ps1        # Lokale PowerShell webserver
├── start_app.bat     # Windows 1-klik starter
├── README.md         # Documentatie en handleiding
└── icons/
    ├── icon.svg      # Vector 8-ball app logo
    ├── icon-192.png  # Android PWA icoon (192x192)
    └── icon-512.png  # Android PWA icoon (512x512)
```
