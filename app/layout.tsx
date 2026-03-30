import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/Providers";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Rise — Azora Platform",
  description: "Rise AI platform for Azora.ro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={cn("font-sans", geist.variable)}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
