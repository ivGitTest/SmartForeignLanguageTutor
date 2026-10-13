from __future__ import annotations

from tests.helpers import (
    add_word,
    fill,
    hide_keyboard,
    open_word,
    tap,
    tap_confirm,
    tap_tab,
    text_is_visible,
    wait_text,
)


def test_dictionary_validation_duplicate_edit_search_and_delete(
    android_driver, sample_dictionary
):
    driver = android_driver
    words = sample_dictionary["words"]
    target = words[0]
    extra = {
        "expression": "test a new phrase",
        "translation": "проверить новую фразу",
        "example": "Let's test a new phrase before adding it."
    }

    # Empty required fields are rejected without creating a card.
    tap(driver, "Add")
    wait_text(driver, "Add a word")
    hide_keyboard(driver)
    tap(driver, "Save card", scroll_text="Save card")
    wait_text(driver, "Expression and translation are required.")
    driver.back()
    wait_text(driver, "Dictionary")

    # A duplicate offers the existing card instead of silently adding another.
    tap(driver, "Add")
    wait_text(driver, "Add a word")
    fill(driver, "English expression", target["expression"])
    fill(driver, "Translation · Russian", "повторный перевод")
    fill(driver, "Example sentence · optional", "A duplicate test example.")
    hide_keyboard(driver)
    tap(driver, "Save card", scroll_text="Save card")
    wait_text(driver, "This expression is already in your dictionary.")
    tap(driver, "Open existing card")
    if text_is_visible(driver, "Unsaved changes"):
        tap_confirm(driver)
    wait_text(driver, "Word card")
    assert text_is_visible(driver, target["translation"])
    driver.back()
    wait_text(driver, "Dictionary")

    # Create a distinct card, edit it, find it by its Russian translation, then delete it.
    add_word(driver, extra)
    assert text_is_visible(driver, f"Your vocabulary · {len(words) + 1}")
    open_word(driver, extra["expression"])
    fill(driver, "Translation · Russian", "обновлённый перевод")
    hide_keyboard(driver)
    tap(driver, "Save card", scroll_text="Save card")
    wait_text(driver, "Saved locally. Learning progress is unchanged.")
    driver.back()
    wait_text(driver, "Dictionary")

    fill(driver, "Search dictionary", "обновлённый перевод")
    hide_keyboard(driver)
    assert text_is_visible(driver, extra["expression"])
    tap(driver, f"Open {extra['expression']}", scroll_text=extra["expression"])
    wait_text(driver, "Word card")
    tap(driver, "Delete card", scroll_text="Delete card")
    tap_confirm(driver)
    wait_text(driver, "Dictionary")
    assert text_is_visible(driver, "No matching words")
    fill(driver, "Search dictionary", "")
    assert text_is_visible(driver, f"Your vocabulary · {len(words)}")


def test_dictionary_tabs_and_vocabulary_controls(android_driver, sample_dictionary):
    driver = android_driver
    tap_tab(driver, "Dictionary")
    assert text_is_visible(driver, "Your words. Ready when you are.")
    assert text_is_visible(driver, "Search dictionary")
    assert text_is_visible(driver, "Start learning · 10 cards")
    tap(driver, "Add")
    wait_text(driver, "Add a word")
    assert text_is_visible(driver, "Save card")
    driver.back()
    wait_text(driver, "Dictionary")
