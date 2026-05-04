"use client";

import { useEffect, useRef } from "react";
import { getToken } from "@/lib/api";

interface Options { fileId: string; groupId: string; sentinelRef?: React.RefObject<HTMLElement | null> }

/**
 * Reads:
 *  - scroll depth via IntersectionObserver on a sentinel at content bottom
 *  - active time via Page Visibility API (paused when tab hidden)
 * Posts to /api/v1/analytics/reading-event every 30s and on unmount.
 *
 * NOTE: backend endpoint is currently a stub. This hook will silently no-op until implemented.
 */
export function useReadingTracker({ fileId, groupId, sentinelRef }: Options) {
  const startRef = useRef<number>(Date.now());
  const activeMsRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const visibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);
  const scrollDepthRef = useRef(0);
  const sentRef = useRef(false);

  useEffect(() => {
    function onVis() {
      const now = Date.now();
      if (visibleRef.current) activeMsRef.current += now - lastTickRef.current;
      visibleRef.current = !document.hidden;
      lastTickRef.current = now;
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const target = sentinelRef?.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) scrollDepthRef.current = Math.max(scrollDepthRef.current, 1);
        else scrollDepthRef.current = Math.max(scrollDepthRef.current, entry.intersectionRatio);
      }
    }, { threshold: [0.25, 0.5, 0.75, 1] });
    observer.observe(target);
    return () => observer.disconnect();
  }, [sentinelRef]);

  async function send(useBeacon = false) {
    const now = Date.now();
    if (visibleRef.current) activeMsRef.current += now - lastTickRef.current;
    lastTickRef.current = now;
    const payload = {
      file_id: fileId,
      group_id: groupId,
      scroll_depth_pct: Number(scrollDepthRef.current.toFixed(2)),
      active_time_seconds: Math.round(activeMsRef.current / 1000),
    };
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/analytics/reading-event`;
    try {
      const token = await getToken();
      if (useBeacon && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload), keepalive: true });
      }
    } catch {
      if (!sentRef.current) console.warn("[reading-tracker] endpoint unavailable — backend stub not implemented yet");
      sentRef.current = true;
    }
  }

  useEffect(() => {
    const interval = setInterval(() => { if (visibleRef.current) send(false); }, 30000);
    const onUnload = () => send(true);
    window.addEventListener("beforeunload", onUnload);
    return () => { clearInterval(interval); window.removeEventListener("beforeunload", onUnload); send(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, groupId]);
}
