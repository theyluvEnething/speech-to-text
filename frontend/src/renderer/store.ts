import { create } from "zustand";
import type { ThemeMode } from "@/styles/theme";

export type Tab = "conversations" | "insights" | "profiles";
export type SettingsPane =
  | "general"
  | "system"
  | "transcription"
  | "account"
  | "privacy";

interface AppStore {
  // navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // settings modal (replaces the old inline settings/app/debug tabs)
  settingsOpen: boolean;
  settingsPane: SettingsPane;
  openSettings: (pane?: SettingsPane) => void;
  closeSettings: () => void;
  setSettingsPane: (pane: SettingsPane) => void;

  // theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // domain data
  profiles: Profile[];
  setProfiles: (profiles: Profile[]) => void;
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile) => void;
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;

  // misc
  triggerNewProfile: boolean;
  setTriggerNewProfile: (v: boolean) => void;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  hidePill: boolean;
  setHidePill: (v: boolean) => void;

  // auth
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

  settingsOpen: false,
  settingsPane: "general",
  openSettings: (pane) =>
    set((s) => ({ settingsOpen: true, settingsPane: pane ?? s.settingsPane })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsPane: (pane) => set({ settingsPane: pane }),

  theme: "light",
  setTheme: (theme) => set({ theme }),

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
  hidePill: false,
  setHidePill: (v) => set({ hidePill: v }),

  clerkLoaded: false,
  isAuthenticated: false,
  userEmail: null,
  setIsAuthenticated: (v) => set({ isAuthenticated: v }),
}));
