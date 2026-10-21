"use client";

import { useEffect, useState } from "react";
import { INKS, PENS, inkColor, rememberPen, strokePath, type Doodle, type Ink, type Pen } from "@/lib/pens";
import { Button, Sheet, cx } from "./ui";

/** Caption text in its pen and ink. `size` is the pen's base size in px; `light` writes in white for dark backgrounds. */
export function Caption({ text, pen, ink, size, light, className }: { text: string; pen: Pen; ink: Ink; size: number; light?: boolean; className?: string }) {
  const p = PENS[pen];
  return (
    <span className={cx(p.cls, className)} style={{ fontSize: size * p.scale, color: light ? "#fff" : inkColor(pen, ink) }}>
      {text}
    </span>
  );
}

/** Pick the pen (font) and ink a caption is written in. */
export function PenPicker({ pen, ink, onChange }: { pen: Pen; ink: Ink; onChange: (next: { pen?: Pen; ink?: Ink }) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Pen">
        {(Object.keys(PENS) as Pen[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={pen === k}
            aria-label={PENS[k].label}
            title={PENS[k].label}
            onClick={() => onChange({ pen: k })}
            className={cx(
              "flex h-11 min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl px-2 transition",
              pen === k ? "bg-ink text-bg" : "bg-surface-2 text-ink hover:brightness-95",
            )}
          >
            <span className={cx(PENS[k].cls, "leading-none")} style={{ fontSize: 22 * PENS[k].scale }}>
              Aa
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-70">{PENS[k].label}</span>
          </button>
        ))}
      </div>
      <div className={cx("flex shrink-0 gap-1.5 transition-opacity", pen === "pencil" && "pointer-events-none opacity-30")} role="radiogroup" aria-label="Ink">
        {(Object.keys(INKS) as Ink[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={ink === k}
            aria-label={`${INKS[k].label} ink`}
            onClick={() => onChange({ ink: k })}
            className={cx("h-7 w-7 rounded-full transition", ink === k ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "hover:scale-110")}
            style={{ background: INKS[k].color }}
          />
        ))}
      </div>
    </div>
  );
}

/** A drawing laid over a photo. The box it sits in must have the photo's aspect ratio. */
export function DoodleLayer({ doodle, width, height, className }: { doodle: Doodle | null | undefined; width: number; height: number; className?: string }) {
  if (!doodle?.strokes?.length) return null;
  const W = 1000;
  const H = (W * height) / width;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cx("pointer-events-none absolute inset-0 h-full w-full", className)} aria-hidden="true">
      {doodle.strokes.map((s, i) => (
        <path key={i} d={strokePath(s, W, H)} fill="none" stroke={s.c} strokeWidth={s.w * W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Edit a caption and the pen it's written in. */
export function CaptionSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: { text: string; pen: Pen; ink: Ink };
  onClose: () => void;
  onSave: (text: string, pen: Pen, ink: Ink) => Promise<void> | void;
}) {
  const [text, setText] = useState(initial.text);
  const [pen, setPen] = useState(initial.pen);
  const [ink, setInk] = useState(initial.ink);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setText(initial.text);
    setPen(initial.pen);
    setInk(initial.ink);
    // reset only when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} label="Caption">
      <form
        className="px-6 pb-2 pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(text, pen, ink);
            rememberPen(pen, ink);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-xl font-bold tracking-tight">{initial.text ? "Edit caption" : "Add a caption"}</h2>
        <div className="mt-4 rounded-2xl bg-print px-4 py-3 shadow-print">
          <textarea
            autoFocus
            rows={2}
            value={text}
            maxLength={280}
            placeholder="write something..."
            onChange={(e) => setText(e.target.value)}
            className={cx(PENS[pen].cls, "w-full resize-none bg-transparent leading-tight outline-none placeholder:text-print-muted/70")}
            style={{ fontSize: 26 * PENS[pen].scale, color: inkColor(pen, ink) }}
          />
        </div>
        <div className="mt-4">
          <PenPicker
            pen={pen}
            ink={ink}
            onChange={(next) => {
              if (next.pen) setPen(next.pen);
              if (next.ink) setInk(next.ink);
            }}
          />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button type="submit" variant="ink" size="lg" loading={busy}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
