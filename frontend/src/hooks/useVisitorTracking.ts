import { useEffect } from 'react';
import { useVisitorStore } from '../stores/visitorStore';

/** 切换作品或展厅后，同步本标签页访客正在看的位置 */
export const useVisitorTracking = (artworkId?: string, roomId?: string) => {
  const setSelfPosition = useVisitorStore((state) => state.setSelfPosition);

  useEffect(() => {
    setSelfPosition({ artworkId, roomId });
  }, [artworkId, roomId, setSelfPosition]);
};
