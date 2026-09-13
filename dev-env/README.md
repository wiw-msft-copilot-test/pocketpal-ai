# Docker Android emulator

This directory contains two dependency-free Python tools:

- `android_emulator.py` manages a hardware-accelerated Android emulator and
  installs or launches local APKs.
- `verify_android_artifact.py` runs the repeatable GitHub Actions artifact
  acceptance workflow used for release-configuration changes.

## Requirements

- Python 3.10 or newer
- Docker Desktop or Docker Engine on x86-64 Linux
- Hardware virtualization enabled
- `/dev/kvm` available to Docker
- GitHub CLI (`gh`) authenticated for the repository when using
  `verify_android_artifact.py`
- `unzip` is not required; APK inspection uses Python's standard library

Docker Desktop on macOS and Windows does not support the KVM setup required by
this image. A Linux host or Linux VM with nested virtualization is required.
When running inside WSL 2, the scripts normally use Docker Desktop's Linux
socket. If that socket integration is missing but the Windows Docker engine is
healthy, they automatically fall back to Docker Desktop's `docker.exe` and
translate WSL file paths for APK copies and key mounts.

## Usage

### Fast local emulator operations

Use `android_emulator.py` while developing or when an APK is already on disk.
It does not dispatch GitHub Actions or inspect the app's feature policy.

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
  --launch com.pocketpalai.e2e

# Equivalently, specify the exact full component.
python3 dev-env/android_emulator.py install path/to/app.apk \
  --launch com.pocketpalai.e2e/com.pocketpal.MainActivity \
  --launch-check-seconds 10

# Relaunch an installed app without reinstalling its APK.
python3 dev-env/android_emulator.py launch com.pocketpalai.e2e \
  --launch-check-seconds 15

# Follow emulator logs.
python3 dev-env/android_emulator.py logs --follow

# Stop the container without deleting it.
python3 dev-env/android_emulator.py stop
```

The first `start` creates an ADB key in `~/.android` when one is not already
present. Subsequent starts reuse the named container and its emulator state.
When `--launch` is a package name, the script resolves its installed launcher
activity. A full component must include the complete activity class name. The
script fails if Android reports a launch error, the app process exits during
the launch-check interval, or the resolved activity is not foreground. Use the
standalone `launch` command for repeated smoke-test relaunches without
reinstalling the APK.

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

| Setting              | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| Container            | `pocketpal-android-emulator`                                            |
| Image                | `us-docker.pkg.dev/android-emulator-268719/images/30-google-x64:30.1.2` |
| Host ADB endpoint    | `127.0.0.1:5555`                                                        |
| Host WebRTC endpoint | `127.0.0.1:8554`                                                        |

The emulator container is intentionally retained after `stop`. Remove it
manually when its state is no longer needed:

```bash
docker rm pocketpal-android-emulator
```

## Full GitHub artifact acceptance

Use `verify_android_artifact.py` after changing native dependencies, feature
flags, authentication boundaries, release bundling, or the E2E workflow. It is
intentionally slower than a local smoke test: it binds evidence to an exact
remote commit, performs a clean installation, and inspects rendered UI.

### Dispatch and verify the current remote branch

Push the branch first, then run:

```bash
python3 dev-env/verify_android_artifact.py --dispatch
```

The command:

1. Reads the current SHA of
   `origin/copilot/security-audit-credentials`.
2. Dispatches `.github/workflows/e2e-tests.yml`.
3. Refuses a workflow run for a different SHA.
4. Watches the build for up to two hours and saves failed job logs.
5. Downloads `e2e-android-apk` to `/tmp/pocketpal-apk-<run-id>/`.
6. Records the APK SHA-256 and checks its native DEX boundary.
7. Performs a 60-second upgrade launch and two cold relaunches.
8. Verifies the disabled centralized-integration deep links and UI.
9. Creates an isolated emulator for a clean 60-second launch, then removes it.
10. Writes `acceptance.json`, screenshots, UI XML, app-process-scoped logcat,
    and command output into the run-specific evidence directory.

### Verify an existing successful run

```bash
python3 dev-env/verify_android_artifact.py \
  --run-id 34725193906
```

By default, the run must target the current remote branch SHA. To verify an
older run deliberately, supply its full commit SHA:

```bash
python3 dev-env/verify_android_artifact.py \
  --run-id 34725193906 \
  --expected-sha 4dd64383a7b2bcdd302999e5558863154971d785
```

### What the policy check asserts

The acceptance script fails unless:

- the app renders and remains foreground without fatal Java, native, or React
  Native startup errors;
- Firebase and Google Sign-In native classes are absent;
- React Native Keychain remains for user-owned credentials;
- Pals/PalsHub, centralized sign-in, and centralized feedback controls are
  absent;
- Hugging Face token, search-provider API key, and remote-server API key
  controls remain visible; and
- disabled hub and checkout deep links leave the app alive and foreground.

It uses an unreachable emulator-local URL to reveal the remote-server API-key
form. It never reads, prints, changes, or sends real provider credentials.

### Useful options

```bash
python3 dev-env/verify_android_artifact.py --help

# Use a different repository or branch.
python3 dev-env/verify_android_artifact.py \
  --dispatch \
  --repo owner/repository \
  --branch feature/my-branch

# Put evidence somewhere other than /tmp.
python3 dev-env/verify_android_artifact.py \
  --run-id 123456789 \
  --evidence-dir /path/to/evidence

# Short diagnostic rerun after full acceptance has already passed.
python3 dev-env/verify_android_artifact.py \
  --run-id 123456789 \
  --skip-clean-install \
  --skip-ui-policy
```

The skip options are for diagnosis only and are recorded as `skipped` in
`acceptance.json`; they do not constitute full acceptance. If ports `5557` or
`8556` are occupied, override `--clean-adb-port` and
`--clean-webrtc-port`. The persistent emulator is left running, while the
run-specific clean-test emulator is always removed.

Port `8554` exposes the emulator's gRPC/WebRTC service endpoint. It is not a
standalone browser UI.

## Troubleshooting Docker Desktop on WSL

If the script reports Docker as unavailable, first verify the engine:

```bash
docker info
```

The scripts automatically try the standard Windows Docker Desktop CLI at
`/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe` when the Linux
socket is unavailable. You can select another executable explicitly:

```bash
POCKETPAL_DOCKER_CLI=/path/to/docker \
  python3 dev-env/android_emulator.py status
```

If both paths fail, open **Docker Desktop → Settings → Resources → WSL
Integration**, enable the current distribution, and select **Apply & restart**.
Restarting WSL alone does not enable a disabled distribution integration.

Do not run `docker desktop start` inside WSL when Docker Desktop is installed on
Windows. That command targets the native Linux Docker Desktop installation.
