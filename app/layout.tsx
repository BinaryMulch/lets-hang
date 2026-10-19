import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Let's Hang — find a day everyone's free",
  description:
    "Create a board, share the link with your friends, everyone marks the days that work, and you instantly see when you can all hang out.",
  openGraph: {
    siteName: "Let's Hang",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-amber-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}