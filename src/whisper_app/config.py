import json
import os
from pathlib import Path
from typing import Optional

_CONFIG_DIR = Path.home() / ".whisper_app"
_CONFIG_FILE = _CONFIG_DIR / "config.json"

_DEFAULTS = {
    "hotkey": "alt",
    "model": "base",
    "language": None,
    "device": "cpu",
}


def load() -> dict:
    if not _CONFIG_FILE.exists():
        return dict(_DEFAULTS)
    with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {**_DEFAULTS, **data}


def save(config: dict) -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
