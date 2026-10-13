from __future__ import annotations

from tests.helpers import (
    open_word,
    tap,
    tap_confirm,
    tap_tab,
    text_is_visible,
    wait_text,
)


def test_ten_card_session_reveal_ratings_resume_and_reset(
    android_driver, sample_dictionary
):
    driver = android_driver
    words = sample_dictionary["words"]

    tap_tab(driver, "Dictionary")
    tap(driver, "Start learning · 10 cards")
    wait_text(driver, "1 / 10")
    assert not text_is_visible(driver, words[0]["translation"])

    tap(driver, "Show answer")
    wait_text(driver, words[0]["translation"])
    for grade in ("Again", "Hard", "Good", "Easy"):
        assert text_is_visible(driver, grade)

    # Save the first grade, switch modes, then relaunch the app to check recovery.
    tap(driver, "Again")
    wait_text(driver, "2 / 10")
    tap_tab(driver, "Materials")
    wait_text(driver, "Materials")
    tap_tab(driver, "Learning")
    wait_text(driver, "2 / 10")

    driver.terminate_app("com.englishlab.mobile")
    driver.activate_app("com.englishlab.mobile")
    wait_text(driver, "Dictionary", timeout=45)
    assert text_is_visible(driver, "Resume learning")
    tap(driver, "Resume learning")
    wait_text(driver, "2 / 10")

    # Exercise all four SM-2 ratings through the UI; no AI feature is involved.
    remaining_grades = ("Hard", "Good", "Easy", "Good", "Hard", "Easy", "Good", "Hard", "Easy")
    for index, grade in enumerate(remaining_grades, start=2):
        wait_text(driver, f"{index} / 10")
        tap(driver, "Show answer")
        assert text_is_visible(driver, grade)
        tap(driver, grade)

    wait_text(driver, "Nicely done.")
    wait_text(driver, "10 cards reviewed")
    assert text_is_visible(driver, "Continue learning")
    assert text_is_visible(driver, "Exit to Dictionary")

    # Exit and continue are separate working paths after a completed session.
    tap(driver, "Exit to Dictionary")
    wait_text(driver, "Dictionary")
    tap_tab(driver, "Learning")
    wait_text(driver, "Nicely done.")
    tap(driver, "Continue learning")
    if not text_is_visible(driver, "All caught up"):
        # Again may become due during a long test run; finish that one-card session.
        wait_text(driver, "1 / 1")
        tap(driver, "Show answer")
        tap(driver, "Easy")
        wait_text(driver, "Nicely done.")
        tap(driver, "Continue learning")
    wait_text(driver, "All caught up")

    tap(driver, "Open Dictionary")
    wait_text(driver, "Dictionary")
    open_word(driver, words[0]["expression"])
    tap(driver, "Reset learning progress", scroll_text="Reset learning progress")
    tap_confirm(driver)
    wait_text(driver, "New card · not reviewed yet")
    driver.back()
    wait_text(driver, "Dictionary")
