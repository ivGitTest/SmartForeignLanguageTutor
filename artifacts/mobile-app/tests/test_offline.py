"""Run the real TypeScript domain through pytest, never a Python reimplementation."""
from __future__ import annotations

import re
import ast
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
    run_typescript(APP / "tests" / "local-save.test.ts")


@pytest.mark.learning
def test_learning_queue_reveal_ratings_resume_and_due_schedule():
    run_typescript(
        APP / "tests" / "domain.test.ts",
        "session |ratings |SM-2|Again resets|deleting a queued|empty infinite",
    )


def test_settings_validation_and_sqlite_transactions():
    run_typescript(APP / "tests" / "domain.test.ts", "defaults|invalid ranges")
    run_typescript(APP / "tests" / "sqlite.test.ts")


@pytest.mark.navigation
def test_material_audio_navigation_lifecycle():
    run_typescript(APP / "tests" / "audio-navigation.test.ts")


@pytest.mark.materials
def test_contextual_dictionary_selection_is_available_only_in_b():
    run_typescript(APP / "tests" / "material-selection.test.ts")


@pytest.mark.navigation
def test_every_screen_has_a_registered_android_round_trip():
    """Fail locally when a page is added without a navigation test registration.

    This is a coverage inventory, not a substitute for running the APK tests.
    """
    tree = ast.parse((APP / "tests" / "test_navigation.py").read_text(encoding="utf-8"))
    registry = next(
        ast.literal_eval(node.value)
        for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "SCREEN_TESTS" for target in node.targets)
    )
    routes = {
        str(path.relative_to(APP / "app").with_suffix(""))
        for path in (APP / "app").rglob("*.tsx")
        if path.stem != "_layout"
    }
    assert routes == set(registry), (
        f"Missing navigation tests: {routes - set(registry)}; "
        f"obsolete route registrations: {set(registry) - routes}"
    )
    functions = {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}
    assert set(registry.values()) <= functions


@pytest.mark.materials
def test_russian_translation_text_is_constrained_to_the_disclosure_width():
    """Protect the Android B-screen translation from intrinsic-width overflow."""
    source = (APP / "app" / "material" / "[id].tsx").read_text(encoding="utf-8")
    translation = re.search(
        r'<View style=\{\{ alignSelf: "stretch", minWidth: 0 \}\}>\s*'
        r'<Body\s+accessibilityLabel="Russian translation"(?P<props>.*?)>'
        r'\{m\.translation\}</Body>\s*</View>',
        source,
        flags=re.DOTALL,
    )
    assert translation, "The saved Russian translation must be rendered inside a constrained, visible text container."
    for constraint in (
        'maxWidth: "100%"',
        "minWidth: 0",
        "flexShrink: 1",
        'alignSelf: "stretch"',
    ):
        assert constraint in translation.group("props"), (
            f"Russian translation must retain its width constraint: {constraint}"
        )
