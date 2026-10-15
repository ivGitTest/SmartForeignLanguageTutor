from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import uuid4

import pytest
from selenium.webdriver.support.ui import WebDriverWait

from tests.helpers import (
    assert_app_healthy, fill, go_back, hide_keyboard, open_word, save_material,
    tap, tap_confirm, tap_tab, text_is_visible, wait_accessible, wait_text,
)

APP_PACKAGE = "com.englishlab.mobile"
APP_ROOT = Path(__file__).resolve().parents[1]

# Each page route (not navigator layouts) has an explicit round-trip test below.
SCREEN_TESTS = {
    "(tabs)/index": "test_primary_tab_round_trips",
    "(tabs)/materials": "test_primary_tab_round_trips",
    "(tabs)/learning": "test_primary_tab_round_trips",
    "settings": "test_settings_returns_to_originating_tab",
    "key-connection": "test_nested_settings_round_trip",
    "ai-settings": "test_ai_settings_route_redirects_to_settings",
    "word/[id]": "test_word_screen_round_trip",
    "material/[id]": "test_material_back_returns_to_list",
    "+not-found": "test_missing_routes_have_a_working_exit",
}


def assert_primary_screen(driver, title):
    if title == "Learning":
        WebDriverWait(driver, 12).until(lambda current: any(
            text_is_visible(current, label) for label in (
                "Show answer", "How well did you remember?", "Nicely done.",
                "All caught up", "No cards yet",
            )
        ))
    else:
        wait_accessible(driver, "Search dictionary" if title == "Dictionary" else "New recording")
    assert_app_healthy(driver)


@pytest.mark.parametrize("origin", ["Dictionary", "Materials", "Learning"])
@pytest.mark.parametrize("destination", ["Dictionary", "Materials", "Learning"])
def test_primary_tab_round_trips(android_driver, sample_dictionary, origin, destination):
    driver = android_driver
    tap_tab(driver, origin)
    tap_tab(driver, destination)
    assert_primary_screen(driver, destination)
    tap_tab(driver, origin)
    assert_primary_screen(driver, origin)


@pytest.mark.parametrize("origin", ["Dictionary", "Materials", "Learning"])
@pytest.mark.parametrize("back", ["header", "system"])
def test_settings_returns_to_originating_tab(android_driver, sample_dictionary, origin, back):
    driver = android_driver
    tap_tab(driver, origin)
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    go_back(driver, back)
    # Check actual screen content, not a tab label which is always visible.
    assert_primary_screen(driver, origin)


@pytest.mark.parametrize("back", ["header", "system"])
def test_nested_settings_round_trip(android_driver, sample_dictionary, back):
    driver = android_driver
    tap_tab(driver, "Dictionary")
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    tap(driver, "Connect or manage key", scroll_text="Connect or manage key")
    wait_text(driver, "Connect your own key")
    assert_app_healthy(driver)
    go_back(driver, back)
    wait_accessible(driver, "Connect or manage key")
    go_back(driver, back)
    wait_accessible(driver, "Search dictionary")


@pytest.mark.parametrize("back", ["header", "system"])
@pytest.mark.parametrize("kind", ["new", "existing", "unsaved"])
def test_word_screen_round_trip(android_driver, sample_dictionary, kind, back):
    driver = android_driver
    tap_tab(driver, "Dictionary")
    if kind == "existing":
        open_word(driver, sample_dictionary["words"][0]["expression"])
    else:
        tap(driver, "Add")
        wait_text(driver, "Add a word")
        if kind == "unsaved":
            fill(driver, "English expression", "unsaved navigation draft")
            hide_keyboard(driver)
    go_back(driver, back)
    if kind == "unsaved":
        wait_text(driver, "Unsaved changes")
        tap_confirm(driver)
    wait_accessible(driver, "Search dictionary")
    assert_app_healthy(driver)


