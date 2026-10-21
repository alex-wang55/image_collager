"use client";

import { useEffect, useState } from "react";
import { pushState, turnOffPush, turnOnPush, type PushState } from "@/lib/push-client";
import { errMsg } from "@/lib/supabase";
import { IconClose } from "./icons";
import { Button, useToast } from "./ui";

function usePush() {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    pushState().then(setState);
  }, []);
  return [state, setState] as const;
}

const HINT: Record<Exclude<PushState, "on" | "off">, string> = {
  unsupported: "This browser can't show notifications.",
  "needs-install": "Add Shoebox to your home screen first, then turn these on from there.",
  denied: "Notifications are blocked for Shoebox. Allow them in your phone's settings.",
};

/** The settings row on the profile page. */
export function NotifySetting() {
  const toast = useToast();
  const [state, setState] = usePush();
  const [busy, setBusy] = useState(false);

  async function on() {
    setBusy(true);
    try {
      const s = await turnOnPush();
      setState(s);
      if (s === "on") toast("You'll get a ping when friends add photos");
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function off() {
    setBusy(true);
    await turnOffPush().catch(() => {});
    setState("off");
    setBusy(false);
  }

  if (!state) return null;
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Notifications</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          {state === "on" ? "On. You'll hear when friends add photos." : state === "off" ? "Get a ping when friends add photos." : HINT[state]}
        </span>
      </div>
      {state === "off" ? (
        <Button size="sm" variant="ink" loading={busy} onClick={on}>
          Turn on
        </Button>
      ) : state === "on" ? (
        <Button size="sm" variant="soft" loading={busy} onClick={off}>
          Turn off
        </Button>
      ) : null}
    </div>
  );
}

const NUDGE_KEY = "shoebox-push-nudge";

/** A one-time ask on the home screen, only where it can actually work. */
export function PushNudge({ friend }: { friend?: string }) {
  const toast = useToast();
  const [state, setState] = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(NUDGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden || state !== "off") return null;
  const dismiss = () => {
    try {
      localStorage.setItem(NUDGE_KEY, "1");
    } catch {}
    setHidden(true);
  };
  return (
    <div className="animate-rise relative mb-6 flex items-center gap-3 rounded-3xl bg-surface p-4 pr-12 shadow-card ring-1 ring-line/60">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink">
        <IconClose size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Want a ping when {friend ?? "friends"} add{friend ? "s" : ""} photos?</p>
        <Button
          size="sm"
          variant="ink"
          className="mt-2.5"
          onClick={async () => {
            try {
              const s = await turnOnPush();
              setState(s);
              if (s === "on") dismiss();
            } catch (e) {
              toast(errMsg(e), "err");
            }
          }}
        >
          Turn on notifications
        </Button>
      </div>
    </div>
  );
}
