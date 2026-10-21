"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canvasSize, renderCollage, type Format, type Pic, type Style } from "@/lib/collage-render";
import { signUrls } from "@/lib/photos";
import type { Photo } from "@/lib/types";
import { IconBack, IconCheck, IconClose, IconDownload, IconShuffle } from "./icons";
import { PhotoImg, useSigned } from "./photo-img";
import { Button, Sheet, Spinner, cx, useToast } from "./ui";

const MAX = 9;
const STYLES: { id: Style; label: string }[] = [
  { id: "scrapbook", label: "Scrapbook" },
  { id: "grid", label: "Grid" },
  { id: "strip", label: "Photo strip" },
];

/** Pick a few photos from the board and turn them into one image to save or post. */
export function CollageMaker({ open, onClose, photos, title, subtitle }: { open: boolean; onClose: () => void; photos: Photo[]; title: string; subtitle: string }) {
  const toast = useToast();
  const [step, setStep] = useState<"pick" | "make">("pick");
  const [picked, setPicked] = useState<string[]>([]);
  const [style, setStyle] = useState<Style>("scrapbook");
  const [format, setFormat] = useState<Format>("post");
  const [seed, setSeed] = useState(1);
  const [out, setOut] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const bitmaps = useRef(new Map<string, Pic>());
  const fontRef = useRef<HTMLSpanElement>(null);

  // start with the latest few picked so "make" works in one tap
  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setPicked(photos.slice(0, 6).map((p) => p.id));
    setSeed(Math.floor(Math.random() * 1e9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const thumbs = useSigned(useMemo(() => (open ? photos.slice(0, 200).map((p) => p.thumb_path) : []), [open, photos]));

  function toggle(id: string) {
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= MAX ? list : [...list, id]));
  }

  // (re)draw whenever the choices change
  useEffect(() => {
    if (!open || step !== "make" || !picked.length) return;
    let alive = true;
    setBusy(true);
    (async () => {
      const chosen = picked.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as Photo[];
      const need = chosen.filter((p) => !bitmaps.current.has(p.id));
      if (need.length) {
        const urls = await signUrls(need.map((p) => p.path));
        await Promise.all(
          need.map(async (p) => {
            const res = await fetch(urls[p.path], { mode: "cors" });
            const img = await createImageBitmap(await res.blob());
            bitmaps.current.set(p.id, { img, width: img.width, height: img.height, caption: p.caption });
          }),
        );
      }
      const hand = fontRef.current ? getComputedStyle(fontRef.current).fontFamily : "cursive";
      await document.fonts.load(`700 40px ${hand}`).catch(() => {});
      const sans = getComputedStyle(document.body).fontFamily;
      const blob = await renderCollage({
        pics: chosen.map((p) => bitmaps.current.get(p.id)!),
        style,
        format,
        title,
        subtitle,
        seed,
        hand,
        sans,
      });
      if (!alive) return;
      setOut((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    })()
      .catch(() => alive && toast("Couldn't make the collage. Check your connection.", "err"))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [open, step, picked, style, format, seed, photos, title, subtitle, toast]);

  // let go of the decoded photos when closed
  useEffect(() => {
    if (open) return;
    bitmaps.current.forEach((b) => (b.img as ImageBitmap).close?.());
    bitmaps.current.clear();
    setOut((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, [open]);

  async function save() {
    if (!out) return;
    const name = `${title.replace(/[^\w\- ]+/g, "").trim() || "shoebox"}-collage.jpg`;
    const file = new File([out.blob], name, { type: "image/jpeg" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
      } catch {
        // closed the share sheet
      }
      return;
    }
    const a = document.createElement("a");
    a.href = out.url;
    a.download = name;
    a.click();
  }

  const size = canvasSize(style, format, picked.length);

  return (
    <Sheet open={open} onClose={onClose} label="Make a collage" className="sm:max-w-xl">
      {/* hidden probe so we can hand the canvas the same handwriting font the app uses */}
      <span ref={fontRef} className="font-hand pointer-events-none absolute opacity-0" aria-hidden="true">
        a
      </span>
      <div className="flex items-center gap-1 px-3 pb-1 pt-3">
        {step === "make" ? (
          <button type="button" onClick={() => setStep("pick")} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
            <IconBack />
          </button>
        ) : null}
        <div className={cx("min-w-0 flex-1", step === "pick" && "pl-3")}>
          <h2 className="text-lg font-bold tracking-tight">{step === "pick" ? "Pick photos" : "Make a collage"}</h2>
          <p className="text-sm text-muted">{step === "pick" ? `Up to ${MAX}. ${picked.length} picked.` : "Save it, post it, send it."}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
          <IconClose />
        </button>
      </div>

      {step === "pick" ? (
        <>
          <div className="grid max-h-[56dvh] grid-cols-4 gap-1 overflow-y-auto px-4 pb-3 pt-2">
            {photos.slice(0, 200).map((p) => {
              const n = picked.indexOf(p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)} className="relative aspect-square overflow-hidden rounded-lg" aria-pressed={n >= 0}>
                  <PhotoImg src={thumbs[p.thumb_path]} color={p.color} className={cx("absolute inset-0 transition", n >= 0 && "scale-90 rounded-md")} />
                  {n >= 0 ? (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink ring-2 ring-white">
                      {n + 1}
                    </span>
                  ) : (
                    <span className="absolute right-1 top-1 h-6 w-6 rounded-full ring-2 ring-white/80" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-5 pb-2 pt-1">
            <Button variant="ink" size="lg" className="w-full" disabled={!picked.length} onClick={() => setStep("make")}>
              Next
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-center px-5 pt-2">
            <div className="relative flex w-full items-center justify-center rounded-2xl bg-surface-2/60 p-3" style={{ height: "min(52dvh, 460px)" }}>
              {out ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={out.url} alt="Collage preview" className={cx("max-h-full max-w-full shadow-card transition-opacity", busy && "opacity-60")} style={{ aspectRatio: `${size.w} / ${size.h}` }} />
              ) : null}
              {busy ? (
                <span className="absolute inset-0 flex items-center justify-center text-muted">
                  <Spinner />
                </span>
              ) : null}
            </div>
          </div>

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
            {STYLES.map((s) => (
              <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 px-5">
            {style !== "strip" ? (
              <>
                <Chip active={format === "post"} onClick={() => setFormat("post")} small>
                  Post 4:5
                </Chip>
                <Chip active={format === "story"} onClick={() => setFormat("story")} small>
                  Story 9:16
                </Chip>
              </>
            ) : (
              <span className="text-xs text-muted">Uses your first 4 picks</span>
            )}
            <span className="flex-1" />
            {style === "scrapbook" ? (
              <button type="button" onClick={() => setSeed((s) => s + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                <IconShuffle size={17} /> Shuffle
              </button>
            ) : null}
          </div>
          <div className="px-5 pb-2 pt-4">
            <Button variant="ink" size="lg" className="w-full" disabled={!out || busy} onClick={save}>
              <IconDownload size={20} /> Save image
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition",
        small ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        active ? "bg-ink text-bg" : "bg-surface-2 text-muted hover:text-ink",
      )}
    >
      {active && !small ? <IconCheck size={16} /> : null}
      {children}
    </button>
  );
}
