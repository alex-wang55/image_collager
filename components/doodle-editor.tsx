"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DOODLE_COLORS, strokePath, type Doodle, type Stroke } from "@/lib/pens";
import { Spinner, cx } from "./ui";

const SIZES = [
  { w: 0.008, label: "Thin" },
  { w: 0.02, label: "Thick" },
];

const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;

/** Full screen: draw on a photo with your finger. Strokes are stored relative to the photo, so they scale anywhere. */
export function DoodleEditor({
  src,
  width,
  height,
  initial,
  onCancel,
  onSave,
}: {
  src: string;
  width: number;
  height: number;
  initial: Doodle | null;
  onCancel: () => void;
  onSave: (d: Doodle | null) => Promise<void> | void;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes ?? []);
  const [live, setLive] = useState<Stroke | null>(null);
  const [color, setColor] = useState(DOODLE_COLORS[2]);
  const [size, setSize] = useState(SIZES[0].w);
  const [saving, setSaving] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const area = useRef<HTMLDivElement>(null);
  const drawing = useRef<Stroke | null>(null);

  // fit the photo in the space between the bars, keeping its shape
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const aw = e.contentRect.width;
      const ah = e.contentRect.height;
      const bw = Math.min(aw, (ah * width) / height);
      setBox({ w: bw, h: (bw * height) / width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const at = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [round((e.clientX - r.left) / r.width), round((e.clientY - r.top) / r.height)];
  };

  function down(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { c: color, w: size, p: at(e) };
    setLive(drawing.current);
  }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    const s = drawing.current;
    if (!s) return;
    const [x, y] = at(e);
    const lx = s.p[s.p.length - 2];
    const ly = s.p[s.p.length - 1];
    if (Math.abs(x - lx) + Math.abs(y - ly) < 0.004) return;
    s.p = [...s.p, x, y];
    setLive({ ...s });
  }
  function up() {
    const s = drawing.current;
    drawing.current = null;
    setLive(null);
    if (s) setStrokes((list) => [...list, s]);
  }

  async function done() {
    setSaving(true);
    try {
      await onSave(strokes.length ? { v: 1, strokes } : null);
    } finally {
      setSaving(false);
    }
  }

  const W = 1000;
  const H = (W * height) / width;
  const shown = live ? [...strokes, live] : strokes;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex select-none flex-col bg-[#0c0b09] text-white" role="dialog" aria-modal="true" aria-label="Draw on it">
      <div className="pt-safe">
        <div className="flex h-14 items-center justify-between px-3">
          <button type="button" onClick={onCancel} className="h-10 rounded-full px-3 text-[15px] font-semibold text-white/80 active:bg-white/10">
            Cancel
          </button>
          <span className="font-semibold">Draw on it</span>
          <button
            type="button"
            onClick={done}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-bold text-black active:scale-95 disabled:opacity-60"
          >
            {saving ? <Spinner small /> : null}
            Done
          </button>
        </div>
      </div>

      <div ref={area} className="flex min-h-0 flex-1 items-center justify-center p-4">
        {box.w ? (
          <div className="relative" style={{ width: box.w, height: box.h }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" crossOrigin="anonymous" draggable={false} className="absolute inset-0 h-full w-full" />
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 h-full w-full cursor-crosshair"
              style={{ touchAction: "none" }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              {shown.map((s, i) => (
                <path key={i} d={strokePath(s, W, H)} fill="none" stroke={s.c} strokeWidth={s.w * W} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
        ) : null}
      </div>

      <div className="pb-safe px-4">
        <div className="mx-auto flex max-w-md flex-col gap-3 pb-1">
          <div className="flex items-center justify-between gap-2">
            {DOODLE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className={cx("h-9 w-9 rounded-full ring-1 ring-white/25 transition", color === c ? "scale-110 ring-[3px] ring-white" : "active:scale-95")}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-white/10 p-1">
              {SIZES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSize(s.w)}
                  aria-pressed={size === s.w}
                  className={cx("flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition", size === s.w ? "bg-white text-black" : "text-white/75")}
                >
                  <span className="rounded-full bg-current" style={{ width: s.w * 500, height: s.w * 500 }} />
                  {s.label}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setStrokes((l) => l.slice(0, -1))}
              disabled={!strokes.length}
              className="h-11 rounded-full px-4 text-sm font-semibold text-white/85 active:bg-white/10 disabled:opacity-30"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              disabled={!strokes.length}
              className="h-11 rounded-full px-4 text-sm font-semibold text-white/85 active:bg-white/10 disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
