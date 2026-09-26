import { useEffect } from 'react';
import { useVisitorStore } from '../stores/visitorStore';
import { HEARTBEAT_INTERVAL_MS, presenceBus, PRUNE_INTERVAL_MS } from '../utils/presenceChannel';

/**
 * 把当前标签页登记为一位匿名访客：
 * 进入时广播身份并请求其他标签页同步，之后按心跳维持在线状态；
 * 标签页关闭时广播离开，其余标签页也会在心跳超时后将其从名单移除。
 */
export const useVisitorPresence = () => {
  const heartbeat = useVisitorStore((state) => state.heartbeat);
  const receivePresence = useVisitorStore((state) => state.receivePresence);
  const receiveLeave = useVisitorStore((state) => state.receiveLeave);
  const pruneStale = useVisitorStore((state) => state.pruneStale);
  const leave = useVisitorStore((state) => state.leave);

  useEffect(() => {
    const unsubscribe = presenceBus.subscribe((message) => {
      if (message.type === 'heartbeat') receivePresence(message.visitor);
      else if (message.type === 'leave') receiveLeave(message.visitorId);
      else heartbeat(); // sync-request：有新标签页上线，立即重报自己的状态
    });

    heartbeat();
    presenceBus.post({ type: 'sync-request' });

    const heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    const pruneTimer = window.setInterval(() => pruneStale(), PRUNE_INTERVAL_MS);
    const handlePageHide = () => leave();
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      unsubscribe();
      window.clearInterval(heartbeatTimer);
      window.clearInterval(pruneTimer);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [heartbeat, receivePresence, receiveLeave, pruneStale, leave]);
};
