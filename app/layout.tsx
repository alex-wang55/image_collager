import type { Metadata, Viewport } from "next";
import { Caveat, Comic_Neue, Permanent_Marker, Reenie_Beanie, Special_Elite } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { UploadProvider } from "@/components/uploads";
import { ConfirmProvider, PromptProvider, ToastProvider } from "@/components/ui";

const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat", display: "swap" });
// the other caption pens; only fetched once a caption actually uses one
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-permanent-marker", display: "swap", preload: false });
const pencil = Reenie_Beanie({ subsets: ["latin"], weight: "400", variable: "--font-reenie", display: "swap", preload: false });
const typewriter = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-special-elite", display: "swap", preload: false });
// phones don't ship Comic Sans, so they get Comic Neue, its open look-alike
const comic = Comic_Neue({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-comic-neue", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Shoebox",
  description: "A shared shoebox of photos for you and your people. Make boards, snap pictures, look back later.",
  applicationName: "Shoebox",
  appleWebApp: { capable: true, title: "Shoebox", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/favicon-64.png", sizes: "64x64" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2eee6" },
    { media: "(prefers-color-scheme: dark)", color: "#15130f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${caveat.variable} ${marker.variable} ${pencil.variable} ${typewriter.variable} ${comic.variable}`}>
      <body>
        <ToastProvider>
          <ConfirmProvider>
            <PromptProvider>
              <AuthProvider>
                <UploadProvider>{children}</UploadProvider>
              </AuthProvider>
            </PromptProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
