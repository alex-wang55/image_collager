import "server-only";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type Targets = { board_name: string; sender_name: string; subs: { endpoint: string; p256dh: string; auth: string }[] } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { boardId, kind, ... } with the sender's access token. Pings everyone
 * else on the board who turned notifications on:
 *   photos  { count }            "Sam added 3 photos"
 *   comment { photoId, text }    "Sam: haha look at you"
 *   note    { photoId?, text }   "Sam left a note: ..."
 */
export async function POST(req: Request) {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject, PUSH_SECRET: secret } =
    process.env;
  if (!url || !anon || !pub || !priv || !secret) return Response.json({ sent: 0, reason: "push not configured" });

  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const body = (await req.json().catch(() => null)) as { boardId?: string; kind?: string; count?: number; photoId?: string | null; text?: string } | null;
  const boardId = body?.boardId ?? "";
  const kind = body?.kind === "comment" || body?.kind === "note" ? body.kind : "photos";
  const count = Math.max(1, Math.min(500, Math.floor(Number(body?.count) || 1)));
  const photoId = body?.photoId && UUID.test(body.photoId) ? body.photoId : null;
  const text = String(body?.text ?? "").replace(/\s+/g, " ").trim();
  const short = text.length > 90 ? text.slice(0, 89).trimEnd() + "…" : text;
  if (!token || !UUID.test(boardId) || (kind !== "photos" && !text) || (kind === "comment" && !photoId)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data: who } = await supabase.auth.getUser(token);
  if (!who.user) return Response.json({ error: "not signed in" }, { status: 401 });

  const { data, error } = await supabase.rpc("collage_push_targets", { p_secret: secret, p_board: boardId, p_sender: who.user.id });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const t = data as Targets;
  if (!t || !t.subs.length) return Response.json({ sent: 0 });

  webpush.setVapidDetails(subject || "https://shoebox-five.vercel.app", pub, priv);
  const first = (t.sender_name || "Someone").split(/\s+/)[0];
  const payload = JSON.stringify(
    kind === "comment"
      ? { title: t.board_name, body: `${first}: ${short}`, url: `/b/${boardId}?p=${photoId}&c=1`, tag: `comments-${photoId}` }
      : kind === "note"
        ? { title: t.board_name, body: `${first} left a note: ${short}`, url: `/b/${boardId}${photoId ? `?p=${photoId}` : ""}`, tag: `notes-${boardId}` }
        : { title: t.board_name, body: `${first} added ${count === 1 ? "a photo" : `${count} photos`}`, url: `/b/${boardId}`, tag: `board-${boardId}` },
  );

  let sent = 0;
  await Promise.all(
    t.subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        // the phone unsubscribed or the app was deleted: forget it
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await supabase.rpc("collage_drop_push_sub", { p_secret: secret, p_endpoint: s.endpoint });
      }
    }),
  );
  return Response.json({ sent });
}
