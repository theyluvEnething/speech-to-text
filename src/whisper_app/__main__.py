"""
Whisper — push-to-talk speech-to-text
Entry point: python -m whisper_app  (run from src/)
"""

import math
import sys
import threading
import time
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
        self._vu_running = False
        self._finishing = False
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
        print(f"[Whisper] Hotkey listener active. Target key: {target_key}")

        def on_press(key):
            with self._lock:
                if self._recording or self._finishing:
                    return
                if _key_matches(key, target_key):
                    self._recording = True
                    print(f"\n{'='*50}")
                    print(f"[Whisper]  RECORDING — speak now…")
                    print(f"{'='*50}")
                    self._overlay.show_recording()
                    self._recorder.start()
                    self._vu_running = True
                    threading.Thread(target=self._vu_meter_loop, daemon=True).start()

        def on_release(key):
            should_finish = False
            with self._lock:
                if not self._recording:
                    return
                if _key_matches(key, target_key):
                    self._recording = False
                    self._vu_running = False
                    self._finishing = True
                    should_finish = True

            if should_finish:
                threading.Thread(target=self._finish_recording, daemon=True).start()

        with kb.Listener(on_press=on_press, on_release=on_release) as listener:
            listener.join()

    def _vu_meter_loop(self) -> None:
        """Console VU meter showing real-time audio level while recording."""
        BAR_WIDTH = 50
        start = time.time()
        while self._vu_running:
            rms = self._recorder.rms
            peak = self._recorder.peak
            samples = self._recorder.sample_count

            rms_db = _to_db(rms)
            peak_db = _to_db(peak)
            elapsed = time.time() - start

            filled = max(0, min(BAR_WIDTH, int((rms_db + 60) / 60 * BAR_WIDTH)))
            bar = "█" * filled + "░" * (BAR_WIDTH - filled)

            sys.stderr.write(
                f"\r  [{bar}]  {rms_db:5.1f} dB  "
                f"peak {peak_db:5.1f} dB  |  {elapsed:04.1f}s  "
                f"({samples} samples)"
            )
            sys.stderr.flush()
            time.sleep(0.04)

        # Clear the VU line and print final stats
        elapsed = time.time() - start
        sys.stderr.write("\r\033[K")
        sys.stderr.flush()
        rms = self._recorder.rms
        peak = self._recorder.peak
        print(f"[Whisper] Stopped after {elapsed:.1f}s. "
              f"Peak: {_to_db(peak):.1f} dB, "
              f"RMS: {_to_db(rms):.1f} dB")

    def _finish_recording(self) -> None:
        self._overlay.show_processing()
        try:
            wav, duration = self._recorder.stop()
            if wav is None:
                self._overlay.hide()
                print("[Whisper] No audio captured — recording was empty.")
                return
            print(f"[Whisper] Captured {duration:.1f}s of audio. Transcribing…")
            text = transcribe(wav, language=self._conf.get("language"))
            print(f"[Whisper] → {text!r}")
            self._overlay.show_result(text)
            paste_text(text)
        finally:
            with self._lock:
                self._finishing = False

    # ------------------------------------------------------------------
    # Settings

    def _on_settings_saved(self, new_conf: dict) -> None:
        self._conf = new_conf
        load_model(new_conf["model"], new_conf["device"])
        print(f"[Whisper] Settings saved. Hotkey: {new_conf['hotkey'].upper()}, Model: {new_conf['model']}")


# ------------------------------------------------------------------
# Helpers

def _to_db(value: float) -> float:
    """Convert a 16-bit audio sample level to decibels (full-scale)."""
    if value <= 0:
        return -96.0
    db = 20 * math.log10(value / 32768.0)
    return max(-96.0, db)


def _resolve_key(name: str):
    try:
        return kb.Key[name]
    except KeyError:
        return kb.KeyCode.from_char(name)


def _key_matches(pressed, target) -> bool:
    if isinstance(target, kb.Key):
        if pressed == target:
            return True
        if target == kb.Key.alt and pressed in (kb.Key.alt_l, kb.Key.alt_r):
            return True
        if target == kb.Key.ctrl and pressed in (kb.Key.ctrl_l, kb.Key.ctrl_r):
            return True
        if target == kb.Key.shift and pressed in (kb.Key.shift_l, kb.Key.shift_r):
            return True
        return False
    if isinstance(target, kb.KeyCode):
        return pressed == target
    return False


# ------------------------------------------------------------------

if __name__ == "__main__":
    WhisperApp().run()
