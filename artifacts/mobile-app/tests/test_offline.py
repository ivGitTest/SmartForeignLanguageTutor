"""Run the real TypeScript domain through pytest, never a Python reimplementation."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.offline


def run_typescript(file: Path, pattern: str | None = None) -> None:
    assert shutil.which("pnpm"), "Install pnpm and run pnpm install first."
    command = ["pnpm", "exec", "tsx", "--test"]
    if pattern:
        command.append(f"--test-name-pattern={pattern}")
    command.append(str(file))
    result = subprocess.run(
        command, cwd=APP, capture_output=True, text=True, timeout=120
    )
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    # A mistyped pattern must not masquerade as a successful empty test run.
    match = re.search(r"(?:#|ℹ)\s+pass\s+(\d+)", output)
    assert match and int(match.group(1)) > 0, output


@pytest.mark.dictionary
def test_dictionary_context_selection_normalization_and_fixture_storage():
    run_typescript(
        APP / "tests" / "domain.test.ts",
        "meaning context|repository serializes|failed save|corrupt data",
    )
    run_typescript(APP / "tests" / "fixtures" / "offline-scenarios.ts", "dictionary")


@pytest.mark.materials
def test_material_chain_mocked_success_errors_cancel_and_stale_results():
    run_typescript(
        APP / "tests" / "domain.test.ts",
        "A changes|B is durable|incomplete B|cancelled late|editing the source|chain snapshots|no A without",
    )
    run_typescript(APP / "tests" / "fixtures" / "offline-scenarios.ts", "materials")


@pytest.mark.learning
def test_learning_queue_reveal_ratings_resume_and_due_schedule():
    run_typescript(
        APP / "tests" / "domain.test.ts",
        "session |ratings |SM-2|Again resets|deleting a queued|empty infinite",
    )


def test_settings_validation_and_sqlite_transactions():
    run_typescript(APP / "tests" / "domain.test.ts", "defaults|invalid ranges")
    run_typescript(APP / "tests" / "sqlite.test.ts")
