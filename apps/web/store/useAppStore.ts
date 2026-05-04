"use client";
import { create } from "zustand";

interface AppState {
  currentGroupId: string | null;
  currentGroupName: string | null;
  sidebarCollapsed: boolean;
  upgradeModalOpen: boolean;
  upgradeModalReason: string | null;
  setCurrentGroup: (id: string | null, name?: string | null) => void;
  toggleSidebar: () => void;
  openUpgradeModal: (reason: string) => void;
  closeUpgradeModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentGroupId: null,
  currentGroupName: null,
  sidebarCollapsed: false,
  upgradeModalOpen: false,
  upgradeModalReason: null,
  setCurrentGroup: (id, name = null) => set({ currentGroupId: id, currentGroupName: name }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openUpgradeModal: (reason) => set({ upgradeModalOpen: true, upgradeModalReason: reason }),
  closeUpgradeModal: () => set({ upgradeModalOpen: false, upgradeModalReason: null }),
}));
