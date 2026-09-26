import { create } from 'zustand';
import type { VisitorLog, VisitorPresence } from '../types';
import { visitors as demoVisitors } from '../api/mockGallery';
import { presenceBus, STALE_TIMEOUT_MS } from '../utils/presenceChannel';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** 每个标签页进入时分配一个匿名身份，只存在于本标签页的生命周期内 */
const createSelfPresence = (): VisitorPresence => {
  const id = `tab-${randomId()}`;
  return {
    visitorId: id,
    name: `访客-${id.slice(-4).toUpperCase()}`,
    enteredAt: Date.now(),
    lastActiveAt: Date.now(),
    viewedArtworkIds: [],
  };
};

interface VisitorState {
  /** 预置访客：仅作演示数据，不与本机标签页混为同一个人 */
  demoVisitors: VisitorLog[];
  /** 本标签页自己的访客身份 */
  self: VisitorPresence;
  /** 本机仍有心跳的实时访客（含自己） */
  localVisitors: VisitorPresence[];
  /** 切换作品或展厅后，更新自己正在看的位置并立即广播 */
  setSelfPosition: (position: { roomId?: string; artworkId?: string }) => void;
  /** 心跳：刷新自己的最后活动时间并广播 */
  heartbeat: () => void;
  /** 收到其他标签页的心跳 */
  receivePresence: (visitor: VisitorPresence) => void;
  /** 收到其他标签页的离开消息 */
  receiveLeave: (visitorId: string) => void;
  /** 移除超过心跳超时的访客（自己除外） */
  pruneStale: (now?: number) => void;
  /** 关闭标签页时广播离开 */
  leave: () => void;
}

export const useVisitorStore = create<VisitorState>((set, get) => {
  const self = createSelfPresence();

  const publishSelf = (next: VisitorPresence) => {
    set((state) => ({
      self: next,
      localVisitors: [...state.localVisitors.filter((visitor) => visitor.visitorId !== next.visitorId), next],
    }));
    presenceBus.post({ type: 'heartbeat', visitor: next });
  };

  return {
    demoVisitors,
    self,
    localVisitors: [self],
    setSelfPosition: ({ roomId, artworkId }) => {
      const current = get().self;
      publishSelf({
        ...current,
        currentRoomId: roomId ?? current.currentRoomId,
        currentArtworkId: artworkId ?? current.currentArtworkId,
        viewedArtworkIds: artworkId
          ? Array.from(new Set([...current.viewedArtworkIds, artworkId]))
          : current.viewedArtworkIds,
        lastActiveAt: Date.now(),
      });
    },
    heartbeat: () => {
      publishSelf({ ...get().self, lastActiveAt: Date.now() });
    },
    receivePresence: (visitor) => {
      if (visitor.visitorId === get().self.visitorId) return;
      set((state) => ({
        localVisitors: [...state.localVisitors.filter((item) => item.visitorId !== visitor.visitorId), visitor],
      }));
    },
    receiveLeave: (visitorId) => {
      if (visitorId === get().self.visitorId) return;
      set((state) => ({
        localVisitors: state.localVisitors.filter((visitor) => visitor.visitorId !== visitorId),
      }));
    },
    pruneStale: (now = Date.now()) => {
      const { self, localVisitors } = get();
      const fresh = localVisitors.filter(
        (visitor) => visitor.visitorId === self.visitorId || now - visitor.lastActiveAt <= STALE_TIMEOUT_MS,
      );
      if (fresh.length !== localVisitors.length) set({ localVisitors: fresh });
    },
    leave: () => {
      presenceBus.post({ type: 'leave', visitorId: get().self.visitorId });
    },
  };
});
