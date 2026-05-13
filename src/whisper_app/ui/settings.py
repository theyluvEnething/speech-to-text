import customtkinter as ctk
from whisper_app import config as cfg

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

MODELS = ["tiny", "base", "small", "medium", "large-v3"]
DEVICES = ["cpu", "cuda"]


class SettingsWindow:
    def __init__(self, on_save=None):
        self._on_save = on_save
        self._win: ctk.CTk | None = None

    def open(self) -> None:
        if self._win and self._win.winfo_exists():
            self._win.lift()
            return
        self._build()

    def _build(self) -> None:
        conf = cfg.load()

        win = ctk.CTk()
        win.title("Whisper — Settings")
        win.geometry("360x300")
        win.resizable(False, False)
        self._win = win

        pad = {"padx": 20, "pady": 8}

        ctk.CTkLabel(win, text="Whisper Settings", font=("", 16, "bold")).pack(**pad, anchor="w")

        # Hotkey
        ctk.CTkLabel(win, text="Hotkey").pack(**pad, anchor="w")
        hotkey_var = ctk.StringVar(value=conf["hotkey"])
        ctk.CTkEntry(win, textvariable=hotkey_var).pack(fill="x", padx=20)

        # Model
        ctk.CTkLabel(win, text="Model").pack(**pad, anchor="w")
        model_var = ctk.StringVar(value=conf["model"])
        ctk.CTkOptionMenu(win, variable=model_var, values=MODELS).pack(fill="x", padx=20)

        # Language
        ctk.CTkLabel(win, text="Language (blank = auto)").pack(**pad, anchor="w")
        lang_var = ctk.StringVar(value=conf.get("language") or "")
        ctk.CTkEntry(win, textvariable=lang_var, placeholder_text="en, no, fr …").pack(fill="x", padx=20)

        def save():
            conf["hotkey"] = hotkey_var.get().strip().lower()
            conf["model"] = model_var.get()
            conf["language"] = lang_var.get().strip() or None
            cfg.save(conf)
            if self._on_save:
                self._on_save(conf)
            win.destroy()

        ctk.CTkButton(win, text="Save", command=save).pack(pady=16)
        win.mainloop()
