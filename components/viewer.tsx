"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { longDate, shortDate } from "@/lib/dates";
import { signUrls } from "@/lib/photos";
import type { Person, Photo } from "@/lib/types";
import { IconClose, IconDownload, IconMore, IconPen, IconShare, IconStar, IconTrash } from "./icons";
import { useSigned } from "./photo-img";
import { ActionSheet, Avatar, cx, useToast, type MenuItem } from "./ui";

type Props = {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onNeedMore?: () => void;
  people: Record<string, Person>;
  meId: string;
  isOwner: boolean;
  boardName: string;
  coverId: string | null;
  onDelete: (p: Photo) => void;
  onEditCaption: (p: Photo) => void;
  onMakeCover: (p: Photo) => void;
};

/** Full-screen photos. Swipe sideways to flip through, swipe down (or tap ×) to close. */
export function Viewer(props: Props) {
  const { photos, index, onIndex, onClose, onNeedMore, people, meId, isOwner, boardName, coverId } = props;
  const toast = useToast();
  const track = useRef<HTMLDivElement>(null);
  const [chrome, setChrome] = useState(true);
  const [menu, setMenu] = useState(false);
  const [dragY, setDragY] = useState(0);
  const blobs = useRef(new Map<string, Blob>());
  const photo = photos[index];

  // thumbs for neighbours show instantly while the full photo loads
  const near = useMemo(() => photos.slice(Math.max(0, index - 2), index + 3), [photos, index]);
  const thumbs = useSigned(useMemo(() => near.map((p) => p.thumb_path), [near]));

  // Jump (no animation) when the index changes from outside: on open, or when
  // a friend's new photo lands at the front of the list and shifts everything.
  useLayoutEffect(() => {
    const el = track.current;
    if (el && Math.round(el.scrollLeft / el.clientWidth) !== index) el.scrollLeft = index * el.clientWidth;
  }, [index]);

  useEffect(() => {
    if (index >= photos.length - 6) onNeedMore?.();
  }, [index, photos.length, onNeedMore]);

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || i < 0 || i >= photos.length) return;
      el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    },
    [photos.length],
  );

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index && i >= 0 && i < photos.length) onIndex(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menu) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, index, onClose, menu]);

  // keep the slide lined up if the phone rotates
  useEffect(() => {
    const onResize = () => {
      const el = track.current;
      if (el) el.scrollLeft = index * el.clientWidth;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [index]);

  // swipe down to dismiss
  const touch = useRef<{ x: number; y: number; mode: "none" | "y" | "x" } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: "none" };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    if (t.mode === "none" && Math.hypot(dx, dy) > 8) t.mode = Math.abs(dy) > Math.abs(dx) * 1.2 ? "y" : "x";
    if (t.mode === "y") setDragY(Math.max(-60, dy));
  };
  const onTouchEnd = () => {
    if (touch.current?.mode === "y" && dragY > 110) onClose();
    else setDragY(0);
    touch.current = null;
  };

  async function share() {
    if (!photo) return;
    const blob = blobs.current.get(photo.path);
    if (!blob) return toast("Still loading, try again in a sec");
    const ext = photo.path.endsWith(".webp") ? "webp" : "jpg";
    const file = new File([blob], `${boardName.replace(/[^\w\- ]+/g, "").trim() || "photo"}-${photo.id.slice(0, 6)}.${ext}`, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: photo.caption ?? boardName });
      } catch {
        // closed the share sheet
      }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  if (!photo) return null;
  const by = photo.user_id ? people[photo.user_id] : undefined;
  const mine = photo.user_id === meId;
  const items: MenuItem[] = [
    { label: photo.caption ? "Edit caption" : "Add a caption", icon: <IconPen size={20} />, onClick: () => props.onEditCaption(photo), hidden: !mine },
    { label: coverId === photo.id ? "This is the cover" : "Make it the cover", icon: <IconStar size={20} />, onClick: () => props.onMakeCover(photo), hint: "Shows on the board in your list" },
    { label: "Save to phone", icon: <IconDownload size={20} />, onClick: share },
    { label: "Delete photo", icon: <IconTrash size={20} />, onClick: () => props.onDelete(photo), danger: true, hidden: !(mine || isOwner) },
  ];
  const fade = Math.max(0, 1 - Math.abs(dragY) / 400);

  return createPortal(
    <div className="fixed inset-0 z-[60] select-none text-white" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="absolute inset-0 bg-[#0c0b09]" style={{ opacity: fade }} />
      <div
        ref={track}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain"
        style={{ touchAction: "pan-x" }}
      >
        {photos.map((p, i) => (
          <div key={p.id} className="relative h-full w-full shrink-0 snap-center snap-always" onClick={() => setChrome((c) => !c)}>
            {Math.abs(i - index) <= 2 ? (
              <Slide
                photo={p}
                thumb={thumbs[p.thumb_path]}
                full={Math.abs(i - index) <= 1}
                dragY={i === index ? dragY : 0}
                onBlob={(b) => (b ? blobs.current.set(p.path, b) : blobs.current.delete(p.path))}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* top bar */}
      <div
        className={cx("pt-safe pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent transition-opacity", chrome && !dragY ? "opacity-100" : "opacity-0")}
      >
        <div className="pointer-events-auto flex h-14 items-center justify-between px-2">
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
            <IconClose />
          </button>
          <span className="tabular text-sm font-semibold text-white/80">
            {index + 1} of {photos.length}
          </span>
          <button type="button" onClick={() => setMenu(true)} aria-label="More" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
            <IconMore />
          </button>
        </div>
      </div>

      {/* caption and details */}
      <div
        className={cx(
          "pb-safe pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent pt-16 transition-opacity",
          chrome && !dragY ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto mx-auto flex max-w-2xl items-end gap-3 px-5">
          <div className="min-w-0 flex-1">
            {photo.caption ? <p className="font-hand mb-1.5 text-[26px] leading-[1.1] text-white">{photo.caption}</p> : null}
            <div className="flex items-center gap-2 text-[13px] text-white/75">
              {by ? <Avatar person={by} size={20} /> : null}
              <span className="truncate">
                {by ? `${by.id === meId ? "You" : by.display_name.split(/\s+/)[0]} · ` : ""}
                {photo.taken_at ? longDate(photo.taken_at) : `Added ${shortDate(photo.created_at)}`}
              </span>
            </div>
          </div>
          <button type="button" onClick={share} aria-label="Share" className="mb-[-6px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/12 active:bg-white/20">
            <IconShare />
          </button>
        </div>
      </div>

      <ActionSheet open={menu} onClose={() => setMenu(false)} items={items} />
    </div>,
    document.body,
  );
}

function Slide({ photo, thumb, full, dragY, onBlob }: { photo: Photo; thumb?: string; full: boolean; dragY: number; onBlob: (b: Blob | null) => void }) {
  const [src, setSrc] = useState<string | null>(null);

  // Load the full photo as a blob: it displays from an object URL, and the
  // same bytes are ready to hand to the share sheet without another trip.
  useEffect(() => {
    if (!full) return;
    let alive = true;
    let url: string | null = null;
    (async () => {
      const signed = (await signUrls([photo.path]))[photo.path];
      if (!signed || !alive) return;
      const res = await fetch(signed, { mode: "cors" });
      if (!res.ok || !alive) return;
      const blob = await res.blob();
      if (!alive) return;
      url = URL.createObjectURL(blob);
      onBlob(blob);
      setSrc(url);
    })().catch(() => {});
    return () => {
      alive = false;
      onBlob(null);
      if (url) URL.revokeObjectURL(url);
      setSrc(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, photo.path]);

  const style: React.CSSProperties = dragY
    ? { transform: `translateY(${dragY}px) scale(${1 - Math.min(0.25, Math.abs(dragY) / 1200)})` }
    : { transition: "transform 0.25s ease-out" };
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={style}>
      <div className="relative h-full w-full">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        ) : null}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={photo.caption ?? ""} className="animate-fade absolute inset-0 h-full w-full object-contain" draggable={false} />
        ) : null}
      </div>
    </div>
  );
}
