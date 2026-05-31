'use client';

import { create } from 'zustand';

interface BadgeState {
  notifCount: number;
  friendCount: number;
  msgCount: number;
  setNotifCount: (n: number) => void;
  setFriendCount: (n: number) => void;
  setMsgCount: (n: number) => void;
  refreshBadges: (token: string) => Promise<void>;
}

export const useBadgeStore = create<BadgeState>((set) => ({
  notifCount: 0,
  friendCount: 0,
  msgCount: 0,

  setNotifCount: (n) => set({ notifCount: n }),
  setFriendCount: (n) => set({ friendCount: n }),
  setMsgCount: (n) => set({ msgCount: n }),

  refreshBadges: async (token: string) => {
    try {
      const [notifRes, friendRes, msgRes] = await Promise.all([
        fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/notifications?only=friends', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [notifData, friendData, msgData] = await Promise.all([
        notifRes.ok ? notifRes.json() : null,
        friendRes.ok ? friendRes.json() : null,
        msgRes.ok ? msgRes.json() : null,
      ]);
      set({
        notifCount: notifData?.unreadCount || 0,
        friendCount: friendData?.unreadCount || 0,
        msgCount: msgData?.unreadCount || 0,
      });
    } catch { /* ignore */ }
  },
}));
