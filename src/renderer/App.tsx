import React, { useEffect } from "react";
import { Toaster } from "sonner";
import { useStore } from "@/store";
import TitleBar from "@/components/TitleBar";
import Sidebar from "@/components/Sidebar";
import ConversationsView from "@/views/ConversationsView";
import ProfilesView from "@/views/ProfilesView";
import SettingsView from "@/views/SettingsView";

function App(): React.ReactElement {
  const activeTab = useStore((s) => s.activeTab);
  const setProfiles = useStore((s) => s.setProfiles);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const setConversations = useStore((s) => s.setConversations);

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
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background rounded-[10px] overflow-hidden window-enter">
      <TitleBar />
      <div className="flex flex-1 min-h-0 p-2 pt-0 gap-0">
        <Sidebar />
        <div className="w-px shrink-0 bg-border" />
        <main className="flex-1 min-w-0 bg-gradient-to-t from-[#121314] to-[#121314] rounded-lg overflow-hidden">
          <div className="h-full px-8 py-6 overflow-y-auto">
            {activeTab === "conversations" && <ConversationsView />}
            {activeTab === "profiles" && <ProfilesView />}
            {activeTab === "settings" && <SettingsView />}
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
