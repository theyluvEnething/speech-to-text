import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth, useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
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
  const { t } = useTranslation();

  const HOTKEYS = [
    { value: "alt", label: `${t("hotkeys.alt")} (${t("hotkeys.left")})` },
    { value: "altright", label: `${t("hotkeys.alt")} (${t("hotkeys.right")})` },
    { value: "ctrl", label: `${t("hotkeys.ctrl")} (${t("hotkeys.left")})` },
    { value: "ctrlright", label: `${t("hotkeys.ctrl")} (${t("hotkeys.right")})` },
    { value: "shift", label: `${t("hotkeys.shift")} (${t("hotkeys.left")})` },
    { value: "shiftright", label: `${t("hotkeys.shift")} (${t("hotkeys.right")})` },
  ];
  const LANGUAGES = [
    { value: "auto", label: t("languages.auto") },
    { value: "en", label: t("languages.en") },
    { value: "de", label: t("languages.de") },
    { value: "fr", label: t("languages.fr") },
    { value: "es", label: t("languages.es") },
    { value: "it", label: t("languages.it") },
    { value: "ja", label: t("languages.ja") },
    { value: "ko", label: t("languages.ko") },
    { value: "zh", label: t("languages.zh") },
  ];
  const APP_LANGUAGES = [
    { value: "en", label: t("languages.en") },
    { value: "de", label: t("languages.de") },
    { value: "it", label: t("languages.it") },
    { value: "es", label: t("languages.es") },
    { value: "ja", label: t("languages.ja") },
  ];
  const PROVIDERS = [
    { value: "groq", label: t("providers.groq") },
    { value: "deepgram", label: t("providers.deepgram") },
    { value: "openai", label: t("providers.openai") },
    { value: "backend", label: t("providers.backend") },
  ];
  const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
    groq: [
      { value: "whisper-large-v3-turbo", label: t("models.whisper-large-v3-turbo") },
      { value: "whisper-large-v3", label: t("models.whisper-large-v3") },
    ],
    deepgram: [
      { value: "nova-2", label: t("models.nova-2") },
      { value: "nova-2-general", label: t("models.nova-2-general") },
    ],
    backend: [{ value: "whisper-large-v3", label: t("models.whisper-large-v3") }],
    openai: [],
  };

  const NAV: { pane: SettingsPane; icon: typeof GeneralIcon; label: string; group: string }[] = [
    { pane: "general", icon: GeneralIcon, label: t("settings.general"), group: "Settings" },
    { pane: "system", icon: Monitor, label: t("settings.system"), group: "Settings" },
    { pane: "transcription", icon: Hash, label: t("settings.transcription"), group: "Settings" },
    { pane: "account", icon: AccountIcon, label: t("settings.account"), group: "Account" },
    { pane: "privacy", icon: ShieldCheck, label: t("settings.privacy"), group: "Account" },
  ];

  const groupLabels: Record<string, string> = {
    Settings: t("settings.title"),
    Account: t("settings.account"),
  };

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
  const [appVersion, setAppVersion] = useState("");
  const initial = useRef(true);

  useEffect(() => {
    window.wavely.getVersion().then(setAppVersion).catch(() => {});
  }, []);

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
      .then(() => toast(t("settings.preferencesSaved")))
      .catch((e) => console.error("[Wavely] save failed:", e));
  }, [t]);

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
        setUpdateMsg(e instanceof Error ? e.message : t("settings.updateCheckFailed"));
      });
  }, [t]);

  const handleReset = useCallback(() => {
    window.wavely
      .fullReset()
      .then(() => {
        toast(t("settings.resetComplete"), { description: t("settings.resetCompleteHint") });
        setTimeout(() => window.location.reload(), 500);
      })
      .catch((e) => toast(t("settings.resetFailed"), { description: e instanceof Error ? e.message : t("settings.unknownError") }));
  }, [t]);

  const models = MODELS_BY_PROVIDER[provider] ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? null : closeSettings())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[4px] rounded-[20px] data-[state=open]:animate-wv-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 flex overflow-hidden
            w-[min(920px,92vw)] h-[min(630px,88vh)] bg-surface border border-line rounded-modal shadow-wv-pop
            data-[state=open]:animate-wv-fade focus:outline-none"
        >
          <Dialog.Title className="sr-only">{t("settings.title")}</Dialog.Title>

          {/* sub-nav */}
          <nav className="w-[224px] shrink-0 bg-background border-r border-line p-[18px_12px] flex flex-col">
            {["Settings", "Account"].map((group) => (
              <React.Fragment key={group}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-4 px-2.5 pt-3.5 pb-1.5 first:pt-0">
                  {groupLabels[group]}
                </div>
                {NAV.filter((n) => n.group === group).map((n) => (
                  <button
                    key={n.pane}
                    onClick={() => setSettingsPane(n.pane)}
                    className={cn(
                      "flex items-center gap-2.5 h-[34px] px-2.5 rounded-[9px] text-[13px] font-medium transition-colors",
                      pane === n.pane
                        ? "bg-raised text-ink shadow-wv-card border-l-2 border-acc-strong"
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
              <span>{t("settings.version", { version: appVersion })}</span>
              <Cloud className="h-3.5 w-3.5" />
            </div>
          </nav>

          {/* body */}
          <div className="flex-1 p-[28px_32px] overflow-y-auto">
            {pane === "general" && (
              <>
                <PaneTitle>{t("settings.general")}</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label={t("settings.pushToTalkKey")} desc={t("settings.pushToTalkHint")}>
                    <Select value={hotkey} onValueChange={(v) => { setHotkey(v); save({ hotkey: v }); }}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{HOTKEYS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row label={t("settings.microphone")} desc={t("settings.microphoneHint")}>
                    <span className="text-[12.5px] text-ink-3">{t("settings.autoDetect")}</span>
                  </Row>
                  <Row label={t("settings.transcriptionLanguage")} desc={t("settings.transcriptionLanguageHint")}>
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
                <PaneTitle>{t("settings.system")}</PaneTitle>
                <GroupLabel>{t("settings.appearance")}</GroupLabel>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label={t("settings.theme")} desc={t("settings.themeHint")}>
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
                <GroupLabel>{t("settings.interfaceLanguage")}</GroupLabel>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label={t("settings.appLanguage")} desc={t("settings.appLanguageHint")}>
                    <Select value={appLanguage} onValueChange={(v) => { setAppLanguage(v); save({ appLanguage: v }); i18n.changeLanguage(v).then(() => window.location.reload()); }}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{APP_LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                </div>
              </>
            )}

            {pane === "transcription" && (
              <>
                <PaneTitle>{t("settings.transcription")}</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label={t("settings.provider")} desc={t("settings.providerHint")}>
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
                    <Row label={t("settings.model")} desc={t("settings.modelHint")}>
                      <Select value={model} onValueChange={(v) => { setModel(v); save({ model: v }); }}>
                        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{models.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Row>
                  ) : (
                    <Row label={t("settings.model")} desc={t("settings.openaiUnavailable")}>
                      <span className="text-[12.5px] text-ink-4">{t("settings.unavailable")}</span>
                    </Row>
                  )}
                  <Row label={t("settings.copyToClipboard")} desc={t("settings.copyToClipboardHint")}>
                    <Switch checked={copyToClipboard} onCheckedChange={(v) => { setCopyToClipboard(v); save({ copyToClipboard: v }); }} />
                  </Row>
                </div>
              </>
            )}

            {pane === "account" && (
              <div className="flex flex-col h-full">
                <PaneTitle>{t("settings.account")}</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label={t("settings.name")}><span className="text-[13px] text-ink-2">{user?.fullName ?? "—"}</span></Row>
                  <Row label={t("settings.email")}><span className="text-[13px] text-ink-2">{user?.primaryEmailAddress?.emailAddress ?? "—"}</span></Row>
                  <Row label={t("settings.plan")}><span className={WV_BADGE}>{t("settings.proTrial")}</span></Row>
                  <Row
                    label={t("settings.softwareUpdates")}
                    desc={
                      updateStatus === "none" ? t("settings.upToDate")
                      : updateStatus === "available" ? updateMsg
                      : updateStatus === "error" ? updateMsg
                      : t("settings.version", { version: appVersion })
                    }
                  >
                    {updateStatus === "available" ? (
                      <Button size="sm" onClick={() => window.wavely.downloadAndInstallUpdate()}>{t("settings.updateNow")}</Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled={updateStatus === "checking"} onClick={handleCheckUpdates}>
                        {updateStatus === "checking" ? t("settings.checking") : t("settings.checkForUpdates")}
                      </Button>
                    )}
                  </Row>
                </div>
                <div className="flex-1" />
                <div className="flex justify-end shrink-0">
                  <Button
                    onClick={() => signOut()}
                    className="bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold px-5 py-2 rounded-[9px] border-none shadow-md transition-colors"
                  >
                    {t("settings.signOut")}
                  </Button>
                </div>
              </div>
            )}

            {pane === "privacy" && (
              <>
                <PaneTitle>{t("settings.privacy")}</PaneTitle>
                <div className={cn(WV_PANEL, "px-[18px]")}>
                  <Row label={t("settings.localOnlyStorage")} desc={t("settings.localOnlyStorageHint")}>
                    <span className="text-[12.5px] text-ink-3">{t("settings.enabled")}</span>
                  </Row>
                  <Row label={t("settings.clearAllConversations")} desc={t("settings.clearAllConversationsHint")}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.wavely.conversations.clear().then(() => {
                          useStore.getState().setConversations([]);
                          toast(t("settings.allConversationsCleared"));
                        })
                      }
                    >
                      {t("settings.clear")}
                    </Button>
                  </Row>
                </div>
                <div className="mt-6">
                  <GroupLabel>{t("settings.dangerZone")}</GroupLabel>
                  <div className={cn(WV_PANEL, "px-[18px]")}>
                    <Row label={t("settings.fullReset")} desc={t("settings.fullResetHint")}>
                      <Button variant="destructive" size="sm" onClick={handleReset}>{t("settings.resetEverything")}</Button>
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
