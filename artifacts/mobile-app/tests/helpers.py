from __future__ import annotations

import json
import time
from pathlib import Path

from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as expected
from selenium.webdriver.support.ui import WebDriverWait


def _quoted(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _text_locator(value: str) -> tuple[str, str]:
    return (
        AppiumBy.ANDROID_UIAUTOMATOR,
        f"new UiSelector().text({_quoted(value)})",
    )


def wait_text(driver, value: str, timeout: float = 12):
    locator = _text_locator(value)
    return WebDriverWait(driver, timeout).until(
        lambda current: next(
            (
                element
                for element in (
                    current.find_elements(*locator)
                    + current.find_elements(AppiumBy.ACCESSIBILITY_ID, value)
                )
                if element.is_displayed()
            ),
            False,
        )
    )


def text_is_visible(driver, value: str) -> bool:
    elements = driver.find_elements(*_text_locator(value)) + driver.find_elements(AppiumBy.ACCESSIBILITY_ID, value)
    return any(element.is_displayed() for element in elements)


def wait_accessible(driver, label: str, timeout: float = 12):
    return WebDriverWait(driver, timeout).until(
        expected.visibility_of_element_located((AppiumBy.ACCESSIBILITY_ID, label))
    )


def scroll_to_text(driver, value: str, timeout: float = 10) -> None:
    locator = (
        AppiumBy.ANDROID_UIAUTOMATOR,
        "new UiScrollable(new UiSelector().scrollable(true))"
        f".setMaxSearchSwipes(10).scrollTextIntoView({_quoted(value)})",
    )
    WebDriverWait(driver, timeout).until(
        lambda current: current.find_element(*locator).is_displayed()
    )


def tap(driver, label: str, *, scroll_text: str | None = None, timeout: float = 12) -> None:
    locator = (AppiumBy.ACCESSIBILITY_ID, label)
    try:
        WebDriverWait(driver, min(timeout, 3)).until(
            expected.element_to_be_clickable(locator)
        ).click()
        return
    except TimeoutException:
        scroll_to_text(driver, scroll_text or label, timeout=timeout)
    WebDriverWait(driver, timeout).until(
        expected.element_to_be_clickable(locator)
    ).click()


def tap_text(driver, value: str, timeout: float = 12) -> None:
    wait_text(driver, value, timeout).click()


def fill(driver, label: str, value: str, timeout: float = 12) -> None:
    if not any(element.is_displayed() for element in driver.find_elements(AppiumBy.ACCESSIBILITY_ID, label)):
        scroll_to_text(driver, label, timeout)
    field = wait_accessible(driver, label, timeout)
    field.click()
    field.clear()
    if value:
        field.send_keys(value)


def hide_keyboard(driver) -> None:
    try:
        driver.hide_keyboard()
    except Exception:
        # Some Android keyboard implementations close as soon as the form scrolls.
        pass


def tap_tab(driver, title: str) -> None:
    # Detail screens are on the root Stack, outside the tab navigator.
    # Return to the tabs before switching modes; do not press a heading that
    # happens to have the same text as a tab.
    def tab_labels(label):
        elements = driver.find_elements(*_text_locator(label))
        elements += driver.find_elements(
            AppiumBy.ANDROID_UIAUTOMATOR,
            f"new UiSelector().descriptionMatches({_quoted(label + '(,.*)?')})",
        )
        return [element for element in elements if element.is_displayed()]

    for _ in range(5):
        if all(tab_labels(tab) for tab in ("Dictionary", "Materials", "Learning")):
            break
        driver.back()
        time.sleep(0.3)
    else:
        raise AssertionError("Could not return to the three primary tabs.")
    visible = tab_labels(title)
    assert visible, f"Tab {title!r} is not visible"
    visible[-1].click()
    assert tab_labels(title), f"Tab {title!r} disappeared after navigation"


def tap_confirm(driver, timeout: float = 12) -> None:
    tap_text(driver, "Confirm", timeout)


def load_sample_data() -> dict:
    return json.loads(
        (Path(__file__).parent / "fixtures" / "sample-data.json").read_text(
            encoding="utf-8"
        )
    )


def add_word(driver, word: dict) -> None:
    tap(driver, "Add")
    wait_text(driver, "Add a word")
    fill(driver, "English expression", word["expression"])
    fill(driver, "Translation · Russian", word["translation"])
    fill(driver, "Example sentence · optional", word["example"])
    hide_keyboard(driver)
    tap(driver, "Save card", scroll_text="Save card")
    wait_text(driver, word["expression"])


def open_word(driver, expression: str) -> None:
    tap(
        driver,
        f"Open {expression}",
        scroll_text=expression,
    )
    wait_text(driver, "Word card")


def record_to_pending(driver, *, seconds: float = 1.8) -> None:
    tap(driver, "New recording")
    if text_is_visible(driver, "Microphone access"):
        tap_confirm(driver)
    wait_accessible(driver, "Stop recording", timeout=20)
    time.sleep(seconds)
    tap(driver, "Stop recording", timeout=10)
    wait_accessible(driver, "Save recording", timeout=20)


def save_material(driver, title: str, *, seconds: float = 1.8) -> None:
    record_to_pending(driver, seconds=seconds)
    tap(driver, "Save recording")
    wait_text(driver, "Make it your own.")
    field = wait_accessible(driver, "Material title")
    field.clear()
    field.send_keys(title)
    hide_keyboard(driver)
    tap(driver, "Save title", scroll_text="Save title")
    assert wait_accessible(driver, "Material title").get_attribute("text") == title


def delete_material_from_detail(driver) -> None:
    if text_is_visible(driver, "Delete options"):
        # Expanding an already-open disclosure collapses it, hiding the delete actions.
        delete_actions = driver.find_elements(
            AppiumBy.ACCESSIBILITY_ID, "Delete material and texts"
        )
        if not any(element.is_displayed() for element in delete_actions):
            tap(driver, "Delete options")
    tap(driver, "Delete material and texts", scroll_text="Delete material and texts")
    tap_confirm(driver)
