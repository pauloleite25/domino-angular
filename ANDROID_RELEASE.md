# Android release

## 1. Create the upload key

From the project root:

```bash
keytool -genkeypair \
  -v \
  -keystore android/domino-upload-key.jks \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

## 2. Create the signing file

Copy the example file and fill in the real values:

```bash
cp android/key.properties.example android/key.properties
```

Expected format:

```properties
storeFile=../domino-upload-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD
```

`storeFile` is resolved relative to `android/app`, so `../domino-upload-key.jks` points to `android/domino-upload-key.jks`.

## 3. Sync the Capacitor web build

```bash
npm run android:sync
```

## 4. Generate the Play Store bundle

```bash
cd android
./gradlew bundleRelease
```

Output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## 5. Upload to Play Console

Upload the `.aab` to an internal or closed test track first.

If your Play Console personal account was created after November 13, 2023, Google currently requires a closed test with at least 12 testers for 14 continuous days before production access.
