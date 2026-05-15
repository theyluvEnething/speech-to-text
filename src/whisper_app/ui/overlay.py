import queue
import threading
import tkinter as tk
import platform

_RECORDING_COLOR = "#E53E3E"
_PROCESSING_COLOR = "#3182CE"
_BG = "#1A202C"
_FG = "#FFFFFF"
_FONT = ("Segoe UI", 11, "bold") if platform.system() == "Windows" else ("SF Pro Display", 11, "bold")


class Overlay:
    """Thread-safe floating status window. All public methods may be called from any thread."""

    def __init__(self):
        self._queue: queue.SimpleQueue = queue.SimpleQueue()
        self._thread = threading.Thread(target=self._tk_mainloop, daemon=True)
        self._thread.start()

    def show_recording(self) -> None:
        self._queue.put(("show", "  Recording...  ", _RECORDING_COLOR, None))

    def show_processing(self) -> None:
        self._queue.put(("show", "  Processing...  ", _PROCESSING_COLOR, None))

    def show_result(self, text: str) -> None:
        preview = text[:60] + ("..." if len(text) > 60 else "")
        self._queue.put(("show", f"  {preview}  ", "#2D3748", 2500))

    def hide(self) -> None:
        self._queue.put(("hide",))

    # ------------------------------------------------------------------
    # Tkinter thread

    def _tk_mainloop(self) -> None:
        self._root = tk.Tk()
        self._root.overrideredirect(True)
        self._root.attributes("-topmost", True)
        self._root.attributes("-alpha", 0.92)
        self._root.configure(bg=_BG)
        self._root.resizable(False, False)
        self._root.withdraw()

        self._label = tk.Label(self._root, text="", bg=_BG, fg=_FG, font=_FONT, padx=12, pady=8)
        self._label.pack()
        self._indicator = tk.Frame(self._root, height=3, bg=_RECORDING_COLOR)
        self._indicator.pack(fill="x")

        self._after_id = None
        self._poll()
        self._root.mainloop()

    def _poll(self) -> None:
        try:
            while True:
                cmd = self._queue.get_nowait()
                action = cmd[0]
                if action == "show":
                    self._update(*cmd[1:])
                elif action == "hide":
                    self._destroy()
        except queue.Empty:
            pass
        self._root.after(50, self._poll)

    def _update(self, message: str, accent: str, auto_close_ms: int | None) -> None:
        self._label.configure(text=message)
        self._indicator.configure(bg=accent)
        self._position()
        self._root.deiconify()

        if self._after_id is not None:
            self._root.after_cancel(self._after_id)
            self._after_id = None

        if auto_close_ms is not None:
            self._after_id = self._root.after(auto_close_ms, self._destroy)

    def _position(self) -> None:
        self._root.update_idletasks()
        sw = self._root.winfo_screenwidth()
        sh = self._root.winfo_screenheight()
        w = self._root.winfo_reqwidth()
        h = self._root.winfo_reqheight()
        x = (sw - w) // 2
        y = sh - h - 60
        self._root.geometry(f"+{x}+{y}")

    def _destroy(self) -> None:
        if self._root:
            self._root.withdraw()
            self._after_id = None
