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


@pytest.mark.dictionary
def test_dictionary_header_is_pinned_over_an_opaque_background():
    source = (APP / "app" / "(tabs)" / "index.tsx").read_text(encoding="utf-8")
    assert "stickyHeaderIndices={[0]}" in source
    assert "paddingBottom: 14, backgroundColor: c.background" in source


@pytest.mark.materials
def test_material_list_hides_repeated_date_and_right_aligns_artifact_statuses():
    source = (APP / "app" / "(tabs)" / "materials.tsx").read_text(encoding="utf-8")
    row = re.search(r'<Row style=\{\{ gap: 6, justifyContent: "flex-end" \}\}>(.*?)</Row>', source, re.DOTALL)
    assert row, "Artifact statuses must remain in a compact right-aligned row."
    content = row.group(1)
    assert "dateAndDuration" not in source
    assert "Date and duration for" not in source
    assert "{attributes}" in content
    assert content.count("numberOfLines={1}") == 1
    assert 'textAlign: "right"' in content
    assert all(f'"{status}"' in source for status in ("Audio", "A", "B", "Translation"))
    assert 'MaterialIcons name="chevron-right"' in source


@pytest.mark.materials
def test_demo_materials_are_limited_to_the_development_web_preview():
    app_store = (APP / "core" / "app-store.tsx").read_text(encoding="utf-8")
    web_seed = (APP / "core" / "preview-seed.web.ts").read_text(encoding="utf-8")
    native_seed = (APP / "core" / "preview-seed.native.ts").read_text(encoding="utf-8")
    shared_seed = (APP / "core" / "preview-seed.ts").read_text(encoding="utf-8")

    assert 'if (__DEV__ && Platform.OS === "web") await seedPreviewMaterials(repository);' in app_store
    assert "formatRecordingTitle(now - 3 * 60_000, 1)" in web_seed
    assert "formatRecordingTitle(now - 2 * 60_000, 1)" in web_seed
    assert "formatRecordingTitle(now - 60_000, 1)" in web_seed
    assert "smart-lang-tutor-preview-materials-seeded-v4" in web_seed
    assert "Обычно я езжу на работу на автобусе, но сегодня пошёл пешком, потому что погода была приятной." in web_seed
    assert "translationFingerprint: translation ? makeTranslationFingerprint(settings) : \"\"" in web_seed
    assert "existing.b === material.b && !existing.translation" in web_seed
    assert "existing.translation = material.translation" in web_seed
    assert "existing.audio = material.audio" in web_seed
    assert "data.materials.push(material)" in web_seed
    assert "AsyncStorage.getItem(SEED_KEY)" in web_seed
    assert "formatRecordingTitle" not in native_seed
    assert "formatRecordingTitle" not in shared_seed


@pytest.mark.materials
def test_material_title_is_generated_and_not_editable():
    material_screen = (APP / "app" / "material" / "[id].tsx").read_text(encoding="utf-8")
    materials_list = (APP / "app" / "(tabs)" / "materials.tsx").read_text(encoding="utf-8")
    ui = (APP / "components" / "ui.tsx").read_text(encoding="utf-8")

    assert '<Heading small accessibilityLabel={`Material title: ${materialTitle}`}>{materialTitle}</Heading>' in material_screen
    assert "Verbatim transcription. Edit it before improving." not in material_screen
    assert '<Field label="A · editable transcript"' in material_screen
    assert "label=\"Material title\"" not in material_screen
    assert "title !== m.title" not in material_screen
    assert "titleForMaterial" in material_screen
    assert 'new Date(m.createdAt).toLocaleString("en-GB")' not in material_screen
    assert "titleForMaterial(item)" in materials_list
    assert "titleForMaterial(m)" in materials_list
    assert "accessibilityLabel={accessibilityLabel}" in ui


@pytest.mark.learning
def test_learning_screen_hides_daily_tagline():
    source = (APP / "app" / "(tabs)" / "learning.tsx").read_text(encoding="utf-8")
    assert "A LITTLE, EVERY DAY" not in source
    assert "<Heading>Learning</Heading>" in source


@pytest.mark.materials
def test_material_detail_hides_decorative_workflow_label():
    source = (APP / "app" / "material" / "[id].tsx").read_text(encoding="utf-8")
    assert "AUDIO → A → B → TRANSLATION" not in source
    assert "Make it your own." not in source


@pytest.mark.materials
def test_audio_player_shows_only_an_icon_and_slider_in_one_row():
    source = (APP / "components" / "audio-player.tsx").read_text(encoding="utf-8")
    row = re.search(r'<Row style=\{\{ gap: 10, justifyContent: "flex-start", alignItems: "center" \}\}>(.*?)</Row>', source, re.DOTALL)
    assert row, "The audio control and slider must share one row."
    assert "<Pressable" in row.group(1)
    assert 'borderRadius: 24' in row.group(1)
    assert "backgroundColor: c.secondary" in row.group(1)
    assert '<MaterialIcons name={status.playing ? "pause" : "play-arrow"}' in row.group(1)
    assert "color={c.primary}" in row.group(1)
    assert "height: 48, justifyContent: \"center\"" in row.group(1)
    assert "<Host" in row.group(1) and "<Slider" in row.group(1)
    assert 'accessibilityLabel={status.playing ? "Pause audio" : "Play audio"}' in row.group(1)
    assert "Math.floor(status.currentTime" not in source
    assert "Math.floor(status.duration" not in source


@pytest.mark.materials
def test_material_chain_mocked_success_errors_cancel_and_stale_results():
    run_typescript(
        APP / "tests" / "domain.test.ts",
        "A changes|B is durable|incomplete B|cancelled late|editing the source|chain uses fixed|no A without",
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
    run_typescript(APP / "tests" / "domain.test.ts", "defaults|invalid ranges|fixed AI configuration")
    run_typescript(APP / "tests" / "sqlite.test.ts")


def test_ai_prompt_and_parameter_form_is_disabled_but_preserved_in_comments():
    settings = (APP / "app" / "settings.tsx").read_text(encoding="utf-8")
    retired_form = (APP / "app" / "ai-settings.tsx").read_text(encoding="utf-8")
    defaults = (APP / "core" / "model.ts").read_text(encoding="utf-8")
    assert "Prompts & parameters" not in settings
    assert "Previous form implementation:" in retired_form
    assert "Save AI settings" in retired_form
    assert "temperature: 0.2, top_p: 1, max_tokens: 2048" in defaults
    assert "temperature: 0.1, top_p: 1, max_tokens: 2048" in defaults
    assert "export const B_PROMPT" in defaults
    assert "export const TRANSLATION_PROMPT" in defaults
    assert "export const CONTEXT_PROMPT" in defaults


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


@pytest.mark.materials
def test_native_disclosure_keeps_expanded_translation_in_react_native_layout():
    source = (APP / "components" / "disclosure.native.tsx").read_text(encoding="utf-8")

    assert "accessibilityState={{ expanded: open }}" in source
    assert "{open && (" in source
    assert "width: \"100%\"" in source
    assert "minWidth: 0" in source
    assert "RNHostView" not in source
    assert "onSizeChanged" not in source
