"use client";

import { useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/dates";
import { notifyBoard } from "@/lib/push-client";
import { errMsg, supabase } from "@/lib/supabase";
import type { Comment, Person, Photo } from "@/lib/types";
import { IconClose, IconSend } from "./icons";
import { Avatar, Sheet, Spinner, cx, useToast } from "./ui";

/** The conversation under one photo. Live, so a reply shows up while you're looking. */
export function CommentsSheet({
  photo,
  onClose,
  people,
  meId,
  isOwner,
}: {
  photo: Photo | null;
  onClose: () => void;
  people: Record<string, Person>;
  meId: string;
  isOwner: boolean;
}) {
  const toast = useToast();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const photoId = photo?.id;

  useEffect(() => {
    if (!photoId) return;
    setList(null);
    setText("");
    let alive = true;
    supabase
      .from("collage_comments")
      .select("*")
      .eq("photo_id", photoId)
      .order("created_at")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast(errMsg(error), "err");
        setList((data as Comment[]) ?? []);
      });
    const ch = supabase
      .channel(`comments-${photoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "collage_comments", filter: `photo_id=eq.${photoId}` }, ({ new: row }) => {
        const c = row as Comment;
        setList((l) => (l && !l.some((x) => x.id === c.id) ? [...l, c] : l));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "collage_comments" }, ({ old }) => {
        const gone = (old as { id?: string }).id;
        setList((l) => (l && gone ? l.filter((x) => x.id !== gone) : l));
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [photoId, toast]);

  // keep the newest in view
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [list?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !photo) return;
    setSending(true);
    const { data, error } = await supabase
      .from("collage_comments")
      .insert({ photo_id: photo.id, board_id: photo.board_id, user_id: meId, body })
      .select()
      .single();
    setSending(false);
    if (error) return toast(errMsg(error), "err");
    setText("");
    setList((l) => (l && !l.some((x) => x.id === data.id) ? [...l, data as Comment] : l));
    notifyBoard(photo.board_id, { kind: "comment", photoId: photo.id, text: body });
  }

  async function remove(c: Comment) {
    const { error } = await supabase.from("collage_comments").delete().eq("id", c.id);
    if (error) return toast(errMsg(error), "err");
    setList((l) => l?.filter((x) => x.id !== c.id) ?? l);
  }

  const count = list?.length ?? photo?.comment_count ?? 0;

  return (
    <Sheet open={!!photo} onClose={onClose} label="Comments" className="flex flex-col sm:max-w-lg">
      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <h2 className="text-lg font-bold tracking-tight">
          {count ? `${count} comment${count === 1 ? "" : "s"}` : "Comments"}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
          <IconClose />
        </button>
      </div>

      <div className="max-h-[52dvh] min-h-[22dvh] overflow-y-auto px-5">
        {list === null ? (
          <div className="flex justify-center py-10 text-muted">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="font-hand py-10 text-center text-2xl text-muted">say something about it</p>
        ) : (
          <ul className="space-y-4 py-2">
            {list.map((c) => {
              const who = c.user_id ? people[c.user_id] : undefined;
              const mine = c.user_id === meId;
              return (
                <li key={c.id} className="group flex gap-3">
                  <Avatar person={who} size={32} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{mine ? "You" : (who?.display_name.split(/\s+/)[0] ?? "Someone")}</span>
                      <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
                      {mine || isOwner ? (
                        <button
                          type="button"
                          onClick={() => remove(c)}
                          className="ml-auto text-xs font-semibold text-muted opacity-70 hover:text-danger hover:opacity-100"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug">{c.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line/70 px-4 pb-1 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // enter sends on a keyboard; shift+enter for a new line
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Add a comment..."
          aria-label="Add a comment"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-bg px-4 py-2.5 text-ink outline-none placeholder:text-muted/70 focus:border-ink/40"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition active:scale-95 disabled:opacity-40")}
        >
          {sending ? <Spinner small /> : <IconSend size={20} />}
        </button>
      </form>
    </Sheet>
  );
}
