from __future__ import annotations

from tests.helpers import tap, tap_tab, text_is_visible, wait_text


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
    wait_text(driver, "Learning")

    # Reach the local key-management and AI-settings screens without entering a key
    # or sending any generation request.
    tap(driver, "Settings")
    wait_text(driver, "Settings")
    tap(driver, "Connect or manage key", scroll_text="Connect or manage key")
    wait_text(driver, "Connect or manage key")
    driver.back()
    wait_text(driver, "Settings")
    tap(driver, "Prompts & parameters", scroll_text="Prompts & parameters")
    wait_text(driver, "AI settings")
    assert text_is_visible(driver, "B · Improve to B2")
    driver.back()
    wait_text(driver, "Settings")
    driver.back()
    wait_text(driver, "Dictionary")

    # A nested add-card route is reachable and returns to the dictionary.
    tap(driver, "Add")
    wait_text(driver, "Add a word")
    driver.back()
    wait_text(driver, "Dictionary")
