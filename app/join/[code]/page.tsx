"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { LogoMark } from "@/components/logo";
import { AvatarStack, Button, PageLoader, useToast } from "@/components/ui";
import { errMsg, supabase } from "@/lib/supabase";
import type { Person } from "@/lib/types";

type Preview = { id: string; name: string; photo_count: number; members: Person[]; is_member: boolean };

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<Preview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    supabase.rpc("collage_board_preview", { p_code: code }).then(({ data, error }) => {
      if (error) toast(errMsg(error), "err");
      setP((data as Preview) ?? null);
    });
  }, [code, loading, session?.user.id, toast]);

  async function join() {
    setBusy(true);
    const { data, error } = await supabase.rpc("collage_join", { p_code: code });
    setBusy(false);
    if (error) return toast(errMsg(error), "err");
    router.replace(`/b/${data}`);
  }

  if (loading || p === undefined) return <PageLoader />;
  const next = encodeURIComponent(`/join/${code}`);
  const host = p?.members[0]?.display_name.split(/\s+/)[0];

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-10 text-center">
        <LogoMark size={44} />
        {p === null ? (
          <>
            <h1 className="mt-8 text-2xl font-bold tracking-tight">This link doesn&apos;t work anymore</h1>
            <p className="mt-2 text-muted">Ask whoever sent it for a fresh one.</p>
            <Button href="/" variant="soft" className="mt-6">
              Go to Shoebox
            </Button>
          </>
        ) : (
          <>
            <p className="mt-8 text-muted">{host ? `${host} invited you to` : "You're invited to"}</p>
            <div className="relative mt-5 w-56 -rotate-2 bg-print px-5 pb-6 pt-10 shadow-print">
              <span className="tape" style={{ transform: "translateX(-50%) rotate(-3deg)" }} />
              <h1 className="font-hand break-words text-[40px] font-bold leading-[0.95] text-print-ink">{p.name}</h1>
              <p className="mt-3 text-sm text-print-muted">
                {p.photo_count} photo{p.photo_count === 1 ? "" : "s"} so far
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted">
              <AvatarStack people={p.members} size={28} />
              <span>
                {p.members.length} {p.members.length === 1 ? "person" : "people"} on it
              </span>
            </div>
            <div className="mt-10 flex w-full flex-col gap-2.5">
              {p.is_member ? (
                <Button href={`/b/${p.id}`} variant="ink" size="lg">
                  Open the board
                </Button>
              ) : session ? (
                <Button variant="ink" size="lg" loading={busy} onClick={join}>
                  Join the board
                </Button>
              ) : (
                <>
                  <Button href={`/signup?next=${next}`} variant="ink" size="lg">
                    Make an account to join
                  </Button>
                  <Button href={`/login?next=${next}`} variant="ghost" size="lg">
                    I already have one
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
