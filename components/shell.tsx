"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { PageLoader, cx } from "./ui";

/** Signed-in pages: sends you to log in if needed, and gives a header that firms up once you scroll. */
export function Shell({ header, children, wide }: { header: ReactNode; children: ReactNode; wide?: boolean }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const scrolled = useScrolled();

  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, session, router, path]);

  if (loading || !session) return <PageLoader />;

  return (
    <div className="paper min-h-dvh">
      <header className={cx("pt-safe sticky top-0 z-30 transition-colors", scrolled ? "border-b border-line/70 bg-bg/85 backdrop-blur-md" : "border-b border-transparent")}>
        <div className={cx("mx-auto flex h-14 items-center gap-1 px-2.5", wide ? "max-w-6xl" : "max-w-3xl")}>{header}</div>
      </header>
      <main className={cx("mx-auto px-4 pb-40 pt-2", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</main>
    </div>
  );
}

export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return scrolled;
}
