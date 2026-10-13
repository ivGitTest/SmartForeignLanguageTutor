from __future__ import annotations

import os
from pathlib import Path

import pytest
from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.appium_service import AppiumService

from tests.helpers import (
    add_word,
    load_sample_data,
    open_word,
    tap,
    tap_confirm,
    tap_tab,
    text_is_visible,
    wait_text,
)

APP_PACKAGE = "com.englishlab.mobile"
PROJECT_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def android_driver():
    apk_value = os.environ.get("SMART_LANG_TUTOR_APK")
    serial = os.environ.get("ANDROID_SERIAL")
    if not apk_value:
        raise pytest.UsageError(
            "Set SMART_LANG_TUTOR_APK to the locally downloaded Android APK."
        )
    if not serial:
        raise pytest.UsageError(
            "Set ANDROID_SERIAL to the Android emulator/device from `adb devices`."
        )
    apk = Path(apk_value).expanduser().resolve()
    if not apk.is_file():
        raise pytest.UsageError(f"Android APK does not exist: {apk}")

    port = int(os.environ.get("APPIUM_PORT", "4723"))
    service = AppiumService()
    service.start(args=["--address", "127.0.0.1", "--port", str(port)])
    if not service.is_running:
        raise pytest.UsageError(
            "Could not start the Appium server. Check the Appium installation and logs."
        )

    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = serial
    options.udid = serial
    options.app_package = APP_PACKAGE
    options.app_activity = ".MainActivity"
    options.no_reset = True
    options.auto_grant_permissions = True
    options.new_command_timeout = 180

    driver = None
    try:
        driver = webdriver.Remote(service.service_url, options=options)
        driver.implicitly_wait(1)
        yield driver
    finally:
        if driver is not None:
            driver.quit()
        service.stop()


@pytest.fixture(scope="session", autouse=True)
def require_empty_test_app(android_driver):
    """Refuse to run against existing vocabulary or materials; never clear app data."""
    wait_text(android_driver, "Dictionary", timeout=45)
    if not text_is_visible(android_driver, "Your first word starts here"):
        pytest.fail(
            "The test APK already contains dictionary data. Use an empty test app/"
            "emulator; this suite will not clear or overwrite saved data."
        )

    tap_tab(android_driver, "Materials")
    if not text_is_visible(android_driver, "A place for your English"):
        pytest.fail(
            "The test APK already contains materials. Use an empty test app/"
            "emulator; this suite will not clear or overwrite saved data."
        )
    tap_tab(android_driver, "Dictionary")


@pytest.fixture(scope="session")
def sample_dictionary(android_driver, require_empty_test_app):
    """Add realistic B1 phrasal verbs through the same forms used by the learner."""
    sample = load_sample_data()
    created: list[str] = []
    for word in sample["words"]:
        add_word(android_driver, word)
        created.append(word["expression"])

    yield sample

    # Remove only cards this fixture created, via the normal app UI.
    tap_tab(android_driver, "Dictionary")
    search = android_driver.find_elements(
        "accessibility id", "Search dictionary"
    )
    if search:
        search[0].clear()
    for expression in reversed(created):
        matches = android_driver.find_elements(
            "accessibility id", f"Open {expression}"
        )
        if not matches:
            continue
        open_word(android_driver, expression)
        tap(
            android_driver,
            "Delete card",
            scroll_text="Delete card",
        )
        tap_confirm(android_driver)
        wait_text(android_driver, "Dictionary")


@pytest.fixture
def material_titles(android_driver):
    """Track material records so a failed test can clean its own test data."""
    titles: list[str] = []
    yield titles

    tap_tab(android_driver, "Materials")
    for title in titles:
        rows = android_driver.find_elements("accessibility id", f"Open {title}")
        if not rows:
            continue
        tap(android_driver, f"Open {title}", scroll_text=title)
        wait_text(android_driver, "Make it your own.")
        delete_material_from_detail(android_driver)
        wait_text(android_driver, "Materials")
