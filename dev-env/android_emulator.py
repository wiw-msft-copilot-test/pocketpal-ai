#!/usr/bin/env python3

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid


DEFAULT_IMAGE = (
    "us-docker.pkg.dev/android-emulator-268719/images/"
    "30-google-x64:30.1.2"
)
DEFAULT_CONTAINER = "pocketpal-android-emulator"
ADB = "/android/sdk/platform-tools/adb"


def format_command(command: list[str]) -> str:
    return " ".join(
        "ADBKEY=<redacted>" if part.startswith("ADBKEY=") else part
        for part in command
    )


def run(
    command: list[str],
    *,
    capture: bool = False,
    timeout: float | None = None,
) -> subprocess.CompletedProcess[str]:
    print("+", format_command(command), file=sys.stderr)
    return subprocess.run(
        command,
        check=True,
        text=True,
        capture_output=capture,
        timeout=timeout,
    )


def docker_available() -> None:
    try:
        run(["docker", "info"], capture=True, timeout=15)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise SystemExit("Docker is unavailable. Start Docker Desktop and try again.")


def inspect_container(name: str) -> dict | None:
    result = subprocess.run(
        ["docker", "inspect", name],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)[0]


def pull_image(image: str) -> None:
    docker_available()
    run(["docker", "pull", image])


