import { VisitorStatus } from './enums';

export interface VisitorLog {
  visitorId: string;
  enteredAt: string;
  staySeconds: number;
  viewedArtworkIds: string[];
  currentRoomId: string;
  onlineStatus: VisitorStatus;
}

/** 本机某个标签页的实时在线快照，通过心跳在标签页之间同步 */
export interface VisitorPresence {
  visitorId: string;
  name: string;
  enteredAt: number;
  lastActiveAt: number;
  currentRoomId?: string;
  currentArtworkId?: string;
  viewedArtworkIds: string[];
}
