from __future__ import annotations

import time
import re

from appium.webdriver.common.appiumby import AppiumBy

from tests.helpers import (
    delete_material_from_detail,
    fill,
    hide_keyboard,
    record_to_pending,
    save_material,
    scroll_to_text,
    tap,
    tap_confirm,
    tap_tab,
    text_is_visible,
    wait_accessible,
    wait_text,
)


def test_record_discard_save_search_resume_sort_and_delete(
    android_driver, material_titles, sample_dictionary
):
    driver = android_driver
    tap_tab(driver, "Materials")
    wait_text(driver, "A place for your English")

    # Discarding an in-progress recording returns directly to the recorder.
    tap(driver, "New recording")
    if text_is_visible(driver, "Microphone access"):
        tap_confirm(driver)
    wait_accessible(driver, "Stop recording", timeout=20)
    time.sleep(1.8)
    tap(driver, "Discard recording")
    wait_accessible(driver, "New recording")
    assert not text_is_visible(driver, "Something went wrong")
    assert not text_is_visible(driver, "Please reload the app to continue.")
    assert text_is_visible(driver, "Your materials · 0")

    # Stopping creates a pending recording; discarding it also needs no confirmation.
    record_to_pending(driver)
    tap(driver, "Discard recording")
    wait_accessible(driver, "New recording")
    assert not text_is_visible(driver, "Something went wrong")
    assert not text_is_visible(driver, "Please reload the app to continue.")
    assert text_is_visible(driver, "Your materials · 0")

    # Save two native recordings so that sort order and last-material navigation are real.
    older = save_material(driver, seconds=4)
    material_titles.append(older)
    tap_tab(driver, "Materials")
    time.sleep(0.15)
    newer = save_material(driver)
    material_titles.append(newer)
    assert re.fullmatch(r"\d{2}\.\d{2}\.\d{4}/\d{2}:\d{2}:\d{2}/\d+s", older)
    assert re.fullmatch(r"\d{2}\.\d{2}\.\d{4}/\d{2}:\d{2}:\d{2}/\d+s", newer)
    tap_tab(driver, "Materials")
    wait_text(driver, "Your materials · 2")
    assert text_is_visible(driver, "Newest first")

    source = driver.page_source
    newer_position = source.find(f'content-desc="Open {newer}"')
    older_position = source.find(f'content-desc="Open {older}"')
    assert newer_position >= 0 and older_position >= 0
    assert newer_position < older_position, "Materials should be sorted newest first."

    content_metadata = driver.find_element(
        AppiumBy.XPATH,
        f"//*[@content-desc and contains(@content-desc, 'Available content for {newer}:')]",
    )
    assert not driver.find_elements(
        AppiumBy.XPATH,
        "//*[@content-desc and contains(@content-desc, 'Date and duration for')]",
    ), "The title already contains the date and duration; do not repeat them."
    open_row = wait_accessible(driver, f"Open {newer}")
    assert content_metadata.rect["x"] > open_row.rect["x"] + open_row.rect["width"] / 2, (
        "Artifact statuses should remain right-aligned in the material card."
    )

    # Local search filters titles and opening either row updates the last-material link.
    fill(driver, "Search materials", older)
    hide_keyboard(driver)
    wait_accessible(driver, f"Open {older}")
    assert not driver.find_elements(AppiumBy.ACCESSIBILITY_ID, f"Open {newer}")
    fill(driver, "Search materials", "")
    hide_keyboard(driver)
    tap(driver, "Continue last material", scroll_text="Continue last material")
    wait_accessible(driver, f"Material title: {newer}")
    assert not driver.find_elements(AppiumBy.ACCESSIBILITY_ID, "Material title")
    assert not driver.find_elements(AppiumBy.ACCESSIBILITY_ID, "Save title")

    tap_tab(driver, "Materials")
    tap(driver, f"Open {older}", scroll_text=older)
    wait_accessible(driver, f"Material title: {older}")
    tap_tab(driver, "Materials")
    tap(driver, "Continue last material", scroll_text="Continue last material")
    wait_accessible(driver, f"Material title: {older}")

    # Playback is local. Never press Transcribe, Improve, Translate, or other AI actions.
    tap(driver, "Play audio")
    wait_accessible(driver, "Pause audio", timeout=3)
    tap(driver, "Pause audio", timeout=2)
    wait_accessible(driver, "Play audio", timeout=3)

    # Removing audio leaves the material record, then whole-material deletion removes it.
    tap(driver, "Delete options")
    tap(driver, "Delete audio only", scroll_text="Delete audio only")
    tap_confirm(driver)
    scroll_to_text(driver, "Audio was removed. Your saved texts are retained; re-transcription is unavailable.")
    wait_text(
        driver,
        "Audio was removed. Your saved texts are retained; re-transcription is unavailable.",
    )
    scroll_to_text(driver, older)
    assert wait_accessible(driver, f"Material title: {older}")
    scroll_to_text(driver, "Transcribe · A")
    assert not wait_accessible(driver, "Transcribe · A").is_enabled()
    delete_material_from_detail(driver)
    wait_accessible(driver, f"Open {newer}")
    material_titles.remove(older)

    tap(driver, f"Open {newer}", scroll_text=newer)
    wait_accessible(driver, f"Material title: {newer}")
    delete_material_from_detail(driver)
    wait_text(driver, "A place for your English")
    material_titles.remove(newer)
