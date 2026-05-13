import threading
from pathlib import Path
import pystray
from PIL import Image, ImageDraw


def _make_default_icon() -> Image.Image:
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, size - 4, size - 4], fill="#3182CE")
    draw.ellipse([20, 20, size - 20, size - 20], fill="#FFFFFF")
    return img


def _load_icon() -> Image.Image:
    icon_path = Path(__file__).parent.parent.parent.parent / "assets" / "icon.png"
    if icon_path.exists():
        return Image.open(icon_path).resize((64, 64))
    return _make_default_icon()


class TrayIcon:
    def __init__(self, on_settings, on_quit):
        self._on_settings = on_settings
        self._on_quit = on_quit
        self._icon: pystray.Icon | None = None

    def start(self) -> None:
        menu = pystray.Menu(
            pystray.MenuItem("Settings", lambda icon, item: self._on_settings()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit Whisper", lambda icon, item: self._stop()),
        )
        self._icon = pystray.Icon("Whisper", _load_icon(), "Whisper", menu)
        threading.Thread(target=self._icon.run, daemon=True).start()

    def _stop(self) -> None:
        if self._icon:
            self._icon.stop()
        self._on_quit()
