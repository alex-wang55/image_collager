"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PINS, layoutColumns, printStyle, seeded } from "@/lib/masonry";
import { inkOf, penOf, type Doodle, type Ink, type Pen } from "@/lib/pens";
import type { Note, Person, Photo } from "@/lib/types";
import { IconClose, IconComment, IconRefresh } from "./icons";
import { StickyNote } from "./notes";
import { Caption, DoodleLayer } from "./pen";
import { PhotoImg, useSigned } from "./photo-img";
import type { Pending } from "./uploads";
import { Spinner, cx } from "./ui";

type Item =
  | { kind: "photo"; id: string; width: number; height: number; extra: number; photo: Photo }
  | { kind: "pending"; id: string; width: number; height: number; extra: number; pending: Pending }
  | { kind: "note"; id: string; width: number; height: number; extra: number; note: Note };

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
  const columns = width < 500 ? 2 : width < 800 ? 3 : 4;
  return { ref, width, columns };
}

/** Rough caption height so the masonry balances: ~16 characters per line on a phone column. */
function captionLines(caption: string | null | undefined, colWidth: number) {
  if (!caption) return 0;
  const perLine = Math.max(10, Math.floor((colWidth - 2 * SIDE) / 9));
  return Math.min(3, Math.ceil(caption.length / perLine));
}

/**
 * The bulletin board: prints pinned or taped to cork, loose sticky notes
 * pinned in between, and notes stuck to the side of the photos they're about.
 */
export function Collage({
  photos,
  pending,
  notes,
  notesByPhoto,
  people,
  onOpen,
  onOpenNote,
  onRetry,
  onDiscard,
}: {
  photos: Photo[];
  pending: Pending[];
  /** loose notes, already limited to the stretch of time the loaded photos cover */
  notes: Note[];
  notesByPhoto: Record<string, Note[]>;
  people: Record<string, Person>;
  onOpen: (id: string) => void;
  onOpenNote: (n: Note) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const { ref, width, columns } = useColumns();
  const colWidth = width ? (width - GAP * (columns - 1)) / columns : 160;
  const placed = useRef(new Map<string, number>());
  const lastCols = useRef(columns);
  if (lastCols.current !== columns) {
    placed.current = new Map();
    lastCols.current = columns;
  }

  const items: Item[] = useMemo(() => {
    const ex = (lines: number) => (2 * SIDE + FOOT + lines * CAPTION_LINE + GAP + 8) / colWidth;
    const shown = new Set(photos.map((p) => p.id));
    // photos and loose notes share one timeline, newest first
    const dated: (Item & { at: string })[] = [
      ...photos.map((p) => ({ kind: "photo" as const, id: p.id, width: p.width, height: p.height, extra: ex(captionLines(p.caption, colWidth)), photo: p, at: p.created_at })),
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, width: 1, height: 0.9, extra: (GAP + 12) / colWidth, note: n, at: n.created_at })),
    ];
    dated.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    // the queue uploads oldest-pick first, so the last one picked will be newest: show it on top
    return [
      ...[...pending]
        .reverse()
        .filter((p) => !shown.has(p.id))
        .map((p): Item => ({ kind: "pending", id: p.id, width: p.width, height: p.height, extra: ex(captionLines(p.caption, colWidth)), pending: p })),
      ...dated,
    ];
  }, [photos, pending, notes, colWidth]);

  const cols = useMemo(() => layoutColumns(items, columns, placed.current), [items, columns]);
  const urls = useSigned(useMemo(() => photos.map((p) => p.thumb_path), [photos]));

  return (
    <div className="cork -mx-1 rounded-[22px] px-3 pb-5 pt-6 sm:mx-0 sm:px-5">
      <div ref={ref} className="flex items-start" style={{ gap: GAP }}>
        {cols.map((col, ci) => {
          // side notes stick out toward the middle of the board, never off its edge
          const side = ci < columns / 2 ? "right" : "left";
          return (
            <div key={ci} className="flex min-w-0 flex-1 flex-col" style={{ gap: GAP + 10 }}>
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
                    comments={it.photo.comment_count}
                    sideNotes={notesByPhoto[it.id]}
                    side={side}
                    by={it.photo.user_id ? people[it.photo.user_id] : undefined}
                    src={urls[it.photo.thumb_path]}
                    onClick={() => onOpen(it.id)}
                  />
                ) : it.kind === "note" ? (
                  <BoardNote key={it.id} note={it.note} onClick={() => onOpenNote(it.note)} />
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
                    side={side}
                    src={it.pending.preview}
                    fresh
                  >
                    <PendingOverlay p={it.pending} onRetry={() => onRetry(it.id)} onDiscard={() => onDiscard(it.id)} />
                  </Print>
                ),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A loose note pinned to the cork between the photos. */
function BoardNote({ note, onClick }: { note: Note; onClick: () => void }) {
  const pin = PINS[Math.floor(seeded(note.id, 9) * PINS.length)];
  return (
    <button type="button" onClick={onClick} className="relative mx-auto block w-[88%] text-left transition active:scale-[0.97]" aria-label="Open note">
      <span className="pin" style={{ "--pin": pin } as React.CSSProperties} />
      <StickyNote note={note} variant="board" />
    </button>
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
  comments,
  sideNotes,
  side,
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
  comments?: number;
  sideNotes?: Note[];
  side: "left" | "right";
  by?: Person;
  src?: string;
  fresh?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const s = printStyle(id);
  const style = { "--tilt": `${s.tilt}deg`, transform: "rotate(var(--tilt))", marginLeft: s.nudge, marginRight: -s.nudge } as React.CSSProperties;
  const Tag = onClick ? "button" : "div";
  const note = sideNotes?.[sideNotes.length - 1]; // newest on top
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
      {s.pin ? <span className="pin" style={{ "--pin": s.pin } as React.CSSProperties} /> : null}
      <span className="block" style={{ padding: `${SIDE}px ${SIDE}px 0` }}>
        <span className="relative block" style={{ aspectRatio: `${width} / ${height}` }}>
          <PhotoImg src={src} color={color} className="absolute inset-0" />
          <DoodleLayer doodle={doodle} width={width} height={height} />
          {children}
        </span>
      </span>
      <span className="flex items-end gap-1.5 px-2" style={{ minHeight: FOOT }}>
        {caption ? <Caption text={caption} pen={pen} ink={ink} size={19} className="line-clamp-3 flex-1 pb-1 pt-1 leading-[1.05]" /> : <span className="flex-1" />}
        {comments ? (
          <span className="mb-[4px] inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-print-muted" title={`${comments} comment${comments === 1 ? "" : "s"}`}>
            <IconComment size={13} />
            {comments}
          </span>
        ) : null}
        {by ? <span className="mb-[7px] h-2 w-2 shrink-0 rounded-full opacity-80" style={{ background: by.color }} title={`Added by ${by.display_name}`} /> : null}
      </span>
      {note ? (
        <span className="pointer-events-none absolute z-[4] block w-[50%]" style={{ [side]: -12, bottom: FOOT + 14 }}>
          <StickyNote note={note} variant="side" className="min-h-[3.5rem]" />
          {sideNotes!.length > 1 ? (
            <span className="absolute -top-2 rounded-full bg-ink px-1.5 text-[10px] font-bold text-bg" style={{ [side === "right" ? "right" : "left"]: -4 }}>
              +{sideNotes!.length - 1}
            </span>
          ) : null}
        </span>
      ) : null}
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
