import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // lets a second local session run on 127.0.0.1 (separate login from localhost) in dev
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
