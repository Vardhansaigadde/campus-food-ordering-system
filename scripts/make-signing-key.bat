@echo off
rem ============================================================
rem  Creates the Android app's signing key (do this ONCE, ever)
rem  and writes assetlinks.json, which proves to Android that the
rem  app and the website belong together (no browser bar in the app).
rem
rem  Usage:  scripts\make-signing-key.bat
rem
rem  KEEP android\campusfood.keystore AND ITS PASSWORD SAFE (e.g. Google
rem  Drive + a password manager). Lose them and phones can never get an
rem  update of the app – everyone would have to uninstall and reinstall.
rem ============================================================
setlocal
cd /d "%~dp0.."
where keytool >nul 2>nul || (echo keytool not found - install JDK 17+ and add it to PATH. & exit /b 1)
if not exist android mkdir android

if exist android\campusfood.keystore (
  echo android\campusfood.keystore already exists - not creating a new one.
) else (
  echo Creating the signing key. Choose a strong password and WRITE IT DOWN.
  keytool -genkeypair -v -keystore android\campusfood.keystore -alias campusfood -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Campus Food, O=Campus Food, C=IN"
  if errorlevel 1 exit /b 1
)

echo.
echo Reading the key's fingerprint (enter the same password)...
for /f "tokens=2 delims= " %%F in ('keytool -list -v -keystore android\campusfood.keystore -alias campusfood ^| findstr /c:"SHA256:"') do set FP=%%F
if "%FP%"=="" (echo Could not read the fingerprint. & exit /b 1)

if not exist frontend\public\.well-known mkdir frontend\public\.well-known
> frontend\public\.well-known\assetlinks.json (
  echo [{
  echo   "relation": ["delegate_permission/common.handle_all_urls"],
  echo   "target": { "namespace": "android_app", "package_name": "in.campusfood.app",
  echo               "sha256_cert_fingerprints": ["%FP%"] }
  echo }]
)
echo.
echo Done. Fingerprint: %FP%
echo Written: frontend\public\.well-known\assetlinks.json  (deploy the website so it is live)
endlocal
