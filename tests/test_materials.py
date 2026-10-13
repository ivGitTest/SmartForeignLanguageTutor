from __future__ import annotations

import time
from uuid import uuid4

from appium.webdriver.common.appiumby import AppiumBy

from tests.helpers import (
    delete_material_from_detail,
    fill,
    hide_keyboard,
    record_to_pending,
    save_material,
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
    suffix = uuid4().hex[:8]
    older = f"pytest-material-{suffix}-older"
    newer = f"pytest-material-{suffix}-newer"

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
    assert text_is_visible(driver, "Your materials · 0")

    # Stopping creates a pending recording; discarding it also needs no confirmation.
    record_to_pending(driver)
    tap(driver, "Discard recording")
    wait_accessible(driver, "New recording")
    assert text_is_visible(driver, "Your materials · 0")

    # Save two native recordings so that sort order and last-material navigation are real.
    save_material(driver, older)
    material_titles.append(older)
    tap_tab(driver, "Materials")
    time.sleep(0.15)
    save_material(driver, newer)
    material_titles.append(newer)
    tap_tab(driver, "Materials")
    wait_text(driver, "Your materials · 2")
    assert text_is_visible(driver, "Newest first")

    source = driver.page_source
    newer_position = source.find(f'content-desc="Open {newer}"')
    older_position = source.find(f'content-desc="Open {older}"')
    assert newer_position >= 0 and older_position >= 0
    assert newer_position < older_position, "Materials should be sorted newest first."

    # Local search filters titles and opening either row updates the last-material link.
    fill(driver, "Search materials", older)
    hide_keyboard(driver)
    wait_accessible(driver, f"Open {older}")
    assert not driver.find_elements(AppiumBy.ACCESSIBILITY_ID, f"Open {newer}")
    fill(driver, "Search materials", "")
    hide_keyboard(driver)
    tap(driver, "Continue last material", scroll_text="Continue last material")
    wait_text(driver, "Make it your own.")
    title_field = wait_accessible(driver, "Material title")
    assert title_field.get_attribute("text") == newer

    tap_tab(driver, "Materials")
    tap(driver, f"Open {older}", scroll_text=older)
    wait_text(driver, "Make it your own.")
    tap_tab(driver, "Materials")
    tap(driver, "Continue last material", scroll_text="Continue last material")
    wait_text(driver, "Make it your own.")
    assert wait_accessible(driver, "Material title").get_attribute("text") == older

    # Playback is local. Never press Transcribe, Improve, Translate, or other AI actions.
    tap(driver, "Play audio")
    try:
        wait_accessible(driver, "Pause audio", timeout=1.5)
        tap(driver, "Pause audio", timeout=2)
    except Exception:
        # A short recording may finish between the play press and the next UI update.
        pass

    # Removing audio leaves the material record, then whole-material deletion removes it.
    tap(driver, "Delete options")
    tap(driver, "Delete audio only", scroll_text="Delete audio only")
    tap_confirm(driver)
    wait_text(
        driver,
        "Audio was removed. Your saved texts are retained; re-transcription is unavailable.",
    )
    assert wait_accessible(driver, "Material title").get_attribute("text") == older
    delete_material_from_detail(driver)
    wait_accessible(driver, f"Open {newer}")
    material_titles.remove(older)

    tap(driver, f"Open {newer}", scroll_text=newer)
    wait_text(driver, "Make it your own.")
    delete_material_from_detail(driver)
    wait_text(driver, "A place for your English")
    material_titles.remove(newer)
