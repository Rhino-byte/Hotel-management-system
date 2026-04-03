"use client";

import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Hotel Sales Entry",
  description: "Browser UI for Hotel Management System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

