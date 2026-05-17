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
    <div className="flex flex-col h-screen bg-background rounded-[12px] overflow-hidden border border-border/60 shadow-2xl">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 bg-card">
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
