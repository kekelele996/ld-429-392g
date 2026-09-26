import { create } from 'zustand';
import type { VisitorLog } from '../types';
import { VisitorSource, VisitorStatus } from '../types/enums';
import { visitors as presetVisitorData } from '../api/mockGallery';
import {
  HEARTBEAT_INTERVAL_MS,
  PRESENCE_STALE_MS,
  prunePresence,
  readPresence,
  removePresence,
  subscribePresence,
  writePresence,
  type PresenceRecord,
} from '../utils/presenceChannel';

interface SelfPresence {
  visitorId: string;
  displayName: string;
  enteredAt: string;
  lastActiveAt: string;
  roomId: string;
  artworkId?: string;
  viewedIds: string[];
}

interface VisitorState {
  /** 仍有心跳的本机标签页访客（含当前标签页） */
  localVisitors: VisitorLog[];
  /** 预置演示访客，不参与实时统计 */
  presetVisitors: VisitorLog[];
  self: SelfPresence;
  started: boolean;
  startPresence: () => void;
  updateLocation: (location: { roomId?: string; artworkId?: string }) => void;
  markViewed: (artworkId: string) => void;
}

const createIdentity = () => {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    visitorId: `tab-${Date.now().toString(36)}-${suffix.toLowerCase()}`,
    displayName: `匿名访客-${suffix}`,
  };
};

const toVisitorLog = (record: PresenceRecord, now: number): VisitorLog => ({
  visitorId: record.visitorId,
  displayName: record.displayName,
  enteredAt: record.enteredAt,
  staySeconds: Math.max(0, Math.round((now - Date.parse(record.enteredAt)) / 1000)),
  viewedArtworkIds: record.viewedArtworkIds,
  currentRoomId: record.currentRoomId,
  currentArtworkId: record.currentArtworkId,
  lastActiveAt: record.lastActiveAt,
  onlineStatus: VisitorStatus.InGallery,
  source: VisitorSource.Local,
});

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribePresence: (() => void) | undefined;

export const useVisitorStore = create<VisitorState>((set, get) => {
  const publish = () => {
    const { self } = get();
    const record: PresenceRecord = {
      visitorId: self.visitorId,
      displayName: self.displayName,
      enteredAt: self.enteredAt,
      lastActiveAt: self.lastActiveAt,
      lastBeatAt: Date.now(),
      currentRoomId: self.roomId,
      currentArtworkId: self.artworkId,
      viewedArtworkIds: self.viewedIds,
    };
    writePresence(record);
  };

  /** 重新计算仍在线的本地访客，并把下一次过期检查排到最近的失效时刻。 */
  const refreshLive = () => {
    const now = Date.now();
    const live = prunePresence(now);
    set({ localVisitors: live.map((record) => toVisitorLog(record, now)) });

    if (expiryTimer) clearTimeout(expiryTimer);
    if (live.length > 0) {
      const nextExpiryAt = Math.min(...live.map((record) => record.lastBeatAt)) + PRESENCE_STALE_MS;
      expiryTimer = setTimeout(refreshLive, Math.max(50, nextExpiryAt - Date.now() + 30));
    }
  };

  const ensureStarted = () => {
    if (get().started) return;
    set({ started: true });
    publish();
    refreshLive();
    heartbeatTimer = setInterval(() => {
      publish();
      refreshLive();
    }, HEARTBEAT_INTERVAL_MS);
    unsubscribePresence = subscribePresence(refreshLive);
    window.addEventListener('pagehide', handlePageHide);
  };

  const touchSelf = (patch: Partial<SelfPresence>) => {
    ensureStarted();
    set((state) => ({
      self: { ...state.self, ...patch, lastActiveAt: new Date().toISOString() },
    }));
    publish();
    refreshLive();
  };

  return {
    localVisitors: readPresence()
      .filter((record) => Date.now() - record.lastBeatAt <= PRESENCE_STALE_MS)
      .map((record) => toVisitorLog(record, Date.now())),
    presetVisitors: presetVisitorData,
    self: {
      ...createIdentity(),
      enteredAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      roomId: '',
      artworkId: undefined,
      viewedIds: [],
    },
    started: false,
    startPresence: ensureStarted,
    updateLocation: ({ roomId, artworkId }) => {
      if (roomId === undefined && artworkId === undefined) {
        ensureStarted();
        return;
      }
      touchSelf({
        ...(roomId !== undefined ? { roomId } : {}),
        ...(artworkId !== undefined ? { artworkId } : {}),
      });
    },
    markViewed: (artworkId) => {
      const { self } = get();
      touchSelf({
        artworkId,
        viewedIds: self.viewedIds.includes(artworkId) ? self.viewedIds : [...self.viewedIds, artworkId],
      });
    },
  };
});

const handlePageHide = () => {
  removePresence(useVisitorStore.getState().self.visitorId);
};
