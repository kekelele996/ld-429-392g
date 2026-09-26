import { useEffect } from 'react';
import { useVisitorStore } from '../stores/visitorStore';

interface VisitorLocation {
  roomId?: string;
  artworkId?: string;
}

/**
 * 访客追踪：挂载时确保心跳会话已启动（任何页面调用一次即可保持在线），
 * 并在展厅 / 作品变化时同步本标签页“正在看”的位置。
 */
export const useVisitorTracking = (location?: VisitorLocation) => {
  const startPresence = useVisitorStore((state) => state.startPresence);
  const updateLocation = useVisitorStore((state) => state.updateLocation);
  const markViewed = useVisitorStore((state) => state.markViewed);
  const roomId = location?.roomId;
  const artworkId = location?.artworkId;

  useEffect(() => {
    startPresence();
  }, [startPresence]);

  useEffect(() => {
    updateLocation({ roomId, artworkId });
  }, [roomId, artworkId, updateLocation]);

  useEffect(() => {
    if (artworkId) markViewed(artworkId);
  }, [artworkId, markViewed]);
};
