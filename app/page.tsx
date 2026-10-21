"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { BoardCard, EmptyBoards, InstallHint, MemoryCard, Welcome, isMemory, useBoardCovers } from "@/components/home-parts";
import { IconPlus } from "@/components/icons";
import { Wordmark } from "@/components/logo";
import { PushNudge } from "@/components/notify";
import { Shell } from "@/components/shell";
import { Avatar, PageLoader, usePrompt, useToast } from "@/components/ui";
import { errMsg, supabase } from "@/lib/supabase";
import type { BoardSummary, Memory } from "@/lib/types";

export default function Page() {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!session) return <Welcome />;
  return <Home />;
}

function Home() {
  const { session, profile } = useAuth();
  const meId = session!.user.id;
  const router = useRouter();
  const toast = useToast();
  const prompt = usePrompt();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const urls = useBoardCovers(boards);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("collage_my_boards");
    if (error) return toast(errMsg(error), "err");
    setBoards((data as BoardSummary[]) ?? []);
  }, [toast]);

  const shuffle = useCallback(async () => {
    setShuffling(true);
    const { data } = await supabase.rpc("collage_random_memory");
    setShuffling(false);
    setMemory((data as Memory) ?? null);
  }, []);

  useEffect(() => {
    load();
    shuffle();
    // coming back to the app (or this tab) picks up anything friends added
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, shuffle]);

  async function newBoard() {
    const name = await prompt({ title: "Name your board", placeholder: "Summer 2026", confirm: "Create board", maxLength: 60 });
    if (!name?.trim()) return;
    const { data, error } = await supabase.rpc("collage_create_board", { p_name: name.trim() });
    if (error) return toast(errMsg(error), "err");
    router.push(`/b/${data}`);
  }

  // only worth asking about notifications once someone else is on a board with you
  const friend = boards?.flatMap((b) => b.members).find((m) => m.id !== meId)?.display_name.split(/\s+/)[0];

  return (
    <Shell
      wide
      header={
        <>
          <Link href="/" aria-label="Shoebox home" className="px-1.5">
            <Wordmark />
          </Link>
          <span className="flex-1" />
          <Link href="/me" aria-label="Your profile" className="rounded-full p-1">
            <Avatar person={profile} size={34} />
          </Link>
        </>
      }
    >
      <InstallHint />
      {friend ? <PushNudge friend={friend} /> : null}
      {boards === null ? (
        <PageLoader />
      ) : boards.length === 0 ? (
        <EmptyBoards onNew={newBoard} />
      ) : (
        <>
          {memory && isMemory(memory) ? <MemoryCard memory={memory} onShuffle={shuffle} shuffling={shuffling} /> : null}
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">Boards</h2>
            <button
              type="button"
              onClick={newBoard}
              className="-mr-2 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold transition hover:bg-surface-2"
            >
              <IconPlus size={18} /> New board
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {boards.map((b) => (
              <BoardCard key={b.id} b={b} meId={meId} urls={urls} />
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
