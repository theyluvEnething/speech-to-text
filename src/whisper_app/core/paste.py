import platform
import pyperclip
import pyautogui


def paste_text(text: str) -> None:
    if not text:
        return
    pyperclip.copy(text)
    if platform.system() == "Darwin":
        pyautogui.hotkey("command", "v")
    else:
        pyautogui.hotkey("ctrl", "v")
