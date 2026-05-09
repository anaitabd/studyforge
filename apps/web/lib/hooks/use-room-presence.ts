"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";

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

export function useRoomPresence(roomId: string, currentUser: CurrentUser | null) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  useEffect(() => {
    if (!supabase || !supabaseEnabled || !roomId || !currentUser) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: currentUser.id,
            name: currentUser.name,
            avatarUrl: currentUser.avatar_url ?? null,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase?.removeChannel(channel);
    };
  }, [roomId, currentUser]);

  return { onlineUsers, enabled: supabaseEnabled };
}
