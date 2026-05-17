import { create } from "zustand";

export type Tab = "conversations" | "profiles" | "settings";

interface AppStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  profiles: Profile[];
  setProfiles: (profiles: Profile[]) => void;
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile) => void;
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
}

export const useStore = create<AppStore>((set) => ({
  activeTab: "conversations",
  setActiveTab: (tab) => set({ activeTab: tab }),
  profiles: [],
  setProfiles: (profiles) => set({ profiles }),
  activeProfile: null,
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
}));
