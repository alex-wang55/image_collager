-- Shoebox schema. Lives in the Pinky Supabase project (free plan caps us at two
-- projects), so every table, function, policy and bucket here is prefixed
-- `collage_` and only touches Pinky through public.profiles, which both apps
-- share (same accounts, same display names and colours).

-- ---------- tables ----------

create table public.collage_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid references public.profiles(id) on delete set null,
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  cover_photo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collage_members (
  board_id uuid not null references public.collage_boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index collage_members_user_idx on public.collage_members (user_id);

-- Photo files live in the `collage` bucket at {board_id}/{photo_id}.{jpg|webp}
-- with a small copy at {board_id}/{photo_id}_t.{jpg|webp} for grids.
create table public.collage_photos (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.collage_boards(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  path text not null,
  thumb_path text not null,
  width int not null check (width > 0),
  height int not null check (height > 0),
  bytes int not null default 0 check (bytes >= 0),
  color text check (color ~ '^#[0-9a-f]{6}$'),
  caption text check (char_length(caption) <= 280),
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  -- when it happened: the photo's own date if we know it, otherwise upload time
  shot_at timestamptz generated always as (coalesce(taken_at, created_at)) stored,
  check (path ~ ('^' || board_id::text || '/' || id::text || '\.(jpg|webp)$')),
  check (thumb_path ~ ('^' || board_id::text || '/' || id::text || '_t\.(jpg|webp)$'))
);
create index collage_photos_board_created_idx on public.collage_photos (board_id, created_at desc, id desc);
create index collage_photos_board_shot_idx on public.collage_photos (board_id, shot_at desc, id desc);
create index collage_photos_user_idx on public.collage_photos (user_id);

alter table public.collage_boards
  add constraint collage_boards_cover_fk foreign key (cover_photo_id) references public.collage_photos(id) on delete set null;
create index collage_boards_cover_idx on public.collage_boards (cover_photo_id);
create index collage_boards_created_by_idx on public.collage_boards (created_by);

-- ---------- helpers (security definer so policies don't recurse) ----------

create function public.collage_is_member(p_board uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collage_members where board_id = p_board and user_id = (select auth.uid()));
$$;

create function public.collage_is_owner(p_board uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collage_members where board_id = p_board and user_id = (select auth.uid()) and role = 'owner');
$$;

-- Storage policies get the folder name as text; compare as text so a stray
-- non-uuid folder can't make the cast blow up.
create function public.collage_is_member_folder(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collage_members where board_id::text = p_folder and user_id = (select auth.uid()));
$$;

create function public.collage_is_owner_folder(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collage_members where board_id::text = p_folder and user_id = (select auth.uid()) and role = 'owner');
$$;

-- ---------- row level security ----------
-- Reads are scoped to boards you're in. Boards and memberships are written
-- through the RPCs below; photos are inserted directly by members.

alter table public.collage_boards enable row level security;
alter table public.collage_members enable row level security;
alter table public.collage_photos enable row level security;

create policy "collage: members see boards" on public.collage_boards
  for select to authenticated using (public.collage_is_member(id));
create policy "collage: owner deletes board" on public.collage_boards
  for delete to authenticated using (public.collage_is_owner(id));

create policy "collage: members see each other" on public.collage_members
  for select to authenticated using (public.collage_is_member(board_id));
-- leave a board yourself (owners delete instead), or the owner removes someone
create policy "collage: leave or remove" on public.collage_members
  for delete to authenticated using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (user_id <> (select auth.uid()) and public.collage_is_owner(board_id)));

create policy "collage: members see photos" on public.collage_photos
  for select to authenticated using (public.collage_is_member(board_id));
create policy "collage: members add photos" on public.collage_photos
  for insert to authenticated with check (user_id = (select auth.uid()) and public.collage_is_member(board_id));
create policy "collage: edit your own captions" on public.collage_photos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "collage: delete your photos, or any as owner" on public.collage_photos
  for delete to authenticated using (user_id = (select auth.uid()) or public.collage_is_owner(board_id));

-- Only the caption and date are editable after upload.
revoke insert, update, delete on public.collage_boards, public.collage_members from anon, authenticated;
revoke insert, update, delete on public.collage_photos from anon;
revoke update on public.collage_photos from authenticated;
grant update (caption, taken_at) on public.collage_photos to authenticated;
grant delete on public.collage_boards, public.collage_members to authenticated;

-- ---------- triggers ----------

create function public.collage_touch_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.collage_boards set updated_at = now() where id = new.board_id;
  return new;
end $$;
create trigger collage_photos_touch_board after insert on public.collage_photos
  for each row execute function public.collage_touch_board();

-- ---------- RPCs ----------

create function public.collage_create_board(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Log in first'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give it a name'; end if;
  insert into public.collage_boards (name, created_by) values (trim(p_name), v_uid) returning id into v_id;
  insert into public.collage_members (board_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

create function public.collage_rename_board(p_board uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.collage_is_member(p_board) then raise exception 'You are not on this board'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give it a name'; end if;
  update public.collage_boards set name = trim(p_name) where id = p_board;
end $$;

create function public.collage_set_cover(p_board uuid, p_photo uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.collage_is_member(p_board) then raise exception 'You are not on this board'; end if;
  if p_photo is not null and not exists (select 1 from public.collage_photos where id = p_photo and board_id = p_board) then
    raise exception 'That photo is not on this board';
  end if;
  update public.collage_boards set cover_photo_id = p_photo where id = p_board;
end $$;

create function public.collage_reset_invite(p_board uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.collage_is_owner(p_board) then raise exception 'Only the board owner can do that'; end if;
  update public.collage_boards set invite_code = encode(extensions.gen_random_bytes(6), 'hex')
    where id = p_board returning invite_code into v_code;
  return v_code;
end $$;

create function public.collage_mark_seen(p_board uuid) returns void
language sql security definer set search_path = '' as $$
  update public.collage_members set last_seen_at = now() where board_id = p_board and user_id = (select auth.uid());
$$;

-- What an invite link shows before you join. Works logged out.
create function public.collage_board_preview(p_code text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', b.id,
    'name', b.name,
    'photo_count', (select count(*) from public.collage_photos p where p.board_id = b.id),
    'members', (
      select coalesce(json_agg(json_build_object('id', pr.id, 'display_name', pr.display_name, 'color', pr.color) order by m.joined_at), '[]'::json)
      from public.collage_members m join public.profiles pr on pr.id = m.user_id where m.board_id = b.id),
    'is_member', exists (select 1 from public.collage_members m where m.board_id = b.id and m.user_id = (select auth.uid())))
  from public.collage_boards b
  where b.invite_code = lower(trim(p_code));
$$;

create function public.collage_join(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_board uuid;
begin
  if v_uid is null then raise exception 'Log in first'; end if;
  select id into v_board from public.collage_boards where invite_code = lower(trim(p_code));
  if v_board is null then raise exception 'That invite link doesn''t work anymore. Ask for a new one.'; end if;
  insert into public.collage_members (board_id, user_id) values (v_board, v_uid) on conflict do nothing;
  return v_board;
end $$;

-- Home screen: every board you're in with its cover shots, people, and how
-- many photos other people added since you last opened it.
create function public.collage_my_boards() returns json
language sql stable set search_path = '' as $$
  select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
    select
      b.id, b.name, b.created_at, b.updated_at, m.role,
      (select count(*) from public.collage_photos p where p.board_id = b.id) as photo_count,
      (select count(*) from public.collage_photos p
        where p.board_id = b.id and p.created_at > m.last_seen_at and p.user_id is distinct from m.user_id) as new_count,
      (select coalesce(json_agg(c), '[]'::json) from (
        select p.id, p.thumb_path, p.width, p.height, p.color
        from public.collage_photos p
        where p.board_id = b.id
        order by (p.id = b.cover_photo_id) desc nulls last, p.created_at desc
        limit 3) c) as covers,
      (select coalesce(json_agg(json_build_object('id', pr.id, 'display_name', pr.display_name, 'color', pr.color) order by mm.joined_at), '[]'::json)
        from public.collage_members mm join public.profiles pr on pr.id = mm.user_id
        where mm.board_id = b.id) as members
    from public.collage_members m
    join public.collage_boards b on b.id = m.board_id
    where m.user_id = (select auth.uid())
  ) x;
$$;

-- One photo to look back on: something from this day in an earlier year if
-- there is one, otherwise anything that's at least a few days old.
create function public.collage_random_memory() returns json
language sql volatile set search_path = '' as $$
  select row_to_json(x) from (
    select p.id, p.board_id, b.name as board_name, p.thumb_path, p.path, p.width, p.height, p.color, p.caption,
      p.created_at, p.taken_at,
      (to_char(p.shot_at, 'MM-DD') = to_char(now(), 'MM-DD') and p.shot_at < date_trunc('year', now())) as on_this_day
    from public.collage_photos p
    join public.collage_boards b on b.id = p.board_id
    order by on_this_day desc, (p.shot_at < now() - interval '3 days') desc, random()
    limit 1
  ) x;
$$;

-- Total size of every Shoebox photo, for the storage meter.
create function public.collage_storage_used() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(bytes), 0)::bigint from public.collage_photos;
$$;

revoke execute on function
  public.collage_create_board(text), public.collage_rename_board(uuid, text), public.collage_set_cover(uuid, uuid),
  public.collage_reset_invite(uuid), public.collage_mark_seen(uuid), public.collage_join(text),
  public.collage_my_boards(), public.collage_random_memory(), public.collage_storage_used()
  from public, anon;
grant execute on function
  public.collage_create_board(text), public.collage_rename_board(uuid, text), public.collage_set_cover(uuid, uuid),
  public.collage_reset_invite(uuid), public.collage_mark_seen(uuid), public.collage_join(text),
  public.collage_my_boards(), public.collage_random_memory(), public.collage_storage_used()
  to authenticated;
grant execute on function public.collage_board_preview(text) to anon, authenticated;
-- Policies run the helpers as the signed-in user, so authenticated keeps them.
revoke execute on function
  public.collage_is_member(uuid), public.collage_is_owner(uuid),
  public.collage_is_member_folder(text), public.collage_is_owner_folder(text)
  from public, anon;
revoke execute on function public.collage_touch_board() from public, anon, authenticated;

-- ---------- storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collage', 'collage', false, 10485760, array['image/jpeg', 'image/webp']);

create policy "collage: members view photos" on storage.objects
  for select to authenticated using (bucket_id = 'collage' and public.collage_is_member_folder((storage.foldername(name))[1]));
create policy "collage: members upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'collage' and public.collage_is_member_folder((storage.foldername(name))[1]));
create policy "collage: delete your files, or any as owner" on storage.objects
  for delete to authenticated using (
    bucket_id = 'collage'
    and (owner_id = (select auth.uid())::text or public.collage_is_owner_folder((storage.foldername(name))[1])));

-- ---------- realtime: new photos show up live ----------

alter publication supabase_realtime add table public.collage_photos;

-- ---------- push notifications: "Sam added 3 photos to Summer" ----------

create table public.collage_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index collage_push_subs_user_idx on public.collage_push_subs (user_id);
alter table public.collage_push_subs enable row level security;
create policy "collage: see your push subs" on public.collage_push_subs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "collage: drop your push subs" on public.collage_push_subs
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.collage_push_subs from anon, authenticated;
revoke all on public.collage_push_subs from anon;

-- a phone that re-subscribes moves to whoever is logged in on it now
create function public.collage_save_push_sub(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Log in first'; end if;
  insert into public.collage_push_subs (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
revoke execute on function public.collage_save_push_sub(text, text, text) from public, anon;
grant execute on function public.collage_save_push_sub(text, text, text) to authenticated;

-- The server (app/api/notify) reads subscriptions through these, gated by a
-- secret that matches PUSH_SECRET in Vercel. Set it with:
--   insert into private.config (key, value) values ('collage_push_secret', '<PUSH_SECRET>');
create function public.collage_push_targets(p_secret text, p_board uuid, p_sender uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select value from private.config where key = 'collage_push_secret') then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.collage_members where board_id = p_board and user_id = p_sender) then
    return null;
  end if;
  return json_build_object(
    'board_name', (select name from public.collage_boards where id = p_board),
    'sender_name', (select display_name from public.profiles where id = p_sender),
    'subs', (
      select coalesce(json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::json)
      from public.collage_push_subs s
      join public.collage_members m on m.user_id = s.user_id
      where m.board_id = p_board and m.user_id <> p_sender));
end $$;

create function public.collage_drop_push_sub(p_secret text, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select value from private.config where key = 'collage_push_secret') then
    raise exception 'not allowed';
  end if;
  delete from public.collage_push_subs where endpoint = p_endpoint;
end $$;

-- ---------- caption pens and doodles ----------

-- Which marker the caption is written in, and a freehand drawing over the
-- photo: { v: 1, strokes: [{ c: "#hex", w: width (fraction of photo width), p: [x, y, x, y, ...] (0..1) }] }
alter table public.collage_photos
  add column caption_pen text check (caption_pen in ('pen', 'marker', 'pencil', 'type')),
  add column caption_ink text check (caption_ink in ('ink', 'blue', 'red', 'green')),
  add column doodle jsonb check (doodle is null or (jsonb_typeof(doodle) = 'object' and octet_length(doodle::text) <= 120000));

revoke update on public.collage_photos from authenticated;
grant update (caption, caption_pen, caption_ink, taken_at) on public.collage_photos to authenticated;

-- Anyone on the board can draw on any photo (captions stay the uploader's).
create function public.collage_set_doodle(p_photo uuid, p_doodle jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_board uuid;
begin
  select board_id into v_board from public.collage_photos where id = p_photo;
  if v_board is null or not public.collage_is_member(v_board) then raise exception 'You are not on this board'; end if;
  update public.collage_photos set doodle = p_doodle where id = p_photo;
end $$;
revoke execute on function public.collage_set_doodle(uuid, jsonb) from public, anon;
grant execute on function public.collage_set_doodle(uuid, jsonb) to authenticated;
