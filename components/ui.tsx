"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Person } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ink" | "soft" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  href?: string;
};

const variants: Record<NonNullable<BtnProps["variant"]>, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-105 active:brightness-95",
  ink: "bg-ink text-bg hover:opacity-90 active:opacity-80",
  soft: "bg-surface-2 text-ink hover:brightness-[0.98] active:brightness-95",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-105",
};
const sizes = {
  sm: "h-9 px-3.5 text-sm rounded-full",
  md: "h-11 px-5 text-[15px] rounded-full",
  lg: "h-13 px-6 text-base rounded-full",
};

export function Button({ variant = "primary", size = "md", loading, className, children, href, disabled, ...rest }: BtnProps) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 font-semibold transition select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    variants[variant],
    sizes[size],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner small /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-surface-2 active:scale-95", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-label="Loading"
      className={cx("inline-block animate-spin rounded-full border-2 border-current border-r-transparent", small ? "h-4 w-4" : "h-6 w-6", className)}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center text-muted">
      <Spinner />
    </div>
  );
}

export function Avatar({ person, size = 32, className }: { person?: Pick<Person, "display_name" | "color"> | null; size?: number; className?: string }) {
  const name = person?.display_name ?? "?";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cx("inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, background: person?.color ?? "#999", fontSize: Math.round(size * 0.4) }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ people, size = 26, max = 4 }: { people: Person[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.id} person={p} size={size} className={cx("ring-2 ring-bg", i > 0 && "-ml-2")} />
      ))}
      {rest > 0 ? (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted ring-2 ring-bg"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** "Sam", "Sam & Jo", "Sam, Jo & 2 more" */
export function namesLabel(people: Person[], meId?: string): string {
  const others = people.filter((p) => p.id !== meId).map((p) => p.display_name.split(/\s+/)[0]);
  if (!others.length) return "Just you";
  if (others.length === 1) return `With ${others[0]}`;
  if (others.length === 2) return `With ${others[0]} & ${others[1]}`;
  return `With ${others[0]}, ${others[1]} & ${others.length - 2} more`;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted/70 outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5";

/* ---------- sheets (bottom on phones, centered on bigger screens) ---------- */

export function Sheet({
  open,
  onClose,
  children,
  label,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <div className="animate-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className={cx(
          "animate-sheet relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface pb-safe shadow-2xl sm:max-w-md sm:rounded-[28px] sm:pb-4",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SheetTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-6 pb-2 pt-4">
      <h2 className="text-xl font-bold tracking-tight">{children}</h2>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export type MenuItem = { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean; hint?: string };

/** A list of actions in a sheet, like the iOS share/action sheet. */
export function ActionSheet({ open, onClose, title, items }: { open: boolean; onClose: () => void; title?: ReactNode; items: MenuItem[] }) {
  return (
    <Sheet open={open} onClose={onClose} label={typeof title === "string" ? title : "Options"}>
      {title ? <div className="px-6 pb-1 pt-4 text-sm font-semibold text-muted">{title}</div> : <div className="h-3" />}
      <ul className="px-3 pb-2">
        {items
          .filter((i) => !i.hidden)
          .map((i) => (
            <li key={i.label}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  i.onClick();
                }}
                className={cx(
                  "flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left text-[16px] font-medium transition hover:bg-surface-2 active:bg-surface-2",
                  i.danger ? "text-danger" : "text-ink",
                )}
              >
                {i.icon ? <span className="flex w-6 justify-center opacity-80">{i.icon}</span> : null}
                <span className="min-w-0 flex-1">
                  {i.label}
                  {i.hint ? <span className="block text-xs font-normal text-muted">{i.hint}</span> : null}
                </span>
              </button>
            </li>
          ))}
      </ul>
    </Sheet>
  );
}

/* ---------- confirm dialog ---------- */

type ConfirmOpts = { title: string; body?: string; confirm?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Sheet open={!!state} onClose={() => done(false)} label={state?.title ?? "Confirm"}>
        {state ? (
          <div className="px-6 pb-2 pt-4">
            <h2 className="text-xl font-bold tracking-tight">{state.title}</h2>
            {state.body ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{state.body}</p> : null}
            <div className="mt-6 flex flex-col gap-2">
              <Button variant={state.danger ? "danger" : "ink"} size="lg" onClick={() => done(true)}>
                {state.confirm ?? "OK"}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => done(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </ConfirmCtx.Provider>
  );
}

/* ---------- prompt dialog (rename, captions) ---------- */

type PromptOpts = { title: string; value?: string; placeholder?: string; confirm?: string; maxLength?: number; hand?: boolean; multiline?: boolean };
const PromptCtx = createContext<(o: PromptOpts) => Promise<string | null>>(async () => null);
export const usePrompt = () => useContext(PromptCtx);

export function PromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(PromptOpts & { resolve: (v: string | null) => void }) | null>(null);
  const [value, setValue] = useState("");
  const ask = useCallback((o: PromptOpts) => {
    setValue(o.value ?? "");
    return new Promise<string | null>((resolve) => setState({ ...o, resolve }));
  }, []);
  const done = (v: string | null) => {
    state?.resolve(v);
    setState(null);
  };
  const cls = cx(inputCls, state?.hand && "font-hand text-2xl leading-tight");
  return (
    <PromptCtx.Provider value={ask}>
      {children}
      <Sheet open={!!state} onClose={() => done(null)} label={state?.title ?? "Edit"}>
        {state ? (
          <form
            className="px-6 pb-2 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              done(value);
            }}
          >
            <h2 className="text-xl font-bold tracking-tight">{state.title}</h2>
            <div className="mt-4">
              {state.multiline ? (
                <textarea
                  autoFocus
                  rows={3}
                  className={cx(cls, "resize-none")}
                  value={value}
                  maxLength={state.maxLength}
                  placeholder={state.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : (
                <input
                  autoFocus
                  className={cls}
                  value={value}
                  maxLength={state.maxLength}
                  placeholder={state.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button type="submit" variant="ink" size="lg">
                {state.confirm ?? "Save"}
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={() => done(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </Sheet>
    </PromptCtx.Provider>
  );
}

/* ---------- toasts ---------- */

type Toast = { id: number; text: string; tone: "ok" | "err" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const t = { id: ++id.current, text, tone };
    setToasts((x) => [...x.slice(-2), t]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), tone === "err" ? 4200 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "animate-rise max-w-sm rounded-full px-4 py-2.5 text-sm font-semibold shadow-card",
              t.tone === "err" ? "bg-danger text-white" : "bg-ink text-bg",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
