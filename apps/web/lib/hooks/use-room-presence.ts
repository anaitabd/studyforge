"use client";

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

interface CurrentUser {
  id: string;
  name: string;
  avatar_url?: string | null;
}

// Room presence is not active — returns empty state.
export function useRoomPresence(_roomId: string, _currentUser: CurrentUser | null) {
  return { onlineUsers: [] as PresenceUser[], enabled: false };
}
