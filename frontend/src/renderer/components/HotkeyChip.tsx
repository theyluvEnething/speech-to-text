import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WV_KEYCAP } from "@/styles/theme";

function displayFor(v: string, hotkeys: { value: string; label: string; side: string }[], t: (key: string) => string): string {
  const h = hotkeys.find((k) => k.value === v);
  if (!h) return t("hotkeys.fallback");
  return h.side === "right" ? `R-${h.label}` : h.label;
}

function HotkeyChip(): React.ReactElement {
  const { t } = useTranslation();

  const HOTKEYS = [
    { value: "alt",        label: t("hotkeys.alt"),     side: "left"  },
    { value: "altright",   label: t("hotkeys.alt"),     side: "right" },
    { value: "ctrl",       label: t("hotkeys.ctrl"),    side: "left"  },
    { value: "ctrlright",  label: t("hotkeys.ctrl"),    side: "right" },
    { value: "shift",      label: t("hotkeys.shift"),   side: "left"  },
    { value: "shiftright", label: t("hotkeys.shift"),   side: "right" },
  ];

  const [hotkey, setHotkey] = useState("ctrlright");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.wavely
      .getSettings()
      .then((s) => setHotkey(s.hotkey || "ctrlright"))
      .catch(() => {});
  }, []);

  function select(v: string): void {
    setHotkey(v);
    window.wavely.setSettings({ hotkey: v }).catch(() => {});
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            WV_KEYCAP,
            "cursor-pointer hover:brightness-110 active:scale-[0.97] transition-all",
          )}
          aria-label={t("hotkeys.changePushToTalk")}
          title={t("hotkeys.clickToChange")}
        >
          {displayFor(hotkey, HOTKEYS, t)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-56 p-1.5" sideOffset={8}>
        <div className="text-[10px] font-bold uppercase tracking-[0.07em] text-ink-4 px-2 py-1.5">
          {t("hotkeys.pushToTalkKey")}
        </div>
        <div className="space-y-0.5">
          {HOTKEYS.map((h) => (
            <button
              key={h.value}
              onClick={() => select(h.value)}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-[13px] text-ink-2 hover:bg-hover hover:text-ink transition-colors"
            >
              <span className="flex-1 text-left">
                {h.label}
                <span className="ml-1.5 text-[11px] text-ink-4">
                  ({h.side === "left" ? t("hotkeys.left") : t("hotkeys.right")})
                </span>
              </span>
              {hotkey === h.value && <Check className="h-3.5 w-3.5 text-acc-strong" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default HotkeyChip;
