"""Exercise EAS build authentication locally without a real login or cloud build."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = APP / "scripts" / "build-apk.sh"


def run_build_script(
    *,
    version: str = "2.4",
    profile: str = "preview",
    token: str | None = None,
    account: str = "ivaexpi",
):
    with tempfile.TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        fake_pnpm = temporary_path / "pnpm"
        fake_pnpm.write_text(
            """#!/usr/bin/env python3
import json
import os
import sys

args = sys.argv[1:]
if args[:2] == ["exec", "expo"]:
    print(json.dumps({
        "slug": "smartlang",
        "owner": "ivaexpi",
        "version": os.environ.get("APP_VERSION", "1.0"),
        "extra": {"eas": {"projectId": "24594e06-57d4-416b-9f3e-5f212b9c2cd5"}},
    }))
elif args[-1:] == ["whoami"]:
    print(os.environ.get("FAKE_ACCOUNT", "ivaexpi"))
elif "build" in args:
    print("FAKE_BUILD_CALLED=true APP_VERSION=" + os.environ.get("APP_VERSION", ""))
    print("FAKE_BUILD_ARGS=" + " ".join(args))
else:
    print("Unexpected pnpm invocation: " + " ".join(args), file=sys.stderr)
    sys.exit(91)
""",
            encoding="utf-8",
        )
        fake_pnpm.chmod(0o755)

        environment = os.environ.copy()
        environment["PATH"] = f"{temporary_path}{os.pathsep}{environment['PATH']}"
        environment["FAKE_ACCOUNT"] = account
        environment["BUILD_PROFILE"] = profile
        if token is None:
            environment.pop("EXPO_TOKEN", None)
        else:
            environment["EXPO_TOKEN"] = token

        return subprocess.run(
            ["bash", str(BUILD_SCRIPT), version],
            cwd=APP,
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )


@pytest.mark.offline
def test_build_uses_secret_token_without_printing_it():
    result = run_build_script(token="test-token-must-not-leak")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "Checking Expo access token" in result.stdout
    assert "FAKE_BUILD_CALLED=true" in result.stdout
    assert "APP_VERSION=2.4" in result.stdout
    assert "--profile preview" in result.stdout
    assert "test-token-must-not-leak" not in result.stdout + result.stderr


@pytest.mark.offline
def test_build_falls_back_to_saved_cli_session_without_token():
    result = run_build_script()

    assert result.returncode == 0, result.stdout + result.stderr
    assert "Checking saved Expo login" in result.stdout
    assert "FAKE_BUILD_CALLED=true" in result.stdout
    assert "APP_VERSION=2.4" in result.stdout


@pytest.mark.offline
def test_production_build_uses_requested_version_and_profile():
    result = run_build_script(version="3.1", profile="production")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "APP_VERSION=3.1" in result.stdout
    assert "--profile production" in result.stdout


@pytest.mark.offline
@pytest.mark.parametrize("version", ["1.0.0", "1", "1.x", ""])
def test_build_rejects_versions_outside_x_y_format(version: str):
    result = run_build_script(version=version)

    assert result.returncode == 2
    assert "version as x.y" in result.stderr
    assert "FAKE_BUILD_CALLED=true" not in result.stdout


@pytest.mark.offline
def test_build_stops_before_cloud_build_when_account_does_not_match():
    result = run_build_script(token="test-token", account="different-user")

    assert result.returncode != 0
    assert "expected ivaexpi" in result.stderr
    assert "FAKE_BUILD_CALLED=true" not in result.stdout
