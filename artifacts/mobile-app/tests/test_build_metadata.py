from __future__ import annotations

import json
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def test_eas_builds_use_the_remote_auto_incrementing_build_number():
    config = json.loads((APP_ROOT / "eas.json").read_text(encoding="utf-8"))

    assert config["cli"]["appVersionSource"] == "remote"
    assert config["build"]["base"]["autoIncrement"] is True
    for profile in ("preview", "production"):
        assert config["build"][profile]["extends"] == "base"
