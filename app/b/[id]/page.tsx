"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { Collage } from "@/components/collage";
import { Compose } from "@/components/compose";
import { IconBack, IconCamera, IconCollage, IconGrid, IconInvite, IconLeave, IconMore, IconPen, IconPhotos, IconTrash } from "@/components/icons";
import { InviteSheet } from "@/components/invite";
import { Shell, useScrolled } from "@/components/shell";
import { Timeline } from "@/components/timeline";
import { useUploads } from "@/components/uploads";
import { Viewer } from "@/components/viewer";
import { ActionSheet, AvatarStack, Button, IconButton, PageLoader, cx, namesLabel, useConfirm, usePrompt, useToast } from "@/components/ui";
import { spanLabel } from "@/lib/dates";
import { deletePhotos, fetchPhotos, sortPhotos, type Order, PAGE } from "@/lib/photos";
import { errMsg, supabase } from "@/lib/supabase";
import type { Board, Member, Person, Photo } from "@/lib/types";

type View = "collage" | "timeline";
type List = { items: Photo[]; done: boolean; loading: boolean };
const empty: List = { items: [], done: false, loading: false };
const VIEW_KEY = "shoebox-view";

export default function BoardPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BoardScreen />
    </Suspense>
  );
}

function BoardScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const openId = search.get("p");
  const { session } = useAuth();
  const meId = session?.user.id ?? "";
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const uploads = useUploads();
  const scrolled = useScrolled(56);

  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [count, setCount] = useState(0);
  const [span, setSpan] = useState<{ from: string; to: string } | null>(null);
  const [view, setView] = useState<View>("collage");
  const [lists, setLists] = useState<Record<Order, List>>({ added: empty, shot: empty });
  const [picked, setPicked] = useState<File[]>([]);
  const [menu, setMenu] = useState(false);
  const [invite, setInvite] = useState(false);
  const [solo, setSolo] = useState<Photo | null>(null); // a deep-linked photo that isn't loaded yet
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pushed = useRef(false);

  const order: Order = view === "collage" ? "added" : "shot";
  const list = lists[order];
  const people = useMemo(() => {
    const m: Record<string, Person> = {};
    for (const x of members) if (x.profile) m[x.user_id] = x.profile;
    return m;
  }, [members]);
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const me = members.find((m) => m.user_id === meId);
  const isOwner = me?.role === "owner";

  // remember collage vs timeline
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "collage" || v === "timeline") setView(v);
    } catch {}
  }, []);
  const switchView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  /* ---------- loading ---------- */

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from("collage_members")
      .select("board_id, user_id, role, joined_at, profile:profiles(id, display_name, color)")
      .eq("board_id", id)
      .order("joined_at");
    if (data) setMembers(data as unknown as Member[]);
  }, [id]);

  const loadMeta = useCallback(async () => {
    const [b, c, first, last] = await Promise.all([
      supabase.from("collage_boards").select("*").eq("id", id).maybeSingle(),
      supabase.from("collage_photos").select("id", { count: "exact", head: true }).eq("board_id", id),
      supabase.from("collage_photos").select("shot_at").eq("board_id", id).order("shot_at").limit(1).maybeSingle(),
      supabase.from("collage_photos").select("shot_at").eq("board_id", id).order("shot_at", { ascending: false }).limit(1).maybeSingle(),
      loadMembers(),
    ]);
    if (b.error) return toast(errMsg(b.error), "err");
    setBoard((b.data as Board) ?? null);
    setCount(c.count ?? 0);
    setSpan(first.data && last.data ? { from: first.data.shot_at, to: last.data.shot_at } : null);
  }, [id, toast, loadMembers]);

  const listsRef = useRef(lists);
  listsRef.current = lists;
  const paging = useRef<Record<Order, boolean>>({ added: false, shot: false });

  const loadMore = useCallback(
    async (o: Order) => {
      const l = listsRef.current[o];
      if (paging.current[o] || l.done) return;
      paging.current[o] = true;
      setLists((ls) => ({ ...ls, [o]: { ...ls[o], loading: true } }));
      try {
        const rows = await fetchPhotos(id, o, l.items[l.items.length - 1]);
        setLists((ls) => {
          const have = new Set(ls[o].items.map((p) => p.id));
          return { ...ls, [o]: { items: [...ls[o].items, ...rows.filter((r) => !have.has(r.id))], done: rows.length < PAGE, loading: false } };
        });
      } catch (e) {
        toast(errMsg(e), "err");
        setLists((ls) => ({ ...ls, [o]: { ...ls[o], loading: false } }));
      } finally {
        paging.current[o] = false;
      }
    },
    [id, toast],
  );

  useEffect(() => {
    loadMeta();
    supabase.rpc("collage_mark_seen", { p_board: id }).then(() => {});
  }, [id, loadMeta]);

  useEffect(() => {
    if (board && !lists[order].items.length && !lists[order].done) loadMore(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, order]);

  /* ---------- keeping lists in sync ---------- */

  const addPhoto = useCallback((p: Photo) => {
    setLists((ls) => {
      const next = { ...ls };
      for (const o of ["added", "shot"] as Order[]) {
        const l = ls[o];
        if (l.items.some((x) => x.id === p.id)) continue;
        // only slot it in if it falls inside what we've loaded; otherwise paging will find it
        const last = l.items[l.items.length - 1];
        const col = o === "added" ? "created_at" : "shot_at";
        if (!l.done && last && Date.parse(p[col]) < Date.parse(last[col])) continue;
        next[o] = { ...l, items: sortPhotos([p, ...l.items], o) };
      }
      return next;
    });
  }, []);

  const dropPhotos = useCallback((ids: string[]) => {
    const gone = new Set(ids);
    setLists((ls) => ({
      added: { ...ls.added, items: ls.added.items.filter((p) => !gone.has(p.id)) },
      shot: { ...ls.shot, items: ls.shot.items.filter((p) => !gone.has(p.id)) },
    }));
  }, []);

  const patchPhoto = useCallback((p: Partial<Photo> & { id: string }) => {
    const f = (l: List) => ({ ...l, items: l.items.map((x) => (x.id === p.id ? { ...x, ...p } : x)) });
    setLists((ls) => ({ added: f(ls.added), shot: f(ls.shot) }));
  }, []);

  // your own uploads land here as they finish
  useEffect(
    () =>
      uploads.onUploaded((p) => {
        if (p.board_id !== id) return;
        addPhoto(p);
        setCount((c) => c + 1);
        setSpan((s) => (s ? { from: p.shot_at < s.from ? p.shot_at : s.from, to: p.shot_at > s.to ? p.shot_at : s.to } : { from: p.shot_at, to: p.shot_at }));
      }),
    [uploads, id, addPhoto],
  );

  // and everyone else's arrive live
  useEffect(() => {
    let seenTimer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase
      .channel(`board-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "collage_photos", filter: `board_id=eq.${id}` }, ({ new: row }) => {
        const p = row as Photo;
        if (p.user_id === meId) return; // already added by the upload queue
        addPhoto(p);
        setCount((c) => c + 1);
        // someone who joined after we opened the board
        if (p.user_id && !peopleRef.current[p.user_id]) loadMembers();
        clearTimeout(seenTimer);
        seenTimer = setTimeout(() => supabase.rpc("collage_mark_seen", { p_board: id }), 1500);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "collage_photos", filter: `board_id=eq.${id}` }, ({ new: row }) => {
        patchPhoto(row as Photo);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "collage_photos" }, ({ old }) => {
        // deletes aren't filterable by board, so ignore ones that aren't ours
        const gone = (old as { id?: string }).id;
        const ls = listsRef.current;
        if (!gone || (!ls.added.items.some((p) => p.id === gone) && !ls.shot.items.some((p) => p.id === gone))) return;
        dropPhotos([gone]);
        setCount((c) => Math.max(0, c - 1));
      })
      .subscribe();
    return () => {
      clearTimeout(seenTimer);
      supabase.removeChannel(ch);
    };
  }, [id, meId, addPhoto, patchPhoto, dropPhotos, loadMembers]);

  /* ---------- viewer (open photo lives in ?p= so back closes it) ---------- */

  const viewerPhotos = useMemo(() => {
    if (!openId) return [];
    if (list.items.some((p) => p.id === openId)) return list.items;
    return solo?.id === openId ? [solo] : [];
  }, [openId, list.items, solo]);
  const viewerIndex = viewerPhotos.findIndex((p) => p.id === openId);

  // a link straight to a photo we haven't paged to yet
  useEffect(() => {
    if (!openId || list.loading || list.items.some((p) => p.id === openId) || solo?.id === openId) return;
    if (!list.items.length && !list.done) return;
    supabase
      .from("collage_photos")
      .select("*")
      .eq("id", openId)
      .eq("board_id", id)
      .maybeSingle()
      .then(({ data }) => (data ? setSolo(data as Photo) : window.history.replaceState(null, "", pathname)));
  }, [openId, list, solo, id, pathname]);

  const openPhoto = (photoId: string) => {
    pushed.current = true;
    window.history.pushState(null, "", `${pathname}?p=${photoId}`);
  };
  const closeViewer = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", pathname);
  }, [pathname]);
  const onViewerIndex = useCallback(
    (i: number) => {
      const p = viewerPhotos[i];
      if (p) window.history.replaceState(null, "", `${pathname}?p=${p.id}`);
    },
    [viewerPhotos, pathname],
  );

  /* ---------- actions ---------- */

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
    e.target.value = "";
    if (files.length) setPicked((x) => [...x, ...files]);
  }

  function addPicked(items: Parameters<typeof uploads.add>[1]) {
    uploads.add(id, items);
    setPicked([]);
    if (view === "collage") window.scrollTo({ top: 0, behavior: "smooth" });
    else toast(`Adding ${items.length} photo${items.length === 1 ? "" : "s"}`);
  }

  async function deletePhoto(p: Photo) {
    const ok = await confirm({ title: "Delete this photo?", body: "It's gone for everyone on the board.", confirm: "Delete", danger: true });
    if (!ok) return;
    // step to a neighbour first so the viewer doesn't land on nothing
    if (openId === p.id) {
      const i = viewerPhotos.findIndex((x) => x.id === p.id);
      const next = viewerPhotos[i + 1] ?? viewerPhotos[i - 1];
      if (next) window.history.replaceState(null, "", `${pathname}?p=${next.id}`);
      else closeViewer();
    }
    try {
      await deletePhotos([p]);
      const ls = listsRef.current;
      if (ls.added.items.some((x) => x.id === p.id) || ls.shot.items.some((x) => x.id === p.id)) {
        dropPhotos([p.id]);
        setCount((c) => Math.max(0, c - 1));
      }
      if (board?.cover_photo_id === p.id) setBoard((b) => (b ? { ...b, cover_photo_id: null } : b));
    } catch (e) {
      toast(errMsg(e), "err");
    }
  }

  async function editCaption(p: Photo) {
    const text = await prompt({ title: p.caption ? "Edit caption" : "Add a caption", value: p.caption ?? "", placeholder: "write something...", maxLength: 280, hand: true });
    if (text === null) return;
    const caption = text.trim() || null;
    const { error } = await supabase.from("collage_photos").update({ caption }).eq("id", p.id);
    if (error) return toast(errMsg(error), "err");
    patchPhoto({ id: p.id, caption });
  }

  async function makeCover(p: Photo) {
    const { error } = await supabase.rpc("collage_set_cover", { p_board: id, p_photo: p.id });
    if (error) return toast(errMsg(error), "err");
    setBoard((b) => (b ? { ...b, cover_photo_id: p.id } : b));
    toast("Cover updated");
  }

  async function rename() {
    if (!board) return;
    const name = await prompt({ title: "Rename board", value: board.name, maxLength: 60 });
    if (!name?.trim() || name.trim() === board.name) return;
    const { error } = await supabase.rpc("collage_rename_board", { p_board: id, p_name: name.trim() });
    if (error) return toast(errMsg(error), "err");
    setBoard({ ...board, name: name.trim() });
  }

  async function leave() {
    const ok = await confirm({ title: "Leave this board?", body: "Your photos stay on it. You can come back with an invite link.", confirm: "Leave", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("collage_members").delete().eq("board_id", id).eq("user_id", meId);
    if (error) return toast(errMsg(error), "err");
    router.replace("/");
  }

  async function destroy() {
    const ok = await confirm({
      title: `Delete "${board?.name}"?`,
      body: `All ${count} photo${count === 1 ? "" : "s"} on it are deleted for everyone. This can't be undone.`,
      confirm: "Delete board",
      danger: true,
    });
    if (!ok) return;
    try {
      const { data, error } = await supabase.from("collage_photos").select("id, path, thumb_path").eq("board_id", id);
      if (error) throw error;
      await deletePhotos((data as Photo[]) ?? []);
      const { error: e2 } = await supabase.from("collage_boards").delete().eq("id", id);
      if (e2) throw e2;
      router.replace("/");
    } catch (e) {
      toast(errMsg(e), "err");
    }
  }

  /* ---------- infinite scroll ---------- */

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(order), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [order, loadMore, board]);

  /* ---------- render ---------- */

  const pending = uploads.pending.filter((p) => p.boardId === id);
  const others = members.filter((m) => m.user_id !== meId);

  const header = (
    <>
      <Link href="/" aria-label="Back to boards" className="flex h-10 items-center rounded-full pl-1 pr-2 text-ink hover:bg-surface-2">
        <IconBack size={24} />
      </Link>
      <span className={cx("min-w-0 flex-1 truncate font-semibold transition-opacity", scrolled ? "opacity-100" : "opacity-0")}>{board?.name}</span>
      {board ? (
        <>
          <IconButton label="Invite" onClick={() => setInvite(true)}>
            <IconInvite />
          </IconButton>
          <IconButton label="Board options" onClick={() => setMenu(true)}>
            <IconMore />
          </IconButton>
        </>
      ) : null}
    </>
  );

  return (
    <Shell header={header} wide>
      {board === undefined ? (
        <PageLoader />
      ) : board === null ? (
        <div className="mt-20 text-center">
          <h1 className="text-2xl font-bold tracking-tight">This board isn&apos;t here</h1>
          <p className="mt-2 text-muted">It was deleted, or you&apos;re not on it anymore.</p>
          <Button href="/" variant="soft" className="mt-6">
            Back to your boards
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-5 px-1">
            <h1 className="break-words text-[32px] font-bold leading-[1.1] tracking-tight">{board.name}</h1>
            <div className="mt-2.5 flex items-center gap-2.5">
              <button type="button" onClick={() => setInvite(true)} className="flex min-w-0 items-center gap-2 text-left">
                <AvatarStack people={members.map((m) => m.profile!).filter(Boolean)} size={26} />
                <span className="truncate text-sm text-muted">
                  {count} photo{count === 1 ? "" : "s"}
                  {span ? ` · ${spanLabel(span.from, span.to)}` : ""}
                </span>
              </button>
              <span className="flex-1" />
              <div className="flex shrink-0 rounded-full bg-surface-2 p-0.5" role="tablist" aria-label="View">
                <ViewTab active={view === "collage"} label="Collage" onClick={() => switchView("collage")}>
                  <IconCollage size={18} />
                </ViewTab>
                <ViewTab active={view === "timeline"} label="By date" onClick={() => switchView("timeline")}>
                  <IconGrid size={18} />
                </ViewTab>
              </div>
            </div>
          </div>

          {count === 0 && !pending.length && list.done ? (
            <EmptyBoard canInvite={!others.length} onInvite={() => setInvite(true)} />
          ) : view === "collage" ? (
            <Collage photos={list.items} pending={pending} people={people} onOpen={openPhoto} onRetry={uploads.retry} onDiscard={uploads.discard} />
          ) : (
            <>
              {pending.length ? <p className="mb-3 px-1 text-sm text-muted">Adding {pending.length} photo{pending.length === 1 ? "" : "s"}...</p> : null}
              <Timeline photos={list.items} onOpen={openPhoto} />
            </>
          )}

          <div ref={sentinel} className="h-px" />
          {list.loading ? (
            <div className="py-8">
              <PageLoaderSmall />
            </div>
          ) : null}
          {list.done && list.items.length > 12 ? <p className="font-hand py-10 text-center text-2xl text-muted">that&apos;s everything</p> : null}

          <CaptureBar onCamera={() => camera.current?.click()} onLibrary={() => library.current?.click()} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
          <input ref={library} type="file" accept="image/*" multiple hidden onChange={onPick} />

          {picked.length ? (
            <Compose files={picked} boardName={board.name} onAdd={addPicked} onCancel={() => setPicked([])} onPickMore={() => library.current?.click()} />
          ) : null}

          <InviteSheet
            open={invite}
            onClose={() => setInvite(false)}
            board={board}
            members={members}
            meId={meId}
            isOwner={isOwner}
            onCodeChange={(code) => setBoard({ ...board, invite_code: code })}
            onRemoved={(uid) => setMembers((ms) => ms.filter((m) => m.user_id !== uid))}
          />

          <ActionSheet
            open={menu}
            onClose={() => setMenu(false)}
            title={board.name}
            items={[
              { label: "Invite people", icon: <IconInvite size={20} />, onClick: () => setInvite(true), hint: namesLabel(members.map((m) => m.profile!).filter(Boolean), meId) },
              { label: "Rename board", icon: <IconPen size={20} />, onClick: rename },
              { label: "Leave board", icon: <IconLeave size={20} />, onClick: leave, danger: true, hidden: isOwner },
              { label: "Delete board", icon: <IconTrash size={20} />, onClick: destroy, danger: true, hidden: !isOwner },
            ]}
          />

          {openId && viewerIndex >= 0 ? (
            <Viewer
              photos={viewerPhotos}
              index={viewerIndex}
              onIndex={onViewerIndex}
              onClose={closeViewer}
              onNeedMore={() => viewerPhotos === list.items && loadMore(order)}
              people={people}
              meId={meId}
              isOwner={isOwner}
              boardName={board.name}
              coverId={board.cover_photo_id}
              onDelete={deletePhoto}
              onEditCaption={editCaption}
              onMakeCover={makeCover}
            />
          ) : null}
        </>
      )}
    </Shell>
  );
}

