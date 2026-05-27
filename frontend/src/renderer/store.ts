import { create } from "zustand";

export type Tab = "conversations" | "profiles" | "settings" | "app" | "debug";

interface AppStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  profiles: Profile[];
  setProfiles: (profiles: Profile[]) => void;
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile) => void;
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  triggerNewProfile: boolean;
  setTriggerNewProfile: (v: boolean) => void;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  clerkLoaded: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
  setIsAuthenticated: (v: boolean) => void;
}

export const useStore = create<AppStore>((set) => ({
  activeTab: "conversations",
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  profiles: [],
  setProfiles: (profiles) => set({ profiles }),
  activeProfile: null,
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  triggerNewProfile: false,
  setTriggerNewProfile: (v) => set({ triggerNewProfile: v }),
  isPaused: false,
  setIsPaused: (v) => set({ isPaused: v }),
  clerkLoaded: false,
  isAuthenticated: false,
  userEmail: null,
  setIsAuthenticated: (v) => set({ isAuthenticated: v }),
}));