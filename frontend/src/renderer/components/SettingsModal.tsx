import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import {
  Settings as GeneralIcon,
  Monitor,
  Hash,
  User as AccountIcon,
  ShieldCheck,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, type SettingsPane } from "@/store";
import { useTheme } from "@/hooks/useTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { WV_PANEL, WV_BADGE } from "@/styles/theme";

const HOTKEYS = [
  { value: "alt", label: "Alt (Left)" },
  { value: "altright", label: "Alt (Right)" },
  { value: "ctrl", label: "Ctrl (Left)" },
  { value: "ctrlright", label: "Ctrl (Right)" },
  { value: "shift", label: "Shift (Left)" },
  { value: "shiftright", label: "Shift (Right)" },
];
const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
];
const APP_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Español" },
  { value: "ja", label: "日本語" },
];
const PROVIDERS = [
  { value: "groq", label: "Groq" },
  { value: "deepgram", label: "Deepgram" },
  { value: "openai", label: "OpenAI" },
  { value: "backend", label: "Backend" },
];
const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  groq: [
    { value: "whisper-large-v3-turbo", label: "Whisper Large V3 Turbo" },
    { value: "whisper-large-v3", label: "Whisper Large V3" },
  ],
  deepgram: [
    { value: "nova-2", label: "Nova-2" },
    { value: "nova-2-general", label: "Nova-2 General" },
  ],
  backend: [{ value: "whisper-large-v3", label: "Whisper Large V3" }],
  openai: [],
};

const NAV: { pane: SettingsPane; icon: typeof GeneralIcon; label: string; group: string }[] = [
  { pane: "general", icon: GeneralIcon, label: "General", group: "Settings" },
  { pane: "system", icon: Monitor, label: "System", group: "Settings" },
  { pane: "transcription", icon: Hash, label: "Transcription", group: "Settings" },
  { pane: "account", icon: AccountIcon, label: "Account", group: "Account" },
  { pane: "privacy", icon: ShieldCheck, label: "Data & Privacy", group: "Account" },
];

/* ── row primitives ──────────────────────────────────────────────────────── */
function Row({ label, desc, children }: { label: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 py-[17px] border-b border-line-soft last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        {desc && <div className="text-[12px] text-ink-3 leading-[1.5] mt-1 max-w-[430px]">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12.5px] font-semibold text-ink-3 mt-6 first:mt-0 mb-2">{children}</div>;
}
function PaneTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[26px] font-medium tracking-[-0.01em] text-ink mb-5">{children}</h2>;
}

