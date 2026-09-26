import { useEffect, useMemo, useState } from 'react';
import { useArtworkStore } from '../stores/artworkStore';
import { useRoomStore } from '../stores/roomStore';
import { useVisitorStore } from '../stores/visitorStore';
import { VisitorStatus } from '../types/enums';
import { STALE_TIMEOUT_MS } from '../utils/presenceChannel';

const formatLastActive = (lastActiveAt: number, now: number) => {
  const seconds = Math.max(0, Math.round((now - lastActiveAt) / 1000));
  if (seconds < 2) return '刚刚';
  if (seconds < 60) return `${seconds} 秒前`;
  return `${Math.floor(seconds / 60)} 分钟前`;
};

export function Analytics() {
  const artworks = useArtworkStore((state) => state.artworks);
  const rooms = useRoomStore((state) => state.rooms);
  const localVisitors = useVisitorStore((state) => state.localVisitors);
  const demoVisitors = useVisitorStore((state) => state.demoVisitors);
  const selfId = useVisitorStore((state) => state.self.visitorId);
  const [roomFilter, setRoomFilter] = useState('all');
  const [now, setNow] = useState(() => Date.now());

  // 每秒刷新一次，让最后活动时间和在线名单跟随心跳过期
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 只统计仍有心跳的本地访客
  const activeVisitors = useMemo(
    () => localVisitors.filter((visitor) => now - visitor.lastActiveAt <= STALE_TIMEOUT_MS),
    [localVisitors, now],
  );

  const ranked = useMemo(
    () =>
      artworks
        .map((artwork) => ({
          artwork,
          views: activeVisitors.filter((visitor) => visitor.viewedArtworkIds.includes(artwork.id)).length,
        }))
        .sort((a, b) => b.views - a.views),
    [artworks, activeVisitors],
  );

  const filteredVisitors = useMemo(
    () =>
      activeVisitors
        .filter((visitor) => roomFilter === 'all' || visitor.currentRoomId === roomFilter)
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt),
    [activeVisitors, roomFilter],
  );

  const artworkTitle = (artworkId?: string) =>
    artworkId ? artworks.find((artwork) => artwork.id === artworkId)?.title ?? '未知作品' : '—';

  const roomName = (roomId?: string) =>
    roomId ? rooms.find((room) => room.id === roomId)?.name ?? '未知展厅' : '未进入展厅';

  const totalStayMinutes = Math.round(
    activeVisitors.reduce((sum, visitor) => sum + (now - visitor.enteredAt) / 1000, 0) / 60,
  );

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-[var(--color-muted)]">在线参观（本机标签页）</p>
          <p className="mt-2 text-5xl font-semibold">{activeVisitors.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-[var(--color-muted)]">总停留分钟</p>
          <p className="mt-2 text-5xl font-semibold">{totalStayMinutes}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-[var(--color-muted)]">覆盖作品</p>
          <p className="mt-2 text-5xl font-semibold">{new Set(activeVisitors.flatMap((item) => item.viewedArtworkIds)).size}</p>
        </div>
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">实时访客</h2>
            <select
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-2 text-sm"
              value={roomFilter}
              onChange={(event) => setRoomFilter(event.target.value)}
            >
              <option value="all">全部展厅</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5 space-y-3">
            {filteredVisitors.map((visitor) => (
              <div key={visitor.visitorId} className="grid grid-cols-[1fr_auto] border-b border-[var(--color-line)] pb-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {visitor.name}
                    {visitor.visitorId === selfId ? '（本标签页）' : ''}
                  </p>
                  <p className="mt-1 text-[var(--color-muted)]">
                    {roomName(visitor.currentRoomId)} · 正在看：{artworkTitle(visitor.currentArtworkId)}
                  </p>
                </div>
                <span className="text-[var(--color-muted)]">{formatLastActive(visitor.lastActiveAt, now)}</span>
              </div>
            ))}
            {filteredVisitors.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">该展厅暂无在线访客。</p>
            ) : null}
          </div>
        </div>
        <div className="panel p-5">
          <h2 className="text-2xl font-semibold">最受欢迎作品</h2>
          <div className="mt-5 space-y-3">
            {ranked.map(({ artwork, views }) => (
              <div key={artwork.id} className="grid grid-cols-[1fr_auto] border-b border-[var(--color-line)] pb-3">
                <span>{artwork.title}</span>
                <span className="text-[var(--color-accent)]">{views} views</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5">
          <h2 className="text-2xl font-semibold">路线回放</h2>
          <div className="mt-5 space-y-3">
            {activeVisitors.map((visitor) => (
              <div key={visitor.visitorId} className="border border-[var(--color-line)] p-3 text-sm">
                <p className="font-semibold">{visitor.name}</p>
                <p className="mt-1 text-[var(--color-muted)]">
                  {visitor.viewedArtworkIds.map((artworkId) => artworkTitle(artworkId)).join(' -> ') || '尚未浏览作品'}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <h2 className="text-2xl font-semibold">预置演示访客</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">演示数据，不计入实时统计，也不会与本机标签页合并。</p>
          <div className="mt-5 space-y-3">
            {demoVisitors.map((visitor) => (
              <div key={visitor.visitorId} className="border border-[var(--color-line)] p-3 text-sm">
                <p className="font-semibold">
                  {visitor.visitorId}
                  <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                    {visitor.onlineStatus === VisitorStatus.InGallery ? '演示 · 在馆' : '演示 · 已离馆'}
                  </span>
                </p>
                <p className="mt-1 text-[var(--color-muted)]">{visitor.viewedArtworkIds.join(' -> ') || '尚未浏览作品'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
