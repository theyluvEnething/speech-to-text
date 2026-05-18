import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { useStore } from "@/store";
import TitleBar from "@/components/TitleBar";
import Sidebar from "@/components/Sidebar";
import ConversationsView from "@/views/ConversationsView";
import ProfilesView from "@/views/ProfilesView";
import SettingsView from "@/views/SettingsView";
import AppView from "@/views/AppView";

function App(): React.ReactElement {
  const { i18n } = useTranslation();
  const activeTab = useStore((s) => s.activeTab);
  const setProfiles = useStore((s) => s.setProfiles);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const setConversations = useStore((s) => s.setConversations);

  // Set i18n language from stored setting on startup
  useEffect(() => {
    window.wavely.getSettings().then((settings) => {
      const lang = settings.appLanguage || "en";
      if (i18n.language !== lang) i18n.changeLanguage(lang);
    }).catch(() => {});
  }, []);

  // Prevent modifier keys from triggering system menus (e.g. Alt on Windows)
  // and use renderer-side keyup as fallback for push-to-talk release detection.
  useEffect(() => {
    if (window.wavely.platform !== "win32") return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Alt" || e.key === "Control" || e.key === "Shift") {
        e.preventDefault();
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      if (e.key === "Alt" || e.key === "Control" || e.key === "Shift") {
        window.wavely.stopRecording();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      window.wavely.profiles.list() as Promise<Profile[]>,
      window.wavely.profiles.getActive() as Promise<Profile>,
      window.wavely.conversations.list() as Promise<Conversation[]>,
    ]).then(([profiles, active, conversations]) => {
      setProfiles(profiles);
      setActiveProfile(active);
      setConversations(conversations);
    }).catch((err) => {
      console.error("[Wavely] Failed to load initial data:", err);
    });

    window.wavely.conversations.onNew((conv) => {
      setConversations([conv as Conversation, ...useStore.getState().conversations]);
    });
  }, []);

  // To make concentric borders, OuterRadius = InnerRadius + Padding
  // Inner container is rounded-2xl (16px). Padding is p-2 (8px).
  // 16px + 8px = 24px. So the outer container should be rounded-[24px].
  return (
    <div className="flex flex-col h-screen bg-background rounded-[20px] overflow-hidden window-enter">
      <TitleBar />
      <div className="flex flex-1 min-h-0 p-2 pt-0 gap-0">
        <Sidebar />
        <div className="w-px shrink-0 bg-border" />
        <main className="flex-1 min-w-0 bg-gradient-to-t from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden ml-2">
          <div className="h-full px-8 py-6 overflow-y-auto">
            {activeTab === "conversations" && <ConversationsView />}
            {activeTab === "profiles" && <ProfilesView />}
            {activeTab === "settings" && <SettingsView />}
            {activeTab === "app" && <AppView />}
          </div>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "bg-popover text-popover-foreground border border-border",
        }}
      />
    </div>
  );
}

export default App;