function ViewTab({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx("flex h-8 w-10 items-center justify-center rounded-full transition", active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
    >
      {children}
    </button>
  );
}

function PageLoaderSmall() {
  return (
    <div className="flex justify-center text-muted">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
    </div>
  );
}

/** Camera front and centre, library beside it. */
function CaptureBar({ onCamera, onLibrary }: { onCamera: () => void; onLibrary: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-surface/90 p-2 pr-2 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35)] ring-1 ring-line/70 backdrop-blur-md">
        <button
          type="button"
          onClick={onLibrary}
          className="flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition hover:bg-surface-2 active:scale-95"
        >
          <IconPhotos size={22} /> Library
        </button>
        <button
          type="button"
          onClick={onCamera}
          aria-label="Take a photo"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[inset_0_0_0_3px_rgb(255_255_255/0.35)] transition active:scale-90"
        >
          <IconCamera size={28} />
        </button>
      </div>
    </div>
  );
}

function EmptyBoard({ canInvite, onInvite }: { canInvite: boolean; onInvite: () => void }) {
  return (
    <div className="animate-rise mx-auto mt-6 max-w-sm text-center">
      <div className="mx-auto w-40 rotate-2 bg-print p-2 pb-0 shadow-print">
        <div className="flex aspect-[4/5] items-center justify-center bg-surface-2 text-muted">
          <IconCamera size={34} />
        </div>
        <div className="font-hand py-2 text-xl text-print-muted">nothing yet</div>
      </div>
      <p className="mt-7 text-[15px] leading-relaxed text-muted">Snap the first one, or pull a few from your camera roll.</p>
      {canInvite ? (
        <Button variant="soft" className="mt-5" onClick={onInvite}>
          <IconInvite size={18} /> Invite someone to add with you
        </Button>
      ) : null}
    </div>
  );
}
