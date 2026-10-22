import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LiveStateProvider } from "@/components/useLiveState";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "KaraokeScore",
  description: "Registo e votação de Karaoke",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#15100b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={cn("dark h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full">
        <LiveStateProvider>{children}</LiveStateProvider>
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
