import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Single app-wide presence channel: every signed-in session announces itself. */
let channel: RealtimeChannel | null = null;
let trackedUser: string | null = null;
let online = new Set<string>();
const listeners = new Set<(s: Set<string>) => void>();

function emit() {
  for (const l of listeners) l(online);
}

function ensureChannel() {
  if (channel) return channel;
  channel = supabase.channel("radiant-online", { config: { presence: { key: "" } } });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel!.presenceState() as Record<string, Array<{ user_id?: string }>>;
    const next = new Set<string>();
    for (const metas of Object.values(state)) for (const m of metas) if (m.user_id) next.add(m.user_id);
    online = next;
    emit();
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED" && trackedUser) void channel!.track({ user_id: trackedUser, at: Date.now() });
  });
  return channel;
}

/** Announce the signed-in user as online while the app is open. */
export function useTrackOnlinePresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    trackedUser = userId;
    const ch = ensureChannel();
    void ch.track({ user_id: userId, at: Date.now() });
    return () => {
      trackedUser = null;
      void ch.untrack();
    };
  }, [userId]);
}

/** Live set of auth user ids currently online. */
export function useOnlineUserIds() {
  const [ids, setIds] = useState<Set<string>>(online);
  useEffect(() => {
    ensureChannel();
    const l = (s: Set<string>) => setIds(new Set(s));
    listeners.add(l);
    l(online);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return ids;
}
