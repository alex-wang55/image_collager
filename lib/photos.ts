import { BUCKET, supabase } from "./supabase";
import type { Photo } from "./types";

/**
 * Photos live in a private bucket, so every image needs a signed URL. We sign
 * in batches, keep them for a day, and the service worker caches the bytes by
 * path (ignoring the token) so a re-signed URL still loads from cache.
 */
const TTL = 60 * 60 * 24; // seconds
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | null>>();

/** Photos you just uploaded show from the local copy, so they don't flicker or download again. */
export function rememberLocal(path: string, blob: Blob): void {
  cache.set(path, { url: URL.createObjectURL(blob), exp: Number.MAX_SAFE_INTEGER });
}

export async function signUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const need: string[] = [];
  const waits: Promise<void>[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(p);
    if (hit && hit.exp > now + 60_000) out[p] = hit.url;
    else if (inflight.has(p)) waits.push(inflight.get(p)!.then((u) => void (u && (out[p] = u))));
    else need.push(p);
  }
  if (need.length) {
    const batch = supabase.storage
      .from(BUCKET)
      .createSignedUrls(need, TTL)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const row of data ?? []) {
          if (row.path && row.signedUrl) {
            map[row.path] = row.signedUrl;
            cache.set(row.path, { url: row.signedUrl, exp: Date.now() + TTL * 1000 });
          }
        }
        return map;
      });
    for (const p of need) {
      const one = batch.then((m) => m[p] ?? null).finally(() => inflight.delete(p));
      inflight.set(p, one);
      waits.push(one.then((u) => void (u && (out[p] = u))));
    }
  }
  await Promise.all(waits);
  return out;
}

export function cachedUrl(path: string): string | undefined {
  const hit = cache.get(path);
  return hit && hit.exp > Date.now() ? hit.url : undefined;
}

/** "added" = newest uploads first (the collage). "shot" = by when the photo was taken (the timeline). */
export type Order = "added" | "shot";
export const PAGE = 60;

const orderCol = (o: Order) => (o === "added" ? "created_at" : "shot_at");

/** One page, newest first, continuing after `after` (keyset, so new uploads never shift pages). */
export async function fetchPhotos(boardId: string, order: Order, after?: Photo): Promise<Photo[]> {
  const col = orderCol(order);
  let q = supabase
    .from("collage_photos")
    .select("*")
    .eq("board_id", boardId)
    .order(col, { ascending: false })
    .order("id", { ascending: false });
  if (after) q = q.or(`${col}.lt."${after[col]}",and(${col}.eq."${after[col]}",id.lt.${after.id})`);
  const { data, error } = await q.limit(PAGE);
  if (error) throw error;
  return (data ?? []) as Photo[];
}

export function sortPhotos(list: Photo[], order: Order): Photo[] {
  const col = orderCol(order);
  return [...list].sort((a, b) => (b[col] === a[col] ? b.id.localeCompare(a.id) : Date.parse(b[col]) - Date.parse(a[col])));
}

/** Delete photos and their files. Files first, so a failure never leaves orphaned storage. */
export async function deletePhotos(photos: Pick<Photo, "id" | "path" | "thumb_path">[]): Promise<void> {
  if (!photos.length) return;
  const files = photos.flatMap((p) => [p.path, p.thumb_path]);
  for (let i = 0; i < files.length; i += 900) {
    const { error } = await supabase.storage.from(BUCKET).remove(files.slice(i, i + 900));
    if (error) throw error;
  }
  const ids = photos.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("collage_photos").delete().in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

/** Download the full-size file, for sharing or saving. */
export async function photoFile(p: Pick<Photo, "path" | "id">, name = "photo"): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(p.path);
  if (error || !data) throw error ?? new Error("Couldn't download that photo");
  const ext = p.path.endsWith(".webp") ? "webp" : "jpg";
  const safe = name.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "photo";
  return new File([data], `${safe}-${p.id.slice(0, 6)}.${ext}`, { type: data.type || (ext === "webp" ? "image/webp" : "image/jpeg") });
}