@pytest.mark.parametrize("back", ["header", "system"])
@pytest.mark.parametrize("playing", [False, True], ids=["idle", "playing"])
def test_material_back_returns_to_list(
    android_driver, sample_dictionary, material_titles, back, playing
):
    driver = android_driver
    title = f"pytest-navigation-{uuid4().hex[:8]}"
    tap_tab(driver, "Materials")
    save_material(driver, title, seconds=6 if playing else 1.8)
    material_titles.append(title)
    # First close the material reached after Save, then repeatedly open its list row.
    for _ in range(3):
        if playing:
            tap(driver, "Play audio")
            wait_accessible(driver, "Pause audio", timeout=3)
        go_back(driver, back)
        wait_accessible(driver, f"Open {title}")
        assert_app_healthy(driver)
        tap(driver, f"Open {title}", scroll_text=title)
        wait_text(driver, "Make it your own.")
        assert wait_accessible(driver, "Material title").get_attribute("text") == title
    go_back(driver, back)
    wait_accessible(driver, f"Open {title}")
    # Also exercise the alternative entry point; no AI requests are made.
    tap(driver, "Continue last material", scroll_text="Continue last material")
    wait_text(driver, "Make it your own.")
    go_back(driver, back)
    wait_accessible(driver, f"Open {title}")
    assert_app_healthy(driver)


@pytest.mark.parametrize("path,message,exit_label,destination", [
    ("missing-pytest-screen", "This screen doesn't exist.", "Go to home screen!", "Search dictionary"),
    ("material/missing-pytest-material", "Material no longer exists", "Materials", "New recording"),
    ("word/missing-pytest-card", "Card no longer exists", "Dictionary", "Search dictionary"),
])
def test_missing_routes_have_a_working_exit(
    android_driver, sample_dictionary, path, message, exit_label, destination
):
    driver = android_driver
    driver.execute_script("mobile: deepLink", {
        "url": f"mobile-app:///{path}", "package": APP_PACKAGE,
    })
    wait_text(driver, message)
    assert_app_healthy(driver)
    # The not-found page is an Expo Link, not one of our accessible Buttons.
    wait_text(driver, exit_label).click()
    wait_accessible(driver, destination)
    assert_app_healthy(driver)


def assert_app_version_is_present(driver) -> None:
    app_version = json.loads((APP_ROOT / "app.json").read_text(encoding="utf-8"))["expo"]["version"]
    assert "Version:" in driver.page_source
    assert re.search(rf"{re.escape(app_version)} · (?:Build \d+|Preview)", driver.page_source)


def test_primary_modes_and_nested_screens_are_reachable(
    android_driver, sample_dictionary
):
    driver = android_driver

    tap_tab(driver, "Dictionary")
    wait_text(driver, "Dictionary")
    assert text_is_visible(driver, "Smart Lang Tutor")

    tap_tab(driver, "Materials")
    wait_text(driver, "Materials")

    tap_tab(driver, "Learning")
    assert any(text_is_visible(driver, label) for label in (
        "Show answer", "How well did you remember?", "Nicely done.", "All caught up"
    ))
    tap_tab(driver, "Dictionary")

    # Reach local key management without entering a key or sending an AI request.
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    assert_app_version_is_present(driver)
    tap(driver, "Connect or manage key", scroll_text="Connect or manage key")
    wait_text(driver, "Connect your own key")
    driver.back()
    wait_text(driver, "Settings")
    driver.back()
    wait_text(driver, "Dictionary")


def test_ai_settings_route_redirects_to_settings(android_driver, sample_dictionary):
    """The retired form route redirects, including when opened from an old link."""
    driver = android_driver
    driver.execute_script("mobile: deepLink", {
        "url": "mobile-app:///ai-settings", "package": APP_PACKAGE,
    })
    wait_text(driver, "Settings")
    wait_accessible(driver, "Connect or manage key")
    assert not text_is_visible(driver, "Save AI settings")
    assert_app_healthy(driver)


@pytest.mark.parametrize("link", ["Open provider account page", "@ivTelegram"])
def test_external_links_open_a_handler_and_return_to_app(android_driver, sample_dictionary, link):
    driver = android_driver
    tap_tab(driver, "Dictionary")
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    if link == "Open provider account page":
        tap(driver, "Connect or manage key", scroll_text="Connect or manage key")
        wait_text(driver, "Connect your own key")
    tap(driver, link, scroll_text=link)
    try:
        WebDriverWait(driver, 15).until(lambda current: current.current_package != APP_PACKAGE)
    finally:
        driver.activate_app(APP_PACKAGE)
    tap_tab(driver, "Dictionary")

    # A nested add-card route is reachable and returns to the dictionary.
    tap(driver, "Add")
    wait_text(driver, "Add a word")
    driver.back()
    wait_text(driver, "Dictionary")
