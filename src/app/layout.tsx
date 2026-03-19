import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLOB.IO — Devour Everything · Become Everything",
  description: "An agar-style browser game. Eat, grow, dominate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Unbounded:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
