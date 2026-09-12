# Docker Android emulator

`android_emulator.py` manages a hardware-accelerated Android emulator for
installing and smoke-testing PocketPal APKs. It uses Google's experimental
Android Emulator Container image and requires no Python packages.

## Requirements

- Python 3.10 or newer
- Docker Desktop or Docker Engine on x86-64 Linux
- Hardware virtualization enabled
- `/dev/kvm` available to Docker

Docker Desktop on macOS and Windows does not support the KVM setup required by
this image. A Linux host or Linux VM with nested virtualization is required.

## Usage

Run commands from the repository root:

```bash
# Download the default Android 11 / API 30 image.
python3 dev-env/android_emulator.py pull

# Start the container and wait until Android has booted.
python3 dev-env/android_emulator.py start

# Inspect the container and attached emulator.
python3 dev-env/android_emulator.py status

# Install or update a local APK.
python3 dev-env/android_emulator.py install \
  android/app/build/outputs/apk/e2e/releaseE2e/app-e2e-releaseE2e.apk

# Install and launch PocketPal's E2E activity.
python3 dev-env/android_emulator.py install path/to/app.apk \
  --launch com.pocketpalai.e2e/.MainActivity

# Follow emulator logs.
python3 dev-env/android_emulator.py logs --follow

# Stop the container without deleting it.
python3 dev-env/android_emulator.py stop
```

The first `start` creates an ADB key in `~/.android` when one is not already
present. Subsequent starts reuse the named container and its emulator state.

Global options must precede the command:

```bash
python3 dev-env/android_emulator.py \
  --name my-emulator \
  --adb-port 5557 \
  --webrtc-port 8556 \
  --timeout 360 \
  start
```

The defaults are:

| Setting | Value |
| --- | --- |
| Container | `pocketpal-android-emulator` |
| Image | `us-docker.pkg.dev/android-emulator-268719/images/30-google-x64:30.1.2` |
| Host ADB endpoint | `127.0.0.1:5555` |
| Host WebRTC endpoint | `127.0.0.1:8554` |

The emulator container is intentionally retained after `stop`. Remove it
manually when its state is no longer needed:

```bash
docker rm pocketpal-android-emulator
```
