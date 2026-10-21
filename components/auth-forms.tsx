"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, errMsg } from "@/lib/supabase";
import { useAuth } from "./auth";
import { Button, Field, inputCls, useToast } from "./ui";
import { LogoMark } from "./logo";

export const COLORS = ["#d4452a", "#3f6fd1", "#2f8f6a", "#c4862b", "#8a55c9", "#d0457f", "#2c8c9a", "#6b7a2e"];

function useNext() {
  const sp = useSearchParams();
  const n = sp.get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function AuthFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
        <Link href="/" className="mb-8 self-start" aria-label="Shoebox home">
          <LogoMark size={48} />
        </Link>
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{sub}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = useNext();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === "Invalid login credentials" ? "Wrong email or password" : errMsg(error));
    else router.replace(next);
  }

  return (
    <AuthFrame title="Welcome back" sub="Your photos are right where you left them.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="-mt-2 text-right">
          <Link href="/forgot" className="text-sm font-semibold text-muted hover:text-ink">
            Forgot password?
          </Link>
        </div>
        {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}
        <Button type="submit" variant="ink" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link className="font-semibold text-ink underline decoration-line underline-offset-4" href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Make an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted">Have a Pinky account? Same email and password work here.</p>
    </AuthFrame>
  );
}

export function SignupForm() {
  const router = useRouter();
  const next = useNext();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [avail, setAvail] = useState<null | boolean>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const uname = username.trim().toLowerCase();
  const unameValid = /^[a-z0-9_]{3,20}$/.test(uname);

  useEffect(() => {
    setAvail(null);
    if (!unameValid) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("username_available", { p_username: uname });
      setAvail(Boolean(data));
    }, 350);
    return () => clearTimeout(t);
  }, [uname, unameValid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unameValid) return setErr("Usernames are 3 to 20 letters, numbers or underscores");
    if (avail === false) return setErr("That username is taken");
    if (password.length < 6) return setErr("Password needs at least 6 characters");
    setBusy(true);
    setErr("");
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: uname, display_name: name.trim() || uname, color } },
    });
    if (error) {
      setBusy(false);
      setErr(error.message.includes("Database error") ? "That username was just taken. Try another." : errMsg(error));
      return;
    }
    if (!data.session) {
      const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e2) {
        setBusy(false);
        setErr(errMsg(e2));
        return;
      }
    }
    router.replace(next);
  }

  return (
    <AuthFrame title="Make an account" sub="Takes ten seconds. Then start a board and invite your people.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <input className={inputCls} autoComplete="given-name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
        </Field>
        <Field
          label="Username"
          hint={!uname ? "Letters, numbers or _" : !unameValid ? "3 to 20 letters, numbers or _" : avail === null ? "Checking..." : avail ? "Nice, it's free" : "Taken, try another"}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
            <input
              className={inputCls + " pl-8"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="alex"
            />
          </div>
        </Field>
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <input className={inputCls} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}
        <Button type="submit" variant="ink" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have one?{" "}
        <Link className="font-semibold text-ink underline decoration-line underline-offset-4" href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Log in
        </Link>
      </p>
    </AuthFrame>
  );
}

/** Step 1: email a reset link. It lands on /reset, already logged in. */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset` });
    setBusy(false);
    if (error) setErr(error.message.toLowerCase().includes("rate limit") ? "Too many tries. Wait an hour and try again." : errMsg(error));
    else setSent(true);
  }

  if (sent) {
    return (
      <AuthFrame title="Check your email" sub={`If there's an account for ${email.trim()}, a link to set a new password is on its way. It works once and expires in an hour.`}>
        <p className="text-sm leading-relaxed text-muted">Nothing after a few minutes? Check spam, or try again.</p>
        <Button variant="soft" size="lg" className="mt-6 w-full" onClick={() => setSent(false)}>
          Send it again
        </Button>
        <p className="mt-6 text-center text-sm text-muted">
          <Link className="font-semibold text-ink underline decoration-line underline-offset-4" href="/login">
            Back to log in
          </Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Forgot your password?" sub="Happens to everyone. We'll email you a link to set a new one.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}
        <Button type="submit" variant="ink" size="lg" className="w-full" loading={busy}>
          Email me a link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link className="font-semibold text-ink underline decoration-line underline-offset-4" href="/login">
          Log in
        </Link>
      </p>
    </AuthFrame>
  );
}

/** Supabase sends a dead or reused link back with the reason in the URL. */
function linkError(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  const code = params.get("error_code");
  if (code === "otp_expired") return "That link has expired or was already used.";
  return params.get("error_description")?.replace(/\+/g, " ") ?? null;
}

/**
 * Step 2: set a new password. Opening the email link logs you in, so this is
 * also where a logged-in person changes their password from the profile page.
 */
export function ResetForm() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [linkErr] = useState(linkError);
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setErr("Password needs at least 6 characters");
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message.includes("different from the old") ? "That's your current password. Pick a new one." : errMsg(error));
    toast("Password changed");
    router.replace("/");
  }

  if (loading) return null;

  if (!session) {
    return (
      <AuthFrame title="Link didn't work" sub={linkErr ?? "That link has expired or was already used."}>
        <Button href="/forgot" variant="ink" size="lg" className="w-full">
          Send a new link
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Set a new password" sub={`For ${session.user.email}. You'll use it to log in to Shoebox and Pinky.`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 6 characters">
          <input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {err ? <p className="text-sm font-semibold text-danger">{err}</p> : null}
        <Button type="submit" variant="ink" size="lg" className="w-full" loading={busy}>
          Save password
        </Button>
      </form>
    </AuthFrame>
  );
}
