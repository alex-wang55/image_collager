# Shoebox

[![tests](https://github.com/alex-wang55/image_collager/actions/workflows/tests.yml/badge.svg)](https://github.com/alex-wang55/image_collager/actions/workflows/tests.yml)

A shared shoebox of photos for you and your people. Make a board, invite a friend with a link, snap pictures straight from your phone camera, and the board lays them out as a collage of tilted prints you can flip back through later.

Installs to your home screen (Safari: Share → Add to Home Screen) and opens full screen like a native app.

## What it does

- Boards you share with an invite link. Everyone on a board can add photos; new ones from friends show up live.
- Camera button opens the phone camera directly; Library adds a batch from the camera roll. Write a caption on the bottom of each print before it uploads.
- Two views: the collage (newest on top, tilted prints with tape) and a by-date timeline, month by month, using each photo's original EXIF date.
- Full-screen viewer: swipe between photos, swipe down to close, save or share the full-size file.
- The home screen resurfaces an old photo ("On this day, 2025" or "From 3 months ago") and marks boards with new photos from friends.

## Stack

- Next.js 16 (App Router, client pages) + Tailwind 4, deployed on Vercel
- Supabase: auth, Postgres with row-level security, storage for photos, realtime for live updates
- Service worker caches photos you've already seen, so boards reopen instantly

Photos are shrunk on the phone before upload (1920px long side, WebP where the browser can encode it, JPEG otherwise) plus a 720px copy for grids, so a typical photo costs about 300 KB and 1 GB holds roughly 3,000.

## Backend

Shoebox lives inside the Pinky Supabase project (the free plan allows two projects). Everything it owns is prefixed `collage_`: three tables, its RPCs, a private `collage` storage bucket, and its policies. It shares `public.profiles` with Pinky, so a Pinky account logs straight in. The full schema is in [`supabase/schema.sql`](supabase/schema.sql).

## Dev

    cp .env.example .env.local   # fill in the Supabase URL and publishable key
    npm install
    npm run dev
    npm test                     # EXIF date parsing and collage layout
