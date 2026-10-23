# Android app (APK), free and without the Play Store

The app is a **Trusted Web Activity (TWA)**. That's the way Google recommends to put a PWA in an APK, built with Google's open-source **Bubblewrap** tool.

- It opens `https://<your-domain>` full screen, with no browser address bar. Chrome runs underneath.
- Push alerts with the phone locked, the camera QR scanner, sound and dark mode all work, because it's the same website.
- **Website updates reach the app instantly.** Rebuild the APK only when the app's name, icon or address changes.
- Cost: ₹0. It's shared as an APK file by link or WhatsApp, so there's no Play Store fee (normally $25).

The website must be live on HTTPS first (see [DEPLOY-ORACLE.md](DEPLOY-ORACLE.md)).

## One-time setup on your PC

You need Node.js and JDK 17 or newer. Then:

```bat
npm install -g @bubblewrap/cli
```

Bubblewrap offers to download its own JDK and the Android SDK the first time. Answer **Yes**; the download is about 1 GB, once.

## 1. Create the signing key (once, ever)

```bat
scripts\make-signing-key.bat
```

This script:
- creates `android\campusfood.keystore` and asks for a password. **Write the password down.**
- writes `frontend\public\.well-known\assetlinks.json` with the key's fingerprint.

> ⚠️ **Back up `android\campusfood.keystore` and its password** to Google Drive and a password manager. The key is ignored by git, so it isn't in the repository. If it's lost, phones can never update the app; everyone would have to uninstall and reinstall.

Deploy the website again so `https://<your-domain>/.well-known/assetlinks.json` is live. Open that URL in a browser to check.

## 2. Build the APK

```bat
cd android
bubblewrap init --manifest=https://<your-domain>/manifest.webmanifest
```

Answers to its questions:

| Question | Answer |
|---|---|
| Domain | your domain, e.g. `campusfood.duckdns.org` |
| Application name / short name | `Campus Food` |
| Application ID (package) | `in.campusfood.app`. This **must** match assetlinks.json. |
| Display mode | `standalone` |
| Status bar colour | `#FF6600` |
| Splash screen colour | `#FFFFFF` |
| Enable push notifications | **Yes** (lets Android show the site's push alerts as app notifications) |
| Signing key | **use the existing one**: `./campusfood.keystore`, alias `campusfood` |

Then build:

```bat
bubblewrap build
```

Enter the keystore password twice. The result is **`app-release-signed.apk`**.

## 3. Share it

1. Upload `app-release-signed.apk` somewhere free, for example Google Drive ("Anyone with the link"). You can also send it on WhatsApp as a document.
2. On each Android phone, open the link and tap the file. Allow **"Install unknown apps"** for Chrome or WhatsApp once, then tap **Install**.
3. Open **Campus Food**, log in, and tap **Turn on alerts**. Do this once on every staff phone.

**iPhone users:** in Safari, open the website, tap **Share → Add to Home Screen**, open it from the home screen, then turn on alerts. Push on iPhone needs iOS 16.4 or newer.

## Updating the app later

- **Website changes** (screens, features, fixes): just deploy the website. The app shows them on next open.
- **Name, icon or domain changes:** in `android\twa-manifest.json`, increase `appVersionCode` by 1. Then run `bubblewrap update` and `bubblewrap build`, and share the new APK. Phones install it over the old one, as long as it's signed with the same key.

## If alerts don't arrive with the phone locked

Some brands (Xiaomi, Vivo, Oppo, Realme, Samsung) stop background apps to save battery. On each staff phone:
- **Settings → Apps → Campus Food** (or Chrome) → **Battery → Unrestricted / No restrictions**
- **Notifications → Allowed**, with sound on
- Xiaomi/Redmi: also turn on **Autostart** for the app
