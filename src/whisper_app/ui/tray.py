import threading
from pathlib import Path
import pystray
from PIL import Image, ImageDraw


def _draw_mic_icon(size: int = 64) -> Image.Image:
    """Draw a clean microphone icon — dark rounded rect body with a mesh grille and stand."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Scale to fit the 64×64 canvas with padding
    s = size / 64.0

    # --- Mic body (rounded rectangle) ---
    body = [22 * s, 20 * s, 42 * s, 56 * s]
    draw.rounded_rectangle(body, radius=8 * s, fill="#2B6CB0")

    # --- Grille lines (3 horizontal lines on the body) ---
    grille_color = "#1A4A7A"
    for i in range(3):
        y = (28 + i * 7) * s
        draw.rounded_rectangle(
            [26 * s, y, 38 * s, y + 3 * s], radius=1.5 * s, fill=grille_color,
        )

    # --- Mic capsule (circle on top) ---
    capsule_center = (32 * s, 20 * s)
    draw.ellipse(
        [capsule_center[0] - 10 * s, capsule_center[1] - 11 * s,
         capsule_center[0] + 10 * s, capsule_center[1] + 11 * s],
        fill="#3182CE",
    )
    # Inner highlight on capsule
    draw.ellipse(
        [capsule_center[0] - 5 * s, capsule_center[1] - 7 * s,
         capsule_center[0] + 5 * s, capsule_center[1] + 6 * s],
        fill="#63B3ED",
    )

    # --- Stand (small trapezoid base) ---
    stand = [28 * s, 56 * s, 36 * s, 62 * s]
    draw.rounded_rectangle(stand, radius=3 * s, fill="#2B6CB0")

    # --- Horizontal base bar ---
    draw.rounded_rectangle(
        [24 * s, 60 * s, 40 * s, 63 * s], radius=2 * s, fill="#1A4A7A",
    )

    return img


def _load_icon() -> Image.Image:
    icon_path = Path(__file__).parent.parent.parent.parent / "assets" / "icon.png"
    if icon_path.exists():
        return Image.open(icon_path).resize((64, 64))
    return _draw_mic_icon()


class TrayIcon:
    def __init__(self, on_settings, on_quit):
        self._on_settings = on_settings
        self._on_quit = on_quit
        self._icon: pystray.Icon | None = None

    def start(self) -> None:
        menu = pystray.Menu(
            pystray.MenuItem(
                "Open Settings…", lambda icon, item: self._on_settings(),
                default=True,
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Quit Whisper", lambda icon, item: self._stop(),
            ),
        )
        self._icon = pystray.Icon("Whisper", _load_icon(), "Whisper", menu)
        threading.Thread(target=self._icon.run, daemon=True).start()

    def _stop(self) -> None:
        if self._icon:
            self._icon.stop()
        self._on_quit()
