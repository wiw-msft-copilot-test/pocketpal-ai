# Android Auto projection testing in Docker

Android Auto projection can run without a physical phone or car: a phone
emulator runs Android Auto, and Google's Desktop Head Unit (DHU) receives its
projected display. Both can run in the same Docker container.

This is **not Android Automotive OS**. The application under test runs on the
emulated phone, not on an emulated car.

## Verified scope and baseline

Verified on November 15, 2026 (Pacific time):

| Component | Tested configuration |
| --- | --- |
| Host | Docker Desktop on Windows/WSL2, Linux containers, working `/dev/kvm` |
| Docker Engine | 29.7.2 |
| Container base | `mobiledevops/android-sdk-image`, pinned digest in the command below |
| Emulator | 37.2.13.0, build 16740729 |
| Phone image | `system-images;android-35;google_apis_playstore;x86_64`, revision 9 |
| AVD | Pixel 6 profile, 3072 MB RAM, four cores, SwiftShader |
| Supported guest ABIs | `x86_64,arm64-v8a` |
| Android Auto | `18.0.664264-release`, version code `180664264` |
| Installed splits | Base, `arm64_v8a`, English, `xxxhdpi` |
| DHU | `2.0-linux`, build `2022-03-30-438482292` |
| Google accounts | None (`dumpsys account` reported `Accounts: 0`) |

The verification included a TLS 1.2 projection handshake, screenshots of the
Android Auto dashboard and launcher, launcher input, and `restrict all`.
The restricted launcher visibly disabled the game and customization entries.
Projection succeeded again after a cold boot and restarting the head-unit
server. No rooting, Android Auto patches, installer spoofing, or lifting of
driving restrictions was used.

**This proves the projection test environment, not PocketPal's hands-free
Android Auto implementation.** PocketPal was not installed or changed during
this verification. Microphone delivery to PocketPal, recognition, TTS output,
audio focus, repeated spoken turns, and actual-car compatibility remain
separate acceptance gates. This headless baseline discards host audio.

## 1. Start an isolated SDK container

Run on the host. In WSL without Docker integration, `docker.exe` can reach the
Windows Docker Desktop engine; substitute it for `docker` in host commands.

```sh
docker run -d \
  --name pocketpal-auto \
  --device /dev/kvm \
  --shm-size=2g --memory=8g --cpus=6 \
  -e HOME=/root \
  -e ANDROID_AVD_HOME=/root/.android/avd \
  --entrypoint /bin/sleep \
  mobiledevops/android-sdk-image@sha256:c85ee26503cbfb258b7737760430e794b25eb8302cbd43a5a302231f593afb12 \
  7200

docker exec -it pocketpal-auto /bin/bash
```

The container has a two-hour lifetime. Its writable layer survives
`docker stop` / `docker start`, but not `docker rm`. Do not remove it while
retaining provisioned state is useful. No ports or host directories need to
be exposed for this single-container setup.

The remaining setup commands run **inside the container**:

```sh
set -euo pipefail

export ANDROID_SDK_ROOT=/opt/android-sdk-linux
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export HOME=/root
export ANDROID_AVD_HOME=/root/.android/avd

# This pinned base image needs the standard command-line tools layout.
mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools/latest"
mv "$ANDROID_SDK_ROOT/cmdline-tools/bin" \
   "$ANDROID_SDK_ROOT/cmdline-tools/lib" \
   "$ANDROID_SDK_ROOT/cmdline-tools/NOTICE.txt" \
   "$ANDROID_SDK_ROOT/cmdline-tools/source.properties" \
   "$ANDROID_SDK_ROOT/cmdline-tools/latest/"

export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/extras/google/auto:$ANDROID_SDK_ROOT/build-tools/34.0.0:$PATH"

sdkmanager --sdk_root="$ANDROID_SDK_ROOT" \
  "emulator" "extras;google;auto" \
  "system-images;android-35;google_apis_playstore;x86_64"

apt-get update -qq
apt-get install -y libxkbfile1 libc++1 libc++abi1

emulator -accel-check
emulator -version
desktop-head-unit --version
```

Run the layout repair only once. The base already includes SDK licenses;
review and accept any additional license prompts if using another base.
SDK package names resolve to current revisions: record `source.properties`
and binary versions, rather than assuming they equal the baseline above.
The DHU catalog label can differ from its actual `--version` output.

`-accel-check` must report KVM installed and usable. The presence of
`/dev/kvm` alone is insufficient, and support varies between hosts.

## 2. Create and boot the phone emulator

```sh
printf 'no\n' | avdmanager create avd \
  --name pocketpal-auto35-stock \
  --package "system-images;android-35;google_apis_playstore;x86_64" \
  --device pixel_6

adb start-server
emulator -avd pocketpal-auto35-stock \
  -no-window -no-snapshot -no-boot-anim -no-metrics \
  -gpu swiftshader -accel on -memory 3072 -cores 4 \
  -partition-size 4096 >/tmp/emulator.log 2>&1 &
EMULATOR_PID=$!

timeout 120 adb wait-for-device
booted=false
for attempt in $(seq 1 60); do
  if adb shell getprop sys.boot_completed | tr -d '\r' | grep -qx 1; then
    booted=true
    break
  fi
  sleep 2
done
if [ "$booted" != true ]; then
  tail -n 60 /tmp/emulator.log
  exit 1
fi

adb shell getprop ro.product.cpu.abilist
```

