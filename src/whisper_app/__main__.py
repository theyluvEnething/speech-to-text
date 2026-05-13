"""
Whisper — push-to-talk speech-to-text
Entry point: python -m whisper_app  (run from src/)
"""

import sys
import threading
from pynput import keyboard as kb

from whisper_app import config as cfg
from whisper_app.core.audio import AudioRecorder
from whisper_app.core.transcriber import load_model, transcribe
from whisper_app.core.paste import paste_text
from whisper_app.ui.overlay import Overlay
from whisper_app.ui.tray import TrayIcon
from whisper_app.ui.settings import SettingsWindow


class WhisperApp:
    def __init__(self):
        self._conf = cfg.load()
        self._recorder = AudioRecorder()
        self._overlay = Overlay()
        self._recording = False
        self._lock = threading.Lock()

        self._settings_win = SettingsWindow(on_save=self._on_settings_saved)
        self._tray = TrayIcon(
            on_settings=self._settings_win.open,
            on_quit=self._quit,
        )

    # ------------------------------------------------------------------
    # Lifecycle

    def run(self) -> None:
        print("[Whisper] Loading model…")
        load_model(self._conf["model"], self._conf["device"])
        print(f"[Whisper] Ready. Hold {self._conf['hotkey'].upper()} to record.")

        self._tray.start()
        self._start_hotkey_listener()

    def _quit(self) -> None:
        print("[Whisper] Goodbye.")
        sys.exit(0)

    # ------------------------------------------------------------------
    # Hotkey listener

    def _start_hotkey_listener(self) -> None:
        hotkey_name = self._conf["hotkey"]
        target_key = _resolve_key(hotkey_name)

        def on_press(key):
            with self._lock:
                if self._recording:
                    return
                if _key_matches(key, target_key):
                    self._recording = True
                    self._overlay.show_recording()
                    self._recorder.start()

        def on_release(key):
            with self._lock:
                if not self._recording:
                    return
                if _key_matches(key, target_key):
                    self._recording = False

            # Run transcription off the main thread so the listener stays responsive
            threading.Thread(target=self._finish_recording, daemon=True).start()

        with kb.Listener(on_press=on_press, on_release=on_release) as listener:
            listener.join()  # blocks until the listener is stopped

    def _finish_recording(self) -> None:
        self._overlay.show_processing()
        wav = self._recorder.stop()
        if not wav:
            self._overlay.hide()
            return
        text = transcribe(wav, language=self._conf.get("language"))
        print(f"[Whisper] → {text!r}")
        self._overlay.show_result(text)
        paste_text(text)

    # ------------------------------------------------------------------
    # Settings

    def _on_settings_saved(self, new_conf: dict) -> None:
        self._conf = new_conf
        load_model(new_conf["model"], new_conf["device"])
        print(f"[Whisper] Settings saved. Hotkey: {new_conf['hotkey'].upper()}, Model: {new_conf['model']}")


# ------------------------------------------------------------------
# Key helpers

def _resolve_key(name: str):
    try:
        return kb.Key[name]
    except KeyError:
        return kb.KeyCode.from_char(name)


def _key_matches(pressed, target) -> bool:
    if isinstance(target, kb.Key):
        return pressed == target
    if isinstance(target, kb.KeyCode):
        return pressed == target
    return False


# ------------------------------------------------------------------

if __name__ == "__main__":
    WhisperApp().run()