function SettingsModal(): React.ReactElement {
  const open = useStore((s) => s.settingsOpen);
  const pane = useStore((s) => s.settingsPane);
  const closeSettings = useStore((s) => s.closeSettings);
  const setSettingsPane = useStore((s) => s.setSettingsPane);

  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { user } = useUser();

  // settings state (loaded from main on open)
  const [hotkey, setHotkey] = useState("ctrlright");
  const [language, setLanguage] = useState("auto");
  const [appLanguage, setAppLanguage] = useState("en");
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("whisper-large-v3-turbo");
  const [copyToClipboard, setCopyToClipboard] = useState(false);
  const initial = useRef(true);

  // updates
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "none" | "available" | "error">("idle");
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    initial.current = true;
    window.wavely
      .getSettings()
      .then((s) => {
        setHotkey(s.hotkey || "ctrlright");
        setLanguage(s.language || "auto");
        setAppLanguage(s.appLanguage || "en");
        setProvider(s.provider || "groq");
        setModel(s.model || "whisper-large-v3-turbo");
        setCopyToClipboard(s.copyToClipboard === true);
        requestAnimationFrame(() => (initial.current = false));
      })
      .catch(() => (initial.current = false));
  }, [open]);

  const save = useCallback((patch: Record<string, string | boolean>) => {
    if (initial.current) return;
    window.wavely
      .setSettings(patch)
      .then(() => toast("Preferences saved"))
      .catch((e) => console.error("[Wavely] save failed:", e));
  }, []);

  const handleCheckUpdates = useCallback(() => {
    setUpdateStatus("checking");
    setUpdateMsg(null);
    window.wavely
      .checkForUpdates()
      .then((r) => {
        if (r.available && r.version) {
          setUpdateStatus("available");
          setUpdateMsg(`Version ${r.version} is available.`);
        } else if (r.error) {
          setUpdateStatus("error");
          setUpdateMsg(r.error);
        } else {
          setUpdateStatus("none");
        }
      })
      .catch((e) => {
        setUpdateStatus("error");
        setUpdateMsg(e instanceof Error ? e.message : "Update check failed");
      });
  }, []);

  const handleReset = useCallback(() => {
    window.wavely
      .fullReset()
      .then(() => {
        toast("Reset complete", { description: "All data restored to defaults." });
        setTimeout(() => window.location.reload(), 500);
      })
      .catch((e) => toast("Reset failed", { description: e instanceof Error ? e.message : "Unknown error" }));
  }, []);

  const models = MODELS_BY_PROVIDER[provider] ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? null : closeSettings())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[4px] data-[state=open]:animate-wv-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 flex overflow-hidden
            w-[min(920px,92vw)] h-[min(630px,88vh)] bg-surface border border-line rounded-modal shadow-wv-pop
            data-[state=open]:animate-wv-fade focus:outline-none"
        >
          <Dialog.Title className="sr-only">Settings</Dialog.Title>

          {/* sub-nav */}
          <nav className="w-[224px] shrink-0 bg-background border-r border-line p-[18px_12px] flex flex-col">
            {["Settings", "Account"].map((group) => (
              <React.Fragment key={group}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-4 px-2.5 pt-3.5 pb-1.5 first:pt-0">
                  {group}
                </div>
                {NAV.filter((n) => n.group === group).map((n) => (
                  <button
                    key={n.pane}
                    onClick={() => setSettingsPane(n.pane)}
                    className={cn(
                      "flex items-center gap-2.5 h-[34px] px-2.5 rounded-[9px] text-[13px] font-medium transition-colors",
                      pane === n.pane
                        ? "bg-raised text-ink shadow-wv-card border-l-2 border-amber-accent-500"
                        : "text-ink-3 hover:bg-hover hover:text-ink",
                    )}
                  >
                    <n.icon className="h-[15px] w-[15px]" />
                    {n.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
            <div className="mt-auto flex items-center justify-between px-2.5 pt-2 text-[11.5px] text-ink-4">
              <span>Wavely v1.0.0</span>
              <Cloud className="h-3.5 w-3.5" />
            </div>
          </nav>

          {/* body */}
          <div className="flex-1 p-[28px_32px] overflow-y-auto">
            {pane === "general" && (
              <>
                <PaneTitle>General</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label="Push-to-talk key" desc="Hold this key while speaking, release to transcribe.">
                    <Select value={hotkey} onValueChange={(v) => { setHotkey(v); save({ hotkey: v }); }}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{HOTKEYS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row label="Microphone" desc="Captured from your default system input device.">
                    <span className="text-[12.5px] text-ink-3">Auto-detect</span>
                  </Row>
                  <Row label="Transcription language" desc="Auto lets the model detect the spoken language.">
                    <Select value={language} onValueChange={(v) => { setLanguage(v); save({ language: v }); }}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                </div>
              </>
            )}

            {pane === "system" && (
              <>
                <PaneTitle>System</PaneTitle>
                <GroupLabel>Appearance</GroupLabel>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label="Theme" desc="Choose how Wavely looks across the interface.">
                    <div className="flex gap-1.5">
                      {(["dark", "light"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={cn(
                            "px-4 py-2 rounded-[9px] border text-[12.5px] font-semibold capitalize transition-colors",
                            theme === t
                              ? "bg-acc-faint border-acc text-acc-strong"
                              : "bg-raised border-line text-ink-3 hover:bg-hover hover:text-ink",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Row>
                </div>
                <GroupLabel>Interface language</GroupLabel>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label="App language" desc="Language used for the app's own interface text.">
                    <Select value={appLanguage} onValueChange={(v) => { setAppLanguage(v); save({ appLanguage: v }); }}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{APP_LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                </div>
              </>
            )}

            {pane === "transcription" && (
              <>
                <PaneTitle>Transcription</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label="Provider" desc="Select the transcription service provider.">
                    <Select
                      value={provider}
                      onValueChange={(v) => {
                        setProvider(v);
                        const list = MODELS_BY_PROVIDER[v] ?? [];
                        if (list.length && !list.some((m) => m.value === model)) {
                          const next = list[0]!.value;
                          setModel(next);
                          save({ provider: v, model: next });
                        } else {
                          save({ provider: v });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  {provider !== "openai" ? (
                    <Row label="Model" desc="Faster models trade some accuracy for latency.">
                      <Select value={model} onValueChange={(v) => { setModel(v); save({ model: v }); }}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{models.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Row>
                  ) : (
                    <Row label="Model" desc="OpenAI provider is not yet implemented — pick another provider.">
                      <span className="text-[12.5px] text-ink-4">Unavailable</span>
                    </Row>
                  )}
                  <Row label="Copy to clipboard" desc="Keep transcribed text in the clipboard after pasting.">
                    <Switch checked={copyToClipboard} onCheckedChange={(v) => { setCopyToClipboard(v); save({ copyToClipboard: v }); }} />
                  </Row>
                </div>
              </>
            )}

            {pane === "account" && (
              <>
                <PaneTitle>Account</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label="Name"><span className="text-[13px] text-ink-2">{user?.fullName ?? "—"}</span></Row>
                  <Row label="Email"><span className="text-[13px] text-ink-2">{user?.primaryEmailAddress?.emailAddress ?? "—"}</span></Row>
                  <Row label="Plan"><span className={WV_BADGE}>Pro Trial · 6 days left</span></Row>
                  <Row
                    label="Software updates"
                    desc={
                      updateStatus === "none" ? "You're up to date."
                      : updateStatus === "available" ? updateMsg
                      : updateStatus === "error" ? updateMsg
                      : "Wavely v1.0.0"
                    }
                  >
                    {updateStatus === "available" ? (
                      <Button size="sm" onClick={() => window.wavely.downloadAndInstallUpdate()}>Update now</Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={updateStatus === "checking"} onClick={handleCheckUpdates}>
                        {updateStatus === "checking" ? "Checking…" : "Check for updates"}
                      </Button>
                    )}
                  </Row>
                </div>
                <div className="mt-[18px]">
                  <Button variant="outline" size="sm" onClick={() => signOut()}>Sign out</Button>
                </div>
              </>
            )}

            {pane === "privacy" && (
              <>
                <PaneTitle>Data &amp; Privacy</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label="Local-only storage" desc="Conversations and settings are stored locally on this device.">
                    <span className="text-[12.5px] text-ink-3">Enabled</span>
                  </Row>
                  <Row label="Clear all conversations" desc="Permanently delete every saved transcript.">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.wavely.conversations.clear().then(() => {
                          useStore.getState().setConversations([]);
                          toast("All conversations cleared");
                        })
                      }
                    >
                      Clear
                    </Button>
                  </Row>
                </div>
                <div className="mt-6">
                  <GroupLabel>Danger zone</GroupLabel>
                  <div className={cn(WV_PANEL, "px-[18px]")}>
                    <Row label="Full reset" desc="Delete all settings, profiles, and conversations and restore factory defaults.">
                      <Button variant="destructive" size="sm" onClick={handleReset}>Reset everything</Button>
                    </Row>
                  </div>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SettingsModal;
