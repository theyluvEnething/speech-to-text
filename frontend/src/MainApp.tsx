// src/renderer/MainApp.tsx
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore, type Tab, type SettingsPane } from "@/store";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import ConversationsView from "@/views/ConversationsView";
import InsightsView from "@/views/InsightsView";
import ProfilesView from "@/views/ProfilesView";

export function MainApp(): React.ReactElement {
  const { i18n } = useTranslation();
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openSettings = useStore((s) => s.openSettings);
  const setProfiles = useStore((s) => s.setProfiles);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const setConversations = useStore((s) => s.setConversations);

  // Boot + persist theme (injects CSS variables).
  useTheme();

  // Language bootstrap.
  useEffect(() => {
    window.wavely
      .getSettings()
      .then((settings) => {
        const lang = settings.appLanguage || "en";
        if (i18n.language !== lang) i18n.changeLanguage(lang);
      })
      .catch(() => {});
  }, [i18n]);

  // Windows modifier-key suppression (unchanged behavior).
  useEffect(() => {
    if (window.wavely.platform !== "win32") return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Alt" || e.key === "Control" || e.key === "Shift") e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Alt" || e.key === "Control" || e.key === "Shift") window.wavely.stopRecording();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, []);

  // Initial data + live events.
  useEffect(() => {
    Promise.all([
      window.wavely.profiles.list() as Promise<Profile[]>,
      window.wavely.profiles.getActive() as Promise<Profile>,
      window.wavely.conversations.list() as Promise<Conversation[]>,
    ])
      .then(([profiles, active, conversations]) => {
        setProfiles(profiles);
        setActiveProfile(active);
        setConversations(conversations);
      })
      .catch((err) => console.error("[Wavely] Failed to load initial data:", err));

    window.wavely.conversations.onNew((conv) => {
      setConversations([conv as Conversation, ...useStore.getState().conversations]);
    });

    // The overlay's "showSettings(tab)" IPC now opens the settings MODAL at a
    // pane instead of switching a routed tab. Known panes open the modal;
    // anything else is treated as a top-level tab.
    window.wavely.onSwitchTab((target: string) => {
      const panes: SettingsPane[] = ["general", "system", "transcription", "account", "privacy"];
      if (target === "settings" || target === "app" || target === "debug") {
        openSettings("general");
      } else if (panes.includes(target as SettingsPane)) {
        openSettings(target as SettingsPane);
      } else {
        setActiveTab(target as Tab);
      }
    });
  }, [setProfiles, setActiveProfile, setConversations, setActiveTab, openSettings]);

  return (
    <div className="flex flex-1 min-h-0 p-2 pt-0 gap-0">
      <Sidebar />
      <div className="w-px shrink-0 bg-line" />
      <main className="flex-1 min-w-0 bg-raised border border-line rounded-panel overflow-hidden ml-2 transition-colors">
        <div className="h-full px-8 py-6 overflow-y-auto">
          {activeTab === "conversations" && <ConversationsView />}
          {activeTab === "insights" && <InsightsView />}
          {activeTab === "profiles" && <ProfilesView />}
        </div>
      </main>

      {/* Settings is now a modal overlay, not an inline tab. */}
      <SettingsModal />
    </div>
  );
}
