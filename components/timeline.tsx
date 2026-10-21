"use client";

import { useMemo } from "react";
import { monthKey, monthLabel } from "@/lib/dates";
import type { Photo } from "@/lib/types";
import { PhotoImg, useSigned } from "./photo-img";

/** Every photo by when it was taken, month by month, in a tight grid like a camera roll. */
export function Timeline({ photos, onOpen }: { photos: Photo[]; onOpen: (id: string) => void }) {
  const urls = useSigned(useMemo(() => photos.map((p) => p.thumb_path), [photos]));
  const groups = useMemo(() => {
    const out: { key: string; label: string; photos: Photo[] }[] = [];
    for (const p of photos) {
      const k = monthKey(p.shot_at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.photos.push(p);
      else out.push({ key: k, label: monthLabel(p.shot_at), photos: [p] });
    }
    return out;
  }, [photos]);

  return (
    <div className="-mx-4 sm:mx-0">
      {groups.map((g) => (
        <section key={g.key} className="mb-5">
          <h3 className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 bg-bg/90 px-4 py-2 text-[15px] font-bold backdrop-blur-sm sm:px-0">
            {g.label}
            <span className="ml-2 text-sm font-medium text-muted">{g.photos.length}</span>
          </h3>
          <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 sm:gap-1 lg:grid-cols-6">
            {g.photos.map((p) => (
              <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="relative aspect-square overflow-hidden active:opacity-80">
                <PhotoImg src={urls[p.thumb_path]} color={p.color} className="absolute inset-0" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
