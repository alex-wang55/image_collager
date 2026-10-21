"use client";

import { useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import type { Board, Member } from "@/lib/types";
import { IconCheck, IconLink, IconShare } from "./icons";
import { Avatar, Button, Sheet, SheetTitle, useConfirm, useToast } from "./ui";

/** Who's on the board, and the link that gets someone else on it. */
export function InviteSheet({
  open,
  onClose,
  board,
  members,
  meId,
  isOwner,
  onCodeChange,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  board: Board;
  members: Member[];
  meId: string;
  isOwner: boolean;
  onCodeChange: (code: string) => void;
  onRemoved: (userId: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/join/${board.invite_code}` : "";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  async function share() {
    try {
      await navigator.share({ title: `${board.name} on Shoebox`, text: `Come add photos to "${board.name}" with me`, url: link });
    } catch {
      // closed the share sheet
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy. Press and hold the link instead.", "err");
    }
  }

  async function reset() {
    const ok = await confirm({
      title: "Make a new link?",
      body: "The old link stops working. People already on the board stay on it.",
      confirm: "New link",
    });
    if (!ok) return;
    const { data, error } = await supabase.rpc("collage_reset_invite", { p_board: board.id });
    if (error) return toast(errMsg(error), "err");
    onCodeChange(data as string);
    toast("New link ready");
  }

  async function remove(m: Member) {
    const name = m.profile?.display_name ?? "them";
    const ok = await confirm({ title: `Remove ${name}?`, body: "Their photos stay on the board.", confirm: "Remove", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("collage_members").delete().eq("board_id", board.id).eq("user_id", m.user_id);
    if (error) return toast(errMsg(error), "err");
    onRemoved(m.user_id);
  }

  return (
    <Sheet open={open} onClose={onClose} label="Invite">
      <SheetTitle sub="Anyone with this link can join and add photos.">Invite to {board.name}</SheetTitle>
      <div className="px-6 pt-3">
        <button
          type="button"
          onClick={copy}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-bg px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <IconLink size={20} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate font-mono text-sm">{link.replace(/^https?:\/\//, "")}</span>
          <span className="shrink-0 text-sm font-semibold">{copied ? <IconCheck size={18} /> : "Copy"}</span>
        </button>
        {canShare ? (
          <Button variant="ink" size="lg" className="mt-3 w-full" onClick={share}>
            <IconShare size={20} /> Send the link
          </Button>
        ) : null}
      </div>

      <h3 className="mt-7 px-6 text-[13px] font-bold uppercase tracking-wider text-muted">On this board</h3>
      <ul className="px-3 pb-2 pt-1">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
            <Avatar person={m.profile} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {m.profile?.display_name ?? "Someone"}
                {m.user_id === meId ? <span className="font-normal text-muted"> (you)</span> : null}
              </span>
              {m.role === "owner" ? <span className="block text-xs text-muted">Started the board</span> : null}
            </span>
            {isOwner && m.user_id !== meId ? (
              <Button variant="ghost" size="sm" className="text-muted" onClick={() => remove(m)}>
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <div className="px-6 pb-2">
          <button type="button" onClick={reset} className="text-sm font-semibold text-muted underline decoration-line underline-offset-4 hover:text-ink">
            Stop the old link and make a new one
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
