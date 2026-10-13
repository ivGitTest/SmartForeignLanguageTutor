from __future__ import annotations

import pytest
from selenium.webdriver.support.ui import WebDriverWait

from tests.helpers import fill, hide_keyboard, scroll_to_text, tap, tap_confirm, tap_tab, text_is_visible, wait_accessible, wait_text

APP_PACKAGE = "com.englishlab.mobile"


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

    # Reach the local key-management and AI-settings screens without entering a key
    # or sending any generation request.
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    tap(driver, "Connect or manage key", scroll_text="Connect or manage key")
    wait_text(driver, "Connect your own key")
    driver.back()
    wait_text(driver, "Settings")
    tap(driver, "Prompts & parameters", scroll_text="Prompts & parameters")
    wait_text(driver, "AI settings")
    assert text_is_visible(driver, "B · Improve to B2")
    driver.back()
    wait_text(driver, "Settings")
    driver.back()
    wait_text(driver, "Dictionary")


def test_ai_settings_edit_save_reopen_and_restore_without_requests(android_driver, sample_dictionary):
    driver = android_driver
    tap_tab(driver, "Dictionary")
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    tap(driver, "Prompts & parameters", scroll_text="Prompts & parameters")
    wait_text(driver, "AI settings")
    assert not driver.find_elements("accessibility id", "B instruction")
    fill(driver, "A temperature · 0–1", "0.3")
    hide_keyboard(driver)
    tap(driver, "Edit B instruction")
    scroll_to_text(driver, "B instruction")
    original = wait_accessible(driver, "B instruction").get_attribute("text")
    fill(driver, "B instruction", "Improve to B2 without changing the meaning. Test instruction.")
    hide_keyboard(driver)
    tap(driver, "Save AI settings", scroll_text="Save AI settings")
    wait_text(driver, "AI settings saved locally. Older B or Translation may now be out of date.")
    driver.back()
    wait_text(driver, "Settings")
    tap(driver, "Prompts & parameters", scroll_text="Prompts & parameters")
    wait_text(driver, "AI settings")
    assert wait_accessible(driver, "A temperature · 0–1").get_attribute("text") == "0.3"
    tap(driver, "Edit B instruction")
    scroll_to_text(driver, "B instruction")
    assert wait_accessible(driver, "B instruction").get_attribute("text").endswith("Test instruction.")
    driver.back()
    if text_is_visible(driver, "Unsaved changes"):
        tap_confirm(driver)
    wait_text(driver, "Settings")
    tap(driver, "Restore defaults…", scroll_text="Restore defaults…")
    tap_confirm(driver)
    tap(driver, "Prompts & parameters", scroll_text="Prompts & parameters")
    wait_text(driver, "AI settings")
    assert wait_accessible(driver, "A temperature · 0–1").get_attribute("text") != "0.3"
    tap(driver, "Edit B instruction")
    scroll_to_text(driver, "B instruction")
    assert wait_accessible(driver, "B instruction").get_attribute("text") == original
    tap_tab(driver, "Dictionary")


@pytest.mark.parametrize("link", ["Open provider account page", "@ivTelegram"])
def test_external_links_open_a_handler_and_return_to_app(android_driver, sample_dictionary, link):
    driver = android_driver
    tap_tab(driver, "Dictionary")
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    if link == "Open provider account page":
        tap(driver, "Connect or manage key", scroll_text="Connect or manage key")
        wait_text(driver, "Connect your own key")
    tap(driver, link, scroll_text=("@ivTelegram →" if link == "@ivTelegram" else link))
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
