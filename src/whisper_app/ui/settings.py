import customtkinter as ctk
from whisper_app import config as cfg

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

_MODELS = ["tiny", "base", "small", "medium", "large-v3"]
_DEVICES = ["CPU", "GPU (CUDA)"]

_HOTKEYS: dict[str, str] = {
    "Ctrl Right": "ctrl_r",
    "Ctrl Left": "ctrl_l",
    "Tab": "tab",
    "Alt": "alt",
    "Fn": "fn",
}

_LANGUAGES: dict[str, str | None] = {
    "Auto-detect": None,
    "English": "en",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Italian": "it",
    "Portuguese": "pt",
}


def _resolve_lang_display(code: str | None) -> str:
    for display, iso in _LANGUAGES.items():
        if iso == code:
            return display
    return "Auto-detect"


def _resolve_hotkey_display(code: str) -> str:
    for display, internal in _HOTKEYS.items():
        if internal == code:
            return display
    return "Ctrl Right"


class SettingsWindow:
    def __init__(self, on_save=None):
        self._on_save = on_save
        self._win: ctk.CTk | None = None

    def open(self) -> None:
        if self._win is not None:
            try:
                if self._win.winfo_exists():
                    self._win.lift()
                    self._win.focus()
                    return
            except Exception:
                pass
        self._win = None
        self._build()

    def _build(self) -> None:
        conf = cfg.load()

        win = ctk.CTk()
        win.title("Whisper — Settings")
        win.geometry("440x580")
        win.minsize(420, 480)
        win.protocol("WM_DELETE_WINDOW", lambda: self._close(win))
        self._win = win

        # --- Header (fixed top) ---
        header = ctk.CTkFrame(win, fg_color="transparent")
        header.pack(fill="x", padx=28, pady=(28, 12))
        ctk.CTkLabel(header, text="Whisper", font=ctk.CTkFont(size=24, weight="bold")).pack(anchor="w")
        ctk.CTkLabel(
            header, text="Push-to-talk speech-to-text",
            font=ctk.CTkFont(size=12), text_color="gray60",
        ).pack(anchor="w")

        # --- Scrollable content ---
        scroll = ctk.CTkScrollableFrame(win, fg_color="transparent", scrollbar_button_color="gray30")
        scroll.pack(fill="both", expand=True, padx=0, pady=0)

        # Hotkey
        hotkey_display = _resolve_hotkey_display(conf["hotkey"])
        hotkey_var = ctk.StringVar(value=hotkey_display)
        self._section(scroll, "Hotkey", "Hold-to-record key")
        ctk.CTkOptionMenu(
            scroll, variable=hotkey_var, values=list(_HOTKEYS.keys()), height=38,
            dropdown_font=ctk.CTkFont(size=13),
        ).pack(fill="x", padx=4, pady=(0, 16))

        # Model
        model_var = ctk.StringVar(value=conf["model"])
        self._section(scroll, "Model", "Speech recognition model")
        ctk.CTkOptionMenu(
            scroll, variable=model_var, values=_MODELS, height=38,
            dropdown_font=ctk.CTkFont(size=13),
        ).pack(fill="x", padx=4, pady=(0, 16))

        # Language
        current_display = _resolve_lang_display(conf.get("language"))
        lang_var = ctk.StringVar(value=current_display)
        self._section(scroll, "Language", "Force a specific language or auto-detect")
        ctk.CTkOptionMenu(
            scroll, variable=lang_var, values=list(_LANGUAGES.keys()), height=38,
            dropdown_font=ctk.CTkFont(size=13),
        ).pack(fill="x", padx=4, pady=(0, 16))

        # Device
        device_display = "GPU (CUDA)" if conf.get("device") == "cuda" else "CPU"
        device_var = ctk.StringVar(value=device_display)
        self._section(scroll, "Device", "Inference hardware")
        ctk.CTkOptionMenu(
            scroll, variable=device_var, values=_DEVICES, height=38,
            dropdown_font=ctk.CTkFont(size=13),
        ).pack(fill="x", padx=4, pady=(0, 6))
        ctk.CTkLabel(
            scroll, text="CPU works everywhere. GPU (CUDA) requires an NVIDIA card.",
            font=ctk.CTkFont(size=10), text_color="gray50",
        ).pack(anchor="w", padx=4, pady=(0, 16))

        # Model info card
        info = ctk.CTkFrame(scroll, fg_color="gray17", corner_radius=8)
        info.pack(fill="x", padx=4, pady=(2, 8))
        ctk.CTkLabel(
            info,
            text=(
                "tiny (75 MB)  ·  base (150 MB)  ·  small (480 MB)\n"
                "medium (1.5 GB)  ·  large-v3 (3 GB)\n\n"
                "Larger models are more accurate but slower.\n"
                "Models download once from HuggingFace, then run offline."
            ),
            font=ctk.CTkFont(size=10), text_color="gray60", justify="left",
        ).pack(padx=14, pady=12, anchor="w")

        # --- Save (fixed bottom) ---
        def save():
            conf["hotkey"] = _HOTKEYS[hotkey_var.get()]
            conf["model"] = model_var.get()
            conf["language"] = _LANGUAGES.get(lang_var.get())
            conf["device"] = "cuda" if device_var.get().startswith("GPU") else "cpu"
            cfg.save(conf)
            if self._on_save:
                self._on_save(conf)
            self._close(win)

        ctk.CTkButton(
            win, text="Save", command=save, height=42,
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(fill="x", padx=28, pady=(8, 24))

        win.mainloop()

    @staticmethod
    def _section(parent: ctk.CTkFrame, title: str, subtitle: str) -> None:
        frame = ctk.CTkFrame(parent, fg_color="transparent")
        frame.pack(fill="x", padx=4, pady=(10, 2))
        ctk.CTkLabel(
            frame, text=title.upper(),
            font=ctk.CTkFont(size=10, weight="bold"), text_color="gray50",
        ).pack(anchor="w")
        ctk.CTkLabel(
            frame, text=subtitle,
            font=ctk.CTkFont(size=12), text_color="gray70",
        ).pack(anchor="w")

    def _close(self, win: ctk.CTk) -> None:
        try:
            win.destroy()
        except Exception:
            pass
        self._win = None
