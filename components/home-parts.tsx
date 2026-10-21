"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ago, shortDate } from "@/lib/dates";
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from "@/lib/pwa";
import type { BoardSummary, Memory } from "@/lib/types";
import { IconClose, IconShare, IconShuffle } from "./icons";
import { PhotoImg, useSigned } from "./photo-img";
import { Button, cx, namesLabel } from "./ui";

/** A board in your list: its last few photos fanned out like prints on a table. */
export function BoardCard({ b, meId, urls }: { b: BoardSummary; meId: string; urls: Record<string, string> }) {
  const covers = b.covers.slice(0, 3);
  const fan = [
    [{ r: -3, x: 0, y: 0 }],
    [
      { r: -7, x: -9, y: 2 },
      { r: 4, x: 8, y: -2 },
    ],
    [
      { r: -9, x: -14, y: 4 },
      { r: 7, x: 13, y: 2 },
      { r: -1.5, x: 0, y: -3 },
    ],
  ][Math.max(0, covers.length - 1)];
  // draw the newest on top
  const order = covers.map((c, i) => ({ c, pos: fan[covers.length - 1 - i] })).reverse();

  return (
    <Link href={`/b/${b.id}`} className="group block rounded-3xl p-1 transition active:scale-[0.98]">
      <div className="relative flex aspect-square items-center justify-center">
        {covers.length === 0 ? (
          <div className="flex aspect-[4/5] w-[62%] -rotate-2 items-center justify-center border-2 border-dashed border-line bg-surface/40">
            <span className="font-hand text-xl text-muted">empty</span>
          </div>
        ) : (
          order.map(({ c, pos }) => (
            <div
              key={c.id}
              className="absolute w-[64%] bg-print p-[5px] pb-[14px] shadow-print transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ transform: `translate(${pos.x}%, ${pos.y}%) rotate(${pos.r}deg)` }}
            >
              <PhotoImg src={urls[c.thumb_path]} color={c.color} className="aspect-[4/5]" />
            </div>
          ))
        )}
        {b.new_count > 0 ? (
          <span className="absolute right-1 top-1 z-10 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink shadow-card">{b.new_count} new</span>
        ) : null}
      </div>
      <div className="mt-2 px-1">
        <div className="truncate text-[15px] font-semibold leading-tight">{b.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <span className="truncate">
            {b.photo_count} photo{b.photo_count === 1 ? "" : "s"} · {namesLabel(b.members, meId)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function useBoardCovers(boards: BoardSummary[] | null) {
  const paths = useMemo(() => (boards ?? []).flatMap((b) => b.covers.map((c) => c.thumb_path)), [boards]);
  return useSigned(paths);
}

/** Worth resurfacing: this day in an earlier year, or at least a few days old. */
export function isMemory(m: Memory): boolean {
  return m.on_this_day || Date.parse(m.taken_at ?? m.created_at) < Date.now() - 3 * 86_400_000;
}

/** One old photo from any of your boards, to stumble back into. */
export function MemoryCard({ memory, onShuffle, shuffling }: { memory: Memory; onShuffle: () => void; shuffling: boolean }) {
  const urls = useSigned(useMemo(() => [memory.thumb_path], [memory.thumb_path]));
  const when = memory.taken_at ?? memory.created_at;
  const label = memory.on_this_day ? `On this day, ${new Date(when).getFullYear()}` : `From ${ago(when)}`;
  return (
    <section className="animate-rise mb-8 max-w-2xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{label}</h2>
        <button
          type="button"
          onClick={onShuffle}
          disabled={shuffling}
          className="-mr-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <IconShuffle size={18} className={cx(shuffling && "animate-pulse")} /> Another
        </button>
      </div>
      <Link href={`/b/${memory.board_id}?p=${memory.id}`} className="flex items-center gap-5 rounded-3xl bg-surface/70 p-4 shadow-card ring-1 ring-line/60 transition active:scale-[0.99]">
        <div className="w-[44%] max-w-[200px] shrink-0 -rotate-2 bg-print p-[6px] pb-[18px] shadow-print">
          <PhotoImg key={memory.id} src={urls[memory.thumb_path]} color={memory.color} className="aspect-[4/5]" />
        </div>
        <div className="min-w-0">
          {memory.caption ? <p className="font-hand text-[26px] leading-[1.05]">{memory.caption}</p> : null}
          <p className={cx("text-sm text-muted", memory.caption && "mt-2")}>{shortDate(when)}</p>
          <p className="mt-0.5 truncate text-sm font-semibold">{memory.board_name}</p>
        </div>
      </Link>
    </section>
  );
}

const HINT_KEY = "shoebox-install-hint";

/** "Put it on your home screen", only in a browser tab (not once installed). */
export function InstallHint() {
  const [mode, setMode] = useState<"ios" | "prompt" | null>(null);
  useEffect(() => {
    const decide = () => {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(HINT_KEY) === "1";
      } catch {}
      if (dismissed || isStandalone()) return setMode(null);
      if (canPromptInstall()) return setMode("prompt");
      setMode(isIos() ? "ios" : null);
    };
    decide();
    return onInstallChange(decide);
  }, []);
  if (!mode) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
    setMode(null);
  };
  return (
    <div className="animate-rise relative mb-6 rounded-3xl bg-ink p-4 pr-12 text-bg shadow-card">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full opacity-70 hover:opacity-100">
        <IconClose size={18} />
      </button>
      <p className="font-semibold">Keep it on your home screen</p>
      {mode === "ios" ? (
        <p className="mt-1 text-sm opacity-80">
          Tap <IconShare size={16} className="-mt-1 inline" /> Share in Safari, then <b>Add to Home Screen</b>. It opens full screen like a real app.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm opacity-80">Opens full screen, one tap from your camera.</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => promptInstall().then(() => setMode(null))}>
            Install Shoebox
          </Button>
        </>
      )}
    </div>
  );
}

/** Logged-out front door. */
export function Welcome() {
  const prints = [
    { cap: "the lake", r: -8, x: "-38%", y: "6%", bg: "linear-gradient(180deg,#9cc3d9 0%,#cfe0e6 46%,#5f8a77 47%,#3f6b5c 100%)" },
    { cap: "sunday", r: 6, x: "36%", y: "0%", bg: "linear-gradient(160deg,#f4c27a 0%,#e88a5a 55%,#7a4a5a 100%)" },
    { cap: "us :)", r: -1, x: "0%", y: "-6%", bg: "radial-gradient(circle at 50% 38%,#f1d9c4 0 18%,transparent 19%),linear-gradient(180deg,#c9b8a6,#8c7a6b)" },
  ];
  return (
    <div className="paper flex min-h-dvh flex-col">
      <div className="pt-safe mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10">
        <div className="relative mx-auto mt-14 h-64 w-full max-w-[320px]">
          {prints.map((p, i) => (
            <div key={p.cap} className="absolute left-1/2 top-1/2 w-[46%]" style={{ transform: `translate(calc(-50% + ${p.x}), calc(-50% + ${p.y}))` }}>
              <div
                className="animate-drop bg-print p-[6px] pb-0 shadow-print"
                style={{ transform: "rotate(var(--tilt))", animationDelay: `${i * 90}ms`, ["--tilt" as string]: `${p.r}deg` }}
              >
                <div className="aspect-[4/5]" style={{ background: p.bg }} />
                <div className="font-hand py-1.5 pl-1 text-xl text-print-ink">{p.cap}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-10">
          <h1 className="font-hand text-[56px] font-bold leading-none">shoebox</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted">
            A shared place for your photos with the people in them. Make a board, snap a picture, and look back on it all later.
          </p>
          <div className="mt-8 flex flex-col gap-2.5">
            <Button href="/signup" variant="ink" size="lg">
              Make an account
            </Button>
            <Button href="/login" variant="ghost" size="lg">
              I have one
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyBoards({ onNew }: { onNew: () => void }) {
  return (
    <div className="animate-rise mt-6 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mx-auto flex w-28 -rotate-3 flex-col bg-print p-1.5 pb-0 shadow-print">
        <div className="aspect-[4/5] bg-surface-2" />
        <div className="font-hand py-1 text-lg text-print-muted">your first</div>
      </div>
      <h2 className="mt-6 text-xl font-bold tracking-tight">Start your first board</h2>
      <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-muted">
        A board is a collage you share. Make one for a trip, a year, or just the two of you.
      </p>
      <Button variant="ink" size="lg" className="mt-6" onClick={onNew}>
        New board
      </Button>
      <p className="mt-4 text-xs text-muted">Got an invite link? Just open it on this phone.</p>
    </div>
  );
}

