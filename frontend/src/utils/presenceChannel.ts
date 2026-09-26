import type { VisitorPresence } from '../types';

/** 心跳间隔：每个标签页按此频率广播自己的在线状态 */
export const HEARTBEAT_INTERVAL_MS = 3000;
/** 超过该时长没有心跳即视为离线（配合清理节奏，保证关标签后 10 秒内从名单移除） */
export const STALE_TIMEOUT_MS = 8000;
/** 离线访客的清理节奏 */
export const PRUNE_INTERVAL_MS = 2000;

export type PresenceMessage =
  | { type: 'heartbeat'; visitor: VisitorPresence }
  | { type: 'sync-request' }
  | { type: 'leave'; visitorId: string };

type PresenceListener = (message: PresenceMessage) => void;

const CHANNEL_NAME = 'gallery-presence';

/**
 * 基于 BroadcastChannel 的同源标签页通信总线。
 * 同一台电脑上的每个标签页通过它互相感知在线状态；
 * 浏览器不支持 BroadcastChannel 时退化为只能看到自己。
 */
const createPresenceBus = () => {
  const listeners = new Set<PresenceListener>();
  let channel: BroadcastChannel | null = null;

  const ensureChannel = () => {
    if (channel || typeof BroadcastChannel === 'undefined') return channel;
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<PresenceMessage>) => {
      listeners.forEach((listener) => listener(event.data));
    };
    return channel;
  };

  return {
    subscribe(listener: PresenceListener) {
      ensureChannel();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    post(message: PresenceMessage) {
      ensureChannel()?.postMessage(message);
    },
  };
};

export const presenceBus = createPresenceBus();
