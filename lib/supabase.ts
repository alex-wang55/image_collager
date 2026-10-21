import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "shoebox-auth" },
});

export const BUCKET = "collage";

/** Turn a Postgres/PostgREST/storage error into something a person can read. */
export function errMsg(e: unknown): string {
  if (!e) return "Something went wrong";
  const m = (e as { message?: string }).message ?? String(e);
  if (m.includes("duplicate key")) return "That already exists";
  if (m.includes("JWT")) return "Your session expired. Log in again.";
  if (m.includes("Failed to fetch") || m.includes("NetworkError") || m.includes("Load failed")) return "No connection. Try again in a sec.";
  return m;
}
