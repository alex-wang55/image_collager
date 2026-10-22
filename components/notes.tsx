"use client";

import { useEffect, useState } from "react";
import { seeded } from "@/lib/masonry";
import { PENS, inkColor, inkOf, lastPen, penOf, rememberPen, type Ink, type Pen } from "@/lib/pens";
import { notifyBoard } from "@/lib/push-client";
import { errMsg, supabase } from "@/lib/supabase";
import type { Note, NoteColor } from "@/lib/types";
import { PenPicker } from "./pen";
import { Button, Sheet, cx, useConfirm, useToast } from "./ui";

export const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: "#fbe68b",
  pink: "#f8c5d4",
  blue: "#bfdff4",
  green: "#cdeeb6",
};

const notePen = (n: Note) => penOf({ caption_pen: n.pen });
const noteInk = (n: Note) => inkOf({ caption_ink: n.ink });

/**
 * A sticky note. "board" is a loose note pinned among the photos; "side" is
 * the small one stuck to the edge of a print; "mini" is the chip in the viewer.
 */
export function StickyNote({ note, variant, className, style }: { note: Note; variant: "board" | "side" | "mini"; className?: string; style?: React.CSSProperties }) {
  const pen = notePen(note);
  const base = variant === "board" ? 24 : variant === "side" ? 15 : 16;
  const tilt = (seeded(note.id, 7) - 0.5) * (variant === "board" ? 6 : 10);
  return (
    <div
      className={cx(
        "sticky-note overflow-hidden",
        variant === "board" ? "aspect-square p-4" : variant === "side" ? "p-2" : "w-36 shrink-0 p-2.5",
        className,
      )}
      style={{ background: NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow, transform: `rotate(${tilt}deg)`, ...style }}
    >
      <p
        className={cx(PENS[pen].cls, "whitespace-pre-wrap break-words leading-[1.12]", variant === "side" ? "line-clamp-4" : variant === "mini" ? "line-clamp-3" : "line-clamp-[8]")}
        style={{ fontSize: base * PENS[pen].scale, color: inkColor(pen, noteInk(note)) }}
      >
        {note.body}
      </p>
    </div>
  );
}

/** Write a new sticky note (on a photo, or loose on the board), or edit/remove one. */
export function NoteSheet({
  open,
  boardId,
  photoId,
  note,
  meId,
  isOwner,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  boardId: string;
  photoId: string | null;
  note: Note | null;
  meId: string;
  isOwner: boolean;
  onClose: () => void;
  onSaved: (n: Note) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [pen, setPen] = useState<Pen>("pen");
  const [ink, setInk] = useState<Ink>("ink");
  const [busy, setBusy] = useState(false);
  const mine = !note || note.user_id === meId;

  useEffect(() => {
    if (!open) return;
    if (note) {
      setBody(note.body);
      setColor(note.color);
      setPen(notePen(note));
      setInk(noteInk(note));
    } else {
      const last = lastPen();
      setBody("");
      setColor((["yellow", "pink", "blue", "green"] as NoteColor[])[Math.floor(Math.random() * 4)]);
      setPen(last.pen);
      setInk(last.ink);
    }
  }, [open, note]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const fields = { body: text, color, pen, ink };
    const res = note
      ? await supabase.from("collage_notes").update(fields).eq("id", note.id).select().single()
      : await supabase.from("collage_notes").insert({ ...fields, board_id: boardId, photo_id: photoId, user_id: meId }).select().single();
    setBusy(false);
    if (res.error) return toast(errMsg(res.error), "err");
    rememberPen(pen, ink);
    onSaved(res.data as Note);
    if (!note) notifyBoard(boardId, { kind: "note", photoId, text });
  }

  async function remove() {
    if (!note) return;
    const ok = await confirm({ title: "Take this note down?", confirm: "Remove note", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("collage_notes").delete().eq("id", note.id);
    if (error) return toast(errMsg(error), "err");
    onDeleted(note.id);
  }

  return (
    <Sheet open={open} onClose={onClose} label="Sticky note">
      <form className="px-6 pb-2 pt-4" onSubmit={save}>
        <h2 className="text-xl font-bold tracking-tight">{note ? (mine ? "Edit note" : "Note") : photoId ? "Stick a note on it" : "Pin a note to the board"}</h2>
        <div className="sticky-note mx-auto mt-4 w-full max-w-[280px] -rotate-1 p-4" style={{ background: NOTE_COLORS[color] }}>
          <textarea
            autoFocus={mine}
            readOnly={!mine}
            rows={4}
            value={body}
            maxLength={200}
            placeholder={photoId ? "a note about this one..." : "a note for the board..."}
            onChange={(e) => setBody(e.target.value)}
            className={cx(PENS[pen].cls, "w-full resize-none bg-transparent leading-[1.15] outline-none placeholder:text-black/35")}
            style={{ fontSize: 24 * PENS[pen].scale, color: inkColor(pen, ink) }}
          />
        </div>
        {mine ? (
          <>
            <div className="mt-4 flex items-center gap-2.5" role="radiogroup" aria-label="Note colour">
              {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`${c} note`}
                  onClick={() => setColor(c)}
                  className={cx("h-8 w-8 rounded-md shadow-sm transition", color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "hover:scale-110")}
                  style={{ background: NOTE_COLORS[c] }}
                />
              ))}
            </div>
            <div className="mt-3">
              <PenPicker
                pen={pen}
                ink={ink}
                onChange={(next) => {
                  if (next.pen) setPen(next.pen);
                  if (next.ink) setInk(next.ink);
                }}
              />
            </div>
          </>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          {mine ? (
            <Button type="submit" variant="ink" size="lg" loading={busy} disabled={!body.trim()}>
              {note ? "Save" : photoId ? "Stick it on" : "Pin it up"}
            </Button>
          ) : null}
          {note && (mine || isOwner) ? (
            <Button type="button" variant="ghost" size="lg" className="text-danger" onClick={remove}>
              Remove note
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            {mine ? "Cancel" : "Close"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
