"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { processPhoto } from "@/lib/image";
import { rememberLocal } from "@/lib/photos";
import { notifyBoard } from "@/lib/push-client";
import { BUCKET, errMsg, supabase } from "@/lib/supabase";
import type { Photo } from "@/lib/types";
import { useAuth } from "./auth";

export type Pending = {
  id: string; // becomes the photo id
  boardId: string;
  file: File;
  caption: string;
  preview: string; // object URL of the original, shown while it uploads
  width: number;
  height: number;
  status: "waiting" | "working" | "failed";
  error?: string;
};

export type NewPhoto = { file: File; caption: string; width: number; height: number };

type Ctx = {
  pending: Pending[];
  add: (boardId: string, items: NewPhoto[]) => void;
  retry: (id: string) => void;
  discard: (id: string) => void;
  /** Fires with each photo as soon as it's saved. */
  onUploaded: (cb: (p: Photo) => void) => () => void;
};

const UploadCtx = createContext<Ctx>({ pending: [], add: () => {}, retry: () => {}, discard: () => {}, onUploaded: () => () => {} });
export const useUploads = () => useContext(UploadCtx);

const WORKERS = 2;

/**
 * Uploads run here, above the pages, so you can add photos and keep browsing
 * (or go to another board) while they shrink and upload in the background.
 */
export function UploadProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [pending, setPending] = useState<Pending[]>([]);
  const queue = useRef<Pending[]>([]);
  const running = useRef(0);
  const listeners = useRef(new Set<(p: Photo) => void>());
  const landed = useRef<Record<string, number>>({});
  const uid = session?.user.id;

  const sync = () => setPending([...queue.current]);
  const patch = (id: string, p: Partial<Pending>) => {
    queue.current = queue.current.map((x) => (x.id === id ? { ...x, ...p } : x));
    sync();
  };

  const upload = useCallback(
    async (item: Pending) => {
      if (!uid) throw new Error("Log in again to upload");
      const out = await processPhoto(item.file);
      const path = `${item.boardId}/${item.id}.${out.ext}`;
      const thumbPath = `${item.boardId}/${item.id}_t.${out.ext}`;
      const contentType = out.ext === "webp" ? "image/webp" : "image/jpeg";
      const store = supabase.storage.from(BUCKET);
      const opts = { contentType, cacheControl: "31536000", upsert: false };
      const [a, b] = await Promise.all([store.upload(path, out.full, opts), store.upload(thumbPath, out.thumb, opts)]);
      const upErr = a.error ?? b.error;
      // a retry after a dropped connection can find the file already there; that's fine
      if (upErr && !/exists|Duplicate/i.test(upErr.message)) {
        await store.remove([path, thumbPath]).catch(() => {});
        throw upErr;
      }
      const { data, error } = await supabase
        .from("collage_photos")
        .insert({
          id: item.id,
          board_id: item.boardId,
          user_id: uid,
          path,
          thumb_path: thumbPath,
          width: out.width,
          height: out.height,
          bytes: out.full.size + out.thumb.size,
          color: out.color,
          caption: item.caption.trim() || null,
          taken_at: out.takenAt,
        })
        .select()
        .single();
      if (error) {
        if (!error.message.includes("duplicate key")) {
          await store.remove([path, thumbPath]).catch(() => {});
          throw error;
        }
        const { data: existing } = await supabase.from("collage_photos").select("*").eq("id", item.id).single();
        return existing as Photo;
      }
      rememberLocal(thumbPath, out.thumb);
      return data as Photo;
    },
    [uid],
  );

  const pump = useCallback(() => {
    while (running.current < WORKERS) {
      const next = queue.current.find((x) => x.status === "waiting");
      if (!next) return;
      running.current++;
      patch(next.id, { status: "working", error: undefined });
      upload(next)
        .then((photo) => {
          queue.current = queue.current.filter((x) => x.id !== next.id);
          sync();
          URL.revokeObjectURL(next.preview);
          listeners.current.forEach((l) => l(photo));
          // one ping per batch, once this board's queue is empty
          const b = next.boardId;
          landed.current[b] = (landed.current[b] ?? 0) + 1;
          if (!queue.current.some((x) => x.boardId === b && x.status !== "failed")) {
            notifyBoard(b, landed.current[b]);
            delete landed.current[b];
          }
        })
        .catch((e) => patch(next.id, { status: "failed", error: errMsg(e) }))
        .finally(() => {
          running.current--;
          pump();
        });
    }
  }, [upload]);

  const add = useCallback(
    (boardId: string, items: NewPhoto[]) => {
      // upload in the order they were picked; the board shows the latest on top
      const fresh: Pending[] = items.map((it) => ({
        id: crypto.randomUUID(),
        boardId,
        file: it.file,
        caption: it.caption,
        preview: URL.createObjectURL(it.file),
        width: it.width || 4,
        height: it.height || 5,
        status: "waiting",
      }));
      queue.current = [...queue.current, ...fresh];
      sync();
      pump();
    },
    [pump],
  );

  const retry = useCallback(
    (id: string) => {
      patch(id, { status: "waiting", error: undefined });
      pump();
    },
    [pump],
  );

  const discard = useCallback((id: string) => {
    const item = queue.current.find((x) => x.id === id);
    if (!item || item.status === "working") return;
    URL.revokeObjectURL(item.preview);
    queue.current = queue.current.filter((x) => x.id !== id);
    sync();
  }, []);

  const onUploaded = useCallback((cb: (p: Photo) => void) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  // closing the tab mid-upload would lose photos, so ask first
  const busy = pending.some((p) => p.status !== "failed");
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  return <UploadCtx.Provider value={{ pending, add, retry, discard, onUploaded }}>{children}</UploadCtx.Provider>;
}
