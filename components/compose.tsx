"use client";

import { useEffect, useRef, useState } from "react";
import { PENS, inkColor, lastPen, rememberPen, type Doodle, type Ink, type Pen } from "@/lib/pens";
import type { NewPhoto } from "./uploads";
import { DoodleEditor } from "./doodle-editor";
import { DoodleLayer, PenPicker } from "./pen";
import { Button, Sheet, cx } from "./ui";
import { IconClose, IconPen, IconPlus } from "./icons";

type Draft = { key: string; file: File; url: string; caption: string; pen: Pen; ink: Ink; doodle: Doodle | null; width: number; height: number };

/**
 * The step between picking photos and adding them: see what you picked,
 * write on the bottom of each print (in whichever pen), draw on it, drop any
 * you didn't mean.
 */
export function Compose({
  files,
  boardName,
  onAdd,
  onCancel,
  onPickMore,
}: {
  files: File[];
  boardName: string;
  onAdd: (items: NewPhoto[]) => void;
  onCancel: () => void;
  onPickMore: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [cur, setCur] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const seen = useRef(new Set<File>());
  const all = useRef(drafts);
  all.current = drafts;

  // new files (first pick, or "add more") get appended, and we jump to the first of them
  useEffect(() => {
    const fresh = files.filter((f) => !seen.current.has(f));
    if (!fresh.length) return;
    fresh.forEach((f) => seen.current.add(f));
    const startAt = all.current.length;
    const { pen, ink } = lastPen();
    setDrafts((d) => [
      ...d,
      ...fresh.map((f) => ({ key: crypto.randomUUID(), file: f, url: URL.createObjectURL(f), caption: "", pen, ink, doodle: null, width: 0, height: 0 })),
    ]);
    setCur(startAt);
  }, [files]);

  // free the previews when the sheet goes away
  useEffect(() => () => all.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  const d = drafts[cur];
  const set = (key: string, p: Partial<Draft>) => setDrafts((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  function remove(key: string) {
    const i = drafts.findIndex((x) => x.key === key);
    const x = drafts[i];
    if (x) URL.revokeObjectURL(x.url);
    const next = drafts.filter((y) => y.key !== key);
    if (!next.length) return onCancel();
    setDrafts(next);
    setCur((c) => Math.min(next.length - 1, c > i ? c - 1 : c));
  }

  function submit() {
    onAdd(drafts.map((x) => ({ file: x.file, caption: x.caption, pen: x.pen, ink: x.ink, doodle: x.doodle, width: x.width, height: x.height })));
  }

  return (
    <>
      <Sheet open={!drawing} onClose={onCancel} label="Add photos" className="sm:max-w-lg">
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Add {drafts.length} photo{drafts.length === 1 ? "" : "s"}
            </h2>
            <p className="text-sm text-muted">to {boardName}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
            <IconClose />
          </button>
        </div>

        {d ? (
          <>
            <div className="flex justify-center px-6 pb-3 pt-3">
              <div className="w-full max-w-[300px] -rotate-1 bg-print p-2.5 pb-0 shadow-print">
                <div className="relative mx-auto w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={d.key}
                    src={d.url}
                    alt=""
                    className="block max-h-[38dvh] w-auto max-w-full"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (!d.width) set(d.key, { width: img.naturalWidth, height: img.naturalHeight });
                    }}
                  />
                  {d.width ? <DoodleLayer doodle={d.doodle} width={d.width} height={d.height} /> : null}
                  <button
                    type="button"
                    onClick={() => setDrawing(true)}
                    disabled={!d.width}
                    className="absolute bottom-2 right-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-sm font-semibold text-white backdrop-blur-sm active:scale-95"
                  >
                    <IconPen size={16} /> {d.doodle ? "Edit drawing" : "Draw"}
                  </button>
                </div>
                <input
                  value={d.caption}
                  onChange={(e) => set(d.key, { caption: e.target.value })}
                  maxLength={280}
                  placeholder="write something..."
                  aria-label="Caption"
                  enterKeyHint="done"
                  onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                  className={cx(PENS[d.pen].cls, "w-full bg-transparent px-1 py-2.5 leading-none outline-none placeholder:text-print-muted/70")}
                  style={{ fontSize: 24 * PENS[d.pen].scale, color: inkColor(d.pen, d.ink) }}
                />
              </div>
            </div>
            <div className="px-5 pb-3">
              <PenPicker
                pen={d.pen}
                ink={d.ink}
                onChange={(next) => {
                  set(d.key, next);
                  rememberPen(next.pen ?? d.pen, next.ink ?? d.ink);
                }}
              />
            </div>
          </>
        ) : null}

        {drafts.length > 1 ? (
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 pb-3 pt-2">
            {drafts.map((x, i) => (
              <div key={x.key} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setCur(i)}
                  className={cx("block h-16 w-16 overflow-hidden rounded-xl ring-2 transition", i === cur ? "ring-ink" : "ring-transparent opacity-70")}
                  aria-label={`Photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.url} alt="" className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(x.key)}
                  aria-label="Remove"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-bg shadow"
                >
                  <IconClose size={13} />
                </button>
                {x.caption || x.doodle ? <span className="absolute bottom-1 left-1 h-2 w-2 rounded-full bg-accent ring-2 ring-white" /> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2 px-5 pb-2 pt-1">
          <Button variant="soft" size="lg" onClick={onPickMore} className="shrink-0">
            <IconPlus size={18} /> More
          </Button>
          <Button variant="ink" size="lg" onClick={submit} className="flex-1" disabled={!drafts.length}>
            Add to board
          </Button>
        </div>
        {drafts.length === 1 ? null : <p className="px-6 pb-2 text-center text-xs text-muted">Tap a photo to write or draw on it. Both are optional.</p>}
      </Sheet>

      {drawing && d ? (
        <DoodleEditor
          src={d.url}
          width={d.width}
          height={d.height}
          initial={d.doodle}
          onCancel={() => setDrawing(false)}
          onSave={(doodle) => {
            set(d.key, { doodle });
            setDrawing(false);
          }}
        />
      ) : null}
    </>
  );
}
