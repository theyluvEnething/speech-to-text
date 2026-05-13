import threading
import tkinter as tk

_RECORDING_COLOR = "#E53E3E"   # red
_PROCESSING_COLOR = "#3182CE"  # blue
_BG = "#1A202C"
_FG = "#FFFFFF"
_FONT = ("Segoe UI", 11, "bold") if __import__("platform").system() == "Windows" else ("SF Pro Display", 11, "bold")


class Overlay:
    """
    Tiny borderless floating window shown at the bottom-center of the screen
    while recording or processing. Auto-destroys after a short timeout.
    """

    def __init__(self):
        self._root: tk.Tk | None = None
        self._lock = threading.Lock()
        self._after_id = None

    def show_recording(self) -> None:
        self._show("  Recording...  ", _RECORDING_COLOR)

    def show_processing(self) -> None:
        self._show("  Processing...  ", _PROCESSING_COLOR)

    def show_result(self, text: str) -> None:
        preview = text[:60] + ("…" if len(text) > 60 else "")
        self._show(f"  {preview}  ", "#2D3748", auto_close_ms=2500)

    def hide(self) -> None:
        with self._lock:
            if self._root:
                self._root.after(0, self._destroy)

    # ------------------------------------------------------------------

    def _show(self, message: str, accent: str, auto_close_ms: int | None = None) -> None:
        with self._lock:
            if self._root is None:
                self._root = self._build_window()
            self._root.after(0, lambda: self._update(message, accent, auto_close_ms))

    def _build_window(self) -> tk.Tk:
        root = tk.Tk()
        root.overrideredirect(True)           # no title bar
        root.attributes("-topmost", True)
        root.attributes("-alpha", 0.92)
        root.configure(bg=_BG)
        root.resizable(False, False)

        self._label = tk.Label(
            root,
            text="",
            bg=_BG,
            fg=_FG,
            font=_FONT,
            padx=12,
            pady=8,
        )
        self._label.pack()

        self._indicator = tk.Frame(root, height=3, bg=_RECORDING_COLOR)
        self._indicator.pack(fill="x")

        self._position(root)
        return root

    def _update(self, message: str, accent: str, auto_close_ms: int | None) -> None:
        if self._root is None:
            return
        self._label.configure(text=message)
        self._indicator.configure(bg=accent)
        self._position(self._root)
        self._root.deiconify()

        if self._after_id is not None:
            self._root.after_cancel(self._after_id)
            self._after_id = None

        if auto_close_ms is not None:
            self._after_id = self._root.after(auto_close_ms, self._destroy)

    def _position(self, root: tk.Tk) -> None:
        root.update_idletasks()
        sw = root.winfo_screenwidth()
        sh = root.winfo_screenheight()
        w = root.winfo_reqwidth()
        h = root.winfo_reqheight()
        x = (sw - w) // 2
        y = sh - h - 60
        root.geometry(f"+{x}+{y}")

    def _destroy(self) -> None:
        if self._root:
            self._root.destroy()
            self._root = None
            self._after_id = None
