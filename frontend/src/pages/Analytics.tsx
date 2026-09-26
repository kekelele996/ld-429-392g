import { useMemo, useState } from 'react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useArtworkStore } from '../stores/artworkStore';
import { useRoomStore } from '../stores/roomStore';
import { useVisitorStore } from '../stores/visitorStore';
import { VisitorStatus } from '../types/enums';

const ALL_ROOMS = 'all';
const UNLOCATED = '__unlocated__';

const formatLastActive = (iso: string) => {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return '未知';
  if (diff < 5_000) return '刚刚';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false });
};

export function Analytics() {
  const artworks = useArtworkStore((state) => state.artworks);
  const rooms = useRoomStore((state) => state.rooms);
  const localVisitors = useVisitorStore((state) => state.localVisitors);
  const presetVisitors = useVisitorStore((state) => state.presetVisitors);
  const selfId = useVisitorStore((state) => state.self.visitorId);
  const [roomFilter, setRoomFilter] = useState(ALL_ROOMS);

  const artworkTitle = (id?: string) => artworks.find((artwork) => artwork.id === id)?.title ?? '未在查看作品';

  // 统计只覆盖仍有心跳的本机标签页访客，预置演示访客不计入
  const ranked = useMemo(
    () =>
      artworks
        .map((artwork) => ({
          artwork,
          views: localVisitors.filter((visitor) => visitor.viewedArtworkIds.includes(artwork.id)).length,
        }))
        .sort((a, b) => b.views - a.views),
    [artworks, localVisitors],
  );

  const roomGroups = useMemo(() => {
    const groups = rooms.map((room) => ({
      key: room.id,
      name: room.name,
      visitors: localVisitors.filter((visitor) => visitor.currentRoomId === room.id),
    }));
    const knownRoomIds = new Set(rooms.map((room) => room.id));
    const unlocated = localVisitors.filter((visitor) => !knownRoomIds.has(visitor.currentRoomId));
    if (unlocated.length > 0) groups.push({ key: UNLOCATED, name: '未定位', visitors: unlocated });
    return groups;
  }, [rooms, localVisitors]);

  const visibleGroups = roomFilter === ALL_ROOMS ? roomGroups : roomGroups.filter((group) => group.key === roomFilter);

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-[var(--color-muted)]">在线参观（本机标签页）</p>
          <p className="mt-2 text-5xl font-semibold">{localVisitors.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-[var(--color-muted)]">总停留分钟</p>
          <p className="mt-2 text-5xl font-semibold">{Math.round(localVisitors.reduce((sum, item) => sum + item.staySeconds, 0) / 60)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-[var(--color-muted)]">覆盖作品</p>
          <p className="mt-2 text-5xl font-semibold">{new Set(localVisitors.flatMap((item) => item.viewedArtworkIds)).size}</p>
        </div>
      </div>

      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">展厅实时在线</h2>
          <label className="text-sm text-[var(--color-muted)]">
            按展厅查看
            <select
              className="ml-3 border border-[var(--color-line)] bg-[var(--color-panel)] p-2 text-[var(--color-ink)]"
              value={roomFilter}
              onChange={(event) => setRoomFilter(event.target.value)}
            >
              <option value={ALL_ROOMS}>全部展厅</option>
              {roomGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {localVisitors.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--color-muted)]">当前没有在线的本机访客，再打开一个标签页即可在这里看到它。</p>
        ) : (
          <div className="mt-5 space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.key}>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  {group.name} · {group.visitors.length} 人
                </p>
                {group.visitors.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">暂无访客</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {group.visitors.map((visitor) => (
                      <div key={visitor.visitorId} className="grid gap-1 border border-[var(--color-line)] p-3 text-sm md:grid-cols-[1fr_1fr_auto]">
                        <span className="font-semibold">
                          {visitor.displayName}
                          {visitor.visitorId === selfId ? <span className="ml-2 text-xs text-[var(--color-accent)]">（本标签页）</span> : null}
                        </span>
                        <span className="text-[var(--color-muted)]">正在看：{artworkTitle(visitor.currentArtworkId)}</span>
                        <span className="text-[var(--color-muted)]">最后活动：{formatLastActive(visitor.lastActiveAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
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
        <div className="panel p-5">
          <h2 className="text-2xl font-semibold">路线回放</h2>
          <div className="mt-5 space-y-3">
            {localVisitors.length === 0 ? <p className="text-sm text-[var(--color-muted)]">暂无在线访客路线。</p> : null}
            {localVisitors.map((visitor) => (
              <div key={visitor.visitorId} className="border border-[var(--color-line)] p-3 text-sm">
                <p className="font-semibold">{visitor.displayName}</p>
                <p className="mt-1 text-[var(--color-muted)]">
                  {visitor.viewedArtworkIds.map((id) => artworks.find((artwork) => artwork.id === id)?.title ?? id).join(' -> ') || '尚未浏览作品'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold">预置访客（演示数据）</h2>
          <p className="text-sm text-[var(--color-muted)]">仅用于演示，不计入上方实时统计，也不会与本机标签页合并。</p>
        </div>
        <div className="mt-5 space-y-3">
          {presetVisitors.map((visitor) => (
            <div key={visitor.visitorId} className="grid gap-2 border border-[var(--color-line)] p-3 text-sm md:grid-cols-[1fr_1fr_auto]">
              <span className="font-semibold">{visitor.displayName}</span>
              <span className="text-[var(--color-muted)]">
                {rooms.find((room) => room.id === visitor.currentRoomId)?.name ?? visitor.currentRoomId} · 正在看：
                {artworkTitle(visitor.currentArtworkId)}
              </span>
              <StatusBadge status={visitor.onlineStatus === VisitorStatus.InGallery ? VisitorStatus.InGallery : VisitorStatus.Left} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