Keep ADB and the emulator on the same `HOME`. Mixed homes produced an
unauthorized ADB device during the spike; restarting only this container's
ADB server with `HOME=/root` resolved it.

The tested x86_64 image advertises ARM64 translation. This is why the
article's ARM64 bundle worked here; do not assume every x86_64 image supports
it.

## 3. Install full, Google-signed Android Auto

The phone image initially contains only `AndroidAutoStubPrebuilt`,
`1.2.542030-stub`. The stub redirects to Google Play and cannot provide the
head-unit server. Updating it with the full signed app is the essential step.

The original article uses an APKMirror `.apkm` bundle. APKMirror returned
HTTP 403 in this environment, so verification used an APKPure `.xapk`
bundle instead. Both are ZIP containers of APK splits; no distributor
installer app is required.

The successfully used download endpoint was:

```text
https://d.apkpure.net/b/XAPK/com.google.android.projection.gearhead?version=latest
```
[link](https://d.apkpure.net/b/XAPK/com.google.android.projection.gearhead?version=latest)

Paste that URL at the prompt:

```sh
read -r -p 'Android Auto bundle URL: ' AA_BUNDLE_URL
curl -fL --max-time 120 "$AA_BUNDLE_URL" -o /tmp/android-auto.xapk

printf '%s  %s\n' \
  4cbc6362b7c0b35644841d788fbdfafe17154e950dfdc190f6152e9b31db01ef \
  /tmp/android-auto.xapk | sha256sum -c -
```

**`latest` is mutable.** A checksum mismatch is a stop for reproducing this
baseline, not permission to ignore the check. Obtain the recorded version or
establish a new versioned baseline deliberately. A version-code-specific URL
was also tried and returned HTTP 403. Cache your verified download outside
the repository; do not commit or redistribute Android Auto APKs here.

Extract only the required files and verify **each** installed split:

```sh
mkdir -p /tmp/gearhead
unzip -j /tmp/android-auto.xapk \
  com.google.android.projection.gearhead.apk \
  config.arm64_v8a.apk config.en.apk config.xxxhdpi.apk \
  -d /tmp/gearhead

adb pull /product/priv-app/AndroidAutoStubPrebuilt/AndroidAutoStubPrebuilt.apk \
  /tmp/android-auto-stub.apk
apksigner verify --verbose --print-certs \
  --min-sdk-version 35 --max-sdk-version 35 /tmp/android-auto-stub.apk

for apk in /tmp/gearhead/*.apk; do
  apksigner verify --verbose --print-certs \
    --min-sdk-version 35 --max-sdk-version 35 "$apk" >"$apk.signing.txt"
  grep -Fx \
    'Signer #1 certificate SHA-256 digest: 1ca8dcc0bed3cbd872d2cb791200c0292ca9975768a82d676b8b424fb65b5295' \
    "$apk.signing.txt"
done

adb install-multiple -r \
  /tmp/gearhead/com.google.android.projection.gearhead.apk \
  /tmp/gearhead/config.arm64_v8a.apk \
  /tmp/gearhead/config.en.apk \
  /tmp/gearhead/config.xxxhdpi.apk

adb shell dumpsys package com.google.android.projection.gearhead
```

That certificate matches the API-35 signer of the trusted stub shipped in
Google's phone image. Check the **APK signer**, not just the source-stamp
signer or certificate's display name. The package must be
`com.google.android.projection.gearhead`; the checked base APK SHA-256 was
`3d2dfac86cbfd0d80068d1eeb54589c60f711337720390995dcb74cba41eb8cd`.

The base APK alone requires ABI and density splits. Installing only the base
is not the article's procedure. Split filenames differ between distributors;
inspect the archive before adapting these commands. The tested density split
was `xxxhdpi`, not the article's `xxhdpi`.

## 4. Enable the normal head-unit server

```sh
adb shell am start -a com.google.android.projection.gearhead.SETTINGS
```

On the emulated phone:

1. Scroll to **Version**, tap to expand **Version and permission info**, then
   tap it ten times.
2. Review the developer-mode warning and choose **OK**.
3. Open the overflow menu and select **Start head unit server**.

These are ordinary Android Auto developer controls. Do not enable options
that lift driving restrictions or spoof the installation source.

Headless phone interaction can be driven with ADB:

```sh
adb shell uiautomator dump /sdcard/aa-window.xml
adb shell cat /sdcard/aa-window.xml
adb exec-out screencap -p >/tmp/phone.png
```

Use the XML's current bounds with `adb shell input tap X Y` and
`adb shell input swipe X1 Y1 X2 Y2 DURATION`. Coordinates depend on the
screen and current scroll position. From a host terminal, retrieve the image:

```sh
docker exec pocketpal-auto cat /tmp/phone.png >phone.png
```

Restart the head-unit server after each cold boot. Developer mode,
notification access, and the installed app persisted in the verified AVD,
but the head-unit server did not restart automatically.

## 5. Start DHU and prove projection

Inside the container, with the phone and head-unit server running:

```sh
adb forward tcp:5277 tcp:5277
test -p /tmp/dhu-input || mkfifo /tmp/dhu-input

SDL_VIDEODRIVER=dummy SDL_RENDER_DRIVER=software SDL_AUDIODRIVER=dummy \
  desktop-head-unit --headless \
  --config="$ANDROID_SDK_ROOT/extras/google/auto/config/default_720p.ini" \
  --adb=127.0.0.1:5277 </tmp/dhu-input >/tmp/dhu.log 2>&1 &
DHU_PID=$!

sleep 1800 >/tmp/dhu-input &
HOLDER_PID=$!
```

The bounded holder keeps the FIFO open so DHU does not receive EOF between
commands. `--headless` alone failed SDL initialization in this container;
the dummy video driver plus software renderer produced screenshots.
ALSA warnings are expected without a sound device in this visual-only
configuration; they are not evidence of working audio.

During first connection, complete **Continue** on the phone. If DHU asks for
notification access, use **Go to phone**, select Android Auto, and grant
notification access through Android Settings. No Google account was needed
in the tested environment.

Inspect the log:

```sh
tail -n 30 /tmp/dhu.log
printf 'sleep 3\nscreenshot /tmp/dhu-ready.png\n' >/tmp/dhu-input
```

The successful log included:

```text
Phone reported protocol version 1.7
ssl state=SSL negotiation finished successfully 1
SSL version=TLSv1.2 Cipher name=ECDHE-RSA-AES128-GCM-SHA256
Verify returned: ok
```

**`[I]: connected.` alone is only a TCP connection, not acceptance.**
Retrieve and inspect `/tmp/dhu-ready.png` from the host:

```sh
docker exec pocketpal-auto cat /tmp/dhu-ready.png >dhu-ready.png
```

Require a rendered Android Auto dashboard or launcher, not a blank image or
unfinished setup prompt. A Maps location-permission warning appeared inside
the otherwise working projected dashboard; Maps navigation was not tested.

For the tested 1280x720 layout, these DHU commands opened the launcher and
enabled simulated driving restrictions:

```sh
printf 'tap 40 678\nsleep 2\nscreenshot /tmp/launcher.png\nrestrict all\nsleep 2\nscreenshot /tmp/restricted.png\n' \
  >/tmp/dhu-input
```

Inspect both screenshots. DHU commands are asynchronous; wait for newly
named screenshot files before copying them. Neither `restrict all` nor a
rendered microphone icon proves an application's speech/audio loop.

## 6. Stop safely and reuse the environment

In the shell that owns the background jobs:

```sh
printf 'quit\n' >/tmp/dhu-input
wait "$DHU_PID"
kill -TERM "$HOLDER_PID"
kill -TERM "$EMULATOR_PID"
```

Wait for the emulator to exit before stopping the named container from the
host. If using another shell, inspect `ps -eo pid,args` and identify these
task-owned numeric PIDs first; never kill processes by a shared name.

```sh
docker stop --timeout 20 pocketpal-auto
docker inspect pocketpal-auto --format '{{.State.Status}}'
```

An abrupt container stop left stale AVD locks during the cold-boot repeat.
After verifying that **no emulator for this AVD is running**, removing only
these two files resolved the false "multiple emulators" error:

```sh
rm -f \
  /root/.android/avd/pocketpal-auto35-stock.avd/hardware-qemu.ini.lock \
  /root/.android/avd/pocketpal-auto35-stock.avd/multiinstance.lock
```

Do not wipe the AVD or its data. On reuse, restore the shell environment,
start the existing AVD, restart the head-unit server, and start DHU.
Do not repeat AVD creation or the one-time SDK layout repair.

## Remaining PocketPal acceptance

This guide does not make the current APK an Android Auto app. Future
integration must preserve the fork's automatic listen/send/respond/speak/
listen loop and on-device recognition without silently replacing it with
Android Auto's message-reply transcription.

A trustworthy audio gate must deliver known input through DHU into the real
`CarAudioRecord` path, capture actual output audio with a virtual audio
backend, and verify multiple turns, background/locked-phone operation,
cancellation, microphone dismissal, focus interruptions, and disconnects.
Dummy audio is not acceptable for that gate. Real-car installation rules,
app-category eligibility, physical audio routing, and cabin-noise behavior
remain unverified by this Docker projection baseline.

## Sources

Original physical-device-free procedure:

```text
https://helw.net/2026/03/07/running-android-auto-on-an-emulator/
```
[link](https://helw.net/2026/03/07/running-android-auto-on-an-emulator/)

Google's testing overview and DHU guide:

```text
https://developer.android.com/training/cars/testing
```
[link](https://developer.android.com/training/cars/testing)

```text
https://developer.android.com/training/cars/testing/dhu
```
[link](https://developer.android.com/training/cars/testing/dhu)
