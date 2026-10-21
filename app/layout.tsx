import type { Metadata, Viewport } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { UploadProvider } from "@/components/uploads";
import { ConfirmProvider, PromptProvider, ToastProvider } from "@/components/ui";

const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat", display: "swap" });

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
    <html lang="en" className={caveat.variable}>
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
