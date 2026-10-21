"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { layoutColumns, printStyle } from "@/lib/masonry";
import { inkOf, penOf, type Doodle, type Ink, type Pen } from "@/lib/pens";
import { Caption, DoodleLayer } from "./pen";
import type { Person, Photo } from "@/lib/types";
import { PhotoImg, useSigned } from "./photo-img";
import type { Pending } from "./uploads";
import { Spinner, cx } from "./ui";
import { IconRefresh, IconClose } from "./icons";

type Item =
  | { kind: "photo"; id: string; width: number; height: number; extra: number; photo: Photo }
  | { kind: "pending"; id: string; width: number; height: number; extra: number; pending: Pending };

const GAP = 14; // px between columns
const SIDE = 6; // print border, px
const FOOT = 22; // thicker bottom edge, like an instant photo
const CAPTION_LINE = 22;

function useColumns() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const columns = width < 520 ? 2 : width < 820 ? 3 : 4;
  return { ref, width, columns };
}

/** Rough caption height so the masonry balances: ~16 characters per line on a phone column. */
function captionLines(caption: string | null | undefined, colWidth: number) {
  if (!caption) return 0;
  const perLine = Math.max(10, Math.floor((colWidth - 2 * SIDE) / 9));
  return Math.min(3, Math.ceil(caption.length / perLine));
}

export function Collage({
  photos,
  pending,
  people,
  onOpen,
  onRetry,
  onDiscard,
}: {
  photos: Photo[];
  pending: Pending[];
  people: Record<string, Person>;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { ref, width, columns } = useColumns();
  const colWidth = width ? (width - GAP * (columns - 1)) / columns : 170;
  const placed = useRef(new Map<string, number>());
  const lastCols = useRef(columns);
  if (lastCols.current !== columns) {
    placed.current = new Map();
    lastCols.current = columns;
  }

  const items: Item[] = useMemo(() => {
    const ex = (lines: number) => (2 * SIDE + FOOT + lines * CAPTION_LINE + GAP) / colWidth;
    const shown = new Set(photos.map((p) => p.id));
    // the queue uploads oldest-pick first, so the last one picked will be newest: show it on top
    return [
      ...[...pending]
        .reverse()
        .filter((p) => !shown.has(p.id))
        .map((p): Item => ({ kind: "pending", id: p.id, width: p.width, height: p.height, extra: ex(captionLines(p.caption, colWidth)), pending: p })),
      ...photos.map((p): Item => ({ kind: "photo", id: p.id, width: p.width, height: p.height, extra: ex(captionLines(p.caption, colWidth)), photo: p })),
    ];
  }, [photos, pending, colWidth]);

  const cols = useMemo(() => layoutColumns(items, columns, placed.current), [items, columns]);
  const urls = useSigned(useMemo(() => photos.map((p) => p.thumb_path), [photos]));

  return (
    <div ref={ref} className="flex items-start" style={{ gap: GAP }}>
      {cols.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col" style={{ gap: GAP + 4 }}>
          {col.map((it) =>
            it.kind === "photo" ? (
              <Print
                key={it.id}
                id={it.id}
                width={it.width}
                height={it.height}
                caption={it.photo.caption}
                pen={penOf(it.photo)}
                ink={inkOf(it.photo)}
                doodle={it.photo.doodle}
                color={it.photo.color}
                by={it.photo.user_id ? people[it.photo.user_id] : undefined}
                src={urls[it.photo.thumb_path]}
                onClick={() => onOpen(it.id)}
              />
            ) : (
              <Print
                key={it.id}
                id={it.id}
                width={it.width}
                height={it.height}
                caption={it.pending.caption}
                pen={it.pending.pen}
                ink={it.pending.ink}
                doodle={it.pending.doodle}
                src={it.pending.preview}
                fresh
              >
                <PendingOverlay p={it.pending} onRetry={() => onRetry(it.id)} onDiscard={() => onDiscard(it.id)} />
              </Print>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function Print({
  id,
  width,
  height,
  caption,
  pen,
  ink,
  doodle,
  color,
  by,
  src,
  fresh,
  onClick,
  children,
}: {
  id: string;
  width: number;
  height: number;
  caption?: string | null;
  pen: Pen;
  ink: Ink;
  doodle?: Doodle | null;
  color?: string | null;
  by?: Person;
  src?: string;
  fresh?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const s = printStyle(id);
  const style = { "--tilt": `${s.tilt}deg`, transform: "rotate(var(--tilt))", marginLeft: s.nudge, marginRight: -s.nudge } as React.CSSProperties;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={style}
      className={cx(
        "relative block w-auto bg-print text-left shadow-print transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
        onClick && "active:scale-[0.97]",
        fresh && "animate-drop",
      )}
    >
      {s.tape ? <span className="tape" style={{ transform: `translateX(calc(-50% + ${s.tape.at}px)) rotate(${s.tape.tilt}deg)` }} /> : null}
      <span className="block" style={{ padding: `${SIDE}px ${SIDE}px 0` }}>
        <span className="relative block" style={{ aspectRatio: `${width} / ${height}` }}>
          <PhotoImg src={src} color={color} className="absolute inset-0" />
          <DoodleLayer doodle={doodle} width={width} height={height} />
          {children}
        </span>
      </span>
      <span className="flex items-end gap-1.5 px-2" style={{ minHeight: FOOT }}>
        {caption ? <Caption text={caption} pen={pen} ink={ink} size={19} className="line-clamp-3 flex-1 pb-1 pt-1 leading-[1.05]" /> : <span className="flex-1" />}
        {by ? <span className="mb-[7px] h-2 w-2 shrink-0 rounded-full opacity-80" style={{ background: by.color }} title={`Added by ${by.display_name}`} /> : null}
      </span>
    </Tag>
  );
}

function PendingOverlay({ p, onRetry, onDiscard }: { p: Pending; onRetry: () => void; onDiscard: () => void }) {
  if (p.status === "failed") {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 p-2 text-center text-white">
        <span className="text-xs font-semibold leading-tight">{p.error ?? "Didn't upload"}</span>
        <span className="flex gap-2">
          <button type="button" onClick={onRetry} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-black">
            <IconRefresh size={14} /> Retry
          </button>
          <button type="button" onClick={onDiscard} aria-label="Remove" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <IconClose size={14} />
          </button>
        </span>
      </span>
    );
  }
  return (
    <span className="absolute inset-0 flex items-end justify-end bg-white/25 p-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
        <Spinner small />
      </span>
    </span>
  );
}
