"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/hooks/useApi";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg animate-in">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-sora font-semibold text-sm text-primary">Notifications</p>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500">
              <p>Notifications coming soon — check your email or WhatsApp for now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.slice(0, 10).map((n) => (
                <li key={n.id} className="px-4 py-3 hover:bg-slate-50">
                  <p className="text-sm font-medium text-primary">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
