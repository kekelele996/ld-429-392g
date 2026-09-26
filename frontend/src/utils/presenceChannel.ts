/**
 * 跨标签页在线状态传输层。
 *
 * 每个标签页把自己的心跳记录写入同一个 localStorage 键，
 * 其他标签页通过 storage 事件感知变化；超过 PRESENCE_STALE_MS
 * 没有心跳的记录视为离线并被清理。
 */

export interface PresenceRecord {
  visitorId: string;
  displayName: string;
  enteredAt: string;
  lastActiveAt: string;
  lastBeatAt: number;
  currentRoomId: string;
  currentArtworkId?: string;
  viewedArtworkIds: string[];
}

export const PRESENCE_STORAGE_KEY = 'virtual-gallery-presence-v1';
export const HEARTBEAT_INTERVAL_MS = 2_000;
export const PRESENCE_STALE_MS = 10_000;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const isPresenceLive = (record: PresenceRecord, now: number) => now - record.lastBeatAt <= PRESENCE_STALE_MS;

export const readPresence = (): PresenceRecord[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, PresenceRecord>;
    return Object.values(parsed).filter((record) => typeof record?.visitorId === 'string');
  } catch {
    return [];
  }
};

const writeAll = (records: PresenceRecord[]) => {
  if (!canUseStorage()) return;
  const map = Object.fromEntries(records.map((record) => [record.visitorId, record]));
  try {
    window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 存储被禁用或已满时静默降级，本页继续以单机模式运行
  }
};

export const writePresence = (record: PresenceRecord) => {
  const others = readPresence().filter((item) => item.visitorId !== record.visitorId);
  writeAll([...others, record]);
};

export const removePresence = (visitorId: string) => {
  writeAll(readPresence().filter((item) => item.visitorId !== visitorId));
};

/** 剔除心跳过期的记录（顺手从存储中清掉），返回仍在线的记录。 */
export const prunePresence = (now: number): PresenceRecord[] => {
  const all = readPresence();
  const live = all.filter((record) => isPresenceLive(record, now));
  if (live.length !== all.length) writeAll(live);
  return live;
};

/** 监听其他标签页写入的在线状态变化（storage 事件不会触发本标签页）。 */
export const subscribePresence = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === PRESENCE_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};
