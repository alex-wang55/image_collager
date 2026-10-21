"use client";

import { useEffect, useMemo, useState } from "react";
import { cachedUrl, signUrls } from "@/lib/photos";
import { cx } from "./ui";

/** Signed URLs for a set of storage paths. Only signs the ones we haven't seen. */
export function useSigned(paths: string[]): Record<string, string> {
  const key = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of paths) {
      const u = cachedUrl(p);
      if (u) init[p] = u;
    }
    return init;
  });
  useEffect(() => {
    if (!paths.length) return;
    let alive = true;
    signUrls(paths).then((m) => {
      if (alive) setUrls((prev) => ({ ...prev, ...m }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/**
 * A photo that sits on its average colour until it loads, then fades in.
 * `crossOrigin` keeps the request CORS-mode so the service worker can cache it.
 */
export function PhotoImg({
  src,
  color,
  alt = "",
  className,
  fit = "cover",
  eager,
  onLoad,
}: {
  src?: string;
  color?: string | null;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
  eager?: boolean;
  onLoad?: () => void;
}) {
  // Track which src finished loading rather than a flag we reset on change: a
  // cached image can fire load before an effect would get the chance to reset it.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = !!src && loadedSrc === src;
  const style = useMemo(() => ({ backgroundColor: color ?? "var(--surface-2)" }), [color]);
  return (
    <span className={cx("block overflow-hidden", className)} style={fit === "cover" ? style : undefined}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          crossOrigin="anonymous"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          ref={(img) => {
            if (img?.complete && img.naturalWidth) setLoadedSrc(src);
          }}
          onLoad={() => {
            setLoadedSrc(src);
            onLoad?.();
          }}
          className={cx(
            "h-full w-full select-none transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}
