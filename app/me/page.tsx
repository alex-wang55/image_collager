"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { COLORS } from "@/components/auth-forms";
import { InstallHint } from "@/components/home-parts";
import { IconBack } from "@/components/icons";
import { NotifySetting } from "@/components/notify";
import { Shell } from "@/components/shell";
import { Avatar, Button, Field, cx, inputCls, useToast } from "@/components/ui";
import { errMsg, supabase } from "@/lib/supabase";

/** Free Supabase storage is 1GB for the whole project (shared with Pinky's proof photos). */
const STORAGE_LIMIT = 1024 ** 3;

export default function MePage() {
  return (
    <Shell
      header={
        <>
          <Link href="/" aria-label="Back to boards" className="flex h-10 items-center gap-1 rounded-full pl-1 pr-3 font-semibold hover:bg-surface-2">
            <IconBack size={24} /> Boards
          </Link>
        </>
      }
    >
      <Me />
    </Shell>
  );
}

function Me() {
  const { session, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [color, setColor] = useState(profile?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [used, setUsed] = useState<number | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setColor(profile.color);
    }
  }, [profile]);

  useEffect(() => {
    supabase.rpc("collage_storage_used").then(({ data }) => setUsed(Number(data ?? 0)));
  }, []);

  const dirty = !!profile && (name.trim() !== profile.display_name || color !== profile.color);

  async function save() {
    if (!name.trim()) return toast("Your name can't be empty", "err");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), color }).eq("id", session!.user.id);
    setSaving(false);
    if (error) return toast(errMsg(error), "err");
    await refreshProfile();
    toast("Saved");
  }

  async function logout() {
    await supabase.auth.signOut();
    // a full load, so the signed-in page's "go log in" redirect can't win the race
    window.location.replace("/");
  }

  const pct = used === null ? 0 : Math.min(100, (used / STORAGE_LIMIT) * 100);

  return (
    <div className="mx-auto max-w-md">
      <div className="mt-4 flex flex-col items-center text-center">
        <Avatar person={{ display_name: name || "?", color }} size={84} />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{profile?.display_name}</h1>
        <p className="text-sm text-muted">@{profile?.username}</p>
      </div>

      <div className="mt-8 space-y-5 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line/60">
        <Field label="Your name" hint="Friends see this on the photos you add.">
          <input className={inputCls} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <span className="mb-2 block text-sm font-semibold">Your colour</span>
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className={cx("h-9 w-9 rounded-full transition", color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "hover:scale-110")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {dirty ? (
          <Button variant="ink" className="w-full" loading={saving} onClick={save}>
            Save
          </Button>
        ) : null}
      </div>

      <div className="mt-5 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line/60">
        <NotifySetting />
      </div>

      <div className="mt-5 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line/60">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Photo storage</span>
          <span className="tabular text-sm text-muted">{used === null ? "..." : `${fmtBytes(used)} of 1 GB`}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Shared by everyone using this Shoebox. Photos are shrunk before they upload (about 300 KB each), so 1 GB holds roughly 3,000.
        </p>
      </div>

      <div className="mt-6">
        <InstallHint />
      </div>

      <Button variant="soft" size="lg" className="mt-2 w-full" href="/reset">
        Change password
      </Button>
      <Button variant="soft" size="lg" className="mt-2 w-full" onClick={logout}>
        Log out
      </Button>
      <p className="mt-6 text-center text-xs text-muted">Your Shoebox login is the same as your Pinky one.</p>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
