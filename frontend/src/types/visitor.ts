import { VisitorSource, VisitorStatus } from './enums';

export interface VisitorLog {
  visitorId: string;
  displayName: string;
  enteredAt: string;
  staySeconds: number;
  viewedArtworkIds: string[];
  currentRoomId: string;
  currentArtworkId?: string;
  lastActiveAt: string;
  onlineStatus: VisitorStatus;
  source: VisitorSource;
}