def ensure_image(image: str) -> None:
    result = subprocess.run(
        ["docker", "image", "inspect", image],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        pull_image(image)


def ensure_adb_key(image: str) -> Path:
    android_dir = Path.home() / ".android"
    private_key = android_dir / "adbkey"
    public_key = android_dir / "adbkey.pub"
    if private_key.is_file() and public_key.is_file():
        return private_key

    android_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    run(
        [
            "docker",
            "run",
            "--rm",
            "--user",
            f"{os.getuid()}:{os.getgid()}",
            "--entrypoint",
            ADB,
            "--volume",
            f"{android_dir}:/keys",
            image,
            "keygen",
            "/keys/adbkey",
        ]
    )
    private_key.chmod(0o600)
    public_key.chmod(0o644)
    return private_key


def wait_for_boot(name: str, timeout: int) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = subprocess.run(
            [
                "docker",
                "exec",
                name,
                ADB,
                "shell",
                "getprop",
                "sys.boot_completed",
            ],
            text=True,
            capture_output=True,
        )
        if result.returncode == 0 and result.stdout.strip() == "1":
            version = run(
                [
                    "docker",
                    "exec",
                    name,
                    ADB,
                    "shell",
                    "getprop",
                    "ro.build.version.release",
                ],
                capture=True,
            ).stdout.strip()
            api = run(
                [
                    "docker",
                    "exec",
                    name,
                    ADB,
                    "shell",
                    "getprop",
                    "ro.build.version.sdk",
                ],
                capture=True,
            ).stdout.strip()
            print(f"Android {version} (API {api}) is ready.")
            return
        time.sleep(3)
    raise SystemExit(
        f"Emulator did not finish booting within {timeout} seconds. "
        f"Run: docker logs {name}"
    )


def start_container(args: argparse.Namespace) -> None:
    docker_available()
    ensure_image(args.image)
    existing = inspect_container(args.name)
    if existing:
        configured_image = existing["Config"]["Image"]
        if configured_image != args.image:
            raise SystemExit(
                f"Container {args.name!r} uses {configured_image!r}, not "
                f"{args.image!r}. Remove or rename it before continuing."
            )
        if not existing["State"]["Running"]:
            run(["docker", "start", args.name])
        else:
            print(f"Container {args.name!r} is already running.")
        wait_for_boot(args.name, args.timeout)
        return

    if not Path("/dev/kvm").exists():
        raise SystemExit(
            "/dev/kvm is unavailable. Enable hardware virtualization and KVM "
            "passthrough in Docker Desktop."
        )

    adb_key = ensure_adb_key(args.image)
    run(
        [
            "docker",
            "run",
            "--detach",
            "--name",
            args.name,
            "--device",
            "/dev/kvm",
            "--env",
            f"ADBKEY={adb_key.read_text().strip()}",
            "--publish",
            f"127.0.0.1:{args.adb_port}:5555",
            "--publish",
            f"127.0.0.1:{args.webrtc_port}:8554",
            args.image,
        ]
    )
    wait_for_boot(args.name, args.timeout)


def stop_container(args: argparse.Namespace) -> None:
    docker_available()
    existing = inspect_container(args.name)
    if not existing:
        raise SystemExit(f"Container {args.name!r} does not exist.")
    if existing["State"]["Running"]:
        run(["docker", "stop", args.name])
    else:
        print(f"Container {args.name!r} is already stopped.")


def show_status(args: argparse.Namespace) -> None:
    docker_available()
    existing = inspect_container(args.name)
    if not existing:
        print(f"Container {args.name!r} does not exist.")
        return
    state = existing["State"]
    health = state.get("Health", {}).get("Status", "not configured")
    print(f"name:   {args.name}")
    print(f"image:  {existing['Config']['Image']}")
    print(f"status: {state['Status']}")
    print(f"health: {health}")
    if state["Running"]:
        run(["docker", "exec", args.name, ADB, "devices", "-l"])


def show_logs(args: argparse.Namespace) -> None:
    docker_available()
    command = ["docker", "logs", "--tail", str(args.tail)]
    if args.follow:
        command.append("--follow")
    command.append(args.name)
    try:
        run(command)
    except KeyboardInterrupt:
        pass


def install_apk(args: argparse.Namespace) -> None:
    apk = args.apk.expanduser().resolve()
    if not apk.is_file():
        raise SystemExit(f"APK does not exist: {apk}")

    start_container(args)
    destination = f"/tmp/{uuid.uuid4().hex}-{apk.name}"
    try:
        run(["docker", "cp", str(apk), f"{args.name}:{destination}"])
        install_command = [
            "docker",
            "exec",
            args.name,
            ADB,
            "install",
        ]
        if args.replace:
            install_command.append("-r")
        if args.grant_permissions:
            install_command.append("-g")
        install_command.append(destination)
        run(install_command)
        if args.launch:
            run(
                [
                    "docker",
                    "exec",
                    args.name,
                    ADB,
                    "shell",
                    "am",
                    "start",
                    "-n",
                    args.launch,
                ]
            )
    finally:
        subprocess.run(
            ["docker", "exec", args.name, "rm", "-f", destination],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def add_runtime_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    parser.add_argument("--name", default=DEFAULT_CONTAINER)
    parser.add_argument("--adb-port", type=int, default=5555)
    parser.add_argument("--webrtc-port", type=int, default=8554)
    parser.add_argument(
        "--timeout",
        type=int,
        default=240,
        help="seconds to wait for Android to boot (default: 240)",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Manage a Dockerized Android emulator for PocketPal APKs."
    )
    add_runtime_options(parser)
    commands = parser.add_subparsers(dest="command", required=True)

    pull = commands.add_parser("pull", help="download the emulator image")
    pull.set_defaults(handler=lambda args: pull_image(args.image))

    start = commands.add_parser("start", help="start the emulator and wait for boot")
    start.set_defaults(handler=start_container)

    stop = commands.add_parser("stop", help="stop the emulator container")
    stop.set_defaults(handler=stop_container)

    status = commands.add_parser("status", help="show container and device status")
    status.set_defaults(handler=show_status)

    logs = commands.add_parser("logs", help="show emulator container logs")
    logs.add_argument("--tail", type=int, default=100)
    logs.add_argument("--follow", action="store_true")
    logs.set_defaults(handler=show_logs)

    install = commands.add_parser("install", help="install a local APK")
    install.add_argument("apk", type=Path)
    install.add_argument(
        "--no-replace",
        action="store_false",
        dest="replace",
        help="do not pass -r to adb install",
    )
    install.add_argument(
        "--grant-permissions",
        action="store_true",
        help="grant runtime permissions during installation",
    )
    install.add_argument(
        "--launch",
        metavar="PACKAGE/ACTIVITY",
        help="launch an activity after installation",
    )
    install.set_defaults(handler=install_apk)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        args.handler(args)
    except subprocess.CalledProcessError as error:
        raise SystemExit(
            f"Command failed with exit code {error.returncode}: "
            f"{format_command(error.cmd)}"
        ) from error


if __name__ == "__main__":
    main()
